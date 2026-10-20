/**
 * Graph helpers for sync, written against the hash-consed FosStore.
 *
 * Conventions used by the sync layer (all expressed with existing primitives):
 *
 *   row         edge [template, rowNode]          the template (instruction) says what the row is and how it behaves; the row
 *                                                  node (target) holds its own state. A template is a graph definition:
 *                                                  a row type (Task, Row, Note, Comment, Reference, Query, Resource, Allocation,
 *                                                  Template) from the Row types this root installed from the standard library,
 *                                                  or a template row ("Plan a trip"); pinned by the cid of the version used.
 *   task        edge [Task, taskNode]             taskNode.data: alias{id}, description, todo{completed,time}, updated
 *   reference error  edge [missing, rowNode]      the row is pinned to a template this peer has not received yet
 *
 * Mutable references. The root alias, link nodes (what devices attach to and
 * propose against) and reference rows are one and the same node shape, the
 * language design's ALIAS node:
 *
 *   ref node    data: alias{id} (+ ref{id} for a reference row)
 *               [TARGETPOINTER, valueCid]       the current value (a content node: description, todo, rows…)
 *               [INSTRUCTIONPOINTER, typeCid]   optional type (the root uses the ROOT instruction)
 *               [PREV, previousRefCid]*         history: one per parent version, two after a merge
 *               [MEMBER, ref]* [PROPOSAL, p]* [PEER, ref]*   who is attached to the reference
 *
 *   A row whose identity node is a ref node is a "link row": its text and rows
 *   are read through TARGETPOINTER (`valueContent`), edits advance the ref
 *   (new ref node, PREV → the old one), bookkeeping stays on the ref node.
 *   A reference row is a ref node with data.ref.id naming the row it stands
 *   for and TARGETPOINTER holding a snapshot of that row's ref node; it is
 *   resolved live by id. Older data had link nodes inline (data.link with the
 *   bookkeeping edges on the content node); `normalizeRefs` rewrites those.
 *   peer        edge [PEER, peerRefNode]          peerRefNode.data: peerId{content}   (see membership.ts)
 *   choice      edge [CHOICE, choiceNode]         an unresolved divergence; replaces the task/partition edge it concerns
 *                 choiceNode.data: alias{id of the thing in conflict}, conflict{path}, option{defaultResolutionStrategy:'choice'}
 *                 children: [CONFLICTBASE, altNode] [NOTSELECTED, altNode] [NOTSELECTED, altNode] …
 *                 altNode.data: peerId{content} ; children: [INSTRUCTIONPOINTER, instr] [TARGETPOINTER, target]  (none = deleted)
 *   root        the store's root alias (TARGETPOINTER → content, PREV → previous root alias, MERGESOURCE → merged-in root)
 *
 * Identity across versions is `data.alias.id`, the same mechanism the root alias
 * uses. A node's cid changes with every edit; its alias id does not.
 */

import { allocationValue } from './destructure'
import * as COMPILED_LIBRARY from './library.generated.json'
import { DEVICE_ROOT_TYPE, DOCUMENT_ROOT_TYPE, HOME_TYPE, MONEY_TYPE, PATTERN_TYPE, PLAIN_TYPE, QUERY_TYPE, REF_TYPE, RESOURCE_TYPE, TASK_TYPE, TEMPLATE_TYPE, isAllocationType } from './library-types'
import { formAttribution, formElements, formTitle, positionFormRows, type FormElement } from './forms'
import { sameUser, userOf, userPeerId, type UserRecord } from './users'
import { FosStore } from '../dag-implementation/store'
import { canonicalTypeErrors, isTypeErrorEdge, plainEdge, typeErrorOf, unwrapRootTarget } from './patterns'
import { isCurrentCid, verifyCid } from '../dag-implementation/cid'
import type { FosContextData, FosDataContent, FosNodeContent, FosNodesData, FosPathElem } from '../types'

export type Scope = string[] // alias ids of nested nodes (tasks or legacy plain nodes), [] = the node a replica is attached to

// ---------------------------------------------------------------------------
// Basics

export function content(store: FosStore, cid: string): FosNodeContent {
  const value = store.table.get(cid)
  if (!value) throw new Error(`node ${cid.slice(0, 12)} not found`)
  return value
}

export function hasNode(store: FosStore, cid: string | null | undefined): cid is string {
  return !!cid && store.table.has(cid)
}

/** Insert content (validating its edges) and return its cid. */
export function put(store: FosStore, value: FosNodeContent): string {
  return store.create(value).getId()
}

export function aliasIdOf(value: FosNodeContent): string | null {
  return value.data.alias?.id ?? null
}

// ---------------------------------------------------------------------------
// Mutable references (ALIAS nodes)

/** A bound ref has TARGETPOINTER; an unbound typed ref has alias + INSTRUCTIONPOINTER. */
export function isRefNode(store: FosStore, value: FosNodeContent): boolean {
  return value.children.some(([i]) => i === store.primitive.targetPointerConstructor.getId() || (!!value.data.alias && i === store.primitive.instructionPointerConstructor.getId()))
}

/** A reference row: a ref node standing for another row (data.ref.id); its own value is not followed. */
export function isHandle(value: FosNodeContent): boolean {
  return !!value.data.ref
}

/** An unavailable version held by a device, represented without a content edge. */
export function isPeerReference(node: FosNodeContent): boolean {
  return !!node.data.ref?.peer && !!node.data.ref.version && node.data.ref.id === node.data.alias?.id
}

export function refValueCid(store: FosStore, value: FosNodeContent): string | null {
  const edge = value.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())
  return edge ? edge[1] : null
}

/** A supplied-value branch uses handler/value → shared incoming ref edges. */
export function refBranches(store: FosStore, ref: FosNodeContent): { cid: string; id: string; names: string[]; selected: string } | null {
  const cid = refValueCid(store, ref)
  if (!cid || !isBranchChoice(store, content(store, cid))) return null
  const record = readChoice(store, cid)
  if (record.id !== ref.data.alias?.id) return null
  return { cid, id: record.id, names: record.options.map(o => o.peerId), selected: branchSelection(store, cid) }
}
/** Union supplied values without copying their documents or merging distinct handlers. */
export function putRefValueBranches(store: FosStore, ref: FosNodeContent, values: Array<string | null>, baseName = 'main', selectedValue?: string | null): string {
  const id = ref.data.alias!.id
  const incoming = put(store, refNodeContent(store, { alias: { id }, ...(ref.data.name ? { name: ref.data.name } : {}) }, null, [], refTypeCid(store, ref)))
  const options: ChoiceOption[] = []
  const add = (cid: string, preferred?: string) => {
    if (options.some(o => o.edge?.[0] === cid)) return
    const name = preferred && !options.some(o => o.peerId === preferred) ? preferred : options.length ? `value-${cid}` : baseName
    options.push({ peerId: name, edge: [cid, incoming] })
  }
  for (const cid of values) {
    if (!cid) continue
    if (isBranchChoice(store, content(store, cid)) && readChoice(store, cid).id === id) {
      for (const option of readChoice(store, cid).options) if (option.edge) add(option.edge[0], option.peerId)
    } else {
      const prior = values.filter((value): value is string => !!value && isBranchChoice(store, content(store, value)) && readChoice(store, value).id === id).flatMap(value => readChoice(store, value).options).find(option => option.edge?.[0] === cid)
      add(cid, prior?.peerId)
    }
  }
  const selected = options.find(o => o.edge?.[0] === selectedValue)?.peerId ?? options[0]?.peerId ?? baseName
  return putBranches(store, id, options[0]?.edge ?? null, options, selected)
}
export function selectedBranchValue(store: FosStore, cid: string): string | null {
  const edge = branchEdge(store, cid)
  if (!edge) return null
  const right = content(store, edge[1])
  return refTypeCid(store, right) && right.data.alias?.id === readChoice(store, cid).id ? edge[0] : identityCid(store, edge)
}

export function refTypeCid(store: FosStore, value: FosNodeContent): string | null {
  const edge = value.children.find(([i]) => i === store.primitive.instructionPointerConstructor.getId())
  return edge ? edge[1] : null
}

/** The content a node stands for: its TARGETPOINTER value for ref nodes (not handles), the node itself otherwise. */
export function valueContent(store: FosStore, cid: string): FosNodeContent {
  const value = content(store, cid)
  if (isBranchChoice(store, value)) { const selected = selectedBranchValue(store, cid); return selected ? valueContent(store, selected) : value }
  if (isHandle(value)) return value
  const target = refValueCid(store, value)
  return target && store.table.has(target) ? (isBranchChoice(store, content(store, target)) ? valueContent(store, target) : content(store, target)) : value
}

/** Cid of the content a node stands for (see valueContent). */
export function valueCidOf(store: FosStore, cid: string): string {
  const value = content(store, cid)
  if (isBranchChoice(store, value)) { const selected = selectedBranchValue(store, cid); return selected ? valueCidOf(store, selected) : cid }
  if (isHandle(value)) return cid
  const target = refValueCid(store, value)
  return target && store.table.has(target) ? (isBranchChoice(store, content(store, target)) ? valueCidOf(store, target) : target) : cid
}

/** Version against which a binding was offered. Adding offers does not invalidate other offers. */
export function refBindingBaseCid(store: FosStore, value: FosNodeContent): string {
  return put(store, { ...value, children: value.children.filter((edge) => !isProposalEdge(store, edge)) })
}

/** Build a ref node for `valueCid` with the given identity and bookkeeping edges. */
export function refNodeContent(store: FosStore, data: FosNodeContent['data'], valueCid: string | null, bookkeeping: FosPathElem[] = [], typeCid: string | null = null): FosNodeContent {
  const children: FosPathElem[] = valueCid ? [[store.primitive.targetPointerConstructor.getId(), valueCid]] : []
  if (typeCid) children.push([store.primitive.instructionPointerConstructor.getId(), typeCid])
  return { data, children: [...children, ...bookkeeping] }
}

/** Locally owned argument refs; the field is their type, their alias is the instance identity. */
export function refArguments(store: FosStore, value: FosNodeContent, typeCid: string): Array<{ id: string; cid: string; targetCid: string | null }> {
  return value.children.flatMap((edge) => {
    if (edge[0] !== typeCid) return []
    const cid = identityCid(store, edge)
    const ref = content(store, cid)
    const id = aliasIdOf(ref)
    return id && refTypeCid(store, ref) === typeCid ? [{ id, cid, targetCid: refValueCid(store, ref) }] : []
  })
}

export function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Identity key of an edge inside its parent: the alias id of its target (row, choice,
 * argument) when it has one; otherwise the edge itself, which then behaves as an
 * immutable set member.
 */
export function edgeKey(store: FosStore, edge: FosPathElem): string {
  const [instr, target] = edge
  // One proposal per (peer, branch name) on a node: replacing it is a modification, not a removal plus an addition.
  if (instr === store.primitive.proposalField.getId()) {
    const p = readProposal(store, target)
    if (p) return `p:${p.peerId}/${p.name}`
  }
  const targetAlias = aliasIdOf(content(store, target))
  if (targetAlias) return `a:${targetAlias}`
  return `e:${instr}:${target}`
}

/**
 * Kinds of resource bank: time, money, things, a person (their own calendar) and fos points (the account's token
 * balance, marker "ff"). Each has its own calendar: an allocation may carry a start/end window.
 */
export type ResourceType = 'calendar' | 'account' | 'inventory' | 'person' | 'points' | 'location'
/**
 * What a requirement asks for, named after the child row that fills it: a done task (`task`), an `allocation`
 * of a resource, a run `search`, a `confirmation` or `choice` by a signed-in person, `market`/`mail` handled by a
 * peer that registered that capability, or a `peer` (the named peer confirms the assignment).
 */
export type CapabilityKind = 'confirmation' | 'choice' | 'search' | 'allocation' | 'task' | 'market' | 'mail' | 'peer' | 'llm' | 'repo' | 'tool' | 'verify' | 'organize'
/** Capabilities a peer can register with (shown as resource banks in the context panel). */
export const PEER_CAPABILITIES: CapabilityKind[] = ['search', 'market', 'mail', 'llm', 'repo', 'tool']

/** The standard library row: shipped in every root and, for people who contribute and vote, linked in Home. */
export const LIBRARY_ID = 'fos:library'
/** The library's Row types group: one row per row type, what every row is made from. */
export const ROW_TYPES_ID = 'lib:types'

/** The seed's row types, their pattern rows stored in `store`. */
export function seedTypes(store: FosStore): FosNodeContent[] {
  if (!store.table.has(COMPILED_LIBRARY.rootNodeId)) importNodes(store, COMPILED_LIBRARY.nodes as unknown as FosNodesData)
  return COMPILED_LIBRARY.types as FosNodeContent[]
}

/** The build's definition of the library type `typeId`, stored in `store`; null when this build has none. */
function seedType(store: FosStore, typeId: string): string | null {
  const seeded = seedTypes(store).find(type => type.data.alias?.id === typeId)
  return seeded ? put(store, seeded) : null
}

/**
 * Type the store root (its root alias's instruction): a device root, or a document root (the type a fresh store
 * starts with). The seed's version, which the library starts with.
 */
export function setRootType(store: FosStore, typeId: typeof DEVICE_ROOT_TYPE | typeof DOCUMENT_ROOT_TYPE): void {
  const type = seedType(store, typeId)!
  const root = content(store, store.rootNodeId)
  const ip = store.primitive.instructionPointerConstructor.getId()
  if (root.children.some(([i, t]) => i === ip && t === type)) return
  if (!rootIsAlias(store)) commitRoot(store, rootTargetCid(store), 0, null, true)
  const alias = content(store, store.rootNodeId)
  store.rootNodeId = put(store, { ...alias, children: alias.children.map(([i, t]): FosPathElem => i === ip ? [i, type] : [i, t]) })
}

// ---------------------------------------------------------------------------
// Row types. A row is the edge [type, row]: its type is the left node and nothing else. Library types are told apart
// by graph identity (`lib:type:…`, shared by every pinned version); a template row's content is the type of the tasks
// made from it.

/** The sync primitives: edges they label are bookkeeping (pointers, members, proposals, …), never rows. */
const primitiveIds = new WeakMap<FosStore, Set<string>>()
function isPrimitive(store: FosStore, cid: string): boolean {
  let ids = primitiveIds.get(store)
  if (!ids) {
    ids = new Set(Object.values(store.primitive as unknown as Record<string, { getId?: () => string }>).flatMap(p => typeof p?.getId === 'function' ? [p.getId()] : []))
    primitiveIds.set(store, ids)
  }
  return ids.has(cid)
}

/** The graph identity of the type node `typeCid`: `lib:type:…` for a library type (any version), a template row's id for a template. */
export function typeIdOf(store: FosStore, typeCid: string | null | undefined): string | null {
  if (!typeCid || !store.table.has(typeCid)) return null
  return content(store, typeCid).data.alias?.id ?? valueContent(store, typeCid).data.alias?.id ?? null
}

/** Whether `typeCid` (a row edge's left node) is a version of the library type `typeId`. */
export function isLibraryType(store: FosStore, typeCid: string, typeId: string): boolean {
  return typeIdOf(store, typeCid) === typeId
}

/**
 * The type a row edge is made from: its left node, through a branched row's selected alternative and a type error; a
 * row held by a peer and not loaded here is a reference. Null when the edge is not a row (a primitive's edge, a choice,
 * a typed argument slot, a node this store lacks).
 */
export function rowTypeOf(store: FosStore, edge: FosPathElem): string | null {
  edge = plainEdge(store, edge)
  if (isChoiceEdge(store, edge)) {
    if (!store.table.has(edge[1])) return null
    const node = content(store, edge[1])
    if (isPeerReference(node)) return libraryTypeAt(store, REF_TYPE)
    const active = isBranchChoice(store, node) ? branchEdge(store, edge[1]) : null
    return active ? rowTypeOf(store, active) : null
  }
  const [type, target] = edge
  if (!store.table.has(type) || !store.table.has(target) || isPrimitive(store, type)) return null
  // a typed argument ([type, ref] whose ref is of that type) is a slot, not a row
  return refTypeCid(store, content(store, target)) === type ? null : type
}

