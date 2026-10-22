/**
 * The standard library: a mutable ref in the graph, `fos:library`, in every device root. Its value is the library's
 * content (its rows: named refs such as `lib:type:task`, templates, groups), and it changes like any ref's value: by
 * a submission being accepted. The first one is the build's: `.fos/library.json`, compiled by
 * scripts/compile-library.cjs, is the content a fresh device root's library ref accepts (`ensureDeviceLibrary`), offline
 * from the first run. Later values are what the ref's members agree on: they send each other submissions and approvals
 * through relay messaging (library-governance.ts). `fos . library export --local` writes the ref's current value back
 * as the build source.
 *
 * Like every mutable ref the library resolves by nearest ancestor, so a library linked in Home overrides the device
 * root's for everything under Home (`libraryPath`, `rowTypeAt` in graph.ts).
 */
import { addRow, applyProposalAt, createReplica, homePath, proposeRefAt, view, type Replica } from './replica'
import { readNodeValue, writeNodeValue } from './evaluation'
import { sharedProjection, type SharedAddress } from './sharing'
import { acceptProvidedNode, type NodeRequest, type ProvidedNode } from './node-provider'
import { LIBRARY_ID, content, ensureLibraryRow, importNodes, reachableNodes, findChild, findNearestRow, isHandle, isPeerReference, put, refValueCid, resolveScope, shippedLibrary, valueContent, type Scope } from './graph'
import type { FosNodesData } from '../types'
import { headCid } from './replica'
import { FOS_DATA_VERSION } from '../version'
import * as COMPILED_LIBRARY from './library.generated.json'
import { compileLibrary, type LibrarySource } from '../library-compiler'
import { isBookkeepingEdge, refNodeContent, valueCidOf } from './graph'
import { REF_TYPE } from './library-types'

/** The library row holding the manual fallback handlers (`manualHandlers`). */
export const MANUAL_HANDLERS_ID = 'lib:manual'
/** The library's version is the data version (shared/version.ts); the compiler refuses a library graph in another. */
export const LIBRARY_VERSION: string = FOS_DATA_VERSION
if (COMPILED_LIBRARY.version !== LIBRARY_VERSION) throw new Error(`shared/sync/library.generated.json is in version ${COMPILED_LIBRARY.version}, this build is ${LIBRARY_VERSION}: run node scripts/compile-library.cjs.`)
export const MERGE_POLICY_ARGUMENT = 'fos:merge-policy'
/** The submitter of the build's library: the content a build ships, submitted to the device's library ref. */
export const BUILD_PEER = 'fos:build'

export type LibraryAddress = SharedAddress & { title: string }
/** Proposals on the node merge on their own once this many distinct members approved them. */
export type MergePolicy = { approvals: number }
export const DEFAULT_MERGE_POLICY: MergePolicy = { approvals: 2 }

type Requirement = NonNullable<import('../types').FosDataContent['requirement']>
/**
 * A library as a submission: the content (`root`, null for none) and the nodes it needs, with the address of the
 * library it was taken from on a server (null when built without one).
 */
export type LibraryBundle = { address: LibraryAddress | null; version: string; root: string | null; nodes: FosNodesData }

/** What this build ships: the compiled `.fos/library.json`. */
export const BUNDLED_LIBRARY: LibraryBundle = { address: null, version: LIBRARY_VERSION, root: COMPILED_LIBRARY.rootNodeId, nodes: COMPILED_LIBRARY.nodes as unknown as FosNodesData }

