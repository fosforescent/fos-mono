import { primitive } from './primitives'
import { createReplica, ensureHomeContext, shareHome, addRefAt, HOME_ID, put, refValueCid, content, resolveScope, headCid, argumentRefs, proposeRefAt, applyProposalAt, nodeShape, provideNode, SERVER_TRANSPORT_CAPABILITIES, writeNodeValue, addMemberAt, setNodeLinkMask, readNodeValue, type Replica, textValue, textOf } from './index'
import { syncWith } from './test-helpers'
import { acceptProvidedNode, resolveRefExpression, readGraphValue, bindingProperties } from './index'
import { addRow, updateAtScope, commitRoot, valueContent, acceptsChild, rowTypeAt, isRowOfType, PATTERN_TYPE } from './index'

const device = (id: string) => shareHome(ensureHomeContext(createReplica(id), 0))
const argument = (r: Replica, id: string) => content(r.store, resolveScope(r.store, headCid(r), [HOME_ID, id])!)

test('immutable graph constraints survive shallow loading and respect the child mask', () => {
  const source = device('source'), s = source.store
  const key = primitive(s, 'name')
  const literal = put(s, { data: { scalar: { type: 'text', value: 'literal constraint' } }, children: [] })
  commitRoot(s, updateAtScope(s, headCid(source), [HOME_ID], node => ({ ...node, children: [...node.children, [key, literal]] })), 1)
  const request = { peerId: 'receiver', scope: [HOME_ID], path: [] as string[], linkId: 'literal-load' }
  const authority = { peerId: 'receiver', scope: [HOME_ID], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const provided = provideNode(source, request, authority, 2).node
  const pinned = provided.children.find(child => child.pinned === literal)!
  expect(pinned).toBeDefined()
  const receiver = acceptProvidedNode(device('receiver'), [HOME_ID], request, provided, 3)
  expect(valueContent(receiver.store, resolveScope(receiver.store, headCid(receiver), [HOME_ID])!).children).toContainEqual([key, literal])
  const masked = setNodeLinkMask(source, [HOME_ID], 'receiver', 'literal-load', { children: [] }, 4)
  const hidden = provideNode(masked, request, authority, 5).node
  expect(hidden.children).toEqual([])
  expect(JSON.stringify(hidden.templates ?? {})).not.toContain('literal constraint')
  const mutable = put(receiver.store, { data: { alias: { id: 'private' } }, children: [] })
  expect(() => acceptProvidedNode(receiver, [HOME_ID], request, { ...provided, children: [{ ...pinned, pinned: mutable }] }, 6)).toThrow('immutable edge')
})

test('template placement predicates remain complete after node-by-node exchange', () => {
  const source = addRow(device('source'), [HOME_ID], 'template', 'Scoped workflow', 1, { id: 'workflow' })
  const account = device('account')
  syncWith(source, account, { now: 2 })
  const receiver = syncWith(device('receiver'), account, { now: 3 })
  const original = resolveScope(source.store, headCid(source), [HOME_ID, 'workflow'])!
  const loaded = resolveScope(receiver.store, headCid(receiver), [HOME_ID, 'workflow'])!
  const policies = (r: Replica, cid: string) => valueContent(r.store, cid).children.filter(edge => isRowOfType(r.store, edge, PATTERN_TYPE)).map(([, right]) => valueContent(r.store, right).children)
  expect(policies(receiver, loaded)).toEqual(policies(source, original))
  expect(policies(receiver, loaded).length).toBeGreaterThan(0)
  const instruction = put(receiver.store, valueContent(receiver.store, loaded))
  const value = put(receiver.store, { data: { alias: { id: 'child' } }, children: [] })
  expect(acceptsChild(receiver.store, instruction, [rowTypeAt(receiver.store, 'home'), value])).toBe(false)
  expect(acceptsChild(receiver.store, instruction, [rowTypeAt(receiver.store, 'task'), value])).toBe(true)
})

test('loading a binding on demand preserves its type and name on the receiving node', () => {
  const source = writeNodeValue(device('source'), [HOME_ID], 'settings', { text: 'bound text' }, 1)
  let receiver = device('receiver')
  const request = { peerId: 'receiver', scope: [HOME_ID], path: [] as string[], linkId: 'parent' }
  const authority = { peerId: 'receiver', scope: [HOME_ID], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const parent = provideNode(source, request, authority, 2).node
  receiver = acceptProvidedNode(receiver, [HOME_ID], request, parent, 3)
  const child = parent.children.find(c => c.right?.name === 'settings')!
  const input = { ...request, path: [child.id], linkId: 'value' }
  const record = provideNode(source, input, authority, 4).node
  receiver = acceptProvidedNode(receiver, [HOME_ID, child.id], input, record, 5)
  expect(readNodeValue(receiver, [HOME_ID], 'settings')).toBeNull()
  const field = record.children[0]!
  expect(field.right).toEqual({ name: 'text', bound: true })
  const fieldRequest = { ...request, path: [child.id, field.id], linkId: 'text' }
  receiver = acceptProvidedNode(receiver, [HOME_ID, child.id, field.id], fieldRequest, provideNode(source, fieldRequest, authority, 6).node, 7)
  expect(argumentRefs(receiver.store, resolveScope(receiver.store, headCid(receiver), [HOME_ID])!).find(arg => arg.name === 'settings')?.type).toBe(child.template)
  expect(readNodeValue(receiver, [HOME_ID], 'settings')).toEqual({ text: 'bound text' })
  const property = resolveRefExpression(receiver, [HOME_ID], '.settings.text')
  expect(property.status).toBe('ready')
  expect(readGraphValue(receiver.store, property.locations[0]!.cid)).toBe('bound text')
  const binding = resolveScope(receiver.store, headCid(receiver), [HOME_ID, child.id])!
  expect(bindingProperties({ store: receiver.store, cid: binding, path: [HOME_ID, child.id] }).bindings.map(ref => ref.name)).toEqual(['text'])
})
test('unbound and bound row arguments retain their identity, names, types and values through account exchange', () => {
  const account = ensureHomeContext(createReplica('user:alice'), 0)
  let a = device('a'), b = device('b')
  const type = primitive(a.store, 'string')
  a = addRefAt(a, [HOME_ID], 'input', type, 1, null, 'input')
  a = syncWith(a, account, { now: 2 }); b = syncWith(b, account, { now: 3 })
  expect(refValueCid(b.store, argument(b, 'input'))).toBeNull()
  expect(argument(b, 'input').data.name?.content).toBe('input')
  const value = textValue(b.store, 'phone text')
  const proposal = proposeRefAt(b, [HOME_ID, 'input'], value, 'b', 4)
  b = applyProposalAt(proposal.replica, [HOME_ID, 'input'], proposal.proposalCid, 'b', 4)
  b = syncWith(b, account, { now: 5 }); a = syncWith(a, account, { now: 6 })
  const target = refValueCid(a.store, argument(a, 'input'))!
  expect(textOf(a.store, target)).toBe('phone text')
  expect(argumentRefs(a.store, resolveScope(a.store, headCid(a), [HOME_ID])!).find(arg => arg.name === 'input')?.type).toBe(type)
  expect(nodeShape(a, [HOME_ID]).children.find(child => child.id === 'input')?.right).toEqual({ name: 'input', bound: true })
})

test('argument values remain shallow, masked and independent of their private history', () => {
  let r = device('owner')
  r = writeNodeValue(r, [HOME_ID], 'settings', { text: 'old private value' }, 1)
  r = writeNodeValue(r, [HOME_ID], 'settings', { text: 'current visible value' }, 2)
  r = addMemberAt(r, [HOME_ID], 'guest', 'Guest', ['read'], 3)
  const authority = { peerId: 'guest', scope: [HOME_ID], capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const root = provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [], linkId: 'guest' }, authority, 4).node
  const child = root.children.find(c => c.right?.name === 'settings')!
  expect(child).toBeDefined()
  expect(JSON.stringify(root)).not.toContain('current visible value')
  const loaded = provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [child.id], linkId: 'settings' }, authority, 5).node
  expect(JSON.stringify(loaded)).not.toContain('current visible value')
  const field = loaded.children[0]!
  const leaf = provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [child.id, field.id], linkId: 'text' }, authority, 5).node
  expect(leaf.data.scalar?.value).toBe('current visible value')
  expect(JSON.stringify(leaf)).not.toContain('old private value')
  expect(JSON.stringify(loaded)).not.toContain('old private value')
  r = setNodeLinkMask(r, [HOME_ID], 'guest', 'guest', { children: [] }, 6)
  expect(() => provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [child.id], linkId: 'settings' }, authority, 7)).toThrow()
  expect(readNodeValue(r, [HOME_ID], 'settings')).toEqual({ text: 'current visible value' })
})
