import { createReplica, ensureHomeContext, shareHome, addRefAt, HOME_ID, put, refValueCid, content, resolveScope, headCid, argumentRefs, proposeRefAt, applyProposalAt, nodeShape, provideNode, SERVER_TRANSPORT_CAPABILITIES, writeNodeValue, addMemberAt, setNodeLinkMask, readNodeValue, type Replica } from './index'
import { syncWith } from './test-helpers'
import { acceptProvidedNode, refTypeCid } from './index'

const device = (id: string) => shareHome(ensureHomeContext(createReplica(id), 0))
const argument = (r: Replica, id: string) => content(r.store, resolveScope(r.store, headCid(r), [HOME_ID, id])!)

test('loading a binding on demand preserves its type and name on the receiving node', () => {
  const source = writeNodeValue(device('source'), [HOME_ID], 'settings', { text: 'bound text' }, 1)
  let receiver = device('receiver')
  const request = { peerId: 'receiver', scope: [HOME_ID], path: [] as string[], linkId: 'parent' }
  const authority = { peerId: 'receiver', scope: [HOME_ID], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const parent = provideNode(source, request, authority, 2).node
  receiver = acceptProvidedNode(receiver, [HOME_ID], request, parent, 3)
  const child = parent.children.find(c => c.argument?.name === 'settings')!
  const input = { ...request, path: [child.id], linkId: 'value' }
  receiver = acceptProvidedNode(receiver, [HOME_ID, child.id], input, provideNode(source, input, authority, 4).node, 5)
  expect(refTypeCid(receiver.store, argument(receiver, child.id))).toBe(child.template)
  expect(readNodeValue(receiver, [HOME_ID], 'settings')).toEqual({ text: 'bound text' })
})
test('unbound and bound argument slots retain their identity, names, types and values through account exchange', () => {
  const account = ensureHomeContext(createReplica('user:alice'), 0)
  let a = device('a'), b = device('b')
  const type = a.store.primitive.documentField.getId()
  a = addRefAt(a, [HOME_ID], 'input', type, 1, null, 'input')
  a = syncWith(a, account, { now: 2 }); b = syncWith(b, account, { now: 3 })
  expect(refValueCid(b.store, argument(b, 'input'))).toBeNull()
  expect(argument(b, 'input').data.name?.content).toBe('input')
  const value = put(b.store, { data: { description: { content: 'phone text' } }, children: [] })
  const proposal = proposeRefAt(b, [HOME_ID, 'input'], value, 'b', 4)
  b = applyProposalAt(proposal.replica, [HOME_ID, 'input'], proposal.proposalCid, 'b', 4)
  b = syncWith(b, account, { now: 5 }); a = syncWith(a, account, { now: 6 })
  const target = refValueCid(a.store, argument(a, 'input'))!
  expect(content(a.store, target).data.description?.content).toBe('phone text')
  expect(argumentRefs(a.store, resolveScope(a.store, headCid(a), [HOME_ID])!).find(arg => arg.name === 'input')?.type).toBe(type)
  expect(nodeShape(a, [HOME_ID]).children.find(child => child.id === 'input')?.argument).toEqual({ name: 'input', bound: true })
})

test('argument values remain shallow, masked and independent of their private history', () => {
  let r = device('owner')
  r = writeNodeValue(r, [HOME_ID], 'settings', { text: 'old private value' }, 1)
  r = writeNodeValue(r, [HOME_ID], 'settings', { text: 'current visible value' }, 2)
  r = addMemberAt(r, [HOME_ID], 'guest', 'Guest', ['read'], 3)
  const authority = { peerId: 'guest', scope: [HOME_ID], capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const root = provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [], linkId: 'guest' }, authority, 4).node
  const child = root.children.find(c => c.argument?.name === 'settings')!
  expect(child).toBeDefined()
  expect(JSON.stringify(root)).not.toContain('current visible value')
  const loaded = provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [child.id], linkId: 'settings' }, authority, 5).node
  expect(JSON.stringify(loaded)).toContain('current visible value')
  expect(JSON.stringify(loaded)).not.toContain('old private value')
  r = setNodeLinkMask(r, [HOME_ID], 'guest', 'guest', { children: [] }, 6)
  expect(() => provideNode(r, { peerId: 'guest', scope: [HOME_ID], path: [child.id], linkId: 'settings' }, authority, 7)).toThrow()
  expect(readNodeValue(r, [HOME_ID], 'settings')).toEqual({ text: 'current visible value' })
})
