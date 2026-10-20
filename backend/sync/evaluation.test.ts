import type { Request, Response } from 'express'
import { LIBRARY_ID, addMemberAt, setMemberCapabilitiesAt, addRow, addTask, createReplica, evaluationRecord, headCid, put, resolveScope, valueContent, view } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEvaluationService } from './evaluation'
import { createEventService } from './events'
import { createHandlerRegistry } from './registry'
import { githubRepoHandler } from './hostHandlers'
import { ALLOCATION_TYPE } from '@fosforescent/shared/sync/library-types'

function setup() {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addRow(r, ['project'], ALLOCATION_TYPE, 'File issue', 1, { id: 'req', requirement: { capability: 'repo', repo: 'owner/repo' } })
  r = addMemberAt(r, [], 'integration:github', 'GitHub', [], 1)
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], [], 1, ['repo'])
  let calls = 0
  const effects = { connected: async () => true, createIssue: async () => {
    calls++
    expect(evaluationRecord(r, ['project'])?.effects[0]?.status).toBe('attempting')
    return { url: 'https://example.test/issues/1', number: 1 }
  } }
  const registry = createHandlerRegistry([githubRepoHandler({ connected: () => effects.connected(), createIssue: () => effects.createIssue() })])
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user: unknown, store: any) => { r = { ...r, store } }, now: () => 10 }
  const service = createEvaluationService(deps, registry)
  // Owners evaluate through the event grammar: a `complete` event at the node (backend/sync/events.ts → runNode).
  const events = createEventService(deps, service.runNode)
  const expected = put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), ['project'])!))
  const call = async (kind = 'user', value = expected) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    const claims = kind === 'peer' ? { username: 'owner', kind: 'peer', peerId: 'stranger', scope: ['project'] } : { username: 'owner' }
    await events.http({ claims, body: { scope: ['project'], event: { kind: 'complete', path: [], expected: value } } } as unknown as Request, res)
    return { status, body }
  }
  return { call, effects, get: () => r, calls: () => calls }
}
test('serializes simultaneous requests, persists before dispatch, and rejects stale replay', async () => {
  const s = setup()
  const results = await Promise.all([s.call(), s.call()])
  expect(results.map(r => r.status)).toEqual([200, 400])
  expect(s.calls()).toBe(1)
  expect(view(s.get(), [])!.tasks.find(t => t.id !== LIBRARY_ID)!.done).toBe(true)
})
test('strangers cannot execute an account integration and stale content cannot run', async () => {
  const s = setup()
  expect((await s.call('peer')).status).toBe(400)
  expect((await s.call('user', 'changed')).status).toBe(400)
  expect(s.calls()).toBe(0)
})
test('lost effect response creates a recovery task, with no automatic retry', async () => {
  const s = setup()
  s.effects.createIssue = async () => { throw new Error('Response lost') }
  expect((await s.call()).status).toBe(400)
  expect(evaluationRecord(s.get(), ['project'])?.status).toBe('needs-recovery')
  expect(view(s.get(), ['project'])!.tasks.some(t => t.title.startsWith('Manually roll back'))).toBe(true)
})
test('a disconnected provider blocks the step instead of running it', async () => {
  const s = setup()
  s.effects.connected = async () => false
  const { status, body } = await s.call()
  expect(status).toBe(400)
  expect(String(body.error)).toMatch(/GitHub is not active/)
  expect(s.calls()).toBe(0)
})

test('a rejected persistent claim stops before invoking any integration', async () => {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addRow(r, ['project'], ALLOCATION_TYPE, 'File issue', 1, { id: 'req', requirement: { capability: 'repo', repo: 'owner/repo' } })
  r = addMemberAt(r, [], 'integration:github', 'GitHub', [], 1)
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], [], 1, ['repo'])
  const issue = jest.fn()
  const registry = createHandlerRegistry([githubRepoHandler({ connected: async () => true, createIssue: issue })])
  const deps = { loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async () => { throw new Error('Stale root') } }
  const events = createEventService(deps, createEvaluationService(deps, registry).runNode)
  let status = 200
  const res = { setHeader() {}, status(n: number) { status = n; return res }, json() { return res } } as unknown as Response
  await events.http({ claims: { username: 'owner' }, body: { scope: ['project'], event: { kind: 'complete', path: [], expected: put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), ['project'])!)) } } } as unknown as Request, res)
  expect(status).toBe(400)
  expect(issue).not.toHaveBeenCalled()
})
