import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { HOME_ID, ensureHomeContext, completeSync, view, type SyncResponse, addTask, buildSyncRequest, createReplica, rootTargetCid, viewNode } from '@fosforescent/shared/sync/index'

jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))

import { createPeerSyncHandler, type PeerSyncDeps } from './peerSync'
import { addMemberAt, removeMemberAt } from '@fosforescent/shared/sync/index'

type Sent = { status: number; body: unknown }

function fakeRes(): { res: Response; sent: () => Sent } {
  const state: Sent = { status: 200, body: undefined }
  const res = {
    status(code: number) { state.status = code; return res },
    json(body: unknown) { state.body = body; return res }
  } as unknown as Response
  return { res, sent: () => state }
}

function fakeReq(body: unknown, username: string | null = 'alice'): Request {
  return { body, claims: username ? { username } : undefined } as unknown as Request
}

function makeDeps(loadDelayMs = 0) {
  const stores = new Map<number, FosStore>()
  const notifications: Array<{ userId: number; message: Record<string, unknown> }> = []
  let saves = 0
  const deps: PeerSyncDeps = {
    async loadStore(username) {
      if (username !== 'alice') return null
      if (loadDelayMs) await new Promise((r) => setTimeout(r, loadDelayMs))
      const store = stores.get(7) ?? new FosStore()
      stores.set(7, store)
      return { user: { id: 7, username }, store }
    },
    async saveStore(user, store) { saves++; stores.set(user.id, store) },
    notify(userId, message) { notifications.push({ userId, message }) },
    now: () => 1234
  }
  return { deps, stores, notifications, saves: () => saves }
}

const serverTitles = (store: FosStore) => viewNode(store, rootTargetCid(store)).tasks.map((t) => t.title)

describe('peer-sync handler', () => {
  it('rechecks a scoped credential against current membership before importing or returning nodes', async () => {
    const { deps, stores } = makeDeps()
    let server = addTask(createReplica('server'), [], 'Shared', 1, 'shared')
    server = addMemberAt(server, ['shared'], 'guest', 'Guest', ['read', 'edit'], 2)
    stores.set(7, server.store)
    const guest = createReplica('guest')
    guest.meta.scope = ['shared']
    const body = buildSyncRequest(guest, undefined, { recipient: 'device' })
    const request = { body, claims: { username: 'alice', kind: 'peer', peerId: 'guest', scope: ['shared'] } } as unknown as Request
    const handler = createPeerSyncHandler(deps), first = fakeRes()
    await handler(request, first.res)
    expect(first.sent().status).toBe(200)
    server = removeMemberAt(server, ['shared'], 'guest', 3)
    const revoked = fakeRes()
    await handler(request, revoked.res)
    expect(revoked.sent()).toEqual({ status: 403, body: { error: 'Peer no longer has access to this attachment.' } })
  })
  it('rejects unauthenticated, unknown-user and malformed requests', async () => {
    const { deps } = makeDeps()
    const handler = createPeerSyncHandler(deps)
    const device = addTask(createReplica('phone'), [], 'x', 1)
    const request = buildSyncRequest(device)

    const a = fakeRes()
    await handler(fakeReq(request, null), a.res)
    expect(a.sent().status).toBe(401)

    const b = fakeRes()
    await handler(fakeReq({ ...request, peerId: '' }), b.res)
    expect(b.sent().status).toBe(400)

    const c = fakeRes()
    await handler(fakeReq(request, 'bob'), c.res)
    expect(c.sent().status).toBe(401)

    const d = fakeRes()
    await handler(fakeReq({ ...request, scope: ['nope'] }), d.res)
    expect(d.sent().status).toBe(404)
  })

  it('stores a first push into the user store, serves it back, and nudges other devices', async () => {
    const { deps, stores, notifications, saves } = makeDeps()
    const handler = createPeerSyncHandler(deps)

    const phone = addTask(createReplica('phone'), [], 'first', 1)
    const r1 = fakeRes()
    await handler(fakeReq(buildSyncRequest(phone)), r1.res)
    expect(r1.sent().status).toBe(200)
    const body1 = r1.sent().body as { action: string; peerId: string; serverTime: number }
    expect(body1.action).toBe('fast-forward')
    expect(body1.peerId).toBe('user:alice')
    expect(body1.serverTime).toBe(1234)
    expect(serverTitles(stores.get(7)!)).toEqual(['first'])
    expect(notifications).toEqual([
      { userId: 7, message: expect.objectContaining({ type: 'sync_changed', byPeerId: 'phone', scope: [] }) }
    ])

    const laptop = createReplica('laptop')
    const r2 = fakeRes()
    await handler(fakeReq(buildSyncRequest(laptop)), r2.res)
    const body2 = r2.sent().body as { action: string; nodes: Record<string, unknown> }
    expect(body2.action).toBe('pull')
    expect(Object.keys(body2.nodes).length).toBeGreaterThan(0)
    // the pull registered the laptop as a peer of the root node, which is a change worth saving and announcing
    expect(saves()).toBe(2)
    expect(notifications).toHaveLength(2)
    expect(notifications[1]?.message).toMatchObject({ byPeerId: 'laptop' })
    expect(viewNode(stores.get(7)!, rootTargetCid(stores.get(7)!)).peers.sort()).toEqual(['laptop', 'phone'])
  })

  it('serializes concurrent syncs for the same user so neither write is lost', async () => {
    const { deps, stores } = makeDeps(5)
    const handler = createPeerSyncHandler(deps)
    const a = addTask(createReplica('A'), [], 'from A', 1)
    const b = addTask(createReplica('B'), [], 'from B', 2)
    const ra = fakeRes(); const rb = fakeRes()
    await Promise.all([
      handler(fakeReq(buildSyncRequest(a)), ra.res),
      handler(fakeReq(buildSyncRequest(b)), rb.res)
    ])
    expect(serverTitles(stores.get(7)!).sort()).toEqual(['from A', 'from B'])
    expect((rb.sent().body as { action: string }).action).toBe('merge')
  })
})

