import { nodeBranches, materializedNodePaths, nodeShape, sameNodeShape, nodeSyncKey, nodePersistenceAllowed } from './node-sync'
/**
 * Device replica: a FosStore whose root alias points at the node this device is
 * attached to (the whole user-group document for scope [], or one node),
 * plus what node sync agreed on with its peer, per synced node (`nodeSync`).
 *
 * Every edit creates new content nodes (path copy) and advances the root alias
 * with a PREV link, so the local history is a proper chain in the graph.
 */

import { FosStore } from '../dag-implementation/store'
import type { FosContextData, FosNodeContent } from '../types'
import { constructForm, formFields, formTitle, positionFormRows, setFormTitle, type FormInput } from './forms'
import { definitionRowKind } from './legacy-row-types'
import { legacyCommentMetadata } from './legacy-comment'
import {
  withMainBranchPolicy, capabilityTarget, refValueCid, putRefValueBranches, selectBranch, isBranchChoice, branchEdge, branchSelection, readChoice, scopeBranches,
  HOME_ID,
  CAPABILITIES,
  homeContextCid,
  canonicalRowData,
  type Capability,
  type CapabilityKind,
  type MovePosition,
  type NodeView,
  type RowExtras,
  type RowKind,
  type Scope,
  type TaskView,
  commitRoot,
  content,
  convertRowContent,
  convertRow,
  copyRowContent,
  exportReachableContext,
  findChild,
  findEdge,
  findRowByAlias,
  findNearestRow,
  rowView,
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
  isRowEdge,
  keptRowTemplate,
  makeLink,
  markProposalRejected,
  moveChild,
  newId,
  normalizeRefs,
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
  rowEdgeAt,
  rowKindOf,
  rowTemplate,
  currentRowDefinition,
  rowTemplateOf,
  scopeNames,
  taskBlockers,
  taskContent,
  updateAtScope,
  valueCidOf,
  valueContent,
  viewNode,
  withChildValue,
  withIdentity,
  withRowTemplate,
  readMembers,
  withMember,
  withPeer,
  withoutMember,
  withoutPeer, ensureLibraryRow, isShippedLibrary, rootStoredTarget, type HostOffers } from './graph'
import { mergeNodes, resolveChoiceIn } from './merge'
import { assertNoNewTypeErrors, rootTypeError, typeErrorOf } from './patterns'

export type ReplicaMeta = {
  nodeSync?: Record<string, import('./node-sync').NodeSyncState>
  /** Projections of nodes other accounts shared with this one, by local path (JSON): whose, and where in their account. */
  sharedNodes?: Record<string, { owner: string; scope: Scope }>
  /**
   * Nodes opened from another store on this machine (desktop), by the alias id of the row they were opened at (so a
   * move keeps them): the store (peer) and the node's address there. Edits below them go back to it (`App.syncLocalStores`).
   */
  heldNodes?: Record<string, { peer: string; scope: Scope }>
  peerId: string
  scope: Scope
  /** Display names of the nodes along `scope` (a scoped replica cannot resolve them itself). */
  scopeNames: string[]
  /** Local subtree shared by this attachment; its parent remains private to this peer. */
  localScope?: Scope
  lastSyncAt: number | null
  serverPeerId: string | null
  branch?: string
  branches?: Record<string, string>
}

export type Replica = { store: FosStore; meta: ReplicaMeta }

export type SerializedReplica = { meta: ReplicaMeta; context: FosContextData }

/**
 * A replica over `store`, or a new device root: a store with nothing above it is a device's own root, which ships the
 * standard library (its rows are made from its Row types). Other roots (a project, a document) are nested in a device
 * root (`nestScope`) and resolve their rows through it.
 */
