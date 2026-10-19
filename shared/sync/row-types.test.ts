/** Rows are made from the row types of the nearest standard library above them: shipped in every root, linked in Home. */
import { FosStore } from '../dag-implementation/store'
import { ROW_TYPE_SEED } from '../dag-implementation/row-templates'
import { HOME_ID, LIBRARY_ID, ROW_TYPES_ID, seedTypes, content, resolveScope, rowTemplate, rowTypeContents, rowTypeId, put, valueCidOf, valueContent } from './graph'
import { exchangeNode, nodeShape, templateNodesAt } from './node-sync'
import { acceptProvidedNode, type NodeAuthority, type NodeRequest } from './node-provider'
import { addRow, addTask, createReplica, ensureHomeContext, findTemplateByName, headCid, setRowContentAt, view, type Replica } from './replica'
import { LIBRARY_VERSION, ensureDeviceLibrary, exportLibraryRows, seedLibraryRows, seedStandardLibrary } from './library'

const typeAt = (r: Replica, library: string[], kind: Parameters<typeof rowTypeId>[0]) => valueCidOf(r.store, resolveScope(r.store, headCid(r), [...library, ROW_TYPES_ID, rowTypeId(kind)])!)
const edgeOf = (r: Replica, at: string[], id: string) => valueContent(r.store, resolveScope(r.store, headCid(r), at)!).children.find(e => content(r.store, e[1]).data.alias?.id === id)!
/** A library row at `at` whose Task type is named `name` (what a library looks like after members changed it). */
function withLibrary(r: Replica, at: string[], name: string): Replica {
  r = addRow(r, at, 'plain', 'Standard library', 1, { id: LIBRARY_ID })
  const types = seedTypes(r.store).map(t => t.data.instanceKind?.kind === 'task' ? { ...t, data: { ...t.data, description: { content: name } } } : t)
  return seedLibraryRows(r, [...at, LIBRARY_ID], [{ id: ROW_TYPES_ID, kind: 'types', text: 'Row types', types }], 2)
}

test('every root ships the standard library, and its rows are made from the Row types there', () => {
  const r = addTask(ensureHomeContext(createReplica('p'), 1), [], 'Write', 2, 'write')
  expect(view(r, [])!.tasks[0]).toMatchObject({ id: LIBRARY_ID, kind: 'plain', title: 'Standard library' })
  expect(view(r, [LIBRARY_ID, ROW_TYPES_ID])!.tasks.map(t => [t.id, t.kind])).toEqual(ROW_TYPE_SEED.map(t => [rowTypeId(t.kind), 'template']))
  expect(edgeOf(r, [], 'write')[0]).toBe(typeAt(r, [LIBRARY_ID], 'task'))
  // the seed is the library's first version: the same nodes in every root
  expect(typeAt(createReplica('other'), [LIBRARY_ID], 'task')).toBe(typeAt(r, [LIBRARY_ID], 'task'))
})

test('the nearest library wins: one linked in Home overrides the shipped one under Home, and any node can carry its own', () => {
  let r = withLibrary(ensureHomeContext(createReplica('p'), 1), [HOME_ID], 'To-do')
  r = addTask(r, [HOME_ID], 'In Home', 3, 'home-task')
  r = addTask(r, [], 'At the root', 4, 'root-task')
  const todo = typeAt(r, [HOME_ID, LIBRARY_ID], 'task')
  expect(valueContent(r.store, todo).data.description?.content).toBe('To-do')
  expect(edgeOf(r, [HOME_ID], 'home-task')[0]).toBe(todo)
  expect(edgeOf(r, [], 'root-task')[0]).toBe(typeAt(r, [LIBRARY_ID], 'task'))
  // deeper still: a project with its own library, for its subtree only
  r = addTask(r, [HOME_ID], 'Project', 5, 'project')
  r = withLibrary(r, [HOME_ID, 'project'], 'Ticket')
  r = addTask(r, [HOME_ID, 'project'], 'Bug', 6, 'bug')
  r = addTask(r, [HOME_ID], 'Elsewhere', 7, 'elsewhere')
  expect(valueContent(r.store, edgeOf(r, [HOME_ID, 'project'], 'bug')[0]).data.description?.content).toBe('Ticket')
  expect(edgeOf(r, [HOME_ID], 'elsewhere')[0]).toBe(todo)
})

test('a root with no library above a row makes no rows', () => {
  const r = createReplica('p', new FosStore())
  expect(() => rowTemplate(r.store, 'task')).toThrow(/No standard library/)
  expect(() => addTask(r, [], 'Nothing to make it from', 1, 'x')).toThrow(/No standard library/)
})

