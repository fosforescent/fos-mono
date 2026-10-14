import type { Request, Response } from 'express'
import { addMemberAt, setMemberCapabilitiesAt, addRow, addTask, createReplica, evaluationRecord, headCid, put, resolveScope, valueContent, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEvaluationService } from './evaluation'

function setup() {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addRow(r, ['project'], 'requirement', 'File issue', 1, { id: 'req', requirement: { capability: 'repo', repo: 'owner/repo' } })
  r = addMemberAt(r, [], 'integration:github', 'GitHub', [], 1)
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], [], 1, ['repo'])
  let calls = 0
  const effects = { githubConnected: async () => true, createIssue: async () => {
    calls++
    expect(evaluationRecord(r, ['project'])?.effects[0]?.status).toBe('attempting')
    return { url: 'https://example.test/issues/1', number: 1 }
  } }
  const service = createEvaluationService({ loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async (_user, store) => { r = { ...r, store } }, now: () => 10 }, effects)
  const expected = put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), ['project'])!))
  const call = async (kind = 'user', value = expected) => {
    let status = 200, body: any
    const res = { status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await service.handler({ claims: { username: 'owner', kind }, body: { path: ['project'], expected: value } } as unknown as Request, res)
    return { status, body }
  }
  return { call, effects, get: () => r, calls: () => calls }
}
test('serializes simultaneous requests, persists before dispatch, and rejects stale replay', async () => {
  const s = setup()
  const results = await Promise.all([s.call(), s.call()])
  expect(results.map(r => r.status)).toEqual([200, 409])
  expect(s.calls()).toBe(1)
  expect(view(s.get(), [])!.tasks[0]!.done).toBe(true)
})
test('invited peers cannot execute an account integration and stale content cannot run', async () => {
  const s = setup()
  expect((await s.call('peer')).status).toBe(403)
  expect((await s.call('user', 'changed')).status).toBe(409)
  expect(s.calls()).toBe(0)
})
test('lost effect response creates a recovery task, with no automatic retry', async () => {
  const s = setup()
  s.effects.createIssue = async () => { throw new Error('Response lost') }
  expect((await s.call()).status).toBe(409)
  expect(evaluationRecord(s.get(), ['project'])?.status).toBe('needs-recovery')
  expect(view(s.get(), ['project'])!.tasks.some(t => t.title.startsWith('Manually roll back'))).toBe(true)
})

test('a rejected persistent claim stops before invoking any integration', async () => {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addRow(r, ['project'], 'requirement', 'File issue', 1, { id: 'req', requirement: { capability: 'repo', repo: 'owner/repo' } })
  r = addMemberAt(r, [], 'integration:github', 'GitHub', [], 1)
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], [], 1, ['repo'])
  const issue = jest.fn()
  const service = createEvaluationService({ loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: r.store }), saveStore: async () => { throw new Error('Stale root') } }, { githubConnected: async () => true, createIssue: issue })
  let status = 200
  const res = { status(n: number) { status = n; return res }, json() { return res } } as unknown as Response
  await service.handler({ claims: { username: 'owner' }, body: { path: ['project'], expected: put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), ['project'])!)) } } as unknown as Request, res)
  expect(status).toBe(409)
  expect(issue).not.toHaveBeenCalled()
})
