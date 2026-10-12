/**
 * Device replica: a FosStore whose root alias points at the node this device is
 * attached to (the whole user-group document for scope [], or one partition),
 * plus the link metadata needed to sync it.
 *
 * Every edit creates new content nodes (path copy) and advances the root alias
 * with a PREV link, so the local history is a proper chain in the graph.
 */

import { FosStore } from '../dag-implementation/store'
import { CURRENT_CID_VERSION } from '../dag-implementation/cid'
import type { FosContextData, FosNodeContent } from '../types'
import {
  SYNC_FORMAT_VERSION,
  commitRoot,
  content,
  exportReachableContext,
  findEdge,
  makeLink,
  moveChild,
  newId,
  partitionContent,
  partitionEdge,
  put,
  putStripped,
  reachableNodes,
  reachableSet,
  markProposalRejected,
  readProposal,
  relinkContent,
  removeProposalByCid,
  replaceEdge,
  resolveScope,
  rootTargetCid,
  scopeNames,
  taskContent,
  taskEdge,
  updateAtScope,
  viewNode,
  withMember,
  withoutPeer,
  type Capability,
  type MovePosition,
  type NodeView,
  type Scope
} from './graph'
import { mergeNodes, resolveChoiceIn } from './merge'
import { applySyncResponse, type SyncRequest, type SyncResponse } from './protocol'

export type ReplicaMeta = {
  version: typeof SYNC_FORMAT_VERSION
  peerId: string
  scope: Scope
  /** Display names of the partitions along `scope` (a scoped replica cannot resolve them itself). */
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
  return content(replica.store, head).children.length > 0
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

function findTaskEdge(replica: Replica, value: FosNodeContent, taskId: string) {
  const edge = findEdge(replica.store, value, `a:${taskId}`)
  return edge && edge[1] === replica.store.primitive.completeField.getId() ? edge : undefined
}

export function addTask(replica: Replica, at: Scope, title: string, now: number, id: string = newId()): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, taskContent(id, trimmed, false, now, now))
    return { ...value, children: [...value.children, taskEdge(replica.store, cid)] }
  })
}

function updateTask(replica: Replica, at: Scope, taskId: string, now: number, change: (task: FosNodeContent) => FosNodeContent | null): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findTaskEdge(replica, value, taskId)
    if (!edge) return value
    const task = content(replica.store, edge[0])
    const next = change(task)
    if (!next) return value
    const cid = put(replica.store, { ...next, data: { ...next.data, updated: { time: now } } })
    return replaceEdge(replica.store, value, `a:${taskId}`, taskEdge(replica.store, cid))
  })
}

export function setTaskDone(replica: Replica, at: Scope, taskId: string, done: boolean, now: number): Replica {
  return updateTask(replica, at, taskId, now, (task) => {
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
    if (!findTaskEdge(replica, value, taskId)) return value
    return replaceEdge(replica.store, value, `a:${taskId}`, null)
  })
}

export function resolve(replica: Replica, at: Scope, choiceId: string, pick: number | null, now: number): Replica {
  return edit(replica, at, now, (value) => resolveChoiceIn(replica.store, value, choiceId, pick, now))
}

export function addPartition(replica: Replica, at: Scope, name: string, now: number, id: string = newId()): Replica {
  const clean = name.trim()
  if (!clean) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, partitionContent(id, clean))
    return { ...value, children: [...value.children, partitionEdge(replica.store, cid)] }
  })
}

/** Move a task (or partition) within the tree. `fromPath`/`toPath` are relative to the replica. */
export function moveNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const next = moveChild(replica.store, headCid(replica), fromPath, aliasId, toPath, position)
  if (!next || next === headCid(replica)) return replica
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Make the node at `at` a link node (keeps history, can have members and proposals). */
export function makeLinkAt(replica: Replica, at: Scope, now: number): Replica {
  return edit(replica, at, now, (value) => makeLink(value, now))
}

export function addMemberAt(replica: Replica, at: Scope, peerId: string, name: string | null, capabilities: Capability[], now: number): Replica {
  return edit(replica, at, now, (value) => withMember(replica.store, makeLink(value, now), peerId, name, capabilities))
}

/**
 * Apply a proposal at the link node `at`: three-way merge its content onto the
 * main content (fast-forward when it was rebased onto the current main), record
 * the previous version, and drop the proposal.
 */
export function applyProposalAt(replica: Replica, at: Scope, proposalCid: string, approverPeerId: string, now: number): Replica {
  const store = replica.store
  return edit(replica, at, now, (value) => {
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
  return edit(replica, at, now, (value) => withoutPeer(replica.store, value, peerId))
}

export function rejectProposalAt(replica: Replica, at: Scope, proposalCid: string, now: number): Replica {
  return edit(replica, at, now, (value) => markProposalRejected(replica.store, value, proposalCid))
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
