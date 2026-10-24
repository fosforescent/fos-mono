/** Moving a declaration must preserve its lexical meaning; copying must not capture private refs. */
import type { FosNodeContent } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { content, importNodes, reachableNodes, isBookkeepingEdge, isRowEdge, isLibraryType, valueContent, put, type Scope } from './graph'
import { REF_TYPE } from './library-types'
import { compileRefGraph } from './ref-compiler'
import { resolveRefExpression, resolveRefIdentity } from './ref-paths'
import type { Replica } from './replica'

const below = (path: Scope, parent: Scope) => parent.every((id, index) => path[index] === id)

/** Returns a graph suitable for the destination, without changing the replica's root. */
export function transferRefGraph(r: Replica, cid: string, from: Scope, to: Scope, copy: boolean): string {
  const active = new Set<string>()
  let budget = 20000
  const walk = (current: string, path: Scope, scopeStore: FosStore = r.store): string => {
    if (--budget < 0 || active.size >= 128 || active.has(current)) throw new Error('Cannot transfer a cyclic or excessively large reference graph.')
    if (!r.store.table.has(current)) throw new Error('Reference content is unavailable.')
    const node = content(r.store, current)
    if (node.data.ref || node.data.refExpression) {
      if (node.data.ref?.peer || node.data.ref?.owner) {
        if (copy) throw new Error('Load the remote value before copying it.')
        // An attached endpoint is an explicit handler, never a lexical search into its peer.
        return current
      }
      const resolve = (at: Scope) => node.data.refExpression
        ? resolveRefExpression({ store: scopeStore }, at, node.data.refExpression)
        : resolveRefIdentity({ store: scopeStore }, at, node.data.ref!.id)
      const source = resolve(path.slice(0, -1))
      const location = source.status === 'ready' ? source.locations[0]! : null
      if (!location) throw new Error('Resolve the referenced value before moving or copying it.')
      if (location.store === r.store && below(location.path, from)) return current
      if (copy) {
        const compiled = compileRefGraph({ ...r, store: scopeStore }, current, path, { selected: true })
        if (!compiled.complete) throw new Error(`A copy requires a closed value. Fill its inputs or explicitly pass its refs first (${compiled.holes.map(h => `${h.id}: ${h.reason}`).join(', ')}).`)
        if (location.store !== r.store) importNodes(r.store, reachableNodes(location.store, [location.cid, ...(location.pattern ? [location.pattern] : [])]))
        const value = valueContent(r.store, walk(location.cid, location.path, location.store))
        return put(r.store, { ...value, data: { ...value.data, ...(node.data.alias ? { alias: node.data.alias } : {}), ...(node.data.name ? { name: node.data.name } : {}) } })
      }
      const destination = resolve([...to, ...path.slice(from.length)].slice(0, -1))
      if (destination.status !== 'ready' || destination.locations[0]!.store !== location.store || destination.locations[0]!.cid !== location.cid)
        throw new Error('Declare this value’s dependencies in the shared scope and pass those refs in, or copy the value instead.')
      return current
    }
    active.add(current)
    try {
      const children: FosNodeContent['children'] = node.children.map(edge => {
        if (isBookkeepingEdge(r.store, edge)) return edge
        const right = r.store.table.get(edge[1])
        const childPath = isRowEdge(r.store, edge) && right?.data.alias ? [...path, right.data.alias.id] : path
        const copied = walk(edge[1], childPath, scopeStore)
        let instruction = edge[0]
        if (copied !== edge[1] && right?.data.ref && isLibraryType(r.store, instruction, REF_TYPE)) {
          const source = resolveRefIdentity({ store: scopeStore }, childPath.slice(0, -1), right.data.ref.id)
          if (source.status === 'ready' && source.locations[0]?.pattern) instruction = source.locations[0].pattern
        }
        return [walk(instruction, childPath, scopeStore), copied]
      })
      return children.every((edge, index) => edge[0] === node.children[index]![0] && edge[1] === node.children[index]![1]) ? current : put(r.store, { ...node, children })
    } finally { active.delete(current) }
  }
  return walk(cid, from)
}