export function createReplica(peerId: string = newId(), existing?: FosStore): Replica {
  const store = existing ?? new FosStore()
  if (!existing) ensureLibraryRow(store)
  return {
    store,
    meta: { peerId, scope: [], scopeNames: [], lastSyncAt: null, serverPeerId: null }
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
  return { meta: replica.meta, context: exportReachableContext(replica.store, []) }
}

/** Rebuild a replica from untrusted JSON. Falls back to a fresh replica on any problem. */
export function loadReplica(input: unknown): Replica {
  // a bare root: whether a loaded replica is a device root is the caller's to say (`ensureDeviceLibrary`)
  const fresh = createReplica(undefined, new FosStore())
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
    // rows a type does not accept (an older replica, or one written elsewhere) become type errors
    commitRoot(store, rootTargetCid(store), 0)
  } catch (error) {
    console.warn('stored replica unreadable, starting fresh', error)
    store = fresh.store
  }
  return {
    store,
    meta: {
      peerId,
      scope,
      scopeNames: Array.isArray(meta.scopeNames) && meta.scopeNames.length === scope.length ? meta.scopeNames.map(String) : [...scope],
      ...(meta.nodeSync && typeof meta.nodeSync === 'object' ? { nodeSync: remapNodeSync(store, meta.nodeSync) } : {}),
      ...(meta.sharedNodes && typeof meta.sharedNodes === 'object' ? { sharedNodes: meta.sharedNodes } : {}),
      ...(meta.heldNodes && typeof meta.heldNodes === 'object' ? { heldNodes: meta.heldNodes } : {}),
      ...(Array.isArray(meta.localScope) && meta.localScope.length <= 64 && meta.localScope.every(id => typeof id === 'string') ? { localScope: [...meta.localScope] } : {}),
      lastSyncAt: typeof meta.lastSyncAt === 'number' ? meta.lastSyncAt : null,
      serverPeerId: typeof meta.serverPeerId === 'string' ? meta.serverPeerId : null,
      ...(typeof meta.branch === 'string' ? { branch: meta.branch } : {}),
      ...(meta.branches && typeof meta.branches === 'object' ? { branches: Object.fromEntries(Object.entries(meta.branches).filter(([, name]) => typeof name === 'string')) } : {})
    }
  }
}

/** A context stored in an older cid format was migrated by the store: the template cids node sync recorded follow along. */
function remapNodeSync(store: FosStore, records: NonNullable<ReplicaMeta['nodeSync']>): NonNullable<ReplicaMeta['nodeSync']> {
  if (!store.migration) return records
  const shape = <T extends { children?: Array<{ template: string }> }>(value: T): T => Array.isArray(value?.children) ? { ...value, children: value.children.map(child => ({ ...child, template: store.remapCid(child.template) })) } : value
  return Object.fromEntries(Object.entries(records).map(([key, state]) => [key, { ...state, local: shape(state.local), remote: shape(state.remote) }]))
}

/** Home is an ordinary constructor child of the account root, with a stable identity. */
export function homePath(replica: Replica): Scope {
  return findChild(replica.store, headCid(replica), HOME_ID) ? [HOME_ID] : []
}

