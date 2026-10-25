import { constructPlainRow, constructRow, fieldEdge, fieldText, fieldValue, fieldValues, isFieldRow, isTextField, rebuildRow, rowRecord, titleField, withFieldValue, withFieldValues, withRowText } from './fields'
import { createStore, completes, rowTitle, rowVocabulary } from './graph'
import { primitive } from './primitives'
import { sameCapabilityType } from './capabilities'
import { refValueCompatible } from './scoped-refs'
import { matchesGraph } from './structural'
import { transferRefGraph } from './ref-transfer'
import { parseRefExpression, textRefExpressions, resolveRefIdentity, nodeOccurrence } from './ref-paths'
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

import { storeOf, type FosStore } from '../dag-implementation/store'
import { UnsupportedDataVersionError, hashContent } from '../dag-implementation/cid'
import type { FosContextData, FosNodeContent, FosPathElem } from '../types'
import { constructForm, formFields, formText, formTitle, formValueAt, positionFormRows, setFormTitle, type FormInput } from './forms'
import { COMMENT_TYPE, NOTE_TYPE, PLAIN_TYPE, QUERY_TYPE, REF_TYPE, RESOURCE_TYPE, TASK_TYPE, TEMPLATE_TYPE } from './library-types'
import { legacyCommentMetadata } from './legacy-comment'
import { knownUser, publishPeerKey, userType, withUserField, type UserRecord } from './users'
import { membershipPath, withMembershipRow, homeIdOf, isValueSubmission, settingOf, isRequirementRow } from './graph'
import { isNegative } from './parameters'
import {
  withMainBranchPolicy, libAt, refValueCid, putRefValueBranches, selectBranch, isBranchChoice, branchEdge, branchSelection, readChoice, scopeBranches,
  HOME_ID,
  capabilityNames,
  homeContextCid,
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
  mapMembership,
  memberEdgesOf,
  memberPeerOf,
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
  const store = existing ?? createStore()
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
  const fresh = createReplica(undefined, createStore())
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
    store = storeOf(ctx.nodes ?? {}, ctx.rootNodeId)
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
  const id = homeIdOf(replica.store, headCid(replica))
  return id ? [id] : []
}

/** Remember initialization in the graph so reopening a store cannot resurrect withdrawn refs. */
export function primitiveDefaultsApplied(replica: Replica, at: Scope, source: string): boolean {
  const cid = resolveScope(replica.store, headCid(replica), at)
  return !!cid && (!!content(replica.store, cid).data.primitiveDefaults?.sources.includes(source) || !!valueContent(replica.store, cid).data.primitiveDefaults?.sources.includes(source))
}

export function markPrimitiveDefaultsApplied(replica: Replica, at: Scope, source: string, now: number): Replica {
  if (primitiveDefaultsApplied(replica, at, source)) return replica
  const next = updateAtScope(replica.store, headCid(replica), at, node => ({ ...node, data: { ...node.data,
    primitiveDefaults: { sources: [...(node.data.primitiveDefaults?.sources ?? []), source] }
  } }), 'node')
  commitRoot(replica.store, next, now)
  return { ...replica }
}

/** Move legacy document rows into Home without copying their identities or losing root bookkeeping. */
export function ensureHomeContext(replica: Replica, now: number, offers?: HostOffers): Replica {
  if (replica.meta.scope.length) return replica
  if (offers?.primitives) importNodes(replica.store, offers.primitives.nodes)
  const before = headCid(replica)
  const seeded = primitiveDefaultsApplied(replica, [], 'server')
  const next = homeContextCid(replica.store, before, now, seeded ? {} : offers)
  let r = replica
  if (next !== before) { commitRoot(replica.store, next, now); r = { ...replica } }
  // the host's peers publish their public keys in Home, where node exchange carries them to every device
  for (const [peerId, publicKey] of Object.entries(offers?.keys ?? {})) r = publishPeerKey(r, peerId, publicKey, now)
  if (offers?.primitives && !seeded) {
    importNodes(r.store, offers.primitives.nodes)
    for (const [peer, refs] of Object.entries(offers.primitives.peers)) {
      const at = peer === 'fos' ? [] : homePath(r)
      if (!contextMemberRefs(r, at).has(peer)) r = addMemberAt(r, at, peer, peer, [], now)
      const groups = new Map<string, string[]>()
      for (const [type, cid] of refs) {
        if (type) groups.set(type, [...(groups.get(type) ?? []), cid])
      }
      for (const [type, values] of groups) {
        r = setHandlerOffersAt(r, at, peer, type, values, now)
      }
    }
    r = markPrimitiveDefaultsApplied(r, [], 'server', now)
  }
  return r
}

