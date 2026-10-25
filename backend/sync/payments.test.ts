import type { Request, Response } from 'express'
import { addRequirement, bindUserAt, supplyRequirement, addTask, createReplica, ensureHomeContext, evaluationRecord, HOME_ID, loadReplica, serializeReplica, view, type Replica, type UserRecord } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHostRuntime } from './host-runtime'
import { paymentHandler, pointsHandler } from './hostHandlers'
import { createPaymentSettlement } from './payments'
import { verifyHandler, identityKeyFromSeed } from './verify'

const accounts: Record<string, { id: number; username: string; name?: string }> = { owner: { id: 1, username: 'owner' }, bob: { id: 2, username: 'bob', name: 'Bob' } }
const identity = verifyHandler({ findUser: async username => accounts[username] ?? null, now: () => 50 }, identityKeyFromSeed(Buffer.alloc(32, 1)))
import { minorUnits, paymentConfirmationOf } from '../payments/stripe'

const fresh = (r: Replica) => loadReplica(serializeReplica(r))
/** One owner account on a test host: events, the evaluator and payment settlement share its store. */
function host(r: Replica, runtime: ReturnType<typeof createHostRuntime>) {
  r = ensureHomeContext(r, 0, runtime.hostOffers())
  let time = 100
  const notified: unknown[] = []
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user: unknown, store: any) => { r = { ...r, store } }, now: () => ++time, notify: (_id: number, message: unknown) => { notified.push(message) } }
  const evaluation = createEvaluationService(deps, runtime)
  const events = createEventService(deps, evaluation.runNode)
  const send = async (scope: string[], event: any) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await events.http({ claims: { username: 'owner' }, body: { scope, event } } as unknown as Request, res)
    return { status, body }
  }
  const complete = async (scope: string[], path: string[]) => {
    const read = await send(scope, { kind: 'read', path })
    return send(scope, { kind: 'complete', path, expected: read.body.valueRevision })
  }
  return { send, complete, get: () => r, settlement: createPaymentSettlement(deps, evaluation.continueNode), notified }
}
const paySatisfied = (r: Replica) => view(r, [HOME_ID, 'guide'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied

/** A task bob answered, rewarding him with $20: the reward names him. */
function rewardedTask(payee: UserRecord) {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['send-payment', 'points'] })
  r = addTask(r, [HOME_ID], 'Write the guide', 2, 'guide')
  r = addRequirement(r, [HOME_ID, 'guide'], 'Guide delivered', 2, { capability: 'confirmation' }, 'done')
  r = addRequirement(r, [HOME_ID, 'guide'], 'reward', 2, { capability: 'allocation', resource: 'account', amount: 20, unit: 'USD' }, 'pay') // as `-$ 20 @bob` parses
  r = bindUserAt(r, [HOME_ID, 'guide', 'pay'], payee, 2)
  return supplyRequirement(r, [HOME_ID, 'guide'], 'done', { by: 'user:bob' }, 6)
}
const confirmed = { owner: 'owner', path: [HOME_ID, 'guide', 'pay'], amount: 20, unit: 'usd', payee: 'bob' }

test('a money requirement opens a payment with the provider and waits; the confirmation settles it and completes the task', async () => {
  const bob = (await identity.resolve('bob'))!
  const request = jest.fn(async () => ({ id: 'cs_1', url: 'https://checkout.example/cs_1', status: 'pending' as const }))
  const h = host(fresh(rewardedTask(bob)), createHostRuntime([paymentHandler({ request }, identity)]))
  const first = await h.complete([HOME_ID, 'guide'], [])
  if (!first.body.evaluation) throw new Error(`payment run failed: ${JSON.stringify(first.body)}`)
  expect(first.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]![0]).toMatchObject({ from: { id: 1, username: 'owner' }, toUsername: 'bob', amount: 20, unit: 'usd', key: `payment:owner:${HOME_ID}/guide/pay`, path: [HOME_ID, 'guide', 'pay'] })
  expect(paySatisfied(h.get())).toBe(false)
  // nothing about the open payment is in the graph: running again asks the provider again, under the same key (one payment per requirement)
  const again = await h.complete([HOME_ID, 'guide'], [])
  expect(again.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1]![0].key).toBe(request.mock.calls[0]![0].key)
  // the provider confirms (webhook): the grant is minted into the demand and the evaluation resumes to completion
  expect(await h.settlement.settle({ ...confirmed, id: 'cs_1', intent: 'pi_1' })).toBe('settled')
  expect(paySatisfied(h.get())).toBe(true)
  expect(evaluationRecord(h.get(), [HOME_ID, 'guide'])!.status).toBe('committed')
  expect(view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'guide')!.done).toBe(true)
  expect(h.notified.some(m => (m as { by?: string }).by === 'fos:payment')).toBe(true)
  // redeliveries and strangers change nothing
  expect(await h.settlement.settle({ ...confirmed, id: 'cs_1' })).toBe('already-settled')
  expect(await h.settlement.settle({ ...confirmed, path: [HOME_ID, 'guide', 'nope'], id: 'cs_1' })).toBe('unknown')
  expect(paySatisfied(h.get())).toBe(true)
})