test('a changed row type makes the new rows; rows made before keep the version they were made from', () => {
  let r = withLibrary(ensureHomeContext(createReplica('p'), 1), [HOME_ID], 'Task')
  r = addTask(r, [HOME_ID], 'Before', 3, 'before')
  const before = edgeOf(r, [HOME_ID], 'before')[0]
  r = setRowContentAt(r, [HOME_ID, LIBRARY_ID, ROW_TYPES_ID], rowTypeId('task'), 'template', 'To-do', {}, 4)
  r = addTask(r, [HOME_ID], 'After', 5, 'after')
  const after = edgeOf(r, [HOME_ID], 'after')[0]
  expect(after).not.toBe(before)
  expect(valueContent(r.store, after).data).toMatchObject({ description: { content: 'To-do' }, instanceKind: { kind: 'task' }, behavior: { content: 'builtin:task' } })
  expect(edgeOf(r, [HOME_ID], 'before')[0]).toBe(before)
  expect(view(r, [HOME_ID])!.tasks.filter(t => ['before', 'after'].includes(t.id)).map(t => t.kind)).toEqual(['task', 'task'])
})

test('a peer on another version receives rows pinned to it as reference errors and asks for the type', () => {
  let server = ensureHomeContext(createReplica('server'), 1)
  const request: NodeRequest = { peerId: 'device', scope: [HOME_ID], path: [], linkId: 'device-link' }
  const authority: NodeAuthority = { peerId: 'device', scope: [HOME_ID], owner: true, capabilities: ['provideNode', 'sync'] }
  const first = exchangeNode(server, request, authority, 10); server = first.replica
  let client = acceptProvidedNode(ensureHomeContext(createReplica('device'), 1), [HOME_ID], request, first.node, 11)
  // a library in the device's Home with the Task type renamed: its new tasks there are made from it
  client = withLibrary(client, [HOME_ID], 'To-do')
  client = addTask(client, [HOME_ID], 'Pinned to To-do', 12, 'todo')
  const template = edgeOf(client, [HOME_ID], 'todo')[0]
  const pushed = exchangeNode(server, { ...request, update: { base: first.node, value: nodeShape(client, [HOME_ID]) } }, authority, 13); server = pushed.replica
  expect(pushed.node.wanted).toContain(template)
  const answered = exchangeNode(server, { ...request, templateNodes: templateNodesAt(client, [HOME_ID], pushed.node.wanted!)! }, authority, 14); server = answered.replica
  expect(answered.node.wanted ?? []).not.toContain(template)
  expect(edgeOf(server, [HOME_ID], 'todo')[0]).toBe(template)
})

test('templates resolve by nearest ancestor like every mutable ref', () => {
  let r = ensureHomeContext(createReplica('p'), 1)
  r = addRow(r, [HOME_ID], 'template', 'Trip', 2, { id: 'trip-home' })
  r = addTask(r, [HOME_ID], 'Team', 3, 'team')
  r = addRow(r, [HOME_ID, 'team'], 'template', 'Trip', 4, { id: 'trip-team' })
  expect(findTemplateByName(r, 'Trip', [HOME_ID, 'team'])!.row.id).toBe('trip-team')
  expect(findTemplateByName(r, 'Trip', [HOME_ID])!.row.id).toBe('trip-home')
})

test('the build bundle carries the Row types exactly, so a device that never synced makes the same rows', () => {
  let owner = ensureHomeContext(createReplica('user:owner'), 1)
  owner = addRow(owner, [HOME_ID], 'plain', 'Standard library', 1, { id: LIBRARY_ID })
  owner = seedStandardLibrary(owner, [HOME_ID, LIBRARY_ID], 2)
  owner = setRowContentAt(owner, [HOME_ID, LIBRARY_ID, ROW_TYPES_ID], rowTypeId('note'), 'template', 'Document', {}, 3)
  const bundle = { address: null, version: LIBRARY_VERSION, rows: exportLibraryRows(owner, [HOME_ID, LIBRARY_ID]) }
  let device = ensureDeviceLibrary(ensureHomeContext(createReplica('device'), 1), bundle, 4)
  const version = (r: Replica, at: string[]) => rowTypeContents(r.store, resolveScope(r.store, headCid(r), [...at, ROW_TYPES_ID])!).map(t => put(r.store, t))
  expect(version(device, [LIBRARY_ID])).toEqual(version(owner, [HOME_ID, LIBRARY_ID]))
  device = addRow(device, [], 'note', 'Doc', 5, { id: 'doc' })
  const owned = addRow(owner, [HOME_ID], 'note', 'Doc', 5, { id: 'doc' })
  expect(edgeOf(device, [], 'doc')[0]).toBe(edgeOf(owned, [HOME_ID], 'doc')[0])
})
