/**
 * Compile a portable .fos graph: the standard library as the content a device's library ref is submitted.
 *
 * The library's `version` is the data version (`FOS_DATA_VERSION`, shared/version.ts), the same one its cids carry: a
 * source in another version is refused, so the library and the cid format cannot drift apart.
 *
 * Nothing here gives library nodes identities. Names are refs in the graph: a ref named `lib:type:task` (its alias)
 * points at the node rows put on their left. `refs` lists them, by name, so a build can find its own refs.
 */
import { hashContent, isCurrentCid, verifyCid } from './dag-implementation/cid'
import { FOS_DATA_VERSION } from './version'
import type { FosNodesData } from './types'
import { libraryNames } from './library-names'

export type LibrarySource = { version: string; rootNodeId: string; nodes: FosNodesData }
export type CompiledLibrary = LibrarySource & { refs: Record<string, string> }

export function compileLibrary(source: LibrarySource): CompiledLibrary {
  if (!source || !source.nodes || !source.nodes[source.rootNodeId]) throw new Error('Invalid .fos library graph.')
  if (source.version !== FOS_DATA_VERSION) throw new Error(`The library graph is in data version ${JSON.stringify(source.version)}, this build is ${FOS_DATA_VERSION}: export it again (fos . library export --local).`)
  const nodes: FosNodesData = {}, visiting = new Set<string>()
  const visit = (cid: string) => {
    if (nodes[cid]) return
    if (visiting.has(cid)) throw new Error('The immutable library graph contains a cycle.')
    const node = source.nodes[cid]
    if (!node || !isCurrentCid(cid) || !verifyCid(cid, node)) throw new Error(`Invalid or missing library node ${cid}.`)
    if ('instanceKind' in node.data) throw new Error('Library definitions must not contain instanceKind.')
    if (node.data.behavior?.content?.startsWith('builtin:')) throw new Error('Library definitions must not name builtin behaviors.')
    visiting.add(cid)
    for (const [i, t] of node.children) { visit(i); visit(t) }
    visiting.delete(cid)
    nodes[cid] = node
  }
  visit(source.rootNodeId)
  // The native mutable-ref pointer has a stable content identity, shared with the store.
  const target = hashContent({ data: { description: { content: 'Target Constructor Node' } }, children: [] })
  // the names the library gives its nodes (refs in the graph; see library-names.ts)
  const refs = Object.fromEntries(libraryNames(cid => nodes[cid], source.rootNodeId, target).byName)
  return { version: FOS_DATA_VERSION, rootNodeId: source.rootNodeId, nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))), refs }
}
