/**
 * Device replica: a FosStore whose root alias points at the node this device is
 * attached to (the whole user-group document for scope [], or one node),
 * plus the link metadata needed to sync it.
 *
 * Every edit creates new content nodes (path copy) and advances the root alias
 * with a PREV link, so the local history is a proper chain in the graph.
 */

import { FosStore } from '../dag-implementation/store'
import { CURRENT_CID_VERSION } from '../dag-implementation/cid'
import type { FosContextData, FosNodeContent } from '../types'
import {
  type Capability,
  type MovePosition,
  type NodeView,
  type RowKind,
  SYNC_FORMAT_VERSION,
  type Scope,
  type TaskView,
  commitRoot,
  content,
  convertRowContent,
  copyRowContent,
  exportReachableContext,
  findEdge,
  findRowByAlias,
  identityCid,
  isPartitionEdge,
  isRowEdge,
  makeLink,
  markProposalRejected,
  moveChild,
  newId,
  normalizeRefs,
  partitionContent,
  partitionEdge,
  put,
  putStripped,
  reachableNodes,
  reachableSet,
  readProposal,
  relinkContent,
  removeProposalByCid,
  replaceEdge,
  resolveScope,
  rootTargetCid,
  rowContent,
  rowEdge,
  rowKindOf,
  scopeNames,
  taskContent,
  taskEdge,
  updateAtScope,
  valueContent,
  viewNode,
  withChildValue,
  withIdentity,
  withMember,
  withoutPeer
} from './graph'
import { mergeNodes, resolveChoiceIn } from './merge'
import { applySyncResponse, type SyncRequest, type SyncResponse } from './protocol'

export type ReplicaMeta = {
  version: typeof SYNC_FORMAT_VERSION
  peerId: string
  scope: Scope
  /** Display names of the nodes along `scope` (a scoped replica cannot resolve them itself). */
  scopeNames: string[]
  baseCid: string | null
  lastSyncAt: number | null
  serverPeerId: string | null
}

export type Replica = { store: FosStore; meta: ReplicaMeta }

export type SerializedReplica = { meta: ReplicaMeta; context: FosContextData }

export function createReplica(peerId: string = newId()): Replica {
  return {
    store: new FosStore(),
    meta: { version: SYNC_FORMAT_VERSION, peerId, scope: [], scopeNames: [], baseCid: null, lastSyncAt: null, serverPeerId: null }
  }
}

/** Rewrite legacy inline link nodes into ref nodes (idempotent; no-op on current data). */
export function normalizeReplicaRefs(store: FosStore): boolean {
  const head = rootTargetCid(store)
  const next = normalizeRefs(store, head)
  if (next === head) return false
  commitRoot(store, next, 0)
  return true
}

export function serializeReplica(replica: Replica): SerializedReplica {
  return { meta: replica.meta, context: exportReachableContext(replica.store, [replica.meta.baseCid]) }
}

/** Rebuild a replica from untrusted JSON. Falls back to a fresh replica on any problem. */
export function loadReplica(input: unknown): Replica {
  const fresh = createReplica()
  if (!input || typeof input !== 'object') return fresh
  const raw = input as Partial<SerializedReplica>
  const meta = raw.meta
  if (!meta || typeof meta !== 'object') return fresh
  const peerId = typeof meta.peerId === 'string' && meta.peerId ? meta.peerId : fresh.meta.peerId
  const scope = Array.isArray(meta.scope) ? meta.scope.filter((s): s is string => typeof s === 'string' && s.length > 0) : []
  let store: FosStore
  try {
    const ctx = raw.context
    if (!ctx || typeof ctx !== 'object' || typeof ctx.rootNodeId !== 'string') throw new Error('no context')
    store = new FosStore({ fosCtxData: { fosData: { nodes: ctx.nodes ?? {}, route: [], rootNodeId: ctx.rootNodeId }, trellisData: fresh.store.trellisData } })
    rootTargetCid(store) // validates the root alias shape
    normalizeReplicaRefs(store)
  } catch (error) {
    console.warn('stored replica unreadable, starting fresh', error)
    store = fresh.store
  }
  // A context stored in an older cid format was migrated by the store; follow the base along.
  const remappedBase = typeof meta.baseCid === 'string' ? store.remapCid(meta.baseCid) : null
  const baseCid = remappedBase && store.table.has(remappedBase) ? remappedBase : null
  return {
    store,
    meta: {
      version: SYNC_FORMAT_VERSION,
      peerId,
      scope,
      scopeNames: Array.isArray(meta.scopeNames) && meta.scopeNames.length === scope.length ? meta.scopeNames.map(String) : [...scope],
      baseCid,
      lastSyncAt: typeof meta.lastSyncAt === 'number' ? meta.lastSyncAt : null,
      serverPeerId: typeof meta.serverPeerId === 'string' ? meta.serverPeerId : null
    }
  }
}

