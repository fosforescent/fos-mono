import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { HOME_ID, LIBRARY_ID, addRow, commitRoot, createReplica, ensureHomeContext, headCid, importNodes, libraryLink, makeLink, mergePolicy, proposalContent, put, reachableNodes, resolveScope, sharing, updateAtScope, valueContent, view, withProposal, type Replica, type Scope } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createHandlerRegistry } from './registry'
import { createSharingHandlers } from './sharing'
import { ensureAccountContext, ensureStandardLibrary, LIBRARY_GRANTS } from './library'

/** A host with any number of accounts; `createAccount` makes a fresh one like registration does. */
function host() {
  const stores = new Map<string, Replica>(), saves: string[] = []
  let id = 0
  const deps = {
    loadStore: async (username: string) => { const r = stores.get(username); return r ? { user: { id: [...stores.keys()].indexOf(username) + 1, username }, store: r.store } : null },
    saveStore: async (user: { username: string }, store: any) => { saves.push(user.username); stores.set(user.username, { ...stores.get(user.username)!, store }) },
    now: () => 1_000 + ++id,
    createAccount: async (username: string) => { stores.set(username, createReplica(`user:${username}`)) }
  }
  const add = (username: string) => { stores.set(username, ensureHomeContext(createReplica(`user:${username}`), 1)) }
  return { deps, stores, saves, add, get: (username: string) => stores.get(username)! }
}

function proposeRow(r: Replica, path: Scope, peer: string, title: string, id: string, now: number): string {
  const store = r.store, root = headCid(r), hostCid = resolveScope(store, root, path)!
  const base = put(store, valueContent(store, hostCid)), draftStore = new FosStore()
  importNodes(draftStore, reachableNodes(store, [base]))
  commitRoot(draftStore, base, now)
  const draft = addRow(createReplica(peer, draftStore), [], 'template', title, now, { id })
  importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
  const cid = put(store, proposalContent(store, peer, 'node-sync', headCid(draft), base, now))
  commitRoot(store, updateAtScope(store, root, path, current => withProposal(store, makeLink(store, current, now), peer, cid, 'node-sync'), 'node'), now)
  return cid
}

test('the library account, node, sharing, policy and templates come to exist once; every other account references it', async () => {
  const h = host(), registry = createHandlerRegistry([{ peerId: 'fos', capability: 'search' }])
  const address = await ensureStandardLibrary(h.deps, 'fos-library', registry)
  expect(address).toMatchObject({ owner: 'fos-library', path: [HOME_ID, LIBRARY_ID], title: 'Standard library' })
  expect(address.share).toMatch(/^[\w-]{16,128}$/)
  const lib = h.get('fos-library')
  const node = view(lib, address.path)!
  expect(node.tasks.filter(t => t.kind === 'template').length).toBeGreaterThanOrEqual(6)
  expect(sharing(lib, address.path)).toMatchObject({ audience: 'users', enabled: true, id: address.share })
  expect(node.members.find(m => m.peerId === 'audience:users')!.capabilities).toEqual(expect.arrayContaining([...LIBRARY_GRANTS]))
  expect(mergePolicy(lib, address.path)).toEqual({ approvals: 2 })
  const saved = h.saves.length
  expect(await ensureStandardLibrary(h.deps, 'fos-library', registry)).toEqual(address)
  expect(h.saves.length).toBe(saved)
  // the registry carries the address; owners' syncs put the reference into their Home, the library's own Home excluded
  registry.library = address
  h.add('alice')
  const alice = ensureAccountContext(h.get('alice'), 5, registry)
  expect(libraryLink(alice)).toEqual([HOME_ID, LIBRARY_ID])
  expect(view(alice, [HOME_ID])!.tasks.find(t => t.id === LIBRARY_ID)).toMatchObject({ kind: 'ref', refOwner: 'fos-library', refId: LIBRARY_ID })
  expect(headCid(ensureAccountContext(alice, 6, registry))).toBe(headCid(alice))
  expect(libraryLink(ensureAccountContext(h.get('fos-library'), 7, registry))).toBeNull()
  expect(libraryLink(ensureAccountContext(ensureHomeContext(createReplica('user:bob'), 1), 8, createHandlerRegistry([])))).toBeNull()
})

test('members vote on a proposed change through the shared view and the library merges it at the policy threshold', async () => {
  const h = host(), registry = createHandlerRegistry([])
  const address = await ensureStandardLibrary(h.deps, 'fos-library', registry)
  h.add('bob'); h.add('carol')
  const cid = proposeRow(h.get('fos-library'), address.path, 'user:bob', 'Weekly review', 'lib:weekly', 50)
  const handlers = createSharingHandlers(h.deps, 'test-only-secret')
  const call = async (action: 'visit' | 'submit', body: object, account: string) => {
    let status = 200, result: any
    const res = { status(n: number) { status = n; return res }, json(b: unknown) { result = b; return res }, setHeader() {} } as unknown as Response
    await handlers[action]({ body, claims: { username: account, kind: 'user' } } as unknown as Request, res)
    return { status, body: result }
  }
  const at = { owner: address.owner, path: address.path, share: address.share }
  const bob = await call('visit', at, 'bob')
  expect(bob.status).toBe(200)
  expect(bob.body.node.proposals.map((p: { id: string }) => p.id)).toEqual([`proposal:${cid}`])
  expect(bob.body.node.capabilities).toEqual(expect.arrayContaining(['read', 'approve', 'rank']))
  const bobVote = await call('submit', { ...at, revision: bob.body.node.revision, approvals: [`proposal:${cid}`], ranking: [], fields: {} }, 'bob')
  expect(bobVote.status).toBe(200)
  expect(bobVote.body.node.counts[`proposal:${cid}`]).toBe(1)
  expect(view(h.get('fos-library'), address.path)!.tasks.some(t => t.id === 'lib:weekly')).toBe(false)
  const carol = await call('visit', at, 'carol')
  const carolVote = await call('submit', { ...at, revision: carol.body.node.revision, approvals: [`proposal:${cid}`], ranking: [], fields: {} }, 'carol')
  expect(carolVote.status).toBe(200)
  const lib = h.get('fos-library')
  expect(view(lib, address.path)!.tasks.some(t => t.id === 'lib:weekly' && t.kind === 'template')).toBe(true)
  expect(view(lib, address.path)!.proposals.filter(p => p.status === 'open')).toHaveLength(0)
  expect(carolVote.body.node.proposals).toEqual([])
})
