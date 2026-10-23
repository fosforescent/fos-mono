/**
 * A peer is reached like any capability: its connection is the native of its `provideNode` offer on its row, and what
 * reaches it from a node is that offer found by scope search (`nodeTransportAt`), not a choice made from its id.
 */
import { setMemberCapabilitiesAt, membershipPathAt, nodeShape, addTask, createReplica, discoverHandlers, handlerOfferId, nodeTransportAt, offerNodeTransport, setHandlerEnabledAt, type NodeTransport, type ProvidedNode } from './index'

const transport = (calls: string[], available = () => true): NodeTransport => ({
  capabilities: ['provideNode'], available, attachment: () => [],
  request: async request => { calls.push(request.path.join('/')); return { peerId: 'host' } as unknown as ProvidedNode },
})

test('a peer\'s transport is its provideNode offer, found in scope like any handler', async () => {
  const calls: string[] = []
  let r = addTask(createReplica('device'), [], 'Project', 1, 'project')
  expect(nodeTransportAt(r, ['project'], 'host')).toBeNull()
  r = offerNodeTransport(r, 'host', transport(calls), 2)
  // offered once: offering again only gives it its local meaning
  expect(offerNodeTransport(r, 'host', transport(calls), 3)).toBe(r)
  expect(discoverHandlers(r, ['project']).filter(o => o.peerId === 'host')).toHaveLength(1)
  await nodeTransportAt(r, ['project'], 'host')!.request({ peerId: 'device', scope: [], path: ['project'], linkId: 'x' })
  expect(calls).toEqual(['project'])
  // another peer has no transport of its own here
  expect(nodeTransportAt(r, ['project'], 'other')).toBeNull()
})

test('an unavailable connection or a switched-off offer reaches nothing', () => {
  let online = false
  let r = offerNodeTransport(createReplica('device'), 'host', transport([], () => online), 1)
  expect(nodeTransportAt(r, [], 'host')).toBeNull()
  online = true
  expect(nodeTransportAt(r, [], 'host')).not.toBeNull()
  r = setHandlerEnabledAt(r, [], 'host', handlerOfferId('host', 'provideNode'), false, 2)
  expect(nodeTransportAt(r, [], 'host')).toBeNull()
})

test('a transport is this device\'s connection to its peer: node exchange never carries it', () => {
  let r = offerNodeTransport(createReplica('device'), 'host', transport([]), 1)
  expect(nodeShape(r, []).children.some(child => child.peer === 'host')).toBe(false)
  // in a membership that is exchanged, its grants travel and the transport stays behind
  r = setMemberCapabilitiesAt(r, [], 'host', ['read'], [], 2)
  const entry = membershipPathAt(r, [], 'host')!
  expect(nodeShape(r, []).children.some(child => child.peer === 'host')).toBe(true)
  expect(nodeShape(r, entry).children.map(child => child.id)).toEqual(['to:read'])
  expect(nodeTransportAt(r, [], 'host')).not.toBeNull()
})
