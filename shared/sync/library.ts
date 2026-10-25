/** Library definitions are editable values. Runtime consumers must use explicitly pinned instances. */
import { primitive } from './primitives'
import type { ResourceType } from './graph'
import { homePath, proposeRefAt, view, type Replica } from './replica'
import { commitRoot, content, ensureLibraryRow, importNodes, reachableNodes, enclosingScopes, nearestInScope, libraryBindingAt, libraryTypeAt, viewNode, isLibraryDefinition, isPeerReference, libraryInstanceEdge, libraryInstanceOf, libraryRowOf, updateAtScope, put, refValueCid, resolveScope, valueContent, SERVER_MEMBER, type Scope } from './graph'
import type { FosNodeContent, FosNodesData } from '../types'
import { headCid } from './replica'
import { FOS_DATA_VERSION } from '../version'
import * as COMPILED_LIBRARY from './library.generated.json'
import { compileLibrary, type LibrarySource } from '../library-compiler'
import { fieldNode } from '../library-names'
import { plainEdge } from './patterns'
import { bookkeepingOf, isBookkeepingEdge, namesInLibrary, refNodeContent, valueCidOf } from './graph'
import { hashContent } from '../dag-implementation/cid'

/** The library field holding manual fallback handlers. */
export const MANUAL_HANDLERS = 'manual'
/** The library's version is the data version (shared/version.ts); the compiler refuses a library graph in another. */
export const LIBRARY_VERSION: string = FOS_DATA_VERSION
if (COMPILED_LIBRARY.version !== LIBRARY_VERSION) throw new Error(`shared/sync/library.generated.json is in version ${COMPILED_LIBRARY.version}, this build is ${LIBRARY_VERSION}: run node scripts/compile-library.cjs.`)
/** A library as a submission's content: its root (null for none) and the nodes it needs. */
export type LibraryBundle = { version: string; root: string | null; nodes: FosNodesData }

/** What this build ships: the compiled `.fos/library.json`. */
export const BUNDLED_LIBRARY: LibraryBundle = { version: LIBRARY_VERSION, root: COMPILED_LIBRARY.rootNodeId, nodes: COMPILED_LIBRARY.nodes as unknown as FosNodesData }

/** Export the value of the library ref at `at` (the one Home sees, by default) as a build source, without history and access bookkeeping. */
export function exportLocalLibrary(r: Replica, at: Scope | null = libraryPath(r)): LibrarySource {
  const cid = at && resolveScope(r.store, headCid(r), at)
  if (!cid) throw new Error('Local library not found.')
  const memo = new Map<string, string>()
  const copy = (cid: string): string => {
    if (memo.has(cid)) return memo.get(cid)!
    const node = content(r.store, cid)
    const clean = put(r.store, { data: node.data, children: node.children.filter(edge => !isBookkeepingEdge(r.store, edge)).map(([i, t]) => [copy(i), copy(t)]) })
    memo.set(cid, clean); return clean
  }
  const rootNodeId = copy(put(r.store, valueContent(r.store, cid)))
  const source = { version: LIBRARY_VERSION, rootNodeId, nodes: reachableNodes(r.store, [rootNodeId]) }
  const checked = compileLibrary(source)
  return { version: checked.version, rootNodeId: checked.rootNodeId, nodes: checked.nodes }
}

/**
 * A fallback the library offers for a kind of requirement: the row's text is the button, its requirement the kind it
 * fills. `native`: a native the device passed the library (`setLibraryArg`), which does it; else the person does it.
 */
export type ManualHandler = { id: string; label: string; capability?: string; resource?: ResourceType; device: boolean; native?: string }

/**
 * The library definition a row at `at` sees, by nearest ancestor: one referenced in Home (once its content is here)
 * under Home, the device root's elsewhere. Rows are made from the version its instance pins (`lib`, graph.ts).
 */
export function libraryPath(r: Replica, at: Scope = homePath(r)): Scope | null {
  // This is the editable definition, not runtime field resolution; it follows the same scope rule.
  const found = nearestInScope(enclosingScopes(r.store, headCid(r), at), scope => valueContent(scope.store, scope.cid).children.flatMap(([, right]) => {
    const node = scope.store.table.get(right)
    return node?.data.alias && isLibraryDefinition(scope.store, node) ? [node.data.alias.id] : []
  }), 'library definition')
  return found && found.store === r.store ? [...found.path, found.value] : null
}

/** Use the library defined at `definition` under the node at `at`: its instance there, pinned to the definition's current value. */
export function useLibrary(r: Replica, at: Scope, definition: Scope, now: number): Replica {
  const def = resolveScope(r.store, headCid(r), definition), node = resolveScope(r.store, headCid(r), at)
  if (!def || !node || !isLibraryDefinition(r.store, content(r.store, def))) throw new Error('That is no library.')
  if (libraryInstanceOf(r.store, node)) return upgradeLibrary(r, at, definition, now)
  const edge = libraryInstanceEdge(r.store, valueCidOf(r.store, def))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, value => ({ ...value, children: [...value.children, edge] })), now)
  return { ...r }
}