/** The graph identity of a row's type (`typeIdOf(rowTypeOf(edge))`): null for non-rows and for types without one. */
export function rowTypeIdOf(store: FosStore, edge: FosPathElem): string | null {
  return typeIdOf(store, rowTypeOf(store, edge))
}

export function isRowEdge(store: FosStore, edge: FosPathElem): boolean {
  return rowTypeOf(store, edge) !== null
}

/** Is `edge` a row made from the library type `typeId`? Its type is the edge's left node; any version of it counts. */
export function isRowOfType(store: FosStore, edge: FosPathElem, typeId: string): boolean {
  return rowTypeIdOf(store, edge) === typeId
}

/** The child rows of `cid` made from the library row type `typeId` (`lib:type:…`): their alias ids and identity cids. */
export function rowsOfType(store: FosStore, cid: string, typeId: string): Array<{ id: string; cid: string }> {
  return valueContent(store, cid).children.filter(e => isRowOfType(store, e, typeId)).map(e => ({ id: content(store, identityCid(store, e)).data.alias?.id ?? '', cid: identityCid(store, e) })).filter(r => r.id)
}

/** A template row's content used as a type (not a library type, a form or a missing template): instances of it are tasks. */
export function isTemplateType(store: FosStore, typeCid: string): boolean {
  const id = typeIdOf(store, typeCid)
  return !!id && !id.startsWith('lib:type:') && !valueContent(store, typeCid).data.form
}

/** A task: made from the Task type or from a template row. It has a done state, blockers and a checkbox. */
export function isTaskRow(store: FosStore, edge: FosPathElem): boolean {
  const type = rowTypeOf(store, edge)
  return !!type && (typeIdOf(store, type) === TASK_TYPE || isTemplateType(store, type))
}

/** A row of the Allocation type or a sub-type of it (money): a signed entry of a resource. */
export function isAllocationRow(store: FosStore, edge: FosPathElem): boolean {
  return isAllocationType(rowTypeIdOf(store, edge))
}

/**
 * The row type `typeId` (e.g. `lib:type:task`) new rows at `at` (below `root`) are made from: the library row
 * `fos:library` resolved like any mutable ref, by nearest ancestor (`findNearestRow`). So a library linked in Home
 * overrides the one shipped in the root for everything under Home, and any node can carry its own for its subtree. A
 * library seeded before the type existed falls back to the build's definition; a library whose Row types have not
 * arrived yet does not resolve, nor does a position with no library above.
 */
export function rowTypeAt(store: FosStore, typeId: string, at: Scope = [], root: string = rootTargetCid(store)): string {
  const found = nearestLibraryType(store, typeId, at, root)
  if (found) return found
  const seeded = nearestLibraryType(store, TEMPLATE_TYPE, at, root) ? seedType(store, typeId) : null
  if (seeded) return seeded
  throw new Error(`No standard library above this row has the row type ${typeId}.`)
}

/** The type a new row of `type` is made from: `type` itself when it is a type node here, else the row type with that id at `at`. */
export function resolveRowType(store: FosStore, type: string, at: Scope = [], root: string = rootTargetCid(store)): string {
  return store.table.has(type) ? type : rowTypeAt(store, type, at, root)
}

/**
 * The row type `typeId` (a row of the library's Row types group, e.g. `lib:type:note`) of the standard library nearest
 * to `at`, or null when no library above has it. New rows of that type are edges `[this cid, row]`.
 */
function nearestLibraryType(store: FosStore, typeId: string, at: Scope, root: string): string | null {
  const library = findNearestRow(store, root, at, (row) => row.id === LIBRARY_ID && !!libraryRowType(store, row.cid, typeId))
  if (library) return libraryRowType(store, library.cid, typeId)!
  // a draft of a node stands where that node is: its ancestors continue in the host
  const outer = outerScopes.get(store)
  if (outer) {
    const value = nearestLibraryType(outer.store, typeId, outer.at, outer.root)
    if (value) importNodes(store, reachableNodes(outer.store, [value]))
    return value
  }
  return null
}

/**
 * The library definition `typeId` (any library type or definition, e.g. `lib:type:user`) that a row at `at` sees: the
 * nearest library's, falling back to the one this build ships (a library seeded before it existed). Null when neither has it.
 */
export function libraryTypeAt(store: FosStore, typeId: string, at: Scope = [], root: string = rootTargetCid(store)): string | null {
  return nearestLibraryType(store, typeId, at, root) ?? seedType(store, typeId)
}

/**
 * A scratch store whose root is the value of the node at `at` below `root` in `store` (a draft of that node, built
 * to become a proposal) is a nested scope there: refs it does not resolve itself resolve from that position.
 */
export function nestScope(draft: FosStore, outer: { store: FosStore; root: string; at: Scope }): void {
  outerScopes.set(draft, outer)
}
const outerScopes = new WeakMap<FosStore, { store: FosStore; root: string; at: Scope }>()

/** The row type `typeId` of the library row `library`, when it is here (not a peer's unloaded node). */
function libraryRowType(store: FosStore, library: string, typeId: string): string | null {
  const loaded = (cid: string | null): cid is string => !!cid && !isPeerReference(content(store, cid))
  const group = loaded(library) ? findChild(store, library, ROW_TYPES_ID) : null
  const row = loaded(group) ? findChild(store, group, typeId) : null
  if (!loaded(row)) return null
  return valueCidOf(store, row)
}

/**
 * A Row types group from the contents of its types: one template row per type (an identity ref around the content,
 * so the content, which is what rows pin, is the same node wherever the group is). Its rows are made from its own
 * Template type.
 */
export function rowTypesContent(store: FosStore, types: FosNodeContent[]): FosNodeContent {
  const template = types.find((type) => type.data.alias?.id === TEMPLATE_TYPE)
  if (!template) throw new Error('Row types need a Template type.')
  const templateCid = put(store, template)
  const children = types.map((type): FosPathElem => {
    const id = type.data.alias?.id
    if (!id) throw new Error('A library definition needs a graph identity.')
    return [templateCid, put(store, refNodeContent(store, { alias: { id } }, put(store, type)))]
  })
  return { data: { alias: { id: ROW_TYPES_ID }, description: { content: 'Row types' } }, children }
}

/** The contents of the types in a Row types group, in order: what a version is (rows pin these). */
export function rowTypeContents(store: FosStore, groupCid: string): FosNodeContent[] {
  return valueContent(store, groupCid).children.flatMap((edge) => isRowOfType(store, edge, TEMPLATE_TYPE) ? [valueContent(store, identityCid(store, edge))] : [])
}

/**
 * The library row a device root ships is local to that device: node exchange of a root leaves it out on both sides,
 * and installing a root received from a peer keeps this device's own.
 */
export function isShippedLibrary(store: FosStore, path: Scope, edge: FosPathElem): boolean {
  return !path.length && aliasIdOf(content(store, identityCid(store, edge))) === LIBRARY_ID
}

/**
 * The library row a device root ships: one with the library's seed Row types when the device root has none (the rest of
 * the library is filled from the build's bundle, `ensureDeviceLibrary` in sync/library.ts). It stays on this device: the
 * fos server does not persist it. Other store roots get none; they are nested in a device root (`nestScope`).
 */
export function ensureLibraryRow(store: FosStore): void {
  setRootType(store, DEVICE_ROOT_TYPE)
  const root = rootTargetCid(store)
  if (findChild(store, root, LIBRARY_ID)) return
  const types = seedTypes(store)
  // its rows are made from its own Row type, like every row under it
  const row = seedType(store, PLAIN_TYPE)!
  const library = put(store, withMember(store, { data: { alias: { id: LIBRARY_ID }, description: { content: 'Standard library' } }, children: [[row, put(store, rowTypesContent(store, types))]] }, 'fos', 'fos', ['persist'], ['persist']))
  const value = valueContent(store, root)
  commitRoot(store, put(store, { ...value, children: [...value.children, [row, library]] }), 0)
}

/** Stand-in type for a row pinned to template `cid` that this store does not hold (see `resolveReferenceErrors`). */
export function referenceErrorTemplate(store: FosStore, cid: string): string {
  return put(store, { data: { description: { content: 'Reference error' }, missingTemplate: { cid } }, children: seedTypes(store).find(type => type.data.alias?.id === PLAIN_TYPE)!.children })
}

/** A template row a task was made from (not a library type, which has no identity of its own): its cid, alias id and name. */
export function userTemplateOf(store: FosStore, edge: FosPathElem): { cid: string; id: string; name: string } | null {
  const cid = rowTypeOf(store, edge)
  if (!cid || !isTemplateType(store, cid)) return null
  return { cid, id: typeIdOf(store, cid)!, name: valueContent(store, cid).data.description?.content ?? 'Template' }
}

/** A row pinned to a template this store has not received: the template it is waiting for. */
export function missingTemplateOf(store: FosStore, edge: FosPathElem): { cid: string } | null {
  edge = plainEdge(store, edge)
  if (isChoiceEdge(store, edge) || !store.table.has(edge[0])) return null
  const missing = content(store, edge[0]).data.missingTemplate
  return missing && typeof missing.cid === 'string' ? { cid: missing.cid } : null
}

/**
 * The type to keep when the row at `edge` is rewritten as a row of `type` (a type id): its own one while it stays
 * that type (a template a task was made from stays while it is a task; a type with a graph form, which re-parsed text
 * reads as plain, stays while it is plain); null means the type the library has for `type`.
 */
export function keptRowType(store: FosStore, edge: FosPathElem, type: string): string | null {
  edge = plainEdge(store, edge)
  if (isChoiceEdge(store, edge)) { const active = isBranchChoice(store, content(store, edge[1])) ? branchEdge(store, edge[1]) : null; return active ? keptRowType(store, active, type) : null }
  const own = rowTypeOf(store, edge)
  if (!own || missingTemplateOf(store, edge)) return null
  const id = typeIdOf(store, own)
  if (id === type) return own
  if (type === TASK_TYPE && isTemplateType(store, own)) return own
  if (type === PLAIN_TYPE && valueContent(store, own).data.form) return own
  return null
}

/** The template a row edge is pinned to (its row type or template row, or what a reference error waits for); null when the edge is not a row. */
export function pinnedTemplateOf(store: FosStore, edge: FosPathElem): string | null {
  return missingTemplateOf(store, edge)?.cid ?? rowTypeOf(store, edge)
}

/** The row edge for a received row pinned to `template`; a template this store lacks makes it a reference error. */
export function pinnedRowEdge(store: FosStore, cid: string, template: string): FosPathElem {
  return rowEdge(store, cid, store.table.has(template) ? template : referenceErrorTemplate(store, template))
}

/** The same row made from another template (e.g. a task instantiating "Plan a trip"). */
export function withRowTemplate(store: FosStore, edge: FosPathElem, templateCid: string): FosPathElem {
  edge = plainEdge(store, edge)
  if (isChoiceEdge(store, edge)) {
    const active = branchEdge(store, edge[1])
    return active ? [edge[0], updateBranch(store, edge[1], withRowTemplate(store, active, templateCid))] : edge
  }
  return [templateCid, edge[1]]
}

export function isChoiceEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.choiceTarget.getId()
}

/** Persistent editable choices reuse CHOICE/OPTION pointers; selection is local UI state. */
const branchSelections = new WeakMap<FosStore, Map<string, string>>()
export function isBranchChoice(store: FosStore, node: FosNodeContent): boolean {
  return !!node.data.option && !node.data.conflict && node.children.some(e => e[0] === store.primitive.optionNotSelectedConstructor.getId())
}
export function selectBranch(store: FosStore, id: string, name: string): void {
  let selections = branchSelections.get(store)
  if (!selections) { selections = new Map(); branchSelections.set(store, selections) }
  selections.set(id, name)
}
/** Run a synchronous graph operation in a peer's pinned branch context. */
export function withBranches<T>(store: FosStore, selections: Record<string, string>, run: () => T): T {
  const previous = branchSelections.get(store)
  const next = new Map(previous)
  for (const [id, name] of Object.entries(selections)) next.set(id, name)
  branchSelections.set(store, next)
  try { return run() } finally { if (previous) branchSelections.set(store, previous); else branchSelections.delete(store) }
}
export function scopeBranches(store: FosStore, root: string, path: Scope): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(store, root, path.slice(0, i))
    if (cid && isBranchChoice(store, content(store, cid))) result[readChoice(store, cid).id] = branchSelection(store, cid)
    else if (cid) { const branches = refBranches(store, content(store, cid)); if (branches) result[branches.id] = branches.selected }
  }
  return result
}
const policyReads = new WeakSet<FosStore>()
/** Main is the authority branch; the default is the legacy fallback when no main exists. */
export function withMainBranchPolicy<T>(store: FosStore, run: () => T): T {
  const nested = policyReads.has(store); policyReads.add(store)
  try { return run() } finally { if (!nested) policyReads.delete(store) }
}
export function branchSelection(store: FosStore, cid: string): string {
  const choice = readChoice(store, cid)
  if (policyReads.has(store)) return choice.options.find(o => o.peerId === 'main')?.peerId ?? choice.defaultName ?? choice.options[0]?.peerId ?? ''
  const name = branchSelections.get(store)?.get(choice.id)
  return choice.options.find(o => o.peerId === name)?.peerId ?? choice.defaultName ?? choice.options.map(o => o.peerId).sort()[0] ?? ''
}
export function branchEdge(store: FosStore, cid: string): FosPathElem | null {
  const choice = readChoice(store, cid)
  return choice.options.find(o => o.peerId === branchSelection(store, cid))?.edge ?? null
}
export function putBranches(store: FosStore, id: string, base: FosPathElem | null, options: ChoiceOption[], defaultName = 'main'): string {
  const cid = putChoice(store, id, base, options), node = content(store, cid)
  const { conflict: _conflict, ...data } = node.data
  const selectedIndex = Math.max(0, readChoice(store, cid).options.findIndex(o => o.peerId === defaultName))
  return put(store, { ...node, data: { ...data, option: { ...data.option!, selectedIndex } } })
}
export function updateBranch(store: FosStore, cid: string, edge: FosPathElem): string {
  const record = readChoice(store, cid), name = branchSelection(store, cid)
  return putBranches(store, record.id, record.base, record.options.map(o => o.peerId === name ? { ...o, edge } : o), record.defaultName)
}

export function isPeerEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.peerField.getId()
}

/**
 * The node that carries an edge's identity and data: the target ([template, row], [CHOICE, choice], [type, ref], …);
 * for a type error, the row it stands for.
 */
export function identityCid(store: FosStore, edge: FosPathElem): string {
  return isTypeErrorEdge(store, edge) ? plainEdge(store, edge)[1] : edge[1]
}

/** Rebuild an edge around a new version of its identity node (a type error is re-derived when it is committed). */
export function withIdentity(store: FosStore, edge: FosPathElem, cid: string): FosPathElem {
  return isTypeErrorEdge(store, edge) ? [plainEdge(store, edge)[0], cid] : [edge[0], cid]
}

/** Edges have the same "shape" when they differ only in their identity node (rows: made from the same template). */
export function sameShape(_store: FosStore, a: FosPathElem, b: FosPathElem): boolean {
  return a[0] === b[0]
}

// ---------------------------------------------------------------------------
// Content constructors

export function taskContent(id: string, title: string, done: boolean, createdAt: number, updatedAt: number): FosNodeContent {
  return {
    data: {
      alias: { id },
      description: { content: title },
      todo: { completed: done, time: createdAt },
      updated: { time: updatedAt }
    },
    children: []
  }
}

