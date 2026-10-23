import type { Request, Response } from 'express'
import { createHash } from 'node:crypto'
import { TITLE_SYSTEM, handlerResult, requestTitle } from '@fosforescent/shared/sync/index'
import { MARKET_PEER, addMemberAt, addRow, addSupply, addTask, content, createReplica, decideTaskResult, ensureHomeContext, evaluationRecord, headCid, HOME_ID, loadReplica, readMembers, resolveScope, serializeReplica, setMemberCapabilitiesAt, sharedProjection, view, workAttempts, writeParticipation, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHostRuntime } from './host-runtime'
import { calendarHandler, llmHandler, titleHandler, mailHandler, mailRequest, marketHandler, pointsHandler, searchHandler } from './hostHandlers'
import { verifyHandler, identityKeyFromSeed } from './verify'
import { QUERY_TYPE, ALLOCATION_TYPE, NOTE_TYPE } from '@fosforescent/shared/sync/library-types'
import { PLAIN_TYPE } from '@fosforescent/shared/sync/library-types'

const accounts: Record<string, { id: number; username: string; name?: string }> = { bob: { id: 2, username: 'bob', name: 'Bob' }, carol: { id: 3, username: 'carol' } }
const identity = verifyHandler({ findUser: async username => accounts[username] ?? null, now: () => 50 }, identityKeyFromSeed(Buffer.alloc(32, 1)))

/** Each scenario gets its own store: a failed run leaves its journal in the store it ran against. */
const fresh = (r: Replica) => loadReplica(serializeReplica(r))
function host(r: Replica, runtime: ReturnType<typeof createHostRuntime>) {
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

test('the llm effect pins the attempt, leaves the answer for review, and commits once the owner accepts it', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['llm'] })
  r = addTask(r, [HOME_ID], 'Plan the launch', 2, 'plan')
  r = addRow(r, [HOME_ID, 'plan'], ALLOCATION_TYPE, 'Draft the plan', 2, { id: 'ask', requirement: { capability: 'llm' } })
  const complete = jest.fn(async () => '1. Announce\n2. Ship')
  const h = host(r, createHostRuntime([llmHandler({ complete })]))
  const first = await h.complete([HOME_ID, 'plan'], ['ask'])
  expect(first.status).toBe(200)
  expect(first.body.evaluation.status).toBe('awaiting-review')
  expect(complete).toHaveBeenCalledTimes(1)
  const request = [HOME_ID, 'plan', 'ask']
  const attempts = workAttempts(h.get(), request)
  expect(attempts).toHaveLength(1)
  expect(attempts[0]!.proposals.map(p => p.status)).toEqual(['open'])
  expect(view(h.get(), [HOME_ID, 'plan'])!.tasks.find(t => t.id === 'ask')!.requirement!.satisfied).toBe(false)
  expect(evaluationRecord(h.get(), request)!.effects[0]!.status).toBe('pending-review')
  // acceptance supplies the requirement (shared/sync/work.ts); completing again commits without another model call
  const accepted = decideTaskResult(h.get(), request, attempts[0]!.resultPath, attempts[0]!.proposals[0]!.cid, true, 200)
  expect(view(accepted, [HOME_ID, 'plan'])!.tasks.find(t => t.id === 'ask')!.requirement!.satisfied).toBe(true)
  const h2 = host(accepted, createHostRuntime([llmHandler({ complete })]))
  const second = await h2.complete([HOME_ID, 'plan'], ['ask'])
  if (!second.body.evaluation) throw new Error(`second completion failed: ${JSON.stringify(second.body)}`)
  expect(second.body.evaluation.status).toBe('committed')
  expect(complete).toHaveBeenCalledTimes(1)
})

test('the calendar effect creates the event and the allocation that fills a time requirement', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Team offsite', 2, 'offsite')
  const start = 1_760_000_000_000
  r = addRow(r, [HOME_ID, 'offsite'], ALLOCATION_TYPE, 'Kickoff hour', 2, { id: 'slot', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start, end: start + 3_600_000 } })
  const createEvent = jest.fn(async () => ({ url: 'https://calendar.google.com/ev1', id: 'ev1' }))
  const h = host(r, createHostRuntime([calendarHandler({ connected: async () => true, createEvent })]))
  const result = await h.complete([HOME_ID, 'offsite'], ['slot'])
  expect(result.status).toBe(200)
  expect(result.body.evaluation.status).toBe('committed')
  expect(createEvent).toHaveBeenCalledWith(1, { summary: 'Kickoff hour', description: 'Kickoff hour', start, end: start + 3_600_000 })
  const slot = view(h.get(), [HOME_ID, 'offsite'])!.tasks.find(t => t.id === 'slot')!
  expect(slot.requirement!.satisfied).toBe(true)
  expect(view(h.get(), [HOME_ID, 'offsite', 'slot'])!.tasks.filter(t => t.allocation).map(t => [t.type, t.title])).toEqual([[ALLOCATION_TYPE, 'on Google Calendar https://calendar.google.com/ev1']])
})

