/**
 * The event grammar: the one vocabulary every input surface speaks.
 *
 * HTTP routes, MCP tools, the WebSocket, WebRTC messages, texted commands and the desktop's loopback endpoints are
 * adapters that translate what they receive into a `FosEvent` and hand it to `dispatchEvent`. Handlers therefore
 * never change per transport, and a new transport is only a new adapter. The transport supplies the `Principal`
 * (who is acting, at which attachment); an event can never widen it.
 *
 *   read      one node: its text, children, branches, pending submissions and declared inputs
 *   search    text search below a node, bounded
 *   submit    a submission: changes against a node. The owner applies them; anyone else leaves a proposal
 *             (a submission flagged for review) that the owner decides on.
 *   branch    an alternative of a node (owner)
 *   input     fill one declared hole of an execution: text, confirmation, choice or allocation
 *   complete  evaluate a node. The owner's host runs its handler registry (the dispatcher only authorizes and returns
 *             the request, because effects belong to the host). Anyone else leaves an *evaluation request*: a
 *             submission the owner's "on request" trigger evaluates automatically, or the owner reviews by hand.
 *             Requests are accepted only where a peer in that context offers the `request` capability.
 *   decide    approve or reject a submission
 *   invite    make a Fos user a member of a node (owner). The host delivers the node into that user's Home, so
 *             membership reaches the invitee instead of being a private edge in the owner's store.
 *
 * Capabilities as session types over this grammar come later; for now events are independent requests.
 */
import { FosStore } from '../dag-implementation/store'
import {
  branchSelection, commitRoot, content, contextScope, findChild, hasCapability, isBranchChoice, importNodes, makeLink,
  proposalContent, put, reachableNodes, readChoice, readMembers, readProposals, refBranches, resolveScope, rootTargetCid,
  selectedBranchValue, updateAtScope, valueContent, viewNode, withBranches, withProposal, type Scope,
} from './graph'
import { addMemberAt, addRow, applyProposalAt, createReplica, headCid, rejectProposalAt, renameTask, setTaskDone, type Replica } from './replica'
import { createBranch } from './branches'
import { executionInput, executionSnapshot } from './execution-access'
import { capabilityPeers } from './bindings'
import { writeNodeValue } from './evaluation'

/** The named value a peer's evaluation request carries inside its proposal. */
export const EVALUATION_REQUEST = 'fos:evaluation-request'
import { nodeLinkMaskAt } from './node-provider'

/** Who is acting. Supplied by the transport (JWT claims, a loopback token, a linked phone), never by the event. */
export type Principal = {
  peerId: string
  /** The account owner (or the device's own user) rather than an invited peer or agent. */
  owner: boolean
  /** The attachment: every event path is relative to it and cannot leave it. */
  scope: Scope
  name?: string
}

export type EventBranch = { path: Scope; name: string }
export type Change = { path: Scope; operation: 'add_task' | 'add_note' | 'add_plain' | 'rename' | 'complete'; text?: string; done?: boolean }
export type FosEvent =
  | { kind: 'read'; path?: Scope; branches?: EventBranch[]; offset?: number }
  | { kind: 'search'; path?: Scope; query: string; offset?: number; branches?: EventBranch[] }
  | { kind: 'submit'; path?: Scope; expected: string; name?: string; changes: Change[]; branches?: EventBranch[] }
  | { kind: 'branch'; path: Scope; expected: string; name: string; branches?: EventBranch[] }
  | { kind: 'input'; path?: Scope; expected: string; key: string; value: unknown; branches?: EventBranch[] }
  | { kind: 'complete'; path?: Scope; expected: string; branches?: EventBranch[]; selections?: Record<string, string>; recover?: boolean }
  | { kind: 'decide'; path?: Scope; proposalId: string; decision: 'approve' | 'reject' }
  | { kind: 'invite'; path?: Scope; user: string }
export type EventKind = FosEvent['kind']
export const EVENT_KINDS: EventKind[] = ['read', 'search', 'submit', 'branch', 'input', 'complete', 'decide', 'invite']

/** What the host must still do after a dispatch: run its evaluator for `complete` (effects are host-side). */
export type EvaluateRequest = { path: Scope; branches: Record<string, string>; expected: string; recover?: boolean }
export type Dispatched = { replica: Replica; changed: boolean; result: unknown; evaluate?: EvaluateRequest }

export class EventError extends Error {}

// ---------------------------------------------------------------------------
// Parsing: every adapter hands raw input here, so validation lives in one place.