/** Attach a device's Home to the corresponding shared node, retaining its private root. */
export function shareHome(replica: Replica): Replica {
  if (replica.meta.scope.length || replica.meta.localScope?.length || !homePath(replica).length) return replica
  return { ...replica, meta: { ...replica.meta, localScope: homePath(replica) } }
}

export function headCid(replica: Pick<Replica, 'store'>): string {
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

export function edit(replica: Replica, at: Scope, now: number, fn: (value: FosNodeContent) => FosNodeContent): Replica {
  return commitEdit(replica, updateAtScope(replica.store, headCid(replica), at, fn), now)
}

/** Like `edit`, but `fn` sees the identity node at `at` (the ref node of a link row): for bookkeeping. */
export function editNode(replica: Replica, at: Scope, now: number, fn: (node: FosNodeContent) => FosNodeContent): Replica {
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
  return edge && (isRowEdge(replica.store, edge) || !!settingOf(replica.store, content(replica.store, identityCid(replica.store, edge)))) ? edge : undefined
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
  const type = primitive(store, 'string'), children = [...node.children]
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
  return addRow(replica, at, TASK_TYPE, trimmed, now, { id })
}

/**
 * The content of a new row `id` of `type` holding `text`: built from the type's fields (its title field holds `text`;
 * a plain row is its text). References, queries and banks still carry their data until they are rows.
 */
function newRowContent(store: FosStore, type: string, typeId: string, id: string, text: string, now: number, extras: Omit<RowExtras, 'store'>): FosNodeContent {
  if (typeId === REF_TYPE || typeId === QUERY_TYPE || typeId === RESOURCE_TYPE) return rowContent(typeId, id, text, now, { ...extras, store })
  if (isTextField(store, type)) return constructPlainRow(store, type, id, text, now)
  const values = new Map<string, string>(), title = titleField(store, type), done = rowVocabulary(store)?.done
  if (title && text) values.set(title, fieldText(store, title, text))
  if (done && extras.done && completes(store, type)) values.set(done, put(store, { data: {}, children: [] }))
  return constructRow(store, type, id, values, now)
}

export type AddRowOptions = Omit<RowExtras, 'store'> & { position?: MovePosition; id?: string }

/** A row of `type` whose fields hold `input` (by field name), including types unknown to this client. */
export function addConstructedRow(replica: Replica, at: Scope, type: string, input: Readonly<Record<string, string | number>>, now: number, id = newId()): Replica {
  return edit(replica, at, now, value => ({ ...value, children: [...value.children, [type, put(replica.store, constructRow(replica.store, type, id, fieldValues(replica.store, type, input), now))]] }))
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

/**
 * Append a row of the row type `type` (a type's cid, e.g. from `libraryTypeAt`) holding `text` under the node at
 * `at`: the edge is `[type, row]`, so the type alone says what the row is. A type with a form is constructed from it
 * (its text field gets `text`); a type without one holds `text` as the row's description.
 */
export function addTypedRow(replica: Replica, at: Scope, type: string, text: string, now: number, id: string = newId()): Replica {
  return text.trim() ? addRow(replica, at, type, text, now, { id }) : replica
}

/** Rows of these types may start blank (Enter / "Add comment" create one to type into; flow entries describe themselves). */
const BLANK_TYPES = [PLAIN_TYPE, COMMENT_TYPE, REF_TYPE]

/**
 * Append (or place at `position`) a row of `type` under the node at `at`: a type id (`lib.<type>`: the row type of the
 * library nearest to `at`) or a type cid. A type with a graph form is constructed from it (its text field gets `text`);
 * a built-in type holds `text` as its title, plus what `options` give it. References need `refId`.
 */
export function addRow(replica: Replica, at: Scope, type: string, text: string, now: number, options: AddRowOptions = {}): Replica {
  const store = replica.store
  const typeId = store.table.has(type) ? typeIdOf(store, type) ?? '' : type
  if (typeId === REF_TYPE && !options.refId) return replica
  const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
  const parentEdge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : null
  // Explicit graph definitions may have inputs without a title at all.
  if (!text.trim() && !store.table.has(type) && !BLANK_TYPES.includes(typeId)) return replica
  const template = resolveRowType(store, type, at)
  const body = text.trim()
  const id = options.id ?? newId()
  const place = (value: FosNodeContent) => {
    const { position: _p, id: _i, ...extras } = options
    const node = newRowContent(store, template, typeIdOf(store, template) ?? typeId, id, body, now, extras)
    const edge = rowEdgeAt(store, template, put(store, userBound(replica, at, node, extras)), at)
    const children = [...value.children]
    const pos = options.position
    if (pos && 'relativeTo' in pos) {
      const sibling = findEdge(store, value, `a:${pos.relativeTo}`)
      const index = sibling ? children.indexOf(sibling) : -1
      if (index >= 0) { children.splice(pos.position === 'above' ? index : index + 1, 0, edge); return { ...value, children } }
    }
    children.push(edge)
    return { ...value, children }
  }
  // The first row typed inside an open requirement starts the value it is bound to: a container the pattern reads.
  // Until then the hole has no value, and editing it would make the ref its own content.
  if (parentEdge && isRequirementRow(store, parentEdge) && !refValueCid(store, content(store, identityCid(store, parentEdge)))) {
    return editNode(replica, at, now, node => refNodeContent(store, { ...node.data, updated: { time: now } }, put(store, place({ data: {}, children: [] })), bookkeepingOf(store, node)))
  }
  return edit(replica, at, now, place)
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
    const body = text.trim()
    if (type !== REF_TYPE && type !== QUERY_TYPE && type !== RESOURCE_TYPE) {
      const built = isTextField(replica.store, template) ? constructPlainRow(replica.store, template, aliasId, body, now) : null
      const values = new Map<string, string>(), title = titleField(replica.store, template), done = rowVocabulary(replica.store)?.done
      if (title && body) values.set(title, fieldText(replica.store, title, body))
      if (done && completes(replica.store, template)) values.set(done, extras.done ? put(replica.store, { data: {}, children: [] }) : primitive(replica.store, 'void'))
      const rebuilt = built ? { ...built, children: [...built.children, ...node.children.filter(e => isRowEdge(replica.store, e) && !isFieldRow(replica.store, aliasId, e))] } : rebuildRow(replica.store, template, aliasId, node, values, now)
      const next = withChildValue(replica.store, edge, userBound(replica, at, rebuilt, extras), now)
      return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, identityCid(replica.store, next), template))
    }
    const converted = convertRow(replica.store, node, type, now, extras)
    const data: FosNodeContent['data'] = { ...converted.data, description: { content: body } }
    if (type === RESOURCE_TYPE) {
      data.name = { content: body }
      if (extras.resource) data.resource = extras.resource
    }
    if (type === QUERY_TYPE && extras.query) data.query = { ...(node.data.query ?? {}), ...extras.query }
    const next = withChildValue(replica.store, edge, userBound(replica, at, withTextParameters(replica.store, { ...converted, data }), extras), now)
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
  const parent = resolveScope(replica.store, headCid(replica), at.slice(0, -1)), edge = parent ? findEdge(replica.store, valueContent(replica.store, parent), `a:${at.at(-1)}`) : undefined
  // a requirement's @user is part of what it asks: it lives on the declaration, not on the value bound to it
  if (edge && isRequirementRow(replica.store, edge)) return editNode(replica, at, now, node => withUserField(replica.store, node, user, type))
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
    const title = titleField(replica.store, template), text = rowTitle(replica.store, identityCid(replica.store, edge), rowTypeOf(replica.store, edge))
    const next = type === REF_TYPE || type === QUERY_TYPE || type === RESOURCE_TYPE ? convertRow(replica.store, node, type, now, extras)
      : isTextField(replica.store, template) ? constructPlainRow(replica.store, template, aliasId, text, now)
      : rebuildRow(replica.store, template, aliasId, node, title && text ? new Map([[title, fieldText(replica.store, title, text)]]) : new Map(), now)
    const converted = withChildValue(replica.store, edge, next, now)
    return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdgeAt(replica.store, template, identityCid(replica.store, converted), at))
  })
}

