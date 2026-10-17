import type { Request, Response } from 'express'
import { addTask, createReplica, ensureHomeContext, HOME_ID, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { createHandlerRegistry } from './registry'

function setup(relay = true) {
  const replicas: Record<string, Replica> = {
    alice: addTask(ensureHomeContext(createReplica('user:alice'), 1), [HOME_ID], 'Plan the group trip', 2, 'trip'),
    bob: ensureHomeContext(createReplica('user:bob'), 1),
  }
  const notified: number[] = []
  const registry = createHandlerRegistry(relay ? [] : [])
  // the fos server relays between the accounts it hosts; without `relay` the grant is recorded but cannot be delivered
  if (!relay) registry.serverCapabilities = () => ['http', 'ws']
  const events = createEventService({
    loadStore: async username => replicas[username] ? { user: { id: username === 'alice' ? 1 : 2, username }, store: replicas[username]!.store } : null,
    saveStore: async (user, store) => { replicas[user.username] = createReplica(`user:${user.username}`, store) },
    notify: id => { notified.push(id) }, now: () => 100, registry,
  })
  const send = async (scope: string[], event: unknown, claims: Record<string, unknown> = { username: 'alice' }) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await events.http({ claims, body: { scope, event } } as unknown as Request, res)
    return { status, body }
  }
  return { replicas, notified, send }
}

test('inviting a Fos user records the member grant and delivers the node into their Home', async () => {
  const s = setup()
  const first = await s.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: '@bob' })
  expect(first.status).toBe(200)
  expect(first.body).toMatchObject({ status: 'invited', peer: 'user:bob', user: 'bob', title: 'Plan the group trip' })
  expect(view(s.replicas.alice!, [HOME_ID, 'trip'])!.members.map(m => [m.peerId, m.capabilities])).toEqual([['user:bob', ['edit']]])
  // Bob's Home: alice is a sub-peer of his fos server with nothing granted, and the node is a pending request on her row
  const bobHome = view(s.replicas.bob!, [HOME_ID])!
  expect(bobHome.members.find(m => m.peerId === 'user:alice')!.capabilities).toEqual([])
  const host = bobHome.tasks.find(t => t.id === 'shared-host:alice')!
  expect(host.title).toBe('alice')
  const hostView = view(s.replicas.bob!, [HOME_ID, host.id])!
  expect(hostView.members.map(m => [m.peerId, m.capabilities])).toEqual([['user:alice', []]])
  expect(hostView.tasks).toHaveLength(0)
  expect(hostView.proposals.map(p => [p.peerId, p.name, p.status])).toEqual([['user:alice', 'invite: Plan the group trip', 'open']])
  expect(s.notified).toEqual([1, 2])
  // inviting again is idempotent on both sides
  const again = await s.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: 'bob' })
  expect(again.body.status).toBe('member')
  expect(view(s.replicas.bob!, [HOME_ID, host.id])!.proposals).toHaveLength(1)
  // Bob accepts: the foreign ref appears under alice's sub-peer row, which he opens and proposes through
  const decided = await s.send([HOME_ID, host.id], { kind: 'decide', path: [], proposalId: hostView.proposals[0]!.id, decision: 'approve' }, { username: 'bob' })
  expect(decided.status).toBe(200)
  const link = view(s.replicas.bob!, [HOME_ID, host.id])!.tasks[0]!
  expect([link.kind, link.title, link.refOwner, link.refId]).toEqual(['ref', 'Plan the group trip', 'alice', first.body.id])
  expect(view(s.replicas.bob!, [HOME_ID, host.id])!.proposals).toHaveLength(0)
})

test('invites need an existing user, an owner, and a host that relays', async () => {
  const s = setup()
  expect((await s.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: 'carol' })).body.error).toMatch(/No Fos user is named @carol/)
  expect((await s.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: '' })).body.error).toMatch(/user name is required/)
  // bob, once a member, cannot invite others from his attachment
  await s.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: 'bob' })
  const peer = await s.send([], { kind: 'invite', path: [], user: 'alice' }, { username: 'alice', kind: 'peer', peerId: 'user:bob', scope: [HOME_ID, 'trip'] })
  expect(peer.body.error).toMatch(/Only the account owner/)
  const offline = setup(false)
  expect((await offline.send([HOME_ID, 'trip'], { kind: 'invite', path: [], user: 'bob' })).body.error).toMatch(/does not relay/)
  expect(view(offline.replicas.bob!, [HOME_ID])!.tasks.some(t => t.id === 'shared-host:alice')).toBe(false)
})
