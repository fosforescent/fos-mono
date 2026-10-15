import { isCurrentCid } from '../../shared/dag-implementation/cid'
import { parseDocument, stringify } from 'yaml'
import { put, createReplica, headCid, importNodes, reachableNodes, resolveScope, type Replica, type Scope } from '../../shared/sync/index'
import type { FosNodesData } from '../../shared/types'
/** First dictionary entry is the selected node. Every document is emitted once, depth first. */
export function exportNodeYaml(replica: Replica, path: Scope): string {
  const root = resolveScope(replica.store, headCid(replica), path)
  if (!root) throw new Error('Node not found')
  return stringify(reachableNodes(replica.store, [root]), { aliasDuplicateObjects: false, lineWidth: 0 })
}
/** Validate in an isolated store before touching the user's document. */
export function parseNodeYaml(text: string): { root: string; nodes: FosNodesData } {
  if (text.length > 20 * 1024 * 1024) throw new Error('YAML import is limited to 20 MB.')
  const document = parseDocument(text, { uniqueKeys: true })
  if (document.errors.length) throw new Error(document.errors[0].message)
  const nodes = document.toJS({ maxAliasCount: 0 })
  if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes)) throw new Error('Expected a dictionary of node IDs and documents.')
  const entries = Object.entries(nodes)
  if (!entries.length || entries.length > 100000) throw new Error('Expected between 1 and 100,000 node documents.')
  for (const [id, raw] of entries) {
    const node = raw as { data?: unknown; children?: unknown }
    if (!isCurrentCid(id) || !node || typeof node !== 'object' || Array.isArray(node) || !node.data || typeof node.data !== 'object' || Array.isArray(node.data) || !Array.isArray(node.children) || node.children.some(edge => !Array.isArray(edge) || edge.length !== 2 || edge.some(id => typeof id !== 'string'))) throw new Error(`Invalid node document: ${id}`)
  }
  const replica = createReplica('yaml-validation')
  importNodes(replica.store, nodes)
  for (const [id, node] of entries) {
    if (!replica.store.table.has(id) || put(replica.store, node as FosNodesData[string]) !== id) throw new Error(`Invalid content ID or unresolved reference: ${id}`)
  }
  return { root: entries[0][0], nodes }
}
