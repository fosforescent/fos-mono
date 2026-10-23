/**
 * Relay: the durable queue for peers that are offline, as a standard-library handler any peer can run.
 *
 * Everything is a row of a library type (`.fos/library.json`), recognised by the row edge's left node only:
 *   message (`lib.relayMessage`)  a row a peer leaves at a relay node: its value is the addressee (a peer id),
 *                                       its child rows are what is sent (a task, a note, ...)
 *   queue   (`lib.relayQueue`)    the row under a recipient's membership (the row whose left is it) holding what was
 *                                       delivered to it; that subtree is the recipient's queue
 *   ack     (`lib.relayAck`)      a row the recipient leaves (in its queue, or as its submission at the relay
 *                                       node) naming a message it took; the message and the ack leave the queue
 *
 * The handler is three generic primitives: read the rows peers left at a node (`rowsLeftAt`: rows of main and the
 * rows each open submission adds), resolve a peer (`memberEntryPath`: is the addressee a member at or above the node),
 * and move a row (`moveChild`, or out of a submission). An addressee the relay node does not know is left alone, which
 * is all the central fos server needs. Who runs it: the peer offering `relay` in the context (`discoverHandlers`): the
 * fos server through its registry, any device through a typed offer of the library's Relay template (`offerRelay`).
 * Node exchange carries the queue: member entries are children of their node, and a peer receives its own (a masked
 * projection of the node, node-provider.ts), so the queue rows reach the recipient by ordinary sync (`relayQueues`,
 * `relayInbox`); it acknowledges with an ack row (`addRelayAck`).
 */
import type { FosPathElem } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { hashContent } from '../dag-implementation/cid'
import {
  commitRoot, content, findChild, identityCid, isMemberEdge, isPeerReference, isRowOfType, libraryTypeAt, membershipIdOf, memberPeerOf, inMemberEntry, moveChild, aliasIdOf,
  libAt, put, proposalContent, readProposals, refNodeContent, resolveScope, updateAtScope, valueContent, withMainBranchPolicy, withProposal,
  isLibraryRef, handlerOfferId, memberEdgesOf, isRowEdge, enclosingScopes, nearestInScope, type ProposalRecord, type Scope, type TaskView,
} from './graph'
import { constructForm } from './forms'
import { addMemberAt, headCid, setHandlerOffersAt, view, type Replica } from './replica'
import { contextMemberRefs, discoverHandlers } from './handlers'

export const RELAY_MESSAGE = 'relayMessage'
export const RELAY_QUEUE = 'relayQueue'
export const RELAY_ACK = 'relayAck'
/** The library's Relay template: what a relay node accepts (messages, acknowledgements); a peer offers it as its relay. */
export const RELAY_TEMPLATE = 'relay'
/** What a new queue row under a member entry is called: a content address (code finds a queue by its type, `queueIn`). */
export const RELAY_QUEUE_ID = hashContent({ data: { description: { content: 'Relay queue' } }, children: [] })
/** What the acknowledgement of the message `messageId` is called: a content address of what it acknowledges. */
export const relayAckId = (messageId: string): string => hashContent({ data: { ref: { id: messageId }, description: { content: 'Relay acknowledgement' } }, children: [] })

/** The queue under the member entry node `entry`: its row of the library's queue type, if it has one. */
function queueIn(store: FosStore, entry: string): string | null {
  const edge = content(store, entry).children.find(e => isRowOfType(store, e, RELAY_QUEUE))
  return edge ? aliasIdOf(content(store, identityCid(store, edge))) : null
}
/** The path of the queue under the member entry at `entry`, if it has one. */
function queuePath(r: Replica, entry: Scope): Scope | null {
  const cid = resolveScope(r.store, headCid(r), entry), id = cid && queueIn(r.store, cid)
  return id ? [...entry, id] : null
}

const LIMIT = 5000
const sameEdge = (a: FosPathElem, b: FosPathElem) => a[0] === b[0] && a[1] === b[1]

/** A row a peer left at a node: in main (`from` absent: the owner's devices write main), or added by an open submission of `from`. */
export type LeftRow = { edge: FosPathElem; id: string; from?: string; submission?: ProposalRecord }

