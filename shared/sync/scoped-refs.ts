/** Lexically scoped declarations and their accepted submissions. No capability vocabulary. */
import type { FosStore } from '../dag-implementation/store'
import { isLibraryRef, content, enclosingScopes, importNodes, reachableNodes, identityCid, isBranchChoice, isGrantEdge, isMemberEdge, isRowEdge, put, readChoice, refNodeContent, isRefNode, refValueCid, typeIdOf, type Scope } from './graph'
import { matchesGraph } from './structural'
import { headCid, type Replica } from './replica'

export type RefSubmission = { cid: string; refs: ScopedRef[] }
export type ScopedRef = {
  id: string; cid: string; type: string; name?: string; peerId?: string
  scope: Scope; values: RefSubmission[]
}

/** Accepted values include every alternative, without selecting or merging them.
 * PROPOSAL and PREV edges are deliberately excluded: an offer is not an assignment.
 */
export function refSubmissions(store: FosStore, cid: string): string[] {
  return refAlternatives(store, cid).map(value => value.cid)
}
function refAlternatives(store: FosStore, cid: string): Array<{ cid: string }> {
  const values = new Map<string, { cid: string }>(), visiting = new Set<string>()
  const walk = (current: string) => {
    if (!store.table.has(current) || visiting.has(current)) return
    if (visiting.size >= 128) throw new Error('Ref indirection exceeds 128 levels.')
    visiting.add(current)
    try {
      const node = content(store, current)
      if (isBranchChoice(store, node)) {
        for (const option of readChoice(store, current).options) if (option.edge) {
          const right = content(store, option.edge[1])
          walk(isRefNode(store, right) && !refValueCid(store, right) && right.data.alias?.id === node.data.alias?.id ? option.edge[0] : identityCid(store, option.edge))
        }
      } else if (isRefNode(store, node)) {
        for (const [key, target] of node.children) if (key === store.primitive.targetPointerConstructor.getId()) walk(target)
      } else values.set(current, { cid: current })
    } finally { visiting.delete(current) }
  }
  const target = refValueCid(store, content(store, cid))
  if (target) walk(target)
  return [...values.values()]
}

/** Declarations directly in this value. Ordinary child documents do not leak into scope. */
export function refDeclarations(store: FosStore, cid: string): string[] {
  return declarationRows(store, cid).map(row => row.cid)
}
function declarationRows(store: FosStore, cid: string): Array<{ cid: string; type: string }> {
  if (!store.table.has(cid)) return []
  const node = content(store, cid)
  return node.children.flatMap(edge => {
    if (!store.table.has(edge[1])) return []
    const ref = content(store, edge[1])
    const namedRow = (ref.data.name || content(store, refValueCid(store, ref) ?? edge[1]).data.name) && refValueCid(store, ref) && isRowEdge(store, edge)
    const left = content(store, edge[0])
    // A library ref is a container: its names resolve as names (namesInLibrary), never as lexical bindings.
    if (isLibraryRef(ref)) return []
    // Linked library document rows are containers, not implicit lexical names.
    // Explicit names and ref constructor arguments declare bindings.
    const declaration = ref.data.name || !typeIdOf(store, edge[0]) || left.data.capabilityDefinition || left.data.form?.primitive
    const type = isRowEdge(store, edge) && (namedRow || isRefNode(store, ref) && declaration) ? edge[0] : null
    if (!ref.data.alias || !type) return []
    return edge[0] === type || isRowEdge(store, edge) || isMemberEdge(store, edge) ||
      (isGrantEdge(store, edge) && edge[0] === store.primitive.acceptsNode.getId()) ? [{ cid: edge[1], type }] : []
  })
}

/** Inspect a declaration recursively; siblings stay alternatives, never a synthetic merged handler. */
export function inspectRef(store: FosStore, cid: string, rowType: string, scope: Scope = [], peerId?: string, ancestors = new Set<string>(), budget = { remaining: 5000 }): ScopedRef {
  if (--budget.remaining < 0) throw new Error('Ref discovery exceeds 5,000 declarations.')
  const node = content(store, cid), type = rowType
  if (!node.data.alias || !type) throw new Error('Expected a ref declaration.')
  const name = node.data.name ?? content(store, refValueCid(store, node) ?? cid).data.name
  const ref: ScopedRef = { id: node.data.alias.id, cid, type, scope, values: [],
    ...(name ? { name: name.content } : {}),
    ...((node.data.peerId?.content ?? peerId) ? { peerId: node.data.peerId?.content ?? peerId } : {}) }
  if (ancestors.has(cid)) return ref
  if (ancestors.size >= 128) throw new Error('Nested refs exceed 128 levels.')
  const next = new Set(ancestors).add(cid)
  ref.values = refAlternatives(store, cid).map(value => ({ ...value,
    refs: declarationRows(store, value.cid).map(child => inspectRef(store, child.cid, child.type, scope, content(store, value.cid).data.peerId?.content ?? ref.peerId, next, budget)) }))
  return ref
}

/** Walk outward from the requested node. Only the same declaration identity shadows an outer declaration. */
export function scopedRefs(replica: Replica, at: Scope): ScopedRef[] {
  const store = replica.store, declarations = new Map<string, ScopedRef>()
  for (const { store: source, cid, path: scope } of enclosingScopes(store, headCid(replica), at)) {
    const node = content(source, cid), values = refValueCid(source, node) ? refSubmissions(source, cid) : [cid]
    for (const value of values) for (const { cid: ref, type } of declarationRows(source, value)) {
      const id = content(source, ref).data.alias!.id
      if (!declarations.has(id)) {
        if (source !== store) importNodes(store, reachableNodes(source, [ref, type]))
        declarations.set(id, inspectRef(store, ref, type, scope))
      }
    }
  }
  return [...declarations.values()]
}

export function flattenRefs(refs: ScopedRef[]): ScopedRef[] {
  return refs.flatMap(ref => [ref, ...ref.values.flatMap(value => flattenRefs(value.refs))])
}

/** The pattern is another graph, not a JSON schema or a nominal type identifier. */
export const matchesRefPattern = matchesGraph
export const refValueCompatible = (store: FosStore, pattern: string, value: string): boolean => matchesGraph(store, pattern, value, { allowHoles: true })