/** What a new row holds besides its text, by its type: a task's done state, a reference's target, a flow entry, … */
export type RowExtras = {
  done?: boolean
  refId?: string
  /** Market result: the account owning the referenced node. */
  refOwner?: string
  author?: { id: string; name: string }
  targetCid?: string
  store?: FosStore
  requirement?: NonNullable<FosNodeContent['data']['requirement']>
  supply?: NonNullable<FosNodeContent['data']['supply']>
  query?: NonNullable<FosNodeContent['data']['query']>
  resource?: NonNullable<FosNodeContent['data']['resource']>
  allocation?: NonNullable<FosNodeContent['data']['allocation']>
  /** The user `@name` names: bound as the row's `user` field (a user object); null removes it. */
  user?: UserRecord | null
}

const DEFAULT_ALLOCATION = { resource: '', type: 'inventory' as const, amount: 0, unit: 'unit' }

/**
 * Content of a new row of the library type `typeId` (the native data that type's rows carry). `text` is the title;
 * a reference ignores it. An allocation (or money) row is a requirement (negative), a supply or a plain allocation.
 */
export function rowContent(typeId: string, id: string, text: string, now: number, extra: RowExtras = {}): FosNodeContent {
  const data: FosNodeContent['data'] = { alias: { id }, description: { content: text }, updated: { time: now } }
  if (typeId === TASK_TYPE) data.todo = { completed: !!extra.done, time: now }
  if (isAllocationType(typeId)) {
    if (extra.requirement) data.requirement = extra.requirement
    else if (extra.supply) data.supply = extra.supply
    else data.allocation = extra.allocation ?? DEFAULT_ALLOCATION
  }
  if (typeId === QUERY_TYPE) data.query = extra.query ?? {}
  if (typeId === RESOURCE_TYPE) data.resource = extra.resource ?? { type: 'inventory', unit: 'unit' }
  if (typeId === REF_TYPE) {
    data.ref = extra.refOwner ? { id: extra.refId ?? '', owner: extra.refOwner } : { id: extra.refId ?? '' }
    // a reference row is itself a ref node: TARGETPOINTER holds a snapshot of the row it stands for
    if (extra.targetCid && extra.store) return refNodeContent(extra.store, data, extra.targetCid)
  }
  canonicalRowData(data)
  return { data, children: [] }
}


/** One write representation; older requirement records are only a read adapter. */
export function canonicalRowData(data: FosNodeContent['data']): FosNodeContent['data'] {
  if (data.requirement) {
    const req = data.requirement
    data.allocation = { ...req, capability: req.capability, resource: '', type: req.resource ?? 'inventory', amount: req.capability === 'allocation' ? -Math.abs(req.amount ?? 0) : -1, unit: req.unit ?? 'unit', ...(req.start !== undefined ? { start: req.start } : {}), ...(req.end !== undefined ? { end: req.end } : {}) }
    delete data.requirement
  } else if (data.supply) {
    const supply = data.supply
    data.allocation = { ...supply, resource: '', type: 'inventory', amount: 1, unit: 'unit' }
    delete data.supply
  }
  return data
}

/** The edge for row node `cid` made from `type` (a row type or a template row). */
export function rowEdge(store: FosStore, cid: string, type: string): FosPathElem {
  if (isBranchChoice(store, content(store, cid))) {
    const active = branchEdge(store, cid)
    return [store.primitive.choiceTarget.getId(), active ? updateBranch(store, cid, rowEdge(store, identityCid(store, active), type)) : cid]
  }
  return [type, cid]
}

/** The edge for a new row node `cid` of `type` (a type cid, or a type id resolved at `at` by `rowTypeAt`). */
export function rowEdgeAt(store: FosStore, type: string, cid: string, at: Scope, root?: string): FosPathElem {
  const typeCid = resolveRowType(store, type, at, root)
  return rowEdge(store, typeIdOf(store, typeCid) === TEMPLATE_TYPE ? withInstancePatterns(store, cid, at, root) : cid, typeCid)
}

/**
 * A template row is the type of the tasks made from it, so it says what they accept: a new template row gets the
 * pattern rows of the Task type it is made beside (nearest library), as its own rows from then on.
 */
export function withInstancePatterns(store: FosStore, cid: string, at: Scope, root?: string): string {
  const node = content(store, cid)
  if (isRefNode(store, node) || node.children.some((edge) => isRowOfType(store, edge, PATTERN_TYPE))) return cid
  const task = rowTypeAt(store, TASK_TYPE, at, root), owner = node.data.alias?.id ?? cid
  // the same patterns as rows of this template's own (ids of its own)
  const patterns = content(store, task).children.filter((edge) => isRowOfType(store, edge, PATTERN_TYPE)).map(([type, row]): FosPathElem => {
    const value = content(store, row), p = value.data.pattern
    return [type, put(store, { ...value, data: { ...value.data, alias: { id: `${owner}:accepts:${p?.any ? 'any' : p?.type ?? row}` } } })]
  })
  return put(store, { ...node, children: [...node.children, ...patterns] })
}

/**
 * Same node as a row of another type (`convertRowContent`); a row that stops being a template is no type any more,
 * so its pattern rows go (one that becomes a template gets them where its edge is made, `rowEdgeAt`).
 */
export function convertRow(store: FosStore, value: FosNodeContent, typeId: string, now: number, extra: Omit<RowExtras, 'store'> = {}): FosNodeContent {
  const title = formTitle(store, value)
  const { presentation: _presentation, scalar: _scalar, ...data } = value.data
  const converted = convertRowContent({ ...value, data: { ...data, description: { content: title } } }, typeId, now, extra)
  return typeId === TEMPLATE_TYPE ? converted : { ...converted, children: converted.children.filter((edge) => !isRowOfType(store, edge, PATTERN_TYPE)) }
}

/** Same node as a row of the library type `typeId`: the native data of its old type dropped, the new type's added. */
export function convertRowContent(value: FosNodeContent, typeId: string, now: number, extra: Omit<RowExtras, 'store'> = {}): FosNodeContent {
  const { todo: _todo, comment: _comment, ref: _ref, requirement: _rq, supply: _su, query: _q, resource: _rs, allocation: _al, ...rest } = value.data
  const data: FosNodeContent['data'] = { ...rest, updated: { time: now } }
  if (typeId === TASK_TYPE) data.todo = { completed: !!value.data.todo?.completed, time: value.data.todo?.time ?? now }
  if (typeId === REF_TYPE) data.ref = value.data.ref ?? { id: '' }
  if (isAllocationType(typeId)) {
    if (extra.requirement) data.requirement = extra.requirement
    else if (extra.supply) data.supply = extra.supply
    else data.allocation = extra.allocation ?? value.data.allocation ?? (value.data.requirement || value.data.supply ? canonicalRowData({ requirement: value.data.requirement, supply: value.data.supply }).allocation : DEFAULT_ALLOCATION)
  }
  if (typeId === QUERY_TYPE) data.query = value.data.query ?? {}
  if (typeId === RESOURCE_TYPE) data.resource = value.data.resource ?? { type: 'inventory', unit: 'unit' }
  return { ...value, data: canonicalRowData(data) }
}

export function peerRefContent(peerId: string): FosNodeContent {
  return { data: { alias: { id: `fos:device:${peerId}` }, peerId: { content: peerId } }, children: [] }
}

// ---------------------------------------------------------------------------
// Choice nodes

export type ChoiceOption = { peerId: string; edge: FosPathElem | null; base?: FosPathElem | null; requestMerge?: string }

export type ChoiceRecord = {
  defaultName?: string
  cid: string
  id: string
  base: FosPathElem | null
  options: ChoiceOption[]
}

function pointerContent(peerId: string | null, edge: FosPathElem | null, store: FosStore): FosNodeContent {
  const data = peerId ? { peerId: { content: peerId } } : {}
  const children: FosPathElem[] = edge
    ? [
        [store.primitive.instructionPointerConstructor.getId(), edge[0]],
        [store.primitive.targetPointerConstructor.getId(), edge[1]]
      ]
    : []
  return { data, children }
}

function readPointer(store: FosStore, cid: string): { peerId: string | null; edge: FosPathElem | null } {
  const value = content(store, cid)
  let instr: string | null = null
  let target: string | null = null
  for (const [i, t] of value.children) {
    if (i === store.primitive.instructionPointerConstructor.getId()) instr = t
    if (i === store.primitive.targetPointerConstructor.getId()) target = t
  }
  return {
    peerId: value.data.peerId?.content ?? null,
    edge: instr && target ? [instr, target] : null
  }
}

/** Both local and received branches request approval through this ordinary typed child ref. */
export function mergeRequestEdge(store: FosStore, id: string): FosPathElem {
  const type = store.primitive.approveAction.getId()
  return [type, put(store, refNodeContent(store, { alias: { id: `${id}:request-merge` }, name: { content: 'request merge' } }, null, [], type))]
}

/** Build and insert a choice node; the alternatives are sorted so the cid is deterministic. */
export function putChoice(store: FosStore, id: string, base: FosPathElem | null, options: ChoiceOption[]): string {
  const alternatives = options
    .map((o) => {
      const pointer = pointerContent(o.peerId, o.edge, store)
      if (o.requestMerge) pointer.children.push([store.primitive.approveAction.getId(), o.requestMerge])
      if (o.base) pointer.children.push([store.primitive.conflictBaseNode.getId(), put(store, pointerContent(null, o.base, store))])
      return { peerId: o.peerId, cid: put(store, pointer) }
    })
    .sort((a, b) => (a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0))
  const baseCid = put(store, pointerContent(null, base, store))
  const children: FosPathElem[] = [
    [store.primitive.conflictBaseNode.getId(), baseCid],
    ...alternatives.map((a): FosPathElem => [store.primitive.optionNotSelectedConstructor.getId(), a.cid])
  ]
  return put(store, {
    data: {
      alias: { id },
      conflict: { path: id },
      option: { selectedIndex: 0, defaultResolutionStrategy: 'choice' }
    },
    children
  })
}

export function readChoice(store: FosStore, choiceCid: string): ChoiceRecord {
  const value = content(store, choiceCid)
  let base: FosPathElem | null = null
  const options: ChoiceOption[] = []
  for (const [instr, target] of value.children) {
    if (instr === store.primitive.conflictBaseNode.getId()) {
      base = readPointer(store, target).edge
    } else if (instr === store.primitive.optionNotSelectedConstructor.getId()) {
      const pointer = readPointer(store, target)
      const basePointer = content(store, target).children.find(e => e[0] === store.primitive.conflictBaseNode.getId())
      const requestMerge = content(store, target).children.find(e => content(store, e[1]).data.name?.content === 'request merge')?.[1]
      options.push({ peerId: pointer.peerId ?? 'unknown', edge: pointer.edge, ...(requestMerge ? { requestMerge } : {}), ...(basePointer ? { base: readPointer(store, basePointer[1]).edge } : {}) })
    }
  }
  return { cid: choiceCid, id: aliasIdOf(value) ?? choiceCid, base, options, defaultName: options[value.data.option?.selectedIndex ?? 0]?.peerId }
}

// ---------------------------------------------------------------------------
// Navigation and immutable updates

export function findEdge(store: FosStore, value: FosNodeContent, key: string): FosPathElem | undefined {
  return value.children.find((edge) => edgeKey(store, edge) === key)
}

/** Follow alias ids (tasks or legacy plain nodes) from `nodeCid`. Null if any step is missing. */
export function resolveScope(store: FosStore, nodeCid: string | null, scope: Scope): string | null {
  let current = nodeCid
  for (const step of scope) {
    if (!current) break
    current = findChild(store, current, step)
  }
  if (!current && nodeCid && scope[0] !== 'fos:home') {
    const home = findChild(store, nodeCid, 'fos:home')
    if (home) return resolveScope(store, home, scope)
  }
  return current
}

/** Legacy attachment paths predate the explicit Home constructor. */
export function contextScope(store: FosStore, nodeCid: string, scope: Scope): Scope {
  if (!scope.length || findChild(store, nodeCid, scope[0]!)) return scope
  const home = findChild(store, nodeCid, 'fos:home')
  return home && resolveScope(store, home, scope) ? ['fos:home', ...scope] : scope
}

/** Replace, append or remove (`null`) the edge with `key`, keeping the others in order. */
export function replaceEdge(store: FosStore, value: FosNodeContent, key: string, edge: FosPathElem | null): FosNodeContent {
  let found = false
  const children: FosPathElem[] = []
  for (const existing of value.children) {
    if (edgeKey(store, existing) === key) {
      found = true
      if (edge) children.push(edge)
    } else {
      children.push(existing)
    }
  }
  if (!found && edge) children.push(edge)
  return { ...value, children }
}

/**
 * Path-copying update: apply `fn` to the node at `scope` under `nodeCid`;
 * returns the new cid of `nodeCid`. Every link node on the way to the change
 * gets a PREV edge to the version it replaces, so links keep their history.
 */
/**
 * Apply `fn` at `scope` below `nodeCid` and return the new cid of `nodeCid`.
 *   mode 'value' (default): `fn` sees and returns the *content* a node stands for; when the
 *     node is a ref (link row, root alias) the ref advances: a new ref node pointing at the new
 *     content with PREV → the old ref node. Bookkeeping (members, proposals, peers) is kept.
 *   mode 'node': `fn` sees and returns the identity node itself (a ref node for link rows), for
 *     bookkeeping changes; no PREV is added unless `fn` adds it.
 *   mode 'replace': replace the complete identity, including a branch wrapper at the destination.
 */
export function updateAtScope(store: FosStore, nodeCid: string, scope: Scope, fn: (value: FosNodeContent) => FosNodeContent, mode: 'value' | 'node' | 'replace' = 'value'): string {
  const canonical = contextScope(store, nodeCid, scope)
  if (canonical !== scope) return updateAtScope(store, nodeCid, canonical, fn, mode)
  const identity = content(store, nodeCid)
  if (isPeerReference(identity) && mode !== 'replace') throw new Error('This node is held by another peer. Connect to that peer before editing its content.')
  if (!scope.length && mode === 'replace') {
    const next = fn(identity)
    return next === identity ? nodeCid : put(store, next)
  }
  if (isBranchChoice(store, identity)) {
    const active = branchEdge(store, nodeCid)
    if (!active) throw new Error('No selected branch')
    const next = updateAtScope(store, identityCid(store, active), scope, fn, mode)
    return next === identityCid(store, active) ? nodeCid : updateBranch(store, nodeCid, withIdentity(store, active, next))
  }
  const ref = isRefNode(store, identity) && !isHandle(identity)
  const value = ref ? valueContent(store, nodeCid) : identity

  // the result for this node given its new content
  const advance = (nextValue: FosNodeContent): string => {
    if (nextValue === value) return nodeCid
    if (ref) {
      const now = nextValue.data.updated?.time ?? value.data.updated?.time ?? 0
      return put(store, relinkContent(store, identity, nodeCid, nextValue, now))
    }
    if (isLegacyInlineLink(store, identity)) {
      // not normalized yet: keep the old inline behaviour (PREV only on content change)
      const contentChanged = putStripped(store, nextValue) !== putStripped(store, value)
      return put(store, contentChanged ? withPrev(store, nextValue, nodeCid) : nextValue)
    }
    return put(store, nextValue)
  }

  if (scope.length === 0) {
    if (mode === 'node') {
      const next = fn(identity)
      return next === identity ? nodeCid : put(store, next)
    }
    return advance(fn(value))
  }
  const [step, ...rest] = scope as [string, ...string[]]
  const found = findAliasEdge(store, value, step)
  if (!found && ref) {
    const argument = findAliasEdge(store, identity, step)
    if (argument) {
      const before = identityCid(store, argument.edge)
      const after = updateAtScope(store, before, rest, fn, mode)
      if (before === after) return nodeCid
      const children = [...identity.children]; children[argument.index] = withIdentity(store, argument.edge, after)
      return put(store, withPrev(store, { ...identity, children }, nodeCid))
    }
  }
  if (!found || (isChoiceEdge(store, found.edge) && !isBranchChoice(store, content(store, found.edge[1])) && !isPeerReference(content(store, found.edge[1])))) throw new Error(`node ${step} not found`)
  const childCid = identityCid(store, found.edge)
  const nextChild = updateAtScope(store, childCid, rest, fn, mode)
  if (nextChild === childCid) return nodeCid
  const children = [...value.children]
  children[found.index] = withIdentity(store, found.edge, nextChild)
  return advance({ ...value, children })
}

