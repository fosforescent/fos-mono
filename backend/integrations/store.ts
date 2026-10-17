/**
 * Row access for the channel and MCP peers: a user's tree as a replica the shared edit operations can work on,
 * loaded and saved through the peer-sync store (so indexing and after-save hooks run as for any sync).
 */

import type { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { createReplica, addSupply, headCid, view, type Replica, type Scope, type TaskView } from '@fosforescent/shared/sync/index'
import type { PeerSyncDeps, PeerSyncUser } from '../sync/peerSync'

/** The account's peer id (as `serverPeerIdFor` in peerSync; repeated here so this module loads without express/prisma in tests). */
const serverPeerIdFor = (username: string): string => `user:${username}`

export type StoreDeps = Pick<PeerSyncDeps, 'loadStore' | 'saveStore'> & {
  withUserLock<T>(key: string | number, fn: () => Promise<T>): Promise<T>
  usernameOf(userId: number): Promise<string | null>
  now?: () => number
}

export function replicaOf(store: FosStore, username: string): Replica {
  return createReplica(serverPeerIdFor(username), store)
}

/** Load a user's tree, change it, save it: `fn` returns the new replica (or null to leave it). */
export async function editTree<T>(deps: StoreDeps, userId: number, fn: (replica: Replica, user: PeerSyncUser) => Promise<{ replica: Replica | null; result: T }>): Promise<T | null> {
  const username = await deps.usernameOf(userId)
  if (!username) return null
  return deps.withUserLock(`user:${username}`, async () => {
    const loaded = await deps.loadStore(username)
    if (!loaded) return null
    const replica = replicaOf(loaded.store, username)
    const before = headCid(replica)
    const { replica: next, result } = await fn(replica, loaded.user)
    if (next && headCid(next) !== before) await deps.saveStore(loaded.user, next.store)
    return result
  })
}

/** Every row in the tree with its path, depth-first. */
export function walkRows(replica: Replica, at: Scope = []): Array<{ at: Scope; row: TaskView }> {
  const out: Array<{ at: Scope; row: TaskView }> = []
  const node = view(replica, at)
  if (!node) return out
  for (const row of node.tasks) {
    out.push({ at, row })
    if (row.childCount) out.push(...walkRows(replica, [...at, row.id]))
  }
  return out
}

/** The texted-commands view of a tree: add a row at the root, list open tasks, check one off. */
export { addSupply }
