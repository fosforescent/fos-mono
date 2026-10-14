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
  HOME_ID,
  homeContextCid,
  canonicalRowData,
  type Capability,
  type CapabilityKind,
  type MovePosition,
  type NodeView,
  type RowExtras,
  type RowKind,
  SYNC_FORMAT_VERSION,
  type Scope,
  type TaskView,
  commitRoot,
  content,
  convertRowContent,
  copyRowContent,
  exportReachableContext,
  findChild,
  findEdge,
  findRowByAlias,
  findTemplate,
  refNodeContent,
  refTypeCid,
  refBindingBaseCid,
  isRefNode,
  proposalContent,
  withProposal,
  readProposals,
  withPrev,
  bookkeepingOf,
  isMemberEdge,
  isChoiceEdge,
  capabilityOf,
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
  taskBlockers,
  taskContent,
  taskEdge,
  updateAtScope,
  valueContent,
  viewNode,
  withChildValue,
  withIdentity,
  readMembers,
  withMember,
  withoutMember,
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

export function createReplica(peerId: string = newId(), store: FosStore = new FosStore()): Replica {
  return {
    store,
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

/** Home is an ordinary constructor child of the account root, with a stable identity. */
export function homePath(replica: Replica): Scope {
  return findChild(replica.store, headCid(replica), HOME_ID) ? [HOME_ID] : []
}

/** Move legacy document rows into Home without copying their identities or losing root bookkeeping. */
export function ensureHomeContext(replica: Replica, now: number): Replica {
  if (replica.meta.scope.length) return replica
  const before = headCid(replica)
  const next = homeContextCid(replica.store, before, now)
  if (next === before) return replica
  commitRoot(replica.store, next, now)
  return { ...replica }
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

export type AddRowOptions = Omit<RowExtras, 'store'> & { position?: MovePosition; id?: string }

/** Append (or place at `position`) a row of `kind` under the node at `at`. Refs need `refId`; notes keep `text` as their markdown body. */
export function addRow(replica: Replica, at: Scope, kind: RowKind, text: string, now: number, options: AddRowOptions = {}): Replica {
  const body = kind === 'note' ? text.replace(/\s+$/, '') : text.trim()
  if (!body && !['ref', 'plain', 'comment', 'requirement', 'supply', 'allocation'].includes(kind)) return replica // blank plain rows and comments are fine (Enter / "Add comment" create one to type into); supplies/allocations describe themselves
  if (kind === 'ref' && !options.refId) return replica
  const id = options.id ?? newId()
  return edit(replica, at, now, (value) => {
    const { position: _p, id: _i, ...extras } = options
    const cid = put(replica.store, rowContent(kind, id, body, now, { ...extras, store: replica.store }))
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
/**
 * Rewrite a row in place from re-parsed text: new kind, text and data (requirement, allocation, resource, query,
 * done) while it keeps its alias id and children. What editing a row's raw text ("-$ 50 lunch" → "-: 1h lunch") does.
 */
export function setRowContentAt(replica: Replica, at: Scope, aliasId: string, kind: RowKind, text: string, extras: Omit<RowExtras, 'store'>, now: number): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, aliasId)
    if (!edge) return value
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const converted = convertRowContent(node, kind, now)
    const body = kind === 'note' ? text.replace(/\s+$/, '') : text.trim()
    const data: FosNodeContent['data'] = { ...converted.data, description: { content: body } }
    if (kind === 'task') data.todo = { completed: !!extras.done, time: node.data.todo?.time ?? now }
    if (kind === 'requirement' && extras.requirement) {
      const canonical = rowContent(kind, aliasId, body, now, extras).data
      if (canonical.allocation) { data.allocation = canonical.allocation; delete data.requirement }
      else data.requirement = extras.requirement
    }
    if (kind === 'allocation' && extras.allocation) data.allocation = extras.allocation
    if (kind === 'resource' && extras.resource) data.resource = extras.resource
    if (kind === 'query' && extras.query) data.query = { ...(node.data.query ?? {}), ...extras.query }
    if (kind === 'comment' && node.data.comment) data.comment = { ...node.data.comment, content: body }
    const next = withChildValue(replica.store, edge, { ...converted, data: canonicalRowData(data) }, now)
    return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, kind, identityCid(replica.store, next)))
  })
}

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

