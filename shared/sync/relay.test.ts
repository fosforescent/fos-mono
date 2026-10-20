import {
  SERVER_TRANSPORT_CAPABILITIES, addMemberAt, addTask, commitRoot, content, createReplica, exchangeNode, headCid, nodeTreeSync, put, readProposals,
  resolveScope, rowTypeAt, setMemberCapabilitiesAt, updateAtScope, view, type NodeAuthority, type NodeSyncContext, type Replica, type Scope,
} from './index'
import { RELAY_QUEUE_ID, addRelayAck, addRelayMessage, offerRelay, relayAfterSubmission, relayAt, relayInbox, relayQueueSync, rowsLeftAt } from './relay'
import { syncWith } from './test-helpers'
import { PLAIN_TYPE } from './library-types'

const HUB: Scope = ['hub']
const queueOf = (peer: string): Scope => [...HUB, `fos:peer:${peer}`, RELAY_QUEUE_ID]

/** A relay context: the hub knows the phone and the desktop; `handler` offers relay there. */
function relayNode(peerId: string, handler: 'fos' | 'self'): Replica {
  let r = addTask(createReplica(peerId), [], 'Hub', 1, 'hub')
  r = addMemberAt(r, HUB, 'phone', 'Phone', ['read', 'edit'], 2)
  r = addMemberAt(r, HUB, 'desktop', 'Desktop', ['read', 'edit'], 3)
  if (handler === 'self') return offerRelay(r, HUB, 4)
  r = addMemberAt(r, HUB, 'fos', 'fos', [], 4)
  return setMemberCapabilitiesAt(r, HUB, 'fos', [], [], 5, ['relay'])
}

/** A message the owner's device wrote into main at the hub: to `to`, carrying one task. */
function leaveInMain(r: Replica, to: string, id: string): Replica {
  r = addRelayMessage(r, HUB, to, 6, id)
  return addTask(r, [...HUB, id], 'Summarize the repository', 7, `${id}:task`)
}

/** Drive node sync for `client` with `context` against `server`, as `authority`. */
function sync(client: Replica, server: Replica, context: NodeSyncContext, authority: NodeAuthority, now = 50): Replica {
  const run = nodeTreeSync(client, context, () => now)
  let step = run.next()
  while (!step.done) step = run.next(exchangeNode(server, step.value.request, authority, now).node)
  return step.value.replica
}

/** The desktop's local inbox: a bare row its queue is synced into. */
function inbox(peerId: string): Replica {
  const r = createReplica(peerId)
  const row = put(r.store, { data: { alias: { id: 'inbox' } }, children: [] })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], value => ({ ...value, children: [...value.children, [rowTypeAt(r.store, PLAIN_TYPE), row]] })), 1)
  return { ...r }
}

test('a message from a peer moves into the queue of the recipient the relay knows', () => {
  let server = relayNode('user:alice', 'fos')
  // the phone is an invited peer at the hub: what it writes there is its submission
  let phone = addRelayMessage(createReplica('phone'), [], 'desktop', 10, 'm1')
  phone = addTask(phone, ['m1'], 'Summarize the repository', 11, 't1')
  phone = syncWith(phone, server, { invited: HUB })
  const hub = resolveScope(server.store, headCid(server), HUB)!
  expect(rowsLeftAt(server.store, hub).some(row => row.id === 'm1' && row.from === 'phone')).toBe(true)

  server = relayAfterSubmission(server, [...HUB, 'm1', 't1'], 'fos', 20)
  expect(view(server, queueOf('desktop'))!.tasks.map(t => t.id)).toEqual(['m1'])
  expect(view(server, [...queueOf('desktop'), 'm1'])!.tasks.map(t => t.title)).toEqual(['Summarize the repository'])
  // taken out of the submission: nothing is left of it, and main never had it
  expect(readProposals(server.store, content(server.store, resolveScope(server.store, headCid(server), HUB)!)).filter(p => p.status === 'open')).toEqual([])
  expect(view(server, HUB)!.tasks.some(t => t.id === 'm1')).toBe(false)
  // the phone learns on its next sync that the message left
  phone = syncWith(phone, server, { invited: HUB, now: 30 })
  expect(view(phone, [])!.tasks.some(t => t.id === 'm1')).toBe(false)
})

