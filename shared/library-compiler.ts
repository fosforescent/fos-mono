/**
 * Compile a portable .fos graph: the standard library as the content a device's library ref is submitted.
 *
 * The library's `version` is the data version (`FOS_DATA_VERSION`, shared/version.ts), the same one its cids carry: a
 * source in another version is refused, so the library and the cid format cannot drift apart.
 *
 * Nothing here gives library nodes identities. The library's fields are its named rows (library-names.ts): `task`
 * is the node task rows have on their left. `refs` lists them by field path, so a build can find its own fields.
 */
import { hashContent, isCurrentCid, verifyCid } from './dag-implementation/cid'
import { FOS_DATA_VERSION } from './version'
import type { FosNodesData } from './types'
import { libraryNames } from './library-names'

export type LibrarySource = { version: string; rootNodeId: string; nodes: FosNodesData }
export type CompiledLibrary = LibrarySource & { refs: Record<string, string> }

export function compileLibrary(source: LibrarySource): CompiledLibrary {
  if (!source || !source.nodes || !source.nodes[source.rootNodeId]) throw new Error('Invalid .fos library graph.')
  if (source.version !== FOS_DATA_VERSION) throw new Error(`The library graph is in data version ${JSON.stringify(source.version)}, this build is ${FOS_DATA_VERSION}: export it again (fos . library export).`)
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
  // the ref constructors are primitives, `{ ["primitive", name] }` (sync/primitives.ts): content identities shared with every store
  const text = (value: string) => hashContent({ data: { scalar: { type: 'text', value } }, children: [] })
  const primitive = (name: string) => hashContent({ data: {}, children: [[text('primitive'), text(name)]] })
  const target = primitive('target'), alias = primitive('alias')
  // the names the library gives its nodes (refs in the graph; see library-names.ts)
  const names = libraryNames(cid => nodes[cid], source.rootNodeId, target, alias)
  if (names.ambiguous.size) throw new Error(`Ambiguous library fields: ${[...names.ambiguous].join(', ')}`)
  const refs = Object.fromEntries(names.byName)
  return { version: FOS_DATA_VERSION, rootNodeId: source.rootNodeId, nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))), refs }
}
