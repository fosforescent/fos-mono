import { sameCapabilityType } from './capabilities'
import { refValueCompatible } from './scoped-refs'
import { matchesGraph } from './structural'
import { parseRefExpression, textRefExpressions } from './ref-paths'
import { contextMemberRefs, discoverHandlers, marketplaceOffers } from './handlers'
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
import { UnsupportedDataVersionError } from '../dag-implementation/cid'
import type { FosContextData, FosNodeContent, FosPathElem } from '../types'
import { constructForm, formFields, formText, formTitle, formValueAt, positionFormRows, setFormTitle, type FormInput } from './forms'
import { ALLOCATION_TYPE, COMMENT_TYPE, NOTE_TYPE, PLAIN_TYPE, QUERY_TYPE, REF_TYPE, RESOURCE_TYPE, TASK_TYPE, TEMPLATE_TYPE, isAllocationType } from './library-types'
import { legacyCommentMetadata } from './legacy-comment'
import { knownUser, publishPeerKey, userType, withUserField, type UserRecord } from './users'
import {
  withMainBranchPolicy, capabilityTarget, refValueCid, putRefValueBranches, selectBranch, isBranchChoice, branchEdge, branchSelection, readChoice, scopeBranches,
  HOME_ID,
  CAPABILITIES,
  homeContextCid,
  canonicalRowData,
  type Capability,
  type MovePosition,
  type NodeView,
  type RowExtras,
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
  isLibraryType,
  libraryTypeAt,
  findRowByAlias,
  findNearestRow,
  rowView,
  findTemplate,
  refNodeContent,
  advertisement, advertisedRows,
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
  keptRowType,
  isTemplateType,
  isRowOfType,
  resolveRowType,
  rowTypeOf,
  typeIdOf,
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
  withoutPeer, ensureLibraryRow, isShippedLibrary, rootStoredTarget, importNodes, type HostOffers } from './graph'
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
  return { store, meta: { peerId, scope: [], scopeNames: [], lastSyncAt: null, serverPeerId: null } }
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

