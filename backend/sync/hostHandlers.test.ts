/**
 * End-to-end: rows are authored with the shared operations, a `complete` event runs the host's handlers through the
 * evaluator, and what matters afterwards is the requirement's `requirement.satisfied`, the bank's `ownerGrants` and
 * the values the UI reads. Flows that still fail here are kernel bugs reproduced in shared/sync/backend-repro.test.ts.
 */
import type { Request, Response } from 'express'
import { TITLE_SYSTEM, requirementAnswer, requestTitle } from '@fosforescent/shared/sync/index'
import { addRequirement, argumentSupplier, bindUserAt, supplyRequirement, type UserRecord } from '@fosforescent/shared/sync/index'
import { addRow, addTask, createReplica, ensureHomeContext, HOME_ID, loadReplica, serializeReplica, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHostRuntime } from './host-runtime'
import { allocateHandler, calendarHandler, titleHandler, mailHandler, mailRequest, marketHandler, pointsHandler, searchHandler } from './hostHandlers'
import { verifyHandler, identityKeyFromSeed } from './verify'
import { NOTE_TYPE } from '@fosforescent/shared/sync/library-types'
import { addBank, handleAt, issueGrant, ownerGrants, planAllocation } from '@fosforescent/shared/sync/index'

const accounts: Record<string, { id: number; username: string; name?: string }> = { bob: { id: 2, username: 'bob', name: 'Bob' }, carol: { id: 3, username: 'carol' } }
const identity = verifyHandler({ findUser: async username => accounts[username] ?? null, now: () => 50 }, identityKeyFromSeed(Buffer.alloc(32, 1)))

/** Each scenario gets its own store: a failed run leaves its journal in the store it ran against. */
const fresh = (r: Replica) => loadReplica(serializeReplica(r))
function host(r: Replica, runtime: ReturnType<typeof createHostRuntime>) {
  r = ensureHomeContext(r, 0, runtime.hostOffers())
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user: unknown, store: any) => { r = { ...r, store } }, now: () => 100 }
  const events = createEventService(deps, createEvaluationService(deps, runtime).runNode)
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
  return { send, complete, get: () => r }
}
const committed = (result: { body: any }, what: string) => { if (result.body.evaluation?.status !== 'committed') throw new Error(`${what} failed: ${JSON.stringify(result.body)}`) }
const satisfied = (r: Replica, at: string[], id: string) => view(r, at)!.tasks.find(t => t.id === id)!.requirement!.satisfied

test('a windowed calendar requirement: the event is created and the requirement is filled', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Team offsite', 2, 'offsite')
  const start = 1_760_000_000_000
  r = addRequirement(r, [HOME_ID, 'offsite'], 'Kickoff hour', 2, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start, end: start + 3_600_000 }, 'slot')
  const createEvent = jest.fn(async () => ({ url: 'https://calendar.google.com/ev1', id: 'ev1' }))
  const h = host(r, createHostRuntime([calendarHandler({ connected: async () => true, createEvent })]))
  committed(await h.complete([HOME_ID, 'offsite'], ['slot']), 'calendar')
  expect(createEvent).toHaveBeenCalledWith(1, { summary: 'Kickoff hour', description: 'Kickoff hour', start, end: start + 3_600_000 })
  expect(satisfied(h.get(), [HOME_ID, 'offsite'], 'slot')).toBe(true)
})

test('a handler whose peer is not connected blocks instead of running', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Offsite', 2, 'offsite')
  r = addRequirement(r, [HOME_ID, 'offsite'], 'Slot', 2, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start: 5, end: 3_600_005 }, 'slot')
  const createEvent = jest.fn()
  const h = host(r, createHostRuntime([calendarHandler({ connected: async () => false, createEvent })]))
  const result = await h.complete([HOME_ID, 'offsite'], ['slot'])
  expect(result.status).toBe(400)
  expect(String(result.body.error)).toMatch(/Google is not active/)
  expect(createEvent).not.toHaveBeenCalled()
})