test('an effect whose peer is not connected blocks instead of running', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Offsite', 2, 'offsite')
  r = addRow(r, [HOME_ID, 'offsite'], ALLOCATION_TYPE, 'Slot', 2, { id: 'slot', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start: 5, end: 3_600_005 } })
  const createEvent = jest.fn()
  const h = host(r, createHostRuntime([calendarHandler({ connected: async () => false, createEvent })]))
  const result = await h.complete([HOME_ID, 'offsite'], ['slot'])
  expect(result.status).toBe(400)
  expect(String(result.body.error)).toMatch(/Google is not active/)
  expect(createEvent).not.toHaveBeenCalled()
  void addMemberAt; void setMemberCapabilitiesAt
})


test('the market effect lists the task, indexes the account, and records the supply as the server (the client writes neither)', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['market'] })
  r = addTask(r, [HOME_ID], 'Design a logo', 2, 'logo')
  r = addRow(r, [HOME_ID, 'logo'], ALLOCATION_TYPE, 'market', 2, { id: 'list', requirement: { capability: 'market' } })
  const indexed: Array<{ username: string; listed: boolean }> = []
  const index = jest.fn(async (user: { username: string }, store: any) => { indexed.push({ username: user.username, listed: !!view(createReplica('x', store), [HOME_ID])!.tasks.find(t => t.id === 'logo')!.market }) })
  const h = host(r, createHostRuntime([marketHandler({ index })]))
  const result = await h.complete([HOME_ID, 'logo'], ['list'])
  if (!result.body.evaluation) throw new Error(`listing failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  // listed before it was indexed, indexed before it was reported as supplied
  expect(indexed).toEqual([{ username: 'owner', listed: true }])
  const after = view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'logo')!
  expect(after.market).toBe(true)
  expect(after.done).toBe(false) // listing a task does not complete it; only its listing requirement is filled
  const supplies = view(h.get(), [HOME_ID, 'logo', 'list'])!.tasks.filter(t => !!t.supply)
  expect(supplies.map(s => [s.supply!.capability, s.supply!.by, s.supply!.ref])).toEqual([['market', 'fos', 'logo']])
  // the listing is the market peer as a member of the task
  expect(readMembers(h.get().store, content(h.get().store, resolveScope(h.get().store, headCid(h.get()), [HOME_ID, 'logo'])!)).map(m => m.peerId)).toContain(MARKET_PEER)
})

test('the search effect fills a -? requirement: hits become ref rows under it, then the supply is recorded as the server', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['search'] })
  r = addTask(r, [HOME_ID], 'Logo brief', 2, 'brief')
  r = addTask(r, [HOME_ID], 'Find designers', 2, 'find')
  r = addRow(r, [HOME_ID, 'find'], ALLOCATION_TYPE, 'logo designers', 2, { id: 'ask', requirement: { capability: 'search' } })
  r = addRow(r, [HOME_ID, 'find', 'ask'], QUERY_TYPE, 'logo designers', 2, { id: 'q', query: { market: true } })
  const search = jest.fn(async () => [{ aliasId: 'brief', title: 'Logo brief', owner: null }, { aliasId: 'job', title: 'Logo job', owner: 'alice' }, { aliasId: 'gone', title: 'Gone', owner: null }])
  const h = host(r, createHostRuntime([searchHandler({ search })]))
  const result = await h.complete([HOME_ID, 'find'], ['ask'])
  if (!result.body.evaluation) throw new Error(`search failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(search).toHaveBeenCalledWith({ id: 1, username: 'owner' }, 'logo designers', true)
  const rows = view(h.get(), [HOME_ID, 'find', 'ask'])!.tasks
  expect(rows.filter(t => t.refId !== undefined).map(t => [t.refId, t.refOwner ?? null])).toEqual([['brief', null], ['job', 'alice']])
  expect(rows.filter(t => t.supply).map(t => [t.supply!.capability, t.supply!.by, t.supply!.ref])).toEqual([['search', 'fos', 'q']])
  expect(view(h.get(), [HOME_ID, 'find'])!.tasks.find(t => t.id === 'ask')!.requirement!.satisfied).toBe(true)
})