test('an expired payment page settles nothing; the next run opens a new payment', async () => {
  const bob = (await identity.resolve('bob'))!
  let n = 0
  const request = jest.fn(async () => ({ id: `cs_${++n}`, url: `https://checkout.example/cs_${n}`, status: 'pending' as const }))
  const h = host(fresh(rewardedTask(bob)), createHostRuntime([paymentHandler({ request }, identity)]))
  await h.complete([HOME_ID, 'guide'], [])
  expect(await h.settlement.settle({ ...confirmed, id: 'cs_1', failed: 'The payment page expired before it was paid.' })).toBe('failed')
  expect(paySatisfied(h.get())).toBe(false)
  const retry = await h.complete([HOME_ID, 'guide'], [])
  expect(retry.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(2)
  expect(await h.settlement.settle({ ...confirmed, id: 'cs_2', intent: 'pi_2' })).toBe('settled')
  expect(paySatisfied(h.get())).toBe(true)
})

test('payments refuse the cases points refuse, and a provider that charges a saved method settles at once', async () => {
  const request = jest.fn(async () => ({ id: 'pi_saved', url: null, status: 'paid' as const, intent: 'pi_saved' }))
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['send-payment'] })
  r = addTask(r, [HOME_ID], 'Lonely task', 2, 'lonely')
  r = addRequirement(r, [HOME_ID, 'lonely'], 'reward', 2, { capability: 'allocation', resource: 'account', amount: 5, unit: 'usd' }, 'pay')
  const nobody = host(fresh(r), createHostRuntime([paymentHandler({ request }, identity)]))
  expect(String((await nobody.complete([HOME_ID, 'lonely'], ['pay'])).body.error)).toMatch(/Name who the payments go to/)
  const selfPaid = bindUserAt(addRequirement(r, [HOME_ID, 'lonely'], 'reward', 3, { capability: 'allocation', resource: 'account', amount: 5, unit: 'usd' }, 'pay2'), [HOME_ID, 'lonely', 'pay2'], (await identity.resolve('owner'))!, 3)
  const self = host(fresh(selfPaid), createHostRuntime([paymentHandler({ request }, identity)]))
  expect(String((await self.complete([HOME_ID, 'lonely'], ['pay2'])).body.error)).toMatch(/cannot pay themselves/)
  expect(request).not.toHaveBeenCalled()
  const h = host(fresh(rewardedTask((await identity.resolve('bob'))!)), createHostRuntime([paymentHandler({ request }, identity)]))
  const result = await h.complete([HOME_ID, 'guide'], [])
  if (!result.body.evaluation) throw new Error(`saved-method run failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(paySatisfied(h.get())).toBe(true)
})

test('a points payout is keyed by its requirement so the ledger transfer is never repeated', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
  r = addTask(r, [HOME_ID], 'Survey', 2, 'survey')
  r = addRequirement(r, [HOME_ID, 'survey'], 'Answer', 2, { capability: 'confirmation' }, 'q')
  r = addRequirement(r, [HOME_ID, 'survey'], 'reward', 2, { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' }, 'pay')
  r = bindUserAt(r, [HOME_ID, 'survey', 'pay'], (await identity.resolve('bob'))!, 2)
  r = supplyRequirement(r, [HOME_ID, 'survey'], 'q', { by: 'user:bob' }, 6)
  const transfer = jest.fn(async () => undefined)
  const h = host(fresh(r), createHostRuntime([pointsHandler({ transfer }, identity)]))
  const result = await h.complete([HOME_ID, 'survey'], [])
  if (!result.body.evaluation) throw new Error(`points run failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(transfer).toHaveBeenCalledWith({ id: 1, username: 'owner' }, 'bob', 5, expect.any(String), `points:owner:${HOME_ID}/survey/pay`)
})

test('Stripe sessions carry what settlement needs, and amounts are converted to minor units', () => {
  const meta = { type: 'fos-payment', owner: 'owner', path: JSON.stringify([HOME_ID, 'guide', 'pay']), key: 'k', payee: 'bob', amount: '20', unit: 'usd' }
  expect(paymentConfirmationOf({ id: 'cs_1', metadata: meta, payment_intent: 'pi_1', payment_status: 'paid', status: 'complete' })).toEqual({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_1', intent: 'pi_1', amount: 20, unit: 'usd', payee: 'bob' })
  expect(paymentConfirmationOf({ id: 'cs_2', metadata: meta, payment_intent: null, payment_status: 'unpaid', status: 'expired' })).toMatchObject({ id: 'cs_2', failed: /expired/ })
  expect(paymentConfirmationOf({ id: 'cs_3', metadata: { type: 'token_purchase' }, payment_intent: null, payment_status: 'paid', status: 'complete' })).toBeNull()
  expect(paymentConfirmationOf({ id: 'cs_4', metadata: { ...meta, path: 'not json' }, payment_intent: null, payment_status: 'paid', status: 'complete' })).toBeNull()
  expect(minorUnits(20, 'usd')).toBe(2000)
  expect(minorUnits(12.345, 'eur')).toBe(1235)
  expect(minorUnits(500, 'jpy')).toBe(500)
})