/** Explicitly expose a declaration in the lowest shared scope; leave a ref at its original occurrence. */
export function shareRefAt(replica: Replica, source: Scope, destination: Scope, now: number): Replica {
  const s = replica.store, parent = source.slice(0, -1), id = source.at(-1)
  if (!id) throw new Error('Choose a declaration to share.')
  let depth = 0
  while (depth < parent.length && depth < destination.length && parent[depth] === destination[depth]) depth++
  const shared = parent.slice(0, depth)
  const root = headCid(replica), sourceParent = resolveScope(s, root, parent)
  const edge = sourceParent && findEdge(s, valueContent(s, sourceParent), `a:${id}`)
  if (!edge || !resolveScope(s, root, destination)) throw new Error('Source or destination is unavailable.')
  const cid = identityCid(s, edge)
  transferRefGraph(replica, cid, source, [...shared, id], false)
  const type = rowTypeOf(s, edge)
  if (!type) throw new Error('Only a typed declaration can be shared.')
  transferRefGraph(replica, type, source, [...shared, id], false)
  const linked = makeLink(s, content(s, cid), now)
  const declaration = put(s, { ...linked, data: { ...linked.data, name: linked.data.name ?? { content: formTitle(s, valueContent(s, cid)) || id } } })
  if (shared.length === parent.length) {
    if (declaration === cid) return replica
    commitRoot(s, updateAtScope(s, root, parent, value => replaceEdge(s, value, `a:${id}`, rowEdge(s, declaration, type))), now)
    return { ...replica }
  }
  const handle = put(s, rowContent(REF_TYPE, newId(), '', now, { refId: id, targetCid: declaration, store: s }))
  const replacement = rowEdgeAt(s, REF_TYPE, handle, parent)
  let next = updateAtScope(s, root, parent, value => replaceEdge(s, value, `a:${id}`, replacement))
  next = updateAtScope(s, next, shared, value => ({ ...value, children: [...value.children, rowEdge(s, declaration, type)] }))
  commitRoot(s, next, now)
  return { ...replica }
}