/** Move legacy document rows into Home without copying their identities or losing root bookkeeping. */
export function ensureHomeContext(replica: Replica, now: number, offers?: HostOffers): Replica {
  if (replica.meta.scope.length) return replica
  const before = headCid(replica)
  const next = homeContextCid(replica.store, before, now, offers)
  if (next === before) return replica
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Attach a device's Home to the corresponding shared node, retaining its private root. */
export function shareHome(replica: Replica): Replica {
  if (replica.meta.scope.length || replica.meta.localScope?.length || !homePath(replica).length) return replica
  return { ...replica, meta: { ...replica.meta, localScope: [HOME_ID] } }
}

export function headCid(replica: Replica): string {
  return rootTargetCid(replica.store)
}

/**
 * Whether this device holds changes its peer (`serverPeerId`) has not accepted: a synced node whose shape differs from
 * what node sync last agreed on, or one never synced. Before there is a peer, any content counts (the shipped library
 * does not: it is never exchanged).
 */
export function isDirty(replica: Replica): boolean {
  const peer = replica.meta.serverPeerId, local = replica.meta.localScope ?? []
  if (!peer) {
    const head = resolveScope(replica.store, headCid(replica), local)
    return !head || valueContent(replica.store, head).children.some(edge => !isShippedLibrary(replica.store, local, edge))
  }
  return materializedNodePaths(replica, local).some(path => {
    if (!nodePersistenceAllowed(replica, path)) return false
    const state = replica.meta.nodeSync?.[nodeSyncKey(peer, path, nodeBranches(replica, path))]
    return !state || !sameNodeShape(nodeShape(replica, path), state.local)
  })
}

export function hasSynced(replica: Replica): boolean {
  return replica.meta.lastSyncAt !== null
}

export function view(replica: Replica, at: Scope, constructors = false): NodeView | null {
  const cid = resolveScope(replica.store, headCid(replica), at)
  if (!cid) return null
  const node = viewNode(replica.store, cid, constructors)
  // a node in type error: which of its rows its type does not accept (the error is on its edge, or on the root)
  const rejected = typeErrorAt(replica, at)
  if (rejected?.length) {
    node.typeError = rejected
    for (const row of node.tasks) if (rejected.includes(row.id)) row.rejected = true
  }
  return node
}

/** The rows the node at `at` holds that its type does not accept, or null when it is not a type error. */
export function typeErrorAt(replica: Replica, at: Scope): string[] | null {
  const store = replica.store
  if (!at.length) return rootTypeError(store, rootStoredTarget(store))
  const parent = resolveScope(store, headCid(replica), at.slice(0, -1))
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : undefined
  return edge ? typeErrorOf(store, edge) : null
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
  return commitEdit(replica, updateAtScope(replica.store, headCid(replica), at, fn), now)
}

/** Like `edit`, but `fn` sees the identity node at `at` (the ref node of a link row): for bookkeeping. */
function editNode(replica: Replica, at: Scope, now: number, fn: (node: FosNodeContent) => FosNodeContent): Replica {
  return commitEdit(replica, updateAtScope(replica.store, headCid(replica), at, fn, 'node'), now)
}

/**
 * Commit a local edit. One that would put a row where its parent's type does not accept it is refused (received
 * changes become type errors instead, sync/patterns.ts); the store stays as it was.
 */
function commitEdit(replica: Replica, next: string, now: number): Replica {
  const store = replica.store, rootBefore = store.rootNodeId, before = rootStoredTarget(store)
  commitRoot(store, next, now)
  try { assertNoNewTypeErrors(store, before, rootStoredTarget(store)) } catch (error) { store.rootNodeId = rootBefore; throw error }
  return { ...replica }
}

function editPolicy(replica: Replica, at: Scope, now: number, fn: (node: FosNodeContent) => FosNodeContent): Replica {
  return withMainBranchPolicy(replica.store, () => {
    if (!resolveScope(replica.store, headCid(replica), at)) throw new Error('Peer policy can only be changed on a node present in main.')
    return editNode(replica, at, now, fn)
  })
}

/** A child row carrying `aliasId` (any row kind). */
function findChildEdge(replica: Replica, value: FosNodeContent, aliasId: string) {
  const edge = findEdge(replica.store, value, `a:${aliasId}`)
  return edge && (isRowEdge(replica.store, edge) || content(replica.store, identityCid(replica.store, edge)).data.name?.content.startsWith('fos:setting:')) ? edge : undefined
}

/** Parse single-brace parameters into ordinary named mutable-ref children.
 * Existing bindings survive text edits; deterministic aliases make concurrent parses converge.
 * Double-brace legacy substitutions remain references to the surrounding context.
 */
function withTextParameters(store: FosStore, node: FosNodeContent): FosNodeContent {
  const text = node.data.presentation?.text?.interpolate ? formTitle(store, node) : node.data.description?.content ?? ''
  const names = [...new Set(Array.from(text.matchAll(/(?<![\\{@])\{([A-Za-z_][\w.-]*)\}(?!\})/g), m => m[1]))]
  const type = store.primitive.documentField.getId(), children = [...node.children]
  for (const name of names) {
    if (name === undefined) continue
    if (children.some(edge => { const child = content(store, identityCid(store, edge)); return child.data.name?.content === name && refTypeCid(store, child) === type })) continue
    const id = `${node.data.alias?.id ?? newId()}:param:${name}`
    const ref = put(store, refNodeContent(store, { alias: { id }, name: { content: name } }, null, [], type))
    children.push([type, ref])
  }
  return children.length === node.children.length ? node : { ...node, children }
}

export function addTask(replica: Replica, at: Scope, title: string, now: number, id: string = newId()): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, withTextParameters(replica.store, taskContent(id, trimmed, false, now, now)))
    return { ...value, children: [...value.children, rowEdgeAt(replica.store, 'task', cid, at)] }
  })
}

export type AddRowOptions = Omit<RowExtras, 'store'> & { position?: MovePosition; id?: string }

/** Instantiate any graph-defined constructor, including definitions unknown to this client. */
export function addConstructedRow(replica: Replica, at: Scope, template: string, input: FormInput, now: number, id = newId()): Replica {
  return edit(replica, at, now, value => {
    const node = withTextParameters(replica.store, constructForm(replica.store, template, id, input, now))
    return { ...value, children: [...value.children, [template, put(replica.store, node)]] }
  })
}

