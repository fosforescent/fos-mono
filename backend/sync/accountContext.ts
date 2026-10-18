/**
 * What an account's store always carries after a sync: Home (`ensureHomeContext`, with the host's offers) and, for
 * every account but the library's own, the reference to the standard library (`ensureLibraryLink`, sync/library.ts).
 * Kept apart from library.ts so the sync paths (provide-node, the legacy peer-sync) can import it without a cycle.
 */
import { ensureHomeContext, ensureLibraryLink, type Replica } from '@fosforescent/shared/sync/index'
import type { HandlerRegistry } from './registry'

export function ensureAccountContext(r: Replica, now: number, registry?: HandlerRegistry): Replica {
  r = ensureHomeContext(r, now, registry?.hostOffers())
  const library = registry?.library
  if (library && r.meta.peerId !== `user:${library.owner}`) r = ensureLibraryLink(r, library, now).replica
  return r
}