export function headCid(replica: Replica): string {
  return rootTargetCid(replica.store)
}

export function isDirty(replica: Replica): boolean {
  const head = headCid(replica)
  if (replica.meta.baseCid) return head !== replica.meta.baseCid
  return valueContent(replica.store, head).children.length > 0 // a scoped replica's head may be a ref node
}

export function hasSynced(replica: Replica): boolean {
  return replica.meta.baseCid !== null
}

export function view(replica: Replica, at: Scope): NodeView | null {
  const cid = resolveScope(replica.store, headCid(replica), at)
  return cid ? viewNode(replica.store, cid) : null
}

/** Names along the attached scope plus a path below it, for labels. */
export function pathNames(replica: Replica, at: Scope = []): string[] {
  return [...replica.meta.scopeNames, ...scopeNames(replica.store, headCid(replica), at)]
}

export function scopeLabel(replica: Replica, at: Scope = []): string {
  const names = pathNames(replica, at)
  return names.length === 0 ? '/' : '/' + names.join('/')
}

// ---------------------------------------------------------------------------
// Local edits. Each returns the same replica object (the store is mutated and
// the root advanced); callers treat the returned value as the new state.

function edit(replica: Replica, at: Scope, now: number, fn: (value: FosNodeContent) => FosNodeContent): Replica {
  const next = updateAtScope(replica.store, headCid(replica), at, fn)
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Like `edit`, but `fn` sees the identity node at `at` (the ref node of a link row): for bookkeeping. */
function editNode(replica: Replica, at: Scope, now: number, fn: (node: FosNodeContent) => FosNodeContent): Replica {
  const next = updateAtScope(replica.store, headCid(replica), at, fn, 'node')
  commitRoot(replica.store, next, now)
  return { ...replica }
}

function findTaskEdge(replica: Replica, value: FosNodeContent, taskId: string) {
  const edge = findEdge(replica.store, value, `a:${taskId}`)
  return edge && edge[1] === replica.store.primitive.completeField.getId() ? edge : undefined
}

/** A child row carrying `aliasId` (any row kind, including legacy plain rows). */
function findChildEdge(replica: Replica, value: FosNodeContent, aliasId: string) {
  const edge = findEdge(replica.store, value, `a:${aliasId}`)
  return edge && isRowEdge(replica.store, edge) ? edge : undefined
}

export function addTask(replica: Replica, at: Scope, title: string, now: number, id: string = newId()): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, taskContent(id, trimmed, false, now, now))
    return { ...value, children: [...value.children, taskEdge(replica.store, cid)] }
  })
}

export type AddRowOptions = { done?: boolean; refId?: string; author?: { id: string; name: string }; position?: MovePosition; id?: string; targetCid?: string }

/** Append (or place at `position`) a row of `kind` under the node at `at`. Refs need `refId`; notes keep `text` as their markdown body. */
export function addRow(replica: Replica, at: Scope, kind: RowKind, text: string, now: number, options: AddRowOptions = {}): Replica {
  const body = kind === 'note' ? text.replace(/\s+$/, '') : text.trim()
  if (!body && kind !== 'ref' && kind !== 'plain') return replica // a blank plain row is fine: Enter creates one to type into
  if (kind === 'ref' && !options.refId) return replica
  const id = options.id ?? newId()
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, rowContent(kind, id, body, now, { done: options.done, refId: options.refId, author: options.author, targetCid: options.targetCid, store: replica.store }))
    const edge = rowEdge(replica.store, kind, cid)
    const children = [...value.children]
    const pos = options.position
    if (pos && 'relativeTo' in pos) {
      const sibling = findEdge(replica.store, value, `a:${pos.relativeTo}`)
      const index = sibling ? children.indexOf(sibling) : -1
      if (index >= 0) { children.splice(pos.position === 'above' ? index : index + 1, 0, edge); return { ...value, children } }
    }
    children.push(edge)
    return { ...value, children }
  })
}

/** Change what kind of row `aliasId` is (plain ↔ task ↔ note ↔ comment). Refs keep their target when converted back. */
export function setRowKind(replica: Replica, at: Scope, aliasId: string, kind: RowKind, now: number): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, aliasId)
    if (!edge) return value
    if (rowKindOf(replica.store, edge) === kind && !isPartitionEdge(replica.store, edge)) return value
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const converted = withChildValue(replica.store, edge, convertRowContent(node, kind, now), now)
    return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, kind, identityCid(replica.store, converted)))
  })
}

