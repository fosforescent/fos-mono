import type { FosNodeContent, FosNodesData } from '../types'
import { assertCurrentCid, hashContent } from './cid'
export { hashContent }

/**
 * A content-addressed node table and the root alias it is read from. `implementations` holds what host code means by
 * the primitive nodes in this store (by node cid); it is the only place host code is attached to the graph.
 */
export type FosStore = {
  table: Map<string, FosNodeContent>
  rootNodeId: string
  implementations: Map<string, unknown>
}

/** A store over `nodes` read from `rootNodeId`. Nodes of another data version are refused; edges must resolve. */
export function storeOf(nodes: FosNodesData, rootNodeId: string): FosStore {
  assertCurrentCid(rootNodeId)
  const table = new Map<string, FosNodeContent>()
  for (const [cid, node] of Object.entries(nodes)) {
    assertCurrentCid(cid)
    if (hashContent(node) !== cid) throw new Error(`node ${cid.slice(0, 16)} does not match its content`)
    table.set(cid, node)
  }
  for (const node of table.values()) for (const edge of node.children) for (const end of edge) if (!table.has(end)) throw new Error(`edge to missing node ${end.slice(0, 16)}`)
  if (!table.has(rootNodeId)) throw new Error('root node not found')
  return { table, rootNodeId, implementations: new Map() }
}

/** Insert content whose edges resolve in the store, and return its cid. */
export function putNode(store: FosStore, value: FosNodeContent): string {
  for (const [left, right] of value.children) {
    if (typeof left !== 'string' || typeof right !== 'string') throw new Error('malformed edge')
    if (!store.table.has(left)) throw new Error(`edge to missing node ${left.slice(0, 16)}`)
    if (!store.table.has(right)) throw new Error(`edge to missing node ${right.slice(0, 16)}`)
  }
  const cid = hashContent(value)
  if (!store.table.has(cid)) store.table.set(cid, value)
  return cid
}
