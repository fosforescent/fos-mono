/** Lexically scoped declarations and their accepted submissions. No capability vocabulary. */
import { isHandlerStateLeft } from './capabilities'
import type { FosStore } from '../dag-implementation/store'
import { isTemplateType, isLibraryRef, content, identityCid, isBranchChoice, readChoice, isRefNode, refValueCid, typeIdOf, valueContent } from './graph'
import { matchesGraph } from './structural'

/** Accepted values include every alternative, without selecting or merging them.
 * PROPOSAL and PREV edges are deliberately excluded: an offer is not an assignment.
 */
export function refSubmissions(store: FosStore, cid: string): string[] {
  return refSubmissionSet(store, cid).values
}
export function refSubmissionSet(store: FosStore, cid: string): { values: string[]; alternatives: boolean } {
  const values = new Set<string>(), visiting = new Set<string>()
  let alternatives = false
  const walk = (current: string) => {
    if (!store.table.has(current) || visiting.has(current)) return
    if (visiting.size >= 128) throw new Error('Ref indirection exceeds 128 levels.')
    visiting.add(current)
    try {
      const node = content(store, current)
      if (node.data.refAlternatives) {
        alternatives = true
        for (const [, value] of node.children) walk(value)
      } else if (isBranchChoice(store, node)) {
        alternatives = true
        for (const option of readChoice(store, current).options) if (option.edge) {
          const right = content(store, option.edge[1])
          walk(isRefNode(store, right) && !refValueCid(store, right) && right.data.alias?.id === node.data.alias?.id ? option.edge[0] : identityCid(store, option.edge))
        }
      } else if (isRefNode(store, node)) {
        for (const [key, target] of node.children) if (key === store.primitive.targetPointerConstructor.getId()) walk(target)
      } else values.add(current)
    } finally { visiting.delete(current) }
  }
  if (isRefNode(store, content(store, cid)) || isBranchChoice(store, content(store, cid))) walk(cid)
  return { values: [...values], alternatives }
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
/** The pattern is another graph, not a JSON schema or a nominal type identifier. */
export const matchesRefPattern = matchesGraph
export const refValueCompatible = (store: FosStore, pattern: string, value: string): boolean => matchesGraph(store, pattern, value, { allowHoles: true })
