import type { Request, Response } from 'express'
import { addMemberAt, addRow, addTask, createReplica, decideTaskResult, ensureHomeContext, evaluationRecord, HOME_ID, setMemberCapabilitiesAt, view, workAttempts, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHandlerRegistry } from './registry'
import { calendarHandler, llmHandler } from './hostHandlers'

function host(r: Replica, registry: ReturnType<typeof createHandlerRegistry>) {
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user: unknown, store: any) => { r = { ...r, store } }, now: () => 100 }
  const events = createEventService(deps, createEvaluationService(deps, registry).runNode)
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
  r = addRow(r, [HOME_ID, 'plan'], 'requirement', 'Draft the plan', 2, { id: 'ask', requirement: { capability: 'llm' } })
  const complete = jest.fn(async () => '1. Announce\n2. Ship')
  const h = host(r, createHandlerRegistry([llmHandler({ complete })]))
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
  const h2 = host(accepted, createHandlerRegistry([llmHandler({ complete })]))
  const second = await h2.complete([HOME_ID, 'plan'], ['ask'])
  if (!second.body.evaluation) throw new Error(`second completion failed: ${JSON.stringify(second.body)}`)
  expect(second.body.evaluation.status).toBe('committed')
  expect(complete).toHaveBeenCalledTimes(1)
})

test('the calendar effect creates the event and the allocation that fills a time requirement', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Team offsite', 2, 'offsite')
  const start = 1_760_000_000_000
  r = addRow(r, [HOME_ID, 'offsite'], 'requirement', 'Kickoff hour', 2, { id: 'slot', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start, end: start + 3_600_000 } })
  const createEvent = jest.fn(async () => ({ url: 'https://calendar.google.com/ev1', id: 'ev1' }))
  const h = host(r, createHandlerRegistry([calendarHandler({ connected: async () => true, createEvent })]))
  const result = await h.complete([HOME_ID, 'offsite'], ['slot'])
  expect(result.status).toBe(200)
  expect(result.body.evaluation.status).toBe('committed')
  expect(createEvent).toHaveBeenCalledWith(1, { summary: 'Kickoff hour', description: 'Kickoff hour', start, end: start + 3_600_000 })
  const slot = view(h.get(), [HOME_ID, 'offsite'])!.tasks.find(t => t.id === 'slot')!
  expect(slot.requirement!.satisfied).toBe(true)
  expect(view(h.get(), [HOME_ID, 'offsite', 'slot'])!.tasks.map(t => [t.kind, t.title])).toEqual([['allocation', 'on Google Calendar https://calendar.google.com/ev1']])
})

test('an effect whose peer is not connected blocks instead of running', async () => {
  let r = ensureHomeContext(createReplica('user:owner'), 1, { integrations: { google: ['calendar'] } })
  r = addTask(r, [HOME_ID], 'Offsite', 2, 'offsite')
  r = addRow(r, [HOME_ID, 'offsite'], 'requirement', 'Slot', 2, { id: 'slot', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start: 5, end: 3_600_005 } })
  const createEvent = jest.fn()
  const h = host(r, createHandlerRegistry([calendarHandler({ connected: async () => false, createEvent })]))
  const result = await h.complete([HOME_ID, 'offsite'], ['slot'])
  expect(result.status).toBe(400)
  expect(String(result.body.error)).toMatch(/Google is not active/)
  expect(createEvent).not.toHaveBeenCalled()
  void addMemberAt; void setMemberCapabilitiesAt
})