/** Local graph authoring for the CLI: edit a node or add a row with an explicit instruction. */
export function writeGraphNode(replica: Replica, at: Scope, node: FosNodeContent, now: number, instruction?: string): Replica {
  if (!node || !node.data || typeof node.data !== 'object' || Array.isArray(node.data) || !Array.isArray(node.children) || node.children.some(edge => !Array.isArray(edge) || edge.length !== 2 || edge.some(cid => typeof cid !== 'string' || !replica.store.table.has(cid)))) throw new Error('A node needs data and rows whose instruction and target CIDs exist in this store.')
  if ('instanceKind' in node.data) throw new Error('Define this type with graph rows, not instanceKind.')
  if (instruction) {
    if (!replica.store.table.has(instruction) || !node.data.alias?.id) throw new Error('A new row needs an existing instruction and an alias id.')
    return edit(replica, at, now, parent => {
      if (findChildEdge(replica, parent, node.data.alias!.id)) throw new Error('This parent already has that row id.')
      return { ...parent, children: [...parent.children, [instruction, put(replica.store, node)]] }
    })
  }
  if (!resolveScope(replica.store, headCid(replica), at)) throw new Error('Node not found.')
  return edit(replica, at, now, previous => ({ ...node, data: { ...node.data, ...(previous.data.alias ? { alias: previous.data.alias } : {}) } }))
}

/** Upgrade legacy row payloads only at the write boundary. Existing children remain ordinary rows. */
function constructRowValue(replica: Replica, template: string, id: string, text: string, extras: Omit<RowExtras, 'store'>, now: number, previous?: FosNodeContent): FosNodeContent {
  const legacy = previous?.data.comment
  const node = constructForm(replica.store, template, id, { text, author: extras.author ?? (legacy ? { id: legacy.authorID, name: legacy.authorName } : { id: replica.meta.peerId, name: replica.meta.peerId }) }, now)
  if (previous) {
    const { description: _description, comment: _comment, todo: _todo, presentation: _presentation, scalar: _scalar, ...data } = previous.data
    node.data = { ...data, ...node.data, created: { time: legacy?.time ?? previous.data.created?.time ?? now } }
    node.children.push(...previous.children, ...legacyCommentMetadata(replica.store, previous, id, now))
  }
  return withTextParameters(replica.store, node)
}

/**
 * Append a row of the row type `type` (a type's cid, e.g. from `libraryTypeAt`) holding `text` under the node at
 * `at`: the edge is `[type, row]`, so the type alone says what the row is. A type with a form is constructed from it
 * (its text field gets `text`); a type without one holds `text` as the row's description.
 */
export function addTypedRow(replica: Replica, at: Scope, type: string, text: string, now: number, id: string = newId()): Replica {
  const body = text.replace(/\s+$/, '').replace(/^\s*\n/, '')
  if (!body.trim()) return replica
  const definition = content(replica.store, type)
  return edit(replica, at, now, (value) => {
    const node = definition.data.form ? constructRowValue(replica, type, id, body, {}, now) : withTextParameters(replica.store, rowContent('plain', id, body.trim(), now, { store: replica.store }))
    return { ...value, children: [...value.children, [type, put(replica.store, node)]] }
  })
}