export function pathOf(value: unknown, fallback: Scope = []): Scope {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.length > 32 || value.some(id => typeof id !== 'string' || !id || id.length > 128 || id === '.' || id === '..')) throw new EventError('Use an array of child IDs within the attachment.')
  return value
}
function branchesOf(value: unknown): EventBranch[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 32) throw new EventError('Invalid branch selections.')
  return value.map(s => {
    if (!s || typeof s.name !== 'string' || !s.name || s.name.length > 200) throw new EventError('Invalid branch name.')
    return { path: pathOf(s.path), name: s.name }
  }).sort((a, b) => a.path.length - b.path.length)
}
function textOf(value: unknown, max = 16000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new EventError(`Text is required (at most ${max} characters).`)
  return value.trim()
}
function offsetOf(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  const offset = value ?? 0
  if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) > max) throw new EventError('Invalid offset.')
  return offset as number
}
function expectedOf(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new EventError('Read the node first and pass its revision as `expected`.')
  return value
}

/** Validate a raw event (from JSON, a tool call, a text command). Throws `EventError` with a user-readable message. */
export function parseEvent(input: unknown): FosEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EventError('An event object is required.')
  const raw = input as Record<string, unknown>
  const kind = raw.kind as EventKind
  if (!EVENT_KINDS.includes(kind)) throw new EventError(`Unknown event kind: ${String(raw.kind)}.`)
  const path = pathOf(raw.path), branches = branchesOf(raw.branches)
  switch (kind) {
    case 'read': return { kind, path, branches, offset: offsetOf(raw.offset) }
    case 'search': return { kind, path, branches, query: textOf(raw.query, 200), offset: offsetOf(raw.offset, 5000) }
    case 'submit': {
      if (!Array.isArray(raw.changes) || !raw.changes.length || raw.changes.length > 50) throw new EventError('Supply 1–50 changes.')
      const changes: Change[] = raw.changes.map((change: any) => {
        if (!change || typeof change !== 'object') throw new EventError('Invalid change.')
        if (!['add_task', 'add_note', 'add_plain', 'rename', 'complete'].includes(change.operation)) throw new EventError('Unknown change operation.')
        return { path: pathOf(change.path), operation: change.operation, ...(change.text !== undefined ? { text: textOf(change.text) } : {}), ...(typeof change.done === 'boolean' ? { done: change.done } : {}) }
      })
      return { kind, path, branches, expected: expectedOf(raw.expected), ...(raw.name !== undefined ? { name: textOf(raw.name, 100) } : {}), changes }
    }
    case 'branch': return { kind, path, branches, expected: expectedOf(raw.expected), name: textOf(raw.name, 200) }
    case 'input': {
      if (typeof raw.key !== 'string' || !raw.key) throw new EventError('An input key is required.')
      return { kind, path, branches, expected: expectedOf(raw.expected), key: raw.key, value: raw.value }
    }
    case 'complete': {
      const selections = raw.selections
      if (selections !== undefined && (!selections || typeof selections !== 'object' || Array.isArray(selections) || Object.entries(selections).length > 64 || Object.entries(selections).some(([id, name]) => id.length > 256 || typeof name !== 'string' || name.length > 256))) throw new EventError('Invalid branch selections.')
      return { kind, path, branches, expected: expectedOf(raw.expected), ...(selections ? { selections: selections as Record<string, string> } : {}), ...(raw.recover === true ? { recover: true } : {}) }
    }
    case 'decide': {
      if (typeof raw.proposalId !== 'string' || !raw.proposalId) throw new EventError('A proposal id is required.')
      if (raw.decision !== 'approve' && raw.decision !== 'reject') throw new EventError('decision must be approve or reject.')
      return { kind, path, proposalId: raw.proposalId, decision: raw.decision }
    }
    case 'invite': {
      const user = typeof raw.user === 'string' ? raw.user.trim().replace(/^@/, '') : ''
      if (!/^[\w.-]{1,64}$/.test(user)) throw new EventError('A Fos user name is required.')
      return { kind, path, user }
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatch

function selectedIdentity(store: FosStore, cid: string): string {
  return isBranchChoice(store, content(store, cid)) ? selectedBranchValue(store, cid) ?? cid : cid
}
function branchInfo(store: FosStore, cid: string) {
  if (isBranchChoice(store, content(store, cid))) return { selected: branchSelection(store, cid), names: readChoice(store, cid).options.map(o => o.peerId) }
  return refBranches(store, content(store, cid)) ?? null
}
function descend(store: FosStore, cid: string, path: Scope): string {
  for (const id of path) {
    // No global alias lookup, legacy Home fallback, bookkeeping, or external handle traversal.
    if (!viewNode(store, cid).tasks.some(row => row.id === id)) throw new EventError('Node is not a visible child in this branch.')
    const next = findChild(store, cid, id)
    if (!next) throw new EventError('Node not found in this branch.')
    cid = next
  }
  return cid
}
const bookkeeping = new Set(['alias', 'ref', 'versionControl', 'disabledCapabilities', 'peerId'])

/**
 * Apply one event to a replica on behalf of `principal`. Pure over the replica: the host wraps it in its own lock,
 * load and save, and runs `evaluate` when returned. Owners act directly; peers read what their grants allow and
 * leave proposals.
 */
export function dispatchEvent(r: Replica, event: FosEvent, principal: Principal, now: number): Dispatched {
  const store = r.store, root = rootTargetCid(store), owner = principal.owner
  const canonical = contextScope(store, root, principal.scope)
  let attached = resolveScope(store, root, canonical)
  if (!attached) throw new EventError('Attachment no longer exists.')
  const permission = (cid: string, capability: 'read' | 'edit' | 'approve') => {
    if (owner) return true
    const identity = content(store, selectedIdentity(store, cid))
    return hasCapability(store, identity, principal.peerId, capability) || (capability === 'read' && hasCapability(store, identity, principal.peerId, 'edit'))
  }
  if (!permission(attached, 'read')) throw new EventError('Peer no longer has read access to this attachment.')
  const path = event.path ?? []
  // Branch selections live only for this synchronous operation; they never change other clients' selection.
  const branches: Record<string, string> = Object.create(null)
  for (const s of ('branches' in event && event.branches) || []) withBranches(store, branches, () => {
    const target = descend(store, attached!, s.path), info = branchInfo(store, target)
    if (!info?.names.includes(s.name)) throw new EventError('Branch not found.')
    branches[content(store, target).data.alias!.id] = s.name
  })
  return withBranches(store, branches, () => {
    attached = resolveScope(store, root, canonical)!
    if (!permission(attached, 'read')) throw new EventError('Peer has no access to this branch.')
    const resolve = (relative: Scope) => {
      let cid = attached!
      for (const id of relative) {
        cid = descend(store, cid, [id])
        // Explicit child restrictions override the attachment's grant.
        const member = readMembers(store, content(store, selectedIdentity(store, cid))).some(m => m.peerId === principal.peerId)
        if (member && !permission(cid, 'read')) throw new EventError('Peer has no access to this child.')
      }
      return cid
    }
    const absolute = (relative: Scope) => [...canonical, ...relative]
    const editable = permission(attached, 'edit')
    const describe = (at: Scope) => {
      const current = resolve(at), v = viewNode(store, current)
      return { path: at, title: v.name, done: v.done, revision: current, valueRevision: put(store, valueContent(store, current)), branches: branchInfo(store, current) }
    }
    const cid = resolve(path), node = viewNode(store, cid)
    const unchanged = (result: unknown): Dispatched => ({ replica: r, changed: false, result })

    if (event.kind === 'read') {
      const offset = event.offset ?? 0
      const visible = node.tasks.filter(row => { try { resolve([...path, row.id]); return true } catch { return false } })
      // A peer sees the fields and children its link mask allows (masks are the owner's private policy for that peer).
      const mask = owner ? null : nodeLinkMaskAt(r, absolute(path), principal.peerId)
      const data = Object.fromEntries(Object.entries(valueContent(store, cid).data).filter(([key]) => !bookkeeping.has(key) && (!mask?.fields || mask.fields.includes(key))))
      const children = visible.filter(row => !mask?.children || mask.children.includes(row.id))
      const described = describe(path)
      let snapshot: ReturnType<typeof executionSnapshot> | null = null
      try { snapshot = executionSnapshot(r, absolute(path), owner ? undefined : { peerId: principal.peerId, scope: canonical, capabilities: [] }) } catch { snapshot = null }
      return unchanged({
        ...described, ...(mask?.fields && !mask.fields.includes('description') ? { title: null } : {}), data,
        ancestors: path.map((_id, i) => describe(path.slice(0, i))),
        children: children.slice(offset, offset + 100).map(row => ({ ...row, path: [...path, row.id] })), nextOffset: offset + 100 < children.length ? offset + 100 : null,
        conflicts: node.choices.map(c => ({ id: c.id, subject: c.subject })),
        proposals: node.proposals.filter(p => owner || p.peerId === principal.peerId),
        evaluation: snapshot ? { status: snapshot.status, inputs: snapshot.inputs, nodes: snapshot.nodes } : null,
        actions: [...(editable ? ['submit', 'input', 'complete'] : []), ...(owner ? ['branch', 'decide'] : [])],
      })
    }
    if (event.kind === 'search') {
      const query = event.query.toLowerCase(), offset = event.offset ?? 0
      const stack: Scope[] = [path], seen = new Set<string>(), matches: unknown[] = []
      let visited = 0
      while (stack.length && visited < 5000 && matches.length < 50) {
        const at = stack.pop()!
        let current: string
        try { current = resolve(at) } catch { continue }
        if (seen.has(current)) continue
        seen.add(current)
        const v = viewNode(store, current)
        if (visited++ >= offset && (v.name ?? '').toLowerCase().includes(query)) matches.push(describe(at))
        if (at.length < 32) for (const row of [...v.tasks].reverse()) stack.push([...at, row.id])
      }
      return unchanged({ matches, nextOffset: stack.length && visited < 5000 ? visited : null, truncated: stack.length > 0, scanned: visited })
    }
    if (event.kind === 'complete') {
      if (event.expected !== put(store, valueContent(store, cid))) throw new EventError('The node changed. Read and review it before evaluating.')
      if (owner) return { replica: r, changed: false, result: { status: 'evaluating' }, evaluate: { path: absolute(path), branches: { ...branches, ...(event.selections ?? {}) }, expected: event.expected, ...(event.recover ? { recover: true } : {}) } }
      // Effects may reach outside the graph; an edit grant does not include running them. The peer asks instead: its
      // request is a proposal on the node, which the owner's `request` trigger evaluates or the owner reviews.
      if (!editable) throw new EventError('Peer cannot request evaluation of this attachment.')
      if (!capabilityPeers(r, absolute(path), 'request').length) throw new EventError('No peer accepts evaluation requests in this context.')
      const requestName = `evaluate ${path.length ? path.join('/') : '[]'}`
      const identity = content(store, selectedIdentity(store, attached!))
      if (readProposals(store, identity).some(p => p.peerId === principal.peerId && p.name === requestName && p.status === 'open')) throw new EventError('This evaluation is already requested.')
      const base = put(store, valueContent(store, attached!)), draftStore = new FosStore()
      importNodes(draftStore, reachableNodes(store, [base]))
      commitRoot(draftStore, base, now)
      const draft = writeNodeValue(createReplica(principal.peerId, draftStore), path, EVALUATION_REQUEST, { peer: principal.peerId, expected: event.expected, time: now }, now)
      importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
      const proposal = put(store, proposalContent(store, principal.peerId, requestName, headCid(draft), base, now))
      const next = updateAtScope(store, root, canonical, current => withProposal(store, makeLink(store, current, now), principal.peerId, proposal, requestName), 'node')
      commitRoot(store, next, now)
      return { replica: { ...r }, changed: true, result: { status: 'requested', proposalId: proposal, request: requestName, node: absolute(path) } }
    }
    if (event.kind === 'decide') {
      if (!permission(cid, 'approve')) throw new EventError('The approve capability is required on this node.')
      const next = event.decision === 'approve' ? applyProposalAt(r, absolute(path), event.proposalId, principal.peerId, now) : rejectProposalAt(r, absolute(path), event.proposalId, now)
      return { replica: next, changed: headCid(next) !== headCid(r), result: { decision: event.decision, proposalId: event.proposalId } }
    }
    if (event.kind === 'invite') {
      if (!owner) throw new EventError('Only the account owner invites users to a node.')
      const peer = `user:${event.user}`
      if (peer === principal.peerId) throw new EventError('You already own this node.')
      const identity = content(store, selectedIdentity(store, cid)), id = identity.data.alias?.id
      if (!id) throw new EventError('This node cannot be shared.')
      const delivery = { peer, user: event.user, node: absolute(path), id, title: node.name }
      if (readMembers(store, identity).some(m => m.peerId === peer)) return unchanged({ status: 'member', ...delivery })
      // The member edge is the grant (edit: they may propose); the host delivers the node to the invitee's Home.
      return { replica: addMemberAt(r, absolute(path), peer, event.user, ['edit'], now), changed: true, result: { status: 'invited', ...delivery } }
    }
    if (event.kind === 'input') {
      if (!editable) throw new EventError('Peer cannot interact with this node.')
      if (event.expected !== cid) throw new EventError('The node changed. Read it again before submitting.')
      const next = executionInput(r, absolute(path), { revision: headCid(r), key: event.key, value: event.value }, principal.peerId, now)
      return { replica: next, changed: true, result: { ...executionSnapshot(next, absolute(path)), revision: resolveScope(next.store, headCid(next), absolute(path)) } }
    }
    if (event.expected !== attached) throw new EventError('The attachment changed. Read [] and review before retrying.')
    if (event.kind === 'branch') {
      if (!owner) throw new EventError('Only the account owner can create branches directly.')
      const next = createBranch(r, absolute(path), event.name, now)
      return { replica: next, changed: true, result: { created: event.name, path } }
    }
    // submit
    if (path.length) throw new EventError('Submissions attach at []. Put relative paths in changes[].path.')
    if (!editable) throw new EventError('Peer cannot propose edits on this attachment.')
    const apply = (draft: Replica, draftStore: FosStore, base: Scope): Replica => {
      for (const change of event.changes) {
        const at = change.path, source = resolve(at)
        for (let i = 1; i <= at.length; i++) {
          const child = resolve(at.slice(0, i)), value = content(store, selectedIdentity(store, child))
          if (readMembers(store, value).some(m => m.peerId === principal.peerId) && !permission(child, 'edit')) throw new EventError('Peer cannot edit this child.')
        }
        if (!owner && nodeLinkMaskAt(r, absolute(at), principal.peerId).fields?.includes('description') === false) throw new EventError('Node text is not exposed to this peer.')
        const target = [...base, ...at]
        if (change.operation === 'add_task' || change.operation === 'add_note' || change.operation === 'add_plain') draft = addRow(draft, target, change.operation === 'add_task' ? 'task' : change.operation === 'add_note' ? 'note' : 'plain', textOf(change.text), now)
        else if (change.operation === 'rename') {
          const text = textOf(change.text)
          if (!at.length) {
            const head = headCid(draft)
            commitRoot(draftStore, updateAtScope(draftStore, head, base, value => ({ ...value, data: { ...value.data, description: { content: text } } })), now)
            draft = { ...draft }
          } else draft = renameTask(draft, target.slice(0, -1), target.at(-1)!, text, now)
        } else if (change.operation === 'complete' && typeof change.done === 'boolean') {
          if (!at.length) throw new EventError('Completion requires a child path.')
          if (!valueContent(store, source).data.todo) throw new EventError('Only tasks have a completion state.')
          const before = headCid(draft)
          draft = setTaskDone(draft, target.slice(0, -1), target.at(-1)!, change.done, now)
          if (before === headCid(draft) && viewNode(draftStore, descend(draftStore, resolveScope(draftStore, headCid(draft), base)!, at)).done !== change.done) throw new EventError('Task has unmet requirements.')
        } else throw new EventError('Unknown change operation.')
      }
      return draft
    }
    if (owner) {
      // The owner's submission is applied to the live replica: an edit, not a proposal.
      const before = headCid(r)
      const next = apply(r, store, canonical)
      return { replica: next, changed: headCid(next) !== before, result: { status: 'applied' } }
    }
    const proposalName = event.name ? textOf(event.name, 100) : `${principal.name ?? principal.peerId} ${new Date(now).toISOString()}`
    const identity = content(store, selectedIdentity(store, attached!))
    if (readProposals(store, identity).some(p => p.peerId === principal.peerId && p.name === proposalName)) throw new EventError('That proposal name already exists. Review it or choose a new name.')
    const base = put(store, valueContent(store, attached!)), draftStore = new FosStore()
    importNodes(draftStore, reachableNodes(store, [base]))
    commitRoot(draftStore, base, now)
    let draft = createReplica(principal.peerId, draftStore)
    withBranches(draftStore, branches, () => { draft = apply(draft, draftStore, []) })
    if (headCid(draft) === base) throw new EventError('No changes to propose.')
    importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
    const proposal = put(store, proposalContent(store, principal.peerId, proposalName, headCid(draft), base, now))
    const next = updateAtScope(store, root, canonical, current => withProposal(store, makeLink(store, current, now), principal.peerId, proposal, proposalName), 'node')
    commitRoot(store, next, now)
    return { replica: { ...r }, changed: true, result: { proposalId: proposal, name: proposalName, status: 'awaiting-review' } }
  })
}