/** Insert a reference row pointing at `targetAliasId` (any row in the replica) under `at`, optionally at `position`. */
export function addRef(replica: Replica, at: Scope, targetAliasId: string, now: number, position?: MovePosition): Replica {
  // the referenced row becomes a mutable reference (ref node) so the handle can point at it
  const found = resolveRef(replica, targetAliasId)
  let r = replica
  if (found && !found.row.isLink) r = makeLinkAt(r, [...found.path, targetAliasId], now)
  const targetPath = found ? [...found.path, targetAliasId] : null
  const targetCid = targetPath ? resolveScope(r.store, headCid(r), targetPath) : null
  const options = { refId: targetAliasId, targetCid: targetCid ?? undefined }
  if (position && 'into' in position) return addRow(r, [...at, position.into], 'ref', '', now, options)
  return addRow(r, at, 'ref', '', now, { ...options, position })
}

/** Copy the row `aliasId` (with its subtree, fresh ids) from `fromPath` to `toPath` at `position`. */
export function copyNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const from = resolveScope(replica.store, headCid(replica), fromPath)
  if (!from) return replica
  const found = findEdge(replica.store, valueContent(replica.store, from), `a:${aliasId}`)
  if (!found) return replica
  const kind = rowKindOf(replica.store, found)
  if (!kind) return replica
  const copied = copyRowContent(replica.store, identityCid(replica.store, found), now, newId)
  const edge = rowEdge(replica.store, kind, copied)
  const target = 'into' in position ? [...toPath, position.into] : toPath
  return edit(replica, target, now, (value) => {
    const children = [...value.children]
    if ('relativeTo' in position) {
      const sibling = findEdge(replica.store, value, `a:${position.relativeTo}`)
      const index = sibling ? children.indexOf(sibling) : -1
      if (index >= 0) { children.splice(position.position === 'above' ? index : index + 1, 0, edge); return { ...value, children } }
    }
    children.push(edge)
    return { ...value, children }
  })
}

/** Resolve a reference row's target: path (relative to the replica) and view, or null when it no longer exists. */
export function resolveRef(replica: Replica, targetAliasId: string): { path: Scope; row: TaskView } | null {
  const root = headCid(replica)
  return root ? findRowByAlias(replica.store, root, targetAliasId) : null
}

function updateTask(replica: Replica, at: Scope, taskId: string, now: number, change: (task: FosNodeContent) => FosNodeContent | null): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, taskId)
    if (!edge) return value
    // edits apply to the row's content; for a link row that is the ref node's value (the ref then advances with PREV)
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const next = change(node)
    if (!next) return value
    const nextValue = { ...next, data: { ...next.data, updated: { time: now } } }
    return replaceEdge(replica.store, value, `a:${taskId}`, withChildValue(replica.store, edge, nextValue, now))
  })
}

export function setTaskDone(replica: Replica, at: Scope, taskId: string, done: boolean, now: number): Replica {
  return updateTask(replica, at, taskId, now, (task) => {
    if (!task.data.todo) return null // only tasks have a completion
    if (!!task.data.todo?.completed === done) return null
    return { ...task, data: { ...task.data, todo: { completed: done, time: task.data.todo?.time ?? now } } }
  })
}

export function renameTask(replica: Replica, at: Scope, taskId: string, title: string, now: number): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  return updateTask(replica, at, taskId, now, (task) => {
    if (task.data.description?.content === trimmed) return null
    return { ...task, data: { ...task.data, description: { content: trimmed } } }
  })
}

export function deleteTask(replica: Replica, at: Scope, taskId: string, now: number): Replica {
  return edit(replica, at, now, (value) => {
    if (!findChildEdge(replica, value, taskId)) return value
    return replaceEdge(replica.store, value, `a:${taskId}`, null)
  })
}

export function resolve(replica: Replica, at: Scope, choiceId: string, pick: number | null, now: number): Replica {
  return edit(replica, at, now, (value) => resolveChoiceIn(replica.store, value, choiceId, pick, now))
}

/** @deprecated Legacy plain nodes are no longer created by the apps; kept for tests over older data. */
export function addPartition(replica: Replica, at: Scope, name: string, now: number, id: string = newId()): Replica {
  const clean = name.trim()
  if (!clean) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, partitionContent(id, clean))
    return { ...value, children: [...value.children, partitionEdge(replica.store, cid)] }
  })
}