/**
 * Rebuild a replica from untrusted JSON. Falls back to a fresh replica on any problem, including data written in
 * another data version (`UnsupportedDataVersionError`): older data is not migrated, it is reset.
 */
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
    if (error instanceof UnsupportedDataVersionError) console.warn(`${error.message} Starting with a fresh replica.`)
    else console.warn('stored replica unreadable, starting fresh', error)
    store = fresh.store
  }
  return {
    store,
    meta: {
      peerId,
      scope,
      scopeNames: Array.isArray(meta.scopeNames) && meta.scopeNames.length === scope.length ? meta.scopeNames.map(String) : [...scope],
      ...(meta.nodeSync && typeof meta.nodeSync === 'object' ? { nodeSync: meta.nodeSync } : {}),
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

/** Home is an ordinary constructor child of the account root, with a stable identity. */
export function homePath(replica: Replica): Scope {
  return findChild(replica.store, headCid(replica), HOME_ID) ? [HOME_ID] : []
}

/** Remember initialization in the graph so reopening a store cannot resurrect withdrawn refs. */
export function nativeDefaultsApplied(replica: Replica, at: Scope, source: string): boolean {
  const cid = resolveScope(replica.store, headCid(replica), at)
  return !!cid && (!!content(replica.store, cid).data.nativeDefaults?.sources.includes(source) || !!valueContent(replica.store, cid).data.nativeDefaults?.sources.includes(source))
}

export function markNativeDefaultsApplied(replica: Replica, at: Scope, source: string, now: number): Replica {
  if (nativeDefaultsApplied(replica, at, source)) return replica
  const next = updateAtScope(replica.store, headCid(replica), at, node => ({ ...node, data: { ...node.data,
    nativeDefaults: { sources: [...(node.data.nativeDefaults?.sources ?? []), source] }
  } }), 'node')
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Move legacy document rows into Home without copying their identities or losing root bookkeeping. */
export function ensureHomeContext(replica: Replica, now: number, offers?: HostOffers): Replica {
  if (replica.meta.scope.length) return replica
  const before = headCid(replica)
  const seeded = nativeDefaultsApplied(replica, [], 'server')
  const next = homeContextCid(replica.store, before, now, seeded ? {} : offers)
  let r = replica
  if (next !== before) { commitRoot(replica.store, next, now); r = { ...replica } }
  // the host's peers publish their public keys in Home, where node exchange carries them to every device
  for (const [peerId, publicKey] of Object.entries(offers?.keys ?? {})) r = publishPeerKey(r, peerId, publicKey, now)
  if (offers?.native && !seeded) {
    importNodes(r.store, offers.native.nodes)
    for (const [peer, refs] of Object.entries(offers.native.peers)) {
      const at = peer === 'fos' ? [] : homePath(r)
      if (!contextMemberRefs(r, at).has(peer)) r = addMemberAt(r, at, peer, peer, [], now)
      const groups = new Map<string, string[]>()
      for (const [type, cid] of refs) {
        if (type) groups.set(type, [...(groups.get(type) ?? []), cid])
      }
      for (const [type, values] of groups) {
        const existing = discoverHandlers(r, at).filter(offer => offer.peerId === peer && sameCapabilityType(r.store, offer.type, type))
        const preserved = existing.filter(offer => !offer.legacy && !values.some(cid => content(r.store, cid).data.alias?.id === offer.id)).map(offer => offer.cid)
        const defaults = values.map(cid => {
          const prior = existing.find(offer => !offer.legacy && offer.id === content(r.store, cid).data.alias?.id)
          if (!prior) return cid
          const target = refValueCid(r.store, content(r.store, prior.cid)), value = target ? content(r.store, target) : null
          const stub = value && value.children.every(edge => content(r.store, type).children.some(row => row[0] === edge[0] && row[1] === edge[1])) && value.data.peerId?.content === peer && value.data.description?.content === prior.capability && Object.keys(value.data).every(key => ['peerId', 'description', 'behavior'].includes(key))
          return stub ? cid : prior.cid
        })
        if (existing.length !== defaults.length + preserved.length || defaults.some(cid => !existing.some(offer => offer.cid === cid))) r = setHandlerOffersAt(r, at, peer, type, [...preserved, ...defaults], now)
      }
    }
    r = markNativeDefaultsApplied(r, [], 'server', now)
  }
  return r
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
  return materializedNodePaths(replica, local, peer).some(path => {
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

/** A child row carrying `aliasId` (a row of any type, or a setting). */
function findChildEdge(replica: Replica, value: FosNodeContent, aliasId: string) {
  const edge = findEdge(replica.store, value, `a:${aliasId}`)
  return edge && (isRowEdge(replica.store, edge) || content(replica.store, identityCid(replica.store, edge)).data.name?.content.startsWith('fos:setting:')) ? edge : undefined
}

/** Parse single-brace parameters into ordinary named mutable-ref children.
 * Existing bindings survive text edits; deterministic aliases make concurrent parses converge.
 * Double-brace legacy substitutions remain references to the surrounding context.
 */
function withTextParameters(store: FosStore, node: FosNodeContent): FosNodeContent {
  const text = node.data.presentation?.headline ? formText(store, node) : node.data.description?.content ?? ''
  const { refExpression: _previousExpression, ...data } = node.data
  node = { ...node, data }
  // A whole-row path is a ref value; braces interpolate paths into text instead.
  if (/^(?:\.|\()/.test(text.trim())) {
    try { node.data.refExpression = parseRefExpression(text) } catch { /* Ordinary prose. */ }
  }
  const names = [...new Set(textRefExpressions(text).filter(expression => expression.declaration).map(expression => expression.source))]
  const type = store.primitive.documentField.getId(), children = [...node.children]
  for (const name of names) {
    if (name === undefined) continue
    if (children.some(edge => { const child = content(store, identityCid(store, edge)); return child.data.name?.content === name && edge[0] === type })) continue
    const id = `${node.data.alias?.id ?? newId()}:param:${name}`
    const expression = parseRefExpression(name)
    const ref = put(store, refNodeContent(store, { alias: { id }, name: { content: name },
      ...(!expression.lexical || expression.path.length > 1 ? { refExpression: expression } : {}) }, null, []))
    children.push([type, ref])
  }
  return children.length === node.children.length ? node : { ...node, children }
}

export function addTask(replica: Replica, at: Scope, title: string, now: number, id: string = newId()): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  return edit(replica, at, now, (value) => {
    const cid = put(replica.store, withTextParameters(replica.store, taskContent(id, trimmed, false, now, now)))
    return { ...value, children: [...value.children, rowEdgeAt(replica.store, TASK_TYPE, cid, at)] }
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
    const node = definition.data.form ? constructRowValue(replica, type, id, body, {}, now) : withTextParameters(replica.store, rowContent(PLAIN_TYPE, id, body.trim(), now, { store: replica.store }))
    return { ...value, children: [...value.children, [type, put(replica.store, node)]] }
  })
}

/** Rows of these types may start blank (Enter / "Add comment" create one to type into; flow entries describe themselves). */
const BLANK_TYPES = [PLAIN_TYPE, COMMENT_TYPE, REF_TYPE]
/** Text a type presents as text (Markdown) keeps its leading whitespace; titles are trimmed. */
const rowBody = (store: FosStore, type: string, text: string) => content(store, type).data.form?.text ? text.replace(/\s+$/, '') : text.trim()

/**
 * Append (or place at `position`) a row of `type` under the node at `at`: a type id (`lib:type:…`: the row type of the
 * library nearest to `at`) or a type cid. A type with a graph form is constructed from it (its text field gets `text`);
 * a native type holds `text` as its title, plus what `options` give it. References need `refId`.
 */
export function addRow(replica: Replica, at: Scope, type: string, text: string, now: number, options: AddRowOptions = {}): Replica {
  const store = replica.store
  const typeId = store.table.has(type) ? typeIdOf(store, type) ?? '' : type
  if (typeId === REF_TYPE && !options.refId) return replica
  const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
  const parentEdge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : null
  const parentType = parentEdge ? rowTypeOf(store, parentEdge) : null
  const repeated = typeId === PLAIN_TYPE && parentType && content(store, parentType).data.form?.repeat ? formFields(store, parentType)[0]?.type : null
  if (!text.trim() && !BLANK_TYPES.includes(typeId) && !isAllocationType(typeId)) return replica
  const template = repeated ?? resolveRowType(store, type, at)
  const body = rowBody(store, template, text)
  const id = options.id ?? newId()
  return edit(replica, at, now, (value) => {
    const { position: _p, id: _i, ...extras } = options
    const constructed = content(store, template).data.form
    const numeric = constructed?.primitive === 'number' || constructed?.primitive === 'time'
    const node = repeated ? constructForm(store, template, id, numeric ? Number(body) : body, now) : constructed ? constructRowValue(replica, template, id, body, extras, now) : withTextParameters(store, rowContent(typeId, id, body, now, { ...extras, store }))
    if (repeated) { node.data.name = { content: id }; node.data.position = { value: value.children.length } }
    const bound = userBound(replica, at, node, extras)
    const cid = repeated ? put(store, refNodeContent(store, { alias: { id }, name: { content: id } }, put(store, bound))) : put(store, bound)
    const edge = repeated ? rowEdge(store, cid, template) : rowEdgeAt(store, template, cid, at)
    const children = [...value.children]
    const pos = options.position
    if (pos && 'relativeTo' in pos) {
      const sibling = findEdge(store, value, `a:${pos.relativeTo}`)
      const index = sibling ? children.indexOf(sibling) : -1
      if (index >= 0) { children.splice(pos.position === 'above' ? index : index + 1, 0, edge); return positionFormRows(store, { ...value, children }, now) }
    }
    children.push(edge)
    return positionFormRows(store, { ...value, children }, now)
  })
}

/**
 * Rewrite a row in place from re-parsed text: new type (a type id), text and data (requirement, allocation, resource,
 * query, done) while it keeps its alias id and children. What editing a row's raw text ("-$ 50 lunch" → "-: 1h lunch") does.
 */
export function setRowContentAt(replica: Replica, at: Scope, aliasId: string, type: string, text: string, extras: Omit<RowExtras, 'store'>, now: number): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, aliasId)
    if (!edge) return value
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const kept = keptRowType(replica.store, edge, type)
    const template = kept ?? resolveRowType(replica.store, type, at)
    const body = node.data.scalar?.type === 'text' || node.data.presentation?.headline ? text : rowBody(replica.store, template, text)
    if (content(replica.store, template).data.form) {
      const constructed = node.data.presentation || node.data.scalar
        ? withTextParameters(replica.store, setFormTitle(replica.store, node, body, now))
        : constructRowValue(replica, template, aliasId, body, extras, now, node)
      const next = withChildValue(replica.store, edge, userBound(replica, at, constructed, extras), now)
      return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, identityCid(replica.store, next), template))
    }
    const converted = convertRow(replica.store, node, type, now, extras)
    const data: FosNodeContent['data'] = { ...converted.data, description: { content: body } }
    if (type === TASK_TYPE) data.todo = { completed: !!extras.done, time: node.data.todo?.time ?? now }
    if (type === RESOURCE_TYPE && extras.resource) data.resource = extras.resource
    if (type === QUERY_TYPE && extras.query) data.query = { ...(node.data.query ?? {}), ...extras.query }
    const next = withChildValue(replica.store, edge, userBound(replica, at, withTextParameters(replica.store, { ...converted, data: canonicalRowData(data) }), extras), now)
    const changed = identityCid(replica.store, next)
    return replaceEdge(replica.store, value, `a:${aliasId}`, kept ? rowEdge(replica.store, changed, kept) : rowEdgeAt(replica.store, template, changed, at))
  })
}