test('a message to a peer the relay does not know stays where it was left', () => {
  let server = leaveInMain(relayNode('user:alice', 'fos'), 'stranger', 'm2')
  const before = headCid(server)
  server = relayAt(server, HUB, 'fos', 20)
  expect(headCid(server)).toBe(before)
  expect(view(server, HUB)!.tasks.some(t => t.id === 'm2')).toBe(true)
  // nobody offers relay: nothing happens either
  const plain = leaveInMain(addMemberAt(addTask(createReplica('user:bob'), [], 'Hub', 1, 'hub'), HUB, 'desktop', 'Desktop', ['read'], 2), 'desktop', 'm3')
  expect(headCid(relayAt(plain, HUB, 'fos', 20))).toBe(headCid(plain))
})

test('the recipient pulls its queue when it connects and acknowledges what it took', () => {
  let server = relayAt(leaveInMain(relayNode('user:alice', 'fos'), 'desktop', 'm4'), HUB, 'fos', 20)
  // the desktop is one of the account's devices: it syncs its own queue into a local row
  const owner: NodeAuthority = { peerId: 'desktop', scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const context = relayQueueSync('desktop', server.meta.peerId, [], ['inbox'], HUB)
  let desktop = sync(inbox('desktop'), server, context, owner)
  const delivered = relayInbox(desktop, ['inbox'])
  expect(delivered).toHaveLength(1)
  expect(delivered[0]).toMatchObject({ id: 'm4', to: 'desktop' })
  expect(delivered[0]!.rows.map(row => row.title)).toEqual(['Summarize the repository'])

  // consume: an ack row in its copy of the queue goes back as its submission; the relay takes both out
  desktop = addRelayAck(desktop, ['inbox'], 'm4', 60)
  expect(relayInbox(desktop, ['inbox'])).toEqual([])
  desktop = sync(desktop, server, context, owner, 61)
  server = relayAfterSubmission(server, [...queueOf('desktop'), 'relay:ack:m4'], 'fos', 62)
  expect(view(server, queueOf('desktop'))!.tasks).toEqual([])
  desktop = sync(desktop, server, context, owner, 63)
  expect(view(desktop, ['inbox'])!.tasks).toEqual([])
})

test('an invited recipient acknowledges with its submission at the relay node', () => {
  let server = relayAt(leaveInMain(relayNode('user:alice', 'fos'), 'desktop', 'm5'), HUB, 'fos', 20)
  // another peer cannot step into the desktop's queue
  const phone: NodeAuthority = { peerId: 'phone', scope: HUB, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  expect(() => exchangeNode(server, { peerId: 'phone', scope: HUB, path: ['fos:peer:desktop', RELAY_QUEUE_ID], linkId: 'x' }, phone, 21)).toThrow()
  let desktop = addRelayAck(createReplica('desktop'), [], 'm5', 30)
  desktop = syncWith(desktop, server, { invited: HUB })
  server = relayAfterSubmission(server, [...HUB, 'relay:ack:m5'], 'fos', 40)
  expect(view(server, queueOf('desktop'))!.tasks).toEqual([])
  expect(readProposals(server.store, content(server.store, resolveScope(server.store, headCid(server), HUB)!)).filter(p => p.status === 'open')).toEqual([])
})

test('any device runs the same relay through its own handler offer', () => {
  // a desktop offering relay for its hub (the library's Relay template as its typed offer), not the fos server
  let device = leaveInMain(relayNode('laptop', 'self'), 'desktop', 'm6')
  expect(headCid(relayAt(device, HUB, 'fos', 20))).toBe(headCid(device))
  device = relayAt(device, HUB, 'laptop', 20)
  expect(view(device, queueOf('desktop'))!.tasks.map(t => t.id)).toEqual(['m6'])
  expect(view(device, HUB)!.tasks.some(t => t.id === 'm6')).toBe(false)
  const server = relayAt(leaveInMain(relayNode('user:alice', 'fos'), 'desktop', 'm6'), HUB, 'fos', 20)
  expect(view(device, [...queueOf('desktop'), 'm6'])!.tasks.map(t => t.title)).toEqual(view(server, [...queueOf('desktop'), 'm6'])!.tasks.map(t => t.title))
  // a second run changes nothing
  expect(headCid(relayAt(device, HUB, 'laptop', 30))).toBe(headCid(device))
})