/** Replace the content a child edge's identity stands for; returns the edge with its new identity (refs advance with PREV). */
export function withChildValue(store: FosStore, edge: FosPathElem, nextValue: FosNodeContent, now: number): FosPathElem {
  const idCid = identityCid(store, edge)
  const identity = content(store, idCid)
  if (isPeerReference(identity)) throw new Error('This node is held by another peer. Connect to that peer before editing its content.')
  if (isBranchChoice(store, identity)) {
    const active = branchEdge(store, idCid)
    return active ? withIdentity(store, edge, updateBranch(store, idCid, withChildValue(store, active, nextValue, now))) : edge
  }
  if (isRefNode(store, identity) && !isHandle(identity)) {
    return withIdentity(store, edge, put(store, relinkContent(store, identity, idCid, nextValue, now)))
  }
  return withIdentity(store, edge, put(store, nextValue))
}

/** Deliberately detach a device: drop its PEER edge (and its MEMBER entry, if any). */
export function withoutPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const children = value.children.filter((e) => {
    if (isPeerEdge(store, e) || isMemberEdge(store, e)) return content(store, e[1]).data.peerId?.content !== peerId
    return true
  })
  return children.length === value.children.length ? value : { ...value, children }
}

export function withPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const refCid = put(store, peerRefContent(peerId))
  const edge: FosPathElem = [store.primitive.peerField.getId(), refCid]
  if (value.children.some(([i, t]) => i === edge[0] && t === edge[1])) return value
  return { ...value, children: [...value.children, edge] }
}

// ---------------------------------------------------------------------------
// Roots

/**
 * The content node the store's root points at. Roots created by `setRootNode`
 * and `commitRoot` are alias nodes (TARGETPOINTER → content); roots written by
 * the seed/registration are the content node itself. Both are supported.
 */
export function rootTargetCid(store: FosStore): string {
  const root = content(store, store.rootNodeId)
  const pointer = root.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())
  // a root in type error keeps its content behind the error node (sync/patterns.ts)
  return pointer ? unwrapRootTarget(store, pointer[1]) : store.rootNodeId
}

/** The root alias's target as stored: the content, or the type error node in front of it. */
export function rootStoredTarget(store: FosStore): string {
  const root = content(store, store.rootNodeId)
  return root.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())?.[1] ?? store.rootNodeId
}

export function rootIsAlias(store: FosStore): boolean {
  return content(store, store.rootNodeId).children.some(([i]) => i === store.primitive.targetPointerConstructor.getId())
}

export const HOME_ID = 'fos:home'

/** Replace a member's offers (ACCEPTS edges) when they differ from `offers`, keeping its grants and switches. */
export function withMemberOffers(store: FosStore, value: FosNodeContent, peerId: string, name: string | null, consumes: Capability[], offers: Capability[]): FosNodeContent {
  const member = readMembers(store, value).find(m => m.peerId === peerId)
  const wanted = [...new Set(offers)].sort()
  if (member && JSON.stringify([...(member.accepts ?? [])].sort()) === JSON.stringify(wanted)) return value
  return withMember(store, value, peerId, member?.name ?? name, member?.capabilities ?? consumes, member?.disabled ?? [], wanted)
}

/**
 * Normalize an account context with ordinary constructor and member edges. `offers` is what the host currently
 * provides (the server passes its registry; a device passes what the server last reported): the fos member on the
 * root and the integration members in Home advertise exactly that, never a built-in list.
 */
export function homeContextCid(store: FosStore, rootCid: string, now: number, offers: HostOffers = {}): string {
  const root = valueContent(store, rootCid)
  const identity = makeLink(store, content(store, rootCid), 0)
  let bindings = identity
  const serverOffers = [...new Set([...SERVER_TRANSPORT_CAPABILITIES, ...(offers.server ?? [])])]
  if (!readMembers(store, bindings).some(member => member.peerId === 'fos')) bindings = withMember(store, bindings, 'fos', 'fos', [], [], serverOffers)
  else if (offers.server) bindings = withMemberOffers(store, bindings, 'fos', 'fos', [], serverOffers)
  const homeCid = findChild(store, rootCid, HOME_ID)
  // A branched Home is already a container: preserve its choice wrapper and alternatives.
  if (homeCid && isBranchChoice(store, content(store, homeCid))) {
    const edge = root.children.find(edge => identityCid(store, edge) === homeCid)!
    const nextEdge = rowEdge(store, homeCid, keptRowType(store, edge, HOME_TYPE) ?? rowTypeAt(store, HOME_TYPE, [], rootCid))
    if (nextEdge[0] === edge[0] && nextEdge[1] === edge[1] && bindings === identity && identity === content(store, rootCid)) return rootCid
    const nextValue = put(store, { ...root, children: root.children.map(e => e === edge ? nextEdge : e) })
    return put(store, refNodeContent(store, identity.data, nextValue, bookkeepingOf(store, bindings), refTypeCid(store, identity)))
  }
  const movable = homeCid ? [] : root.children.filter(edge => ((isRowEdge(store, edge) && !isRowOfType(store, edge, TEMPLATE_TYPE)) || isChoiceEdge(store, edge)) && content(store, identityCid(store, edge)).data.alias?.id !== LIBRARY_ID)
  const homeValue = homeCid ? valueContent(store, homeCid) : rowContent(HOME_TYPE, HOME_ID, 'Home', 0)
  let home = homeCid ? makeLink(store, content(store, homeCid), 0) : makeLink(store, { ...homeValue, children: movable }, 0)
  // a Home that was a template (older data) is no type: it keeps its rows but not a type's pattern rows
  if (homeCid && homeValue.children.some((edge) => isRowOfType(store, edge, PATTERN_TYPE))) {
    home = refNodeContent(store, home.data, put(store, { data: homeValue.data, children: homeValue.children.filter((edge) => !isRowOfType(store, edge, PATTERN_TYPE)) }), bookkeepingOf(store, home), refTypeCid(store, home))
  }
  // Integration handlers belong to Home; carry over old root bindings without losing overrides.
  const legacyIntegrations = bindings.children.filter(edge => isMemberEdge(store, edge) && content(store, edge[1]).data.peerId?.content?.startsWith('integration:'))
  for (const edge of legacyIntegrations) if (!readMembers(store, home).some(member => member.peerId === content(store, edge[1]).data.peerId?.content)) home = { ...home, children: [...home.children, edge] }
  if (legacyIntegrations.length) bindings = { ...bindings, children: bindings.children.filter(edge => !legacyIntegrations.includes(edge)) }
  for (const peer of INTEGRATION_PEERS) {
    const provides = offers.integrations?.[peer.id]
    if (!readMembers(store, home).some(member => member.peerId === `integration:${peer.id}`)) home = withMember(store, home, `integration:${peer.id}`, peer.name, peer.consumes, [], provides ?? [])
    else if (provides) home = withMemberOffers(store, home, `integration:${peer.id}`, peer.name, peer.consumes, provides)
  }
  // Resolve inherited handlers through this peer's root at evaluation time.
  // Copying root members into shared Home would publish device-local context and freeze inheritance.
  const nextHome = put(store, home)
  const homeEdge = root.children.find(edge => identityCid(store, edge) === homeCid)
  if (homeEdge && isRowOfType(store, homeEdge, HOME_TYPE) && homeCid === nextHome && bindings === identity && identity === content(store, rootCid)) return rootCid
  const keep = root.children.filter(edge => !movable.includes(edge) && (!homeCid || identityCid(store, edge) !== homeCid))
  const nextValue = put(store, { ...root, children: [...keep, rowEdge(store, nextHome, (homeEdge && keptRowType(store, homeEdge, HOME_TYPE)) ?? rowTypeAt(store, HOME_TYPE, [], rootCid))] })
  return put(store, refNodeContent(store, identity.data, nextValue, bookkeepingOf(store, bindings), refTypeCid(store, identity)))
}

/**
 * Advance the root alias to a new target, keeping the alias id, linking PREV to
 * the previous root and optionally MERGESOURCE to a root that was merged in.
 */
export function commitRoot(store: FosStore, newTargetCid: string, now: number, mergeSourceCid: string | null = null, force = false): void {
  // type errors are derived from types, so every commit re-derives them (memoized: only new nodes are visited)
  newTargetCid = canonicalTypeErrors(store, newTargetCid)
  if (newTargetCid === rootStoredTarget(store) && rootIsAlias(store) && !mergeSourceCid && !force) return
  const previous = content(store, store.rootNodeId)
  // A bare (non-alias) root is wrapped from here on: the alias keeps the history chain.
  const instruction = rootIsAlias(store)
    ? previous.children.find(([i]) => i === store.primitive.instructionPointerConstructor.getId())
    : undefined
  const children: FosPathElem[] = [
    [store.primitive.targetPointerConstructor.getId(), newTargetCid],
    [store.primitive.instructionPointerConstructor.getId(), instruction ? instruction[1] : seedType(store, DOCUMENT_ROOT_TYPE)!],
    [store.primitive.previousVersion.getId(), store.rootNodeId]
  ]
  if (mergeSourceCid) children.push([store.primitive.mergeSourceNode.getId(), mergeSourceCid])
  // Per-peer node endpoints are local policy, not part of the shared target.
  children.push(...previous.children.filter(([i, t]) => i === capabilityTarget(store, 'provideNode') && content(store, t).data.name?.content.startsWith('fos:node-link:')))
  const alias = previous.data.alias ?? { id: newId() }
  store.rootNodeId = put(store, { data: { alias, updated: { time: now } }, children })
  store.updateCtxCallback?.(store.exportContext([]))
}

// ---------------------------------------------------------------------------
// Serialization

/** All nodes reachable from `roots` (children edges), optionally skipping a known set. */
export function reachableNodes(store: FosStore, roots: Array<string | null>, skip: Set<string> = new Set()): FosNodesData {
  const out: FosNodesData = {}
  const stack = roots.filter((r): r is string => !!r && store.table.has(r))
  const seen = new Set<string>()
  while (stack.length) {
    const cid = stack.pop() as string
    if (seen.has(cid)) continue
    seen.add(cid)
    const value = content(store, cid)
    if (!skip.has(cid)) out[cid] = value
    for (const [i, t] of value.children) {
      if (!seen.has(i)) stack.push(i)
      if (!seen.has(t)) stack.push(t)
    }
  }
  return out
}

export function reachableSet(store: FosStore, roots: Array<string | null>): Set<string> {
  return new Set(Object.keys(reachableNodes(store, roots)))
}

/**
 * Add foreign nodes to the store. Only nodes in the current cid format whose
 * cid matches their content and whose edges resolve are accepted; the rest are
 * ignored. Returns accepted cids.
 */
export function importNodes(store: FosStore, nodes: FosNodesData): string[] {
  const accepted: string[] = []
  let pending = Object.entries(nodes).filter(([cid, value]) => {
    if (store.table.has(cid)) return false
    if (!value || typeof value !== 'object' || !Array.isArray(value.children)) return false
    return isCurrentCid(cid) && verifyCid(cid, value)
  })
  let progress = true
  while (pending.length && progress) {
    progress = false
    const rest: typeof pending = []
    for (const entry of pending) {
      const [cid, value] = entry
      if (value.children.every(([i, t]) => store.table.has(i) && store.table.has(t))) {
        store.table.set(cid, value)
        accepted.push(cid)
        progress = true
      } else {
        rest.push(entry)
      }
    }
    pending = rest
  }
  return accepted
}

export function exportReachableContext(store: FosStore, extraRoots: Array<string | null> = []): FosContextData {
  return {
    nodes: reachableNodes(store, [store.rootNodeId, ...extraRoots]),
    route: [],
    rootNodeId: store.rootNodeId
  }
}

// ---------------------------------------------------------------------------
// View model: what the UI sees (opaque ids, no cids)

export type TaskView = {
  /** Native leaf editor chosen by the graph constructor. */
  scalar?: NonNullable<FosDataContent['scalar']>['type'];
  form?: FormElement;
  text?: import('../types').TextPresentation;
  /** The row holds children its type does not accept (a type error, sync/patterns.ts): their alias ids. */
  typeError?: string[]
  /** This row is one of those its parent's type does not accept. */
  rejected?: boolean
  construction?: { name?: string; peerId?: string; handler?: string }

  branches?: { selected: string; names: string[]; mergeRequests?: string[] }
  id: string
  title: string
  /**
   * The row's type: the graph identity of its edge's left node (`lib:type:…` for a library type, any version; a template
   * row's id for a task made from it), '' when its type has none (rows of types this peer does not know render as plain).
   */
  type: string
  /** The left node itself (the pinned version), when the row has one. */
  typeCid?: string
  /** True only for tasks (made from the Task type or a template row): rendered with a checkbox. */
  checkable: boolean
  done: boolean
  /** For `ref` rows: alias id of the node this row stands for. */
  refId?: string
  /** Reference rows pointing at another account's listed node (market results). */
  refOwner?: string
  /** Content is held by this device and has not been received here. */
  refPeer?: string
  /** For comments: who wrote it. */
  author?: { id: string; name: string; time: number }
  /** The user object the row names (its `user` field, typed as `@name`; sync/users.ts). */
  user?: UserRecord
  /** Tasks: unsatisfied requirements (summaries) that block completion. */
  blockedBy?: string[]
  /** Tasks made from a template row (the row edge's instruction): which one. */
  template?: { id: string; name: string }
  /** Reference errors: the template the row is pinned to, requested from the peer and not received yet. */
  missingTemplate?: { cid: string }
  /** `have`: for allocation requirements, the amount already allocated to it (child allocations and supplied references); `need` its amount. */
  requirement?: NonNullable<FosDataContent['requirement']> & { satisfied: boolean; summary: string; have?: number; need?: number }
  supply?: NonNullable<FosDataContent['supply']>
  query?: NonNullable<FosDataContent['query']>
  resource?: NonNullable<FosDataContent['resource']> & { allocated: number; available: number | null }
  allocation?: NonNullable<FosDataContent['allocation']>
  /** Listed on the market: the market peer is a member of this node (`isListed`). */
  market?: boolean
  createdAt: number
  updatedAt: number
  /** Direct subtasks and unresolved choices, for the tree. */
  childCount: number
  childChoices: number
  /** Whole subtree. */
  subtreeTasks: number
  subtreeDone: number
  isLink: boolean
}
export type ChoiceOptionView = { peerId: string; task: TaskView | null; label: string | null }
export type ChoiceView = {
  id: string
  subject: string
  base: TaskView | null
  baseLabel: string | null
  options: ChoiceOptionView[]
}
export type ProposalView = {
  id: string
  peerId: string
  name: string
  status: 'open' | 'rejected'
  timestamp: number
  /** Changes the proposal would make to this node's tasks, relative to its base. */
  summary: { added: string[]; changed: string[]; removed: string[] }
}

export type NodeView = {
  name: string | null
  done: boolean | null
  tasks: TaskView[]
  choices: ChoiceView[]
  peers: string[]
  isLink: boolean
  members: MemberRecord[]
  proposals: ProposalView[]
  /** Number of previous versions reachable through PREV (links only). */
  versions: number
  /** The node holds children its type does not accept (their alias ids; they are marked `rejected`). */
  typeError?: string[]
}

/**
 * The market is a peer the fos server serves: a node is listed iff this peer is a member of it with `read` (`edit` =
 * it takes proposals from the accounts that find it there), and the listing reaches the node's subtree like any
 * member grant. Unlisting removes the member. Handlers published to the market are typed refs on its `to` side
 * (sync/handlers.ts `publishTemplate`). Market grants are the market's: they never become other accounts' own.
 */