/**
 * Upgrade the library instance of the node at `at` to the current value of the definition at `definition`: its left
 * moves to that version, what it passes in stays. Rows made before keep the version they were made from.
 */
export function upgradeLibrary(r: Replica, at: Scope, definition: Scope, now: number): Replica {
  const def = resolveScope(r.store, headCid(r), definition), node = resolveScope(r.store, headCid(r), at)
  const instance = node && libraryInstanceOf(r.store, node)
  if (!def || !instance) throw new Error('There is no library here to upgrade.')
  const next = valueCidOf(r.store, def)
  if (next === instance.library) return r
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, value => ({ ...value, children: value.children.map(edge => plainEdge(r.store, edge)[1] === instance.cid ? [next, instance.cid] : edge) })), now)
  return { ...r }
}

/** The library's field declaring what it needs passed in by the device that uses it (its natives). */
export const LIBRARY_REQUIRES = 'requires'

/**
 * Pass `value` (a native this device registered, `nativeRef`) into the library instance of the node at `at` as its
 * argument `name`: what the library's `requires.<name>` declares. The library never calls a native itself; it uses
 * what it was passed.
 */
export function setLibraryArg(r: Replica, at: Scope, name: string, value: string, now: number): Replica {
  const store = r.store, node = resolveScope(store, headCid(r), at), instance = node && libraryInstanceOf(store, node)
  if (!instance) throw new Error('There is no library here.')
  const left = namesInLibrary(store, instance.library).byName.get(`${LIBRARY_REQUIRES}.${name}`)
  if (!left) throw new Error(`The library requires no ${name}.`)
  const ref = content(store, instance.cid), args = content(store, refValueCid(store, ref) ?? put(store, { data: {}, children: [] }))
  const existing = args.children.find(([type]) => type === left)
  if (existing && refValueCid(store, content(store, existing[1])) === value) return r
  const arg = put(store, refNodeContent(store, { alias: { id: hashContent({ data: { name: { content: name } }, children: [] }) }, name: { content: name } }, value))
  const nextArgs = put(store, { ...args, children: [...args.children.filter(edge => edge !== existing), [left, arg]] })
  const nextRef = put(store, refNodeContent(store, ref.data, nextArgs, bookkeepingOf(store, ref)))
  commitRoot(store, updateAtScope(store, headCid(r), at, value => ({ ...value, children: value.children.map(edge => plainEdge(store, edge)[1] === instance.cid ? [instance.library, nextRef] : edge) })), now)
  return { ...r }
}

/**
 * What the nearest library instance at `at` was passed for its `requires` declarations: each declaration (its name
 * and node) with the native the device passed, when it passed one.
 */
export function libraryArgs(r: Replica, at: Scope): Array<{ name: string; declaration: FosNodeContent; value: string }> {
  const instance = libraryBindingAt(r.store, at)
  if (!instance) return []
  const store = r.store
  const target = primitive(store, 'target'), alias = primitive(store, 'alias'), get = (id: string) => store.table.get(id)
  const group = namesInLibrary(store, instance.library).byName.get(LIBRARY_REQUIRES)
  const args = refValueCid(store, content(store, instance.cid))
  if (!group || !args) return []
  return content(store, group).children.flatMap(edge => {
    const declared = fieldNode(get, edge as [string, string], target, alias)
    if (!declared) return []
    const passed = content(store, args).children.find(([left]) => left === declared.node)
    const value = passed && refValueCid(store, content(store, passed[1]))
    return value ? [{ name: declared.name, declaration: content(store, edge[1]), value }] : []
  })
}

/** The path of the row that is the field `field` of the library at `at` (a template, a group), if it has one. */
export function libraryFieldPath(r: Replica, field: string, at?: Scope): Scope | null {
  const path = libraryPath(r, at), cid = path && resolveScope(r.store, headCid(r), path)
  if (!path || !cid) return null
  const target = primitive(r.store, 'target'), alias = primitive(r.store, 'alias')
  const edge = valueContent(r.store, cid).children.find(e => fieldNode(id => r.store.table.get(id), e as [string, string], target, alias)?.name === field)
  const id = edge && content(r.store, edge[1]).data.alias?.id
  return id ? [...path, id] : null
}

/** The manual (and device) fallback handlers the library at `at` carries: the rows of its `manual` field. */
export function manualHandlers(r: Replica, at?: Scope): ManualHandler[] {
  const field = libraryTypeAt(r.store, MANUAL_HANDLERS, at ?? homePath(r))
  if (!field) return []
  return viewNode(r.store, field).tasks.flatMap(row => {
    const req = row.requirement
    if (!req || !row.title.trim()) return []
    return [{ id: row.id, label: row.title.trim(), ...(req.capability ? { capability: req.capability } : {}), ...(req.resource ? { resource: req.resource } : {}), device: false }]
  })
}

