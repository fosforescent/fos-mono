import type { Request, Response } from 'express'
import { addRow, addSupply, addTask, createReplica, ensureHomeContext, evaluationRecord, HOME_ID, loadReplica, paymentRecord, serializeReplica, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHandlerRegistry } from './registry'
import { paymentHandler, pointsHandler } from './hostHandlers'
import { createPaymentSettlement } from './payments'
import { minorUnits, paymentConfirmationOf } from '../payments/stripe'

const fresh = (r: Replica) => loadReplica(serializeReplica(r))
/** One owner account on a test host: events, the evaluator and payment settlement share its store. */
function host(r: Replica, registry: ReturnType<typeof createHandlerRegistry>) {
  let time = 100
  const notified: unknown[] = []
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user: unknown, store: any) => { r = { ...r, store } }, now: () => ++time, notify: (_id: number, message: unknown) => { notified.push(message) } }
  const evaluation = createEvaluationService(deps, registry)
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

/** A task bob answered, rewarding him with $20. */
function rewardedTask() {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['send-payment', 'points'] })
  r = addTask(r, [HOME_ID], 'Write the guide', 2, 'guide')
  r = addRow(r, [HOME_ID, 'guide'], 'requirement', 'Guide delivered', 2, { id: 'done', requirement: { capability: 'confirmation' } })
  r = addRow(r, [HOME_ID, 'guide'], 'requirement', 'reward', 2, { id: 'pay', requirement: { capability: 'allocation', resource: 'account', amount: 20, unit: 'usd' } })
  return addSupply(r, [HOME_ID, 'guide'], 'done', { capability: 'confirmation', by: 'user:bob' }, 6)
}

