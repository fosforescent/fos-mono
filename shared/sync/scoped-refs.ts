/** Lexically scoped declarations and their accepted submissions. No capability vocabulary. */
import { isHandlerStateLeft } from './capabilities'
import type { FosStore } from '../dag-implementation/store'
import { isTemplateType, isLibraryRef, content, enclosingScopes, importNodes, reachableNodes, identityCid, isBranchChoice, isRowEdge, readChoice, isRefNode, refValueCid, typeIdOf, valueContent, type Scope } from './graph'
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
/**
 * Whether the row `[type, cid]` declares a binding: a named row, or a ref whose left is a pattern of its own (not a
 * library constructor or a template, whose rows are containers). Every lookup, by name or by type, reads declarations
 * through this one test.
 */
export function declares(store: FosStore, type: string, cid: string): boolean {
  if (!store.table.has(cid)) return false
  const node = content(store, cid)
  // A library ref is a container: its names resolve as its fields (namesInLibrary), never as lexical bindings.
  if (isLibraryRef(store, node)) return false
  // a native handler's state rows (an execute row's journal, a trigger row) are no bindings
  if (isHandlerStateLeft(store, type)) return false
  if (node.data.name || valueContent(store, cid).data.name) return true
  const pattern = store.table.get(type)
  return isRefNode(store, node) && !isTemplateType(store, type) && (!typeIdOf(store, type) || !!pattern?.data.capabilityDefinition || !!pattern?.data.form?.primitive)
}
function declarationRows(store: FosStore, cid: string): Array<{ cid: string; type: string }> {
  if (!store.table.has(cid)) return []
  return content(store, cid).children.flatMap(edge => isRowEdge(store, edge) && content(store, edge[1]).data.alias && declares(store, edge[0], edge[1]) ? [{ cid: edge[1], type: edge[0] }] : [])
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