/** Export the library ref's value at `at` as a build source, excluding history and access bookkeeping. */
export function exportLocalLibrary(r: Replica, at: Scope = [LIBRARY_ID]): LibrarySource {
  const cid = resolveScope(r.store, headCid(r), at)
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
 * The library a row at `at` sees, by nearest ancestor: the one linked in Home (once its content is here) under Home,
 * the root's shipped library elsewhere.
 */
export function libraryPath(r: Replica, at: Scope = homePath(r)): Scope | null {
  const found = findNearestRow(r.store, headCid(r), at, row => row.id === LIBRARY_ID && !isHandle(content(r.store, row.cid)) && !isPeerReference(content(r.store, row.cid)))
  return found ? [...found.path, found.id] : null
}

/** The manual (and device) fallback handlers the library at `at` carries, from its "Manual handlers" group. */
export function manualHandlers(r: Replica, at?: Scope): ManualHandler[] {
  const path = libraryPath(r, at)
  if (!path) return []
  return (view(r, [...path, MANUAL_HANDLERS_ID])?.tasks ?? []).flatMap(row => {
    const req = row.requirement
    if (!req || !row.title.trim()) return []
    return [{ id: row.id, label: row.title.trim(), capability: req.capability, ...(req.resource ? { resource: req.resource } : {}), device: row.id.startsWith('lib:device:') }]
  })
}

/** The library's fallbacks that fit one requirement: same capability and, for allocations, the same resource. */
export function manualHandlersFor(r: Replica, requirement: { capability: Requirement['capability']; resource?: Requirement['resource'] }, at?: Scope): ManualHandler[] {
  return manualHandlers(r, at).filter(h => h.capability === requirement.capability && (requirement.capability !== 'allocation' || h.resource === requirement.resource))
}

/**
 * Submit `bundle` to the library ref at `path` (a ref row; made at the device root when missing) and, when the ref has
 * no value yet, accept it: a fresh library takes the content it ships with. A ref that already has a value keeps it,
 * and the bundle stays an open submission, an option its members can take (library-governance.ts).
 */
export function submitLibrary(r: Replica, path: Scope, bundle: LibraryBundle, peerId: string, now: number): Replica {
  if (!bundle.root) return r
  importNodes(r.store, bundle.nodes)
  const ref = resolveScope(r.store, headCid(r), path)
  if (!ref) throw new Error('The library ref is not here.')
  const current = refValueCid(r.store, content(r.store, ref)) ? valueCidOf(r.store, ref) : null
  if (current === bundle.root) return r
  const submitted = proposeRefAt(r, path, bundle.root, peerId, now, `binding:${peerId}`)
  return current ? submitted.replica : applyProposalAt(submitted.replica, path, submitted.proposalCid, r.meta.peerId, now)
}

/** The library ref's value as a submission's content: what a server hands a client build, what members exchange. */
export function exportLibrary(r: Replica, path: Scope, address: LibraryAddress | null = null): LibraryBundle {
  const cid = resolveScope(r.store, headCid(r), path)
  const value = cid ? (refValueCid(r.store, content(r.store, cid)) ? valueCidOf(r.store, cid) : isPeerReference(content(r.store, cid)) ? null : cid) : null
  if (!value) return { address, version: LIBRARY_VERSION, root: null, nodes: {} }
  const root = canonical(r)(value)
  return { address, version: LIBRARY_VERSION, root, nodes: reachableNodes(r.store, [root]) }
}

/** The standard library at `path` (a server's library ref): the build's content when it has none. */
export function seedStandardLibrary(r: Replica, path: Scope, now: number): Replica {
  return submitLibrary(r, path, BUNDLED_LIBRARY, BUILD_PEER, now)
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

/** Where this account's Home links the shared library (people who contribute and vote add it), if it does. */
export function libraryLink(r: Replica): Scope | null {
  const home = homePath(r), cid = resolveScope(r.store, headCid(r), home)
  const link = cid && findChild(r.store, cid, LIBRARY_ID)
  return link && (content(r.store, link).data.ref?.owner || r.meta.sharedNodes?.[JSON.stringify([...home, LIBRARY_ID])]) ? [...home, LIBRARY_ID] : null
}

/**
 * The library a device root has: its library ref (`ensureLibraryRow`; a device root loaded from older data gets it
 * here), which takes `bundle` (the build's, by default) as its first value; a later build's library becomes an open
 * submission. Only device roots have one; other roots are nested in a device root (`nestScope`).
 */
export function ensureDeviceLibrary(r: Replica, bundle: LibraryBundle = BUNDLED_LIBRARY, now: number): Replica {
  const library = bundle.root ? bundle : BUNDLED_LIBRARY
  importNodes(r.store, library.nodes)
  if (!resolveScope(r.store, headCid(r), [LIBRARY_ID])) { ensureLibraryRow(r.store, library.root!); r = { ...r } }
  return submitLibrary(r, [LIBRARY_ID], library, BUILD_PEER, now)
}

/**
 * Add the shared library to this account's Home, to contribute and vote on it: a reference with the fos server as its
 * peer (the app keeps it current). Under Home it overrides the root's shipped library.
 */
export function ensureLibraryLink(r: Replica, address: LibraryAddress, now: number): { replica: Replica; path: Scope; added: boolean } {
  const existing = libraryLink(r)
  if (existing) return { replica: r, path: existing, added: false }
  const home = homePath(r)
  if (!view(r, home)) return { replica: r, path: home, added: false }
  r = addRow(r, home, REF_TYPE, address.title, now, { id: LIBRARY_ID, refOwner: address.owner, refId: address.path.at(-1) ?? LIBRARY_ID })
  const path = [...home, LIBRARY_ID]
  r = writeNodeValue(r, path, 'fos:shared-link', { owner: address.owner, path: address.path }, now)
  return { replica: r, path, added: true }
}

/** What the `fos` CLI pulled: the library's nodes, root first, each with the request that fetched it (node-provider protocol). */
export type PulledLibrary = { address: LibraryAddress; nodes: Array<{ request: NodeRequest; node: ProvidedNode }> }

/**
 * The bundle a client build carries, assembled from the nodes the `fos` CLI pulled through the account
 * (`fos library export`): the nodes are accepted into a scratch replica exactly as the app would accept them, then
 * exported as the library's content, so the build's copy is the live library at build time.
 */
export function exportProvidedLibrary(pulled: PulledLibrary, now: number): LibraryBundle {
  const root = pulled.nodes[0]
  if (!root) return { address: pulled.address, version: LIBRARY_VERSION, root: null, nodes: {} }
  const PULLED = 'fos:pulled-library'
  let r = addRow(createReplica('fos:cli'), [], REF_TYPE, pulled.address.title, now, { id: PULLED, refOwner: pulled.address.owner, refId: pulled.address.path.at(-1) ?? LIBRARY_ID })
  for (const { request, node } of pulled.nodes) r = acceptProvidedNode(r, [PULLED, ...request.path.slice(root.request.path.length)], request, node, now)
  return exportLibrary(r, [PULLED], pulled.address)
}

export function mergePolicy(r: Replica, path: Scope): MergePolicy | null {
  const value = readNodeValue<MergePolicy>(r, path, MERGE_POLICY_ARGUMENT)
  return value && Number.isInteger(value.approvals) && value.approvals > 0 ? value : null
}
export function setMergePolicy(r: Replica, path: Scope, policy: MergePolicy | null, now: number): Replica {
  return writeNodeValue(r, path, MERGE_POLICY_ARGUMENT, policy, now)
}

/**
 * The owner's standing decision: every open proposal on the node that enough members approved (the shared
 * projection's approval counts, which honour the audience's and each member's `approve` grant) is merged as the
 * owner. Votes are tied to the node's revision, so after a merge the remaining proposals wait for fresh approvals.
 */
export function applyMergePolicy(r: Replica, path: Scope, revision: (value: unknown) => string, now: number): { replica: Replica; merged: string[] } {
  const policy = mergePolicy(r, path)
  if (!policy) return { replica: r, merged: [] }
  const merged: string[] = []
  // one at a time: each merge changes the revision the remaining votes were cast against
  for (let round = 0; round < 100; round++) {
    const projection = sharedProjection(r, path, revision)
    const ready = projection.proposals.find(p => (projection.counts[p.id] ?? 0) >= policy.approvals)
    if (!ready) break
    const cid = ready.id.slice('proposal:'.length)
    r = applyProposalAt(r, path, cid, r.meta.peerId, now)
    merged.push(cid)
  }
  return { replica: r, merged }
}