test.each([{ start: null, end: 20 }, { start: 10, end: null }, { start: null, end: null }])('calendar handlers do not guess open endpoints: %j', async bounds => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Offsite', 2, 'offsite')
  r = addRequirement(r, [HOME_ID, 'offsite'], 'Slot', 3, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', ...bounds }, 'slot')
  const createEvent = jest.fn()
  const h = host(r, createHostRuntime([calendarHandler({ connected: async () => true, createEvent })]))
  expect((await h.complete([HOME_ID, 'offsite'], ['slot'])).status).toBe(400)
  expect(createEvent).not.toHaveBeenCalled()
})

test('a market requirement indexes the account and its answer lists the task', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['market'] })
  r = addTask(r, [HOME_ID], 'Design a logo', 2, 'logo')
  r = addRequirement(r, [HOME_ID, 'logo'], 'market', 2, { capability: 'market' }, 'list')
  const indexed: Array<{ username: string; listed: boolean }> = []
  const index = jest.fn(async (user: { username: string }, store: any) => { indexed.push({ username: user.username, listed: !!view(createReplica('x', store), [HOME_ID])!.tasks.find(t => t.id === 'logo')!.market }) })
  const h = host(r, createHostRuntime([marketHandler({ index })]))
  committed(await h.complete([HOME_ID, 'logo'], ['list']), 'listing')
  expect(indexed).toEqual([{ username: 'owner', listed: false }]) // the listing is the answer: it holds once the run commits
  const after = view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'logo')!
  expect(after.market).toBe(true)
  expect(after.done).toBe(false) // listing a task does not complete it; only its listing requirement is filled
  expect(satisfied(h.get(), [HOME_ID, 'logo'], 'list')).toBe(true)
})

test('a search requirement runs the row search for its text and is filled; hits are rows inside it', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['search'] })
  r = addTask(r, [HOME_ID], 'Logo brief', 2, 'brief')
  r = addTask(r, [HOME_ID], 'Find designers', 2, 'find')
  r = addRequirement(r, [HOME_ID, 'find'], 'logo designers', 2, { capability: 'search' }, 'ask')
  const search = jest.fn(async () => [{ aliasId: 'brief', title: 'Logo brief', owner: null }, { aliasId: 'job', title: 'Logo job', owner: 'alice' }, { aliasId: 'gone', title: 'Gone', owner: null }])
  const h = host(r, createHostRuntime([searchHandler({ search })]))
  committed(await h.complete([HOME_ID, 'find'], ['ask']), 'search')
  expect(search).toHaveBeenCalledWith({ id: 1, username: 'owner' }, 'logo designers', false)
  expect(satisfied(h.get(), [HOME_ID, 'find'], 'ask')).toBe(true)
  // the hits are reference rows inside the answer, as the search returned them
  const rows = view(h.get(), [HOME_ID, 'find', 'ask'])!.tasks
  expect(rows.filter(t => t.refId !== undefined).map(t => [t.refId, t.refOwner ?? null])).toEqual([['brief', null], ['job', 'alice'], ['gone', null]])
})

test('a fos-points reward pays the user the row names and is filled by the server', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
  r = addTask(r, [HOME_ID], 'Answer the survey', 2, 'survey')
  r = addRequirement(r, [HOME_ID, 'survey'], 'Answered?', 2, { capability: 'confirmation' }, 'q')
  r = addRequirement(r, [HOME_ID, 'survey'], 'reward', 2, { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' }, 'pay')
  const transfers: unknown[] = []
  const transfer = jest.fn(async (from: { username: string }, to: string, amount: number) => { transfers.push([from.username, to, amount]) })
  // nobody is named: nothing to pay (paying whoever answered the task awaits its replacement: a primitive sees no other rows)
  const early = host(fresh(r), createHostRuntime([pointsHandler({ transfer }, identity)]))
  expect(String((await early.complete([HOME_ID, 'survey'], ['pay'])).body.error)).toMatch(/Name who the fos points go to/)
  expect(transfer).not.toHaveBeenCalled()
  // bob answers and is named on the reward, then the task runs
  const answered = bindUserAt(supplyRequirement(r, [HOME_ID, 'survey'], 'q', { by: 'user:bob' }, 6), [HOME_ID, 'survey', 'pay'], (await identity.resolve('bob'))!, 6)
  const h = host(fresh(answered), createHostRuntime([pointsHandler({ transfer }, identity)]))
  committed(await h.complete([HOME_ID, 'survey'], []), 'payout')
  expect(transfers).toEqual([['owner', 'bob', 5]])
  expect(satisfied(h.get(), [HOME_ID, 'survey'], 'pay')).toBe(true)
  expect(view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'survey')!.done).toBe(true)
  // a failing ledger leaves the requirement open and the task unfinished
  const broke = host(fresh(answered), createHostRuntime([pointsHandler({ transfer: async () => { throw new Error('Insufficient tokens') } }, identity)]))
  expect(String((await broke.complete([HOME_ID, 'survey'], ['pay'])).body.error)).toMatch(/Insufficient tokens/)
  expect(satisfied(broke.get(), [HOME_ID, 'survey'], 'pay')).toBe(false)
})