/** The rows peers left at the node `cid`: its rows in main, then the rows each open submission there adds. */
export function rowsLeftAt(store: FosStore, cid: string): LeftRow[] {
  const id = (edge: FosPathElem) => aliasIdOf(content(store, identityCid(store, edge)))
  const main = valueContent(store, cid).children
  const ids = new Set(main.map(id))
  const out: LeftRow[] = main.flatMap(edge => { const rowId = id(edge); return rowId ? [{ edge, id: rowId }] : [] })
  for (const submission of readProposals(store, content(store, cid))) {
    if (submission.status !== 'open' || !store.table.has(submission.contentCid)) continue
    for (const edge of content(store, submission.contentCid).children) {
      const rowId = id(edge)
      if (rowId && !ids.has(rowId)) out.push({ edge, id: rowId, from: submission.peerId, submission })
    }
  }
  return out
}

/** The value a scalar row holds (a message's addressee, an acknowledged message id); null while it is a held stub. */
function scalarOf(store: FosStore, edge: FosPathElem): string | null {
  const value = valueContent(store, identityCid(store, edge)).data.scalar?.value
  return typeof value === 'string' && value ? value : null
}

/** Has the relay received all of the row (no node in it is still held by a peer)? A message is delivered whole. */
function received(store: FosStore, edge: FosPathElem): boolean {
  const stack = [identityCid(store, edge)], seen = new Set<string>()
  while (stack.length) {
    const cid = stack.pop()!
    if (seen.has(cid)) continue
    if (seen.size > LIMIT) return false
    seen.add(cid)
    if (isPeerReference(content(store, cid))) return false
    for (const child of valueContent(store, cid).children) stack.push(identityCid(store, child))
  }
  return true
}

/**
 * Where `peerId` is a member at or above `at`, read on main: the path of its nearest member entry (`nearestInScope`),
 * or null when there is none, or the nearest is in an enclosing store rather than in `r`.
 */
export function memberEntryPath(r: Replica, at: Scope, peerId: string): Scope | null {
  return withMainBranchPolicy(r.store, () => {
    const found = nearestInScope(enclosingScopes(r.store, headCid(r), at), scope => {
      const id = membershipIdOf(scope.store, scope.cid, peerId)
      return id ? [id] : []
    }, `membership of ${peerId}`)
    return found && found.store === r.store ? [...found.path, found.value] : null
  })
}

/** Does `handlerPeer` offer relay (switched on) in the context of `at`? */
export function relayOffered(r: Replica, at: Scope, handlerPeer: string): boolean {
  return discoverHandlers(r, at).some(offer => offer.peerId === handlerPeer && offer.capability === 'relay' && offer.enabled)
}

function commit(r: Replica, root: string | null, now: number): Replica {
  if (!root || root === headCid(r)) return r
  commitRoot(r.store, root, now)
  return { ...r }
}

/** Take a left row away from where it was left: out of main, or out of its submission (dropped when nothing is left). */
function takeAway(r: Replica, at: Scope, row: LeftRow, now: number): Replica {
  const s = r.store
  if (!row.submission) return commit(r, updateAtScope(s, headCid(r), at, value => ({ ...value, children: value.children.filter(e => !sameEdge(e, row.edge)) })), now)
  const p = row.submission, proposed = content(s, p.contentCid)
  const rest = put(s, { ...proposed, children: proposed.children.filter(e => !sameEdge(e, row.edge)) })
  const next = rest === p.baseCid ? null : put(s, proposalContent(s, p.peerId, p.name, rest, p.baseCid, now))
  return commit(r, updateAtScope(s, headCid(r), at, node => withProposal(s, node, p.peerId, next, p.name), 'node'), now)
}

/** The queue under the member entry `entry`, created for `peerId` from the library's queue type when missing. */
function ensureQueue(r: Replica, entry: Scope, peerId: string, now: number): Replica {
  const cid = resolveScope(r.store, headCid(r), entry)
  if (cid && queueIn(r.store, cid)) return r
  const type = libraryTypeAt(r.store, RELAY_QUEUE, entry)
  if (!type) throw new Error('No library above this node has a relay queue type.')
  const queue = put(r.store, constructForm(r.store, type, RELAY_QUEUE_ID, peerId, now))
  return commit(r, updateAtScope(r.store, headCid(r), entry, value => ({ ...value, children: [...value.children, [type, queue]] })), now)
}

