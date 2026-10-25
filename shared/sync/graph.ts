import { primitive, primitiveName } from './primitives'
import { fieldEdge, fieldValue, fieldViews, isFieldRow, isTextField, leafText, rowBody, titleField, typeRows, type FieldView, fieldRefId, withFieldValue } from './fields'
import { capabilityDeclarations } from './capability-catalog'
import { resolveBinding } from './bindings'
import { bindingProperties, type ScopedBinding } from './scope-bindings'
import { nodeOccurrence } from './ref-paths'
import { readGraphValue } from './node-values'
/**
 * Graph helpers for sync, written against the hash-consed FosStore.
 *
 * Conventions used by the sync layer (all expressed with existing primitives):
 *
 *   row         edge [template, rowNode]          the template (instruction) says what the row is and how it behaves; the row
 *                                                  node (target) holds its own state. A template is a graph definition:
 *                                                  a row type (Task, Row, Note, Comment, Reference, Query, Resource, Allocation,
 *                                                  Template) from the Row types this root installed from the standard library,
 *                                                  or a template row ("Invoice"); pinned by the cid of the version used.
 *   task        edge [Task, taskNode]             taskNode.data: alias{id}, description, todo{completed,time}, updated
 *   reference error  edge [missing, rowNode]      the row is pinned to a template this peer has not received yet
 *
 * Mutable references. The root alias, link nodes (what devices attach to and
 * propose against) and reference rows are one and the same node shape, the
 * language design's ALIAS node:
 *
 *   ref node    data: alias{id} (+ ref{id} for a reference row)
 *               [TARGETPOINTER, valueCid]       the current value (a content node: description, todo, rows…)
 *               [ALIAS, empty]                 ref constructor; the enclosing row supplies the pattern
 *               [PREV, previousRefCid]*         history: one per parent version, two after a merge
 *               [PROPOSAL, p]* [PEER, ref]*     who is attached to the reference (memberships are rows of the value:
 *                                               [peer's node, what the node keeps for that peer])
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


import { capabilityName, sameCapabilityType, isExecuteLeft, isHandlerStateLeft, isTriggerLeft } from './capabilities'
import * as COMPILED_LIBRARY from './library.generated.json'
import { libraryNames, type LibraryNames } from '../library-names'
import { DEVICE_ROOT_TYPE, DOCUMENT_ROOT_TYPE, HOME_TYPE, LIBRARY_TYPE, PLAIN_TYPE, QUERY_TYPE, REF_TYPE, RESOURCE_TYPE, TASK_TYPE, TEMPLATE_TYPE } from './library-types'
import { isNegative } from './parameters'
import { isClassifyingRow, isKindRow, isTagRow, tag, tagsOf, valueOfPattern } from './structural'
import { userOf, userPeerId, type UserRecord } from './users'
import { putNode, type FosStore } from '../dag-implementation/store'
import { hashContent, isCurrentCid, verifyCid } from '../dag-implementation/cid'
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
  return putNode(store, value)
}

export function aliasIdOf(value: FosNodeContent): string | null {
  return value.data.alias?.id ?? null
}

// ---------------------------------------------------------------------------
// Mutable references (ALIAS nodes)

/** A ref is declared by its constructor row, with an optional current target. */
export function isRefNode(store: FosStore, value: FosNodeContent): boolean {
  return value.children.some(([i]) => i === primitive(store, 'target') || i === primitive(store, 'alias'))
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
  const edge = value.children.find(([i]) => i === primitive(store, 'target'))
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
export function putRefValueBranches(store: FosStore, ref: FosNodeContent, values: Array<string | null>, baseName = 'main', selectedValue?: string | null, inputType?: string): string {
  const id = ref.data.alias!.id
  const incoming = put(store, refNodeContent(store, { alias: { id }, ...(ref.data.name ? { name: ref.data.name } : {}) }, null, []))
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
  return isRefNode(store, right) && !refValueCid(store, right) && right.data.alias?.id === readChoice(store, cid).id ? edge[0] : identityCid(store, edge)
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
export function refNodeContent(store: FosStore, data: FosNodeContent['data'], valueCid: string | null, bookkeeping: FosPathElem[] = []): FosNodeContent {
  const children: FosPathElem[] = valueCid ? [[primitive(store, 'target'), valueCid]] : []
  children.push([primitive(store, 'alias'), put(store, { data: {}, children: [] })])
  return { data, children: [...children, ...bookkeeping] }
}

/** Locally owned argument refs; the field is their type, their alias is the instance identity. */
export function refArguments(store: FosStore, value: FosNodeContent, typeCid: string): Array<{ id: string; cid: string; targetCid: string | null }> {
  return value.children.flatMap((edge) => {
    if (!sameCapabilityType(store, edge[0], typeCid)) return []
    const cid = identityCid(store, edge)
    const ref = content(store, cid)
    const id = aliasIdOf(ref)
    return id ? [{ id, cid, targetCid: refValueCid(store, ref) }] : []
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
  if (instr === primitive(store, 'proposal')) {
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

/**
 * The standard library ref's identity in a device root: a content address (every device root's library ref has the
 * same one). Code finds a library ref by what it holds (`isLibraryRef`); this is only what a new one is called.
 */
export const LIBRARY_ID = hashContent({ data: { description: { content: 'Standard library' } }, children: [] })

/**
 * A library takes two rows. Its **definition** is a ref whose value is the library (the namespace that defines the
 * Library type): a mutable ref like any other, edited by submissions. Its **instance** is the row `[library, lib]`:
 * the library version it pins on its left, and on its right the ref `lib`, the binding code reaches the library by
 * (`lib.task`, ...), whose value passes the library what it needs from the device (its primitives). Upgrading an
 * instance moves its left to a newer value of the definition.
 */
export const LIBRARY_BINDING = 'lib'
/** What a new instance's `lib` ref is called: a content address (code finds it by its name). */
export const LIBRARY_INSTANCE_ID = hashContent({ data: { description: { content: 'Standard library instance' } }, children: [] })

/** Whether `node` is a library definition: a ref whose value (here, not a peer's unloaded node) is a library. */
export function isLibraryDefinition(store: FosStore, node: FosNodeContent): boolean {
  if (isHandle(node) || isPeerReference(node)) return false
  const target = refValueCid(store, node)
  if (!target || !store.table.has(target)) return false
  return isLibraryValue(store, valueCidOf(store, target))
}
/** Whether `cid` is a library: a value that defines the Library type. */
export function isLibraryValue(store: FosStore, cid: string): boolean {
  return store.table.has(cid) && namesInLibrary(store, cid).byName.has(LIBRARY_TYPE)
}
/** Whether `node` is a library instance's `lib` ref. */
export function isLibraryInstance(store: FosStore, node: FosNodeContent): boolean {
  return node.data.name?.content === LIBRARY_BINDING && isRefNode(store, node)
}
/**
 * A library's definition or instance: containers, not data. The names in a library resolve as its fields
 * (`namesInLibrary`), never as lexical bindings; an instance's arguments are the library's.
 */
export function isLibraryRef(store: FosStore, node: FosNodeContent): boolean {
  return isLibraryDefinition(store, node) || isLibraryInstance(store, node)
}
/** The library definition among the rows of the node `cid`, if it has one: its id there and its cid. */
export function libraryRowOf(store: FosStore, cid: string): { id: string; cid: string } | null {
  for (const edge of valueContent(store, cid).children) {
    if (!isRowEdge(store, edge)) continue
    const child = identityCid(store, edge)
    if (!store.table.has(child)) continue
    const node = content(store, child), id = aliasIdOf(node)
    if (id && isLibraryDefinition(store, node)) return { id, cid: child }
  }
  return null
}
/** The library instances among the rows of the node `cid`: each one's id there, its `lib` ref and the library it pins. */
function libraryInstancesOf(store: FosStore, cid: string): Array<{ id: string; cid: string; library: string }> {
  const instances: Array<{ id: string; cid: string; library: string }> = []
  for (const edge of valueContent(store, cid).children) {
    const plain = edge
    if (!store.table.has(plain[1])) continue
    const node = content(store, plain[1]), id = aliasIdOf(node)
    if (isLibraryInstance(store, node)) instances.push({ id: id ?? plain[1], cid: plain[1], library: plain[0] })
  }
  return instances
}
/** The library instance among the rows of the node `cid`, if it has one: its id there, its `lib` ref and the library it pins. */
export function libraryInstanceOf(store: FosStore, cid: string): { id: string; cid: string; library: string } | null {
  const instances = libraryInstancesOf(store, cid)
  if (instances.length > 1) throw new Error('Ambiguous library binding in this scope.')
  const instance = instances[0] ?? null
  if (instance && !isLibraryValue(store, instance.library)) throw new Error('The library binding is unavailable.')
  return instance
}

/** The build's library, stored in `store`: the content of the submission a device root's library ref accepts. */
export function shippedLibrary(store: FosStore): string {
  if (!store.table.has(COMPILED_LIBRARY.rootNodeId)) importNodes(store, COMPILED_LIBRARY.nodes as unknown as FosNodesData)
  return COMPILED_LIBRARY.rootNodeId
}

/** The node that is the build's library field `name` (`task`, `capabilities.mail`, ...), stored in `store`; null when it has none. */
/**
 * A fresh store: its root is a new alias of the shipped document root type whose target is the empty node, so a first
 * commit gives it content.
 */
export function createStore(): FosStore {
  const store: FosStore = { table: new Map(), rootNodeId: '', implementations: new Map() }
  const empty = put(store, { data: {}, children: [] })
  store.rootNodeId = put(store, { data: { alias: { id: newId() } }, children: [
    [primitive(store, 'target'), empty],
    [primitive(store, 'instruction'), shippedRef(store, DOCUMENT_ROOT_TYPE)!],
    [primitive(store, 'previous'), empty]
  ] })
  return store
}

export function shippedRef(store: FosStore, name: string): string | null {
  const cid = (COMPILED_LIBRARY.refs as Record<string, string>)[name]
  if (!cid) return null
  shippedLibrary(store)
  return cid
}

/** The names a library value gives its nodes (library-names.ts), memoized per value: values never change. */
const libraryNameCache = new WeakMap<FosStore, Map<string, { names: LibraryNames; missing: Set<string> }>>()
export function namesInLibrary(store: FosStore, value: string): LibraryNames {
  let byValue = libraryNameCache.get(store)
  if (!byValue) { byValue = new Map(); libraryNameCache.set(store, byValue) }
  let cached = byValue.get(value)
  if (!cached) {
    const missing = new Set<string>()
    const names = libraryNames(cid => { const node = store.table.get(cid); if (!node) missing.add(cid); return node }, value, primitive(store, 'target'), primitive(store, 'alias'))
    cached = { names, missing }; byValue.set(value, cached)
  }
  return cached.names
}

/**
 * Type the store root (its root alias's instruction): a device root, or a document root (the type a fresh store
 * starts with). The seed's version, which the library starts with.
 */
export function setRootType(store: FosStore, typeId: typeof DEVICE_ROOT_TYPE | typeof DOCUMENT_ROOT_TYPE): void {
  const type = shippedRef(store, typeId)!
  const root = content(store, store.rootNodeId)
  const ip = primitive(store, 'instruction')
  if (root.children.some(([i, t]) => i === ip && t === type)) return
  if (!rootIsAlias(store)) commitRoot(store, rootTargetCid(store), 0, null, true)
  const alias = content(store, store.rootNodeId)
  store.rootNodeId = put(store, { ...alias, children: alias.children.map(([i, t]): FosPathElem => i === ip ? [i, type] : [i, t]) })
}

// ---------------------------------------------------------------------------
// Row types. A row is the edge [type, row]: its type is the left node and nothing else. Library types are told apart
// by graph identity (`lib.<type>`, shared by every pinned version); a template row's content is the type of the tasks
// made from it.

/** The sync primitives: edges they label are bookkeeping (pointers, members, proposals, …), never rows. */
function isPrimitive(store: FosStore, cid: string): boolean {
  return primitiveName(store, cid) !== null
}

/**
 * What the library bound at the store's root calls its nodes, and its `done` field: how rows are labelled and which
 * ones complete. A type is its structure; the name is the library's entry for it, never part of the node.
 */
type Vocabulary = { library: string; names: Map<string, string>; done: string | null }
const vocabularies = new WeakMap<FosStore, Vocabulary>()
export function rowVocabulary(store: FosStore): Vocabulary | null {
  let binding: ReturnType<typeof libraryBindingAt> = null
  try { binding = store.table.has(store.rootNodeId) ? libraryBindingAt(store, []) : null } catch { binding = null }
  if (!binding) return null
  const cached = vocabularies.get(store)
  if (cached?.library === binding.library) return cached
  const byName = namesInLibrary(store, binding.library).byName, names = new Map<string, string>()
  for (const [name, cid] of byName) if (!names.has(cid)) names.set(cid, name)
  const vocabulary = { library: binding.library, names, done: byName.get('done') ?? null }
  vocabularies.set(store, vocabulary)
  return vocabulary
}
/** The library's name for a type node (its entry, `task`, `capabilities.mail`, ...), or null. */
export function typeIdOf(store: FosStore, typeCid: string | null | undefined): string | null {
  if (!typeCid || !store.table.has(typeCid)) return null
  return rowVocabulary(store)?.names.get(typeCid) ?? null
}
/** Whether rows of `type` complete: the type has the library's `done` field. */
export function completes(store: FosStore, type: string): boolean {
  const done = rowVocabulary(store)?.done
  return !!done && typeRows(store, type).some(([field]) => field === done)
}
/** A row's title: its own text (a plain row), else what its title field holds; legacy rows fall back to their description. */
export function rowTitle(store: FosStore, nodeCid: string, type: string | null): string {
  const value = valueContent(store, nodeCid), id = aliasIdOf(content(store, nodeCid)) ?? aliasIdOf(value) ?? nodeCid
  if (type && isTextField(store, type)) return leafText(store, nodeCid) ?? ''
  const field = type ? titleField(store, type) : value.children.find(edge => isFieldRow(store, id, edge) && isTextField(store, edge[0]))?.[0]
  const held = field ? fieldValue(store, id, value, field) : null
  return (held ? leafText(store, held) : null) ?? (field ? null : leafText(store, nodeCid)) ?? value.data.description?.content ?? ''
}
/** Whether a row is done: its `done` field holds unit. */
export function rowDone(store: FosStore, nodeCid: string): boolean {
  const done = rowVocabulary(store)?.done
  if (!done) return false
  const value = valueContent(store, nodeCid), id = aliasIdOf(content(store, nodeCid)) ?? aliasIdOf(value) ?? nodeCid
  const held = fieldValue(store, id, value, done)
  return !!held && !Object.keys(content(store, held).data).length && !content(store, held).children.length
}
/** Whether the row at `nodeCid` has a done field (it completes). */
export function hasDone(store: FosStore, nodeCid: string): boolean {
  const done = rowVocabulary(store)?.done, value = valueContent(store, nodeCid)
  return !!done && !!fieldEdge(store, aliasIdOf(content(store, nodeCid)) ?? aliasIdOf(value) ?? nodeCid, value, done)
}
/** Row `id`'s value with its done field holding unit (done) or void; null when it has no done field or already holds that. */
export function withDone(store: FosStore, id: string, value: FosNodeContent, done: boolean, now: number): FosNodeContent | null {
  const field = rowVocabulary(store)?.done
  if (!field || !fieldEdge(store, id, value, field)) return null
  const unit = put(store, { data: {}, children: [] })
  if ((fieldValue(store, id, value, field) === unit) === done) return null
  return withFieldValue(store, id, value, field, done ? unit : primitive(store, 'void'), now)
}

/** A structural predicate on a constructor's name row; it carries its own graph meaning. */
export function constructorPattern(store: FosStore, name: string): string {
  const text = put(store, { data: { scalar: { type: 'text', value: name } }, children: [] })
  return put(store, { data: {}, children: [[primitive(store, 'name'), text]] })
}
/** Whether `typeCid` (a row edge's left node) is a version of the library type `typeId`. */
export function isLibraryType(store: FosStore, typeCid: string, typeId: string): boolean {
  return typeIdOf(store, typeCid) === typeId
}

/**
 * The type a row edge is made from: its left node, through a branched row's selected alternative and a type error; a
 * row held by a peer and not loaded here is a reference. Null when the edge is not a row (a primitive's edge,
 * an unresolved choice, or a node this store lacks). A typed ref on the right is the row's argument.
 */
export function rowTypeOf(store: FosStore, edge: FosPathElem): string | null {
  edge = edge
  // a membership is the node's row for a peer, not one of its content rows
  if (isMemberEdge(store, edge)) return null
  if (isChoiceEdge(store, edge)) {
    if (!store.table.has(edge[1])) return null
    const node = content(store, edge[1])
    if (isPeerReference(node)) return libraryTypeAt(store, REF_TYPE)
    const active = isBranchChoice(store, node) ? branchEdge(store, edge[1]) : null
    return active ? rowTypeOf(store, active) : null
  }
  const [type, target] = edge
  if (!store.table.has(type) || !store.table.has(target)) return null
  // a row has an identity of its own; an edge without one (a field's text, a tag) is part of the node's value
  if (!content(store, target).data.alias && !isRefNode(store, content(store, target)) && !isPeerReference(content(store, target))) return null
  if (isPrimitive(store, type)) {
    // Built-in data constructors can be the left side too. Pointer/history/policy
    // edges describe the ref itself rather than applying a constructor to a right node.
    if (isBookkeepingEdge(store, edge) || isGrantEdge(store, edge) || [
      primitive(store, 'target'), primitive(store, 'instruction'),
      primitive(store, 'mergeSource'), primitive(store, 'base'),
      primitive(store, 'selected'), primitive(store, 'notSelected'),
      primitive(store, 'link')
    ].includes(type) || !content(store, target).data.alias) return null
  }
  return type
}

/** The instruction's own constructor name, if present; its identity remains its CID. */
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

/** The child rows of `cid` made from the library row type `typeId` (a library field, `task`, ...): their alias ids and identity cids. */
export function rowsOfType(store: FosStore, cid: string, typeId: string): Array<{ id: string; cid: string }> {
  return valueContent(store, cid).children.filter(e => isRowOfType(store, e, typeId)).map(e => ({ id: content(store, identityCid(store, e)).data.alias?.id ?? '', cid: identityCid(store, e) })).filter(r => r.id)
}

/**
 * A template used as a type: a node that declares refs locally that are assigned there, once (rows with their own
 * identity and a value, not a parameter left open, not alternatives, not a reference to elsewhere). A type's value has
 * none: its pattern rows have no identity and its fields are parameters, declared but unassigned. Instances of a
 * template are tasks.
 */
export function isTemplateType(store: FosStore, typeCid: string): boolean {
  if (!store.table.has(typeCid)) return false
  // a capability pattern (refined with inputs) declares refs too, but it is an instruction, never a template to instantiate
  if (content(store, typeCid).data.capabilityDefinition) return false
  return valueContent(store, typeCid).children.some(edge => {
    if (!isRowEdge(store, edge) || isChoiceEdge(store, edge)) return false
    const identity = content(store, identityCid(store, edge))
    return !!identity.data.alias && !identity.data.ref && !valueContent(store, identityCid(store, edge)).data.parameter
  })
}

/** A task: made from the Task type or from a template row. It has a done state, blockers and a checkbox. */
export function isTaskRow(store: FosStore, edge: FosPathElem): boolean {
  const type = rowTypeOf(store, edge)
  return !!type && (completes(store, type) || isTemplateType(store, type))
}

/** Resolve a new row's type from the library bound at its parent `at`; missing fields must fail. */
export function rowTypeAt(store: FosStore, typeId: string, at: Scope = [], root: string = rootTargetCid(store)): string {
  const found = nearestLibraryType(store, typeId, at, root)
  if (found) return found
  throw new Error(`No standard library above this row has the row type ${typeId}.`)
}

/** The type a new row of `type` is made from: `type` itself when it is a type node here, else the row type with that id at `at`. */
export function resolveRowType(store: FosStore, type: string, at: Scope = [], root: string = rootTargetCid(store)): string {
  return store.table.has(type) ? type : rowTypeAt(store, type, at, root)
}

/**
 * The row type `typeId` (a row of the library's Row types group, e.g. `lib.note`) of the standard library nearest
 * to `at`, or null when no library above has it. New rows of that type are edges `[this cid, row]`.
 */
function nearestLibraryType(store: FosStore, typeId: string, at: Scope, root: string): string | null {
  const binding = libraryBindingAt(store, at, root)
  if (!binding) return null
  const fields = namesInLibrary(store, binding.library)
  if (fields.ambiguous.has(typeId)) throw new Error(`Ambiguous library field ${typeId}.`)
  return fields.byName.get(typeId) ?? null
}

/** Select a field of the bound library, without falling through to other namespaces. */
export function libraryTypeAt(store: FosStore, typeId: string, at: Scope = [], root: string = rootTargetCid(store)): string | null {
  return nearestLibraryType(store, typeId, at, root)
}

/** The nearest directly declared library instance. A namespace shadows as a whole. */
export function libraryBindingAt(store: FosStore, at: Scope = [], root: string = rootTargetCid(store)): { library: string; cid: string; id: string; path: Scope; source: FosStore } | null {
  const found = nearestInScope(enclosingScopes(store, root, at), scope => libraryInstancesOf(scope.store, scope.cid), 'library binding')
  if (!found) return null
  const { value: instance, ...scope } = found
  if (!isLibraryValue(scope.store, instance.library)) throw new Error('The library binding is unavailable.')
  const fields = namesInLibrary(scope.store, instance.library)
  if (fields.ambiguous.size) throw new Error(`Ambiguous library field ${[...fields.ambiguous][0]}.`)
  if (scope.store !== store) importNodes(store, reachableNodes(scope.store, [instance.library, instance.cid]))
  return { ...instance, path: scope.path, source: scope.store }
}

/** Code-facing fields of the library instance at this graph position. No implicit installation or synthesized fields. */
export function libAt(store: FosStore, at: Scope = [], root: string = rootTargetCid(store)): { capabilities: Record<string, string>; field(name: string): string } {
  const binding = libraryBindingAt(store, at, root)
  if (!binding) throw new Error('No library binding in this scope.')
  const names = namesInLibrary(store, binding.library), fields = names.byName
  if (names.ambiguous.size) throw new Error(`Ambiguous library field ${[...names.ambiguous][0]}.`)
  const field = (name: string): string => {
    const value = fields.get(name)
    if (!value) throw new Error(`The library in this scope has no ${name}.`)
    return value
  }
  const capabilities = new Proxy(Object.fromEntries([...fields].filter(([name]) => name.startsWith('capabilities.')).map(([name, cid]) => [name.slice('capabilities.'.length), cid])), {
    get: (values, name) => typeof name === 'string' ? field(`capabilities.${name}`) : Reflect.get(values, name)
  })
  return { capabilities, field }
}

/**
 * A scratch store whose root is the value of the node at `at` below `root` in `store` (a draft of that node, built
 * to become a proposal) is a nested scope there: refs it does not resolve itself resolve from that position.
 */
export function nestScope(draft: FosStore, outer: { store: FosStore; root: string; at: Scope }): void {
  for (let parent: typeof outer | undefined = outer; parent; parent = outerScopes.get(parent.store)) {
    if (parent.store === draft) throw new Error('A scope cannot enclose itself.')
  }
  outerScopes.set(draft, outer)
}
const outerScopes = new WeakMap<FosStore, { store: FosStore; root: string; at: Scope }>()

/** An isolated working copy must retain the source document's lexical environment. */
export function copyOuterScope(source: FosStore, target: FosStore): void {
  const outer = outerScopes.get(source)
  if (outer) nestScope(target, outer)
}

export type EnclosingScope = { store: FosStore; cid: string; path: Scope }
/** Lexical ancestors, nearest first, continuing through a nested document's device root. */
export function enclosingScopes(store: FosStore, root: string, at: Scope): EnclosingScope[] {
  const result: EnclosingScope[] = [], visited = new Set<FosStore>()
  while (!visited.has(store)) {
    visited.add(store)
    for (let depth = at.length; depth >= 0; depth--) {
      const path = at.slice(0, depth), cid = resolveScope(store, root, path)
      if (cid) result.push({ store, cid, path })
    }
    const outer = outerScopes.get(store)
    if (!outer) break
    ;({ store, root, at } = outer)
  }
  return result
}

/**
 * What a lookup by name or kind sees from a position. `blocked`: the scope that answers holds the declaration, but it
 * cannot be used here (unavailable, denied, cyclic); that is the answer, never a reason to look further out.
 */
export type ScopeLookup<T> =
  | { status: 'ready'; scope: EnclosingScope; value: T }
  | { status: 'ambiguous'; scope: EnclosingScope; values: T[] }
  | { status: 'blocked'; scope: EnclosingScope }
  | { status: 'missing' }
/**
 * The scope rule every lookup by name or kind follows. `find` reads one scope's direct declarations: none (`[]`)
 * passes the lookup outward; the nearest scope that declares anything answers it, several there being ambiguous, and
 * `null` (it declares the name but cannot provide it) blocking it. Outer scopes are never consulted once a nearer one
 * answers. Collecting every alternative of a type (handler discovery) is not a lookup by name: it reads every visible
 * declaration, and only the same declaration identity shadows.
 */
export function lookupInScope<T>(scopes: EnclosingScope[], find: (scope: EnclosingScope) => T[] | null): ScopeLookup<T> {
  for (const scope of scopes) {
    const values = find(scope)
    if (values === null) return { status: 'blocked', scope }
    if (values.length === 1) return { status: 'ready', scope, value: values[0]! }
    if (values.length > 1) return { status: 'ambiguous', scope, values }
  }
  return { status: 'missing' }
}
/** `lookupInScope` for code that needs one declaration: ambiguous and blocked declarations are errors, not absence. */
export function nearestInScope<T>(scopes: EnclosingScope[], find: (scope: EnclosingScope) => T[] | null, what: string): (EnclosingScope & { value: T }) | null {
  const found = lookupInScope(scopes, find)
  if (found.status === 'ambiguous') throw new Error(`Ambiguous ${what} in this scope.`)
  if (found.status === 'blocked') throw new Error(`The ${what} in this scope is unavailable.`)
  return found.status === 'ready' ? { ...found.scope, value: found.value } : null
}

/**
 * The library row a device root ships is local to that device: node exchange of a root leaves it out on both sides,
 * and installing a root received from a peer keeps this device's own.
 */
export function isShippedLibrary(store: FosStore, path: Scope, edge: FosPathElem): boolean {
  if (path.length) return false
  const right = edge[1]
  return store.table.has(right) && isLibraryRef(store, content(store, right))
}

/**
 * The library ref a device root has, a row of the Library type with `first` (the build's library) as its value: what
 * the ref holds once it accepted that submission (its earlier, empty version is its history). Later values arrive as
 * submissions too (sync/library.ts). It stays on this device: the fos server does not persist it. Other store roots get
 * none; they are nested in a device root (`nestScope`).
 */
export function ensureLibraryRow(store: FosStore, first: string = shippedLibrary(store)): void {
  setRootType(store, DEVICE_ROOT_TYPE)
  const root = rootTargetCid(store)
  const children: FosPathElem[] = []
  if (!libraryRowOf(store, root)) {
    const type = shippedRef(store, LIBRARY_TYPE)!
    const data = { alias: { id: LIBRARY_ID }, description: { content: 'Standard library' } }
    const empty = put(store, refNodeContent(store, data, null))
    children.push([type, put(store, withPrev(store, { ...content(store, empty), children: [[primitive(store, 'target'), first], ...content(store, empty).children] }, empty))])
  }
  // the instance code uses: this version of the library, and what this device passes it (nothing yet)
  if (!libraryInstanceOf(store, root)) children.push(libraryInstanceEdge(store, first))
  if (!children.length) return
  const value = valueContent(store, root)
  commitRoot(store, put(store, { ...value, children: [...value.children, ...children] }), 0)
}
/** A library instance row: the library `library` on its left, its `lib` ref (with `args`, what is passed in) on its right. */
export function libraryInstanceEdge(store: FosStore, library: string, args: string = put(store, { data: {}, children: [] }), id: string = LIBRARY_INSTANCE_ID): FosPathElem {
  return [library, put(store, refNodeContent(store, { alias: { id }, name: { content: LIBRARY_BINDING } }, args))]
}

/** Stand-in type for a row pinned to template `cid` that this store does not hold (see `resolveReferenceErrors`). */
export function referenceErrorTemplate(store: FosStore, cid: string): string {
  return put(store, { data: { description: { content: 'Reference error' }, missingTemplate: { cid } }, children: [] })
}

/** A template row a task was made from (not a library type, which has no identity of its own): its cid, alias id and name. */
export function userTemplateOf(store: FosStore, edge: FosPathElem): { cid: string; id: string; name: string } | null {
  const cid = rowTypeOf(store, edge)
  if (!cid || !isTemplateType(store, cid)) return null
  return { cid, id: content(store, cid).data.alias?.id ?? valueContent(store, cid).data.alias?.id ?? typeIdOf(store, cid)!, name: valueContent(store, cid).data.description?.content ?? 'Template' }
}

/** A row pinned to a template this store has not received: the template it is waiting for. */
export function missingTemplateOf(store: FosStore, edge: FosPathElem): { cid: string } | null {
  edge = edge
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
  edge = edge
  if (isChoiceEdge(store, edge)) { const active = isBranchChoice(store, content(store, edge[1])) ? branchEdge(store, edge[1]) : null; return active ? keptRowType(store, active, type) : null }
  const own = rowTypeOf(store, edge)
  if (!own || missingTemplateOf(store, edge)) return null
  const id = typeIdOf(store, own)
  if (id === type) return own
  if (type === TASK_TYPE && isTemplateType(store, own)) return own
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

/** The same row made from another template (e.g. a task instantiating "Invoice"). */
export function withRowTemplate(store: FosStore, edge: FosPathElem, templateCid: string): FosPathElem {
  edge = edge
  if (isChoiceEdge(store, edge)) {
    const active = branchEdge(store, edge[1])
    return active ? [edge[0], updateBranch(store, edge[1], withRowTemplate(store, active, templateCid))] : edge
  }
  return [templateCid, edge[1]]
}

export function isChoiceEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === primitive(store, 'choice')
}

/** Persistent editable choices reuse CHOICE/OPTION pointers; selection is local UI state. */
const branchSelections = new WeakMap<FosStore, Map<string, string>>()
export function isBranchChoice(store: FosStore, node: FosNodeContent): boolean {
  return !!node.data.option && !node.data.conflict && node.children.some(e => e[0] === primitive(store, 'notSelected'))
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
  return edge[0] === primitive(store, 'member')
}

/** The node that carries an edge's identity and data: the target ([template, row], [CHOICE, choice], [type, ref], …). */
export function identityCid(_store: FosStore, edge: FosPathElem): string {
  return edge[1]
}

/** Rebuild an edge around a new version of its identity node. */
export function withIdentity(_store: FosStore, edge: FosPathElem, cid: string): FosPathElem {
  return [edge[0], cid]
}

/** Edges have the same "shape" when they differ only in their identity node (rows: made from the same template). */
export function sameShape(_store: FosStore, a: FosPathElem, b: FosPathElem): boolean {
  return a[0] === b[0]
}

// ---------------------------------------------------------------------------
// Content constructors

/** What a new row holds besides its text, by its type: a task's done state, a reference's target, a flow entry, … */
export type RowExtras = {
  done?: boolean
  refId?: string
  /** Market result: the account owning the referenced node. */
  refOwner?: string
  /** Where the referenced node is in its owner's account (a received shared link). */
  refScope?: string[]
  author?: { id: string; name: string }
  targetCid?: string
  store?: FosStore
  query?: NonNullable<FosNodeContent['data']['query']>
  resource?: NonNullable<FosNodeContent['data']['resource']>
  /** The user `@name` names: bound as the row's `user` field (a user object); null removes it. */
  user?: UserRecord | null
}

/**
 * Content of a new row of the library type `typeId` (the data that type's rows carry). `text` is the title;
 * a reference ignores it. Argument rows (requirements and allocations) are made by sync/arguments.ts, not here.
 */
export function rowContent(typeId: string, id: string, text: string, now: number, extra: RowExtras = {}): FosNodeContent {
  const data: FosNodeContent['data'] = { alias: { id }, description: { content: text }, updated: { time: now } }
  if (typeId === QUERY_TYPE) data.query = extra.query ?? {}
  if (typeId === RESOURCE_TYPE) {
    data.resource = extra.resource ?? { type: 'inventory', unit: 'unit' }
    // Resource banks supply ordinary named bindings, just like other capability handlers.
    data.name = { content: text }
    if (extra.store) {
      const { alias, name, updated, ...value } = data
      return refNodeContent(extra.store, { alias, name, updated }, put(extra.store, { data: value, children: [] }))
    }
  }
  if (typeId === REF_TYPE) {
    data.ref = { id: extra.refId ?? '', ...(extra.refOwner ? { owner: extra.refOwner } : {}), ...(extra.refScope ? { scope: extra.refScope } : {}) }
    // a reference row is itself a ref node: TARGETPOINTER holds a snapshot of the row it stands for
    if (extra.targetCid && extra.store) return refNodeContent(extra.store, data, extra.targetCid)
  }
  return { data, children: [] }
}

/** The edge for row node `cid` made from `type` (a row type or a template row). */
export function rowEdge(store: FosStore, cid: string, type: string): FosPathElem {
  if (isBranchChoice(store, content(store, cid))) {
    const active = branchEdge(store, cid)
    return [primitive(store, 'choice'), active ? updateBranch(store, cid, rowEdge(store, identityCid(store, active), type)) : cid]
  }
  return [type, cid]
}

/** The edge for a new row node `cid` of `type` (a type cid, or a type id resolved at `at` by `rowTypeAt`). */
export function rowEdgeAt(store: FosStore, type: string, cid: string, at: Scope, root?: string): FosPathElem {
  const typeCid = resolveRowType(store, type, at, root)
  return rowEdge(store, cid, typeCid)
}

/** Same node as a row of another type (`convertRowContent`). */
export function convertRow(store: FosStore, value: FosNodeContent, typeId: string, now: number, extra: Omit<RowExtras, 'store'> = {}): FosNodeContent {
  const title = value.data.description?.content ?? ''
  const { presentation: _presentation, scalar: _scalar, ...data } = value.data
  return convertRowContent({ ...value, data: { ...data, description: { content: title } } }, typeId, now, extra)
}

/** Same node as a row of the library type `typeId`: the data of its old type dropped, the new type's added. */
export function convertRowContent(value: FosNodeContent, typeId: string, now: number, extra: Omit<RowExtras, 'store'> = {}): FosNodeContent {
  const { ref: _ref, query: _q, resource: _rs, allocation: _al, ...rest } = value.data
  const data: FosNodeContent['data'] = { ...rest, updated: { time: now } }
  if (typeId === REF_TYPE) data.ref = value.data.ref ?? { id: '' }
  if (typeId === QUERY_TYPE) data.query = value.data.query ?? {}
  if (typeId === RESOURCE_TYPE) {
    data.resource = extra.resource ?? value.data.resource ?? { type: 'inventory', unit: 'unit' }
    data.name = { content: value.data.description?.content ?? '' }
  }
  return { ...value, data }
}

/** A peer edge's identity (a device attached to the store): the content address of who it is, apart from a member entry for the same peer. */
export const peerEntryId = (peerId: string): string => hashContent({ data: { peerId: { content: peerId }, description: { content: 'attached peer' } }, children: [] })
export function peerRefContent(peerId: string): FosNodeContent {
  return { data: { alias: { id: peerEntryId(peerId) }, peerId: { content: peerId } }, children: [] }
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
        [primitive(store, 'instruction'), edge[0]],
        [primitive(store, 'target'), edge[1]]
      ]
    : []
  return { data, children }
}

function readPointer(store: FosStore, cid: string): { peerId: string | null; edge: FosPathElem | null } {
  const value = content(store, cid)
  let instr: string | null = null
  let target: string | null = null
  for (const [i, t] of value.children) {
    if (i === primitive(store, 'instruction')) instr = t
    if (i === primitive(store, 'target')) target = t
  }
  return {
    peerId: value.data.peerId?.content ?? null,
    edge: instr && target ? [instr, target] : null
  }
}

/**
 * A branch's flag asking for it to be merged: a row of the approve action on the option (what it is, its left). Both
 * local and received branches request approval through this ordinary typed child ref. Its text names the branch it
 * merges into; its identity is the request's, so a retargeted request stays the same request under merge.
 */
export function mergeRequestEdge(store: FosStore, id: string, target?: string): FosPathElem {
  return [primitive(store, 'approve'), put(store, refNodeContent(store, { alias: { id: hashContent({ data: { description: { content: id } }, children: [] }) }, ...(target ? { description: { content: target } } : {}) }, null))]
}
/** The branch a merge request merges into: the one it names, else the choice's default. */
export function mergeRequestTarget(store: FosStore, request: string, fallback: string): string {
  return store.table.has(request) ? content(store, request).data.description?.content ?? fallback : fallback
}

/** Build and insert a choice node; the alternatives are sorted so the cid is deterministic. */
export function putChoice(store: FosStore, id: string, base: FosPathElem | null, options: ChoiceOption[]): string {
  const alternatives = options
    .map((o) => {
      const pointer = pointerContent(o.peerId, o.edge, store)
      if (o.requestMerge) pointer.children.push([primitive(store, 'approve'), o.requestMerge])
      if (o.base) pointer.children.push([primitive(store, 'base'), put(store, pointerContent(null, o.base, store))])
      return { peerId: o.peerId, cid: put(store, pointer) }
    })
    .sort((a, b) => (a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0))
  const baseCid = put(store, pointerContent(null, base, store))
  const children: FosPathElem[] = [
    [primitive(store, 'base'), baseCid],
    ...alternatives.map((a): FosPathElem => [primitive(store, 'notSelected'), a.cid])
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
    if (instr === primitive(store, 'base')) {
      base = readPointer(store, target).edge
    } else if (instr === primitive(store, 'notSelected')) {
      const pointer = readPointer(store, target)
      const basePointer = content(store, target).children.find(e => e[0] === primitive(store, 'base'))
      const requestMerge = content(store, target).children.find(e => e[0] === primitive(store, 'approve'))?.[1]
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
  // a path that is not from the root may be from its Home
  if (!current && nodeCid && scope.length) {
    const home = homeCidOf(store, nodeCid)
    if (home && homeIdOf(store, nodeCid) !== scope[0]) return resolveScope(store, home, scope)
  }
  return current
}

/** Legacy attachment paths predate the explicit Home constructor. */
export function contextScope(store: FosStore, nodeCid: string, scope: Scope): Scope {
  if (!scope.length || findChild(store, nodeCid, scope[0]!)) return scope
  const home = homeCidOf(store, nodeCid), id = homeIdOf(store, nodeCid)
  return home && id && resolveScope(store, home, scope) ? [id, ...scope] : scope
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
  // an unfilled ref holds nothing: what is written into it starts an empty container, never a copy of the ref itself
  const value = ref ? (refValueCid(store, identity) ? valueContent(store, nodeCid) : { data: {}, children: [] }) : identity

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
  if (nextValue.data.name && !isRefNode(store, nextValue)) {
    const { alias, name, ...data } = nextValue.data
    return withIdentity(store, edge, put(store, refNodeContent(store, { alias: alias ?? identity.data.alias, name },
      put(store, { ...nextValue, data }))))
  }
  return withIdentity(store, edge, put(store, nextValue))
}

/** Deliberately detach a device: drop its PEER edge (and its MEMBER entry, if any). */
export function withoutPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const children = value.children.filter((e) => !isPeerEdge(store, e) || content(store, e[1]).data.peerId?.content !== peerId)
  return withoutMember(store, children.length === value.children.length ? value : { ...value, children }, peerId)
}

export function withPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const refCid = put(store, peerRefContent(peerId))
  const edge: FosPathElem = [primitive(store, 'member'), refCid]
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
  const pointer = root.children.find(([i]) => i === primitive(store, 'target'))
  // a root in type error keeps its content behind the error node (sync/patterns.ts)
  return pointer ? pointer[1] : store.rootNodeId
}

/** The root alias's target as stored: the content, or the type error node in front of it. */
export function rootStoredTarget(store: FosStore): string {
  const root = content(store, store.rootNodeId)
  return root.children.find(([i]) => i === primitive(store, 'target'))?.[1] ?? store.rootNodeId
}

export function rootIsAlias(store: FosStore): boolean {
  return content(store, store.rootNodeId).children.some(([i]) => i === primitive(store, 'target'))
}

/**
 * Home's identity on its store root: a content address (every store's Home has the same one, so devices converge on
 * it). Code finds Home by its type (`homeCidOf`) and its path by `homePath`; this is what a new Home is called.
 */
export const HOME_ID = hashContent({ data: { description: { content: 'Home' } }, children: [] })
/** The store root's Home: its row of the Home type, if there is one. */
export function homeCidOf(store: FosStore, rootCid: string): string | null {
  // a branched Home is its selected branch's row
  const leftOf = (raw: FosPathElem): string | null => {
    const edge = raw
    if (isChoiceEdge(store, edge) && store.table.has(edge[1]) && isBranchChoice(store, content(store, edge[1]))) { const active = branchEdge(store, edge[1]); return active ? active[0] : null }
    return isRowEdge(store, edge) ? edge[0] : null
  }
  for (const edge of valueContent(store, rootCid).children) { const left = leftOf(edge); if (left && typeIdOf(store, left) === HOME_TYPE) return identityCid(store, edge) }
  return null
}
/** Home's id among the root's rows (a branched Home's is its choice's). */
export function homeIdOf(store: FosStore, rootCid: string): string | null {
  const home = homeCidOf(store, rootCid)
  if (!home) return null
  return isBranchChoice(store, content(store, home)) ? readChoice(store, home).id : content(store, home).data.alias?.id ?? null
}
/** The account server's peer: its membership on a store root holds its offers and the key it publishes. */
export const SERVER_MEMBER = 'fos'

/** Replace a member's offers (ACCEPTS edges) when they differ from `offers`, keeping its grants and switches. */
export function withMemberOffers(store: FosStore, value: FosNodeContent, peerId: string, name: string | null, consumes: Capability[], offers: Capability[]): FosNodeContent {
  const member = readMembers(store, value).find(m => m.peerId === peerId)
  // a peer may offer a capability this build has no name for: it is kept, as one with no handler here yet
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
  const homeCid = homeCidOf(store, rootCid)
  // A branched Home is already a container: preserve its choice wrapper and alternatives.
  if (homeCid && isBranchChoice(store, content(store, homeCid))) {
    const edge = root.children.find(edge => identityCid(store, edge) === homeCid)!
    const nextEdge = rowEdge(store, homeCid, keptRowType(store, edge, HOME_TYPE) ?? rowTypeAt(store, HOME_TYPE, [], rootCid))
    if (nextEdge[0] === edge[0] && nextEdge[1] === edge[1] && bindings === identity && identity === content(store, rootCid)) return rootCid
    const nextValue = put(store, withMembershipRows(store, { ...root, children: root.children.map(e => e === edge ? nextEdge : e) }, memberEdgesOfContent(store, bindings)))
    return put(store, refNodeContent(store, identity.data, nextValue, bookkeepingOf(store, bindings)))
  }
  const movable = homeCid ? [] : root.children.filter(edge => ((isRowEdge(store, edge) && !isRowOfType(store, edge, TEMPLATE_TYPE)) || isChoiceEdge(store, edge)) && !isShippedLibrary(store, [], edge))
  const homeValue = homeCid ? valueContent(store, homeCid) : rowContent(HOME_TYPE, HOME_ID, 'Home', 0)
  let home = homeCid ? makeLink(store, content(store, homeCid), 0) : makeLink(store, { ...homeValue, children: movable }, 0)
  // Integration handlers belong to Home; carry over old root bindings without losing overrides.
  const legacyIntegrations = memberHolder(store, bindings).children.filter(edge => isMemberEdge(store, edge) && memberPeerOf(store, edge).startsWith('integration:'))
  for (const edge of legacyIntegrations) if (!readMembers(store, home).some(member => member.peerId === memberPeerOf(store, edge))) home = withMembershipRow(store, home, memberPeerOf(store, edge), edge[1])
  for (const edge of legacyIntegrations) bindings = withoutMember(store, bindings, memberPeerOf(store, edge))
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
  const nextValue = put(store, withMembershipRows(store, { ...root, children: [...keep, rowEdge(store, nextHome, (homeEdge && keptRowType(store, homeEdge, HOME_TYPE)) ?? rowTypeAt(store, HOME_TYPE, [], rootCid))] }, memberEdgesOfContent(store, bindings)))
  return put(store, refNodeContent(store, identity.data, nextValue, bookkeepingOf(store, bindings)))
}

/**
 * Advance the root alias to a new target, keeping the alias id, linking PREV to
 * the previous root and optionally MERGESOURCE to a root that was merged in.
 */
export function commitRoot(store: FosStore, newTargetCid: string, now: number, mergeSourceCid: string | null = null, force = false): void {
  if (newTargetCid === rootStoredTarget(store) && rootIsAlias(store) && !mergeSourceCid && !force) return
  const previous = content(store, store.rootNodeId)
  // A bare (non-alias) root is wrapped from here on: the alias keeps the history chain.
  const instruction = rootIsAlias(store)
    ? previous.children.find(([i]) => i === primitive(store, 'instruction'))
    : undefined
  const children: FosPathElem[] = [
    [primitive(store, 'target'), newTargetCid],
    [primitive(store, 'instruction'), instruction ? instruction[1] : shippedRef(store, DOCUMENT_ROOT_TYPE)!],
    [primitive(store, 'previous'), store.rootNodeId]
  ]
  if (mergeSourceCid) children.push([primitive(store, 'mergeSource'), mergeSourceCid])
  // Per-peer node endpoints are local policy, not part of the shared target.
  children.push(...previous.children.filter(([, t]) => !!content(store, t).data.nodeLink))
  const alias = previous.data.alias ?? { id: newId() }
  store.rootNodeId = put(store, { data: { alias, updated: { time: now } }, children })
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
  if (accepted.length) {
    const added = new Set(accepted), cache = libraryNameCache.get(store)
    if (cache) for (const [value, entry] of cache) if ([...entry.missing].some(cid => added.has(cid))) cache.delete(value)
  }
  return accepted
}

export function exportReachableContext(store: FosStore, extraRoots: Array<string | null> = []): FosContextData {
  return {
    nodes: reachableNodes(store, [store.rootNodeId, ...extraRoots]),
    rootNodeId: store.rootNodeId
  }
}

// ---------------------------------------------------------------------------
// View model: what the UI sees (opaque ids, no cids)

export type TaskView = {
  /** Leaf editor chosen by the graph constructor. */
  scalar?: NonNullable<FosDataContent['scalar']>['type'];
  /** The row's own fields (besides its title), as its type declares them. */
  fields?: FieldView[];
  /** A row with a body after its title (a note): the body's text, shown as Markdown. */
  body?: string;
  /** `evaluation`: the node's execute row, whose value is the evaluator's journal. */
  /** `name` and `holder`: a setting (`settingOf`), its key and the device holding it. */
  construction?: { name?: string; holder?: string; peerId?: string; handler?: string; evaluation?: true }

  /** `mergeTargets`: for each branch with a merge request, the branch it merges into. */
  branches?: { selected: string; names: string[]; mergeRequests?: string[]; mergeTargets?: Record<string, string> }
  id: string
  title: string
  /**
   * The row's type: the graph identity of its edge's left node (`lib.<type>` for a library type, any version; a template
   * row's id for a task made from it), '' when its type has none (rows of types this peer does not know render as plain).
   */
  type: string
  /** The left node itself (the pinned version), when the row has one. */
  typeCid?: string
  /** The type's own name (its description: "Task", "Note", a template's title), for labels. */
  typeName?: string
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
  /** A negative argument row (a requirement): what it demands and whether its value satisfies it. */
  requirement?: RequirementView
  query?: NonNullable<FosDataContent['query']>
  /** `held`: the net amount of the bank's grants (negative grants retire authority). */
  resource?: NonNullable<FosDataContent['resource']> & { held: number }
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
  /** The rows it adds, by node (`submissionAdditions`), when the provider sent them: enough to accept them without their content. */
  additions?: SubmissionAddition[]
  /** Who has approved it so far (its approval rows), with the attester's signature where there is one. */
  approvals?: Array<{ approver: string; signature?: { key: string; value: string } }>
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
  if (marketGrantsOf(store, nodeCid)?.includes('read')) return true
  // a node is also listed while a market requirement under it holds its answer (the server's listing)
  return childRows(store, nodeCid).some(row => { const view = requirementViewOf(store, row.edge, row.cid); return !!view && view.capability === 'market' && view.satisfied })
}
/**
 * The host-value projection of the named argument ref `name` on the node `nodeCid` (what `readNodeValue` reads, without a
 * replica). Null when the node has no such value.
 */
export function namedValueOf<T>(store: FosStore, nodeCid: string, name: string): T | null {
  for (const edge of valueContent(store, nodeCid).children) {
    const id = identityCid(store, edge), ref = content(store, id), type = rowTypeOf(store, edge)
    if (!type || edge[0] !== type || !ref.data.alias?.id || (ref.data.name?.content ?? ref.data.alias.id) !== name) continue
    return (readGraphValue(store, id) as T | undefined) ?? null
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
  const created = value.data.created?.time ?? value.data.updated?.time ?? 0
  // a node held by another peer, not loaded yet, stands for it like a reference
  const held = isPeerReference(identity)
  const typeCid = edge ? rowTypeOf(store, edge) : null
  const type = typeIdOf(store, typeCid) ?? (typeCid && isTemplateType(store, typeCid) ? content(store, typeCid).data.alias?.id : '') ?? ''
  const task = !held && !!edge && isTaskRow(store, edge)
  const sub = countNode(store, nodeCid)
  const definition = typeCid ? valueContent(store, typeCid) : undefined
  // a requirement row is titled by its own declaration, whatever value is bound to it
  const asks = !!typeCid && isNegative(store, typeCid) && isRefNode(store, identity) && !!identity.data.description
  const rowId = aliasIdOf(identity) ?? aliasIdOf(value) ?? nodeCid
  const view: TaskView = {
    id: rowId,
    title: asks ? identity.data.description!.content : rowTitle(store, nodeCid, typeCid),
    type,
    ...(typeCid ? { typeCid } : {}),
    ...(type ? { typeName: type } : {}),
    checkable: task,
    done: task && rowDone(store, nodeCid),
    createdAt: created,
    updatedAt: value.data.updated?.time ?? created,
    childCount: value.children.filter((e) => isRowEdge(store, e) && !isFieldRow(store, rowId, e) && !(isKindRow(store, e) && !content(store, identityCid(store, e)).data.alias)).length,
    childChoices: value.children.filter((e) => isChoiceEdge(store, e)).length,
    subtreeTasks: sub.tasks,
    subtreeDone: sub.done,
    isLink: isLink(store, identity)
  }
  if (typeCid && !held && !isTextField(store, typeCid)) {
    // the title, the body and done are shown by the row itself
    const body = rowBody(store, nodeCid, typeCid), texts = typeRows(store, typeCid).map(([field]) => field).filter(field => isTextField(store, field))
    const shown = new Set([titleField(store, typeCid), rowVocabulary(store)?.done, ...(body !== null ? [texts.at(-1)] : [])])
    const fields = fieldViews(store, typeCid, rowId, value).filter(field => !shown.has(field.field))
    if (fields.length) view.fields = fields
    if (body !== null) view.body = body
  }
  if (value.data.scalar) view.scalar = value.data.scalar.type
  if (held) { view.refPeer = identity.data.ref!.peer; view.title = identity.data.description?.content ?? 'Peer-held node' }
  const activeEdge = isBranchChoice(store, identity) ? branchEdge(store, nodeCid) : null
  const constructor = activeEdge ? content(store, identityCid(store, activeEdge)) : identity
  if (typeIdOf(store, typeCid) === 'capabilities.peer' && constructor.data.name) view.construction = { handler: constructor.data.name.content }
  const setting = settingOf(store, constructor)
  if (setting) view.construction = { name: setting.key, holder: setting.peer }
  // a node's execute row: the evaluator's journal of it
  if (edge && isExecuteLeft(store, edge[0])) { view.construction = { evaluation: true }; view.title = 'Evaluation' }
  if (held || type === REF_TYPE) { view.refId = identity.data.ref?.id ?? ''; if (identity.data.ref?.owner) view.refOwner = identity.data.ref.owner }
  const template = edge ? userTemplateOf(store, edge) : null
  if (template) view.template = { id: template.id, name: template.name }
  const missing = edge ? missingTemplateOf(store, edge) : null
  if (missing) view.missingTemplate = { cid: missing.cid }
  if (task) { const blockers = taskBlockers(store, nodeCid); if (blockers.length) view.blockedBy = blockers }
  if (isBranchChoice(store, identity)) {
    const record = readChoice(store, nodeCid), requests = record.options.filter(o => o.requestMerge)
    view.branches = { selected: branchSelection(store, nodeCid), names: record.options.map(o => o.peerId), mergeRequests: requests.map(o => o.peerId), mergeTargets: Object.fromEntries(requests.map(o => [o.peerId, mergeRequestTarget(store, o.requestMerge!, record.defaultName ?? 'main')])) }
  }
  // a requirement's @user is part of its declaration; an answer that carries one (an attested user) refines it
  const user = asks ? userOf(store, value) ?? userOf(store, identity) : userOf(store, value)
  if (user) view.user = user
  const requirement = !held && edge ? requirementViewOf(store, edge, nodeCid, user) : undefined
  if (requirement) view.requirement = requirement
  if (!held && edge && isAllocationRow(store, edge) && value.data.allocation) view.allocation = value.data.allocation
  if (type === QUERY_TYPE) view.query = value.data.query ?? {}
  if (type === RESOURCE_TYPE && value.data.resource) view.resource = { ...value.data.resource, held: grantEntries(store, refValueCid(store, identity) ?? nodeCid).reduce((sum, grant) => sum + grant.allocation.amount, 0) }
  if (isListed(store, nodeCid)) view.market = true
  return view
}

// ---------------------------------------------------------------------------
// Arguments: requirements (negative) and allocations (positive), banks and grants

/** The name a capability node carries (`capabilities.<name>`), or null for any other node. Presentation only. */
export function capabilityNameOf(store: FosStore, type: string | null | undefined): string | null {
  const id = typeIdOf(store, type)
  return id?.startsWith('capabilities.') ? id.slice('capabilities.'.length) : null
}
/** A requirement row: an argument row whose pattern is negative (it asks for a value) and whose right is the ref that holds it. */
export function isRequirementRow(store: FosStore, edge: FosPathElem): boolean {
  const left = isRowEdge(store, edge) ? rowTypeOf(store, edge) : null
  return !!left && isNegative(store, left) && isRefNode(store, content(store, identityCid(store, edge)))
}
/**
 * An allocation row: a row whose pattern is a positive allocation. In the tree its right is a ref holding the amount
 * (a grant when a bank issued it: a handle); inside a bank's value its right is the grant itself, an element of the set.
 */
export function isAllocationRow(store: FosStore, edge: FosPathElem): boolean {
  const left = isRowEdge(store, edge) ? rowTypeOf(store, edge) : null
  return !!left && !isNegative(store, left) && !!content(store, left).data.allocation
}

/** What a requirement demands, read from its pattern, and whether its value satisfies it. */
export type RequirementView = {
  capability: string | null; satisfied: boolean; summary: string
  /** The pattern pins the allocate contract: only a grant satisfies it. */
  linear: boolean
  resource?: ResourceType; amount?: number; unit?: string; start?: number | null; end?: number | null
  options?: string[]
  /** Named inputs the demand carries for its handler (a recipient, a repository, a tool), by name. */
  inputs: Record<string, string>
  tool?: string; repo?: string; peer?: string; place?: string
}

/** The options a choice pattern declares, in order: its alternative rows other than its classifying and capability rows. */
export function patternOptions(store: FosStore, pattern: string): string[] {
  const node = content(store, pattern)
  if (!node.data.refAlternatives) return []
  return node.children.filter(edge => !isClassifyingRow(store, edge, node) && !isKindRow(store, edge))
    .map(([, option]) => content(store, option).data.description?.content ?? '')
}
/** The named inputs a pattern carries: its rows whose right is a named ref, with the text each holds. */
export function patternInputs(store: FosStore, pattern: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [, right] of content(store, pattern).children) {
    const ref = store.table.get(right)
    if (!ref || !isRefNode(store, ref) || !ref.data.name) continue
    const value = refValueCid(store, ref)
    if (value) result[ref.data.name.content] = content(store, value).data.description?.content ?? ''
  }
  return result
}
/**
 * The pattern with `inputs` filled: a declared input ref of the same name holds the text, an undeclared one is added
 * as a text row. A value of the pattern carries the same rows, so what the handler reads is part of the contract.
 */
export function withInputs(store: FosStore, pattern: string, inputs: Record<string, string>): string {
  const node = content(store, pattern)
  let children = node.children
  for (const [name, text] of Object.entries(inputs)) {
    const value = put(store, { data: { description: { content: text } }, children: [] })
    const index = children.findIndex(([, right]) => { const ref = store.table.get(right); return !!ref && isRefNode(store, ref) && ref.data.name?.content === name })
    const left = index >= 0 ? children[index]![0] : primitive(store, 'string')
    const row: FosPathElem = [left, put(store, refNodeContent(store, { alias: { id: hashContent({ data: { name: { content: name }, description: { content: 'input' } }, children: [] }) }, name: { content: name } }, value))]
    children = index >= 0 ? children.map((edge, i) => i === index ? row : edge) : [...children, row]
  }
  return put(store, { ...node, children })
}
/** The text of the input `name` of the row's pattern, or null. */
export function inputOf(store: FosStore, pattern: string, name: string): string | null {
  return patternInputs(store, pattern)[name] ?? null
}

/**
 * An argument is satisfied when its ref is bound to a value that satisfies its pattern, through the same resolution
 * every argument gets: a reference to a row is followed, choices must be resolved, and nothing switches on a name.
 */
export function argumentSatisfied(store: FosStore, cid: string, pattern: string): boolean {
  const node = content(store, cid)
  if (!isRefNode(store, node) || !refValueCid(store, node)) return false
  return resolveBinding(store, pattern, cid, [], undefined, { checkDependencies: false }).status === 'ready'
}

/** The requirement row `edge` as the tree shows it; undefined for any other row. */
export function requirementViewOf(store: FosStore, edge: FosPathElem, cid: string, user?: UserRecord | null): RequirementView | undefined {
  if (!isRequirementRow(store, edge)) return undefined
  const pattern = rowTypeOf(store, edge)!, node = content(store, pattern), allocation = node.data.allocation, inputs = patternInputs(store, pattern)
  // linear: the pattern is tagged with a second capability, the contract that checks the grant it demands
  const view: RequirementView = { capability: node.data.capabilityDefinition?.name ?? null, satisfied: argumentSatisfied(store, cid, pattern), summary: '', linear: tagsOf(store, node).length > 1, inputs,
    ...(allocation ? { resource: allocation.type, ...(allocation.amount !== undefined ? { amount: allocation.amount } : {}), ...(allocation.unit ? { unit: allocation.unit } : {}),
      ...(allocation.start !== undefined ? { start: allocation.start } : {}), ...(allocation.end !== undefined ? { end: allocation.end } : {}) } : {}),
    ...(node.data.refAlternatives ? { options: patternOptions(store, pattern) } : {}),
    ...(inputs.tool !== undefined ? { tool: inputs.tool } : {}), ...(inputs.repo !== undefined ? { repo: inputs.repo } : {}),
    ...(inputs.peer !== undefined ? { peer: inputs.peer } : {}), ...(inputs.place !== undefined ? { place: inputs.place } : {}) }
  view.summary = requirementSummary(view, user)
  return view
}

/** A requirement's one-line summary. Presentation by the capability's own name; execution never reads it. */
export function requirementSummary(req: Pick<RequirementView, 'capability' | 'resource' | 'amount' | 'unit' | 'options' | 'repo' | 'tool' | 'peer'>, user?: UserRecord | null): string {
  const named = user ? ` @${user.username}` : ''
  switch (req.capability) {
    case 'confirmation': return 'confirmation'
    case 'choice': return `choice${req.options?.length ? ` (${req.options.join(' | ')})` : ''}`
    case 'search': return 'search'
    case 'allocation': case 'send-payment': case 'points': case 'calendar':
      return req.resource ? `${req.resource}${req.amount !== undefined ? ` ${req.amount} ${req.unit ?? ''}`.trimEnd() : ''}${named}` : req.capability
    case 'task': return 'task'
    case 'peer': return user ? `@${user.username}` : req.peer ? `@${req.peer}` : 'peer'
    case 'repo': return req.repo ? `repo ${req.repo}` : 'repo'
    case 'tool': return req.tool ? `tool ${req.tool}` : 'tool'
    case 'verify': return user ? `verify @${user.username}` : 'verify'
    default: return req.capability ?? 'requirement'
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
/** Resolve templates from direct enclosing declarations, then the bound library's fields. */
export function findTemplate(store: FosStore, rootCid: string, name: string, at: Scope = []): { row: TaskView; cid: string } | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const local = nearestInScope(enclosingScopes(store, rootCid, at), scope => childRows(scope.store, scope.cid).filter(row => isRowOfType(scope.store, row.edge, TEMPLATE_TYPE) &&
    (valueContent(scope.store, row.cid).data.description?.content ?? '').trim().toLowerCase() === wanted), 'template declaration')
  if (local) {
    const { store: source, value: found } = local
    if (source !== store) importNodes(store, reachableNodes(source, [found.cid, found.edge[0]]))
    return { row: rowView(store, found.cid, found.edge), cid: found.cid }
  }
  const binding = libraryBindingAt(store, at, rootCid)
  if (!binding) return null
  const matches = childRows(store, binding.library).filter(row => isRowOfType(store, row.edge, TEMPLATE_TYPE) && isTemplateType(store, row.cid) &&
    (valueContent(store, row.cid).data.description?.content ?? '').trim().toLowerCase() === wanted)
  if (matches.length > 1) throw new Error('Ambiguous template declaration in the library.')
  const found = matches[0]
  return found ? { row: rowView(store, found.cid, found.edge), cid: found.cid } : null
}
/** Summaries of the requirements under a task that are not satisfied yet. */
export function taskBlockers(store: FosStore, taskCid: string): string[] {
  return childRows(store, taskCid).flatMap(row => {
    const req = requirementViewOf(store, row.edge, row.cid, userOf(store, content(store, row.cid)) ?? userOf(store, row.value))
    return req && !req.satisfied ? [req.summary] : []
  })
}

/** Whether a value is tagged with the checking contract `contract`: the capability node whose handler moves it. */
export function allocationContract(store: FosStore, value: FosNodeContent, contract: string): string | null {
  return tagsOf(store, value).includes(contract) ? contract : null
}
/** The checking contract a bank's value declares: its one tag. A bank is not a value of a capability, so it carries no other tag. */
export function ownerContract(store: FosStore, value: FosNodeContent): string | null {
  const tags = tagsOf(store, value)
  return tags.length === 1 ? tags[0]! : null
}

/**
 * The grants a value holds: its allocation rows whose value is a non-zero grant pinned to the contract the value
 * itself declares. A value that declares no contract holds no grants, so a copy of a grant's value elsewhere is data.
 */
export function grantEntries(store: FosStore, stateCid: string): Array<{ id: string; cid: string; edge: FosPathElem; contract: string; allocation: NonNullable<FosDataContent['allocation']> }> {
  const state = content(store, stateCid), owner = ownerContract(store, state)
  if (!owner) return []
  return state.children.flatMap(edge => {
    if (!isAllocationRow(store, edge)) return []
    const identity = identityCid(store, edge), node = content(store, identity)
    const cid = isRefNode(store, node) ? refValueCid(store, node) : identity
    if (!cid || !store.table.has(cid)) return []
    const value = content(store, cid), allocation = value.data.allocation, contract = allocationContract(store, value, owner)
    return allocation && allocation.amount !== 0 && contract ? [{ id: node.data.alias?.id ?? cid, cid, edge, contract, allocation }] : []
  })
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

type NodeCounts = { tasks: number; done: number; choices: number }
const nodeCounts = new WeakMap<FosStore, { selection: string; counts: Map<string, NodeCounts> }>()
function countCache(store: FosStore): Map<string, NodeCounts> {
  // CIDs are immutable, but the selected branch is local state. Reuse counts
  // across row views only while that selection is unchanged.
  const selection = JSON.stringify([...(branchSelections.get(store) ?? [])])
  let cached = nodeCounts.get(store)
  if (!cached || cached.selection !== selection || cached.counts.size > 10000) {
    cached = { selection, counts: new Map() }; nodeCounts.set(store, cached)
  }
  return cached.counts
}
export function countNode(store: FosStore, cid: string, ancestors = new Set<string>(), counts = countCache(store)): NodeCounts {
  if (ancestors.has(cid) || ancestors.size >= 128) return { tasks: 0, done: 0, choices: 0 }
  const known = counts.get(cid)
  if (known) return known
  ancestors.add(cid)
  let tasks = 0
  let done = 0
  let choices = 0
  for (const edge of valueContent(store, cid).children) {
    if (isTaskRow(store, edge)) {
      tasks++
      const taskCid = identityCid(store, edge)
      if (rowDone(store, taskCid)) done++
      const sub = countNode(store, taskCid, ancestors, counts)
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    } else if (isChoiceEdge(store, edge) && !isBranchChoice(store, content(store, edge[1])) && !isPeerReference(content(store, edge[1]))) {
      choices++
    } else if (isRowEdge(store, edge)) {
      const sub = countNode(store, identityCid(store, edge), ancestors, counts)
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    }
  }
  ancestors.delete(cid)
  const result = { tasks, done, choices }
  counts.set(cid, result)
  return result
}

export function viewNode(store: FosStore, cid: string, constructors = false): NodeView {
  if (isBranchChoice(store, content(store, cid))) { const active = branchEdge(store, cid); if (active) return { ...viewNode(store, identityCid(store, active), constructors), members: readMembers(store, content(store, cid)) } }
  const identity = content(store, cid)      // ref node for link rows (bookkeeping lives here)
  const value = valueContent(store, cid)    // the content: text, rows
  const link = isLink(store, identity)
  const ownId = aliasIdOf(identity) ?? aliasIdOf(value) ?? cid
  const view: NodeView = {
    name: rowTitle(store, cid, null) || null,
    done: rowVocabulary(store)?.done && fieldEdge(store, ownId, value, rowVocabulary(store)!.done!) ? rowDone(store, cid) : null,
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
    // the node's own fields are part of it, not rows inside it
    if (isFieldRow(store, ownId, edge)) continue
    // a library instance is the library's binding, a container, not one of the node's rows (Settings lists it)
    if (isRowEdge(store, edge) && !constructors && isLibraryInstance(store, content(store, identityCid(store, edge)))) continue
    // the rows a value carries as a value of its pattern (a capability's slots and inputs) are not the node's rows
    if (isKindRow(store, edge) && !content(store, identityCid(store, edge)).data.alias) continue
    // a handler's own state rows (the evaluator's journal) and a value's contract pin are not rows of the node either
    if (isRowEdge(store, edge) && (isHandlerStateLeft(store, edge[0]) || isTagRow(store, edge))) continue
    if (isRowEdge(store, edge)) {
      view.tasks.push(rowView(store, identityCid(store, edge), edge))
    } else if (isChoiceEdge(store, edge)) {
      view.choices.push(choiceView(store, edge[1]))
    }
  }
  if (constructors) {
    const seen = new Set<string>()
    for (const edge of [...value.children, ...(identity === value ? [] : identity.children)]) {
      if (!store.table.has(edge[1])) continue
      const child = content(store, identityCid(store, edge))
      const peerId = isMemberEdge(store, edge) ? memberPeerOf(store, edge) : isPeerEdge(store, edge) ? child.data.peerId?.content : undefined
      const setting = settingOf(store, child)
      const evaluation = isRowEdge(store, edge) && isExecuteLeft(store, edge[0])
      if ((!peerId && !evaluation && !setting) || !child.data.alias?.id) continue
      if (seen.has(peerId ?? child.data.alias.id)) continue
      seen.add(peerId ?? child.data.alias.id)
      const existing = view.tasks.find(row => row.id === child.data.alias!.id)
      const row = existing ?? rowView(store, identityCid(store, edge))
      row.title = evaluation ? 'Evaluation' : peerId ? child.data.name?.content ?? peerId : child.data.description?.content ?? setting!.key
      row.construction = evaluation ? { evaluation: true } : { ...(setting ? { name: setting.key, holder: setting.peer } : {}), ...(peerId ? { peerId } : {}) }
      if (!existing) view.tasks.push(row)
    }
  }
  // Order is the edge order (part of the node's identity since cid v2); no sorting.
  return view
}

/**
 * A setting: a named value a peer holds (its key is the ref's name, the device its holder: the value's peerId), such
 * as a device's theme on the device root or where it left Home.
 */
export function settingOf(store: FosStore, node: FosNodeContent): { key: string; peer: string } | null {
  if (!node.data.name || !isRefNode(store, node)) return null
  const target = refValueCid(store, node)
  const peer = target && store.table.has(target) ? content(store, target).data.peerId?.content : undefined
  return peer ? { key: node.data.name.content, peer } : null
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
    names.push(next ? rowTitle(store, next, null) || step : step)
    current = next
  }
  return names
}

// ---------------------------------------------------------------------------
// Link nodes: history, members and proposals
//
//   link node  data.link = { createdAt }; edges:
//     [PREV, previousVersionCid]       one per parent version (two after a merge)
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
export type Capability = string
/** Standard-library suggestions; never a whitelist for declarations or wire values. */
export const capabilityNames = (store: FosStore, at: Scope = []): Capability[] => capabilityDeclarations(store, at).map(p => p.name)
/**
 * MCP peers: an MCP server attached to a node as a member (peer id `mcp:<server id>`) advertises `tool` (it runs
 * its tools for "-tool <name> …" requirements under that node) next to what else it may do there.
 */
export const MCP_PEER_PREFIX = 'mcp:'
/**
 * Integration peers: outside services a user signs in with (OAuth), platform peers the account is set up with
 * (Stripe) and channel peers (a phone). This list is identity only: what each one *provides* is not declared
 * here but derived by the account server from the handlers it actually has (backend/sync/host-runtime.ts) and
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
 * (search, market, llm, cron, …) are advertised only when the server's handler registry has them; the server
 * reports the derived list in every sync/node response (`capabilities`) and devices record it on their fos member.
 */
export const SERVER_TRANSPORT_CAPABILITIES: Capability[] = ['http', 'ws', 'relay', 'peer', 'persist', 'provideNode', 'sync']
/** What a host (the account server) currently offers: its own services and, per integration peer id, that peer's handlers. */
export type HostOffers = {
  /** Primitive refs are ordinary incoming sub-refs of their host peer. Names below are wire projections. */
  primitives?: { peers: Record<string, FosPathElem[]>; nodes: FosNodesData }
  server?: Capability[]
  integrations?: Record<string, Capability[]>
  /**
   * Public keys of the host's peers (peer id → raw ed25519 key, base64), published as graph data on each peer's
   * member entry on the store root (sync/users.ts `publishPeerKey`), which node exchange brings to the owner's devices,
   * so they check what those peers sign without asking an endpoint.
   */
  keys?: Record<string, string>
}
/** Human names for the capability rows (the ids above are what the graph and fos.config.toml use). */
export const capabilityLabels = (store: FosStore, at: Scope = []): Record<Capability, string> => Object.fromEntries(capabilityDeclarations(store, at).map(p => [p.name, p.label]))

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
/** `{ to?: string[], from?: string[] }` (a fos.config.toml table or saved prefs) → a policy, preserving extension names. */
export function parsePolicy(value: unknown): PeerPolicy | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { to?: unknown; from?: unknown }
  const list = (x: unknown): Capability[] => (Array.isArray(x) ? x.filter((c): c is Capability => typeof c === 'string' && c.length > 0) : [])
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
  return edge[0] === primitive(store, 'previous')
}

/**
 * A peer, as rows refer to it: the peer's node, `{ peerId }` (its identity, an opaque label nothing parses), content
 * addressed so every store has the same one. A peer is declared once in scope as a row of the Peer type with this node
 * on its right (`declarePeer`); a membership is a row with it on its left.
 */
export function peerNode(store: FosStore, peerId: string): string {
  return put(store, { data: { alias: { id: hashContent({ data: { peerId: { content: peerId } }, children: [] }) }, peerId: { content: peerId } }, children: [] })
}
/**
 * Whether `edge` is a membership: a row of the node whose left is a peer's node (the peer it is for), its right what
 * the node keeps for that peer (its grants for now, and the rows left for it: its relay queue, a key, a record).
 */
export function isMemberEdge(store: FosStore, edge: FosPathElem): boolean {
  const left = store.table.get(edge[0])
  return !!left?.data.peerId && !left.children.length && !!left.data.alias && !left.data.ref
}
/** The peer a membership row is for. */
export function memberPeerOf(store: FosStore, edge: FosPathElem): string {
  return content(store, edge[0]).data.peerId!.content
}

export function isProposalEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === primitive(store, 'proposal')
}

/** Edges that describe a link node's history and attachments rather than its content (its memberships are rows of its content). */
export function isBookkeepingEdge(store: FosStore, edge: FosPathElem): boolean {
  return isPrevEdge(store, edge) || isProposalEdge(store, edge) || isPeerEdge(store, edge)
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

/** Bookkeeping edges (PREV, PROPOSAL, PEER) of a link node, wherever they live. */
export function bookkeepingOf(store: FosStore, value: FosNodeContent): FosPathElem[] {
  // a ref identity's own rows (a requirement's @user field) stay with it through every rebinding, like its bookkeeping
  return value.children.filter((e) => isBookkeepingEdge(store, e) || (isRefNode(store, value) && (isRowEdge(store, e) || isMemberEdge(store, e))))
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
  const prevEdge: FosPathElem = [primitive(store, 'previous'), previousCid]
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

export function capabilityOfTarget(store: FosStore, target: string): Capability | null {
  if (!store.table.has(target)) return null
  return capabilityName(store, target) ?? advertisedRows(store, target).map(row => capabilityName(store, row[0])).find(Boolean) ?? null
}

/** A grant contains ordinary declaration rows, so each pattern stays on its row's left. */
export function advertisedRows(store: FosStore, cid: string): FosPathElem[] {
  return content(store, cid).children.filter(edge => isRowEdge(store, edge) && isRefNode(store, content(store, edge[1])) && !!content(store, edge[1]).data.alias)
}
export function advertisement(store: FosStore, pattern: string, ref: string): string {
  return put(store, { data: { refAlternatives: true }, children: [[pattern, ref]] })
}

/** The capability a [CAPABILITY, x] edge grants (the `to` direction), or null for any other edge. */
export function capabilityOf(store: FosStore, edge: FosPathElem): Capability | null {
  if (edge[0] !== primitive(store, 'grants')) return null
  return capabilityOfTarget(store, edge[1])
}

/** The capability an [ACCEPTS, x] edge accepts from the member (the `from` direction), or null for any other edge. */
export function acceptsOf(store: FosStore, edge: FosPathElem): Capability | null {
  if (edge[0] !== primitive(store, 'accepts')) return null
  return capabilityOfTarget(store, edge[1])
}

/**
 * A member entry's identity on its node (the path step to it, and to the rows it holds): the content address of whom
 * it is for, so two peers that add the same member make the same entry. Opaque: nothing reads a peer out of it; what
 * an entry is, and for whom, is its member edge and its data (`memberEntryPeerAt`).
 */
/**
 * The identity of `peerId`'s offer of `capability` (a handler ref it advertises, `variant` telling apart two of the
 * same peer and capability): a content address, the same in every store, standing for nothing it is parsed from.
 */
export function handlerOfferId(peerId: string, capability: string, variant?: string): string {
  if (!isCurrentCid(capability)) throw new Error('An offer must address a capability node.')
  return hashContent({ data: { peerId: { content: peerId }, ...(variant ? { name: { content: variant } } : {}) }, children: [[capability, capability]] })
}
/** The identity of `peerId`'s offer of the template `templateId` (published as a handler). */
export const publishedTemplateId = (peerId: string, templateId: string): string =>
  hashContent({ data: { peerId: { content: peerId }, ref: { id: templateId } }, children: [] })

/** The peer the membership at `path` is for, when its last step is a membership row of its parent; else null. */
export function memberEntryPeerAt(store: FosStore, root: string | null, path: Scope): string | null {
  if (!path.length) return null
  const parent = resolveScope(store, root, path.slice(0, -1))
  if (!parent) return null
  const id = path.at(-1)
  const edge = memberEdgesOf(store, parent).find(e => content(store, e[1]).data.alias?.id === id)
  return edge ? memberPeerOf(store, edge) : null
}
/** Whether `path` goes into a member entry (one of its steps is one). */
export function inMemberEntry(store: FosStore, root: string | null, path: Scope): boolean {
  return path.some((_, i) => memberEntryPeerAt(store, root, path.slice(0, i + 1)) !== null)
}

/** The node whose memberships the node `cid` has: itself, through a selected branch. */
export function memberHolderCid(store: FosStore, cid: string): string {
  const node = content(store, cid)
  const edge = isBranchChoice(store, node) ? branchEdge(store, cid) : null
  return edge ? memberHolderCid(store, identityCid(store, edge)) : cid
}
/** The content a node's memberships are rows of: a link's value, else the node itself. */
function memberHolder(store: FosStore, value: FosNodeContent): FosNodeContent {
  if (isBranchChoice(store, value)) { const edge = withMainBranchPolicy(store, () => branchEdge(store, put(store, value))); if (edge) return memberHolder(store, content(store, identityCid(store, edge))) }
  const target = !isHandle(value) && isRefNode(store, value) ? refValueCid(store, value) : null
  if (!target || !store.table.has(target)) return value
  // a membership written on the ref itself (while it held nothing) stays a membership once it holds a value
  const own = value.children.filter(edge => isMemberEdge(store, edge)), held = content(store, target)
  return own.length ? { ...held, children: [...own, ...held.children] } : held
}
/** `peerId`'s membership row in `value` (a node, or a link to one), if it has one. */
export function membershipOf(store: FosStore, value: FosNodeContent, peerId: string): FosPathElem | undefined {
  return memberEdgesOfContent(store, value).find(e => memberPeerOf(store, e) === peerId)
}
/** `value` with `peerId`'s membership right replaced by `f` of it (unchanged when it has none). */
export function mapMembership(store: FosStore, value: FosNodeContent, peerId: string, f: (right: FosNodeContent) => FosNodeContent): FosNodeContent {
  const holder = memberHolder(store, value)
  if (!holder.children.some(e => isMemberEdge(store, e) && memberPeerOf(store, e) === peerId)) return value
  return withMemberHolder(store, value, { ...holder, children: holder.children.map((e): FosPathElem => isMemberEdge(store, e) && memberPeerOf(store, e) === peerId ? [e[0], put(store, f(content(store, e[1])))] : e) })
}
/** `value` with `peerId`'s membership row set to `right` (a membership's right, from node exchange), replacing its earlier one. */
export function withMembershipRow(store: FosStore, value: FosNodeContent, peerId: string, right: string): FosNodeContent {
  const holder = memberHolder(store, value)
  return withMemberHolder(store, value, { ...holder, children: [...holder.children.filter(e => !(isMemberEdge(store, e) && memberPeerOf(store, e) === peerId)), [peerNode(store, peerId), right]] })
}
/** `value` with exactly these membership rows (the rest of its content kept). */
export function withMembershipRows(store: FosStore, value: FosNodeContent, rows: FosPathElem[]): FosNodeContent {
  const holder = memberHolder(store, value)
  return withMemberHolder(store, value, { ...holder, children: [...holder.children.filter(e => !isMemberEdge(store, e)), ...rows] })
}
/** `value` (a node, or a link to one) with its content replaced by `holder` (where its memberships are rows). */
function withMemberHolder(store: FosStore, value: FosNodeContent, holder: FosNodeContent): FosNodeContent {
  const pointer = primitive(store, 'target')
  const target = !isHandle(value) && isRefNode(store, value) ? refValueCid(store, value) : null
  if (!target || !store.table.has(target)) return holder
  // the holder now carries every membership, the ref's own included: none stays behind on the ref to outlive a removal
  return { ...value, children: value.children.filter(edge => !isMemberEdge(store, edge)).map(([key, cid]): FosPathElem => key === pointer ? [key, put(store, holder)] : [key, cid]) }
}

/** The memberships of `value` (a node, or a link to one). */
export function memberEdgesOfContent(store: FosStore, value: FosNodeContent): FosPathElem[] {
  return memberHolder(store, value).children.filter((e) => isMemberEdge(store, e))
}
/** The memberships of the node `cid`: its rows whose left is a peer. */
export function memberEdgesOf(store: FosStore, cid: string): FosPathElem[] {
  return memberEdgesOfContent(store, content(store, memberHolderCid(store, cid)))
}
/** The id of `peerId`'s membership row at the node `cid`, if it has one. */
export function membershipIdOf(store: FosStore, cid: string, peerId: string): string | null {
  const edge = memberEdgesOf(store, cid).find(e => memberPeerOf(store, e) === peerId)
  return edge ? content(store, edge[1]).data.alias?.id ?? null : null
}
/** The path of `peerId`'s membership row at the node `at`, if it has one. */
export function membershipPath(store: FosStore, root: string | null, at: Scope, peerId: string): Scope | null {
  const cid = resolveScope(store, root, at), id = cid && membershipIdOf(store, cid, peerId)
  return id ? [...at, id] : null
}

/**
 * A member entry's grant or offer: `[CAPABILITY, x]` (the `to` direction) or `[ACCEPTS, x]` (the `from` direction),
 * where `x` is a capability constructor or a typed handler ref. Immutable: a change is a new edge.
 */
export function isGrantEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === primitive(store, 'grants') || edge[0] === primitive(store, 'accepts')
}

/**
 * How node exchange names a grant edge among its entry's children: its direction and what it is (a handler's alias,
 * a built-in capability's name, else the target's cid). Never an alias of a row, so a path never steps into one.
 */
export function grantChildId(store: FosStore, edge: FosPathElem): string {
  const direction = edge[0] === primitive(store, 'accepts') ? 'from' : 'to'
  const target = content(store, edge[1])
  const row = advertisedRows(store, edge[1])[0]
  return `${direction}:${(row && content(store, row[1]).data.alias?.id) ?? target.data.alias?.id ?? capabilityOfTarget(store, edge[1]) ?? edge[1]}`
}

/** A membership's right: what the node keeps for `peerId` (its grants and offers for now), under the row id `id`. */
export function memberRefContent(store: FosStore, peerId: string, name: string | null, capabilities: Capability[], disabled: Capability[] = [], accepts: Capability[] = [], id: string = newId(), at: Scope = []): FosNodeContent {
  const unique = [...new Set(capabilities)]
  const from = [...new Set(accepts)]
  const off = [...new Set(disabled)].filter((c) => unique.includes(c) || from.includes(c))
  return {
    data: {
      alias: { id },
      ...(name ? { name: { content: name } } : {}),
      ...(off.length ? { disabledCapabilities: { content: off } } : {})
    },
    children: [
      ...unique.map((c): FosPathElem => [primitive(store, 'grants'), store.table.has(c) ? c : libAt(store, at).capabilities[c]!]),
      ...from.map((c): FosPathElem => {
        const pattern = store.table.has(c) ? c : libAt(store, at).capabilities[c]!
        const id = handlerOfferId(peerId, pattern)
        const value = put(store, { data: { peerId: { content: peerId }, description: { content: c }, behavior: { content: id } }, children: [...content(store, pattern).children, tag(store, pattern)] })
        const ref = put(store, refNodeContent(store, { alias: { id }, name: { content: c } }, value))
        return [primitive(store, 'accepts'), advertisement(store, pattern, ref)]
      })
    ]
  }
}

export function readMembers(store: FosStore, value: FosNodeContent): MemberRecord[] {
  const out: MemberRecord[] = []
  for (const edge of memberHolder(store, value).children) {
    if (!isMemberEdge(store, edge)) continue
    const ref = content(store, edge[1])
    const peerId = memberPeerOf(store, edge)
    if (out.some(m => m.peerId === peerId)) continue
    const caps = [...new Set(ref.children.map((e) => capabilityOf(store, e)).filter((c): c is Capability => c !== null))]
    const accepts = [...new Set(ref.children.map((e) => acceptsOf(store, e)).filter((c): c is Capability => c !== null))]
    const off = (ref.data.disabledCapabilities?.content ?? []).filter((c): c is Capability => caps.includes(c) || accepts.includes(c))
    out.push({ peerId, name: ref.data.name?.content ?? null, capabilities: caps, ...(off.length ? { disabled: off } : {}), ...(accepts.length ? { accepts } : {}) })
  }
  return out
}

/** Handler advertisements are ordinary typed refs in either member direction. */
export function memberHandlers(store: FosStore, value: FosNodeContent, peerId: string, direction?: string): string[] {
  return memberHandlerRows(store, value, peerId, direction).map(row => row[1])
}
export function memberHandlerRows(store: FosStore, value: FosNodeContent, peerId: string, direction?: string): FosPathElem[] {
  const member = memberHolder(store, value).children.find((e) => isMemberEdge(store, e) && memberPeerOf(store, e) === peerId)
  return member ? content(store, member[1]).children.filter((e) => (!direction || e[0] === direction) && isGrantEdge(store, e)).flatMap(e => advertisedRows(store, e[1])) : []
}

/** Add or replace the member entry for `peerId`. */
export function withMember(store: FosStore, value: FosNodeContent, peerId: string, name: string | null, capabilities: Capability[], disabled: Capability[] = [], accepts: Capability[] = [], at: Scope = []): FosNodeContent {
  const holder = memberHolder(store, value)
  // Connection arguments and child rows belong to this constructor, not its capability list.
  const previous = holder.children.find(edge => isMemberEdge(store, edge) && memberPeerOf(store, edge) === peerId)
  const next = memberRefContent(store, peerId, name, capabilities, disabled, accepts, previous ? content(store, previous[1]).data.alias?.id : undefined, at)
  if (previous) {
    const old = content(store, previous[1])
    next.children.push(...old.children.filter(edge =>
      (edge[0] !== primitive(store, 'grants') && edge[0] !== primitive(store, 'accepts')) ||
      (advertisedRows(store, edge[1]).length > 0 && !capabilityOfTarget(store, edge[1]))))
    // Built-in checkbox edits must not erase custom handler overrides.
    const custom = (old.data.disabledCapabilities?.content ?? []).filter(id => !capabilityNames(store, at).includes(id as Capability))
    if (custom.length) next.data.disabledCapabilities = { content: [...new Set([...(next.data.disabledCapabilities?.content ?? []), ...custom])] }
  }
  next.children = next.children.flatMap((edge) => {
    const capability = capabilityOf(store, edge) ?? acceptsOf(store, edge)
    const declared = advertisedRows(store, edge[1]).map(([pattern]) => pattern)
    if (!declared.length && capability) declared.push(edge[1])
    const matching = declared.length ? memberHandlerRows(store, value, peerId, edge[0]).filter(([pattern]) => declared.some(type => sameCapabilityType(store, pattern, type))) : []
    return matching.length ? matching.map(([pattern, cid]): FosPathElem => [edge[0], advertisement(store, pattern, cid)]) : [edge]
  })
  const refCid = put(store, next)
  const children = holder.children.filter((e) => !(isMemberEdge(store, e) && memberPeerOf(store, e) === peerId))
  return withMemberHolder(store, value, { ...holder, children: [...children, [peerNode(store, peerId), refCid]] })
}

/** Does the owner of this node accept `capability` from `peerId` (an ACCEPTS edge on its member reference)? */
export function acceptsFrom(store: FosStore, value: FosNodeContent, peerId: string, capability: Capability): boolean {
  return readMembers(store, value).some((m) => m.peerId === peerId && (m.accepts ?? []).includes(capability) && !m.disabled?.includes(capability))
}

/** Drop the member entry for `peerId` (and so every capability it was granted). */
export function withoutMember(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const holder = memberHolder(store, value)
  return withMemberHolder(store, value, { ...holder, children: holder.children.filter((e) => !(isMemberEdge(store, e) && memberPeerOf(store, e) === peerId)) })
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

/**
 * A submission: a candidate value for a mutable ref, with the value it was based on and who sent it, as rows of the
 * language's own submission constructors. `name` is the branch it carries (a peer may send one per branch; its main
 * one has none): a label, never read for what the submission is. A rejected one says so in its data.
 */
export function proposalContent(store: FosStore, peerId: string, name: string, contentCid: string, baseCid: string, timestamp: number, status: 'open' | 'rejected' = 'open'): FosNodeContent {
  const children: FosPathElem[] = [
    [primitive(store, 'sender'), put(store, { data: { peerId: { content: peerId } }, children: [] })],
    [primitive(store, 'proposed'), contentCid],
    [primitive(store, 'previous'), baseCid]
  ]
  if (name) children.push([primitive(store, 'proposalName'), textNode(store, name)])
  return { data: { updated: { time: timestamp }, ...(status === 'rejected' ? { proposal: { status } } : {}) }, children }
}

/**
 * Whether a submission is a candidate whole value for a ref (a binding: a handler's answer, a pattern's or solve's
 * option) rather than changed content of a node: its base is the ref node it was made against, which content never is.
 */
export function isValueSubmission(store: FosStore, proposal: Pick<ProposalRecord, 'baseCid'>): boolean {
  return store.table.has(proposal.baseCid) && isRefNode(store, content(store, proposal.baseCid))
}
export function readProposal(store: FosStore, cid: string): ProposalRecord | null {
  if (!store.table.has(cid)) return null
  const value = content(store, cid)
  let peerId = '', name = '', contentCid = '', baseCid = ''
  for (const [instr, target] of value.children) {
    if (instr === primitive(store, 'proposalName')) name = content(store, target).data.description?.content ?? ''
    else if (instr === primitive(store, 'proposed')) contentCid = target
    else if (instr === primitive(store, 'sender')) peerId = content(store, target).data.peerId?.content ?? ''
    else if (instr === primitive(store, 'previous')) baseCid = target
  }
  if (!peerId || !contentCid || !baseCid) return null
  return { cid, peerId, name, status: value.data.proposal?.status === 'rejected' ? 'rejected' : 'open', contentCid, baseCid, timestamp: value.data.updated?.time ?? 0 }
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
  if (proposalCid) children.push([primitive(store, 'proposal'), proposalCid])
  return { ...value, children }
}

export function removeProposalByCid(store: FosStore, value: FosNodeContent, proposalCid: string): FosNodeContent {
  return { ...value, children: value.children.filter((e) => !(isProposalEdge(store, e) && e[1] === proposalCid)) }
}

/** New version of a link node: a ref node pointing at `strippedContent`, keeping members/proposals/peers, PREV → the version it replaces. */
export function relinkContent(store: FosStore, previous: FosNodeContent, previousCid: string, strippedContent: FosNodeContent, now: number): FosNodeContent {
  // bookkeeping stays with the identity, and so do the identity's own rows (a requirement's @user field)
  const bookkeeping = previous.children.filter((e) => (isBookkeepingEdge(store, e) && !isPrevEdge(store, e)) || isMemberEdge(store, e) || isRowEdge(store, e))
  const data: FosNodeContent['data'] = { alias: previous.data.alias ?? strippedContent.data.alias ?? { id: newId() }, updated: { time: now } }
  if (previous.data.ref) data.ref = previous.data.ref
  if (previous.data.name) data.name = previous.data.name
  // a declaration's own text (a requirement's title) stays with the identity, whatever value it is bound to
  if (previous.data.description) data.description = previous.data.description
  if (previous.data.primitiveDefaults) data.primitiveDefaults = previous.data.primitiveDefaults
  const branches = refBranches(store, previous)
  const active = branches && branchEdge(store, branches.cid)
  const value = put(store, strippedContent)
  const target = branches && active ? updateBranch(store, branches.cid, [value, active[1]]) : value
  const next = refNodeContent(store, data, target, bookkeeping)
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

/** Resolve a direct child by mutable alias, or an immutable row by its CID.
 * A CID only addresses an existing child here; it is never a store-wide lookup. */
export function findChild(store: FosStore, nodeCid: string, aliasId: string): string | null {
  // a branched row's bookkeeping (its member entries) is on the selected branch's node
  const branch = isBranchChoice(store, content(store, nodeCid)) ? branchEdge(store, nodeCid) : null
  const found = findAliasEdge(store, valueContent(store, nodeCid), aliasId) ?? findAliasEdge(store, content(store, nodeCid), aliasId) ??
    (branch ? findAliasEdge(store, content(store, identityCid(store, branch)), aliasId) : null)
  if (!found) {
    const edge = valueContent(store, nodeCid).children.find(e => isRowEdge(store, e) && identityCid(store, e) === aliasId && !content(store, aliasId).data.alias)
    return edge ? identityCid(store, edge) : null
  }
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
  for (const edge of memberEdgesOf(store, rootCid)) {
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
  const ids = new Map<string, string>(), doneField = instantiate ? rowVocabulary(store)?.done : undefined, reopened = new Set<string>()
  const owned = new Set<string>()
  const argumentsToCopy = new Set<string>()
  const definitions = new Set<string>()
  // an execute row's node reduced to its request (the record field the copy keeps), or null when it has none
  const executeRequestOnly = (cid: string): string | null => {
    const node = content(store, cid), kept = node.children.filter(edge => content(store, edge[1]).data.name?.content === 'request')
    return kept.length ? put(store, { ...node, children: kept }) : null
  }
  const childEdges = (value: FosNodeContent, definition = false, root = false) => value.children.filter((edge) => {
    const type = rowTypeIdOf(store, edge)
    const name = content(store, identityCid(store, edge)).data.name?.content
    // an execute row holds what running the row left on it (state, not copied) and what it asks (its request, copied)
    if (isRowEdge(store, edge) && isExecuteLeft(store, edge[0])) return !!executeRequestOnly(identityCid(store, edge))
    // the template's own trigger makes instances; the trigger rows inside it are declarations its instances bind
    if (instantiate && root && isRowEdge(store, edge) && isTriggerLeft(store, edge[0])) return false
    // an instance is no type: what its template accepts (its pattern rows) stays with the template
    if (isRowEdge(store, edge)) return true
    if (isBookkeepingEdge(store, edge) || edge[0] === primitive(store, 'target') || edge[0] === primitive(store, 'instruction')) return false
    return true // Literal graph constraints must survive copying alongside owned rows.
  })
  const collect = (cid: string) => {
    if (owned.has(cid)) return
    const identity = content(store, cid)
    const id = aliasIdOf(identity)
    if (cid !== nodeCid && !id && !isRefNode(store, identity)) return
    owned.add(cid)
    if (id && !ids.has(id)) ids.set(id, cid === nodeCid && options.rootId ? options.rootId : freshId())
    if (isBranchChoice(store, identity)) {
      const choice = readChoice(store, cid)
      for (const edge of [choice.base, ...choice.options.flatMap(o => [o.edge, o.base])]) if (edge) collect(identityCid(store, edge))
      return
    }
    // A row's argument refers to its value; it does not take ownership of it.
    if (isRefNode(store, identity) && (argumentsToCopy.has(cid) || !refValueCid(store, identity) || refBranches(store, identity))) { argumentsToCopy.add(cid); return }
    for (const edge of childEdges(stripLink(store, identity), definitions.has(cid), cid === nodeCid)) {
      const child = identityCid(store, edge)
      const left = content(store, edge[0])
      if (isRefNode(store, content(store, child)) && (!rowTypeIdOf(store, edge) || left.data.capabilityDefinition)) argumentsToCopy.add(child)
      // Nested templates remain definitions when their containing workflow is instantiated.
      if (rowTypeIdOf(store, edge) === TEMPLATE_TYPE) definitions.add(child)
      // a field stays a ref of its own, whose id is its row's: it follows the row's new id
      if (id && isFieldRow(store, id, edge)) {
        argumentsToCopy.add(child)
        ids.set(aliasIdOf(content(store, child))!, fieldRefId(ids.get(id)!, edge[0]))
        if (edge[0] === doneField) reopened.add(child)
      }
      collect(child)
    }
  }
  collect(nodeCid)
  const copied = new Map<string, string>()
  // A row made from a template copied along is pinned to the copy; templates outside stay pinned as they are.
  const ownedValues = new Map([...owned].map((cid) => [valueCidOf(store, cid), cid]))
  const copyEdge = (edge: FosPathElem): FosPathElem => {
    if (!owned.has(identityCid(store, edge))) return edge
    if (isRowEdge(store, edge) && isExecuteLeft(store, edge[0])) return [edge[0], copy(executeRequestOnly(identityCid(store, edge))!)]
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
    const type = argumentsToCopy.has(cid)
    const value = type ? identity : stripLink(store, identity)
    const data = { ...value.data, alias: { id: ids.get(aliasIdOf(identity) ?? '') ?? freshId() }, updated: { time: now } }
    if (instantiate && data.query) data.query = { market: data.query.market }
    if (data.ref && !data.ref.owner) data.ref = { ...data.ref, id: ids.get(data.ref.id) ?? data.ref.id }
    if (data.allocation) data.allocation = { ...data.allocation, resource: ids.get(data.allocation.resource) ?? data.allocation.resource }
    // Typed arguments keep defaults, including ref-to-ref defaults. They get a fresh identity.
    const target = refValueCid(store, identity)
    const children = type ? [] : childEdges(value, definitions.has(cid), cid === nodeCid).map(copyEdge)
    if (!type && isHandle(identity) && target) children.push([primitive(store, 'target'), owned.has(target) ? copy(target) : target])
    let bound = reopened.has(cid) ? primitive(store, 'void') : target && owned.has(target) ? copy(target) : target
    const alternatives = type && refBranches(store, identity)
    if (alternatives) {
      const record = readChoice(store, alternatives.cid)
      const incoming = put(store, refNodeContent(store, { alias: data.alias, ...(data.name ? { name: data.name } : {}) }, null, []))
      const edge = (original: FosPathElem | null | undefined): FosPathElem | null => original ? [owned.has(original[0]) ? copy(original[0]) : original[0], incoming] : null
      bound = putBranches(store, data.alias.id, edge(record.base), record.options.map(option => ({ ...option, edge: edge(option.edge) })), record.defaultName)
    }
    const valueCopy = { data, children }
    const result = put(store, type ? refNodeContent(store, data, bound)
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
      children[parent.index] = withChildValue(store, parent.edge, { ...targetContent, children: kids }, targetContent.data.updated?.time ?? 0)
      return { ...value, children }
    }
    const sibling = findAliasEdge(store, value, position.relativeTo)
    if (!sibling) throw new Error('destination not found')
    children.splice(position.position === 'above' ? sibling.index : sibling.index + 1, 0, moving)
    return { ...value, children }
  }
  root = updateAtScope(store, root, toPath, insert)
  return root
}

/** Task titles a proposal adds, changes or removes compared with the main content it was based on (so work landing on main later never shows up as 'removed'). */
export function proposalView(store: FosStore, nodeValue: FosNodeContent, proposal: ProposalRecord): ProposalView {
  const current = store.table.has(proposal.baseCid) ? content(store, proposal.baseCid) : stripLink(store, nodeValue)
  const proposed = content(store, proposal.contentCid)
  const index = (value: FosNodeContent) => {
    const map = new Map<string, { title: string; cid: string }>()
    for (const edge of value.children) {
      if (isChoiceEdge(store, edge)) {
        const choice = readChoice(store, edge[1])
        for (const option of [choice.base, ...choice.options.map((o) => o.edge)]) {
          if (!option || !isRowEdge(store, option)) continue
          const id = identityCid(store, option)
          map.set(edgeKey(store, option), { title: rowTitle(store, id, null), cid: id })
        }
        continue
      }
      if (!isRowEdge(store, edge)) continue
      const id = identityCid(store, edge)
      map.set(edgeKey(store, edge), { title: rowTitle(store, id, null), cid: id })
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

/** One node a submission adds rows to: its path relative to the node the submission is on, and the added rows' ids. */
export type SubmissionAddition = { path: Scope; ids: string[] }

/**
 * The rows a submission adds, by identity: walking its proposed value against the value it was based on, only into
 * rows whose content differs, never into an added row (that row is one content-addressed subtree). Bounded.
 */
export function submissionAdditions(store: FosStore, baseCid: string, contentCid: string, limits = { nodes: 256, depth: 32 }): SubmissionAddition[] {
  const out: SubmissionAddition[] = []
  let visited = 0
  const rows = (cid: string) => {
    const map = new Map<string, string>()
    if (!store.table.has(cid)) return map
    for (const edge of valueContent(store, cid).children) {
      if (!isRowEdge(store, edge)) continue
      const identity = identityCid(store, edge), id = content(store, identity).data.alias?.id
      if (id && !map.has(id)) map.set(id, identity)
    }
    return map
  }
  const walk = (base: string, next: string, path: Scope) => {
    if (base === next || path.length > limits.depth || ++visited > limits.nodes) return
    const before = rows(base), ids: string[] = []
    for (const [id, cid] of rows(next)) {
      const was = before.get(id)
      if (!was) ids.push(id)
      else if (was !== cid && put(store, valueContent(store, was)) !== put(store, valueContent(store, cid))) walk(was, cid, [...path, id])
    }
    if (ids.length) out.unshift({ path, ids })
  }
  walk(baseCid, contentCid, [])
  return out.sort((a, b) => a.path.length - b.path.length)
}
