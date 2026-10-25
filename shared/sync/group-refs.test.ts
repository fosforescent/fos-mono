import { textValue, textOf } from './index'
import { primitive } from './primitives'
import {
  addRef, addRefAt, addRow, addTask, compileRefGraph, content, copyNode, createReplica,
  discoverHandlers, headCid, libAt, loadReplica, primitiveRef, nodeTransportAt, offerNodeTransport,
  passRefAt, put, renameTask, resolveRefIdentity, resolveScope, serializeReplica, setRefValueAt,
  valueContent, view, nestScope, type NodeTransport
} from './index'

const at = (r: ReturnType<typeof createReplica>, path: string[]) => resolveScope(r.store, headCid(r), path)!
const leaf = (r: ReturnType<typeof createReplica>, value: string) => textValue(r.store, value)
function group() {
  let r = addTask(createReplica('alice'), [], 'Group', 1, 'group')
  r = addTask(r, ['group'], 'Alice participation', 2, 'alice')
  r = addTask(r, ['group'], 'Bob participation', 3, 'bob')
  return addTask(r, [], 'Other group', 4, 'other')
}

test('a sibling link declares the shared ref in the group, visible from both parents and nowhere outside', () => {
  let r = addTask(group(), ['group', 'alice'], 'Shared work', 5, 'work')
  expect(resolveRefIdentity(r, ['group', 'bob'], 'work').status).toBe('missing')
  r = addRef(r, ['group', 'bob'], 'work', 6)
  expect(resolveRefIdentity(r, ['group', 'alice'], 'work').locations[0]?.path).toEqual(['group', 'work'])
  expect(resolveRefIdentity(r, ['group', 'bob'], 'work').locations[0]?.path).toEqual(['group', 'work'])
  expect(resolveRefIdentity(r, ['other'], 'work').status).toBe('missing')
  expect(view(r, ['group', 'alice'])!.tasks[0]!.refId).toBe('work')
  expect(discoverHandlers(r, ['group', 'bob']).some(offer => offer.id === 'work')).toBe(true)
  const link = view(r, ['group', 'bob'])!.tasks[0]!
  r = renameTask(r, ['group'], 'work', 'Updated work', 7)
  const compiled = compileRefGraph(r, at(r, ['group', 'bob', link.id]), ['group', 'bob', link.id])
  expect(compiled.complete).toBe(true)
  expect(textOf(r.store, compiled.cid)).toBe('Updated work')
  const loaded = loadReplica(serializeReplica(r))
  expect(resolveRefIdentity(loaded, ['group', 'bob'], 'work').locations[0]?.path).toEqual(['group', 'work'])
})

test('linking refuses to capture private dependencies; copying closes them without changing their source', () => {
  let r = group()
  r = addRefAt(r, ['group', 'alice'], 'secret', primitive(r.store, 'string'), 5, leaf(r, 'Private value'), 'secret')
  r = addRow(r, ['group', 'alice'], 'plain', '.secret', 6, { id: 'dependent' })
  const before = headCid(r)
  expect(() => addRef(r, ['group', 'bob'], 'dependent', 7)).toThrow(/dependencies.*shared scope/)
  expect(headCid(r)).toBe(before)
  r = copyNode(r, ['group', 'alice'], 'dependent', ['group'], { into: 'bob' }, 8)
  const copy = view(r, ['group', 'bob'])!.tasks[0]!
  expect(copy.title).toBe('Private value')
  expect(content(r.store, at(r, ['group', 'bob', copy.id])).data.refExpression).toBeUndefined()
  r = setRefValueAt(r, ['group', 'alice', 'secret'], leaf(r, 'Changed later'), 9)
  expect(view(r, ['group', 'bob'])!.tasks[0]!.title).toBe('Private value')
  expect(resolveRefIdentity(r, ['group', 'bob'], 'secret').status).toBe('missing')
})

test('passing an outer ref creates an ordinary local declaration whose handler can be overridden locally', () => {
  let r = group(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'outside', type, 5, leaf(r, 'Outer'), 'outside')
  r = passRefAt(r, ['group'], 'shared', 'outside', 6, 'shared')
  r = passRefAt(r, ['group', 'alice'], 'local', 'shared', 7, 'local')
  r = setRefValueAt(r, ['group', 'alice', 'local'], leaf(r, 'Alice'), 8)
  expect(compileRefGraph(r, at(r, ['group', 'alice', 'local']), ['group', 'alice', 'local']).complete).toBe(true)
  expect(valueContent(r.store, at(r, ['group', 'shared'])).data.ref?.id).toBe('outside')
  r = setRefValueAt(r, ['outside'], leaf(r, 'Outer updated'), 9)
  const compiled = (path: string[]) => content(r.store, compileRefGraph(r, at(r, path), path, { selected: true }).cid).data.description?.content
  expect(compiled(['group', 'shared'])).toBe('Outer updated')
  expect(compiled(['group', 'alice', 'local'])).toBe('Alice')
  expect(resolveRefIdentity(r, ['group', 'bob'], 'local').status).toBe('missing')
  expect(() => passRefAt(r, ['other'], 'escape', 'shared', 9)).toThrow(/enclosing scope/)
})

