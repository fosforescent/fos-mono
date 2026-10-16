import type { FosNodeContent } from '../types'
import { FosStore } from '../dag-implementation/store'
import { CAPABILITIES, isPeerReference, isMemberEdge, isPeerEdge, isBookkeepingEdge, isHandle, content, put, reachableNodes, readMembers, withMember, withPeer } from './graph'

/**
 * A recipient's graph view. The source graph is untouched; changed ancestors
 * receive their own content addresses. Both sides of every edge are visited,
 * including history, constructors, proposals, and direct references.
 */
export function replicationView(store: FosStore, roots: Array<string | null>, provider: string) {
  const nodes = reachableNodes(store, roots)
  const excluded = new Map<string, string>()
  for (const node of Object.values(nodes)) {
    const id = node.data.alias?.id
    if (!id) continue
    if (isPeerReference(node)) excluded.set(id, node.data.ref!.peer!)
    else if (readMembers(store, node).some(m => m.peerId === 'fos' && m.disabled?.includes('persist'))) {
      const peers = node.children.filter(edge => isPeerEdge(store, edge)).map(([, cid]) => content(store, cid).data.peerId?.content).filter((id): id is string => !!id && id !== 'fos').sort()
      if (!excluded.has(id)) excluded.set(id, peers[0] ?? provider)
    }
  }
  // A link directly into a private descendant must not bypass the boundary.
  // Include all versions and alternatives, not only the selected branch.
  const visited = new Set<string>()
  const protect = (cid: string, peer: string) => {
    if (visited.has(cid)) return
    visited.add(cid)
    const node = content(store, cid), id = node.data.alias?.id
    if (id && !excluded.has(id)) excluded.set(id, peer)
    for (const edge of node.children) {
      if (isMemberEdge(store, edge) || isPeerEdge(store, edge)) continue
      for (const child of edge) protect(child, peer)
    }
  }
  for (const [cid, node] of Object.entries(nodes)) {
    const peer = excluded.get(node.data.alias?.id ?? '')
    if (peer && !isPeerReference(node)) protect(cid, peer)
  }
  // Re-enabling persistence authorizes the current snapshot, not its old
  // private history. Walk live edges separately so PREV never grants access.
  const allowed = new Set<string>(), liveSeen = new Set<string>()
  const live = (cid: string, inherited = false) => {
    const key = cid + ':' + inherited
    if (liveSeen.has(key)) return
    liveSeen.add(key)
    const node = content(store, cid)
    if (isHandle(node)) return
    const fos = readMembers(store, node).find(m => m.peerId === 'fos')
    if (fos?.disabled?.includes('persist')) return
    const enabled = fos ? !fos.disabled?.includes('persist') && (fos.capabilities.includes('persist') || fos.accepts?.includes('persist') === true) : inherited
    if (enabled) allowed.add(cid)
    for (const edge of node.children) {
      if (isBookkeepingEdge(store, edge)) continue
      for (const child of edge) live(child, enabled)
    }
  }
  // Only the current head can authorize disclosure. Merge bases and history cannot.
  const liveRoot = roots[0]
  if (liveRoot && store.table.has(liveRoot)) live(liveRoot)
  const memo = new Map<string, string>()
  const project = (cid: string): string => {
    const cached = memo.get(cid)
    if (cached) return cached
    const node = content(store, cid), id = node.data.alias?.id
    if (isPeerReference(node)) { memo.set(cid, cid); return cid }
    const peer = id && excluded.get(id)
    if (peer && !allowed.has(cid)) {
      let ref: FosNodeContent = { data: { alias: { id }, ref: { id, peer, version: cid } }, children: [] }
      ref = withPeer(store, withMember(store, ref, 'fos', 'fos', CAPABILITIES, CAPABILITIES, []), peer)
      const result = put(store, ref)
      memo.set(cid, result)
      return result
    }
    const children = node.children.map(([left, right]): [string, string] => [project(left), project(right)])
    const result = children.every((edge, i) => edge[0] === node.children[i]![0] && edge[1] === node.children[i]![1]) ? cid : put(store, { ...node, children })
    memo.set(cid, result)
    return result
  }
  return { project }
}

/** Reconnect locally held versions after merging the recipient's graph view. */
export function restorePeerReferences(store: FosStore, root: string, availableRoots: string[]): string {
  // A known hash is not authority to expose another local context. Only reconnect
  // content already reachable from this attachment (or explicitly transferred).
  const available = new Set(Object.keys(reachableNodes(store, availableRoots)))
  const memo = new Map<string, string>()
  const restore = (cid: string): string => {
    const cached = memo.get(cid)
    if (cached) return cached
    const node = content(store, cid)
    if (isPeerReference(node)) {
      const version = node.data.ref!.version!
      if (available.has(version) && store.table.has(version) && content(store, version).data.alias?.id === node.data.ref!.id && !isPeerReference(content(store, version))) {
        memo.set(cid, version)
        return version
      }
      memo.set(cid, cid)
      return cid
    }
    const children = node.children.map(([left, right]): [string, string] => [restore(left), restore(right)])
    const result = children.every((edge, i) => edge[0] === node.children[i]![0] && edge[1] === node.children[i]![1]) ? cid : put(store, { ...node, children })
    memo.set(cid, result)
    return result
  }
  return restore(root)
}
