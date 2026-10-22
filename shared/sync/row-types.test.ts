/** Rows are made from the nodes the nearest standard library ref names: shipped in every device root, linked in Home. */
import { FosStore } from '../dag-implementation/store'
import { HOME_ID, LIBRARY_ID, content, namesInLibrary, readProposals, put, refNodeContent, resolveScope, rowTypeAt, typeIdOf, valueCidOf, valueContent } from './graph'
import { exchangeNode, nodeShape, templateNodesAt } from './node-sync'
import { acceptProvidedNode, type NodeAuthority, type NodeRequest } from './node-provider'
import { addRefAt, addRow, addTask, applyProposalAt, createReplica, ensureHomeContext, findTemplateByName, headCid, proposeRefAt, view, type Replica } from './replica'
import { BUILD_PEER, ensureDeviceLibrary, exportLibrary, submitLibrary } from './library'
import { NOTE_TYPE, TASK_TYPE, TEMPLATE_TYPE } from './library-types'

/** The node the library ref at `library` names `name`. */
const named = (r: Replica, library: string[], name: string) => namesInLibrary(r.store, valueCidOf(r.store, resolveScope(r.store, headCid(r), library)!)).byName.get(name)!
const edgeOf = (r: Replica, at: string[], id: string) => valueContent(r.store, resolveScope(r.store, headCid(r), at)!).children.find(e => content(r.store, e[1]).data.alias?.id === id)!
/** The library value `library` (a ref's path) with the node its ref `name` points at replaced by one titled `title`. */
function renamed(r: Replica, library: string[], name: string, title: string): string {
  const store = r.store, value = valueCidOf(store, resolveScope(store, headCid(r), library)!)
  return put(store, { ...content(store, value), children: content(store, value).children.map(edge => {
    const ref = content(store, edge[1])
    if (ref.data.alias?.id !== name) return edge
    const node = put(store, { ...valueContent(store, edge[1]), data: { ...valueContent(store, edge[1]).data, description: { content: title } } })
    return [edge[0], put(store, refNodeContent(store, ref.data, node))] as [string, string]
  }) })
}
/** A library ref at `at` whose task is titled `title` (what a library looks like after its members changed it). */
function withLibrary(r: Replica, at: string[], title: string): Replica {
  return addRefAt(r, at, LIBRARY_ID, put(r.store, { data: {}, children: [] }), 1, renamed(r, [LIBRARY_ID], TASK_TYPE, title))
}

test('every device root has the standard library ref, and its rows are made from the nodes it names', () => {
  const r = addTask(ensureHomeContext(createReplica('p'), 1), [], 'Write', 2, 'write')
  const library = content(r.store, resolveScope(r.store, headCid(r), [LIBRARY_ID])!)
  expect(library.data.alias).toEqual({ id: LIBRARY_ID })
  expect(edgeOf(r, [], 'write')[0]).toBe(named(r, [LIBRARY_ID], TASK_TYPE))
  // the name is the ref's: the node it names carries none
  expect(content(r.store, named(r, [LIBRARY_ID], TASK_TYPE)).data.alias).toBeUndefined()
  expect(typeIdOf(r.store, named(r, [LIBRARY_ID], TASK_TYPE))).toBe(TASK_TYPE)
  // the build's library is the first value: the same nodes in every root
  expect(named(createReplica('other'), [LIBRARY_ID], TASK_TYPE)).toBe(named(r, [LIBRARY_ID], TASK_TYPE))
})

test('the nearest library wins: one linked in Home overrides the shipped one under Home, and any node can carry its own', () => {
  let r = withLibrary(ensureHomeContext(createReplica('p'), 1), [HOME_ID], 'To-do')
  r = addTask(r, [HOME_ID], 'In Home', 3, 'home-task')
  r = addTask(r, [], 'At the root', 4, 'root-task')
  const todo = named(r, [HOME_ID, LIBRARY_ID], TASK_TYPE)
  expect(valueContent(r.store, todo).data.description?.content).toBe('To-do')
  expect(edgeOf(r, [HOME_ID], 'home-task')[0]).toBe(todo)
  expect(edgeOf(r, [], 'root-task')[0]).toBe(named(r, [LIBRARY_ID], TASK_TYPE))
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
  expect(() => rowTypeAt(r.store, TASK_TYPE)).toThrow(/No standard library/)
  expect(() => addTask(r, [], 'Nothing to make it from', 1, 'x')).toThrow(/No standard library/)
})