it('returns a machine-readable missing-node response with complete IDs', async () => {
  const { deps } = makeDeps()
  const device = addTask(createReplica('phone'), [], 'unsent child', 1, 'child')
  const request = buildSyncRequest(device)
  const response = fakeRes()
  await createPeerSyncHandler(deps)(fakeReq({ ...request, nodes: {} }), response.res)
  expect(response.sent().status).toBe(400)
  expect(response.sent().body).toMatchObject({ code: 'missing-nodes', missingNodeIds: [request.headCid] })
})

it('concurrent user2 and user3 requests remain in their own account stores', async () => {
  const stores = new Map<string, FosStore>()
  const deps: PeerSyncDeps = {
    async loadStore(username) {
      const id = username === 'user2' ? 2 : username === 'user3' ? 3 : null
      if (!id) return null
      const store = stores.get(username) ?? new FosStore()
      stores.set(username, store)
      return { user: { id, username }, store }
    },
    async saveStore(user, store) { stores.set(user.username, store) },
    now: () => 10
  }
  const handler = createPeerSyncHandler(deps)
  const responses = [fakeRes(), fakeRes()]
  await Promise.all(['user2', 'user3'].map((username, i) => handler(
    fakeReq(buildSyncRequest(addTask(createReplica(username), [], `${username} private work`, 1)), username), responses[i]!.res
  )))
  expect(responses.map((r) => r.sent().status)).toEqual([200, 200])
  expect(serverTitles(stores.get('user2')!)).toEqual(['user2 private work'])
  expect(serverTitles(stores.get('user3')!)).toEqual(['user3 private work'])
})