/** Append (or place at `position`) a row of `kind` under the node at `at`. Refs need `refId`; notes keep `text` as their markdown body. */
export function addRow(replica: Replica, at: Scope, kind: RowKind, text: string, now: number, options: AddRowOptions = {}): Replica {
  const body = kind === 'note' ? text.replace(/\s+$/, '') : text.trim()
  if (!body && !['ref', 'plain', 'comment', 'requirement', 'supply', 'allocation'].includes(kind)) return replica // blank plain rows and comments are fine (Enter / "Add comment" create one to type into); supplies/allocations describe themselves
  if (kind === 'ref' && !options.refId) return replica
  const id = options.id ?? newId()
  return edit(replica, at, now, (value) => {
    const { position: _p, id: _i, ...extras } = options
    const parent = at.length ? resolveScope(replica.store, headCid(replica), at.slice(0, -1)) : null
    const parentEdge = parent ? findEdge(replica.store, valueContent(replica.store, parent), `a:${at.at(-1)}`) : null
    const parentType = parentEdge ? rowTemplateOf(replica.store, parentEdge) : null
    const repeated = kind === 'plain' && parentType && content(replica.store, parentType).data.form?.repeat ? formFields(replica.store, parentType)[0]?.type : null
    const template = repeated ?? rowTemplate(replica.store, kind, at)
    const constructed = content(replica.store, template).data.form
    const numeric = constructed?.primitive === 'number' || constructed?.primitive === 'time'
    const node = repeated ? constructForm(replica.store, template, id, numeric ? Number(body) : body, now) : constructed ? constructRowValue(replica, template, id, body, extras, now) : withTextParameters(replica.store, rowContent(kind, id, body, now, { ...extras, store: replica.store }))
    if (repeated) { node.data.name = { content: id }; node.data.position = { value: value.children.length } }
    const cid = repeated ? put(replica.store, refNodeContent(replica.store, { alias: { id }, name: { content: id } }, put(replica.store, node))) : put(replica.store, node)
    const edge = repeated ? rowEdge(replica.store, kind, cid, template) : rowEdgeAt(replica.store, kind, cid, at)
    const children = [...value.children]
    const pos = options.position
    if (pos && 'relativeTo' in pos) {
      const sibling = findEdge(replica.store, value, `a:${pos.relativeTo}`)
      const index = sibling ? children.indexOf(sibling) : -1
      if (index >= 0) { children.splice(pos.position === 'above' ? index : index + 1, 0, edge); return positionFormRows(replica.store, { ...value, children }, now) }
    }
    children.push(edge)
    return positionFormRows(replica.store, { ...value, children }, now)
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
    const body = node.data.scalar?.type === 'text' || node.data.presentation?.text ? text : kind === 'note' ? text.replace(/\s+$/, '') : text.trim()
    const kept = keptRowTemplate(replica.store, edge, kind)
    const template = kept ? put(replica.store, currentRowDefinition(replica.store, content(replica.store, kept))) : rowTemplate(replica.store, kind, at)
    if (content(replica.store, template).data.form) {
      const constructed = node.data.presentation || node.data.scalar
        ? withTextParameters(replica.store, setFormTitle(replica.store, node, body, now))
        : constructRowValue(replica, template, aliasId, body, extras, now, node)
      const next = withChildValue(replica.store, edge, constructed, now)
      return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, kind, identityCid(replica.store, next), template))
    }
    const converted = convertRow(replica.store, node, kind, now)
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
    const next = withChildValue(replica.store, edge, withTextParameters(replica.store, { ...converted, data: canonicalRowData(data) }), now)
    const changed = identityCid(replica.store, next)
    return replaceEdge(replica.store, value, `a:${aliasId}`, kept ? rowEdge(replica.store, kind, changed, kept) : rowEdgeAt(replica.store, kind, changed, at))
  })
}

export function setRowKind(replica: Replica, at: Scope, aliasId: string, kind: RowKind, now: number): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, aliasId)
    if (!edge) return value
    if (rowKindOf(replica.store, edge) === kind) return value
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const template = rowTemplate(replica.store, kind, at)
    const next = content(replica.store, template).data.form ? constructRowValue(replica, template, aliasId, formTitle(replica.store, node), {}, now, node) : convertRow(replica.store, node, kind, now)
    const converted = withChildValue(replica.store, edge, next, now)
    return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdgeAt(replica.store, kind, identityCid(replica.store, converted), at))
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

/** The template row called `name` that a row at `at` sees (nearest ancestor first), or null. */
export function findTemplateByName(replica: Replica, name: string, at: Scope = []): { path: Scope; row: TaskView; cid: string } | null {
  const root = headCid(replica)
  return root ? findTemplate(replica.store, root, name, at) : null
}

/**
 * Instantiate a template's owned subtree with fresh identities, reset completion and no supplies.
 * Copy and instantiation share the same traversal and internal-reference remapping.
 */
export function instantiateTemplate(replica: Replica, at: Scope, taskId: string, templateId: string, now: number): Replica {
  const template = resolveRef(replica, templateId, at)
  if (!template || template.row.kind !== 'template') return replica
  const templateCid = resolveScope(replica.store, headCid(replica), [...template.path, templateId])
  if (!templateCid || taskId === templateId || !resolveScope(replica.store, headCid(replica), [...at, taskId])) return replica
  return instantiateTemplateValue(replica, at, taskId, templateCid, now)
}