/** Move a node within the tree. `fromPath`/`toPath` are relative to the replica. */
export function moveNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const next = moveChild(replica.store, headCid(replica), fromPath, aliasId, toPath, position)
  if (!next || next === headCid(replica)) return replica
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Make the node at `at` a link node (keeps history, can have members and proposals). */
export function makeLinkAt(replica: Replica, at: Scope, now: number): Replica {
  return editNode(replica, at, now, (node) => makeLink(replica.store, node, now))
}

export function addMemberAt(replica: Replica, at: Scope, peerId: string, name: string | null, capabilities: Capability[], now: number): Replica {
  return editNode(replica, at, now, (node) => withMember(replica.store, makeLink(replica.store, node, now), peerId, name, capabilities))
}

/**
 * Apply a proposal at the link node `at`: three-way merge its content onto the
 * main content (fast-forward when it was rebased onto the current main), record
 * the previous version, and drop the proposal.
 */
export function applyProposalAt(replica: Replica, at: Scope, proposalCid: string, approverPeerId: string, now: number): Replica {
  const store = replica.store
  return editNode(replica, at, now, (value) => {
    const proposal = readProposal(store, proposalCid)
    if (!proposal) return value
    const main = putStripped(store, value)
    const mergedCid = proposal.baseCid === main
      ? proposal.contentCid
      : mergeNodes(store, proposal.baseCid, main, proposal.contentCid, { ours: approverPeerId, theirs: proposal.peerId }).cid
    const linkCid = put(store, value) // current version's cid, for the PREV edge
    const relinked = relinkContent(store, value, linkCid, content(store, mergedCid), now)
    return removeProposalByCid(store, relinked, proposalCid)
  })
}

/** Owner side: remove a device from the node at `at` (its PEER and MEMBER edges). */
export function removePeerAt(replica: Replica, at: Scope, peerId: string, now: number): Replica {
  return editNode(replica, at, now, (node) => withoutPeer(replica.store, node, peerId))
}

export function rejectProposalAt(replica: Replica, at: Scope, proposalCid: string, now: number): Replica {
  return editNode(replica, at, now, (node) => markProposalRejected(replica.store, node, proposalCid))
}

// ---------------------------------------------------------------------------
// Sync round trip

export function buildSyncRequest(replica: Replica, branch?: string): SyncRequest {
  const head = headCid(replica)
  const base = replica.meta.baseCid
  // The server already holds everything reachable from the agreed base.
  const known = base ? reachableSet(replica.store, [base]) : new Set<string>()
  return {
    version: SYNC_FORMAT_VERSION,
    cidVersion: CURRENT_CID_VERSION,
    peerId: replica.meta.peerId,
    scope: replica.meta.scope,
    baseCid: base,
    headCid: head,
    nodes: reachableNodes(replica.store, [head], known),
    ...(branch ? { branch } : {})
  }
}

export type CompleteSyncResult = { replica: Replica; reMerged: boolean; newChoiceIds: string[] }

export function completeSync(replica: Replica, request: SyncRequest, response: SyncResponse, now: number = Date.now()): CompleteSyncResult {
  if (response.scope.length !== request.scope.length || response.scope.some((s, i) => s !== request.scope[i])) {
    throw new Error('sync response scope does not match request scope')
  }
  const applied = applySyncResponse(replica.store, request, response, replica.meta.peerId, now)
  return {
    replica: {
      store: replica.store,
      meta: { ...replica.meta, baseCid: response.resultCid, lastSyncAt: now, serverPeerId: response.peerId }
    },
    reMerged: applied.reMerged,
    newChoiceIds: applied.newChoiceIds
  }
}

/**
 * Attach this device at a different scope. Requires a fully synced replica so
 * nothing local is lost. Moving deeper keeps the matching subtree and base;
 * anywhere else starts an empty link that pulls on the next sync.
 */
export function reattach(replica: Replica, newScope: Scope, now: number, names?: string[]): Replica {
  if (isDirty(replica)) throw new Error('cannot change scope with unsynced local changes')
  const { store, meta } = replica
  const isPrefix = meta.scope.length <= newScope.length && meta.scope.every((s, i) => newScope[i] === s)
  const relative = newScope.slice(meta.scope.length)
  const target = isPrefix ? resolveScope(store, headCid(replica), relative) : null
  if (target) {
    const scopeNamesNext = names ?? pathNames(replica, relative)
    commitRoot(store, target, now)
    return { store, meta: { ...meta, scope: [...newScope], scopeNames: scopeNamesNext, baseCid: resolveScope(store, meta.baseCid, relative) } }
  }
  commitRoot(store, put(store, { data: {}, children: [] }), now)
  return { store, meta: { ...meta, scope: [...newScope], scopeNames: names ?? [...newScope], baseCid: null } }
}
