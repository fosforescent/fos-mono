import { asAccountStore } from './deviceRoot'
import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { HOME_ID, LIBRARY_ID, MARKET_PEER, RELAY_QUEUE_ID, TEMPLATE_TYPE, accountContextAbove, addRow, isDirty, marketGrantsAt, publishTemplate, relayInbox, relayQueues, setMarketAt, addMemberAt, addRelayMessage, addTask, contextBindings, createReplica, ensureHomeContext, readNodeValue, removeMemberAt, rootTargetCid, setMemberCapabilitiesAt, shareHome, syncNodeTree, view, viewNode, writeNodeValue, type NodeRequest, type ProvidedNode, type Replica } from '@fosforescent/shared/sync/index'

jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))

import { createNodeProvider } from './provideNode'
import type { AccountStoreDeps } from './accountStore'
import { createHandlerRegistry } from './registry'
import { relayHandler } from './hostHandlers'
import { repositoryLoadHandler } from './repository'
import { bindRepository, createBranch, selectBranch, type RepositorySnapshot } from '@fosforescent/shared/sync/index'
import { collectRows } from '../search/rowIndex'

type Sent = { status: number; body: unknown }
type Claims = { username: string; kind?: string; peerId?: string; scope?: string[] }

function fakeRes(): { res: Response; sent: () => Sent } {
  const state: Sent = { status: 200, body: undefined }
  const res = {
    status(code: number) { state.status = code; return res },
    json(body: unknown) { state.body = body; return res },
    setHeader() { return res }
  } as unknown as Response
  return { res, sent: () => state }
}

function makeDeps(loadDelayMs = 0) {
  const stores = new Map<number, FosStore>()
  const notifications: Array<{ userId: number; message: Record<string, unknown> }> = []
  const deps: AccountStoreDeps = {
    async loadStore(username) {
      if (username !== 'alice') return null
      if (loadDelayMs) await new Promise((r) => setTimeout(r, loadDelayMs))
      const store = stores.get(7) ?? asAccountStore(new FosStore())
      stores.set(7, store)
      return { user: { id: 7, username }, store }
    },
    async saveStore(user, store) { stores.set(user.id, store) },
    notify(userId, message) { notifications.push({ userId, message }) },
    onlinePeers: () => ['phone'],
    now: () => 1234
  }
  return { deps, stores, notifications }
}

type Handler = ReturnType<typeof createNodeProvider>
/** Every request and response body, for checking what crossed the wire. */
const exchanged: unknown[] = []
const ask = async (handler: Handler, request: unknown, claims: Claims | null): Promise<Sent> => {
  const out = fakeRes()
  await handler({ body: request, claims: claims ?? undefined } as unknown as Request, out.res)
  exchanged.push(request, out.sent().body)
  return out.sent()
}

/** A device syncs with its account node by node, as the CLI does (`nodeTreeSync`); a user syncs its Home. */
async function sync(handler: Handler, replica: Replica, claims: Claims = { username: 'alice' }, push = true): Promise<Replica> {
  const r = claims.kind === 'peer' ? replica : shareHome(replica)
  const localRoot = r.meta.localScope ?? [], scope = claims.kind === 'peer' ? r.meta.scope : []
  const done = await syncNodeTree(r, { peer: r.meta.serverPeerId ?? (claims.kind === 'peer' ? null : `user:${claims.username}`), scope, remoteRoot: claims.kind === 'peer' ? scope : localRoot, localRoot, branches: [], push, above: claims.kind === 'peer' ? [] : accountContextAbove(r) },
    async (request: NodeRequest) => {
      const sent = await ask(handler, request, claims)
      if (sent.status !== 200) throw new Error(`${sent.status} ${JSON.stringify(sent.body)}`)
      return sent.body as ProvidedNode
    }, () => 5)
  return { ...done.replica, meta: { ...done.replica.meta, serverPeerId: done.peer } }
}

const homeTitles = (store: FosStore) => view(createReplica('server', store), [HOME_ID])?.tasks.map((t) => t.title) ?? []