/** Linking across subtrees must create an explicit declaration in their shared frame. */
export function addRef(replica: Replica, at: Scope, targetAliasId: string, now: number, position?: MovePosition): Replica {
  const destination = position && 'into' in position ? [...at, position.into] : at
  let r = replica
  let found = resolveRef(r, targetAliasId, destination)
  if (!found) {
    // Editor selection locates the source; evaluation never uses this tree search.
    const selected = findRowByAlias(r.store, headCid(r), targetAliasId)
    if (!selected) throw new Error('The reference source is unavailable.')
    r = shareRefAt(r, [...selected.path, targetAliasId], destination, now)
    found = resolveRef(r, targetAliasId, destination)
  }
  if (!found) throw new Error('Declare the reference in a shared enclosing scope first.')
  r = shareRefAt(r, [...found.path, targetAliasId], destination, now)
  const targetPath = [...found.path, targetAliasId]
  const targetCid = targetPath ? resolveScope(r.store, headCid(r), targetPath) : null
  const options = { refId: targetAliasId, targetCid: targetCid ?? undefined }
  if (position && 'into' in position) return addRow(r, [...at, position.into], REF_TYPE, '', now, options)
  return addRow(r, at, REF_TYPE, '', now, { ...options, position })
}

/** The template row called `name` that a row at `at` sees (nearest ancestor first), or null. */
export function findTemplateByName(replica: Replica, name: string, at: Scope = []): { row: TaskView; cid: string } | null {
  const root = headCid(replica)
  return root ? findTemplate(replica.store, root, name, at) : null
}

/**
 * Instantiate a template's owned subtree with fresh identities, reset completion and no supplies.
 * Copy and instantiation share the same traversal and internal-reference remapping.
 */
