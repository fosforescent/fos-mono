/**
 * The fields of a library value: `lib.task`, `lib.meet`, `lib.capabilities.mail`, ... A field is a named row of the
 * library (its name is its field name in the graph; ids are opaque and never read). In a row `[left, right]`:
 *   right a ref with a value   the field is that value (`task` → the node task rows have on their left)
 *   right a ref with no value  a declaration: the field is its left (a capability pattern, ...)
 *   right a named row          the field is the row itself (a template, a group such as `capabilities`)
 * A field's own named rows are its fields in turn (`capabilities.mail`, `task.complete`, reached by `fieldOf`); the index
 * below holds the library's fields and the declarations its groups make, a node keeping the first path it is given.
 */
import type { FosNodeContent } from './types'

export type LibraryNames = { byName: Map<string, string>; byNode: Map<string, string>; ambiguous: Set<string> }
type Get = (cid: string) => FosNodeContent | null | undefined

/** The node a named row `[left, right]` of a library stands for, or null when it is no field. */
export function fieldNode(get: Get, edge: [string, string], target: string, alias: string): { name: string; node: string } | null {
  const [left, right] = edge
  let node = get(right), current = right
  const seen = new Set<string>()
  // A shared row may have a local ref envelope around its named value.
  // Follow that graph edge before interpreting the declaration itself.
  while (node && !node.data.name && !seen.has(current)) {
    seen.add(current)
    const pointer = node.children.find(([key]) => key === target)?.[1]
    if (!pointer) break
    current = pointer; node = get(current)
  }
  const name = node?.data.name?.content
  if (!node || !name) return null
  const pointer = node.children.find(([key]) => key === target)?.[1]
  if (pointer) return { name, node: pointer }
  if (node.children.some(([key]) => key === alias)) return { name, node: left }
  return { name, node: current }
}

/** The value of `cid` (through ref pointers). */
function valueOf(get: Get, cid: string, target: string): FosNodeContent | null {
  let node = get(cid), hops = 0
  while (node && hops++ < 16) {
    const next = node.children.find(([key]) => key === target)?.[1]
    if (!next) break
    node = get(next)
  }
  return node ?? null
}

/** The field `name` of the node `cid` (a library value or one of its fields), or null. */
export function fieldOf(get: Get, cid: string, name: string, target: string, alias: string): string | null {
  const matches: string[] = []
  for (const edge of valueOf(get, cid, target)?.children ?? []) {
    const field = fieldNode(get, edge as [string, string], target, alias)
    if (field?.name === name) matches.push(field.node)
  }
  if (matches.length > 1) throw new Error(`Ambiguous library field ${name}.`)
  return matches[0] ?? null
}

/** The library value `root`'s fields and their fields (dotted paths); `target`/`alias` are the ref constructors. */
export function libraryNames(get: Get, root: string, target: string, alias: string): LibraryNames {
  const byName = new Map<string, string>(), byNode = new Map<string, string>(), ambiguous = new Set<string>()
  const name = (path: string, node: string) => {
    if (byName.has(path)) ambiguous.add(path)
    else byName.set(path, node)
    if (!byNode.has(node)) byNode.set(node, path)
  }
  const fields: Array<{ name: string; node: string }> = []
  for (const edge of valueOf(get, root, target)?.children ?? []) {
    const field = fieldNode(get, edge as [string, string], target, alias)
    if (field) { name(field.name, field.node); fields.push(field) }
  }
  // one level down, the declarations a group makes (`capabilities.mail`); a template's named refs are its arguments,
  // reached by traversal (`fieldOf`), not indexed as the library's
  for (const field of fields) for (const edge of valueOf(get, field.node, target)?.children ?? []) {
    const inner = fieldNode(get, edge as [string, string], target, alias)
    if (inner && inner.node === edge[0]) name(`${field.name}.${inner.name}`, inner.node)
  }
  return { byName, byNode, ambiguous }
}
