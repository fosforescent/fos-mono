/** Compile a portable .fos graph. No type definitions or application templates live in this module. */
import { hashContent, isCurrentCid, verifyCid } from './dag-implementation/cid'
import type { FosNodeContent, FosNodesData, FosPathElem } from './types'

export type LibrarySource = { version: number; rootNodeId: string; nodes: FosNodesData }
export type CompiledLibraryRow = { id: string; kind: string; text: string; graph: { template: string; cid: string }; children?: CompiledLibraryRow[] }

export function compileLibrary(source: LibrarySource) {
  if (!source || !Number.isInteger(source.version) || !source.nodes || !source.nodes[source.rootNodeId]) throw new Error('Invalid .fos library graph.')
  const nodes: FosNodesData = {}, visiting = new Set<string>()
  const visit = (cid: string) => {
    if (nodes[cid]) return
    if (visiting.has(cid)) throw new Error('The immutable library graph contains a cycle.')
    const node = source.nodes[cid]
    if (!node || !isCurrentCid(cid) || !verifyCid(cid, node)) throw new Error(`Invalid or missing library node ${cid}.`)
    if ('instanceKind' in node.data) throw new Error('Library definitions must not contain instanceKind.')
    visiting.add(cid)
    for (const [i, t] of node.children) { visit(i); visit(t) }
    visiting.delete(cid)
    nodes[cid] = node
  }
  visit(source.rootNodeId)
  // The native mutable-ref pointer has a stable content identity, shared with the store.
  const target = hashContent({ data: { description: { content: 'Target Constructor Node' } }, children: [] })
  const value = (cid: string): FosNodeContent => {
    const node = nodes[cid]!
    const pointer = node.children.find(([i]) => i === target)
    return pointer ? value(pointer[1]) : node
  }
  const root = value(source.rootNodeId)
  const group = root.children.find(([, cid]) => nodes[cid]!.data.alias?.id === 'lib:types')
  if (!group) throw new Error('The library has no lib:types row.')
  const types = value(group[1]).children.map(([, cid]) => value(cid))
  if (types.some(type => !type.data.alias?.id)) throw new Error('Library definitions need graph identities.')
  const row = ([template, cid]: FosPathElem): CompiledLibraryRow | null => {
    const identity = nodes[cid]!, node = value(cid), instruction = value(template)
    const id = identity.data.alias?.id ?? node.data.alias?.id
    if (!id) return null
    const kind = id === 'lib:types' ? 'types' : instruction.data.form ? 'plain' : instruction.data.behavior?.content?.replace(/^builtin:/, '')
    if (!kind || kind === 'pattern') return null
    const children = node.children.map(row).filter((r): r is CompiledLibraryRow => !!r)
    return { id, kind, text: node.data.description?.content ?? '', graph: { template, cid }, ...(children.length ? { children } : {}) }
  }
  const rows = root.children.map(row).filter((r): r is CompiledLibraryRow => !!r)
  return { version: source.version, rootNodeId: source.rootNodeId, nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))), types, rows }
}