test('a fos-points payout moves points on the ledger to the respondent and records the allocation as the server', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
  r = addTask(r, [HOME_ID], 'Answer the survey', 2, 'survey')
  r = addRow(r, [HOME_ID, 'survey'], ALLOCATION_TYPE, 'Favourite colour?', 2, { id: 'q', requirement: { capability: 'choice', options: ['Red', 'Blue'] } })
  r = addRow(r, [HOME_ID, 'survey'], ALLOCATION_TYPE, 'reward', 2, { id: 'pay', requirement: { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' } })
  const transfers: unknown[] = []
  const transfer = jest.fn(async (from: { username: string }, to: string, amount: number) => { transfers.push([from.username, to, amount]) })
  // nobody has answered: nothing to pay
  const early = host(fresh(r), createHostRuntime([pointsHandler({ transfer }, identity)]))
  expect(String((await early.complete([HOME_ID, 'survey'], ['pay'])).body.error)).toMatch(/No one to pay yet/)
  expect(transfer).not.toHaveBeenCalled()
  // bob answers (a supply by his account), then the task runs
  const answered = addSupply(r, [HOME_ID, 'survey'], 'q', { capability: 'choice', by: 'user:bob', choice: 1 }, 6)
  const h = host(fresh(answered), createHostRuntime([pointsHandler({ transfer }, identity)]))
  const result = await h.complete([HOME_ID, 'survey'], [])
  if (!result.body.evaluation) throw new Error(`payout failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(transfers).toEqual([['owner', 'bob', 5]])
  const pay = view(h.get(), [HOME_ID, 'survey'])!.tasks.find(t => t.id === 'pay')!
  expect(pay.requirement!.satisfied).toBe(true)
  const rows = view(h.get(), [HOME_ID, 'survey', 'pay'])!.tasks
  const payout = rows.find(t => !!t.allocation)!
  expect(payout.allocation).toMatchObject({ resource: 'fos:points', type: 'points', amount: 5, unit: 'ff', by: 'fos' })
  expect(payout.user).toMatchObject({ account: '2', username: 'bob', name: 'Bob' })
  expect(payout.title).toBe('5 fos points to Bob')
  expect(rows.find(t => !!t.supply)!.supply).toMatchObject({ capability: 'allocation', by: 'fos' })
  expect(view(h.get(), [HOME_ID])!.tasks.find(t => t.id === 'survey')!.done).toBe(true)
  // a failing ledger leaves the requirement open and the task unfinished
  const broke = host(fresh(answered), createHostRuntime([pointsHandler({ transfer: async () => { throw new Error('Insufficient tokens') } }, identity)]))
  expect(String((await broke.complete([HOME_ID, 'survey'], ['pay'])).body.error)).toMatch(/Insufficient tokens/)
  expect(view(broke.get(), [HOME_ID, 'survey'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied).toBe(false)
})

test('a payout to @name pays the user object the requirement binds, only when this server attested it unchanged', async () => {
  const carol = (await identity.resolve('carol'))!
  const named = (user: typeof carol) => {
    let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['points'] })
    r = addTask(r, [HOME_ID], 'Thank carol', 2, 'thanks')
    // "-ff 3 thanks @carol": no respondent needed, the row names the payee
    return addRow(r, [HOME_ID, 'thanks'], ALLOCATION_TYPE, 'thanks', 2, { id: 'pay', requirement: { capability: 'allocation', resource: 'points', amount: 3, unit: 'ff' }, user })
  }
  const transfers: unknown[] = []
  const transfer = jest.fn(async (from: { username: string }, to: string, amount: number) => { transfers.push([from.username, to, amount]) })
  const h = host(fresh(named(carol)), createHostRuntime([pointsHandler({ transfer }, identity)]))
  const result = await h.complete([HOME_ID, 'thanks'], [])
  if (!result.body.evaluation) throw new Error(`named payout failed: ${JSON.stringify(result.body)}`)
  expect(transfers).toEqual([['owner', 'carol', 3]])
  expect(view(h.get(), [HOME_ID, 'thanks'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied).toBe(true)
  // a tampered object (same signature, another username), an unverified one and one signed by another key are refused
  const forged = verifyHandler({ findUser: async username => accounts[username] ?? null }, identityKeyFromSeed(Buffer.alloc(32, 2)))
  for (const user of [{ ...carol, username: 'bob' }, { ...carol, verification: null }, (await forged.resolve('carol'))!]) {
    const refused = await host(fresh(named(user)), createHostRuntime([pointsHandler({ transfer }, identity)])).complete([HOME_ID, 'thanks'], ['pay'])
    expect(String(refused.body.error)).toMatch(/not verified by this server/)
  }
  expect(transfer).toHaveBeenCalledTimes(1)
})

test("the mail effect emails the requirement's recipient input with the task as the body, and records the supply as the server", async () => {
  expect(mailRequest({ to: 'team@example.com', subject: 'Trip plans' }, 'Plan the group trip', ['Book flights', 'Reserve lodging'])).toEqual({ to: 'team@example.com', subject: 'Trip plans', text: 'Plan the group trip\n- Book flights\n- Reserve lodging' })
  expect(mailRequest({ to: 'team@example.com', subject: null }, 'Plan the group trip', [])).toMatchObject({ subject: 'Plan the group trip' })
  expect(mailRequest({ to: null, subject: 'x' }, 'x', [])).toBeNull()
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['mail'] })
  r = addTask(r, [HOME_ID], 'Plan the group trip', 2, 'trip')
  r = addTask(r, [HOME_ID, 'trip'], 'Book flights', 2, 'flights')
  r = addRow(r, [HOME_ID, 'trip'], ALLOCATION_TYPE, 'team@example.com Trip plans', 2, { id: 'notify', requirement: { capability: 'mail' }, inputs: { to: 'team@example.com', subject: 'Trip plans' } })
  const sent: unknown[] = []
  const send = jest.fn(async (to: string, subject: string, text: string, onBehalfOf: string) => { sent.push([to, subject, text, onBehalfOf]) })
  const h = host(fresh(r), createHostRuntime([mailHandler({ send })]))
  const result = await h.complete([HOME_ID, 'trip'], ['notify'])
  if (!result.body.evaluation) throw new Error(`mail failed: ${JSON.stringify(result.body)}`)
  expect(result.body.evaluation.status).toBe('committed')
  expect(sent).toEqual([['team@example.com', 'Trip plans', 'Plan the group trip\n- Book flights', 'owner']])
  const rows = view(h.get(), [HOME_ID, 'trip', 'notify'])!.tasks
  expect(rows.find(t => t.type === PLAIN_TYPE)!.title).toBe('Sent to team@example.com: Trip plans')
  expect(rows.find(t => !!t.supply)!.supply).toMatchObject({ capability: 'mail', by: 'fos' })
  // no recipient: nothing is sent and the requirement stays open
  const bad = addRow(ensureHomeContext(createReplica('user:owner'), 1, { server: ['mail'] }), [HOME_ID], ALLOCATION_TYPE, 'tell everyone', 2, { id: 'vague', requirement: { capability: 'mail' } })
  const refused = await host(fresh(bad), createHostRuntime([mailHandler({ send })])).complete([HOME_ID], ['vague'])
  expect(String(refused.body.error)).toMatch(/Name the recipient/)
  expect(send).toHaveBeenCalledTimes(1)
})

test('the title effect summarizes the text of the row it is in and records the title as its value', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['title'] })
  r = addRow(r, [HOME_ID], NOTE_TYPE, 'We walked the beds this morning\nand the soil is dry; the tomatoes need stakes.', 2, { id: 'note' })
  expect(view(r, [HOME_ID])!.tasks.find(t => t.id === 'note')!.title).toBe('We walked the beds this morning')
  const asked = requestTitle(r, [HOME_ID, 'note'], 3, () => 'one')
  const complete = jest.fn(async () => '"Garden check: dry soil, tomato stakes."\nmore')
  const h = host(asked.replica, createHostRuntime([titleHandler({ complete })]))
  const done = await h.complete([HOME_ID, 'note'], ['one'])
  expect(done.body.evaluation.status).toBe('committed')
  expect(complete).toHaveBeenCalledWith(TITLE_SYSTEM, 'We walked the beds this morning\nand the soil is dry; the tomatoes need stakes.')
  expect(handlerResult(h.get(), asked.path)).toBe('Garden check: dry soil, tomato stakes')
  expect(view(h.get(), [HOME_ID, 'note'])!.tasks.find(t => t.id === 'one')!.requirement!.satisfied).toBe(true)
})