/** Local templates and advertised templates use the same copy/remap operation. */
export function instantiateTemplateValue(replica: Replica, at: Scope, taskId: string, templateCid: string, now: number): Replica {
  if (!replica.store.table.has(templateCid)) throw new Error('Template content is unavailable.')
  const taskCid = resolveScope(replica.store, headCid(replica), [...at, taskId])
  if (!taskCid) throw new Error('Template destination is unavailable.')
  if (definitionRowKind(valueContent(replica.store, templateCid)) !== 'task') throw new Error('Only template rows can be instantiated.')
  const copied = content(replica.store, copyRowContent(replica.store, templateCid, now, newId, { instantiate: true, rootId: taskId }))
  // The task is made from the template: the template becomes its row edge's instruction (pinned to this version).
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, taskId)
    if (!edge) return value
    const task = valueContent(replica.store, identityCid(replica.store, edge))
    const next = withChildValue(replica.store, edge, { ...task, data: { ...task.data, updated: { time: now } }, children: [...task.children, ...copied.children] }, now)
    return replaceEdge(replica.store, value, `a:${taskId}`, withRowTemplate(replica.store, next, valueCidOf(replica.store, templateCid)))
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
  const target = 'into' in position ? [...toPath, position.into] : toPath
  const kept = keptRowTemplate(replica.store, found, kind)
  const edge = kept ? rowEdge(replica.store, kind, copied, kept) : rowEdgeAt(replica.store, kind, copied, target)
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
/** The row with alias `targetAliasId` that a row at `at` refers to: by nearest ancestor (`findNearestRow`). */
export function resolveRef(replica: Replica, targetAliasId: string, at: Scope = []): { path: Scope; row: TaskView } | null {
  const root = headCid(replica)
  const found = root ? findNearestRow(replica.store, root, at, row => row.id === targetAliasId) : null
  return found ? { path: found.path, row: rowView(replica.store, found.cid, found.kind, found.edge) } : null
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
  const parent = resolveScope(replica.store, headCid(replica), at)
  const edge = parent && findChildEdge(replica, valueContent(replica.store, parent), taskId)
    if (edge && (valueContent(replica.store, identityCid(replica.store, edge)).data.comment || rowKindOf(replica.store, edge) === 'note')) return setRowContentAt(replica, at, taskId, rowKindOf(replica.store, edge)!, title, {}, now)
  return updateTask(replica, at, taskId, now, (task) => {
      if (task.data.presentation || task.data.scalar) return withTextParameters(replica.store, setFormTitle(replica.store, task, task.data.presentation?.text ? title : trimmed, now))
    if (task.data.description?.content === trimmed) return null
    return withTextParameters(replica.store, { ...task, data: { ...task.data, description: { content: trimmed } } })
  })
}

/** Clear the attached Home's rows and choices as one ordinary, syncable edit. */
export function resetHomeContent(replica: Replica, now: number): Replica {
  return edit(replica, homePath(replica), now, (value) => ({ ...value,
    children: value.children.filter((edge) => !isRowEdge(replica.store, edge) && !isChoiceEdge(replica.store, edge))
  }))
}

export function deleteTask(replica: Replica, at: Scope, taskId: string, now: number): Replica {
  const parent = resolveScope(replica.store, headCid(replica), at)
  const edge = parent && findEdge(replica.store, content(replica.store, parent), `a:${taskId}`)
  if (edge && [replica.store.primitive.memberField.getId(), replica.store.primitive.peerField.getId()].includes(edge[0])) return editNode(replica, at, now, node => replaceEdge(replica.store, node, `a:${taskId}`, null))
  return edit(replica, at, now, (value) => {
    if (!findChildEdge(replica, value, taskId)) return value
    return replaceEdge(replica.store, value, `a:${taskId}`, null)
  })
}

export function resolve(replica: Replica, at: Scope, choiceId: string, pick: number | null, now: number): Replica {
  return edit(replica, at, now, (value) => resolveChoiceIn(replica.store, value, choiceId, pick, now))
}

/** Move a node within the tree. `fromPath`/`toPath` are relative to the replica. */
export function moveNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const next = moveChild(replica.store, headCid(replica), fromPath, aliasId, toPath, position)
  if (!next || next === headCid(replica)) return replica
  return commitEdit(replica, next, now)
}

/** Make the node at `at` a link node (keeps history, can have members and proposals). */
export function makeLinkAt(replica: Replica, at: Scope, now: number): Replica {
  return editNode(replica, at, now, (node) => makeLink(replica.store, node, now))
}

export function addMemberAt(replica: Replica, at: Scope, peerId: string, name: string | null, capabilities: Capability[], now: number): Replica {
  return editPolicy(replica, at, now, (node) => withMember(replica.store, makeLink(replica.store, node, now), peerId, name, capabilities))
}

