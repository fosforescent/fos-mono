/** Test helpers. */
import { LIBRARY_ID, SERVER_TRANSPORT_CAPABILITIES, type NodeView, type Scope } from './graph'
import { view, type Replica } from './replica'
import { exchangeNode, nodeTreeSync } from './node-sync'
import type { NodeBranch, NodeRequest } from './node-provider'

/** The root view without the root's own shipped library row: what the tests' rows are compared against. */
export function userView(r: Replica): NodeView | null {
  const root = view(r, [])
  return root && { ...root, tasks: root.tasks.filter(t => t.id !== LIBRARY_ID) }
}

export type SyncOptions = {
  /** Sync as a peer invited at this scope of the server (its edits become a proposal there); default: as the owner. */
  invited?: Scope
  /** As the owner: where on the server the client's root is (default: the server's root). */
  at?: Scope
  push?: boolean
  branches?: NodeBranch[]
  now?: number
  /** Every request and answer, for checking what crossed the wire. */
  wire?: unknown[]
  /** Edit the client while its first request is in flight. */
  during?: (r: Replica) => Replica
}

/**
 * Sync `client` with `server` node by node (`nodeTreeSync` against `exchangeNode`), as a device syncs with its account:
 * the client's attachment (`localScope`, e.g. Home) with the same path on the server. The server's store is updated in
 * place. Returns the client.
 */
export function syncWith(client: Replica, server: Replica, options: SyncOptions = {}): Replica {
  const { invited, at = [], push = true, branches = [], now = 10, wire } = options
  let during = options.during
  const scope = invited ?? [], localRoot = client.meta.localScope ?? []
  const authority = { peerId: client.meta.peerId, scope, owner: !invited, proposeOnly: !!invited, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const run = nodeTreeSync(client, { peer: client.meta.serverPeerId ?? (invited ? null : server.meta.peerId), scope, remoteRoot: invited ? scope : [...at, ...localRoot], localRoot, branches, push }, () => now)
  let step = run.next()
  while (!step.done) {
    const request: NodeRequest = step.value.request
    const answer = exchangeNode(server, request, authority, now).node
    wire?.push(request, answer)
    if (during) { during(step.value.replica); during = undefined }
    step = run.next(answer)
  }
  return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: step.value.peer } }
}