describe('node provider', () => {
  it('refreshes GitHub on an authorized node load, persists the Fos merge and notifies other devices', async () => {
    const { deps, stores, notifications } = makeDeps()
    let server = bindRepository(addTask(ensureHomeContext(createReplica('user:alice', asAccountStore(new FosStore())), 0), [HOME_ID], 'Project', 1, 'project'), [HOME_ID, 'project'], 'acme/project', 2)
    server = createBranch(server, [HOME_ID, 'project'], 'feature', 3)
    server = addTask(server, [HOME_ID, 'project'], 'Phone note', 4, 'note')
    selectBranch(server.store, 'project', 'main')
    stores.set(7, server.store)
    const snapshot: RepositorySnapshot = { repo: 'acme/project', defaultBranch: 'main', canPush: true, branches: [], pulls: [{ number: 1, title: 'PR', url: 'https://github.com/acme/project/pull/1', head: 'feature', base: 'main', headRepo: 'acme/project', sha: 'a'.repeat(40), state: 'merged' }] }
    const fetch = jest.fn(async () => snapshot)
    deps.registry = createHandlerRegistry([repositoryLoadHandler({ connected: async () => true, snapshot: fetch })])
    const handler = createNodeProvider(deps), request = { peerId: 'phone', scope: [], path: [HOME_ID, 'project'], linkId: 'project-phone' }
    expect((await ask(handler, request, { username: 'alice', kind: 'peer', peerId: 'stranger', scope: [] })).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    const result = await ask(handler, request, { username: 'alice' })
    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((result.body as ProvidedNode).children.some(child => child.id === 'note')).toBe(true)
    expect(view(createReplica('user:alice', stores.get(7)!), [HOME_ID, 'project', 'note'])?.name).toBe('Phone note')
    expect(notifications.some(n => n.message.type === 'sync_changed')).toBe(true)
  })

  it('rechecks a scoped credential against current membership on every request', async () => {
    const { deps, stores } = makeDeps()
    let server = addTask(createReplica('server'), [], 'Shared', 1, 'shared')
    server = addMemberAt(server, ['shared'], 'guest', 'Guest', ['read', 'edit'], 2)
    stores.set(7, server.store)
    const claims = { username: 'alice', kind: 'peer', peerId: 'guest', scope: ['shared'] }
    const request = { peerId: 'guest', scope: ['shared'], path: [], linkId: 'guest-shared' }
    const handler = createNodeProvider(deps)
    const answer = await ask(handler, request, claims)
    expect(answer.status).toBe(200)
    expect((answer.body as ProvidedNode).presence).toEqual(['phone']) // the account's devices online now
    server = removeMemberAt(createReplica('server', stores.get(7)!), ['shared'], 'guest', 3)
    expect((await ask(handler, request, claims)).status).toBe(403)
  })

  it('rejects unauthenticated, unknown-account and malformed requests', async () => {
    const { deps } = makeDeps()
    const handler = createNodeProvider(deps)
    const request = { peerId: 'phone', scope: [], path: [HOME_ID], linkId: 'phone-home' }
    expect((await ask(handler, request, null)).status).toBe(401)
    expect((await ask(handler, request, { username: 'bob' })).status).toBe(403)
    expect((await ask(handler, { ...request, path: '..' }, { username: 'alice' })).status).toBeGreaterThanOrEqual(400)
  })

  it('stores a first push into the account, serves it to another device, and nudges devices', async () => {
    const { deps, stores, notifications } = makeDeps()
    const handler = createNodeProvider(deps)
    const phone = await sync(handler, addTask(ensureHomeContext(createReplica('phone'), 0), [HOME_ID], 'first', 1, 'first'))
    expect(phone.meta.serverPeerId).toBe('user:alice')
    expect(homeTitles(stores.get(7)!)).toEqual(['first'])
    expect(notifications.some((n) => n.message.type === 'sync_changed' && n.message.peerId === 'phone')).toBe(true)
    const laptop = await sync(handler, ensureHomeContext(createReplica('laptop'), 0), { username: 'alice' }, false)
    expect(view(laptop, [HOME_ID])!.tasks.map((t) => t.title)).toEqual(['first'])
  })

  it('serializes concurrent syncs for the same account so neither write is lost', async () => {
    const { deps, stores } = makeDeps(5)
    const handler = createNodeProvider(deps)
    const a = addTask(ensureHomeContext(createReplica('A'), 0), [HOME_ID], 'from A', 1, 'a')
    const b = addTask(ensureHomeContext(createReplica('B'), 0), [HOME_ID], 'from B', 2, 'b')
    await Promise.all([sync(handler, a), sync(handler, b)])
    expect(homeTitles(stores.get(7)!).sort()).toEqual(['from A', 'from B'])
  })

  it('keeps concurrent accounts in their own stores', async () => {
    const stores = new Map<string, FosStore>()
    const deps: AccountStoreDeps = {
      async loadStore(username) {
        const id = username === 'user2' ? 2 : username === 'user3' ? 3 : null
        if (!id) return null
        const store = stores.get(username) ?? asAccountStore(new FosStore())
        stores.set(username, store)
        return { user: { id, username }, store }
      },
      async saveStore(user, store) { stores.set(user.username, store) },
      now: () => 10
    }
    const handler = createNodeProvider(deps)
    await Promise.all(['user2', 'user3'].map((username) => sync(handler, addTask(ensureHomeContext(createReplica(username), 0), [HOME_ID], `${username} private work`, 1, 'work'), { username })))
    expect(homeTitles(stores.get('user2')!)).toEqual(['user2 private work'])
    expect(homeTitles(stores.get('user3')!)).toEqual(['user3 private work'])
  })
})

test('a device opens an existing account in Home without losing its rows', async () => {
  const { deps, stores } = makeDeps()
  stores.set(7, addTask(createReplica('old-device', asAccountStore(new FosStore())), [], 'Existing project', 1, 'project').store)
  const client = await sync(createNodeProvider(deps), ensureHomeContext(createReplica('new-device'), 0), { username: 'alice' }, false)
  // the device's root ships its own library; the account's rows are under Home
  expect(view(client, [])!.tasks.map((row) => row.id)).toEqual([LIBRARY_ID, HOME_ID])
  expect(view(client, [HOME_ID])!.tasks.map((row) => row.id)).toEqual(['project'])
})

test('the server keeps its own root and shares only Home', async () => {
  const { deps, stores } = makeDeps()
  let server = ensureHomeContext(createReplica('fos', asAccountStore(new FosStore())), 1)
  server = addTask(server, [], 'server-only settings', 2, 'server-settings')
  server = writeNodeValue(server, [], 'server-input', 'server value', 3)
  stores.set(7, server.store)
  let client = ensureHomeContext(createReplica('phone'), 1)
  client = addTask(client, [], 'device-only settings', 2, 'device-settings')
  client = addTask(client, [HOME_ID], 'Shared task', 3, 'shared')
  exchanged.length = 0
  client = await sync(createNodeProvider(deps), client)
  expect(JSON.stringify(exchanged)).not.toContain('device-only settings')
  expect(JSON.stringify(exchanged)).not.toContain('server-only settings')
  expect(JSON.stringify(exchanged)).not.toContain('server value')
  expect(view(client, [])!.tasks.some((t) => t.id === 'device-settings')).toBe(true)
  expect(view(client, [HOME_ID])!.tasks.some((t) => t.id === 'shared')).toBe(true)
  expect(view(client, [HOME_ID])!.tasks.some((t) => t.id === 'server-settings')).toBe(false)
  const stored = createReplica('fos', stores.get(7)!)
  expect(view(stored, [])!.tasks.some((t) => t.id === 'device-settings')).toBe(false)
  expect(view(stored, [HOME_ID])!.tasks.some((t) => t.id === 'shared')).toBe(true)
  expect(readNodeValue(stored, [], 'server-input')).toBe('server value')
  expect(contextBindings(client, [HOME_ID]).some((binding) => binding.name === 'server-input')).toBe(false)
  expect(viewNode(stores.get(7)!, rootTargetCid(stores.get(7)!)).tasks.some((t) => t.id === 'server-settings')).toBe(true)
})

test('Home sync persists public siblings, never content excluded from Fos', async () => {
  const { deps, stores } = makeDeps()
  let client = ensureHomeContext(createReplica('desktop'), 0)
  client = addTask(client, [HOME_ID], 'Private project', 1, 'private')
  client = addMemberAt(client, [HOME_ID, 'private'], 'fos', 'fos', ['persist'], 2)
  client = setMemberCapabilitiesAt(client, [HOME_ID, 'private'], 'fos', ['persist'], ['persist'], 3)
  client = addTask(client, [HOME_ID, 'private'], 'Never upload this', 4, 'secret')
  client = addTask(client, [HOME_ID], 'Shared sibling', 5, 'public')
  client = await sync(createNodeProvider(deps), client)
  expect(JSON.stringify([...stores.get(7)!.table.values()])).not.toContain('Never upload this')
  expect(homeTitles(stores.get(7)!)).toContain('Shared sibling')
  expect(view(client, [HOME_ID, 'private'])!.tasks[0]!.id).toBe('secret')
})

test('a message one device leaves for another waits in that peer\'s queue on the account', async () => {
  const { deps, stores } = makeDeps()
  deps.registry = createHandlerRegistry([relayHandler()])
  // the account knows the desktop's agent peer on the hub
  let account = ensureHomeContext(createReplica('user:alice', asAccountStore(new FosStore())), 0, deps.registry.hostOffers())
  account = addTask(account, [HOME_ID], 'Hub', 1, 'hub')
  account = addMemberAt(account, [HOME_ID, 'hub'], 'desktop-agent', 'Desktop agent', ['read', 'edit'], 2)
  stores.set(7, account.store)
  const handler = createNodeProvider(deps)
  let phone = await sync(handler, ensureHomeContext(createReplica('phone'), 0))
  phone = addRelayMessage(phone, [HOME_ID, 'hub'], 'desktop-agent', 3, 'job')
  phone = addTask(phone, [HOME_ID, 'hub', 'job'], 'Review the pull request', 4, 'job:task')
  phone = await sync(handler, phone)
  const stored = createReplica('user:alice', stores.get(7)!)
  expect(view(stored, [HOME_ID, 'hub', 'fos:peer:desktop-agent', RELAY_QUEUE_ID, 'job'])!.tasks.map(t => t.title)).toEqual(['Review the pull request'])
  expect(view(stored, [HOME_ID, 'hub'])!.tasks.some(t => t.id === 'job')).toBe(false)
  phone = await sync(handler, phone)
  expect(view(phone, [HOME_ID, 'hub'])!.tasks.some(t => t.id === 'job')).toBe(false)
  // the queue is ordinary rows of the hub's member entry: another device of the account receives them by syncing
  const desktop = await sync(handler, ensureHomeContext(createReplica('desktop'), 0), { username: 'alice' }, false)
  expect(relayQueues(desktop, 'desktop-agent')).toEqual([[HOME_ID, 'hub', 'fos:peer:desktop-agent', RELAY_QUEUE_ID]])
  expect(relayInbox(desktop, [HOME_ID, 'hub', 'fos:peer:desktop-agent', RELAY_QUEUE_ID]).map(m => [m.id, m.rows.map(r => r.title)])).toEqual([['job', ['Review the pull request']]])
})

test('member entries travel through provide-node: listings and offers made on a device reach the account and its market index', async () => {
  const { deps, stores } = makeDeps()
  const handler = createNodeProvider(deps)
  let phone = addTask(ensureHomeContext(createReplica('phone'), 0), [HOME_ID], 'Shop', 1, 'shop')
  phone = addRow(phone, [HOME_ID, 'shop'], TEMPLATE_TYPE, 'Design a logo', 2, { id: 'design' })
  phone = setMarketAt(phone, [HOME_ID, 'shop'], true, 3)
  phone = publishTemplate(phone, [HOME_ID, 'shop'], [HOME_ID, 'shop', 'design'], 'Logo design', 4, true)
  phone = await sync(handler, phone)
  const stored = createReplica('user:alice', stores.get(7)!)
  expect(marketGrantsAt(stored.store, rootTargetCid(stored.store), [HOME_ID, 'shop'])).toEqual(expect.arrayContaining(['read', 'edit']))
  // the index the server keeps after a save sees the listing and the offer
  const rows = collectRows(stores.get(7)!)
  expect(rows.find(r => r.aliasId === 'shop')).toMatchObject({ market: true })
  expect(rows.find(r => r.aliasId === 'fos:published:design')).toMatchObject({ type: 'capability', title: 'Logo design', market: true, path: [HOME_ID, 'shop'] })
  expect(isDirty(phone)).toBe(false)
})

test('a listing the server makes reaches the device; another device then sees the member it pushed', async () => {
  const { deps, stores } = makeDeps()
  const handler = createNodeProvider(deps)
  let phone = await sync(handler, addTask(ensureHomeContext(createReplica('phone'), 0), [HOME_ID], 'Logo job', 1, 'job'))
  // the server's market effect lists the job (the market peer becomes a member there)
  stores.set(7, setMarketAt(createReplica('user:alice', stores.get(7)!), [HOME_ID, 'job'], true, 2).store)
  phone = await sync(handler, phone)
  expect(view(phone, [HOME_ID])!.tasks.find(t => t.id === 'job')!.market).toBe(true)
  // a grant made on the phone reaches the laptop through the account
  phone = await sync(handler, addMemberAt(phone, [HOME_ID, 'job'], 'user:bob', 'Bob', ['read'], 3))
  const laptop = await sync(handler, ensureHomeContext(createReplica('laptop'), 0), { username: 'alice' }, false)
  expect(view(laptop, [HOME_ID, 'job'])!.members.map(m => m.peerId).sort()).toEqual([MARKET_PEER, 'user:bob'])
})