/** Deliver a message into the recipient's queue: moved there from main, or taken out of its submission. */
function deliver(r: Replica, at: Scope, row: LeftRow, to: string, entry: Scope, now: number): Replica {
  r = ensureQueue(r, entry, to, now)
  const id = queueIn(r.store, resolveScope(r.store, headCid(r), entry)!)!, queue = [...entry, id]
  const queued = findChild(r.store, resolveScope(r.store, headCid(r), queue)!, row.id)
  if (!row.submission && !queued) return commit(r, moveChild(r.store, headCid(r), at, row.id, entry, { into: id }), now)
  // a submission's row (or one queued already) is added once and taken away from where it was left
  if (!queued) r = commit(r, updateAtScope(r.store, headCid(r), queue, value => ({ ...value, children: [...value.children, row.edge] })), now)
  return takeAway(r, at, row, now)
}

/** Remove the message `id` from the queue at `queue`, when it is there. */
function dequeue(r: Replica, queue: Scope, id: string, now: number): { replica: Replica; removed: boolean } {
  const cid = resolveScope(r.store, headCid(r), queue)
  if (!cid || !findChild(r.store, cid, id)) return { replica: r, removed: false }
  const next = updateAtScope(r.store, headCid(r), queue, value => ({ ...value, children: value.children.filter(e => aliasIdOf(content(r.store, identityCid(r.store, e))) !== id) }))
  return { replica: commit(r, next, now), removed: true }
}

/**
 * Run the relay on the node at `at` as `handlerPeer` (when it offers relay there): every complete message left there
 * whose addressee is a member at or above `at` moves into that member's queue; a message to anyone else stays where
 * it is. Every ack (in a queue, or left at `at` by the queue's peer; the owner's acks apply to any queue) takes its
 * message and itself out of the queue. Idempotent; the same on any peer.
 */
export function relayAt(r: Replica, at: Scope, handlerPeer: string, now: number): Replica {
  // a queue (inside a member entry) is not a relay node: its node's run handles it
  if (inMemberEntry(r.store, headCid(r), at) || !relayOffered(r, at, handlerPeer)) return r
  const s = r.store
  const node = () => resolveScope(s, headCid(r), at)
  let cid = node()
  if (!cid || isPeerReference(content(s, cid))) return r
  for (const row of rowsLeftAt(s, cid)) {
    if (isRowOfType(s, row.edge, RELAY_MESSAGE)) {
      const to = scalarOf(s, row.edge), entry = to && received(s, row.edge) ? memberEntryPath(r, at, to) : null
      if (to && entry) r = deliver(r, at, row, to, entry, now)
    } else if (isRowOfType(s, row.edge, RELAY_ACK)) {
      const id = scalarOf(s, row.edge)
      if (!id) continue
      const queues = row.from ? [memberEntryPath(r, at, row.from)].filter((q): q is Scope => !!q) : queuesAbove(r, at)
      for (const entry of queues) {
        const queue = queuePath(r, entry)
        if (!queue) continue
        const done = dequeue(r, queue, id, now)
        r = done.replica
        if (done.removed) { r = takeAway(r, at, row, now); break }
      }
    }
  }
  // acks the recipients left in their own queues here
  cid = node()
  for (const entry of cid ? queuesAt(r, at) : []) {
    const queue = queuePath(r, entry), queueCid = queue && resolveScope(s, headCid(r), queue)
    if (!queue) continue
    if (!queueCid) continue
    for (const row of rowsLeftAt(s, queueCid)) {
      if (row.submission || !isRowOfType(s, row.edge, RELAY_ACK)) continue
      const id = scalarOf(s, row.edge)
      if (!id || id === row.id) continue
      const done = dequeue(r, queue, id, now)
      r = done.replica
      if (done.removed) r = dequeue(r, queue, row.id, now).replica
    }
  }
  return r
}

/** Member entries declared on the node at `at` that hold a queue. */
function queuesAt(r: Replica, at: Scope): Scope[] {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return []
  return memberEdgesOf(r.store, cid).flatMap(e => {
    const id = content(r.store, e[1]).data.alias?.id
    return id && queueIn(r.store, e[1]) ? [[...at, id]] : []
  })
}
function queuesAbove(r: Replica, at: Scope): Scope[] {
  const out: Scope[] = []
  for (let i = at.length; i >= 0; i--) out.push(...queuesAt(r, at.slice(0, i)))
  return out
}

/**
 * After a peer's submission landed at `path` (a node exchange that wrote), run the relay on that node and its
 * ancestors: the message may sit above the node whose content just arrived.
 */