test('a reward naming @user pays that user object, only when this server attested it unchanged', async () => {
  const carol = (await identity.resolve('carol'))!
  const named = (user: UserRecord) => {
    let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
    r = addTask(r, [HOME_ID], 'Thank carol', 2, 'thanks')
    r = addRequirement(r, [HOME_ID, 'thanks'], 'thanks', 2, { capability: 'allocation', resource: 'points', amount: 3, unit: 'ff' }, 'pay')
    return bindUserAt(r, [HOME_ID, 'thanks', 'pay'], user, 2)
  }
  const transfers: unknown[] = []
  const transfer = jest.fn(async (from: { username: string }, to: string, amount: number) => { transfers.push([from.username, to, amount]) })
  const h = host(fresh(named(carol)), createHostRuntime([pointsHandler({ transfer }, identity)]))
  committed(await h.complete([HOME_ID, 'thanks'], []), 'named payout')
  expect(transfers).toEqual([['owner', 'carol', 3]])
  expect(satisfied(h.get(), [HOME_ID, 'thanks'], 'pay')).toBe(true)
  // a tampered object (same signature, another username), an unverified one and one signed by another key are refused
  const forged = verifyHandler({ findUser: async username => accounts[username] ?? null }, identityKeyFromSeed(Buffer.alloc(32, 2)))
  for (const user of [{ ...carol, username: 'bob' }, { ...carol, verification: null }, (await forged.resolve('carol'))!]) {
    const refused = await host(fresh(named(user)), createHostRuntime([pointsHandler({ transfer }, identity)])).complete([HOME_ID, 'thanks'], ['pay'])
    expect(String(refused.body.error)).toMatch(/not verified by this server/)
  }
  expect(transfer).toHaveBeenCalledTimes(1)
})

test('a mail requirement emails its recipient input with the request text as the body and is filled by the server', async () => {
  expect(mailRequest({ to: 'team@example.com', subject: 'Trip plans' }, 'Plan the group trip')).toEqual({ to: 'team@example.com', subject: 'Trip plans', text: 'Plan the group trip' })
  expect(mailRequest({ to: 'team@example.com', subject: null }, 'Plan the group trip')).toMatchObject({ subject: 'Plan the group trip' })
  expect(mailRequest({ to: null, subject: 'x' }, 'x')).toBeNull()
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['mail'] })
  r = addTask(r, [HOME_ID], 'Plan the group trip', 2, 'trip')
  r = addTask(r, [HOME_ID, 'trip'], 'Book flights', 2, 'flights')
  r = addRequirement(r, [HOME_ID, 'trip'], 'Plan the group trip', 2, { capability: 'mail', inputs: { to: 'team@example.com', subject: 'Trip plans' } }, 'notify')
  const sent: unknown[] = []
  const send = jest.fn(async (to: string, subject: string, text: string, onBehalfOf: string) => { sent.push([to, subject, text, onBehalfOf]) })
  const h = host(fresh(r), createHostRuntime([mailHandler({ send })]))
  committed(await h.complete([HOME_ID, 'trip'], ['notify']), 'mail')
  expect(sent).toEqual([['team@example.com', 'Trip plans', 'Plan the group trip', 'owner']]) // the body is the request's own text (the task's rows await their replacement)
  expect(satisfied(h.get(), [HOME_ID, 'trip'], 'notify')).toBe(true)
  expect(argumentSupplier(h.get(), [HOME_ID, 'trip', 'notify'])).toBe('fos')
  // no recipient: nothing is sent and the requirement stays open
  const bad = addRequirement(ensureHomeContext(createReplica('user:owner'), 1, { server: ['mail'] }), [HOME_ID], 'tell everyone', 2, { capability: 'mail' }, 'vague')
  const refused = await host(fresh(bad), createHostRuntime([mailHandler({ send })])).complete([HOME_ID], ['vague'])
  expect(String(refused.body.error)).toMatch(/Unfilled instruction ref|Name the recipient/) // the declared `to` input is unfilled: the compiler refuses the step before the handler runs
  expect(send).toHaveBeenCalledTimes(1)
})