test('copying an enclosing store binding preserves its declaration scope and closes the value', () => {
  let outer = group(), type = primitive(outer.store, 'string')
  outer = addRefAt(outer, ['group'], 'outer-value', type, 5, leaf(outer, 'Outer'), 'value')
  outer = addRefAt(outer, ['group'], 'source', type, 6, put(outer.store, { data: { refExpression: { up: 0, path: ['value'], lexical: true } }, children: [] }), 'source')
  let inner = createReplica()
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: ['group'] })
  inner = addRefAt(inner, [], 'inner-value', type, 7, leaf(inner, 'Inner'), 'value')
  inner = addRow(inner, [], 'plain', '..source', 8, { id: 'reference' })
  inner = copyNode(inner, [], 'reference', [], { relativeTo: 'reference', position: 'below' }, 9)
  expect(view(inner, [])!.tasks.find(row => row.id !== 'reference' && row.title === 'Outer')).toBeDefined()
})

test('a receiver supplies a message transport to the same group ref using an ordinary handler assignment', async () => {
  let sender = group(), type = libAt(sender.store, ['group']).capabilities.provideNode!
  sender = addRefAt(sender, ['group'], 'shared-node', type, 5, null, 'shared node')
  let receiver = loadReplica(serializeReplica(sender))
  expect(nodeTransportAt(receiver, ['group', 'bob'], 'alice')).toBeNull()
  const calls: string[] = []
  const transport: NodeTransport = { capabilities: ['provideNode'], available: () => true, attachment: () => ['group'],
    request: async request => { calls.push(request.path.join('/')); return { peerId: 'alice' } as never } }
  const handler = primitiveRef(receiver.store, 'alice', { id: 'forward', capability: () => type }, { provideNode: transport }, ['group'])
  receiver = setRefValueAt(receiver, ['group', 'shared-node'], handler, 6)
  const provider = nodeTransportAt(receiver, ['group', 'bob'], 'alice')!
  await provider.request({ peerId: 'bob', scope: ['group'], path: ['group', 'work'], linkId: 'link' })
  expect(calls).toEqual(['group/work'])
  expect(nodeTransportAt(receiver, ['other'], 'alice')).toBeNull()
  expect(nodeTransportAt(sender, ['group', 'bob'], 'alice')).toBeNull()
})

test('transport offers are scoped and competing available handlers require a choice', () => {
  const transport = (): NodeTransport => ({ capabilities: ['provideNode'], available: () => true, attachment: () => [], request: async () => ({ peerId: 'remote' } as never) })
  let r = offerNodeTransport(group(), 'remote', transport(), 5, ['group'])
  expect(nodeTransportAt(r, ['group', 'alice'], 'remote')).not.toBeNull()
  expect(nodeTransportAt(r, ['other'], 'remote')).toBeNull()
  const type = libAt(r.store, ['group']).capabilities.provideNode!
  const other = primitiveRef(r.store, 'remote', { id: 'another', capability: () => type }, { provideNode: transport() }, ['group'])
  r = addRefAt(r, ['group'], 'another-route', type, 6, other)
  expect(() => nodeTransportAt(r, ['group', 'bob'], 'remote')).toThrow(/Choose/)
})

test('a nearer direct declaration shadows the same member offer identity, including when unfilled', () => {
  const transport: NodeTransport = { capabilities: ['provideNode'], available: () => true, attachment: () => [], request: async () => ({ peerId: 'remote' } as never) }
  let r = offerNodeTransport(group(), 'remote', transport, 5, ['group'])
  const outer = discoverHandlers(r, ['group']).find(offer => offer.peerId === 'remote')!
  r = addRefAt(r, ['group', 'alice'], outer.id, outer.type, 6)
  expect(nodeTransportAt(r, ['group', 'alice'], 'remote')).toBeNull()
  expect(nodeTransportAt(r, ['group', 'bob'], 'remote')).not.toBeNull()
  expect(nodeTransportAt(r, ['group'], 'remote')).not.toBeNull()
})