test('a library value the members accept makes the new rows; rows made before keep the node they were made from', () => {
  let r = ensureHomeContext(createReplica('p'), 1)
  r = addTask(r, [HOME_ID], 'Before', 3, 'before')
  const before = edgeOf(r, [HOME_ID], 'before')[0]
  const submitted = proposeRefAt(r, [LIBRARY_ID], renamed(r, [LIBRARY_ID], TASK_TYPE, 'To-do'), 'member', 4, 'binding:member')
  r = applyProposalAt(submitted.replica, [LIBRARY_ID], submitted.proposalCid, r.meta.peerId, 4)
  r = addTask(r, [HOME_ID], 'After', 5, 'after')
  const after = edgeOf(r, [HOME_ID], 'after')[0]
  expect(after).not.toBe(before)
  expect(valueContent(r.store, after).data).toMatchObject({ description: { content: 'To-do' } })
  expect(edgeOf(r, [HOME_ID], 'before')[0]).toBe(before)
  // both are task: the library ref names the earlier node too (its other value)
  expect(view(r, [HOME_ID])!.tasks.filter(t => ['before', 'after'].includes(t.id)).map(t => t.type)).toEqual([TASK_TYPE, TASK_TYPE])
})

test('a later build ships its library as a submission: a library that has a value keeps it, the build is an option', () => {
  let r = createReplica('p')
  const current = valueCidOf(r.store, resolveScope(r.store, headCid(r), [LIBRARY_ID])!)
  const later = renamed(r, [LIBRARY_ID], TASK_TYPE, 'Chore')
  r = submitLibrary(r, [LIBRARY_ID], { address: null, version: '0.0.2', root: later, nodes: {} }, BUILD_PEER, 2)
  expect(valueCidOf(r.store, resolveScope(r.store, headCid(r), [LIBRARY_ID])!)).toBe(current)
  expect(readProposals(r.store, content(r.store, resolveScope(r.store, headCid(r), [LIBRARY_ID])!)).some(p => p.peerId === BUILD_PEER)).toBe(true)
})

test('a peer on another version receives rows pinned to it as reference errors and asks for the node', () => {
  let server = ensureHomeContext(createReplica('server'), 1)
  const request: NodeRequest = { peerId: 'device', scope: [HOME_ID], path: [], linkId: 'device-link' }
  const authority: NodeAuthority = { peerId: 'device', scope: [HOME_ID], owner: true, capabilities: ['provideNode', 'sync'] }
  const first = exchangeNode(server, request, authority, 10); server = first.replica
  let client = acceptProvidedNode(ensureHomeContext(createReplica('device'), 1), [HOME_ID], request, first.node, 11)
  // a library in the device's Home with task renamed: its new tasks there are made from it
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
  r = addRow(r, [HOME_ID], TEMPLATE_TYPE, 'Trip', 2, { id: 'trip-home' })
  r = addTask(r, [HOME_ID], 'Team', 3, 'team')
  r = addRow(r, [HOME_ID, 'team'], TEMPLATE_TYPE, 'Trip', 4, { id: 'trip-team' })
  expect(findTemplateByName(r, 'Trip', [HOME_ID, 'team'])!.row.id).toBe('trip-team')
  expect(findTemplateByName(r, 'Trip', [HOME_ID])!.row.id).toBe('trip-home')
})

test('an exported library is a submission another device takes as it is, so it makes the same rows', () => {
  let owner = createReplica('user:owner')
  const submitted = proposeRefAt(owner, [LIBRARY_ID], renamed(owner, [LIBRARY_ID], NOTE_TYPE, 'Document'), 'member', 2, 'binding:member')
  owner = applyProposalAt(submitted.replica, [LIBRARY_ID], submitted.proposalCid, owner.meta.peerId, 2)
  const bundle = exportLibrary(owner, [LIBRARY_ID])
  // a device that never synced takes the bundle as its first library value
  const fresh = new FosStore()
  let device = createReplica('device', fresh)
  device = ensureDeviceLibrary(device, bundle, 4)
  expect(named(device, [LIBRARY_ID], NOTE_TYPE)).toBe(named(owner, [LIBRARY_ID], NOTE_TYPE))
  device = addRow(device, [], NOTE_TYPE, 'Doc', 5, { id: 'doc' })
  owner = addRow(owner, [], NOTE_TYPE, 'Doc', 5, { id: 'doc' })
  expect(edgeOf(device, [], 'doc')[0]).toBe(edgeOf(owner, [], 'doc')[0])
})
