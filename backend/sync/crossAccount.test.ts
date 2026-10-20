import type { Request, Response } from 'express'
import { addMemberAt, addTask, createReplica, ensureHomeContext, HOME_ID, headCid, put, resolveScope, valueContent, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createNodeLocator, createNodeProvider } from './provideNode'

/** alice shares a node with bob (read + edit, and execute when asked); carol has nothing. */
function setup(grants: Array<'read' | 'edit' | 'execute'> = ['read', 'edit']) {
  let alice = addTask(ensureHomeContext(createReplica('user:alice'), 1), [HOME_ID], 'Plan the group trip', 2, 'trip')
  alice = addTask(alice, [HOME_ID, 'trip'], 'Book flights', 3, 'flights')
  alice = addMemberAt(alice, [HOME_ID, 'trip'], 'user:bob', 'bob', grants, 4)
  const replicas: Record<string, Replica> = { alice, bob: ensureHomeContext(createReplica('user:bob'), 1), carol: ensureHomeContext(createReplica('user:carol'), 1) }
  const evaluate = jest.fn(async () => ({ status: 'committed' }))
  const deps = {
    loadStore: async (username: string) => replicas[username] ? { user: { id: username === 'alice' ? 1 : username === 'bob' ? 2 : 3, username }, store: replicas[username]!.store } : null,
    saveStore: async (user: { username: string }, store: any) => { replicas[user.username] = createReplica(`user:${user.username}`, store) },
    now: () => 100,
  }
  const events = createEventService(deps, evaluate as any)
  const provide = createNodeProvider(deps, { request: async () => { throw new Error('no relay') } })
  const locate = createNodeLocator(deps)
  const call = async (handler: (req: Request, res: Response) => Promise<unknown>, username: string, body: unknown, query: Record<string, string> = {}) => {
    let status = 200, result: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { result = b; return res }, end() { return res } } as unknown as Response
    await handler({ claims: { username }, body, query, method: 'POST', headers: {} } as unknown as Request, res)
    return { status, body: result }
  }
  return { replicas, evaluate, events, provide, locate, call }
}

test('a user locates and pulls a node another account shared with them, inside the grants given there', async () => {
  const s = setup()
  const where = await s.call(s.locate, 'bob', {}, { owner: 'alice', id: 'trip' })
  expect(where.status).toBe(200)
  expect(where.body).toMatchObject({ owner: 'alice', aliasId: 'trip', path: [HOME_ID, 'trip'], title: 'Plan the group trip', grants: ['read', 'edit'] })
  expect((await s.call(s.locate, 'carol', {}, { owner: 'alice', id: 'trip' })).status).toBe(403)
  expect((await s.call(s.locate, 'bob', {}, { owner: 'alice', id: 'nope' })).status).toBe(404)
  // provide-node as user:bob on alice's store: the node and its children, with bob's grants; carol is refused
  const request = { peerId: 'user:bob', scope: [HOME_ID, 'trip'], path: [], linkId: 'bob-link', owner: 'alice' }
  const pulled = await s.call(s.provide, 'bob', request)
  expect(pulled.status).toBe(200)
  // bob's own member entry comes with the node (his masked view of its members); no one else's
  expect(pulled.body.children.map((c: any) => c.id)).toEqual(['flights', 'fos:peer:user:bob'])
  expect(pulled.body.grants).toEqual(['read', 'edit'])
  expect(pulled.body.address).toEqual({ peerId: 'user:alice', scope: [HOME_ID, 'trip'] })
  expect((await s.call(s.provide, 'carol', { ...request, peerId: 'user:carol' })).status).toBe(403)
  expect((await s.call(s.provide, 'bob', { ...request, peerId: 'bob-device' })).status).toBe(403)
  // bob's edits arrive as his `node-sync` proposal on alice's node, never as direct writes
  const update = { base: { data: pulled.body.data, children: pulled.body.children }, value: { data: { ...pulled.body.data, description: { content: 'Plan the group trip (bob)' } }, children: pulled.body.children } }
  const pushed = await s.call(s.provide, 'bob', { ...request, update })
  expect(pushed.status).toBe(200)
  const trip = view(s.replicas.alice!, [HOME_ID, 'trip'])!
  expect(view(s.replicas.alice!, [HOME_ID])!.tasks.find(t => t.id === 'trip')!.title).toBe('Plan the group trip')
  expect(trip.proposals.map(p => [p.peerId, p.name, p.status])).toEqual([['user:bob', 'node-sync', 'open']])
})

test('events on another account\'s node run as user:<me>: read and submit with edit, complete only with execute', async () => {
  const s = setup()
  const expected = () => put(s.replicas.alice!.store, valueContent(s.replicas.alice!.store, resolveScope(s.replicas.alice!.store, headCid(s.replicas.alice!), [HOME_ID, 'trip'])!))
  const read = await s.call(s.events.http, 'bob', { owner: 'alice', scope: [HOME_ID, 'trip'], event: { kind: 'read', path: [] } })
  expect(read.status).toBe(200)
  expect(read.body.title).toBe('Plan the group trip')
  expect(read.body.actions).toEqual(expect.arrayContaining(['submit', 'input']))
  expect((await s.call(s.events.http, 'carol', { owner: 'alice', scope: [HOME_ID, 'trip'], event: { kind: 'read', path: [] } })).status).toBe(400)
  // a submission by bob is a proposal alice decides on
  const submitted = await s.call(s.events.http, 'bob', { owner: 'alice', scope: [HOME_ID, 'trip'], event: { kind: 'submit', path: [], expected: read.body.revision, name: 'hotel', changes: [{ path: [], operation: 'add_task', text: 'Reserve lodging' }] } })
  expect(submitted.status).toBe(200)
  expect(view(s.replicas.alice!, [HOME_ID, 'trip'])!.proposals.map(p => [p.peerId, p.name])).toEqual([['user:bob', 'hotel']])
  // without execute, completing leaves a request only where a peer accepts requests (none here)
  const refused = await s.call(s.events.http, 'bob', { owner: 'alice', scope: [HOME_ID, 'trip'], event: { kind: 'complete', path: [], expected: expected() } })
  expect(refused.status).toBe(400)
  expect(refused.body.error).toMatch(/No peer accepts evaluation requests/)
  expect(s.evaluate).not.toHaveBeenCalled()
  // with execute, alice's host runs its registry for bob
  const granted = setup(['read', 'edit', 'execute'])
  const expected2 = put(granted.replicas.alice!.store, valueContent(granted.replicas.alice!.store, resolveScope(granted.replicas.alice!.store, headCid(granted.replicas.alice!), [HOME_ID, 'trip'])!))
  const ran = await granted.call(granted.events.http, 'bob', { owner: 'alice', scope: [HOME_ID, 'trip'], event: { kind: 'complete', path: [], expected: expected2 } })
  expect(ran.status).toBe(200)
  expect(granted.evaluate).toHaveBeenCalledWith('alice', expect.objectContaining({ path: [HOME_ID, 'trip'] }))
  // the owner's own scope parameter still means their own account
  const own = await granted.call(granted.events.http, 'alice', { scope: [HOME_ID, 'trip'], event: { kind: 'read', path: [] } })
  expect(own.body.actions).toEqual(expect.arrayContaining(['branch', 'decide']))
  // acting on another account needs the shared node's scope
  expect((await s.call(s.events.http, 'bob', { owner: 'alice', scope: [], event: { kind: 'read', path: [] } })).status).toBe(400)
})
