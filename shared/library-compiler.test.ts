import * as sourceJson from '../.fos/library.json'
import * as generated from './sync/library.generated.json'
import { compileLibrary, type LibrarySource } from './library-compiler'
import { hashContent } from './dag-implementation/cid'
import { FOS_DATA_VERSION } from './version'
import type { FosNodeContent } from './types'
import { FosStore } from './dag-implementation/store'
import { addConstructedRow, createReplica, ensureDeviceLibrary, put, reachableNodes, refNodeContent, view, writeGraphNode, rowTypeAt, exportLocalLibrary, COMMENT_TYPE, TEMPLATE_TYPE, LIBRARY_ID } from './sync/index'

const source = sourceJson as unknown as LibrarySource

test('the bundled library is exactly the checked-in Fos graph, with no instance kinds or builtin behaviors', () => {
  const compiled = compileLibrary(source)
  expect(compiled).toEqual(generated)
  expect(Object.values(compiled.nodes).every(node => !('instanceKind' in node.data) && !node.data.behavior)).toBe(true)
  const r = createReplica('new')
  expect(Object.values(reachableNodes(r.store, [r.store.rootNodeId])).every(node => !('instanceKind' in node.data))).toBe(true)
})

test('a data-only definition edit changes constructed fields and UI projections', () => {
  const nodes: LibrarySource['nodes'] = {}, memo = new Map<string, string>()
  const rewrite = (cid: string): string => {
    if (memo.has(cid)) return memo.get(cid)!
    const old = source.nodes[cid]!
    let node: FosNodeContent = { data: old.data, children: old.children.map(([i, t]) => [rewrite(i), rewrite(t)]) }
    if (old.data.parameter?.name === 'body') node = { ...node, data: { ...node.data, description: { content: 'Message content' } } }
    const next = hashContent(node); nodes[next] = node; memo.set(cid, next); return next
  }
  const rootNodeId = rewrite(source.rootNodeId)
  const compiled = compileLibrary({ ...source, rootNodeId, nodes })
  // a device whose library ref holds the edited library: its comment is the edited node
  let r = ensureDeviceLibrary(createReplica('new', new FosStore()), { version: compiled.version, root: compiled.rootNodeId, nodes: compiled.nodes }, 1)
  const definition = compiled.refs['lib:type:comment']!
  expect(rowTypeAt(r.store, COMMENT_TYPE)).toBe(definition)
  r = addConstructedRow(r, [], definition, { text: 'From data', texts: ['One'] }, 1, 'message')
  const row = view(r, [])!.tasks.find(row => row.id === 'message')!
  expect(row.type).toBe(COMMENT_TYPE)
  expect(row.form?.fields.map(field => field.label)).toEqual(['Message content', 'Person', 'Texts'])
  expect(row.form?.fields[0]).toMatchObject({ primitive: 'text', value: 'From data' })
  expect(row.form?.fields[2]?.fields[0]).toMatchObject({ primitive: 'text', value: 'One' })
})

test('invalid or missing graph content fails compilation', () => {
  expect(() => compileLibrary({ ...source, nodes: {} })).toThrow()
  // the library is in the data version its cids are: another version is refused
  expect(() => compileLibrary({ ...source, version: '0.0.0' })).toThrow(/data version "0.0.0"/)
  expect(() => compileLibrary({ ...source, nodes: { ...source.nodes, [source.rootNodeId]: { data: {}, children: [] } } })).toThrow(/Invalid or missing/)
  const node: FosNodeContent = { data: { instanceKind: { kind: 'comment' } }, children: [] }
  const cid = hashContent(node)
  expect(() => compileLibrary({ version: FOS_DATA_VERSION, rootNodeId: cid, nodes: { [cid]: node } })).toThrow(/instanceKind/)
})

test('locally authored library rows export as buildable graph data: a named ref and the node it names', () => {
  let r = createReplica('author')
  // the definition carries no name; the ref in the library's rows names it
  const count = put(r.store, { data: { description: { content: 'Count' }, form: { primitive: 'number' } }, children: [] })
  const ref = (value: string) => refNodeContent(r.store, { alias: { id: 'lib:type:count' }, name: { content: 'lib:type:count' } }, value)
  r = writeGraphNode(r, [LIBRARY_ID], ref(count), 1, rowTypeAt(r.store, TEMPLATE_TYPE))
  // writing at the ref's path writes its value: the node it names
  r = writeGraphNode(r, [LIBRARY_ID, 'lib:type:count'], { data: { description: { content: 'Quantity' }, form: { primitive: 'number' } }, children: [] }, 2)
  const exported = compileLibrary(exportLocalLibrary(r))
  expect(exported.nodes[exported.refs['lib:type:count']!]!.data.description?.content).toBe('Quantity')
  expect(Object.values(exported.nodes).some(node => node.data.description?.content === 'Count')).toBe(false)
  const before = r.store.rootNodeId
  expect(() => writeGraphNode(r, [LIBRARY_ID, 'lib:type:count'], { data: {}, children: [['missing', 'missing']] }, 3)).toThrow(/CIDs/)
  expect(r.store.rootNodeId).toBe(before)
})
