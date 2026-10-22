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
 *   outstanding  open work below a node: rows made from the Task type (or a template) that are not done and rows
 *             made from the Allocation type whose requirement is not satisfied yet (the row's type decides, then its
 *             state), those assigned to the acting peer first. A peer granted `execute` asks for it to find work,
 *             then reads, proposes results or completes.
 *   submit    a submission: changes against a node. The owner applies them; anyone else leaves a proposal
 *             (a submission flagged for review) that the owner decides on. An added row may name its id, so later
 *             changes of the same submission add rows inside it (a nested group in one submission).
 *   branch    an alternative of a node (owner)
 *   input     fill one declared hole of an execution: text, confirmation, choice or allocation
 *   complete  evaluate a node. The owner's host runs its handler registry (the dispatcher only authorizes and returns
 *             the request, because effects belong to the host); so does a peer granted `execute` there. Anyone else leaves an *evaluation request*: a
 *             submission the owner's "on request" trigger evaluates automatically, or the owner reviews by hand.
 *             Requests are accepted only where a peer in that context offers the `request` capability.
 *   decide    approve or reject a submission
 *   invite    make a Fos user a member of a node (owner). The host delivers the node into that user's Home, so
 *             membership reaches the invitee instead of being a private edge in the owner's store.
 *
 * Capabilities as session types over this grammar come later; for now events are independent requests.
 */
import { FosStore } from '../dag-implementation/store'
import { NOTE_TYPE, PLAIN_TYPE, TASK_TYPE, TEMPLATE_TYPE } from './library-types'
import type { FosPathElem } from '../types'
import {
  branchSelection, commitRoot, content, contextScope, demandOf, findAliasEdge, findChild, hasCapability, isBranchChoice, importNodes, makeLink,
  proposalContent, put, reachableNodes, readChoice, readMembers, readProposals, refBranches, requirementSatisfied,
  requirementSummary, resolveScope, rootTargetCid, isTaskRow, isAllocationRow, isRowOfType,
  selectedBranchValue, updateAtScope, valueContent, viewNode, withBranches, withProposal, type Scope,
  nestScope, libraryTypeAt, scopeBranches, newId, taskBlockers,
} from './graph'
import { addMemberAt, addRow, addTypedRow, applyProposalAt, createReplica, headCid, rejectProposalAt, renameTask, setTaskDone, type Replica } from './replica'
import { createBranch } from './branches'
import { executionInput, executionSnapshot } from './execution-access'
import { capabilityPeers } from './bindings'
import { writeExecutionRequest } from './evaluation'
import { acceptSubmission, type Attester } from './approvals'
import { rowWithLeft } from './row-values'
import { isExecuteLeft } from './capabilities'
import { readGraphValue } from './node-values'
import { workClaims, saveWorkClaims, workOverlaps, within, WORK_LEASE_MS, type WorkClaim } from './work-claims'

/** The named value a peer's evaluation request carries inside its proposal. */
/** A peer's request that a node be run (on another peer's node): the execute row's request in the submission it sends. */
export type EvaluationRequest = { id: string; peer: string; expected: string; time: number }
/** The evaluation request the submitted content `contentCid` makes of its node at `path`, if it is one. */
export function submittedRequest(store: FosStore, contentCid: string, path: Scope): EvaluationRequest | null {
  const node = resolveScope(store, contentCid, path)
  const row = node ? rowWithLeft(store, node, isExecuteLeft) : null
  const state = row ? readGraphValue(store, row.ref) as { request?: EvaluationRequest } | undefined : undefined
  const request = state?.request
  return request && typeof request.id === 'string' && typeof request.peer === 'string' ? request : null
}
import { nodeLinkMaskAt } from './node-provider'

/** Who is acting. Supplied by the transport (JWT claims, a loopback token, a linked phone), never by the event. */
export type Principal = {
  peerId: string
  /** The account owner (or the device's own user) rather than an invited peer or agent. */
  owner: boolean
  /** The attachment: every event path is relative to it and cannot leave it. */
  scope: Scope
  name?: string
  /** Transport-issued identity; distinct connections may act as the same peer. */
  sessionId?: string
}

