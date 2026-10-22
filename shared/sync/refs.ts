/** Common ref-property view over existing storage. No new on-disk representation. */
import type { FosStore } from '../dag-implementation/store'
import { advertisedRows, content, identityCid, isMemberEdge, isGrantEdge, isRowEdge, memberEdgesOf, refValueCid, valueContent } from './graph'

export type RefProperty = {
  id: string; cid: string; name: string; type: string | null; value: string | null
  /** Remote ownership and direction are adapter metadata, not a different property model. */
  peer?: string; direction?: 'to' | 'from'; member: boolean; argument: boolean
}

/** Multiple submissions with the same name remain separate candidates. */
export function refProperties(store: FosStore, cid: string, select: 'all' | 'arguments' | 'members' = 'all'): RefProperty[] {
  // Binding and policy lookups are frequent: inspect only the edges they consume.
  const edges = select === 'members' ? memberEdgesOf(store, cid) : [...valueContent(store, cid).children]
  if (select === 'all') for (const edge of memberEdgesOf(store, cid)) if (!edges.some(e => e[0] === edge[0] && e[1] === edge[1])) edges.push(edge)
  return edges.flatMap((edge): RefProperty[] => {
    const member = isMemberEdge(store, edge), grant = isGrantEdge(store, edge)
    if (grant && advertisedRows(store, edge[1]).length) return refProperties(store, edge[1], 'arguments').map(property => ({ ...property, direction: edge[0] === store.primitive.acceptsNode.getId() ? 'from' as const : 'to' as const }))
    const id = member || grant ? edge[1] : identityCid(store, edge), node = content(store, id)
    const argument = isRowEdge(store, edge)
    const type = edge[0]
    if (select === 'arguments' && !argument) return []
    if (!node.data.alias?.id || (!member && !grant && !argument && !isRowEdge(store, edge))) return []
    return [{ id: node.data.alias.id, cid: id, name: node.data.name?.content ?? valueContent(store, id).data.name?.content ?? node.data.alias.id,
      type, value: refValueCid(store, node), member, argument,
      ...(node.data.peerId?.content || node.data.ref?.peer ? { peer: node.data.peerId?.content ?? node.data.ref!.peer } : {}),
      ...(grant ? { direction: edge[0] === store.primitive.acceptsNode.getId() ? 'from' as const : 'to' as const } : {}) }]
  })
}

/** Bind declarative constructor inputs without interpreting text as executable code. */
export function bindRefInputs(value: unknown, bindings: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = /^\{\{([^{}]+)\}\}$/.exec(value)
    if (!exact) return value
    if (!Object.prototype.hasOwnProperty.call(bindings, exact[1]!)) throw new Error(`Missing binding: ${exact[1]}`)
    return bindings[exact[1]!]
  }
  if (Array.isArray(value)) return value.map(v => bindRefInputs(v, bindings))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bindRefInputs(v, bindings)]))
  return value
}