/**
 * Link another `.fos` store on this machine (desktop: Home's store, a store in an ancestor directory, or one that links
 * this one): a member of this store's root, the peer that store is (its own device id), reached through its files
 * (`local`). Both are this person's own stores, so it is granted everything; what reaches it is still that grant,
 * like any peer's. On the first link the store also appears like any other peer: under its entry in Settings, a row
 * held by it standing for what it shares (`shares`: Home in Home's store, else its root); it can be moved or linked
 * anywhere from there, and so can its nodes. Idempotent.
 */
export function linkLocalStore(replica: Replica, peerId: string, name: string, now: number, shares: Scope = []): Replica {
  const member = readMembers(replica.store, content(replica.store, headCid(replica))).find(m => m.peerId === peerId)
  if (member && member.name === name && CAPABILITIES.every(c => member.capabilities.includes(c))) return replica
  let next = editNode(replica, [], now, (node) => withMember(replica.store, node, peerId, name, CAPABILITIES))
  if (!member) {
    const id = `store:${peerId}`, store = next.store
    const held = put(store, { data: { alias: { id }, description: { content: name }, ref: { id, peer: peerId, version: 'unloaded', kind: 'plain', scope: [...shares] } }, children: [] })
    const entry = [`fos:peer:${peerId}`]
    next = edit(next, entry, now, (value) => findChildEdge(next, value, id) ? value : { ...value, children: [...value.children, rowEdgeAt(store, 'plain', held, entry)] })
  }
  return next
}

/** The stores this one is linked with on this machine (members reached through files). */
export function localStores(replica: Replica): Array<{ peerId: string; name: string }> {
  return readMembers(replica.store, content(replica.store, headCid(replica))).filter(m => m.capabilities.includes('local') && !m.disabled?.includes('local')).map(m => ({ peerId: m.peerId, name: m.name ?? m.peerId }))
}

/**
 * Owner side: what the member `peerId` of the node at `at` is granted (its capability rows), and which of those are
 * switched off. A switched-off capability keeps its edge (the peer has seen it and shows it as offline) but does not
 * count for `hasCapability`. Bookkeeping on the ref node: no version.
 */
export function setMemberCapabilitiesAt(replica: Replica, at: Scope, peerId: string, capabilities: Capability[], disabled: Capability[], now: number, accepts?: Capability[]): Replica {
  return editPolicy(replica, at, now, (node) => {
    const link = makeLink(replica.store, node, now)
    const existing = readMembers(replica.store, link).find((m) => m.peerId === peerId)
    const next = withMember(replica.store, link, peerId, existing?.name ?? null, capabilities, disabled, accepts ?? existing?.accepts ?? [])
    return peerId === 'fos' && disabled.includes('persist') ? withPeer(replica.store, next, replica.meta.peerId) : next
  })
}

/** Owner side: drop the member `peerId` from the node at `at` (its capabilities with it). */
export function removeMemberAt(replica: Replica, at: Scope, peerId: string, now: number): Replica {
  return editPolicy(replica, at, now, (node) => withoutMember(replica.store, node, peerId))
}

/** Materialize the nearest inherited member before overriding its offers locally. Called in main policy context. */
function localMember(replica: Replica, at: Scope, node: FosNodeContent, peerId: string): FosNodeContent {
  if (!node.children.some(e => isMemberEdge(replica.store, e) && content(replica.store, e[1]).data.peerId?.content === peerId)) {
    let inherited: [string, string] | undefined
    for (let depth = 0; depth < at.length; depth++) {
      const cid = resolveScope(replica.store, headCid(replica), at.slice(0, depth))
      if (!cid) continue
      const current = content(replica.store, cid)
      const active = isBranchChoice(replica.store, current) ? branchEdge(replica.store, cid) : null
      const policy = active ? content(replica.store, identityCid(replica.store, active)) : current
      const edge = policy.children.find(e => isMemberEdge(replica.store, e) && content(replica.store, e[1]).data.peerId?.content === peerId)
      if (edge) inherited = edge
    }
    if (!inherited) throw new Error('Peer no longer exists.')
    node = { ...node, children: [...node.children, inherited] }
  }
  return node
}

