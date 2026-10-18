/** The standard library: seeding, the reference in every Home, audience membership as a group, and voted merges. */
import { FosStore } from '../dag-implementation/store'
import { HOME_ID, SERVER_TRANSPORT_CAPABILITIES, commitRoot, content, hasCapability, importNodes, makeLink, memberFor, proposalContent, put, reachableNodes, resolveScope, updateAtScope, valueContent, withProposal, type Scope } from './graph'
import { exchangeNode } from './node-sync'
import { addMemberAt, addRow, createReplica, ensureHomeContext, headCid, setMemberCapabilitiesAt, view, type Replica } from './replica'
import { nodeAuthorityAt } from './node-context'
import { setSharing, sharedProjection, writeParticipation } from './sharing'
import { DEFAULT_MERGE_POLICY, LIBRARY_BUNDLE_ID, LIBRARY_ID, STANDARD_LIBRARY, applyMergePolicy, ensureBundledLibrary, ensureLibraryLink, exportLibraryRows, exportProvidedLibrary, libraryBundlePath, manualHandlers, manualHandlersFor, libraryInfo, libraryLink, mergePolicy, seedStandardLibrary, setMergePolicy } from './library'

const share = 'library-share-0123456789', address = { owner: 'fos-library', path: [HOME_ID, LIBRARY_ID], share, title: 'Standard library' }
const revision = (value: unknown) => JSON.stringify(value).length.toString(36)

function library(): { r: Replica; path: Scope } {
  let r = ensureHomeContext(createReplica('user:fos-library'), 1)
  r = addRow(r, [HOME_ID], 'plain', 'Standard library', 1, { id: LIBRARY_ID })
  const path = [HOME_ID, LIBRARY_ID]
  r = setSharing(r, path, { id: share, audience: 'users', enabled: true }, 2)
  r = setMemberCapabilitiesAt(r, path, 'audience:users', ['read', 'edit', 'approve', 'rank'], [], 2)
  r = setMergePolicy(r, path, DEFAULT_MERGE_POLICY, 2)
  return { r: seedStandardLibrary(r, path, 3), path }
}

/** A member's proposal adding a row, built the way the node-sync path records one. */
function proposeRow(r: Replica, path: Scope, peer: string, title: string, id: string, now: number): { replica: Replica; cid: string } {
  const store = r.store, root = headCid(r), hostCid = resolveScope(store, root, path)!
  const base = put(store, valueContent(store, hostCid)), draftStore = new FosStore()
  importNodes(draftStore, reachableNodes(store, [base]))
  commitRoot(draftStore, base, now)
  const draft = addRow(createReplica(peer, draftStore), [], 'template', title, now, { id })
  importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
  const cid = put(store, proposalContent(store, peer, 'node-sync', headCid(draft), base, now))
  commitRoot(store, updateAtScope(store, root, path, current => withProposal(store, makeLink(store, current, now), peer, cid, 'node-sync'), 'node'), now)
  return { replica: { ...r }, cid }
}

test('seeding adds the standard templates once and records the version', () => {
  const { r, path } = library()
  const rows = view(r, path)!.tasks
  expect(rows.filter(t => t.kind === 'template').map(t => t.title)).toEqual(STANDARD_LIBRARY.filter(s => s.kind === 'template').map(s => s.text))
  expect(view(r, [...path, 'lib:trip'])!.tasks.map(t => t.requirement?.capability)).toEqual(['confirmation', 'allocation', 'allocation', 'task', 'task'])
  expect(libraryInfo(r, path)).toMatchObject({ version: 1 })
  expect(libraryInfo(r, path)!.seeded).toContain('lib:trip:budget')
  const again = seedStandardLibrary(r, path, 9)
  expect(headCid(again)).toBe(headCid(r))
  // a row the group removed is not reseeded: the seed list remembers what it already added
  const trimmed = seedStandardLibrary(addRow(r, path, 'plain', 'keep', 10), path, 11)
  expect(view(trimmed, path)!.tasks.filter(t => t.kind === 'template')).toHaveLength(8)
})

test('every account gets one reference to the library in its Home, carrying the shared address', () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  const linked = ensureLibraryLink(r, address, 2)
  expect(linked.added).toBe(true)
  expect(linked.path).toEqual([HOME_ID, LIBRARY_ID])
  r = linked.replica
  const row = view(r, [HOME_ID])!.tasks.find(t => t.id === LIBRARY_ID)!
  expect(row).toMatchObject({ kind: 'ref', title: 'Standard library', refOwner: 'fos-library', refId: LIBRARY_ID })
  expect(libraryLink(r)).toEqual([HOME_ID, LIBRARY_ID])
  const second = ensureLibraryLink(r, address, 3)
  expect(second.added).toBe(false)
  expect(headCid(second.replica)).toBe(headCid(r))
  expect(libraryLink(ensureHomeContext(createReplica('user:nobody'), 1))).toBeNull()
})