export const MARKET_PEER = 'fos:market'
/** The market member entry on this node itself (not inherited), or undefined. */
export function marketMemberOf(store: FosStore, nodeCid: string): MemberRecord | undefined {
  return readMembers(store, content(store, nodeCid)).find((m) => m.peerId === MARKET_PEER)
}
/** What the market member on this node grants, switched-off capabilities removed (null: no market member here). */
export function marketGrantsOf(store: FosStore, nodeCid: string): Capability[] | null {
  const m = marketMemberOf(store, nodeCid)
  return m ? m.capabilities.filter((c) => !m.disabled?.includes(c)) : null
}
/** Is the node listed right here (the market is its member with `read`)? */
export function isListed(store: FosStore, nodeCid: string): boolean {
  return !!marketGrantsOf(store, nodeCid)?.includes('read')
}
/**
 * The JSON value of the named argument ref `name` on the node `nodeCid` (what `readNodeValue` reads, without a
 * replica). Null when the node has no such value.
 */
export function namedValueOf<T>(store: FosStore, nodeCid: string, name: string): T | null {
  for (const edge of valueContent(store, nodeCid).children) {
    const id = identityCid(store, edge), ref = content(store, id), type = refTypeCid(store, ref)
    if (!type || edge[0] !== type || !ref.data.alias?.id || (ref.data.name?.content ?? ref.data.alias.id) !== name) continue
    try { return JSON.parse(valueContent(store, id).data.description?.content ?? '') as T } catch { return null }
  }
  return null
}

/** A row edge as the tree shows it (null when the edge is not a row). */
export function edgeView(store: FosStore, edge: FosPathElem): TaskView | null {
  return isRowEdge(store, edge) ? rowView(store, identityCid(store, edge), edge) : null
}

/**
 * A row as the tree shows it. `edge` (the row edge it is the target of) is what says what the row is: its type is the
 * edge's left node. Without it the row reads as a row of no known type (plain).
 */
export function rowView(store: FosStore, nodeCid: string, edge?: FosPathElem): TaskView {
  const identity = content(store, nodeCid)
  const value = valueContent(store, nodeCid)
  const created = value.data.created?.time ?? value.data.todo?.time ?? value.data.updated?.time ?? 0
  // a node held by another peer, not loaded yet, stands for it like a reference
  const held = isPeerReference(identity)
  const typeCid = edge ? rowTypeOf(store, edge) : null
  const type = typeIdOf(store, typeCid) ?? ''
  const task = !held && !!edge && isTaskRow(store, edge)
  const sub = countNode(store, nodeCid)
  const typeError = edge ? typeErrorOf(store, edge) : null
  const definition = typeCid ? valueContent(store, typeCid) : undefined
  const view: TaskView = {
    id: aliasIdOf(identity) ?? aliasIdOf(value) ?? nodeCid,
    title: formTitle(store, value, definition),
    type,
    ...(typeCid ? { typeCid } : {}),
    checkable: task,
    done: task && !!value.data.todo?.completed,
    createdAt: created,
    updatedAt: value.data.updated?.time ?? created,
    childCount: value.children.filter((e) => isRowEdge(store, e)).length,
    childChoices: value.children.filter((e) => isChoiceEdge(store, e)).length,
    subtreeTasks: sub.tasks,
    subtreeDone: sub.done,
    isLink: isLink(store, identity)
  }
  if (definition?.data.form && !definition.data.form.primitive && !held) view.form = formElements(store, typeCid!, value)
  const text = definition?.data.form?.text ?? value.data.presentation?.text
  if (text) view.text = text
  if (value.data.scalar) view.scalar = value.data.scalar.type
  if (held) { view.refPeer = identity.data.ref!.peer; view.title = identity.data.description?.content ?? 'Peer-held node' }
  const activeEdge = isBranchChoice(store, identity) ? branchEdge(store, nodeCid) : null
  const constructor = activeEdge ? content(store, identityCid(store, activeEdge)) : identity
  if (refTypeCid(store, constructor) === capabilityTarget(store, 'peer') && constructor.data.name) view.construction = { handler: constructor.data.name.content }
  if (held || type === REF_TYPE) { view.refId = identity.data.ref?.id ?? ''; if (identity.data.ref?.owner) view.refOwner = identity.data.ref.owner }
  const attribution = formAttribution(store, value, definition)
  if (attribution) view.author = attribution
  // Read-only compatibility for pre-constructor comments; edits migrate them.
  else if (value.data.comment) view.author = { id: value.data.comment.authorID, name: value.data.comment.authorName, time: value.data.comment.time }
  const template = edge ? userTemplateOf(store, edge) : null
  if (template) view.template = { id: template.id, name: template.name }
  const missing = edge ? missingTemplateOf(store, edge) : null
  if (missing) view.missingTemplate = { cid: missing.cid }
  if (task) { const blockers = taskBlockers(store, nodeCid); if (blockers.length) view.blockedBy = blockers }
  if (isBranchChoice(store, identity)) view.branches = { selected: branchSelection(store, nodeCid), names: readChoice(store, nodeCid).options.map(o => o.peerId), mergeRequests: readChoice(store, nodeCid).options.filter(o => o.requestMerge).map(o => o.peerId) }
  const user = userOf(store, value)
  if (user) view.user = user
  if (!held && isAllocationType(type)) {
    const flow = flowOf(type, value)
    if (flow.requirement) {
      const progress = requirementProgress(store, nodeCid)
      view.requirement = { ...flow.requirement, satisfied: requirementSatisfied(store, nodeCid), summary: requirementSummary(flow.requirement, user), ...(progress ? progress : {}) }
    }
    if (flow.supply) view.supply = flow.supply
    if (flow.allocation) view.allocation = allocationValue(store, nodeCid)
  }
  if (type === QUERY_TYPE) view.query = value.data.query ?? {}
  if (type === RESOURCE_TYPE && value.data.resource) { const allocated = allocatedIn(store, nodeCid); view.resource = { ...value.data.resource, allocated, available: value.data.resource.capacity === undefined ? null : value.data.resource.capacity - allocated } }
  if (isListed(store, nodeCid)) view.market = true
  if (typeError?.length) view.typeError = typeError
  return view
}

// ---------------------------------------------------------------------------
// Requirements, supplies, resources

/**
 * What an allocation-typed row is, read from the sign of its amount: a negative entry is a requirement (what its
 * parent needs), a positive one is supplied. A money row (`lib:type:allocation:money`) is told apart by sign alone:
 * negative = a request for payment, positive = a payment (a supply that is also an allocation of that amount). Other
 * allocation rows supply a handler's answer when they name its capability; without one they are plain allocations.
 */
export function flowOf(typeId: string, value: FosNodeContent): { requirement?: NonNullable<FosDataContent['requirement']>; supply?: NonNullable<FosDataContent['supply']>; allocation?: boolean } {
  const requirement = demandOf(value)
  if (requirement) return { requirement }
  const a = value.data.allocation
  if (typeId === MONEY_TYPE) return a && a.amount > 0 ? { supply: { capability: 'allocation', by: a.by ?? '', at: a.at ?? 0, ...(a.ref ? { ref: a.ref } : {}) }, allocation: true } : {}
  const supply = supplyOf(value)
  return supply ? { supply } : a ? { allocation: true } : {}
}

/** Supplied handler values are positive entries of the same flow record (a money row: see `flowOf`). */
export function supplyOf(value: FosNodeContent): FosDataContent['supply'] {
  if (value.data.supply) return value.data.supply
  const a = value.data.allocation
  return a?.capability && a.amount > 0 ? { capability: a.capability, by: a.by ?? '', at: a.at ?? 0, ...(a.ref ? { ref: a.ref } : {}), ...(a.choice !== undefined ? { choice: a.choice } : {}) } : undefined
}

/** A demand and a contribution are signed entries of the same resource. Legacy demand records still read. */
export function demandOf(value: FosNodeContent): FosDataContent['requirement'] {
  if (value.data.requirement) return value.data.requirement
  const a = value.data.allocation
  return a && (a.amount < 0 || (a.amount === 0 && !!a.capability)) ? { capability: a.capability ?? 'allocation', ...(!a.capability || a.capability === 'allocation' ? { resource: a.type, amount: -a.amount, unit: a.unit } : {}), ...(a.options ? { options: a.options } : {}), ...(a.peer ? { peer: a.peer } : {}), ...(a.repo ? { repo: a.repo } : {}), ...(a.tool ? { tool: a.tool } : {}), ...(a.start !== undefined ? { start: a.start } : {}), ...(a.end !== undefined ? { end: a.end } : {}) } : undefined
}


export function requirementSummary(req: NonNullable<FosDataContent['requirement']>, user?: UserRecord | null): string {
  const named = user ? ` @${user.username}` : ''
  switch (req.capability) {
    case 'confirmation': return 'confirmation'
    case 'choice': return `choice${req.options?.length ? ` (${req.options.join(' | ')})` : ''}`
    case 'search': return 'search'
    case 'allocation': return `${req.resource ?? 'resource'}${req.amount !== undefined ? ` ${req.amount} ${req.unit ?? ''}`.trimEnd() : ''}${named}`
    case 'task': return 'task'
    case 'market': return 'market'
    case 'mail': return 'mail'
    case 'peer': return user ? `@${user.username}` : req.peer ? `@${req.peer}` : 'peer'
    case 'llm': return 'llm'
    case 'repo': return req.repo ? `repo ${req.repo}` : 'repo'
    case 'tool': return req.tool ? `tool ${req.tool}` : 'tool'
    case 'verify': return user ? `verify @${user.username}` : 'verify'
    case 'organize': return 'organize'
  }
}

/** A child row read for requirement matching: its identity cid, edge, type id and content. */
export type ChildRow = { cid: string; edge: FosPathElem; type: string; value: FosNodeContent }
/** Rows directly under `cid`, with their identity cids and types. */
export function childRows(store: FosStore, cid: string): ChildRow[] {
  const out: ChildRow[] = []
  for (const edge of valueContent(store, cid).children) {
    if (!isRowEdge(store, edge)) continue
    const id = identityCid(store, edge)
    out.push({ cid: id, edge, type: rowTypeIdOf(store, edge) ?? '', value: valueContent(store, id) })
  }
  return out
}
/** Allocation rows that hold an amount of a resource (positive entries, money payments included). */
const allocationEntry = (row: ChildRow): boolean => isAllocationType(row.type) && !!flowOf(row.type, row.value).allocation
/** Allocation rows that supply a requirement (a handler's answer, or a money payment). */
const supplyEntry = (row: ChildRow) => isAllocationType(row.type) ? flowOf(row.type, row.value).supply : undefined
/** Rows that are requirements of their parent (negative allocation entries). */
const requirementEntry = (row: ChildRow) => isAllocationType(row.type) ? flowOf(row.type, row.value).requirement : undefined

/** Does an allocation fill an allocation requirement (resource type and amount)? */
function allocationFills(req: NonNullable<FosDataContent['requirement']>, a: FosDataContent['allocation'] | undefined, users?: RequiredUser): boolean {
  return allocationMatches(req, a, users) && (req.amount === undefined || a!.amount >= req.amount)
}

/** The user a requirement names (its `user` field) and the one an allocation is for, when the requirement names one. */
export type RequiredUser = { required: UserRecord | null; given: UserRecord | null | undefined }
function requiredUser(store: FosStore, requirementCid: string, allocationCid: string): RequiredUser {
  return { required: userOf(store, valueContent(store, requirementCid)), given: userOf(store, valueContent(store, allocationCid)) }
}

/**
 * Does an allocation count towards an allocation requirement at all (resource type matches), whatever its amount?
 * A requirement that names a user (`-@bob`, `-ff 5 @bob`) counts only allocations for that same user object.
 */
export function allocationMatches(req: NonNullable<FosDataContent['requirement']>, a: FosDataContent['allocation'] | undefined, users?: RequiredUser): boolean {
  return !!a && (!req.resource || a.type === req.resource) && (!req.unit || a.unit === req.unit) &&
    (req.start === undefined || (a.start !== undefined && a.start <= req.start)) &&
    (req.end === undefined || a.end === undefined || a.end >= req.end) &&
    (!users?.required || (!!users.given && sameUser(users.required, users.given))) &&
    // a named place is met by an allocation at that place by name, or by a position (a device's location) with no name
    (!req.place || !a.location?.name || a.location.name.trim().toLowerCase() === req.place.trim().toLowerCase())
}

/**
 * How much of an allocation requirement is covered: the amounts of the allocation rows inside it (a money request's
 * payments among them) and of the allocations its supplies reference, against the amount it asks for. Null for other
 * requirements or when the requirement names no amount.
 */
export function requirementProgress(store: FosStore, requirementCid: string, root?: string): { have: number; need: number } | null {
  const req = demandOf(valueContent(store, requirementCid))
  if (!req || req.capability !== 'allocation' || req.amount === undefined) return null
  let have = 0
  for (const row of childRows(store, requirementCid)) {
    if (allocationEntry(row)) { const allocation = allocationValue(store, row.cid); if (allocationMatches(req, allocation, requiredUser(store, requirementCid, row.cid))) have += allocation?.amount ?? 0; continue }
    const supply = supplyEntry(row)
    if (supply?.capability === 'allocation' && supply.ref) {
      const found = findRowByAlias(store, root ?? rootTargetCid(store), supply.ref)
      if (!found) have += req.amount // supplied from outside this replica: trusted in full
      else if (allocationMatches(req, found.row.allocation, { required: userOf(store, valueContent(store, requirementCid)), given: found.row.user })) have += found.row.allocation?.amount ?? 0
    }
  }
  return { have, need: req.amount }
}

/**
 * A requirement is satisfied by a child row that fills it: a done task (`task`), an allocation of the resource and
 * amount (`allocation`; for money, payments), a query that has been run (`search`); or by a supply row under it that
 * matches its capability (confirmation, choice, a peer's answer, or a reference to an allocation/query row elsewhere).
 */
export function requirementSatisfied(store: FosStore, requirementCid: string, root?: string): boolean {
  const req = demandOf(valueContent(store, requirementCid))
  if (!req) return true
  const rows = childRows(store, requirementCid)
  const named = userOf(store, valueContent(store, requirementCid))
  const filledByChild = rows.some((row) => {
    const { value, cid } = row
    switch (req.capability) {
      case 'task': return isTaskRow(store, row.edge) && !!value.data.todo?.completed
      case 'allocation': return allocationEntry(row) && allocationFills(req, allocationValue(store, cid), requiredUser(store, requirementCid, cid))
      case 'search': return row.type === QUERY_TYPE && !!value.data.query?.executedAt
      // "-@name": the named user allocates themself ("@name 2h") inside it: the same user object on both rows
      case 'peer': {
        if (!allocationEntry(row) || value.data.allocation?.type !== 'person') return false
        const given = userOf(store, value)
        return (!named || (!!given && sameUser(named, given))) && (!req.peer || (!!given && userPeerId(given) === req.peer))
      }
      default: return false
    }
  })
  if (filledByChild) return true
  // an allocation requirement with an amount is also met by several smaller allocations adding up (child rows and supplied references)
  if (req.capability === 'allocation' && req.amount !== undefined && req.amount > 0) {
    const progress = requirementProgress(store, requirementCid, root)
    if (progress && progress.have >= progress.need) return true
  }
  return rows.some((row) => {
    const s = supplyEntry(row)
    if (!s || s.capability !== req.capability) return false
    switch (req.capability) {
      case 'confirmation': return !!s.by
      case 'choice': return typeof s.choice === 'number' && (!req.options || (s.choice >= 0 && s.choice < req.options.length))
      case 'search': return !!s.ref
      case 'task': return !!s.ref
      case 'market': return !!s.by
      case 'mail': return !!s.by
      case 'llm': return !!s.by
      case 'repo': return !!s.by
      case 'tool': return !!s.by
      // filled by the verifier, which binds the attested user object as the requirement's user field
      case 'verify': return !!s.by && !!named?.verification
      case 'organize': return !!s.by
      case 'peer': return !!s.by && (!req.peer || s.by === req.peer) && (!named || s.by === userPeerId(named) || s.by === named.username)
      case 'allocation': {
        if (!s.ref) return false
        const found = findRowByAlias(store, root ?? rootTargetCid(store), s.ref)
        if (!found) return true // supplied by reference to an allocation outside this replica's scope: trusted
        return allocationFills(req, found.row.allocation, { required: named, given: found.row.user })
      }
    }
  })
}

