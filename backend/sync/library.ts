/**
 * The standard library on this host (shared/sync/library.ts): a node in a system account's Home that every account
 * references from its own Home. At startup the server makes sure the account, the node, its sharing with the
 * `users` audience (read, edit, approve, rank), its merge policy and its seed templates exist; every owner sync
 * then puts the reference into the account's Home (`ensureAccountContext`). Members' edits reach the node as
 * proposals and merge once enough members approved them (sharing.ts `submit` → `applyMergePolicy`).
 */
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { DEFAULT_MERGE_POLICY, LIBRARY_ID, LIBRARY_VERSION, addRow, createReplica, ensureHomeContext, exportLibraryRows, headCid, homePath, libraryInfo, mergePolicy, seedStandardLibrary, setMemberCapabilitiesAt, setMergePolicy, setSharing, sharing, view, type LibraryAddress, type LibraryBundle, type Replica } from '@fosforescent/shared/sync/index'
import type { HandlerRegistry } from './registry'
import { withUserLock, type PeerSyncDeps } from './peerSync'

export const LIBRARY_TITLE = 'Standard library'
export const LIBRARY_GRANTS = ['read', 'edit', 'approve', 'rank'] as const

export type LibraryDeps = PeerSyncDeps & {
  /** Create the system account that owns the library when it does not exist yet. */
  createAccount(username: string): Promise<void>
}

export { ensureAccountContext } from './accountContext'

/**
 * `GET /library`: the library as data (`LibraryBundle`), for client builds (web/scripts/pull-library.mjs pulls it
 * into `src/library.json`) so devices carry the templates before they ever sync. Public, cached for a minute.
 */
export function createLibraryRoute(deps: PeerSyncDeps, registry: HandlerRegistry) {
  let cached: { at: number; body: LibraryBundle } | null = null
  return async (_req: Request, res: Response): Promise<Response> => {
    res.setHeader('Cache-Control', 'public, max-age=60')
    const address = registry.library
    if (!address) return res.status(503).json({ error: 'The standard library is not available on this host yet.' })
    const now = deps.now?.() ?? Date.now()
    if (cached && now - cached.at < 60_000) return res.json(cached.body)
    const loaded = await deps.loadStore(address.owner)
    if (!loaded) return res.status(503).json({ error: 'The library account is unavailable.' })
    const r = createReplica(`user:${address.owner}`, loaded.store)
    const body: LibraryBundle = { address, version: libraryInfo(r, address.path)?.version ?? LIBRARY_VERSION, rows: exportLibraryRows(r, address.path) }
    cached = { at: now, body }
    return res.json(body)
  }
}

/** The library's node in the owner's store, created, shared and seeded as needed. Returns its address. */
export async function ensureStandardLibrary(deps: LibraryDeps, owner: string, registry?: HandlerRegistry): Promise<LibraryAddress> {
  if (!await deps.loadStore(owner)) await deps.createAccount(owner)
  return withUserLock(`user:${owner}`, async () => {
    const loaded = await deps.loadStore(owner)
    if (!loaded) throw new Error(`The library account @${owner} is unavailable.`)
    const now = deps.now?.() ?? Date.now()
    let r = createReplica(`user:${owner}`, loaded.store)
    const before = headCid(r)
    r = ensureHomeContext(r, now, registry?.hostOffers())
    const home = homePath(r)
    if (!view(r, home)?.tasks.some(t => t.id === LIBRARY_ID)) r = addRow(r, home, 'plain', LIBRARY_TITLE, now, { id: LIBRARY_ID })
    const path = [...home, LIBRARY_ID]
    let policy = sharing(r, path)
    if (!policy?.enabled || policy.audience !== 'users') {
      policy = { id: policy?.audience === 'users' ? policy.id : randomUUID(), audience: 'users', enabled: true }
      r = setSharing(r, path, policy, now)
    }
    // the audience is the group of every account: it reads, proposes (edit), approves and ranks
    const audience = view(r, path)?.members.find(m => m.peerId === 'audience:users')
    if (!audience || LIBRARY_GRANTS.some(cap => !audience.capabilities.includes(cap))) r = setMemberCapabilitiesAt(r, path, 'audience:users', [...LIBRARY_GRANTS], [], now)
    if (!mergePolicy(r, path)) r = setMergePolicy(r, path, DEFAULT_MERGE_POLICY, now)
    r = seedStandardLibrary(r, path, now)
    if (headCid(r) !== before) await deps.saveStore(loaded.user, r.store)
    return { owner, path, share: policy.id, title: LIBRARY_TITLE }
  })
}