export function instantiateTemplate(replica: Replica, at: Scope, taskId: string, templateId: string, now: number): Replica {
  // An explicit editor selection copies this definition; transferRefGraph closes its private dependencies.
  const template = findRowByAlias(replica.store, headCid(replica), templateId)
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

/** Make the task `taskId` at `at` from the library template that is the field `field` of the library `at` sees. */
export function instantiateLibraryTemplate(replica: Replica, at: Scope, taskId: string, field: string, now: number): Replica {
  const cid = libraryTypeAt(replica.store, field, at)
  if (!cid) throw new Error('Update the standard library: it has no such template.')
  return instantiateTemplateValue(replica, at, taskId, cid, now)
}

/** Local templates and advertised templates use the same copy/remap operation. */
export function instantiateTemplateValue(replica: Replica, at: Scope, taskId: string, templateCid: string, now: number): Replica {
  if (!replica.store.table.has(templateCid)) throw new Error('Template content is unavailable.')
  const taskCid = resolveScope(replica.store, headCid(replica), [...at, taskId])
  if (!taskCid) throw new Error('Template destination is unavailable.')
  if (!isTemplateType(replica.store, templateCid)) throw new Error('Only template rows can be instantiated.')
  const sourcePath = nodeOccurrence(replica.store, templateCid)
  if (sourcePath) templateCid = transferRefGraph(replica, templateCid, sourcePath, [...at, taskId], true)
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
export const ATTACHMENT_TYPE = 'attachment'
export type Attachment = { name: string; type: string; data: string; size: number }
export function addAttachment(replica: Replica, at: Scope, file: Attachment, now: number, id: string = newId()): Replica {
  const template = libraryTypeAt(replica.store, ATTACHMENT_TYPE, at, headCid(replica))
  if (!template) throw new Error('No standard library above this row has an attachment type.')
  return addConstructedRow(replica, at, template, { filename: file.name, mediaType: file.type, data: file.data, size: file.size }, now, id)
}
/** The file the row at `path` keeps, when it is an attachment row (by its type, any version of it). */
export function attachmentAt(replica: Replica, path: Scope): Attachment | null {
  if (!path.length) return null
  const parent = resolveScope(replica.store, headCid(replica), path.slice(0, -1))
  const edge = parent ? findEdge(replica.store, valueContent(replica.store, parent), `a:${path.at(-1)}`) : null
  if (!edge || !isLibraryType(replica.store, edge[0], ATTACHMENT_TYPE)) return null
  const record = rowRecord(replica.store, edge[0], path.at(-1)!, valueContent(replica.store, identityCid(replica.store, edge)))
  const { filename: name, mediaType: type, data, size } = record
  return typeof name === 'string' && typeof type === 'string' && typeof data === 'string' && typeof size === 'number' ? { name, type, data, size } : null
}

/** The standard-library row type of rows that reference a file in a linked directory (web/src/filesystem.ts). */
export const FILE_REFERENCE_TYPE = 'fileReference'
/** Its fields: the `/`-separated path relative to the linked directory, and the SHA-256 and size it was made against. */
export type FileReference = { path: string; sha256: string; size: number }
function validFileReference(file: FileReference): boolean {
  return typeof file?.path === 'string' && !!file.path && !file.path.startsWith('/') && !/^[a-z]:/i.test(file.path) && !file.path.includes('\\') &&
    file.path.split('/').every(name => name && name !== '.' && name !== '..') && /^[0-9a-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.size) && file.size >= 0
}
/**
 * A row of the library type `lib.fileReference` under `at`: its edge's left node is that type, its values are the
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
  const { path, sha256, size } = rowRecord(replica.store, edge[0], rowId, node)
  return typeof path === 'string' && typeof sha256 === 'string' && typeof size === 'number' ? { edge, node, file: { path, sha256, size } } : null
}
/** The file the row at `path` references, when it is a file-reference row whose fields are here. */
export function fileReferenceAt(replica: Replica, path: Scope): FileReference | null {
  return path.length ? fileReferenceRow(replica, path.slice(0, -1), path.at(-1)!)?.file ?? null : null
}
/** Re-pin a file reference to the checksum (and size) its file has now: its fields are rewritten in place. */
export function setFileReferenceAt(replica: Replica, at: Scope, rowId: string, file: FileReference, now: number): Replica {
  if (!validFileReference(file)) throw new Error('A file reference needs a relative path and a SHA-256 checksum.')
  const found = fileReferenceRow(replica, at, rowId)
  if (!found) throw new Error('This row is not a file reference.')
  return updateTask(replica, at, rowId, now, row => withFieldValues(replica.store, found.edge[0], rowId, row, { path: file.path, sha256: file.sha256, size: file.size }, now))
}

/** Copy the row `aliasId` (with its subtree, fresh ids) from `fromPath` to `toPath` at `position`. */
export function copyNode(replica: Replica, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition, now: number): Replica {
  const from = resolveScope(replica.store, headCid(replica), fromPath)
  if (!from) return replica
  const found = findEdge(replica.store, valueContent(replica.store, from), `a:${aliasId}`)
  if (!found) return replica
  let type = rowTypeOf(replica.store, found)
  if (!type) return replica
  const target = 'into' in position ? [...toPath, position.into] : toPath
  const original = content(replica.store, identityCid(replica.store, found))
  if (original.data.ref && isLibraryType(replica.store, type, REF_TYPE)) {
    const referred = resolveRefIdentity(replica, fromPath, original.data.ref.id)
    if (referred.status === 'ready' && referred.locations[0]?.pattern) type = referred.locations[0].pattern
  }
  const source = transferRefGraph(replica, identityCid(replica.store, found), [...fromPath, aliasId], [...target, aliasId], true)
  type = transferRefGraph(replica, type, [...fromPath, aliasId], [...target, aliasId], true)
  const copied = copyRowContent(replica.store, source, now, newId)
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
/** Resolve explicit identity links through the same resolver used by compiled refs. */
export function resolveRef(replica: Replica, targetAliasId: string, at: Scope = []): { path: Scope; row: TaskView } | null {
  const result = resolveRefIdentity(replica, at, targetAliasId)
  const found = result.status === 'ready' ? result.locations[0] : undefined
  return found?.pattern && found.store === replica.store ? { path: found.path.slice(0, -1), row: rowView(found.store, found.cid, [found.pattern, found.cid]) } : null
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
  const field = rowVocabulary(replica.store)?.done
  return updateTask(replica, at, taskId, now, (task) => {
    // only rows with a done field complete
    if (!field || !fieldEdge(replica.store, taskId, task, field)) return null
    const held = fieldValue(replica.store, taskId, task, field)!, unit = put(replica.store, { data: {}, children: [] })
    if ((held === unit) === done) return null
    return withFieldValue(replica.store, taskId, task, field, done ? unit : primitive(replica.store, 'void'), now)
  })
}

export function renameTask(replica: Replica, at: Scope, taskId: string, title: string, now: number): Replica {
  const trimmed = title.trim()
  if (!trimmed) return replica
  const parent = resolveScope(replica.store, headCid(replica), at)
  const edge = parent && findChildEdge(replica, valueContent(replica.store, parent), taskId)
  // a requirement is titled by its own declaration, whatever value it is bound to
  if (edge && isRequirementRow(replica.store, edge)) return editNode(replica, [...at, taskId], now, node => node.data.description?.content === trimmed ? node : { ...node, data: { ...node.data, description: { content: trimmed }, updated: { time: now } } })
  return updateTask(replica, at, taskId, now, (task) => {
    if (edge && rowTitle(replica.store, identityCid(replica.store, edge), rowTypeOf(replica.store, edge)) === trimmed) return null
    // a row that holds text (a field, or its own) takes the new text there; one still on its description keeps it there
    return withRowText(replica.store, taskId, task, trimmed, now) ?? (task.data.description?.content === trimmed ? null : { ...task, data: { ...task.data, description: { content: trimmed } } })
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
  // a membership row is removed as the member it is
  const membership = parent && memberEdgesOf(replica.store, parent).find(e => content(replica.store, e[1]).data.alias?.id === taskId)
  if (membership) return removeMemberAt(replica, at, memberPeerOf(replica.store, membership), now)
  if (edge && edge[0] === primitive(replica.store, 'member')) return editNode(replica, at, now, node => replaceEdge(replica.store, node, `a:${taskId}`, null))
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
  return editPolicy(replica, at, now, (node) => withMember(replica.store, makeLink(replica.store, node, now), peerId, name, capabilities, [], [], at))
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
  if (member && member.name === name && capabilityNames(replica.store).every(c => member.capabilities.includes(c))) return replica
  let next = editNode(replica, [], now, (node) => withMember(replica.store, node, peerId, name, capabilityNames(replica.store)))
  if (!member) {
    const id = localStoreRowId(peerId), store = next.store
    const held = put(store, { data: { alias: { id }, description: { content: name }, ref: { id, peer: peerId, version: 'unloaded', scope: [...shares] } }, children: [] })
    const entry = membershipPath(store, headCid(next), [], peerId)!
    next = edit(next, entry, now, (value) => findChildEdge(next, value, id) ? value : { ...value, children: [...value.children, rowEdgeAt(store, PLAIN_TYPE, held, entry)] })
  }
  return next
}

/** The id of the row standing for the linked store `peerId` under its member entry: a content address. */
export const localStoreRowId = (peerId: string): string => hashContent({ data: { ref: { id: '', peer: peerId } }, children: [] })

/** The path of `peerId`'s membership row at the node `at` (a row of that node whose left is the peer), if it has one. */
export function membershipPathAt(replica: Replica, at: Scope, peerId: string): Scope | null {
  return membershipPath(replica.store, headCid(replica), at, peerId)
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
    const next = withMember(replica.store, link, peerId, existing?.name ?? null, capabilities, disabled, accepts ?? existing?.accepts ?? [], at)
    return peerId === 'fos' && disabled.includes('persist') ? withPeer(replica.store, next, replica.meta.peerId) : next
  })
}

/** Owner side: drop the member `peerId` from the node at `at` (its capabilities with it). */
export function removeMemberAt(replica: Replica, at: Scope, peerId: string, now: number): Replica {
  return editPolicy(replica, at, now, (node) => withoutMember(replica.store, node, peerId))
}

/** Materialize the nearest inherited member before overriding its offers locally. Called in main policy context. */
function localMember(replica: Replica, at: Scope, node: FosNodeContent, peerId: string): FosNodeContent {
  if (!readMembers(replica.store, node).some(m => m.peerId === peerId)) {
    const cid = contextMemberRefs(replica, at).get(peerId)
    if (!cid) throw new Error('Peer no longer exists.')
    node = withMembershipRow(replica.store, node, peerId, cid)
  }
  return node
}

/** Publish typed offers without requiring registration in the built-in capability vocabulary. */
export function setHandlerOffersAt(replica: Replica, at: Scope, peerId: string, type: string, handlers: string[], now: number, direction: 'from' | 'to' = 'from'): Replica {
  const s = replica.store, marker = direction === 'from' ? primitive(s, 'accepts') : primitive(s, 'grants')
  if (!s.table.has(type) || handlers.some(cid => !s.table.has(cid) || !matchesGraph(s, type, cid))) throw new Error('Handler value does not match its advertised pattern.')
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return mapMembership(s, node, peerId, member => {
      const children = member.children.filter(e => e[0] !== marker || !advertisedRows(s, e[1]).some(row => sameCapabilityType(s, row[0], type)))
      children.push(...[...new Set(handlers)].map(cid => [marker, advertisement(s, type, cid)] as [string, string]))
      return { ...member, children }
    })
  })
}

/** Node-local menu constructor overrides, inherited through the peer binding. */
export function setConstructorEnabledAt(replica: Replica, at: Scope, peerId: string, id: string, enabled: boolean, now: number): Replica {
  return editPolicy(replica, at, now, node => {
    node = localMember(replica, at, node, peerId)
    return mapMembership(replica.store, node, peerId, member => {
      const disabled = new Set<string>(member.data.disabledConstructors?.content ?? [])
      if (enabled) disabled.delete(id); else disabled.add(id)
      return { ...member, data: { ...member.data, disabledConstructors: { content: [...disabled] } } }
    })
  })
}

/** Disable one configured handler without deleting it or changing its type. */
export function setHandlerEnabledAt(replica: Replica, at: Scope, peerId: string, id: string, enabled: boolean, now: number): Replica {
  if (!discoverHandlers(replica, at).some(offer => offer.peerId === peerId && offer.id === id) &&
    !marketplaceOffers(replica).some(offer => offer.peerId === peerId && offer.id === id && JSON.stringify(offer.path) === JSON.stringify(at))) throw new Error('Handler no longer exists.')
  return editPolicy(replica, at, now, node => {
    node = contextMemberRefs(replica, at).has(peerId) ? localMember(replica, at, node, peerId) : withMember(replica.store, node, peerId, peerId, [])
    return mapMembership(replica.store, node, peerId, member => {
      const disabled = new Set(member.data.disabledCapabilities?.content ?? [])
      if (enabled) disabled.delete(id); else disabled.add(id)
      return { ...member, data: { ...member.data, disabledCapabilities: { content: [...disabled] } } }
    })
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

/** Pass a visible capability as an ordinary typed ref. A recipient supplies its own handler to this declaration. */
export function passRefAt(replica: Replica, at: Scope, id: string, sourceId: string, now: number, name?: string): Replica {
  const resolved = resolveRefIdentity(replica, at, sourceId)
  const source = resolved.status === 'ready' ? resolved.locations[0] : undefined
  if (!source?.pattern) throw new Error('Pass a reference declared in an enclosing scope.')
  if (source.store !== replica.store) importNodes(replica.store, reachableNodes(source.store, [source.cid, source.pattern]))
  const forwarded = put(replica.store, { data: { ref: { id: sourceId } }, children: [] })
  return addRefAt(replica, at, id, source.pattern, now, forwarded, name)
}

/**
 * Submit `targetCid` (which can itself be a ref) to the row ref at `at`. `name` is a label that keeps one submission
 * per source (solve names it by the source's path); the default replaces this peer's earlier submission.
 */
export function proposeRefAt(replica: Replica, at: Scope, targetCid: string, peerId: string, now: number, name = ''): { replica: Replica; proposalCid: string } {
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
    if (isValueSubmission(store, proposal)) {
      // a peer's main submission must be of the value as it is; named ones (a source's options) stay choosable after another is bound
      if (!proposal.name && proposal.baseCid !== refBindingBaseCid(store, value)) return value
      return removeProposalByCid(store, boundRefValue(replica, at, value, proposal.contentCid, now), proposalCid)
    }
    const mergedCid = proposal.baseCid === main
      ? proposal.contentCid
      : mergeNodes(store, proposal.baseCid, main, proposal.contentCid, { ours: approverPeerId, theirs: proposal.peerId }).cid
    const linkCid = put(store, value) // current version's cid, for the PREV edge
    const relinked = relinkContent(store, value, linkCid, content(store, mergedCid), now)
    return removeProposalByCid(store, relinked, proposalCid)
  })
}

/** Whether a row's title is a projection of its form (a title or headline field, or a scalar leaf), not its description. */
const projectsTitle = (node: FosNodeContent): boolean => !!(node.data.presentation?.title || node.data.presentation?.headline || node.data.scalar)

/**
 * The row ref `value` (at `at`) holding `target` as its value: checked against the row's pattern, the previous value
 * kept as an alternative (concurrent handlers stay choosable), the old version its history.
 */
function boundRefValue(replica: Replica, at: Scope, value: FosNodeContent, target: string, now: number): FosNodeContent {
  const store = replica.store
  const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : undefined
  const type = edge && rowTypeOf(store, edge)
  // a reference is followed by the resolver when the value is read; its own shape says nothing about what it refers to
  if (!type || (!content(store, target).data.ref && !refValueCompatible(store, type, target))) throw new Error('The submitted value has an incompatible ref type.')
  const previous = refValueCid(store, value)
  let bound = target
  if (previous && previous !== target) {
    const inherited = Object.values(scopeBranches(store, headCid(replica), at.slice(0, -1))).at(-1) ?? replica.meta.branch ?? 'main'
    bound = putRefValueBranches(store, value, [previous, target], inherited, target, type)
    selectBranch(store, value.data.alias!.id, readChoice(store, bound).defaultName!)
  }
  const next = refNodeContent(store, { ...value.data, updated: { time: now } }, bound, bookkeepingOf(store, value))
  return withPrev(store, next, put(store, value))
}
/** The owner's write of a row ref's value (no submission: it is this store's own edit). */
export function setRefValueAt(replica: Replica, at: Scope, target: string, now: number): Replica {
  const store = replica.store, cid = resolveScope(store, headCid(replica), at)
  if (!cid || !store.table.has(target)) throw new Error('ref or value not found')
  const parent = at.length ? resolveScope(store, headCid(replica), at.slice(0, -1)) : null
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${at.at(-1)}`) : undefined
  if (!isRefNode(store, content(store, cid)) || !(edge && isRowEdge(store, edge))) throw new Error('expected a row ref')
  return editNode(replica, at, now, value => boundRefValue(replica, at, value, target, now))
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