/** The template row named `name` (case-insensitive) that a row at `at` sees: by nearest ancestor (`findNearestRow`). */
export function findTemplate(store: FosStore, rootCid: string, name: string, at: Scope = []): { path: Scope; row: TaskView; cid: string } | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const found = findNearestRow(store, rootCid, at, (row) => isRowOfType(store, row.edge, TEMPLATE_TYPE) && (valueContent(store, row.cid).data.description?.content ?? '').trim().toLowerCase() === wanted)
  return found ? { path: found.path, row: rowView(store, found.cid, found.edge), cid: found.cid } : null
}

/**
 * Mutable refs resolve by nearest ancestor: the first row matching `match` in the subtree of the closest ancestor of
 * `at` (shallowest first), then in each wider ancestor's subtree up to `root`. `path` is the matched row's parent.
 * Nodes a peer holds without their content are not searched into.
 */
export function findNearestRow(store: FosStore, root: string, at: Scope, match: (row: { id: string; cid: string; edge: FosPathElem }) => boolean): { path: Scope; id: string; cid: string; edge: FosPathElem } | null {
  for (let i = at.length; i >= 0; i--) {
    const scope = at.slice(0, i), start = resolveScope(store, root, scope)
    if (!start) continue
    // the subtree towards `at` was searched at the previous step; its row itself was not
    const searched = i < at.length ? at[i] : null
    const queue: Array<{ cid: string; path: Scope }> = [{ cid: start, path: scope }]
    while (queue.length) {
      const { cid, path } = queue.shift()!
      if (isPeerReference(content(store, cid))) continue
      for (const edge of valueContent(store, cid).children) {
        if (!isRowEdge(store, edge)) continue
        const child = identityCid(store, edge), id = aliasIdOf(content(store, child))
        if (!id) continue
        if (match({ id, cid: child, edge })) return { path, id, cid: child, edge }
        if (!(path === scope && id === searched)) queue.push({ cid: child, path: [...path, id] })
      }
    }
  }
  return null
}

/** Summaries of the requirements under a task that are not satisfied yet. */
export function taskBlockers(store: FosStore, taskCid: string): string[] {
  return childRows(store, taskCid).flatMap((row) => {
    const req = requirementEntry(row)
    return req && !requirementSatisfied(store, row.cid) ? [requirementSummary(req, userOf(store, row.value))] : []
  })
}

/** Sum of allocation amounts anywhere under a resource bank (sub-banks included). */
export function allocatedIn(store: FosStore, bankCid: string): number {
  const type = valueContent(store, bankCid).data.resource?.type
  const sum = (cid: string): number => childRows(store, cid).reduce((total, child) => {
    const allocation = allocationEntry(child) ? allocationValue(store, child.cid) : undefined
    const amount = allocation && (!type || allocation.type === type) ? allocation.amount : 0
    return total + amount + sum(child.cid)
  }, 0)
  return sum(bankCid)
}

function describeEdge(store: FosStore, edge: FosPathElem | null): { task: TaskView | null; label: string | null } {
  if (!edge) return { task: null, label: null }
  if (isRowEdge(store, edge)) return { task: rowView(store, identityCid(store, edge), edge), label: null }
  const value = valueContent(store, identityCid(store, edge))
  return { task: null, label: value.data.description?.content ?? value.data.alias?.id ?? 'node' }
}

export function choiceView(store: FosStore, choiceCid: string): ChoiceView {
  const record = readChoice(store, choiceCid)
  const base = describeEdge(store, record.base)
  const options = record.options.map((o) => ({ peerId: o.peerId, ...describeEdge(store, o.edge) }))
  const subject =
    base.task?.title ?? base.label ?? options.map((o) => o.task?.title ?? o.label).find((s) => !!s) ?? record.id
  return { id: record.id, subject, base: base.task, baseLabel: base.label, options }
}

export function countNode(store: FosStore, cid: string): { tasks: number; done: number; choices: number } {
  let tasks = 0
  let done = 0
  let choices = 0
  for (const edge of valueContent(store, cid).children) {
    if (isTaskRow(store, edge)) {
      tasks++
      const taskCid = identityCid(store, edge)
      if (valueContent(store, taskCid).data.todo?.completed) done++
      const sub = countNode(store, taskCid)
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    } else if (isChoiceEdge(store, edge) && !isBranchChoice(store, content(store, edge[1])) && !isPeerReference(content(store, edge[1]))) {
      choices++
    } else if (isRowEdge(store, edge)) {
      const sub = countNode(store, identityCid(store, edge))
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    }
  }
  return { tasks, done, choices }
}

export function viewNode(store: FosStore, cid: string, constructors = false): NodeView {
  if (isBranchChoice(store, content(store, cid))) { const active = branchEdge(store, cid); if (active) return { ...viewNode(store, identityCid(store, active), constructors), members: readMembers(store, content(store, cid)) } }
  const identity = content(store, cid)      // ref node for link rows (bookkeeping lives here)
  const value = valueContent(store, cid)    // the content: text, rows
  const link = isLink(store, identity)
  const view: NodeView = {
    name: formTitle(store, value) || null,
    done: value.data.todo ? !!value.data.todo.completed : null,
    tasks: [], choices: [], peers: [],
    isLink: link,
    members: link || isPeerReference(identity) ? readMembers(store, identity) : [],
    proposals: link ? readProposals(store, identity).map((p) => proposalView(store, identity, p)) : [],
    versions: link ? linkHistory(store, cid).length : 0
  }
  // peers may sit on the ref node (new) or on the content node (legacy inline links, plain nodes)
  const peerEdges = identity === value ? identity.children : [...identity.children, ...value.children]
  for (const edge of peerEdges) {
    if (isPeerEdge(store, edge)) {
      const peerId = content(store, edge[1]).data.peerId?.content
      if (peerId && !view.peers.includes(peerId)) view.peers.push(peerId)
    }
  }
  for (const edge of value.children) {
    if (isRowEdge(store, edge)) {
      view.tasks.push(rowView(store, identityCid(store, edge), edge))
    } else if (isChoiceEdge(store, edge)) {
      view.choices.push(choiceView(store, edge[1]))
    }
  }
  if (constructors) {
    const seen = new Set<string>()
    for (const edge of [...value.children, ...(identity === value ? [] : identity.children)]) {
      const child = content(store, identityCid(store, edge))
      const peerId = (isMemberEdge(store, edge) || isPeerEdge(store, edge)) ? child.data.peerId?.content : undefined
      const name = refTypeCid(store, child) ? child.data.name?.content : undefined
      if ((!peerId && (!name?.startsWith('fos:setting:') && name !== 'fos:evaluation')) || !child.data.alias?.id) continue
      if (seen.has(peerId ?? child.data.alias.id)) continue
      seen.add(peerId ?? child.data.alias.id)
      const row = rowView(store, identityCid(store, edge))
      row.title = name === 'fos:evaluation' ? 'Evaluation' : peerId ? child.data.name?.content ?? peerId : child.data.description?.content ?? name!
      row.construction = { ...(name ? { name } : {}), ...(peerId ? { peerId } : {}) }
      view.tasks.push(row)
    }
  }
  // Order is the edge order (part of the node's identity since cid v2); no sorting.
  return view
}

/** Where a peer is attached: the scope of the first node (depth-first) carrying a [PEER, ref] edge for `peerId`. */
export function findPeerScope(store: FosStore, nodeCid: string, peerId: string, prefix: Scope = []): Scope | null {
  if (isBranchChoice(store, content(store, nodeCid))) {
    for (const option of readChoice(store, nodeCid).options) { const found = option.edge ? findPeerScope(store, identityCid(store, option.edge), peerId, prefix) : null; if (found) return found }
    return null
  }
  const identity = content(store, nodeCid)
  const value = valueContent(store, nodeCid)
  for (const edge of identity === value ? identity.children : [...identity.children, ...value.children]) {
    if (isPeerEdge(store, edge) && content(store, edge[1]).data.peerId?.content === peerId) return prefix
  }
  for (const edge of value.children) {
    if (!isRowEdge(store, edge)) continue
    const childCid = identityCid(store, edge)
    const id = aliasIdOf(content(store, childCid))
    if (!id) continue
    const found = findPeerScope(store, childCid, peerId, [...prefix, id])
    if (found) return found
  }
  return null
}

/** Node names along a scope, for labels. */
export function scopeNames(store: FosStore, nodeCid: string | null, scope: Scope): string[] {
  const names: string[] = []
  let current = nodeCid
  for (const step of scope) {
    if (!current) { names.push(step); continue }
    const next = findChild(store, current, step)
    names.push(next ? formTitle(store, valueContent(store, next)) || step : step)
    current = next
  }
  return names
}

// ---------------------------------------------------------------------------
// Link nodes: history, members and proposals
//
//   link node  data.link = { createdAt }; edges:
//     [PREV, previousVersionCid]       one per parent version (two after a merge)
//     [MEMBER, memberRef]              memberRef.data: peerId{content}, actor{capabilities}
//     [PROPOSAL, constructorRef]      typed ref with branch/input/status arguments
//        branch is a ref to proposed content, with PREV pointing to the merge base
//
// The node's *content* is everything except these bookkeeping edges; proposals
// hold stripped content so they can be three-way merged against the main
// content using the branch argument's PREV as the base.

/**
 * What a peer may do on a node or provides to it: 'edit' (may change it; on a node with several peers that means
 * proposing changes and deciding others' proposals); how the peer can be reached ('direct' device to device over WebRTC,
 * 'local' another `.fos` store on this machine, through its files, 'http' / 'ws' through a server
 * that exposes it, 'relay' forwards for peers that cannot reach each other); and the services it handles
 * ('search', 'market', 'mail'; these act as resource banks for the matching requirements).
 */
export type Capability = 'read' | 'read-requests' | 'edit' | 'autopush' | 'direct' | 'local' | 'http' | 'ws' | 'relay' | 'search' | 'market' | 'mail' | 'calendar' | 'llm' | 'repo' | 'tool' | 'send-payment' | 'receive-payment' | 'allocate' | 'request-payment' | 'notify' | 'timer' | 'cron' | 'task-completion' | 'request' | 'rank' | 'poll' | 'peer' | 'persist' | 'provideNode' | 'sync' | 'response' | 'points' | 'execute' | 'verify' | 'organize'
export const CAPABILITIES: Capability[] = ['read', 'read-requests', 'edit', 'autopush', 'direct', 'local', 'http', 'ws', 'relay', 'search', 'market', 'mail', 'calendar', 'llm', 'repo', 'tool', 'send-payment', 'receive-payment', 'allocate', 'request-payment', 'notify', 'timer', 'cron', 'task-completion', 'request', 'rank', 'poll', 'peer', 'persist', 'provideNode', 'sync', 'response', 'points', 'execute', 'verify', 'organize']
/**
 * MCP peers: an MCP server attached to a node as a member (peer id `mcp:<server id>`) advertises `tool` (it runs
 * its tools for "-tool <name> …" requirements under that node) next to what else it may do there.
 */
export const MCP_PEER_PREFIX = 'mcp:'
/**
 * Integration peers: outside services a user signs in with (OAuth), platform peers the account is set up with
 * (Stripe) and channel peers (a phone). This list is identity only: what each one *provides* is not declared
 * here but derived by the account server from the handlers it actually has (backend/sync/registry.ts) and
 * written into Home as that peer's offers (`HostOffers`). A capability no handler backs is never advertised.
 */
export type IntegrationPeer = { id: string; name: string; kind: 'oauth' | 'platform' | 'channel'; consumes: Capability[] }
export const INTEGRATION_PEERS: IntegrationPeer[] = [
  { id: 'github', name: 'GitHub', kind: 'oauth', consumes: ['read', 'edit'] },
  { id: 'google', name: 'Google', kind: 'oauth', consumes: ['read', 'edit'] },
  { id: 'stripe', name: 'Stripe', kind: 'platform', consumes: ['read'] },
  { id: 'phone', name: 'Phone (SMS)', kind: 'channel', consumes: [] }
]
export const CONNECTION_CAPABILITIES: Capability[] = ['direct', 'http', 'ws', 'relay']
/**
 * What is true of the fos account server without any handler: reachable over http and ws, a relay for peers that
 * cannot connect directly, a peer connection broker, durable storage, and the node-provider protocol. Services
 * (search, market, llm, poll, cron, …) are advertised only when the server's handler registry has them; the server
 * reports the derived list in every sync/node response (`capabilities`) and devices record it on their fos member.
 */
export const SERVER_TRANSPORT_CAPABILITIES: Capability[] = ['http', 'ws', 'relay', 'peer', 'persist', 'provideNode', 'sync']
export const CLIENT_CAPABILITIES: Capability[] = ['provideNode', 'sync', 'timer', 'task-completion', 'request']
/** What a host (the account server) currently offers: its own services and, per integration peer id, that peer's handlers. */
export type HostOffers = {
  server?: Capability[]
  integrations?: Record<string, Capability[]>
  /**
   * Public keys of the host's peers (peer id → raw ed25519 key, base64), published in Home as graph data
   * (sync/users.ts `publishPeerKey`) so devices check what those peers sign without asking an endpoint.
   */
  keys?: Record<string, string>
}
/** Human names for the capability rows (the ids above are what the graph and fos.config.toml use). */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  provideNode: 'provide nodes', sync: 'traverse and sync',
  read: 'read', 'read-requests': 'read requests', edit: 'edit (propose and decide proposals)', execute: 'run evaluations', autopush: 'autopush',
  direct: 'direct connect', local: 'this machine (files)', http: 'http', ws: 'websockets', relay: 'relay', search: 'search', market: 'market', mail: 'mail',
  calendar: 'calendar', llm: 'language model', repo: 'repositories', tool: 'tools',
  'send-payment': 'send payment', 'receive-payment': 'receive payment', allocate: 'allocate', 'request-payment': 'request payment', notify: 'notify', points: 'fos points', timer: 'timer', cron: 'cron (UTC)', 'task-completion': 'parent task completion', request: 'on request', rank: 'rank', poll: 'poll', peer: 'peer connection', persist: 'persist storage', response: 'on response', verify: 'verify users', organize: 'organize captures'
}
/**
 * What flows between this side and a peer, each direction on its own: `to` is what this side lets the peer have or do
 * (its content may be read, changes are pushed automatically, proposals may be submitted, …); `from` is what this side
 * accepts from the peer (pulls its content, reads the requests addressed to it, lets its changes merge in, uses it as a
 * relay, …). Nothing moves in a direction that is not listed: a peer never adds rows to another's context, it can only
 * be queried for them.
 */
export type PeerPolicy = { to: Capability[]; from: Capability[] }
/** A device's default policy towards the account server: everything flows both ways (what the apps did before policies). */
export const DEFAULT_DEVICE_POLICY: PeerPolicy = { to: ['read', 'autopush', 'edit', 'http', 'ws'], from: ['read', 'read-requests', 'autopush', 'relay', 'search', 'market', 'mail'] }
/** A device that only takes work in (e.g. the desktop app on a work machine): nothing but the connection leaves it; it pulls its node and the requests addressed to it. */
export const RECEIVE_ONLY_POLICY: PeerPolicy = { to: ['http', 'ws'], from: ['read', 'read-requests', 'relay'] }
/** `{ to?: string[], from?: string[] }` (a fos.config.toml table or saved prefs) → a policy with only known capabilities, or null. */
export function parsePolicy(value: unknown): PeerPolicy | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { to?: unknown; from?: unknown }
  const list = (x: unknown): Capability[] => (Array.isArray(x) ? x.filter((c): c is Capability => typeof c === 'string' && (CAPABILITIES as string[]).includes(c)) : [])
  if (!Array.isArray(v.to) && !Array.isArray(v.from)) return null
  return { to: list(v.to), from: list(v.from) }
}