export function relayAfterSubmission(r: Replica, path: Scope, handlerPeer: string, now: number): Replica {
  for (let i = path.length; i >= 0; i--) r = relayAt(r, path.slice(0, i), handlerPeer, now)
  return r
}

/** The Relay template of the library bound at `at`. */
export function relayTemplate(r: Replica, at: Scope = []): string {
  const template = libraryTypeAt(r.store, RELAY_TEMPLATE, at)
  if (!template) throw new Error('The library in this scope has no Relay template.')
  return template
}

/** This device offers relay at `at`: a typed offer of the library's Relay template on its own member entry. */
export function offerRelay(r: Replica, at: Scope, now: number): Replica {
  const peerId = r.meta.peerId
  if (!contextMemberRefs(r, at).has(peerId)) r = addMemberAt(r, at, peerId, peerId, [], now)
  const type = libAt(r.store, at).capabilities.relay!
  const template = valueContent(r.store, relayTemplate(r, at))
  const value = put(r.store, { ...template, children: [...template.children, ...content(r.store, type).children] })
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: handlerOfferId(peerId, type) }, name: { content: 'Relay' } }, value, []))
  return setHandlerOffersAt(r, at, peerId, type, [handler], now)
}

/** A new message row's content: the addressee is its value; add the rows to send under it. */
export function addRelayMessage(r: Replica, at: Scope, to: string, now: number, id: string): Replica {
  const type = libraryTypeAt(r.store, RELAY_MESSAGE, at)
  if (!type) throw new Error('No library above this node has a relay message type.')
  const node = put(r.store, constructForm(r.store, type, id, to, now))
  return commit(r, updateAtScope(r.store, headCid(r), at, value => ({ ...value, children: [...value.children, [type, node]] })), now)
}

/** Acknowledge the message `messageId`: an ack row at `at` (the recipient's copy of its queue, or the relay node). */
export function addRelayAck(r: Replica, at: Scope, messageId: string, now: number, id = relayAckId(messageId)): Replica {
  const type = libraryTypeAt(r.store, RELAY_ACK, at)
  if (!type) throw new Error('No library above this node has a relay acknowledgement type.')
  const node = put(r.store, constructForm(r.store, type, id, messageId, now))
  return commit(r, updateAtScope(r.store, headCid(r), at, value => ({ ...value, children: [...value.children, [type, node]] })), now)
}

/**
 * Where `peerId`'s queues are in this replica: the `relay:queue` row of every member entry for it on a node here
 * (member entries travel by node exchange, so a recipient's own queue arrives with the relay node it syncs, its own
 * entry being what it receives of the node's members). Only what is loaded is visited; bounded.
 */
export function relayQueues(r: Replica, peerId: string, at: Scope = [], limit = 2000): Scope[] {
  const s = r.store, out: Scope[] = [], stack: Scope[] = [at]
  let seen = 0
  while (stack.length && seen++ < limit) {
    const path = stack.pop()!, cid = resolveScope(s, headCid(r), path)
    if (!cid || isPeerReference(content(s, cid))) continue
    const member = memberEdgesOf(s, cid).find(e => memberPeerOf(s, e) === peerId)
    const entry = member && content(s, member[1]).data.alias?.id, queue = member && queueIn(s, member[1])
    if (entry && queue) out.push([...path, entry, queue])
    for (const edge of valueContent(s, cid).children) {
      const id = isRowEdge(s, edge) ? aliasIdOf(content(s, identityCid(s, edge))) : null
      if (id) stack.push([...path, id])
    }
  }
  return out.sort((a, b) => a.length - b.length)
}

/** A queued message as the recipient holds it: its id, its addressee and the rows that were sent. */
export type RelayDelivery = { id: string; to: string; rows: TaskView[] }

/** The messages in the local copy of a queue at `at` that are not acknowledged there yet. */
export function relayInbox(r: Replica, at: Scope): RelayDelivery[] {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return []
  const rows = valueContent(r.store, cid).children
  const acked = new Set(rows.filter(e => isRowOfType(r.store, e, RELAY_ACK)).map(e => scalarOf(r.store, e)))
  return rows.flatMap(edge => {
    const id = aliasIdOf(content(r.store, identityCid(r.store, edge))), to = scalarOf(r.store, edge)
    if (!id || !to || acked.has(id) || !isRowOfType(r.store, edge, RELAY_MESSAGE)) return []
    return [{ id, to, rows: view(r, [...at, id])?.tasks ?? [] }]
  })
}