test('a money requirement opens one payment with the provider and waits; the confirmation settles it and completes the task', async () => {
  const request = jest.fn(async () => ({ id: 'cs_1', url: 'https://checkout.example/cs_1', status: 'pending' as const }))
  const h = host(fresh(rewardedTask()), createHandlerRegistry([paymentHandler({ request })]))
  const first = await h.complete([HOME_ID, 'guide'], [])
  if (!first.body.evaluation) throw new Error(`payment run failed: ${JSON.stringify(first.body)}`)
  expect(first.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]![0]).toMatchObject({ from: { id: 1, username: 'owner' }, toUsername: 'bob', amount: 20, unit: 'usd', key: `payment:owner:${HOME_ID}/guide/pay`, path: [HOME_ID, 'guide', 'pay'] })
  const opened = paymentRecord(h.get(), [HOME_ID, 'guide', 'pay'])!
  expect(opened).toMatchObject({ id: 'cs_1', url: 'https://checkout.example/cs_1', status: 'pending', amount: 20, unit: 'usd', payer: 'owner', payee: 'bob' })
  expect(view(h.get(), [HOME_ID, 'guide'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied).toBe(false)
  // running again while the payment page is open does not open a second payment
  const again = await h.complete([HOME_ID, 'guide'], [])
  expect(again.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(1)
  // the provider confirms (webhook): the allocation and supply are recorded as fos and the evaluation resumes to completion
  expect(await h.settlement.settle({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_1', intent: 'pi_1' })).toBe('settled')
  const pay = view(h.get(), [HOME_ID, 'guide'])!.tasks.find(t => t.id === 'pay')!
  expect(pay.requirement!.satisfied).toBe(true)
  const rows = view(h.get(), [HOME_ID, 'guide', 'pay'])!.tasks
  expect(rows.find(t => t.kind === 'allocation')!.allocation).toMatchObject({ resource: 'pay', type: 'account', amount: 20, unit: 'usd', by: 'fos', person: 'bob' })
  expect(rows.filter(t => t.kind === 'supply').map(t => t.supply!.by)).toEqual(['fos'])
  expect(paymentRecord(h.get(), [HOME_ID, 'guide', 'pay'])).toMatchObject({ status: 'paid', intent: 'pi_1', url: null })
  expect(evaluationRecord(h.get(), [HOME_ID, 'guide'])!.status).toBe('committed')
  expect(view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'guide')!.done).toBe(true)
  expect(h.notified.some(m => (m as { by?: string }).by === 'fos:payment')).toBe(true)
  // redeliveries and strangers change nothing
  expect(await h.settlement.settle({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_1' })).toBe('already-settled')
  expect(await h.settlement.settle({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_other' })).toBe('unknown')
  expect(await h.settlement.settle({ owner: 'owner', path: [HOME_ID, 'guide', 'nope'], id: 'cs_1' })).toBe('unknown')
  expect(view(h.get(), [HOME_ID, 'guide', 'pay'])!.tasks.filter(t => t.kind === 'allocation')).toHaveLength(1)
})

test('an expired payment page is recorded as failed and the next run opens a new payment', async () => {
  let n = 0
  const request = jest.fn(async () => ({ id: `cs_${++n}`, url: `https://checkout.example/cs_${n}`, status: 'pending' as const }))
  const h = host(fresh(rewardedTask()), createHandlerRegistry([paymentHandler({ request })]))
  await h.complete([HOME_ID, 'guide'], [])
  expect(await h.settlement.settle({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_1', failed: 'The payment page expired before it was paid.' })).toBe('failed')
  expect(paymentRecord(h.get(), [HOME_ID, 'guide', 'pay'])).toMatchObject({ status: 'failed', url: null, error: /expired/ })
  const retry = await h.complete([HOME_ID, 'guide'], [])
  expect(retry.body.evaluation.status).toBe('awaiting-review')
  expect(request).toHaveBeenCalledTimes(2)
  expect(paymentRecord(h.get(), [HOME_ID, 'guide', 'pay'])).toMatchObject({ id: 'cs_2', status: 'pending' })
})

test('payments refuse the cases points refuse, and a provider that charges a saved method settles at once', async () => {
  const request = jest.fn(async () => ({ id: 'pi_saved', url: null, status: 'paid' as const, intent: 'pi_saved' }))
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['send-payment'] })
  r = addTask(r, [HOME_ID], 'Lonely task', 2, 'lonely')
  r = addRow(r, [HOME_ID, 'lonely'], 'requirement', 'reward', 2, { id: 'pay', requirement: { capability: 'allocation', resource: 'account', amount: 5, unit: 'usd' } })
  const nobody = host(fresh(r), createHandlerRegistry([paymentHandler({ request })]))
  expect(String((await nobody.complete([HOME_ID, 'lonely'], ['pay'])).body.error)).toMatch(/No one to pay yet/)
  const selfPaid = addRow(r, [HOME_ID, 'lonely'], 'requirement', 'reward', 3, { id: 'pay2', requirement: { capability: 'allocation', resource: 'account', amount: 5, unit: 'usd', peer: 'owner' } })
  const self = host(fresh(selfPaid), createHandlerRegistry([paymentHandler({ request })]))
  expect(String((await self.complete([HOME_ID, 'lonely'], ['pay2'])).body.error)).toMatch(/cannot pay themselves/)
  expect(request).not.toHaveBeenCalled()
  const h = host(fresh(rewardedTask()), createHandlerRegistry([paymentHandler({ request })]))
  const result = await h.complete([HOME_ID, 'guide'], [])
  if (!result.body.evaluation) throw new Error(`saved-method run failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(paymentRecord(h.get(), [HOME_ID, 'guide', 'pay'])).toMatchObject({ status: 'paid', intent: 'pi_saved' })
  expect(view(h.get(), [HOME_ID, 'guide'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied).toBe(true)
})

test('a points payout is keyed by its requirement so the ledger transfer is never repeated', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
  r = addTask(r, [HOME_ID], 'Survey', 2, 'survey')
  r = addRow(r, [HOME_ID, 'survey'], 'requirement', 'Answer', 2, { id: 'q', requirement: { capability: 'confirmation' } })
  r = addRow(r, [HOME_ID, 'survey'], 'requirement', 'reward', 2, { id: 'pay', requirement: { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' } })
  r = addSupply(r, [HOME_ID, 'survey'], 'q', { capability: 'confirmation', by: 'user:bob' }, 6)
  const transfer = jest.fn(async () => undefined)
  const h = host(fresh(r), createHandlerRegistry([pointsHandler({ transfer })]))
  const result = await h.complete([HOME_ID, 'survey'], [])
  expect(result.body.evaluation.status).toBe('committed')
  expect(transfer).toHaveBeenCalledWith({ id: 1, username: 'owner' }, 'bob', 5, expect.any(String), `points:owner:${HOME_ID}/survey/pay`)
})

test('Stripe sessions carry what settlement needs, and amounts are converted to minor units', () => {
  const meta = { type: 'fos-payment', owner: 'owner', path: JSON.stringify([HOME_ID, 'guide', 'pay']), key: 'k', payee: 'bob' }
  expect(paymentConfirmationOf({ id: 'cs_1', metadata: meta, payment_intent: 'pi_1', payment_status: 'paid', status: 'complete' })).toEqual({ owner: 'owner', path: [HOME_ID, 'guide', 'pay'], id: 'cs_1', intent: 'pi_1' })
  expect(paymentConfirmationOf({ id: 'cs_2', metadata: meta, payment_intent: null, payment_status: 'unpaid', status: 'expired' })).toMatchObject({ id: 'cs_2', failed: /expired/ })
  expect(paymentConfirmationOf({ id: 'cs_3', metadata: { type: 'token_purchase' }, payment_intent: null, payment_status: 'paid', status: 'complete' })).toBeNull()
  expect(paymentConfirmationOf({ id: 'cs_4', metadata: { ...meta, path: 'not json' }, payment_intent: null, payment_status: 'paid', status: 'complete' })).toBeNull()
  expect(minorUnits(20, 'usd')).toBe(2000)
  expect(minorUnits(12.345, 'eur')).toBe(1235)
  expect(minorUnits(500, 'jpy')).toBe(500)
})
