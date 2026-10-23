/**
 * The standard library: a mutable ref in the graph, a row of the Library type in every device root. Its value is the
 * library's content (its rows: named refs such as `lib.task`, templates, groups), and it changes like any ref's
 * value: by a submission being accepted (approvals.ts). The first one is the build's: `.fos/library.json`, compiled by
 * scripts/compile-library.cjs, is the content a fresh device root's library ref holds (`ensureDeviceLibrary`), offline
 * from the first run; a later build's is the fos peer's submission. A library shared across devices and accounts is a
 * ref like any other: published to its members, referenced in theirs, changed by their submissions under its merge
 * rule. `fos . library export` writes the value a store sees back as the build source.
 *
 * Like every mutable ref the library resolves by nearest ancestor, so a library referenced in Home overrides the device
 * root's for everything under Home (`libraryPath`, `rowTypeAt` in graph.ts).
 */
import { homePath, proposeRefAt, view, type Replica } from './replica'
import { commitRoot, content, ensureLibraryRow, importNodes, reachableNodes, findNearestRow, isLibraryDefinition, isPeerReference, libraryInstanceEdge, libraryInstanceOf, libraryRowOf, updateAtScope, put, refValueCid, resolveScope, valueContent, SERVER_MEMBER, type Scope } from './graph'
import type { FosNodesData } from '../types'
import { headCid } from './replica'
import { FOS_DATA_VERSION } from '../version'
import * as COMPILED_LIBRARY from './library.generated.json'
import { compileLibrary, type LibrarySource } from '../library-compiler'
import { fieldNode } from '../library-names'
import { plainEdge } from './patterns'
import { isBookkeepingEdge, refNodeContent, valueCidOf } from './graph'

/** The library's field holding the manual fallback handlers (`manualHandlers`). */
export const MANUAL_HANDLERS = 'manual'
/** The library's version is the data version (shared/version.ts); the compiler refuses a library graph in another. */
export const LIBRARY_VERSION: string = FOS_DATA_VERSION
if (COMPILED_LIBRARY.version !== LIBRARY_VERSION) throw new Error(`shared/sync/library.generated.json is in version ${COMPILED_LIBRARY.version}, this build is ${LIBRARY_VERSION}: run node scripts/compile-library.cjs.`)
type Requirement = NonNullable<import('../types').FosDataContent['requirement']>
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

/** A fallback the library offers for a kind of requirement: the row's text is the button, its requirement the kind it fills. */
export type ManualHandler = { id: string; label: string; capability: Requirement['capability']; resource?: Requirement['resource']; device: boolean }

/**
 * The library definition a row at `at` sees, by nearest ancestor: one referenced in Home (once its content is here)
 * under Home, the device root's elsewhere. Rows are made from the version its instance pins (`lib`, graph.ts).
 */
export function libraryPath(r: Replica, at: Scope = homePath(r)): Scope | null {
  const found = findNearestRow(r.store, headCid(r), at, row => isLibraryDefinition(r.store, content(r.store, row.cid)))
  return found ? [...found.path, found.id] : null
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

/** The path of the row that is the field `field` of the library at `at` (a template, a group), if it has one. */
export function libraryFieldPath(r: Replica, field: string, at?: Scope): Scope | null {
  const path = libraryPath(r, at), cid = path && resolveScope(r.store, headCid(r), path)
  if (!path || !cid) return null
  const target = r.store.primitive.targetPointerConstructor.getId(), alias = r.store.primitive.aliasConstructor.getId()
  const edge = valueContent(r.store, cid).children.find(e => fieldNode(id => r.store.table.get(id), e as [string, string], target, alias)?.name === field)
  const id = edge && content(r.store, edge[1]).data.alias?.id
  return id ? [...path, id] : null
}

/** The manual (and device) fallback handlers the library at `at` carries: the rows of its `manual` field. */
export function manualHandlers(r: Replica, at?: Scope): ManualHandler[] {
  const path = libraryFieldPath(r, MANUAL_HANDLERS, at)
  if (!path) return []
  return (view(r, path)?.tasks ?? []).flatMap(row => {
    const req = row.requirement
    if (!req || !row.title.trim()) return []
    const cid = resolveScope(r.store, headCid(r), [...path, row.id])
    const device = !!cid && content(r.store, cid).data.name?.content === 'deviceLocation'
    return [{ id: row.id, label: row.title.trim(), capability: req.capability, ...(req.resource ? { resource: req.resource } : {}), device }]
  })
}

/** The library's fallbacks that fit one requirement: same capability and, for allocations, the same resource. */
export function manualHandlersFor(r: Replica, requirement: { capability: Requirement['capability']; resource?: Requirement['resource'] }, at?: Scope): ManualHandler[] {
  return manualHandlers(r, at).filter(h => h.capability === requirement.capability && (requirement.capability !== 'allocation' || h.resource === requirement.resource))
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
  const target = r.store.primitive.targetPointerConstructor.getId(), alias = r.store.primitive.aliasConstructor.getId()
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