/** The device's fallbacks: the natives it passed the library for what the library requires, each filling the requirement it declares. */
export function deviceHandlers(r: Replica, at?: Scope): ManualHandler[] {
  return libraryArgs(r, at ?? homePath(r)).flatMap(({ name, declaration, value }) => {
    const allocation = declaration.data.allocation
    if (!allocation) return []
    return [{ id: name, label: declaration.data.description?.content ?? name, capability: 'allocation' as const, resource: allocation.type, device: true, native: value }]
  })
}

/** The library's fallbacks that fit one requirement: same capability and, for allocations, the same resource. */
export function manualHandlersFor(r: Replica, requirement: { capability?: string | null; resource?: ResourceType }, at?: Scope): ManualHandler[] {
  return [...manualHandlers(r, at), ...deviceHandlers(r, at)].filter(h => h.capability === requirement.capability && (requirement.capability !== 'allocation' || h.resource === requirement.resource))
}

/**
 * Submit `bundle` to the library ref at `path` as `peerId`: an open submission of that content (accepted like any,
 * `acceptSubmission`), unless the ref already holds it.
 */
export function submitLibrary(r: Replica, path: Scope, bundle: LibraryBundle, peerId: string, now: number): Replica {
  if (!bundle.root) return r
  importNodes(r.store, bundle.nodes)
  const ref = resolveScope(r.store, headCid(r), path)
  if (!ref) throw new Error('The library ref is not here.')
  if (refValueCid(r.store, content(r.store, ref)) && valueCidOf(r.store, ref) === bundle.root) return r
  return proposeRefAt(r, path, bundle.root, peerId, now).replica
}

/** The library ref's value as a submission's content: what members exchange. */
export function exportLibrary(r: Replica, path: Scope): LibraryBundle {
  const cid = resolveScope(r.store, headCid(r), path)
  const value = cid ? (refValueCid(r.store, content(r.store, cid)) ? valueCidOf(r.store, cid) : isPeerReference(content(r.store, cid)) ? null : cid) : null
  if (!value) return { version: LIBRARY_VERSION, root: null, nodes: {} }
  const root = canonical(r)(value)
  return { version: LIBRARY_VERSION, root, nodes: reachableNodes(r.store, [root]) }
}

/**
 * Canonical copies of library nodes, memoized for one export: without bookkeeping (history, members, proposals) or
 * timestamps, and with row envelopes (a nameless ref around a row's value, as node exchange delivers rows) unwrapped,
 * so the library exports the same content however it arrived.
 */
function canonical(r: Replica): (cid: string) => string {
  const memo = new Map<string, string>()
  const target = primitive(r.store, 'target'), alias = primitive(r.store, 'alias')
  const copy = (cid: string): string => {
    if (memo.has(cid)) return memo.get(cid)!
    let node = content(r.store, cid)
    const pointer = node.children.find(([key]) => key === target)
    if (pointer && node.data.alias && !node.data.name) {
      const value = content(r.store, pointer[1])
      node = { data: { alias: node.data.alias, ...value.data }, children: value.children.filter(([key]) => key !== alias) }
    } else if (pointer && node.data.alias) {
      const { alias: own, ...valueData } = content(r.store, pointer[1]).data
      const value = put(r.store, { data: own?.id === node.data.alias.id ? valueData : content(r.store, pointer[1]).data, children: content(r.store, pointer[1]).children })
      node = refNodeContent(r.store, node.data, value, node.children.filter(([key]) => key !== target && key !== alias))
    }
    const { updated: _updated, created: _created, alias: id, ...rest } = node.data
    const data = id ? { alias: id, ...rest } : rest
    const clean = put(r.store, { data, children: node.children.filter(edge => !isBookkeepingEdge(r.store, edge)).map(([i, t]) => [copy(i), copy(t)]) })
    memo.set(cid, clean); return clean
  }
  return copy
}

/**
 * The library a device root has: its library ref (`ensureLibraryRow`), which takes `bundle` (the build's, by default)
 * as its first value; a later build's library is the fos peer's submission to it. Only device roots have one; other
 * roots are nested in a device root (`nestScope`).
 */
export function ensureDeviceLibrary(r: Replica, bundle: LibraryBundle = BUNDLED_LIBRARY, now: number): Replica {
  const library = bundle.root ? bundle : BUNDLED_LIBRARY
  importNodes(r.store, library.nodes)
  let row = libraryRowOf(r.store, headCid(r))
  if (!row) { ensureLibraryRow(r.store, library.root!); r = { ...r }; row = libraryRowOf(r.store, headCid(r))! }
  return submitLibrary(r, [row.id], library, SERVER_MEMBER, now)
}
