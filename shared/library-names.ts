/**
 * The names a library value gives nodes. Names are refs in the graph; no node names itself. In the library's rows:
 *   [left, ref → value]   the ref's name names the value (`lib:type:task` → the node task rows have on their left)
 *   [left, ref]           a ref with no value is a declaration: its name names the left (a capability pattern, …)
 * Declarations also count one level down, in a group row's rows (`lib:capabilities`), after the library's own rows:
 * a node keeps the first name it is given. Refs inside left nodes are their fields, not names of the library.
 */
import type { FosNodeContent } from './types'

export type LibraryNames = { byName: Map<string, string>; byNode: Map<string, string> }

/** The names in the library value `root`; `get` reads a node (null when missing), `target` is the ref pointer constructor. */
export function libraryNames(get: (cid: string) => FosNodeContent | null | undefined, root: string, target: string): LibraryNames {
  const byName = new Map<string, string>(), byNode = new Map<string, string>()
  const pointer = (node: FosNodeContent) => node.children.find(([key]) => key === target)?.[1] ?? null
  const value = (cid: string): FosNodeContent | null => {
    let node = get(cid), hops = 0
    while (node && pointer(node) && hops++ < 16) node = get(pointer(node)!)
    return node ?? null
  }
  const name = (id: string, node: string) => {
    if (!byName.has(id)) byName.set(id, node)
    if (!byNode.has(node)) byNode.set(node, id)
  }
  const groups: string[] = []
  // a named ref: a `lib:` alias with its name (whether it points at a value or not: node exchange delivers every row
  // as a ref, so a pointer alone says nothing)
  const named = (node: FosNodeContent | null | undefined): node is FosNodeContent =>
    !!node?.data.alias?.id.startsWith('lib:') && !!node.data.name
  for (const [left, right] of value(root)?.children ?? []) {
    const ref = get(right)
    if (!named(ref)) { if (ref) groups.push(right); continue }
    const bound = pointer(ref)
    name(ref.data.alias!.id, bound ?? left)
  }
  for (const group of groups) for (const [left, right] of value(group)?.children ?? []) {
    const ref = get(right)
    if (named(ref) && !pointer(ref)) name(ref.data.alias!.id, left)
  }
  return { byName, byNode }
}