/** A link row's identity node: a ref node that is not a reference row (legacy inline link nodes still count). */
export function isLink(store: FosStore, value: FosNodeContent): boolean {
  if (isHandle(value)) return false
  return isRefNode(store, value) || !!value.data.link
}

/** Legacy inline link node (data.link with bookkeeping on the content node), not yet rewritten as a ref node. */
export function isLegacyInlineLink(store: FosStore, value: FosNodeContent): boolean {
  return !!value.data.link && !isRefNode(store, value)
}

export function isPrevEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.previousVersion.getId()
}

export function isMemberEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.memberField.getId()
}

export function isProposalEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.proposalField.getId()
}

/** Edges that describe who/what is attached to a link node rather than its content. */
export function isBookkeepingEdge(store: FosStore, edge: FosPathElem): boolean {
  return isPrevEdge(store, edge) || isMemberEdge(store, edge) || isProposalEdge(store, edge) || isPeerEdge(store, edge)
}

/** The content a link node stands for: the TARGETPOINTER value for ref nodes; for legacy inline links the node without its bookkeeping. */
export function stripLink(store: FosStore, value: FosNodeContent): FosNodeContent {
  if (isRefNode(store, value) && !isHandle(value)) {
    const target = refValueCid(store, value) as string
    return store.table.has(target) ? content(store, target) : { data: {}, children: [] }
  }
  const { link: _link, ...data } = value.data
  return { data, children: value.children.filter((e) => !isBookkeepingEdge(store, e)) }
}

/** Bookkeeping edges (PREV, MEMBER, PROPOSAL, PEER) of a link node, wherever they live. */
export function bookkeepingOf(store: FosStore, value: FosNodeContent): FosPathElem[] {
  return value.children.filter((e) => isBookkeepingEdge(store, e))
}

/** Put a stripped content node and return its cid. */
export function putStripped(store: FosStore, value: FosNodeContent): string {
  return put(store, stripLink(store, value))
}

/** Turn a node into a link node: a ref node whose value is the node's content (idempotent; rewrites legacy inline links). */
export function makeLink(store: FosStore, value: FosNodeContent, now: number): FosNodeContent {
  if (isRefNode(store, value) && !isHandle(value)) return value
  const stripped = stripLink(store, value)
  const valueCid = put(store, stripped)
  const data: FosNodeContent['data'] = { alias: value.data.alias ?? { id: newId() }, updated: { time: now } }
  return refNodeContent(store, data, valueCid, bookkeepingOf(store, value))
}

/** New version of a link node: `next` content plus a PREV edge to the version it replaces. */
export function withPrev(store: FosStore, next: FosNodeContent, previousCid: string): FosNodeContent {
  const prevEdge: FosPathElem = [store.primitive.previousVersion.getId(), previousCid]
  const children = next.children.filter((e) => !isPrevEdge(store, e))
  return { ...next, children: [...children, prevEdge] }
}

/** Previous versions of a link node, newest first (follows the first PREV at each step). */
export function linkHistory(store: FosStore, cid: string, limit = 50): string[] {
  const out: string[] = []
  let current: string | null = cid
  while (current && out.length < limit) {
    const prev: FosPathElem | undefined = content(store, current).children.find((e) => isPrevEdge(store, e))
    current = prev ? prev[1] : null
    if (current && store.table.has(current)) out.push(current)
    else break
  }
  return out
}

/**
 * A member of a link node. `capabilities` is what the owner exposes to that peer (the `to` direction, CAPABILITY
 * edges), `disabled` those of them that are switched off, `accepts` what the owner takes in from that peer (the `from`
 * direction, ACCEPTS edges). Absent lists are empty.
 */
export type MemberRecord = { peerId: string; name: string | null; capabilities: Capability[]; disabled?: Capability[]; accepts?: Capability[] }

/**
 * Capabilities are graph vocabulary, not data: a member reference carries one
 * [CAPABILITY, <constructor>] edge per capability, as the language design does
 * for actors. 'edit' → PROPOSE (may change the node, through proposals where it has several peers); the
 * connection kinds → DIRECTCONNECT / HTTPCONNECT / WSCONNECT / RELAY; the
 * services → SEARCH / MARKET / MAIL.
 */
export function capabilityTarget(store: FosStore, capability: Capability): string {
  const p = store.primitive
  switch (capability) {
    case 'edit': return p.proposeAction.getId()
    case 'direct': return p.directConnectCapability.getId()
    case 'http': return p.httpConnectCapability.getId()
    case 'ws': return p.wsConnectCapability.getId()
    case 'relay': return p.relayCapability.getId()
    case 'search': return p.searchCapability.getId()
    case 'market': return p.marketCapability.getId()
    case 'mail': return p.mailCapability.getId()
    case 'read': return p.readCapability.getId()
    case 'read-requests': return p.readRequestsCapability.getId()
    case 'autopush': return p.autopushCapability.getId()
    case 'calendar': return p.calendarCapability.getId()
    case 'llm': return p.llmCapability.getId()
    case 'repo': return p.repoCapability.getId()
    case 'tool': return p.toolCapability.getId()
    case 'send-payment': return p.sendPaymentCapability.getId()
    case 'receive-payment': return p.receivePaymentCapability.getId()
    case 'allocate': return p.allocateCapability.getId()
    case 'request-payment': return p.requestPaymentCapability.getId()
    case 'notify': return p.notifyCapability.getId()
    case 'rank': case 'local':
    case 'poll': case 'peer': case 'persist': case 'provideNode': case 'sync':
    case 'timer': case 'cron': case 'task-completion': case 'request': case 'response': case 'points': case 'execute': case 'verify': case 'organize':
      return put(store, { data: { name: { content: `fos:capability:${capability}` } }, children: [] })
  }
}

function capabilityOfTarget(store: FosStore, target: string): Capability | null {
  const type = refTypeCid(store, content(store, target)) ?? target
  return CAPABILITIES.find((c) => type === capabilityTarget(store, c)) ?? null
}

/** The capability a [CAPABILITY, x] edge grants (the `to` direction), or null for any other edge. */
export function capabilityOf(store: FosStore, edge: FosPathElem): Capability | null {
  if (edge[0] !== store.primitive.capabilityNode.getId()) return null
  return capabilityOfTarget(store, edge[1])
}

/** The capability an [ACCEPTS, x] edge accepts from the member (the `from` direction), or null for any other edge. */
export function acceptsOf(store: FosStore, edge: FosPathElem): Capability | null {
  if (edge[0] !== store.primitive.acceptsNode.getId()) return null
  return capabilityOfTarget(store, edge[1])
}

/** A member entry's identity on its node: `fos:peer:<peer id>` (also the path step to it, and to the rows it holds). */
export const MEMBER_ENTRY_PREFIX = 'fos:peer:'
export const memberEntryId = (peerId: string): string => `${MEMBER_ENTRY_PREFIX}${peerId}`

export function memberRefContent(store: FosStore, peerId: string, name: string | null, capabilities: Capability[], disabled: Capability[] = [], accepts: Capability[] = []): FosNodeContent {
  const unique = [...new Set(capabilities)]
  const from = [...new Set(accepts)]
  const off = [...new Set(disabled)].filter((c) => unique.includes(c) || from.includes(c))
  return {
    data: {
      alias: { id: memberEntryId(peerId) },
      peerId: { content: peerId },
      ...(name ? { name: { content: name } } : {}),
      ...(off.length ? { disabledCapabilities: { content: off } } : {})
    },
    children: [
      ...unique.map((c): FosPathElem => [store.primitive.capabilityNode.getId(), capabilityTarget(store, c)]),
      ...from.map((c): FosPathElem => [store.primitive.acceptsNode.getId(), capabilityTarget(store, c)])
    ]
  }
}

export function readMembers(store: FosStore, value: FosNodeContent): MemberRecord[] {
  if (isBranchChoice(store, value)) { const edge = withMainBranchPolicy(store, () => branchEdge(store, put(store, value))); if (edge) return readMembers(store, content(store, identityCid(store, edge))) }
  const out: MemberRecord[] = []
  for (const edge of value.children) {
    if (!isMemberEdge(store, edge)) continue
    const ref = content(store, edge[1])
    const peerId = ref.data.peerId?.content
    if (!peerId) continue
    const caps = [...new Set(ref.children.map((e) => capabilityOf(store, e)).filter((c): c is Capability => c !== null))]
    const accepts = [...new Set(ref.children.map((e) => acceptsOf(store, e)).filter((c): c is Capability => c !== null))]
    const off = (ref.data.disabledCapabilities?.content ?? []).filter((c): c is Capability => (CAPABILITIES as string[]).includes(c) && (caps.includes(c as Capability) || accepts.includes(c as Capability)))
    out.push({ peerId, name: ref.data.name?.content ?? null, capabilities: caps, ...(off.length ? { disabled: off } : {}), ...(accepts.length ? { accepts } : {}) })
  }
  return out
}

/** Handler advertisements are ordinary typed refs in either member direction. */
export function memberHandlers(store: FosStore, value: FosNodeContent, peerId: string, direction?: string): string[] {
  if (isBranchChoice(store, value)) { const edge = branchEdge(store, put(store, value)); if (edge) return memberHandlers(store, content(store, identityCid(store, edge)), peerId, direction) }
  const member = value.children.find((e) => isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId)
  return member ? content(store, member[1]).children.filter((e) => (!direction || e[0] === direction) && (e[0] === store.primitive.capabilityNode.getId() || e[0] === store.primitive.acceptsNode.getId()) && !!refTypeCid(store, content(store, e[1]))).map((e) => e[1]) : []
}

/** Add or replace the member entry for `peerId`. */
export function withMember(store: FosStore, value: FosNodeContent, peerId: string, name: string | null, capabilities: Capability[], disabled: Capability[] = [], accepts: Capability[] = []): FosNodeContent {
  const next = memberRefContent(store, peerId, name, capabilities, disabled, accepts)
  // Connection arguments and child rows belong to this constructor, not its capability list.
  const previous = value.children.find(edge => isMemberEdge(store, edge) && content(store, edge[1]).data.peerId?.content === peerId)
  if (previous) {
    const old = content(store, previous[1])
    next.children.push(...old.children.filter(edge =>
      (edge[0] !== store.primitive.capabilityNode.getId() && edge[0] !== store.primitive.acceptsNode.getId()) ||
      (!!refTypeCid(store, content(store, edge[1])) && !capabilityOfTarget(store, edge[1]))))
    // Built-in checkbox edits must not erase custom handler overrides.
    const custom = (old.data.disabledCapabilities?.content ?? []).filter(id => !CAPABILITIES.includes(id as Capability))
    if (custom.length) next.data.disabledCapabilities = { content: [...new Set([...(next.data.disabledCapabilities?.content ?? []), ...custom])] }
  }
  next.children = next.children.flatMap((edge) => {
    const capability = capabilityOf(store, edge) ?? acceptsOf(store, edge)
    const matching = capability ? memberHandlers(store, value, peerId, edge[0]).filter((cid) => capabilityOfTarget(store, cid) === capability) : []
    return matching.length ? matching.map((cid): FosPathElem => [edge[0], cid]) : [edge]
  })
  const refCid = put(store, next)
  const children = value.children.filter((e) => !(isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId))
  return { ...value, children: [...children, [store.primitive.memberField.getId(), refCid]] }
}

/** Does the owner of this node accept `capability` from `peerId` (an ACCEPTS edge on its member reference)? */
export function acceptsFrom(store: FosStore, value: FosNodeContent, peerId: string, capability: Capability): boolean {
  return readMembers(store, value).some((m) => m.peerId === peerId && (m.accepts ?? []).includes(capability) && !m.disabled?.includes(capability))
}

/** Drop the member entry for `peerId` (and so every capability it was granted). */
export function withoutMember(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  return { ...value, children: value.children.filter((e) => !(isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId)) }
}

/**
 * The member entry that applies to `peerId`: its own, else the audience it belongs to. `audience:users` covers every
 * account (`user:*`) and `audience:public` everyone, so sharing a node with an audience makes it a group nobody has
 * to join one by one; an explicit entry for the peer always wins.
 */
export function memberFor(store: FosStore, value: FosNodeContent, peerId: string): MemberRecord | undefined {
  const members = readMembers(store, value)
  return members.find((m) => m.peerId === peerId) ?? (peerId.startsWith('user:') ? members.find((m) => m.peerId === 'audience:users') : undefined) ?? members.find((m) => m.peerId === 'audience:public')
}

/** Does `peerId` hold `capability` on this node (itself or through its audience), granted and not switched off? */
export function hasCapability(store: FosStore, value: FosNodeContent, peerId: string, capability: Capability): boolean {
  const m = memberFor(store, value, peerId)
  return !!m && m.capabilities.includes(capability) && !(m.disabled ?? []).includes(capability)
}

export type ProposalRecord = {
  cid: string
  peerId: string
  name: string
  status: 'open' | 'rejected'
  /** Stripped content proposed for this node. */
  contentCid: string
  /** Stripped main content the proposal was last rebased onto. */
  baseCid: string
  timestamp: number
}

function textNode(store: FosStore, text: string): string {
  return put(store, { data: { description: { content: text } }, children: [] })
}

/** Proposal instances are typed refs with a branch argument and an input requirement.
 * The parent ref owns the constructor; the branch holds its proposed value and merge base.
 */
export function proposalContent(store: FosStore, peerId: string, name: string, contentCid: string, baseCid: string, timestamp: number, status: 'open' | 'rejected' = 'open'): FosNodeContent {
  const id = `proposal:${textNode(store, JSON.stringify([peerId, name]))}`
  const branchType = store.primitive.rootInstructionNode.getId()
  const textType = store.primitive.documentField.getId()
  const argument = (key: string, type: string, target: string | null, history: FosPathElem[] = []): FosPathElem => [type, put(store, refNodeContent(store, { alias: { id: `${id}:${key}` }, name: { content: key } }, target, history, type))]
  const constructor = put(store, {
    data: { description: { content: name || 'Proposal' }, peerId: { content: peerId }, updated: { time: timestamp } },
    children: [
      argument('branch', branchType, contentCid, [[store.primitive.previousVersion.getId(), baseCid]]),
      mergeRequestEdge(store, id),
      argument('status', textType, textNode(store, status))
    ]
  })
  return refNodeContent(store, { alias: { id }, name: { content: 'branch' }, updated: { time: timestamp } }, constructor, [], store.primitive.proposalField.getId())
}

export function readProposal(store: FosStore, cid: string): ProposalRecord | null {
  const identity = content(store, cid)
  if (refTypeCid(store, identity) === store.primitive.proposalField.getId()) {
    const value = valueContent(store, cid)
    const args = value.children.map(edge => content(store, identityCid(store, edge)))
    const branch = args.find(arg => arg.data.name?.content === 'branch')
    const status = args.find(arg => arg.data.name?.content === 'status')
    const contentCid = branch && refValueCid(store, branch)
    const baseCid = branch?.children.find(edge => isPrevEdge(store, edge))?.[1]
    const peerId = value.data.peerId?.content
    const statusCid = status && refValueCid(store, status)
    if (!contentCid || !baseCid || !peerId) return null
    return { cid, peerId, name: value.data.description?.content ?? '', contentCid, baseCid, timestamp: value.data.updated?.time ?? 0, status: statusCid && ['rejected', '"rejected"'].includes(content(store, statusCid).data.description?.content ?? '') ? 'rejected' : 'open' }
  }
  // Read older saved proposals; subsequent updates use the ordinary ref constructor.
  const value = identity
  let peerId = ''
  let name = ''
  let contentCid = ''
  let baseCid = ''
  let timestamp = 0
  for (const [instr, target] of value.children) {
    if (instr === store.primitive.proposalNameField.getId()) name = content(store, target).data.description?.content ?? ''
    else if (instr === store.primitive.proposedContentField.getId()) contentCid = target
    else if (instr === store.primitive.senderField.getId()) peerId = content(store, target).data.description?.content ?? ''
    else if (instr === store.primitive.timestampField.getId()) timestamp = Number(content(store, target).data.description?.content ?? 0) || 0
    else if (instr === store.primitive.previousVersion.getId()) baseCid = target
  }
  if (!peerId || !contentCid || !baseCid) return null
  return { cid, peerId, name, status: value.data.proposal?.status === 'rejected' ? 'rejected' : 'open', contentCid, baseCid, timestamp }
}