/** Satisfy a requirement row at `at`/`requirementId` with a supply (who, and for search/allocation which row by alias id). */
export function addSupply(replica: Replica, at: Scope, requirementId: string, supply: { capability: CapabilityKind; by: string; ref?: string; choice?: number }, now: number, id?: string): Replica {
  const labels: Record<CapabilityKind, string> = {
    confirmation: `confirmed by ${supply.by}`,
    choice: `chose option ${(supply.choice ?? 0) + 1}`,
    search: 'search results',
    allocation: 'allocation',
    task: 'task done',
    market: `listed on the market by ${supply.by}`,
    mail: `mail sent by ${supply.by}`,
    peer: `done by ${supply.by}`,
    llm: `answered by ${supply.by}`,
    repo: `issue opened by ${supply.by}`,
    tool: `run by ${supply.by}`
  }
  return addRow(replica, [...at, requirementId], 'supply', labels[supply.capability], now, { supply: { ...supply, at: now }, id })
}

/** The template row called `name` anywhere in the replica (first match, depth-first), or null. */
export function findTemplateByName(replica: Replica, name: string): { path: Scope; row: TaskView; cid: string } | null {
  const root = headCid(replica)
  return root ? findTemplate(replica.store, root, name) : null
}

/**
 * Instantiate a template's owned subtree with fresh identities, reset completion and no supplies.
 * Copy and instantiation share the same traversal and internal-reference remapping.
 */
export function instantiateTemplate(replica: Replica, at: Scope, taskId: string, templateId: string, now: number): Replica {
  const template = resolveRef(replica, templateId)
  if (!template || template.row.kind !== 'template') return replica
  const templateCid = resolveScope(replica.store, headCid(replica), [...template.path, templateId])
  const taskCid = resolveScope(replica.store, headCid(replica), [...at, taskId])
  if (!templateCid || !taskCid || !valueContent(replica.store, taskCid).data.todo) return replica
  const copied = content(replica.store, copyRowContent(replica.store, templateCid, now, newId, { instantiate: true, rootId: taskId }))
  return updateTask(replica, at, taskId, now, (task) => ({
    ...task,
    data: { ...task.data, template: { id: templateId, name: template.row.title } },
    children: [...task.children, ...copied.children]
  }))
}

/** List (or delist) a link row on the market: a flag on its ref node, no content version. */
export function setMarketAt(replica: Replica, at: Scope, listed: boolean, now: number, by?: string): Replica {
  return editNode(replica, at, now, (node) => {
    const ref = makeLink(replica.store, node, now)
    if (listed === !!ref.data.listing) return ref === node ? node : ref
    const { listing: _m, ...rest } = ref.data
    return { ...ref, data: listed ? { ...rest, listing: { listedAt: now, ...(by ? { by } : {}) } } : rest }
  })
}