test('a constructor-aware device opens an existing account in Home without losing legacy rows', async () => {
  const { deps, stores } = makeDeps()
  const legacy = addTask(createReplica('old-device'), [], 'Existing project', 1, 'project')
  stores.set(7, legacy.store)
  let client = ensureHomeContext(createReplica('new-device'), 0)
  const packet = buildSyncRequest(client)
  const response = fakeRes()
  await createPeerSyncHandler(deps)(fakeReq(packet), response.res)
  expect(response.sent().status).toBe(200)
  client = completeSync(client, packet, response.sent().body as SyncResponse, 2).replica
  expect(view(client, [])!.tasks.map(row => row.id)).toEqual([HOME_ID])
  expect(view(client, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['project'])
})

test('raw inspector cannot expose an account root using a scoped peer credential', async () => {
  const { createPeerSyncInspector } = await import('./peerSync')
  const { deps } = makeDeps()
  const response = fakeRes()
  await createPeerSyncInspector(deps)({ claims: { username: 'alice', kind: 'peer', peerId: 'agent', scope: ['project'] }, query: {} } as unknown as Request, response.res)
  expect(response.sent().status).toBe(403)
})

test('the server keeps its own root and shares only Home with constructor-aware devices', async () => {
  const { shareHome, writeNodeValue, readNodeValue, contextBindings } = await import('@fosforescent/shared/sync/index')
  const { deps, stores } = makeDeps()
  let server = ensureHomeContext(createReplica('fos'), 1)
  server = addTask(server, [], 'server-only settings', 2, 'server-settings')
  server = writeNodeValue(server, [], 'server-input', 'server value', 3)
  stores.set(7, server.store)
  let client = ensureHomeContext(createReplica('phone'), 1)
  client = addTask(client, [], 'device-only settings', 2, 'device-settings')
  client = addTask(client, [HOME_ID], 'Shared task', 3, 'shared')
  client = shareHome(client)
  const handler = createPeerSyncHandler(deps), request = buildSyncRequest(client), response = fakeRes()
  await handler(fakeReq(request), response.res)
  expect(response.sent().status).toBe(200)
  expect(JSON.stringify(request.nodes)).not.toContain('device-only settings')
  expect(JSON.stringify(response.sent().body)).not.toContain('server-only settings')
  expect(JSON.stringify(response.sent().body)).not.toContain('server value')
  client = completeSync(client, request, response.sent().body as SyncResponse).replica
  expect(view(client, [])!.tasks.some(t => t.id === 'device-settings')).toBe(true)
  expect(view(client, [HOME_ID])!.tasks.some(t => t.id === 'shared')).toBe(true)
  expect(view(server, [])!.tasks.some(t => t.id === 'device-settings')).toBe(false)
  expect(readNodeValue(server, [], 'fos:peer-root')).toBe('fos')
  expect(contextBindings(server, [HOME_ID]).some(binding => binding.name === 'server-input')).toBe(true)
  expect(contextBindings(client, [HOME_ID]).some(binding => binding.name === 'server-input')).toBe(false)
  const legacy = fakeRes()
  await handler(fakeReq(buildSyncRequest(createReplica('old-device'))), legacy.res)
  expect(legacy.sent().status).toBe(409)
})

test('Home sync persists public siblings and peer references, never excluded nested content', async () => {
  const { shareHome, addMemberAt, setMemberCapabilitiesAt } = await import('@fosforescent/shared/sync/index')
  const { deps, stores } = makeDeps()
  let client = shareHome(ensureHomeContext(createReplica('desktop'), 0))
  client = addTask(client, [HOME_ID], 'Private project', 1, 'private')
  client = addMemberAt(client, [HOME_ID, 'private'], 'fos', 'fos', ['persist'], 2)
  client = setMemberCapabilitiesAt(client, [HOME_ID, 'private'], 'fos', ['persist'], ['persist'], 3)
  client = addTask(client, [HOME_ID, 'private'], 'Never upload this', 4, 'secret')
  client = addTask(client, [HOME_ID], 'Shared sibling', 5, 'public')
  const packet = buildSyncRequest(client), response = fakeRes()
  await createPeerSyncHandler(deps)(fakeReq(packet), response.res)
  expect(response.sent().status).toBe(200)
  expect(JSON.stringify([...stores.get(7)!.table.values()])).not.toContain('Never upload this')
  expect(JSON.stringify(response.sent().body)).not.toContain('Private project')
  expect(view(createReplica('server', stores.get(7)!), [HOME_ID])!.tasks.find(t => t.id === 'private')!.refPeer).toBe('desktop')
  client = completeSync(client, packet, response.sent().body as SyncResponse).replica
  expect(view(client, [HOME_ID, 'private'])!.tasks[0]!.id).toBe('secret')
})