test('a title requirement summarizes the text it carries; the title is its answer', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['title'] })
  r = addRow(r, [HOME_ID], NOTE_TYPE, 'We walked the beds this morning\nand the soil is dry; the tomatoes need stakes.', 2, { id: 'note' })
  const asked = requestTitle(r, [HOME_ID, 'note'], 3, () => 'one')
  const complete = jest.fn(async () => '"Garden check: dry soil, tomato stakes."\nmore')
  const h = host(asked.replica, createHostRuntime([titleHandler({ complete })]))
  committed(await h.complete([HOME_ID, 'note'], ['one']), 'title')
  expect(complete).toHaveBeenCalledWith(TITLE_SYSTEM, 'We walked the beds this morning\nand the soil is dry; the tomatoes need stakes.')
  expect(satisfied(h.get(), [HOME_ID, 'note'], 'one')).toBe(true)
  expect(requirementAnswer(h.get(), asked.path)).toBe('Garden check: dry soil, tomato stakes')
})

test('the allocate primitive credits a bank in Home, splits a grant conserving the amount, and refuses a split that leaks', async () => {
  const runtime = createHostRuntime([allocateHandler()])
  let r = ensureHomeContext(createReplica('user:owner'), 1, runtime.hostOffers())
  r = addBank(r, [HOME_ID], 'Budget', 2, { type: 'account', unit: 'USD' }, 'bank')
  r = issueGrant(r, [HOME_ID, 'bank'], { type: 'account', unit: 'USD', amount: 10 }, 3, 'Initial', 'g0')
  r = addTask(r, [HOME_ID], 'Work', 4, 'work')
  const h0 = host(r, runtime)
  committed(await h0.complete([HOME_ID], ['g0']), 'credit') // the credit is an invocation: issued when it commits
  r = h0.get()
  expect(ownerGrants(r, [HOME_ID, 'bank']).map(grant => grant.allocation.amount)).toEqual([10])
  const g0 = ownerGrants(r, [HOME_ID, 'bank'])[0]!
  r = planAllocation(r, [HOME_ID, 'work'], { owner: [HOME_ID, 'bank'], inputs: [{ grant: g0.cid }], outputs: [{ type: 'account', unit: 'USD', amount: 6, id: 'child' }, { type: 'account', unit: 'USD', amount: 4, id: 'rest' }] }, 5, 'split')
  const h = host(r, runtime)
  committed(await h.complete([HOME_ID, 'work'], ['split']), 'split')
  expect(ownerGrants(h.get(), [HOME_ID, 'bank']).map(grant => grant.allocation.amount).sort()).toEqual([4, 6])
  expect(handleAt(h.get(), [HOME_ID, 'work', 'split', 'child'])?.allocation.amount).toBe(6)
  const next = planAllocation(h.get(), [HOME_ID, 'work'], { owner: [HOME_ID, 'bank'], inputs: [[HOME_ID, 'work', 'split', 'child']], outputs: [{ type: 'account', unit: 'USD', amount: 5 }] }, 6, 'leak')
  const bad = host(next, runtime)
  expect(JSON.stringify((await bad.complete([HOME_ID, 'work'], ['leak'])).body)).toMatch(/conserve/)
  expect(ownerGrants(bad.get(), [HOME_ID, 'bank']).map(grant => grant.allocation.amount).sort()).toEqual([4, 6])
  expect(handleAt(bad.get(), [HOME_ID, 'work', 'split', 'child'])?.allocation.amount).toBe(6)
})