test('the users audience is a group every account belongs to; explicit entries still win', () => {
  const { r, path } = library()
  const cid = resolveScope(r.store, headCid(r), path)!, value = content(r.store, cid)
  expect(memberFor(r.store, value, 'user:bob')?.peerId).toBe('audience:users')
  expect(hasCapability(r.store, value, 'user:bob', 'approve')).toBe(true)
  expect(hasCapability(r.store, value, 'user:bob', 'execute')).toBe(false)
  expect(hasCapability(r.store, value, 'visitor:anon', 'read')).toBe(false)
  expect(nodeAuthorityAt(r, path, { peerId: 'user:bob', scope: path, capabilities: [] })).toEqual(expect.arrayContaining(['read', 'edit', 'approve', 'rank']))
  expect(() => nodeAuthorityAt(r, path, { peerId: 'visitor:anon', scope: path, capabilities: [] })).toThrow()
  const restricted = addMemberAt(r, path, 'user:carol', 'carol', ['read'], 5)
  const restrictedValue = content(restricted.store, resolveScope(restricted.store, headCid(restricted), path)!)
  expect(memberFor(restricted.store, restrictedValue, 'user:carol')?.peerId).toBe('user:carol')
  expect(hasCapability(restricted.store, restrictedValue, 'user:carol', 'edit')).toBe(false)
  expect(nodeAuthorityAt(restricted, path, { peerId: 'user:carol', scope: path, capabilities: [] })).toEqual(['read'])
})

test('a proposal merges once enough members approved it; a lone approval waits', () => {
  const { r: seeded, path } = library()
  expect(mergePolicy(seeded, path)).toEqual({ approvals: 2 })
  const proposed = proposeRow(seeded, path, 'user:bob', 'Weekly review', 'lib:weekly', 10)
  let r = proposed.replica
  const projection = sharedProjection(r, path, revision)
  expect(projection.proposals.map(p => p.id)).toEqual([`proposal:${proposed.cid}`])
  const vote = (peer: string, at: number) => writeParticipation(r, path, { peer, audience: share, revision: sharedProjection(r, path, revision).revision, updated: at, approvals: [`proposal:${proposed.cid}`], ranking: [], fields: {} }, at)
  r = vote('user:bob', 11)
  expect(applyMergePolicy(r, path, revision, 12).merged).toEqual([])
  r = vote('user:carol', 13)
  const merged = applyMergePolicy(r, path, revision, 14)
  expect(merged.merged).toEqual([proposed.cid])
  expect(view(merged.replica, path)!.tasks.some(t => t.id === 'lib:weekly' && t.kind === 'template')).toBe(true)
  expect(view(merged.replica, path)!.proposals.filter(p => p.status === 'open')).toHaveLength(0)
  expect(applyMergePolicy(merged.replica, path, revision, 15).merged).toEqual([])
  // without a policy the owner decides by hand, however many approve
  const fresh = library(), second = proposeRow(fresh.r, fresh.path, 'user:bob', 'Retro', 'lib:retro', 30)
  let manual = setMergePolicy(second.replica, fresh.path, null, 31)
  for (const [peer, at] of [['user:bob', 32], ['user:carol', 33]] as const) manual = writeParticipation(manual, fresh.path, { peer, audience: share, revision: sharedProjection(manual, fresh.path, revision).revision, updated: at, approvals: [`proposal:${second.cid}`], ranking: [], fields: {} }, at)
  expect(mergePolicy(manual, fresh.path)).toBeNull()
  expect(applyMergePolicy(manual, fresh.path, revision, 34).merged).toEqual([])
  expect(view(manual, fresh.path)!.proposals.filter(p => p.status === 'open')).toHaveLength(1)
})