/** The row with its `user` field as `extras.user` says: bound (null removes it); left alone when absent. */
function userBound(replica: Replica, at: Scope, node: FosNodeContent, extras: Omit<RowExtras, 'store'>): FosNodeContent {
  if (extras.user === undefined) return node
  return withUserField(replica.store, node, extras.user && knownUser(replica, extras.user), userType(replica.store, at))
}

/** Bind (or, with null, remove) the `user` field of the row at `at`: the user object `@name` stands for (sync/users.ts). */
export function bindUserAt(replica: Replica, at: Scope, user: UserRecord | null, now: number): Replica {
  if (!at.length || !resolveScope(replica.store, headCid(replica), at)) throw new Error('Row not found.')
  const type = userType(replica.store, at)
  return edit(replica, at, now, value => withUserField(replica.store, value, user, type))
}

/**
 * Make `aliasId` a row of another type (a type id: plain ↔ task ↔ note ↔ comment ↔ …), keeping its text and rows;
 * `extras` give the new type's data (e.g. the requirement an allocation row becomes). A row already of that type stays.
 */
export function setRowType(replica: Replica, at: Scope, aliasId: string, type: string, now: number, extras: Omit<RowExtras, 'store'> = {}): Replica {
  return edit(replica, at, now, (value) => {
    const edge = findChildEdge(replica, value, aliasId)
    if (!edge) return value
    const kept = keptRowType(replica.store, edge, type)
    if (kept && kept === rowTypeOf(replica.store, edge)) return value
    const node = valueContent(replica.store, identityCid(replica.store, edge))
    const template = resolveRowType(replica.store, type, at)
    const next = content(replica.store, template).data.form ? constructRowValue(replica, template, aliasId, formText(replica.store, node), {}, now, node) : convertRow(replica.store, node, type, now, extras)
    const converted = withChildValue(replica.store, edge, next, now)
    return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdgeAt(replica.store, template, identityCid(replica.store, converted), at))
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
  if (position && 'into' in position) return addRow(r, [...at, position.into], REF_TYPE, '', now, options)
  return addRow(r, at, REF_TYPE, '', now, { ...options, position })
}

/** Satisfy a requirement row at `at`/`requirementId` with a supply (who, and for search/allocation which row by alias id). */
export function addSupply(replica: Replica, at: Scope, requirementId: string, supply: { capability: string; by: string; ref?: string; choice?: number }, now: number, id?: string): Replica {
  const labels: Record<string, string> = {
    confirmation: `confirmed by ${supply.by}`,
    choice: `chose option ${(supply.choice ?? 0) + 1}`,
    search: 'search results',
    title: `titled by ${supply.by}`,
    allocation: 'allocation',
    task: 'task done',
    market: `listed on the market by ${supply.by}`,
    mail: `mail sent by ${supply.by}`,
    peer: `done by ${supply.by}`,
    llm: `answered by ${supply.by}`,
    repo: `issue opened by ${supply.by}`,
    tool: `run by ${supply.by}`,
    verify: `verified by ${supply.by}`,
    organize: `organized by ${supply.by}`
  }
  const label = Object.hasOwn(labels, supply.capability) ? labels[supply.capability] : undefined
  return addRow(replica, [...at, requirementId], ALLOCATION_TYPE, label ?? `${supply.capability} supplied by ${supply.by}`, now, { supply: { ...supply, at: now }, id })
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
  if (!template || template.row.type !== TEMPLATE_TYPE) return replica
  const templateCid = resolveScope(replica.store, headCid(replica), [...template.path, templateId])
  if (!templateCid || taskId === templateId || !resolveScope(replica.store, headCid(replica), [...at, taskId])) return replica
  return instantiateTemplateValue(replica, at, taskId, templateCid, now)
}

/** The product a template constructs. Editor placement rules stay on the
 * definition; the resulting pattern contains the same rows as an instance. */
export function templateValuePattern(store: FosStore, templateCid: string): string {
  let field = 0
  const copied = content(store, copyRowContent(store, templateCid, 0, () => `pattern:${templateCid}:${field++}`, { instantiate: true }))
  return put(store, { data: { ...(content(store, templateCid).data.alias ? { alias: content(store, templateCid).data.alias } : {}) }, children: copied.children })
}

/** Local templates and advertised templates use the same copy/remap operation. */
export function instantiateTemplateValue(replica: Replica, at: Scope, taskId: string, templateCid: string, now: number): Replica {
  if (!replica.store.table.has(templateCid)) throw new Error('Template content is unavailable.')
  const taskCid = resolveScope(replica.store, headCid(replica), [...at, taskId])
  if (!taskCid) throw new Error('Template destination is unavailable.')
  if (!isTemplateType(replica.store, templateCid)) throw new Error('Only template rows can be instantiated.')
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

/** A template's icon: part of its presentation. */
export function templateIconAt(replica: Replica, path: Scope): string | null {
  const cid = resolveScope(replica.store, headCid(replica), path)
  const icon = cid ? valueContent(replica.store, cid).data.presentation?.icon : undefined
  return typeof icon === 'string' && icon ? icon : null
}
export function setTemplateIcon(replica: Replica, path: Scope, icon: string, now: number): Replica {
  if (!path.length) throw new Error('Choose a template.')
  return updateTask(replica, path.slice(0, -1), path.at(-1)!, now, row => ({ ...row, data: { ...row.data, presentation: { ...row.data.presentation, icon } } }))
}

/** The standard-library row type of a file kept inline (its data URL in the graph; small files only). */
export const ATTACHMENT_TYPE = 'lib:type:attachment'
export type Attachment = { name: string; type: string; data: string; size: number }
export function addAttachment(replica: Replica, at: Scope, file: Attachment, now: number, id: string = newId()): Replica {
  const template = libraryTypeAt(replica.store, ATTACHMENT_TYPE, at, headCid(replica))
  if (!template) throw new Error('No standard library above this row has an attachment type.')
  return addConstructedRow(replica, at, template, { name: file.name, type: file.type, data: file.data, size: file.size }, now, id)
}
/** The file the row at `path` keeps, when it is an attachment row (by its type, any version of it). */
export function attachmentAt(replica: Replica, path: Scope): Attachment | null {
  if (!path.length) return null
  const parent = resolveScope(replica.store, headCid(replica), path.slice(0, -1))
  const edge = parent ? findEdge(replica.store, valueContent(replica.store, parent), `a:${path.at(-1)}`) : null
  if (!edge || !isLibraryType(replica.store, edge[0], ATTACHMENT_TYPE)) return null
  const node = valueContent(replica.store, identityCid(replica.store, edge))
  const field = (name: string) => formValueAt(replica.store, node, [name])?.data.scalar?.value
  const name = field('name'), type = field('type'), data = field('data'), size = field('size')
  return typeof name === 'string' && typeof type === 'string' && typeof data === 'string' && typeof size === 'number' ? { name, type, data, size } : null
}

/** The standard-library row type of rows that reference a file in a linked directory (web/src/filesystem.ts). */
export const FILE_REFERENCE_TYPE = 'lib:type:file-reference'
/** Its fields: the `/`-separated path relative to the linked directory, and the SHA-256 and size it was made against. */
export type FileReference = { path: string; sha256: string; size: number }
function validFileReference(file: FileReference): boolean {
  return typeof file?.path === 'string' && !!file.path && !file.path.startsWith('/') && !/^[a-z]:/i.test(file.path) && !file.path.includes('\\') &&
    file.path.split('/').every(name => name && name !== '.' && name !== '..') && /^[0-9a-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.size) && file.size >= 0
}
/**
 * A row of the library type `lib:type:file-reference` under `at`: its edge's left node is that type, its values are the
 * type's form fields (ordinary mutable refs, so node exchange, merge and copies carry them). The file's content never
 * enters the graph.
 */
export function addFileReference(replica: Replica, at: Scope, file: FileReference, now: number, id: string = newId()): Replica {
  if (!validFileReference(file)) throw new Error('A file reference needs a relative path and a SHA-256 checksum.')
  const template = libraryTypeAt(replica.store, FILE_REFERENCE_TYPE, at, headCid(replica))
  if (!template) throw new Error('No standard library above this row has a file reference type.')
  return addConstructedRow(replica, at, template, { path: file.path, sha256: file.sha256, size: file.size }, now, id)
}
/** The file-reference row `rowId` under `at`, by its type (any version of it), with its field values. */
function fileReferenceRow(replica: Replica, at: Scope, rowId: string): { edge: FosPathElem; node: FosNodeContent; file: FileReference } | null {
  const parent = resolveScope(replica.store, headCid(replica), at)
  const edge = parent ? findEdge(replica.store, valueContent(replica.store, parent), `a:${rowId}`) : null
  if (!edge || !isLibraryType(replica.store, edge[0], FILE_REFERENCE_TYPE)) return null
  const node = valueContent(replica.store, identityCid(replica.store, edge))
  const field = (name: string) => formValueAt(replica.store, node, [name])?.data.scalar?.value
  const path = field('path'), sha256 = field('sha256'), size = field('size')
  return typeof path === 'string' && typeof sha256 === 'string' && typeof size === 'number' ? { edge, node, file: { path, sha256, size } } : null
}
/** The file the row at `path` references, when it is a file-reference row whose fields are here. */
export function fileReferenceAt(replica: Replica, path: Scope): FileReference | null {
  return path.length ? fileReferenceRow(replica, path.slice(0, -1), path.at(-1)!)?.file ?? null : null
}
/** Re-pin a file reference to the checksum (and size) its file has now: its fields are rewritten in place. */
export function setFileReferenceAt(replica: Replica, at: Scope, rowId: string, file: FileReference, now: number): Replica {
  if (!validFileReference(file)) throw new Error('A file reference needs a relative path and a SHA-256 checksum.')
  if (!fileReferenceRow(replica, at, rowId)) throw new Error('This row is not a file reference.')
  const values: Record<string, string | number> = { path: file.path, sha256: file.sha256, size: file.size }
  return updateTask(replica, at, rowId, now, row => ({ ...row, children: row.children.map(edge => {
    const value = valueContent(replica.store, identityCid(replica.store, edge)), name = value.data.name?.content
    if (!name || !(name in values) || !value.data.scalar || value.data.scalar.value === values[name]) return edge
    return withChildValue(replica.store, edge, { ...value, data: { ...value.data, scalar: { type: value.data.scalar.type, value: values[name]! }, updated: { time: now } } }, now)
  }) }))
}

/** Copy the row `aliasId` (with its subtree, fresh ids) from `fromPath` to `toPath` at `position`. */
export function copyNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const from = resolveScope(replica.store, headCid(replica), fromPath)
  if (!from) return replica
  const found = findEdge(replica.store, valueContent(replica.store, from), `a:${aliasId}`)
  if (!found) return replica
  const type = rowTypeOf(replica.store, found)
  if (!type) return replica
  const copied = copyRowContent(replica.store, identityCid(replica.store, found), now, newId)
  const target = 'into' in position ? [...toPath, position.into] : toPath
  // a copy is a row of the same type (the same pinned version)
  const edge = rowEdge(replica.store, copied, type)
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
  return found ? { path: found.path, row: rowView(replica.store, found.cid, found.edge) } : null
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
    // a note's body and a pre-constructor comment (migrated on edit) are rewritten through their type
    if (edge && (valueContent(replica.store, identityCid(replica.store, edge)).data.comment || isRowOfType(replica.store, edge, NOTE_TYPE))) return setRowContentAt(replica, at, taskId, isRowOfType(replica.store, edge, NOTE_TYPE) ? NOTE_TYPE : COMMENT_TYPE, title, {}, now)
  return updateTask(replica, at, taskId, now, (task) => {
      if (task.data.presentation || task.data.scalar) return withTextParameters(replica.store, setFormTitle(replica.store, task, task.data.presentation?.headline ? title : trimmed, now))
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
    const held = put(store, { data: { alias: { id }, description: { content: name }, ref: { id, peer: peerId, version: 'unloaded', scope: [...shares] } }, children: [] })
    const entry = [`fos:peer:${peerId}`]
    next = edit(next, entry, now, (value) => findChildEdge(next, value, id) ? value : { ...value, children: [...value.children, rowEdgeAt(store, PLAIN_TYPE, held, entry)] })
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
    const cid = contextMemberRefs(replica, at).get(peerId)
    const inherited: [string, string] | undefined = cid ? [replica.store.primitive.memberField.getId(), cid] : undefined
    if (!inherited) throw new Error('Peer no longer exists.')
    node = { ...node, children: [...node.children, inherited] }
  }
  return node
}

/** Publish typed offers without requiring registration in the built-in capability vocabulary. */
export function setHandlerOffersAt(replica: Replica, at: Scope, peerId: string, type: string, handlers: string[], now: number, direction: 'from' | 'to' = 'from'): Replica {
  const s = replica.store, marker = direction === 'from' ? s.primitive.acceptsNode.getId() : s.primitive.capabilityNode.getId()
  if (!s.table.has(type) || handlers.some(cid => !s.table.has(cid) || !matchesGraph(s, type, cid))) throw new Error('Handler value does not match its advertised pattern.')
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return { ...node, children: node.children.map(edge => {
      if (!isMemberEdge(s, edge)) return edge
      const member = content(s, edge[1]); if (member.data.peerId?.content !== peerId) return edge
      const children = member.children.filter(e => e[0] !== marker || !advertisedRows(s, e[1]).some(row => sameCapabilityType(s, row[0], type)))
      children.push(...[...new Set(handlers)].map(cid => [marker, advertisement(s, type, cid)] as [string, string]))
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
  if (!discoverHandlers(replica, at).some(offer => offer.peerId === peerId && offer.id === id) &&
    !marketplaceOffers(replica).some(offer => offer.peerId === peerId && offer.id === id && JSON.stringify(offer.path) === JSON.stringify(at))) throw new Error('Handler no longer exists.')
  return editPolicy(replica, at, now, node => {
    node = contextMemberRefs(replica, at).has(peerId) ? localMember(replica, at, node, peerId) : withMember(replica.store, node, peerId, peerId, [])
    return { ...node, children: node.children.map(edge => {
      if (!isMemberEdge(replica.store, edge)) return edge
      const member = content(replica.store, edge[1]); if (member.data.peerId?.content !== peerId) return edge
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
    const ref = put(replica.store, refNodeContent(replica.store, { alias: { id }, ...(name ? { name: { content: name } } : {}), updated: { time: now } }, defaultCid, []))
    return { ...value, children: [...value.children, [typeCid, ref]] }
  })
}

/** Submit a value (which can itself be a ref) through the ordinary proposal format. */
/** Submit `targetCid` to the row ref at `at`. `name` keeps one submission per source (`binding:<source>`, as patterns and
 * solve use); the default replaces this peer's earlier submission. */
export function proposeRefAt(replica: Replica, at: Scope, targetCid: string, peerId: string, now: number, name = 'binding'): { replica: Replica; proposalCid: string } {
  const store = replica.store
  const cid = resolveScope(store, headCid(replica), at)
  if (!cid || !store.table.has(targetCid)) throw new Error('ref or proposed value not found')
  const ref = content(store, cid)
  const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : undefined
  if (!isRefNode(store, ref) || !(edge && isRowEdge(store, edge))) throw new Error('expected a row ref')
  const proposalCid = put(store, proposalContent(store, peerId, name, targetCid, refBindingBaseCid(store, ref), now))
  return { replica: editNode(replica, at, now, (node) => withProposal(store, node, peerId, proposalCid, name)), proposalCid }
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
    // A submission to a right ref accepts a whole value; concurrent handlers stay alternatives.
    if (proposal.name === 'binding' || proposal.name.startsWith('binding:')) {
      // options from named sources (patterns, solve) stay choosable after another one is bound
      if (proposal.name === 'binding' && proposal.baseCid !== refBindingBaseCid(store, value)) return value
      const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
      const edge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : undefined
      const type = edge && rowTypeOf(store, edge)
      if (!type || !refValueCompatible(store, type, proposal.contentCid)) throw new Error('The submitted value has an incompatible ref type.')
      const previous = refValueCid(store, value)
      let target = proposal.contentCid
      if (previous && previous !== target) {
        const inherited = Object.values(scopeBranches(store, headCid(replica), at.slice(0, -1))).at(-1) ?? replica.meta.branch ?? 'main'
        target = putRefValueBranches(store, value, [previous, target], inherited, target, type)
        selectBranch(store, value.data.alias!.id, readChoice(store, target).defaultName!)
      }
      const next = refNodeContent(store, { ...value.data, updated: { time: now } }, target, bookkeepingOf(store, value))
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
