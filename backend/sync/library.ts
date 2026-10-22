/**
 * The shared standard library on this host (shared/sync/library.ts): a node in a system account's Home. Devices ship
 * the library in their root; people who contribute link this node into their Home (opt in) and vote on it. At
 * startup the server makes sure the account, the node, its sharing with the `users` audience (read, edit, approve,
 * rank), its merge policy and its seed templates exist. Members' edits reach the node as proposals and merge once
 * enough members approved them (sharing.ts `submit` → `applyMergePolicy`).
 */
import { DEFAULT_MERGE_POLICY, LIBRARY_ID, addRefAt, createReplica, ensureHomeContext, headCid, homePath, mergePolicy, put, seedStandardLibrary, addMemberAt, setMemberCapabilitiesAt, setMergePolicy, view, type LibraryAddress } from '@fosforescent/shared/sync/index'
import type { HostRuntime } from './host-runtime'
import { withUserLock, type AccountStoreDeps } from './accountStore'

export const LIBRARY_TITLE = 'Standard library'
export const LIBRARY_GRANTS = ['read', 'edit', 'rank'] as const

export type LibraryDeps = AccountStoreDeps & {
  /** Create the system account that owns the library when it does not exist yet. */
  createAccount(username: string): Promise<void>
}


/** The library's node in the owner's store, created, shared and seeded as needed. Returns its address. */
export async function ensureStandardLibrary(deps: LibraryDeps, owner: string, runtime?: HostRuntime): Promise<LibraryAddress> {
  if (!await deps.loadStore(owner)) await deps.createAccount(owner)
  return withUserLock(`user:${owner}`, async () => {
    const loaded = await deps.loadStore(owner)
    if (!loaded) throw new Error(`The library account @${owner} is unavailable.`)
    const now = deps.now?.() ?? Date.now()
    let r = createReplica(`user:${owner}`, loaded.store)
    const before = headCid(r)
    r = ensureHomeContext(r, now, runtime?.hostOffers())
    const home = homePath(r)
    // a library ref like a device root's: any value fits it (the empty node on its left constrains nothing)
    if (!view(r, home)?.tasks.some(t => t.id === LIBRARY_ID)) r = addRefAt(r, home, LIBRARY_ID, put(r.store, { data: {}, children: [] }), now, null, LIBRARY_TITLE)
    const path = [...home, LIBRARY_ID]
    // published to the group of every account, a member that reads, proposes (edit), approves and ranks
    const audience = view(r, path)?.members.find(m => m.peerId === 'audience:users')
    if (!audience) r = addMemberAt(r, path, 'audience:users', '✦ Fos users', [...LIBRARY_GRANTS], now)
    else if (LIBRARY_GRANTS.some(cap => !audience.capabilities.includes(cap))) r = setMemberCapabilitiesAt(r, path, 'audience:users', [...LIBRARY_GRANTS], [], now)
    if (!mergePolicy(r, path)) r = setMergePolicy(r, path, DEFAULT_MERGE_POLICY, now)
    r = seedStandardLibrary(r, path, now)
    if (headCid(r) !== before) await deps.saveStore(loaded.user, r.store)
    return { owner, path, title: LIBRARY_TITLE }
  })
}