/** Mark a proposal rejected (kept on the node so the peer learns about it and it does not reopen by itself). */
export function markProposalRejected(store: FosStore, value: FosNodeContent, proposalCid: string): FosNodeContent {
  const record = readProposal(store, proposalCid)
  if (!record || record.status === 'rejected') return value
  const rejectedCid = put(store, proposalContent(store, record.peerId, record.name, record.contentCid, record.baseCid, record.timestamp, 'rejected'))
  return withProposal(store, value, record.peerId, rejectedCid, record.name)
}

/** A node's submissions, open ones first and rejected ones at the bottom (each group in the order they came). */
export function readProposals(store: FosStore, value: FosNodeContent): ProposalRecord[] {
  const out: ProposalRecord[] = []
  for (const edge of value.children) {
    if (!isProposalEdge(store, edge)) continue
    const record = readProposal(store, edge[1])
    if (record) out.push(record)
  }
  return [...out.filter(p => p.status !== 'rejected'), ...out.filter(p => p.status === 'rejected')]
}

/** Replace (or add) the proposal from `peerId` named `name`, or remove it when `proposalCid` is null. */
export function withProposal(store: FosStore, value: FosNodeContent, peerId: string, proposalCid: string | null, name?: string): FosNodeContent {
  const matches = (cid: string) => {
    const p = readProposal(store, cid)
    return !!p && p.peerId === peerId && (name === undefined || p.name === name)
  }
  const children = value.children.filter((e) => !(isProposalEdge(store, e) && matches(e[1])))
  if (proposalCid) children.push([store.primitive.proposalField.getId(), proposalCid])
  return { ...value, children }
}

export function removeProposalByCid(store: FosStore, value: FosNodeContent, proposalCid: string): FosNodeContent {
  return { ...value, children: value.children.filter((e) => !(isProposalEdge(store, e) && e[1] === proposalCid)) }
}

/** New version of a link node: a ref node pointing at `strippedContent`, keeping members/proposals/peers, PREV → the version it replaces. */
export function relinkContent(store: FosStore, previous: FosNodeContent, previousCid: string, strippedContent: FosNodeContent, now: number): FosNodeContent {
  const bookkeeping = previous.children.filter((e) => isBookkeepingEdge(store, e) && !isPrevEdge(store, e))
  const data: FosNodeContent['data'] = { alias: previous.data.alias ?? strippedContent.data.alias ?? { id: newId() }, updated: { time: now } }
  if (previous.data.ref) data.ref = previous.data.ref
  if (previous.data.name) data.name = previous.data.name
  const branches = refBranches(store, previous)
  const active = branches && branchEdge(store, branches.cid)
  const value = put(store, strippedContent)
  const target = branches && active ? updateBranch(store, branches.cid, [value, active[1]]) : value
  const next = refNodeContent(store, data, target, bookkeeping, refTypeCid(store, previous))
  return withPrev(store, next, previousCid)
}

/**
 * Rewrite legacy inline link nodes (data.link with bookkeeping on the content node)
 * below `nodeCid` into ref nodes. Returns the new cid (same cid when nothing changed).
 * Deterministic, so every device and the server converge on the same nodes.
 */
export function normalizeRefs(store: FosStore, nodeCid: string, now: number = 0): string {
  const identity = content(store, nodeCid)
  if (isHandle(identity)) return nodeCid
  const ref = isRefNode(store, identity)
  const value = ref ? valueContent(store, nodeCid) : identity
  let changed = false
  const children = value.children.map((edge) => {
    if (!isRowEdge(store, edge)) return edge
    const childCid = identityCid(store, edge)
    const next = normalizeRefs(store, childCid, now)
    if (next === childCid) return edge
    changed = true
    return withIdentity(store, edge, next)
  })
  let nextValue = changed ? { ...value, children } : value
  if (isLegacyInlineLink(store, identity)) {
    // the node itself: content → value node, bookkeeping → ref node (history edges kept)
    const stripped = stripLink(store, nextValue)
    return put(store, refNodeContent(store, { alias: identity.data.alias ?? { id: newId() }, updated: { time: identity.data.updated?.time ?? now } }, put(store, stripped), bookkeepingOf(store, identity)))
  }
  if (!changed) return nodeCid
  if (ref) return put(store, relinkContent(store, identity, nodeCid, nextValue, identity.data.updated?.time ?? now))
  return put(store, nextValue)
}

// ---------------------------------------------------------------------------
// Tree operations (tasks can contain tasks)

/** Child edge (task, partition or choice) carrying `aliasId`, with its index. */
export function findAliasEdge(store: FosStore, value: FosNodeContent, aliasId: string): { edge: FosPathElem; index: number } | null {
  const key = `a:${aliasId}`
  const index = value.children.findIndex((e) => edgeKey(store, e) === key || aliasIdOf(content(store, identityCid(store, e))) === aliasId)
  return index >= 0 ? { edge: value.children[index] as FosPathElem, index } : null
}

/** Cid of the node that `aliasId` names below `nodeCid` (task or partition), or null. */
export function findChild(store: FosStore, nodeCid: string, aliasId: string): string | null {
  const found = findAliasEdge(store, valueContent(store, nodeCid), aliasId) ?? findAliasEdge(store, content(store, nodeCid), aliasId)
  if (!found) return null
  const { edge } = found
  if (isChoiceEdge(store, edge) && !isBranchChoice(store, content(store, edge[1])) && !isPeerReference(content(store, edge[1]))) return null
  return identityCid(store, edge)
}

/** Where the row with alias `aliasId` lives below `rootCid` (depth-first), with its view; null when absent. */
export function findRowByAlias(store: FosStore, rootCid: string, aliasId: string, prefix: Scope = []): { path: Scope; row: TaskView } | null {
  for (const edge of valueContent(store, rootCid).children) {
    if (!isRowEdge(store, edge)) continue
    const cid = identityCid(store, edge)
    const id = aliasIdOf(content(store, cid))
    if (!id) continue
    if (id === aliasId) return { path: prefix, row: rowView(store, cid, edge) }
    const found = findRowByAlias(store, cid, aliasId, [...prefix, id])
    if (found) return found
  }
  // rows a peer's entry holds (Settings: its connection arguments, the nodes it shares) are rows of the tree too
  for (const edge of content(store, rootCid).children) {
    if (!isMemberEdge(store, edge)) continue
    const id = aliasIdOf(content(store, edge[1]))
    const found = id ? findRowByAlias(store, edge[1], aliasId, [...prefix, id]) : null
    if (found) return found
  }
  return null
}

/** Copy owned rows and argument refs through one path. Internal aliases are remapped;
 * external targets stay pinned. History, proposals and membership are not inherited. */
export function copyRowContent(store: FosStore, nodeCid: string, now: number, freshId: () => string, options: { instantiate?: boolean; rootId?: string } = {}): string {
  const { instantiate = false } = options
  const ids = new Map<string, string>()
  const owned = new Set<string>()
  const childEdges = (value: FosNodeContent) => value.children.filter((edge) => {
    const type = rowTypeIdOf(store, edge)
    const name = content(store, identityCid(store, edge)).data.name?.content
    if (name === 'fos:evaluation' || name === 'fos:trigger-state' || (instantiate && (name === 'fos:trigger' || name === 'fos:consumed' || name === 'fos:execution-time' || name === 'fos:sharing' ||name?.startsWith('fos:guest:') || name?.startsWith('fos:execution:')))) return false
    // an instance is no type: what its template accepts (its pattern rows) stays with the template
    if (isRowEdge(store, edge)) return !(instantiate && (type === PATTERN_TYPE || (isAllocationType(type) && !!flowOf(type!, valueContent(store, identityCid(store, edge))).supply)))
    if (isBookkeepingEdge(store, edge) || edge[0] === store.primitive.targetPointerConstructor.getId() || edge[0] === store.primitive.instructionPointerConstructor.getId()) return false
    return isRefNode(store, content(store, identityCid(store, edge)))
  })
  const collect = (cid: string) => {
    if (owned.has(cid)) return
    owned.add(cid)
    const identity = content(store, cid)
    const id = aliasIdOf(identity)
    if (id && !ids.has(id)) ids.set(id, cid === nodeCid && options.rootId ? options.rootId : freshId())
    if (isBranchChoice(store, identity)) {
      const choice = readChoice(store, cid)
      for (const edge of [choice.base, ...choice.options.flatMap(o => [o.edge, o.base])]) if (edge) collect(identityCid(store, edge))
      return
    }
    // Typed refs are slots, not ownership of their bound value.
    if (refTypeCid(store, identity)) return
    for (const edge of childEdges(stripLink(store, identity))) collect(identityCid(store, edge))
  }
  collect(nodeCid)
  const copied = new Map<string, string>()
  // A row made from a template copied along is pinned to the copy; templates outside stay pinned as they are.
  const ownedValues = new Map([...owned].map((cid) => [valueCidOf(store, cid), cid]))
  const copyEdge = (edge: FosPathElem): FosPathElem => {
    const template = isRowEdge(store, edge) ? ownedValues.get(edge[0]) : undefined
    return [template ? valueCidOf(store, copy(template)) : edge[0], copy(identityCid(store, edge))]
  }
  const copy = (cid: string): string => {
    const cached = copied.get(cid)
    if (cached) return cached
    const identity = content(store, cid)
    if (isBranchChoice(store, identity)) {
      const choice = readChoice(store, cid)
      const remap = (edge: FosPathElem | null | undefined) => edge ? copyEdge(edge) : null
      const result = putBranches(store, ids.get(choice.id)!, remap(choice.base), choice.options.map(o => ({ ...o, edge: remap(o.edge), ...(o.base ? { base: remap(o.base) } : {}) })), choice.defaultName)
      copied.set(cid, result)
      return result
    }
    const type = refTypeCid(store, identity)
    const value = type ? identity : stripLink(store, identity)
    const data = { ...value.data, alias: { id: ids.get(aliasIdOf(identity) ?? '') ?? freshId() }, updated: { time: now } }
    if (instantiate && data.todo) data.todo = { ...data.todo, completed: false, time: now }
    if (instantiate && data.query) data.query = { market: data.query.market }
    if (data.ref && !data.ref.owner) data.ref = { ...data.ref, id: ids.get(data.ref.id) ?? data.ref.id }
    if (data.supply?.ref) data.supply = { ...data.supply, ref: ids.get(data.supply.ref) ?? data.supply.ref }
    if (data.allocation) data.allocation = { ...data.allocation, resource: ids.get(data.allocation.resource) ?? data.allocation.resource, ...(data.allocation.ref ? { ref: ids.get(data.allocation.ref) ?? data.allocation.ref } : {}) }
    // Typed arguments keep defaults, including ref-to-ref defaults. They get a fresh identity.
    const target = refValueCid(store, identity)
    const children = type ? [] : childEdges(value).map(copyEdge)
    if (!type && isHandle(identity) && target) children.push([store.primitive.targetPointerConstructor.getId(), owned.has(target) ? copy(target) : target])
    let bound = target && owned.has(target) ? copy(target) : target
    const alternatives = type && refBranches(store, identity)
    if (alternatives) {
      const record = readChoice(store, alternatives.cid)
      const incoming = put(store, refNodeContent(store, { alias: data.alias, ...(data.name ? { name: data.name } : {}) }, null, [], type))
      const edge = (original: FosPathElem | null | undefined): FosPathElem | null => original ? [owned.has(original[0]) ? copy(original[0]) : original[0], incoming] : null
      bound = putBranches(store, data.alias.id, edge(record.base), record.options.map(option => ({ ...option, edge: edge(option.edge) })), record.defaultName)
    }
    const valueCopy = { data, children }
    const result = put(store, type ? refNodeContent(store, data, bound, [], type)
      : isRefNode(store, identity) && !isHandle(identity) && (value.data.scalar || value.data.presentation)
        ? refNodeContent(store, { alias: data.alias, ...(data.name ? { name: data.name } : {}) }, put(store, valueCopy))
        : valueCopy)
    copied.set(cid, result)
    return result
  }
  return copy(nodeCid)
}

export type MovePosition = { relativeTo: string; position: 'above' | 'below' } | { into: string; index?: number }

/**
 * Move the child `aliasId` of the node at `fromPath` to `toPath` at `position`
 * (relative to a sibling, or into a node). Paths are relative to `rootCid`.
 * Returns the new root cid, or null if the move is invalid (e.g. into itself).
 */
export function moveChild(store: FosStore, rootCid: string, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition): string | null {
  if (toPath.includes(aliasId)) return null // cannot move a node into its own subtree
  const fromCid = resolveScope(store, rootCid, fromPath)
  if (!fromCid) return null
  const found = findAliasEdge(store, valueContent(store, fromCid), aliasId)
  if (!found) return null
  const moving = found.edge

  // 1. remove from the source
  let root = updateAtScope(store, rootCid, fromPath, (value) => ({ ...value, children: value.children.filter((e) => e !== moving) }))

  // 2. insert at the destination (resolved after the removal, paths are by alias id so they still hold)
  const insert = (value: FosNodeContent): FosNodeContent => {
    const children = [...value.children]
    if ('into' in position) {
      const parent = findAliasEdge(store, value, position.into)
      if (!parent) throw new Error('destination not found')
      const target = identityCid(store, parent.edge)
      const targetContent = valueContent(store, target)
      const kids = [...targetContent.children]
      const at = position.index === undefined || position.index < 0 ? kids.length : Math.min(position.index, kids.length)
      kids.splice(at, 0, moving)
      children[parent.index] = withChildValue(store, parent.edge, positionFormRows(store, { ...targetContent, children: kids }, targetContent.data.updated?.time ?? 0), targetContent.data.updated?.time ?? 0)
      return { ...value, children }
    }
    const sibling = findAliasEdge(store, value, position.relativeTo)
    if (!sibling) throw new Error('destination not found')
    children.splice(position.position === 'above' ? sibling.index : sibling.index + 1, 0, moving)
    return positionFormRows(store, { ...value, children }, value.data.updated?.time ?? 0)
  }
  root = updateAtScope(store, root, toPath, insert)
  return root
}

/** Task titles a proposal adds, changes or removes compared with the main content it was based on (so work landing on main later never shows up as 'removed'). */
export function proposalView(store: FosStore, nodeValue: FosNodeContent, proposal: ProposalRecord): ProposalView {
  const current = store.getNodeByAddress(proposal.baseCid) ? content(store, proposal.baseCid) : stripLink(store, nodeValue)
  const proposed = content(store, proposal.contentCid)
  const index = (value: FosNodeContent) => {
    const map = new Map<string, { title: string; cid: string }>()
    for (const edge of value.children) {
      if (isChoiceEdge(store, edge)) {
        const choice = readChoice(store, edge[1])
        for (const option of [choice.base, ...choice.options.map((o) => o.edge)]) {
          if (!option || !isRowEdge(store, option)) continue
          const id = identityCid(store, option)
          map.set(edgeKey(store, option), { title: formTitle(store, valueContent(store, id)), cid: id })
        }
        continue
      }
      if (!isRowEdge(store, edge)) continue
      const id = identityCid(store, edge)
      map.set(edgeKey(store, edge), { title: formTitle(store, valueContent(store, id)), cid: id })
    }
    return map
  }
  const a = index(current)
  const b = index(proposed)
  const summary = { added: [] as string[], changed: [] as string[], removed: [] as string[] }
  for (const [key, entry] of b) {
    const before = a.get(key)
    if (!before) summary.added.push(entry.title)
    else if (before.cid !== entry.cid) summary.changed.push(entry.title)
  }
  for (const [key, entry] of a) if (!b.has(key)) summary.removed.push(entry.title)
  return { id: proposal.cid, peerId: proposal.peerId, name: proposal.name, status: proposal.status, timestamp: proposal.timestamp, summary }
}