/** Change a query row's options (market flag, executed stamp). */
export function setQueryOptionsAt(replica: Replica, at: Scope, queryId: string, patch: Partial<NonNullable<FosNodeContent['data']['query']>>, now: number): Replica {
  return updateTask(replica, at, queryId, now, (row) => (row.data.query ? { ...row, data: { ...row.data, query: { ...row.data.query, ...patch } } } : null))
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
  if (done) {
    // a task with unsatisfied requirements cannot be completed (the view's `blockedBy` says what is missing)
    const parent = resolveScope(replica.store, headCid(replica), at)
    const taskCid = parent ? findChild(replica.store, parent, taskId) : null
    if (taskCid && taskBlockers(replica.store, taskCid).length) return replica
  }
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

/** Clear the attached Home's rows and choices as one ordinary, syncable edit. */
export function resetHomeContent(replica: Replica, now: number): Replica {
  return edit(replica, homePath(replica), now, (value) => ({ ...value,
    children: value.children.filter((edge) => !isRowEdge(replica.store, edge) && !isChoiceEdge(replica.store, edge))
  }))
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
 * Owner side: what the member `peerId` of the node at `at` is granted (its capability rows), and which of those are
 * switched off. A switched-off capability keeps its edge (the peer has seen it and shows it as offline) but does not
 * count for `hasCapability`. Bookkeeping on the ref node: no version.
 */
export function setMemberCapabilitiesAt(replica: Replica, at: Scope, peerId: string, capabilities: Capability[], disabled: Capability[], now: number, accepts?: Capability[]): Replica {
  return editNode(replica, at, now, (node) => {
    const link = makeLink(replica.store, node, now)
    const existing = readMembers(replica.store, link).find((m) => m.peerId === peerId)
    return withMember(replica.store, link, peerId, existing?.name ?? null, capabilities, disabled, accepts ?? existing?.accepts ?? [])
  })
}

/** Owner side: drop the member `peerId` from the node at `at` (its capabilities with it). */
export function removeMemberAt(replica: Replica, at: Scope, peerId: string, now: number): Replica {
  return editNode(replica, at, now, (node) => withoutMember(replica.store, node, peerId))
}

/** Replace a member's advertisements for one capability, retaining its other grants. */
export function setMemberHandlersAt(replica: Replica, at: Scope, peerId: string, capability: Capability, handlers: string[], now: number): Replica {
  return editNode(replica, at, now, (node) => ({ ...node, children: node.children.map((edge) => {
    if (!isMemberEdge(replica.store, edge)) return edge
    const member = content(replica.store, edge[1])
    if (member.data.peerId?.content !== peerId) return edge
    const children = handlers.map((cid): [string, string] => [replica.store.primitive.capabilityNode.getId(), cid])
    children.push(...member.children.filter((e) => capabilityOf(replica.store, e) !== capability))
    return [edge[0], put(replica.store, { ...member, children })]
  }) }))
}

/** Add a typed mutable argument using the existing ref shape. No separate binding record. */
export function addRefAt(replica: Replica, at: Scope, id: string, typeCid: string, now: number, defaultCid: string | null = null): Replica {
  return edit(replica, at, now, (value) => {
    if (findEdge(replica.store, value, `a:${id}`)) return value
    const ref = put(replica.store, refNodeContent(replica.store, { alias: { id }, updated: { time: now } }, defaultCid, [], typeCid))
    return { ...value, children: [...value.children, [typeCid, ref]] }
  })
}

/** Submit a value (which can itself be a ref) through the ordinary proposal format. */
export function proposeRefAt(replica: Replica, at: Scope, targetCid: string, peerId: string, now: number): { replica: Replica; proposalCid: string } {
  const store = replica.store
  const cid = resolveScope(store, headCid(replica), at)
  if (!cid || !store.table.has(targetCid)) throw new Error('ref or proposed value not found')
  const ref = content(store, cid)
  if (!isRefNode(store, ref) || !refTypeCid(store, ref)) throw new Error('expected a typed ref')
  const proposalCid = put(store, proposalContent(store, peerId, 'binding', targetCid, refBindingBaseCid(store, ref), now))
  return { replica: editNode(replica, at, now, (node) => withProposal(store, node, peerId, proposalCid, 'binding')), proposalCid }
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
    if (!proposal || proposal.status !== 'open' || !readProposals(store, value).some((p) => p.cid === proposalCid)) return value
    const main = putStripped(store, value)
    // A typed slot accepts a value atomically; merging two handlers would invent a handler.
    if (refTypeCid(store, value)) {
      if (proposal.baseCid !== refBindingBaseCid(store, value)) return value
      const next = refNodeContent(store, { ...value.data, updated: { time: now } }, proposal.contentCid, bookkeepingOf(store, value), refTypeCid(store, value))
      return removeProposalByCid(store, withPrev(store, next, put(store, value)), proposalCid)
    }
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

/** Discard a rejected local branch and return to its accepted base; the next sync clears its proposal. */
export function discardOwnProposalAt(replica: Replica, at: Scope, proposalCid: string, now: number): Replica {
  return editNode(replica, at, now, (node) => {
    const proposal = readProposals(replica.store, node).find((p) => p.cid === proposalCid && p.peerId === replica.meta.peerId && p.status === 'rejected')
    if (!proposal) return node
    return refNodeContent(replica.store, { ...node.data, updated: { time: now } }, proposal.baseCid, bookkeepingOf(replica.store, node), refTypeCid(replica.store, node))
  })
}

export function rejectProposalAt(replica: Replica, at: Scope, proposalCid: string, now: number): Replica {
  return editNode(replica, at, now, (node) => markProposalRejected(replica.store, node, proposalCid))
}

// ---------------------------------------------------------------------------
// Sync round trip

/**
 * The request for one sync round. With `push: false` (the device's policy towards the peer has no `autopush`) the
 * request carries no local content: the head sent is the agreed base (an empty node before the first sync), so the
 * peer only serves what it has and nothing but the connection leaves the device; local edits stay local, re-merged
 * over whatever comes back (`completeSync` merges sent head → local head → result).
 */
export function buildSyncRequest(replica: Replica, branch?: string, options: { push?: boolean; full?: boolean } = {}): SyncRequest {
  const base = replica.meta.baseCid
  const head = options.push === false ? (base ?? put(replica.store, { data: {}, children: [] })) : headCid(replica)
  // The server already holds everything reachable from the agreed base.
  const known = base && !options.full ? reachableSet(replica.store, [base]) : new Set<string>()
  return {
    version: SYNC_FORMAT_VERSION,
    cidVersion: CURRENT_CID_VERSION,
    peerId: replica.meta.peerId,
    scope: replica.meta.scope,
    baseCid: base,
    headCid: head,
    nodes: reachableNodes(replica.store, options.full ? [head, base] : [head], known),
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