/** Publish typed offers without requiring registration in the built-in capability vocabulary. */
export function setHandlerOffersAt(replica: Replica, at: Scope, peerId: string, type: string, handlers: string[], now: number, direction: 'from' | 'to' = 'from'): Replica {
  const s = replica.store, marker = direction === 'from' ? s.primitive.acceptsNode.getId() : s.primitive.capabilityNode.getId()
  if (!s.table.has(type) || handlers.some(cid => !s.table.has(cid) || refTypeCid(s, content(s, cid)) !== type)) throw new Error('Handler type does not match its advertised capability.')
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return { ...node, children: node.children.map(edge => {
      if (!isMemberEdge(s, edge)) return edge
      const member = content(s, edge[1]); if (member.data.peerId?.content !== peerId) return edge
      const children = member.children.filter(e => e[0] !== marker || (refTypeCid(s, content(s, e[1])) ?? e[1]) !== type)
      children.push(...[...new Set(handlers)].map(cid => [marker, cid] as [string, string]))
      return [edge[0], put(s, { ...member, children })]
    }) }
  })
}

/** Node-local menu constructor overrides, inherited through the peer binding. */
export function setConstructorEnabledAt(replica: Replica, at: Scope, peerId: string, id: string, enabled: boolean, now: number): Replica {
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return { ...node, children: node.children.map(edge => {
      if (!isMemberEdge(replica.store, edge)) return edge
      const member = content(replica.store, edge[1]); if (member.data.peerId?.content !== peerId) return edge
      const disabled = new Set<string>(member.data.disabledCapabilities?.content ?? [])
      if (enabled) disabled.delete(`fos:constructor:${id}`); else disabled.add(`fos:constructor:${id}`)
      return [edge[0], put(replica.store, { ...member, data: { ...member.data, disabledCapabilities: { content: [...disabled] } } })]
    }) }
  })
}

/** Disable one configured handler without deleting it or changing its type. */
export function setHandlerEnabledAt(replica: Replica, at: Scope, peerId: string, id: string, enabled: boolean, now: number): Replica {
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return { ...node, children: node.children.map(edge => {
      if (!isMemberEdge(replica.store, edge)) return edge
      const member = content(replica.store, edge[1]); if (member.data.peerId?.content !== peerId) return edge
      if (!member.children.some(e => (e[0] === replica.store.primitive.acceptsNode.getId() || e[0] === replica.store.primitive.capabilityNode.getId()) && (content(replica.store, e[1]).data.alias?.id ?? e[1]) === id)) throw new Error('Handler no longer exists.')
      const disabled = new Set(member.data.disabledCapabilities?.content ?? [])
      if (enabled) disabled.delete(id); else disabled.add(id)
      return [edge[0], put(replica.store, { ...member, data: { ...member.data, disabledCapabilities: { content: [...disabled] } } })]
    }) }
  })
}

/** Add a typed mutable argument using the existing ref shape. No separate binding record. */
export function addRefAt(replica: Replica, at: Scope, id: string, typeCid: string, now: number, defaultCid: string | null = null, name?: string): Replica {
  return edit(replica, at, now, (value) => {
    if (findEdge(replica.store, value, `a:${id}`)) return value
    const ref = put(replica.store, refNodeContent(replica.store, { alias: { id }, ...(name ? { name: { content: name } } : {}), updated: { time: now } }, defaultCid, [], typeCid))
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
      const previous = refValueCid(store, value)
      let target = proposal.contentCid
      if (previous && previous !== target) {
        const inherited = Object.values(scopeBranches(store, headCid(replica), at.slice(0, -1))).at(-1) ?? replica.meta.branch ?? 'main'
        target = putRefValueBranches(store, value, [previous, target], inherited, target)
        selectBranch(store, value.data.alias!.id, readChoice(store, target).defaultName!)
      }
      const next = refNodeContent(store, { ...value.data, updated: { time: now } }, target, bookkeepingOf(store, value), refTypeCid(store, value))
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

export function rejectProposalAt(replica: Replica, at: Scope, proposalCid: string, now: number): Replica {
  return editNode(replica, at, now, (node) => markProposalRejected(replica.store, node, proposalCid))
}

/**
 * Sync a different node of this device root with its peer. Requires a fully synced replica so nothing local is lost;
 * what node sync agreed on per node stays, so moving back onto a node synced before resumes it.
 */
export function reattach(replica: Replica, newScope: Scope): Replica {
  if (isDirty(replica)) throw new Error('cannot change scope with unsynced local changes')
  const { store, meta } = replica
  const local = newScope.length ? newScope.slice(meta.scope.length) : homePath(replica)
  if (!meta.scope.every((id, i) => newScope[i] === id) || !resolveScope(store, headCid(replica), local)) throw new Error('The requested shared node is not available below this device root.')
  return { store, meta: { ...meta, localScope: local, branch: undefined, branches: undefined } }
}