test('the library exports as rows that seed an identical copy; a device bundles that copy until its first sync replaces it with the reference', () => {
  const { r: lib, path } = library()
  const rows = exportLibraryRows(lib, path)
  expect(rows.map(row => [row.id, row.kind])).toEqual(STANDARD_LIBRARY.map(row => [row.id, row.kind]))
  expect(rows.find(row => row.id === 'lib:trip')!.children!.map(c => c.requirement?.capability)).toEqual(['confirmation', 'allocation', 'allocation', 'task', 'task'])
  expect(rows.find(row => row.id === 'lib:readme')!.text).toMatch(/^# Standard library/)
  // a device that never synced: the bundle seeds a local copy with the same rows
  let device = ensureHomeContext(createReplica('user:device'), 1)
  const bundled = ensureBundledLibrary(device, { address, version: 7, rows }, 2)
  expect(bundled.added).toBe(true)
  expect(bundled.path).toEqual([HOME_ID, LIBRARY_BUNDLE_ID])
  device = bundled.replica
  expect(libraryBundlePath(device)).toEqual([HOME_ID, LIBRARY_BUNDLE_ID])
  expect(libraryLink(device)).toBeNull()
  expect(view(device, [HOME_ID, LIBRARY_BUNDLE_ID])!.tasks.filter(t => t.kind === 'template').map(t => t.title)).toEqual(rows.filter(row => row.kind === 'template').map(row => row.text))
  expect(libraryInfo(device, [HOME_ID, LIBRARY_BUNDLE_ID])).toMatchObject({ version: 7, source: 'bundle' })
  expect(ensureBundledLibrary(device, { address, version: 7, rows }, 3).added).toBe(false)
  // an empty bundle (a build made without a server) falls back to the in-code seed list
  const bare = ensureBundledLibrary(ensureHomeContext(createReplica('user:bare'), 1), { address: null, version: 0, rows: [] }, 2).replica
  expect(view(bare, [HOME_ID, LIBRARY_BUNDLE_ID])!.tasks.filter(t => t.kind === 'template')).toHaveLength(8)
  // the first owner sync: the copy gives way to the live reference, once
  const linked = ensureLibraryLink(device, address, 10)
  expect(linked.added).toBe(true)
  expect(libraryBundlePath(linked.replica)).toBeNull()
  expect(libraryLink(linked.replica)).toEqual([HOME_ID, LIBRARY_ID])
  expect(view(linked.replica, [HOME_ID])!.tasks.filter(t => t.id === LIBRARY_ID || t.id === LIBRARY_BUNDLE_ID)).toHaveLength(1)
  expect(ensureBundledLibrary(linked.replica, { address, version: 7, rows }, 11).added).toBe(false)
})

test('the nodes the fos CLI pulls through the account export as the same bundle the server seeded', () => {
  const { r: lib, path } = library()
  const scope = path, pulled: Array<{ request: any; node: any }> = []
  // breadth first, as `fos library export` walks the shared tree (shared/sync/node-provider.ts protocol)
  const queue: Scope[] = [[]]
  while (queue.length) {
    const relative = queue.shift()!
    const request = { peerId: 'user:dev', scope, path: relative, linkId: `fos-cli:${relative.join('/')}` }
    const served = exchangeNode(lib, request, { peerId: 'user:dev', scope, owner: false, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }, 50 + pulled.length)
    pulled.push({ request, node: served.node })
    for (const child of served.node.children) if (child.kind !== 'ref') queue.push([...relative, child.id])
  }
  const bundle = exportProvidedLibrary({ address, nodes: pulled }, 99)
  expect(bundle.address).toEqual(address)
  expect(bundle.rows).toEqual(exportLibraryRows(lib, path))
  expect(bundle.rows.filter(row => row.kind === 'template')).toHaveLength(8)
  expect(exportProvidedLibrary({ address, nodes: [] }, 1)).toEqual({ address, version: 0, rows: [] })
})

test('the library carries manual fallback handlers for every kind of requirement, matched by capability and resource', () => {
  const { r } = library()
  const handlers = manualHandlers(r)
  expect(handlers.map(h => h.capability === 'allocation' ? `${h.capability}:${h.resource}` : h.capability).sort()).toEqual([
    'allocation:account', 'allocation:calendar', 'allocation:inventory', 'allocation:location', 'allocation:location', 'allocation:points', 'llm', 'mail', 'market', 'repo', 'search', 'tool'
  ])
  expect(manualHandlersFor(r, { capability: 'allocation', resource: 'account' }).map(h => h.label)).toEqual(['Paid outside Fos'])
  expect(manualHandlersFor(r, { capability: 'allocation', resource: 'location' }).map(h => [h.id, h.device])).toEqual([['lib:manual:location', false], ['lib:device:location', true]])
  expect(manualHandlersFor(r, { capability: 'mail' }).map(h => h.label)).toEqual(['Sent it myself'])
  expect(manualHandlersFor(r, { capability: 'confirmation' })).toEqual([])
  // a device that only has the bundled copy offers the same fallbacks
  const device = ensureBundledLibrary(ensureHomeContext(createReplica('user:device'), 1), { address, version: 1, rows: exportLibraryRows(r, [HOME_ID, LIBRARY_ID]) }, 2).replica
  expect(manualHandlers(device)).toEqual(handlers)
  expect(manualHandlers(createReplica('user:none'))).toEqual([])
})