export type EventBranch = { path: Scope; name: string }
/**
 * `add_row` adds a row of the standard-library row type `type` (e.g. `lib:type:note`, resolved by the nearest library
 * at the parent) holding `text`. `id` (add operations only): the new row's alias id, so later changes of the same
 * submission can add inside it.
 */
export type Change = { path: Scope; operation: 'add_row' | 'add_task' | 'add_note' | 'add_plain' | 'rename' | 'complete'; text?: string; done?: boolean; id?: string; type?: string }
const ADDS: Array<Change['operation']> = ['add_row', 'add_task', 'add_note', 'add_plain']
export type FosEvent = (
  | { kind: 'read'; path?: Scope; branches?: EventBranch[]; offset?: number }
  | { kind: 'search'; path?: Scope; query: string; offset?: number; branches?: EventBranch[] }
  | { kind: 'outstanding'; path?: Scope; offset?: number; branches?: EventBranch[] }
  | { kind: 'submit'; path?: Scope; expected: string; name?: string; changes: Change[]; branches?: EventBranch[] }
  | { kind: 'branch'; path: Scope; expected: string; name: string; branches?: EventBranch[] }
  | { kind: 'input'; path?: Scope; expected: string; key: string; value: unknown; branches?: EventBranch[] }
  | { kind: 'complete'; path?: Scope; expected: string; branches?: EventBranch[]; selections?: Record<string, string>; recover?: boolean }
  | { kind: 'decide'; path?: Scope; proposalId: string; decision: 'approve' | 'reject' }
  | { kind: 'invite'; path?: Scope; user: string }
  | { kind: 'work'; operation: 'status' | 'claim' | 'renew' | 'release'; path?: Scope; branches?: EventBranch[]; expected?: string; claimId?: string }
) & { /** Adapter-only context, never accepted from the event API. */ mcp?: boolean; workClaim?: string }
export type EventKind = FosEvent['kind']
export const EVENT_KINDS: EventKind[] = ['read', 'search', 'outstanding', 'submit', 'branch', 'input', 'complete', 'decide', 'invite', 'work']

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
    case 'work': {
      if (!['status', 'claim', 'renew', 'release'].includes(String(raw.operation))) throw new EventError('Invalid work operation.')
      const operation = raw.operation as 'status' | 'claim' | 'renew' | 'release'
      if (operation !== 'claim' && (path.length || branches?.length)) throw new EventError('Only claiming work accepts a path or branches.')
      if (['renew', 'release'].includes(operation) && (typeof raw.claimId !== 'string' || !raw.claimId)) throw new EventError('A claimId is required.')
      return { kind, operation, path, branches, ...(operation === 'claim' ? { expected: expectedOf(raw.expected) } : {}), ...(typeof raw.claimId === 'string' ? { claimId: raw.claimId } : {}) }
    }
    case 'read': return { kind, path, branches, offset: offsetOf(raw.offset) }
    case 'search': return { kind, path, branches, query: textOf(raw.query, 200), offset: offsetOf(raw.offset, 5000) }
    case 'outstanding': return { kind, path, branches, offset: offsetOf(raw.offset, 1000) }
    case 'submit': {
      if (!Array.isArray(raw.changes) || !raw.changes.length || raw.changes.length > 50) throw new EventError('Supply 1–50 changes.')
      const changes: Change[] = raw.changes.map((change: any) => {
        if (!change || typeof change !== 'object') throw new EventError('Invalid change.')
        if (!['add_row', 'add_task', 'add_note', 'add_plain', 'rename', 'complete'].includes(change.operation)) throw new EventError('Unknown change operation.')
        if ((change.operation === 'add_row') !== (change.type !== undefined) || (change.type !== undefined && (typeof change.type !== 'string' || !/^lib:type:[\w-]{1,64}$/.test(change.type)))) throw new EventError('add_row names a standard-library row type (lib:type:…); other operations take none.')
        if (change.id !== undefined && (!ADDS.includes(change.operation) || typeof change.id !== 'string' || !/^[\w.:-]{1,128}$/.test(change.id) || change.id.startsWith('fos:'))) throw new EventError('Only added rows take an id (letters, digits, . : _ -).')
        return { path: pathOf(change.path), operation: change.operation, ...(change.text !== undefined ? { text: textOf(change.text) } : {}), ...(typeof change.done === 'boolean' ? { done: change.done } : {}), ...(change.id !== undefined ? { id: change.id } : {}), ...(change.type !== undefined ? { type: change.type } : {}) }
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
/** `attester`: who attests the approvals this host records for others (the fos server's `approve` handler). */
export type DispatchOptions = { attester?: Attester | null }
export function dispatchEvent(r: Replica, event: FosEvent, principal: Principal, now: number, options: DispatchOptions = {}): Dispatched {
  const before = r.store.rootNodeId
  try { return dispatch(r, event, principal, now, options) }
  catch (error) { r.store.rootNodeId = before; throw error }
}
function dispatch(r: Replica, event: FosEvent, principal: Principal, now: number, options: DispatchOptions): Dispatched {
  const store = r.store, root = rootTargetCid(store), owner = principal.owner
  let canonical = contextScope(store, root, principal.scope)
  const attachment = [...canonical], session = principal.sessionId ?? principal.peerId
  const claims = workClaims(r, now)
  const active = claims.find(c => c.peerId === principal.peerId && c.session === session && JSON.stringify(c.attachment) === JSON.stringify(attachment))
  let nextClaims: WorkClaim[] | undefined
  const managing = event.kind === 'work'
  if (event.workClaim && (!active || active.id !== event.workClaim)) throw new EventError('Task claim expired or unavailable. List tools and claim work again.')
  if (event.mcp && active && !managing && !event.workClaim) throw new EventError('A task is claimed. List tools and use the task-specific tools until submission or release.')
  const scoped = event.workClaim ? active : undefined
  let inherited: { cid: string; read: boolean; edit: boolean; execute: boolean } | undefined
  let attached = resolveScope(store, root, canonical)
  if (!attached) throw new EventError('Attachment no longer exists.')
  const permission = (cid: string, capability: 'read' | 'edit' | 'execute') => {
    if (owner) return true
    const identity = content(store, selectedIdentity(store, cid))
    if (inherited?.cid === cid && !readMembers(store, identity).some(m => m.peerId === principal.peerId)) return inherited[capability]
    // edit and execute both include reading what they change or run
    return hasCapability(store, identity, principal.peerId, capability) || (capability === 'read' && (hasCapability(store, identity, principal.peerId, 'edit') || hasCapability(store, identity, principal.peerId, 'execute')))
  }
  if (!permission(attached, 'read')) throw new EventError('Peer no longer has read access to this attachment.')
  const path = event.path ?? []
  // Branch selections live only for this synchronous operation; they never change other clients' selection.
  const branches: Record<string, string> = { ...(active && (scoped || managing) ? active.branches : {}) }
  for (const s of ('branches' in event && event.branches) || []) withBranches(store, branches, () => {
    const target = descend(store, attached!, s.path), info = branchInfo(store, target)
    if (!info?.names.includes(s.name)) throw new EventError('Branch not found.')
    const id = content(store, target).data.alias!.id
    if (scoped && active!.branches[id] !== s.name) throw new EventError('Task tools cannot change branches.')
    branches[id] = s.name
  })
  const outcome = withBranches(store, branches, (): Dispatched => {
    attached = resolveScope(store, root, canonical)!
    if (!permission(attached, 'read')) throw new EventError('Peer has no access to this branch.')
    const resolve = (relative: Scope) => {
      let cid = attached!
      for (const [index, id] of relative.entries()) {
        const mask = owner ? null : nodeLinkMaskAt(r, [...canonical, ...relative.slice(0, index)], principal.peerId)
        if (mask?.children && !mask.children.includes(id)) throw new EventError('Peer has no access to this child.')
        cid = descend(store, cid, [id])
        // Explicit child restrictions override the attachment's grant.
        const member = readMembers(store, content(store, selectedIdentity(store, cid))).some(m => m.peerId === principal.peerId)
        if (member && !permission(cid, 'read')) throw new EventError('Peer has no access to this child.')
      }
      return cid
    }
    if (scoped) {
      const selected = scopeBranches(store, root, scoped.path)
      if (Object.entries(scoped.branches).some(([id, name]) => selected[id] !== name)) throw new EventError('The claimed branch is no longer available. Release the task claim.')
      const relative = scoped.path.slice(attachment.length)
      const target = resolve(relative)
      const grants = { read: permission(attached!, 'read'), edit: permission(attached!, 'edit'), execute: permission(attached!, 'execute') }
      for (let i = 1; i <= relative.length; i++) {
        const child = resolve(relative.slice(0, i))
        if (readMembers(store, content(store, selectedIdentity(store, child))).some(m => m.peerId === principal.peerId)) {
          for (const cap of ['read', 'edit', 'execute'] as const) grants[cap] = permission(child, cap)
        }
      }
      if (!grants.execute) throw new EventError('The execute capability for this task was revoked.')
      inherited = { cid: target, ...grants }
      attached = target
      canonical = [...scoped.path]
    }
    const absolute = (relative: Scope) => [...canonical, ...relative]
    const editable = permission(attached, 'edit')
    const describe = (at: Scope) => {
      const current = resolve(at), v = viewNode(store, current)
      return { path: at, title: v.name, done: v.done, revision: current, valueRevision: put(store, valueContent(store, current)), branches: branchInfo(store, current) }
    }
    const cid = resolve(path), node = viewNode(store, cid)
    const unchanged = (result: unknown): Dispatched => ({ replica: r, changed: false, result })

    if (event.kind === 'work') {
      if (event.operation === 'status') return unchanged({ claim: active ?? null, toolsChanged: true })
      if (event.operation === 'release') {
        if (!active || active.id !== event.claimId) throw new EventError('Task claim expired or unavailable.')
        nextClaims = claims.filter(c => c.id !== active.id)
        return unchanged({ status: 'released', claimId: active.id, toolsChanged: true })
      }
      if (!permission(attached, 'execute') || !editable) throw new EventError('Claiming work requires execute and edit capabilities.')
      if (event.operation === 'renew') {
        if (!active || active.id !== event.claimId) throw new EventError('Task claim expired or unavailable.')
        const relative = active.path.slice(attachment.length)
        for (let i = 1; i <= relative.length; i++) {
          const child = resolve(relative.slice(0, i))
          if (readMembers(store, content(store, selectedIdentity(store, child))).some(m => m.peerId === principal.peerId)
            && (!permission(child, 'execute') || !permission(child, 'edit'))) throw new EventError('Task capabilities were revoked.')
        }
        const renewed = { ...active, expiresAt: now + WORK_LEASE_MS }
        nextClaims = claims.map(c => c.id === active.id ? renewed : c)
        return unchanged({ status: 'claimed', claim: renewed })
      }
      if (active) throw new EventError('Submit or release the current task before claiming another.')
      if (!path.length) throw new EventError('Choose an outstanding child task within the attachment.')
      for (let i = 1; i <= path.length; i++) {
        const child = resolve(path.slice(0, i))
        if (readMembers(store, content(store, selectedIdentity(store, child))).some(m => m.peerId === principal.peerId)
          && (!permission(child, 'execute') || !permission(child, 'edit'))) throw new EventError('Claiming this child requires execute and edit capabilities.')
        const parent = resolve(path.slice(0, i - 1)), edge = findAliasEdge(store, valueContent(store, parent), path[i - 1]!)?.edge
        if (edge && (isRowOfType(store, edge, TEMPLATE_TYPE) || (isTaskRow(store, edge) && viewNode(store, child).done))) throw new EventError('Task is no longer outstanding.')
        if (i === path.length && (!edge || !(isTaskRow(store, edge) || (isAllocationRow(store, edge) && !requirementSatisfied(store, child))))) throw new EventError('Choose an outstanding task or unmet requirement.')
      }
      if (event.expected !== cid) throw new EventError('Task changed. Read it again before claiming.')
      if (event.branches?.some(b => !within(path, b.path))) throw new EventError('Claim branch selections must be on the path to the task.')
      const selected = scopeBranches(store, root, absolute(path))
      if (claims.some(c => workOverlaps(c, absolute(path), selected))) throw new EventError('This task or an overlapping subtree is already claimed.')
      if (claims.length >= 256) throw new EventError('Too many active work claims.')
      const claim: WorkClaim = { id: newId(), peerId: principal.peerId, session, attachment, path: absolute(path), branches: selected, expiresAt: now + WORK_LEASE_MS }
      nextClaims = [...claims, claim]
      return unchanged({ status: 'claimed', claim, task: describe(path), toolsChanged: true, instructions: 'List tools now. Task tool paths start at []; pass claimId on every call. Submit with fos_task_submit to release the claim. Renew before expiresAt.' })
    }
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
    if (event.kind === 'outstanding') {
      if (!permission(attached, 'execute')) throw new EventError('The execute capability is required to discover outstanding work.')
      // A row is [type, row]: its type (the left node) says whether it is work. Tasks are rows made from the library's
      // Task type (any pinned version, all of which share its id) or from a template row; requirements are rows made
      // from its Allocation type that ask for something (a supply or a plain allocation is always satisfied); a template's
      // rows are a definition and are skipped. Then
      // their state decides: a task not done, a requirement not satisfied. A done task's subtree is skipped; masks hide
      // children and text exactly as they do for read.
      const offset = event.offset ?? 0
      const stack: Array<{ at: Scope; edge?: FosPathElem; blockedBy?: string[] }> = [{ at: path }], seen = new Set<string>()
      const open: Array<Record<string, unknown> & { assigned: boolean }> = []
      let visited = 0
      while (stack.length && visited < 5000 && open.length < 1100) {
        const { at, edge, blockedBy } = stack.pop()!
        const task = !!edge && isTaskRow(store, edge), requirement = !!edge && isAllocationRow(store, edge)
        let current: string
        try { current = resolve(at) } catch { continue }
        if (seen.has(current)) continue
        seen.add(current); visited++
        const value = valueContent(store, current)
        // a done task's subtree is finished; a template's is a definition, not work
        if ((task && value.data.todo?.completed) || (!!edge && isRowOfType(store, edge, TEMPLATE_TYPE))) continue
        const mask = owner ? null : nodeLinkMaskAt(r, absolute(at), principal.peerId)
        if (at.length && (task || (requirement && !requirementSatisfied(store, current)))) {
          const demand = requirement ? demandOf(value) : undefined
          // assigned to this peer: bound as a member on the row itself, or named by the requirement
          const assigned = readMembers(store, content(store, selectedIdentity(store, current))).some(m => m.peerId === principal.peerId) || (!!demand?.peer && [principal.peerId, principal.name].includes(demand.peer))
          if (!claims.some(c => workOverlaps(c, absolute(at), { ...branches, ...scopeBranches(store, root, absolute(at)) }))) open.push({ ...describe(at), ...(mask?.fields && !mask.fields.includes('description') ? { title: null } : {}), parent: at.slice(0, -1), assigned, ...(demand ? { requirement: requirementSummary(demand) } : {}), ...(blockedBy?.length ? { blockedBy } : {}) })
        }
        if (at.length < 32) {
          const rows = viewNode(store, current).tasks.filter(row => !mask?.children || mask.children.includes(row.id))
          for (const row of [...rows].reverse()) stack.push({ at: [...at, row.id], edge: findAliasEdge(store, value, row.id)?.edge, blockedBy: row.blockedBy })
        }
      }
      const ordered = [...open.filter(item => item.assigned), ...open.filter(item => !item.assigned)]
      return unchanged({ revision: attached, items: ordered.slice(offset, offset + 100), nextOffset: offset + 100 < ordered.length ? offset + 100 : null, truncated: stack.length > 0, scanned: visited })
    }
    if (!scoped && ['complete', 'input', 'branch', 'decide'].includes(event.kind) && claims.some(c => workOverlaps(c, absolute(path), scopeBranches(store, root, absolute(path))))) throw new EventError('This operation overlaps claimed work. Use its task tools or wait for release.')
    if (event.kind === 'complete') {
      if (event.expected !== put(store, valueContent(store, cid))) throw new EventError('The node changed. Read and review it before evaluating.')
      if (owner || permission(cid, 'execute')) return { replica: r, changed: false, result: { status: 'evaluating' }, evaluate: { path: absolute(path), branches: { ...branches, ...(event.selections ?? {}) }, expected: event.expected, ...(event.recover ? { recover: true } : {}) } }
      // Effects may reach outside the graph; an edit grant does not include running them. The peer asks instead: its
      // request is a proposal on the node, which the owner's `request` trigger evaluates or the owner reviews.
      if (!editable) throw new EventError('Peer cannot request evaluation of this attachment.')
      if (!capabilityPeers(r, absolute(path), 'request').length) throw new EventError('No peer accepts evaluation requests in this context.')
      // the request: a submission whose node at `path` asks to be run (its execute row's request), named by its id
      const request = newId()
      const identity = content(store, selectedIdentity(store, attached!))
      if (readProposals(store, identity).some(p => p.peerId === principal.peerId && p.status === 'open' && submittedRequest(store, p.contentCid, path))) throw new EventError('This evaluation is already requested.')
      const base = put(store, valueContent(store, attached!)), draftStore = new FosStore()
      importNodes(draftStore, reachableNodes(store, [base]))
      commitRoot(draftStore, base, now)
      nestScope(draftStore, { store, root, at: canonical })
      const draft = writeExecutionRequest(createReplica(principal.peerId, draftStore), path, { id: request, peer: principal.peerId, expected: event.expected, time: now } satisfies EvaluationRequest, now)
      importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
      const proposal = put(store, proposalContent(store, principal.peerId, request, headCid(draft), base, now))
      const next = updateAtScope(store, root, canonical, current => withProposal(store, makeLink(store, current, now), principal.peerId, proposal, request), 'node')
      commitRoot(store, next, now)
      return { replica: { ...r }, changed: true, result: { status: 'requested', proposalId: proposal, request, node: absolute(path) } }
    }
    if (event.kind === 'decide') {
      // deciding a submission is how edit is exercised on a node with several peers
      if (!permission(cid, 'edit')) throw new EventError('The edit capability is required on this node.')
      if (event.decision === 'reject') { const next = rejectProposalAt(r, absolute(path), event.proposalId, now); return { replica: next, changed: headCid(next) !== headCid(r), result: { decision: event.decision, proposalId: event.proposalId } } }
      // approving is the one way a submission is accepted: the approval is recorded (the owner's as this store's,
      // another member's attested), and the submission applies once the node's merge rule holds
      const approver = owner ? r.meta.peerId : principal.peerId
      const accepted = acceptSubmission(r, absolute(path), event.proposalId, approver, now, approver !== r.meta.peerId && options.attester ? { attester: options.attester } : {})
      return { replica: accepted.replica, changed: true, result: { decision: event.decision, proposalId: accepted.proposal, merged: accepted.merged, missing: accepted.missing } }
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
      const next = executionInput(r, absolute(path), { revision: headCid(r), key: event.key, value: event.value }, principal.peerId, now, {
        canRead: (source, _cid, target) => {
          if (source !== store || !within(canonical, target)) return false
          try { resolve(target.slice(canonical.length)); const mask = owner ? null : nodeLinkMaskAt(r, target, principal.peerId); return !mask?.fields || mask.fields.includes('description') } catch { return false }
        }
      })
      return { replica: next, changed: true, result: { ...executionSnapshot(next, absolute(path), owner ? undefined : { peerId: principal.peerId, scope: canonical, capabilities: [] }), revision: resolveScope(next.store, headCid(next), absolute(path)) } }
    }
    if (event.expected !== attached) throw new EventError('The attachment changed. Read [] and review before retrying.')
    if (event.kind === 'branch') {
      if (!owner) throw new EventError('Only the account owner can create branches directly.')
      const next = createBranch(r, absolute(path), event.name, now)
      return { replica: next, changed: true, result: { created: event.name, path } }
    }
    // submit
    if (!scoped && event.changes.some(change => claims.some(c => workOverlaps(c, absolute(change.path), { ...branches, ...scopeBranches(store, root, absolute(change.path)) })))) throw new EventError('Changes overlap claimed work. Use its task submission or wait for release.')
    if (path.length) throw new EventError('Submissions attach at []. Put relative paths in changes[].path.')
    if (!editable) throw new EventError('Peer cannot propose edits on this attachment.')
    const apply = (draft: Replica, draftStore: FosStore, base: Scope): Replica => {
      // rows this submission added with an `id`: later changes may add inside them (they exist only in the draft)
      const created = new Set<string>()
      for (const change of event.changes) {
        const fresh = change.path.findIndex(id => created.has(id))
        if (fresh >= 0 && !ADDS.includes(change.operation)) throw new EventError('Rows added by this submission only take further rows.')
        const at = fresh >= 0 ? change.path.slice(0, fresh) : change.path, source = resolve(at)
        for (let i = 1; i <= at.length; i++) {
          const child = resolve(at.slice(0, i)), value = content(store, selectedIdentity(store, child))
          if (readMembers(store, value).some(m => m.peerId === principal.peerId) && !permission(child, 'edit')) throw new EventError('Peer cannot edit this child.')
        }
        if (!owner && nodeLinkMaskAt(r, absolute(at), principal.peerId).fields?.includes('description') === false) throw new EventError('Node text is not exposed to this peer.')
        const target = [...base, ...change.path]
        if (ADDS.includes(change.operation)) {
          const parent = resolveScope(draftStore, headCid(draft), target)
          if (!parent) throw new EventError('Node not found in this branch.')
          if (change.id && (created.has(change.id) || viewNode(draftStore, parent).tasks.some(row => row.id === change.id))) throw new EventError('A row with that id already exists here.')
          const before = headCid(draft)
          if (change.operation === 'add_row') {
            const type = libraryTypeAt(draftStore, change.type!, target)
            if (!type) throw new EventError(`No standard library here has the row type ${change.type}.`)
            draft = addTypedRow(draft, target, type, textOf(change.text), now, change.id)
          } else draft = addRow(draft, target, change.operation === 'add_task' ? TASK_TYPE : change.operation === 'add_note' ? NOTE_TYPE : PLAIN_TYPE, textOf(change.text), now, change.id ? { id: change.id } : {})
          if (change.id && headCid(draft) !== before) created.add(change.id)
        }
        else if (change.operation === 'rename') {
          const text = textOf(change.text)
          if (!at.length) {
            const head = headCid(draft)
            commitRoot(draftStore, updateAtScope(draftStore, head, base, value => ({ ...value, data: { ...value.data, description: { content: text } } })), now)
            draft = { ...draft }
          } else draft = renameTask(draft, target.slice(0, -1), target.at(-1)!, text, now)
        } else if (change.operation === 'complete' && typeof change.done === 'boolean') {
          if (!at.length) {
            if (!scoped || !valueContent(store, source).data.todo) throw new EventError('Completion requires a task path.')
            const targetCid = resolveScope(draftStore, headCid(draft), base)!
            if (change.done && taskBlockers(draftStore, targetCid).length) throw new EventError('Task has unmet requirements.')
            commitRoot(draftStore, updateAtScope(draftStore, headCid(draft), base, value => ({ ...value, data: { ...value.data, todo: { completed: change.done!, time: value.data.todo?.time ?? now } } })), now)
            draft = { ...draft }; continue
          }
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
      if (scoped && headCid(next) === before) throw new EventError('No changes to submit.')
      return { replica: next, changed: headCid(next) !== before, result: { status: 'applied' } }
    }
    const proposalName = event.name ? textOf(event.name, 100) : `${principal.name ?? principal.peerId} ${new Date(now).toISOString()}`
    const identity = content(store, selectedIdentity(store, attached!))
    if (readProposals(store, identity).some(p => p.peerId === principal.peerId && p.name === proposalName)) throw new EventError('That proposal name already exists. Review it or choose a new name.')
    const base = put(store, valueContent(store, attached!)), draftStore = new FosStore()
    importNodes(draftStore, reachableNodes(store, [base]))
    commitRoot(draftStore, base, now)
    nestScope(draftStore, { store, root, at: canonical })
    let draft = createReplica(principal.peerId, draftStore)
    withBranches(draftStore, branches, () => { draft = apply(draft, draftStore, []) })
    if (headCid(draft) === base) throw new EventError('No changes to propose.')
    importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
    const proposal = put(store, proposalContent(store, principal.peerId, proposalName, headCid(draft), base, now))
    const next = updateAtScope(store, root, canonical, current => withProposal(store, makeLink(store, current, now), principal.peerId, proposal, proposalName), 'node')
    commitRoot(store, next, now)
    return { replica: { ...r }, changed: true, result: { proposalId: proposal, name: proposalName, status: 'awaiting-review' } }
  })
  if (scoped && event.kind === 'submit' && outcome.changed) {
    nextClaims = claims.filter(c => c.id !== scoped.id)
    outcome.result = { ...(outcome.result as object), releasedClaimId: scoped.id, toolsChanged: true }
  }
  if (nextClaims) { outcome.replica = saveWorkClaims(outcome.replica, nextClaims, now); outcome.changed = true }
  return outcome
}
