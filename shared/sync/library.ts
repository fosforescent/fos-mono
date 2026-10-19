/**
 * The standard library: one node, owned by a system account on the server, that every account reads and can
 * propose changes to. Its rows are templates (derived capabilities built from the basic row grammar: tasks,
 * requirements, allocations, choices) that work offline on every device once the node is pulled, because
 * instantiating a template is a local copy. It is shared with the `users` audience, which is an implicit group of
 * all signed-in accounts (`memberFor` in graph.ts), with read, edit (proposals), approve and rank; a merge policy on
 * the node lets the server merge a proposal once enough members approved it (`applyMergePolicy`).
 *
 * The library is a row in two places. Every device root ships one (`[device root, fos:library]`): a client carries the library in
 * its build (`fos library export` pulls the shared node through the account and `exportProvidedLibrary` turns it into
 * `web/src/library.json`) and seeds its device root's library from it (`ensureDeviceLibrary`), so templates and row types work
 * offline from the first run; it stays on the device. People who contribute and vote add the shared node to their
 * Home (`ensureLibraryLink`), with the fos server as its peer. Like every mutable ref the library resolves by nearest
 * ancestor, so under Home the linked library overrides the shipped one (`libraryPath`, `rowTemplate` in graph.ts).
 */
import { addRow, applyProposalAt, createReplica, homePath, view, type Replica } from './replica'
import { readNodeValue, writeNodeValue } from './evaluation'
import { sharedProjection, type SharedAddress } from './sharing'
import { acceptProvidedNode, type NodeRequest, type ProvidedNode } from './node-provider'
import { LIBRARY_ID, ROW_TYPES_ID, commitRoot, content, ensureLibraryRow, importNodes, reachableNodes, seedTypes, findChild, findNearestRow, isHandle, isPeerReference, put, resolveScope, rowEdgeAt, rowTypeContents, rowTypesContent, updateAtScope, valueContent, type Scope, type TaskView } from './graph'
import type { FosNodeContent, FosNodesData, FosPathElem } from '../types'
import { headCid } from './replica'

/** The library row holding the manual fallback handlers (`manualHandlers`). */
export const MANUAL_HANDLERS_ID = 'lib:manual'
/** Node value on the library: which seed version it carries, so later versions add what is missing. */
export const LIBRARY_ARGUMENT = 'fos:library'
export const LIBRARY_VERSION = 2
export const MERGE_POLICY_ARGUMENT = 'fos:merge-policy'

export type LibraryAddress = SharedAddress & { title: string }
export type LibraryInfo = { version: number; seeded: string[]; source?: 'server' | 'bundle' }
/** Proposals on the node merge on their own once this many distinct members approved them. */
export type MergePolicy = { approvals: number }
export const DEFAULT_MERGE_POLICY: MergePolicy = { approvals: 2 }

type Requirement = NonNullable<import('../types').FosDataContent['requirement']>
type Allocation = NonNullable<import('../types').FosDataContent['allocation']>
type Resource = NonNullable<import('../types').FosDataContent['resource']>
/** A row of the library as data: what the seed list, the server's export and the client's bundle all share. */
export type SeedRow = { id: string; kind: 'template' | 'note' | 'plain' | 'requirement' | 'task' | 'allocation' | 'resource' | 'comment' | 'types'; text: string; done?: boolean; requirement?: Requirement; allocation?: Allocation; resource?: Resource; children?: SeedRow[]
  /** The Row types group (`kind: 'types'`): the exact contents of its types, which rows pin by cid (none: the seed's). */
  types?: FosNodeContent[]
  /** The nodes the types point at (their patterns), so a build's copy makes the same nodes. */
  nodes?: FosNodesData }
/** What a client build carries: the library's address on the server (null when built without one) and its rows. */
export type LibraryBundle = { address: LibraryAddress | null; version: number; rows: SeedRow[] }

/** The templates every account starts with. Ids are stable so reseeding adds only what is missing. */
export const STANDARD_LIBRARY: SeedRow[] = [
  { id: 'lib:readme', kind: 'note', text: '# Standard library\n\nTemplates every Fos account can use, offline: write `` [ ] `Plan a trip` `` in any node to start one. Edit them here to propose a change; members vote on proposals and the library merges what enough of them approve.' },
  // What every row is made from: a row is [row type, row], made from the nearest library's version of this group.
  // A changed type is a new version; existing rows keep the version they were made from.
  { id: ROW_TYPES_ID, kind: 'types', text: 'Row types' },
  { id: 'lib:trip', kind: 'template', text: 'Plan a trip', children: [
    { id: 'lib:trip:where', kind: 'requirement', text: 'Destination agreed', requirement: { capability: 'confirmation' } },
    { id: 'lib:trip:when', kind: 'requirement', text: 'Travel dates', requirement: { capability: 'allocation', resource: 'calendar', amount: 2, unit: 'd' } },
    { id: 'lib:trip:budget', kind: 'requirement', text: 'Budget per person', requirement: { capability: 'allocation', resource: 'account', amount: 200, unit: 'usd' } },
    { id: 'lib:trip:transport', kind: 'requirement', text: 'Book transport', requirement: { capability: 'task' } },
    { id: 'lib:trip:lodging', kind: 'requirement', text: 'Book lodging', requirement: { capability: 'task' } }
  ] },
  { id: 'lib:invoice', kind: 'template', text: 'Invoice', children: [
    { id: 'lib:invoice:contact', kind: 'plain', text: 'Billing contact: name <email>' },
    { id: 'lib:invoice:entries', kind: 'requirement', text: 'Time entries reviewed', requirement: { capability: 'confirmation' } },
    { id: 'lib:invoice:amount', kind: 'requirement', text: 'Amount due', requirement: { capability: 'allocation', resource: 'account', amount: 100, unit: 'usd' } },
    { id: 'lib:invoice:send', kind: 'requirement', text: 'Send the invoice', requirement: { capability: 'task' } }
  ] },
  { id: 'lib:poll', kind: 'template', text: 'Group decision', children: [
    { id: 'lib:poll:choice', kind: 'requirement', text: 'Which option?', requirement: { capability: 'choice', options: ['Option A', 'Option B', 'Option C'] } }
  ] },
  { id: 'lib:paid-task', kind: 'template', text: 'Paid task', children: [
    { id: 'lib:paid-task:delivered', kind: 'requirement', text: 'Work delivered', requirement: { capability: 'confirmation' } },
    { id: 'lib:paid-task:reward', kind: 'requirement', text: 'Reward', requirement: { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' } }
  ] },
  { id: 'lib:contact', kind: 'template', text: 'Contact form', children: [
    { id: 'lib:contact:message', kind: 'plain', text: 'Message: …' },
    { id: 'lib:contact:received', kind: 'requirement', text: 'Message received', requirement: { capability: 'confirmation' } }
  ] },
  { id: 'lib:research', kind: 'template', text: 'Research note', children: [
    { id: 'lib:research:question', kind: 'plain', text: 'Question: …' },
    { id: 'lib:research:sources', kind: 'requirement', text: 'Sources collected', requirement: { capability: 'task' } },
    { id: 'lib:research:summary', kind: 'requirement', text: 'Summary written', requirement: { capability: 'confirmation' } }
  ] },
  // A place at a time is not a primitive: it is the product of two rows (location × time) in one node. Alternatives
  // are coproducts (submissions on a ref, decided by a choice handler) and composition is a template of templates.
  { id: 'lib:meet', kind: 'template', text: 'Meet up', children: [
    { id: 'lib:meet:where', kind: 'requirement', text: 'Be at the meeting place', requirement: { capability: 'allocation', resource: 'location' } },
    { id: 'lib:meet:when', kind: 'requirement', text: 'Meeting time', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' } }
  ] },
  // Manual fallbacks: one row per requirement kind, each a handler the app offers on any unsatisfied requirement of
  // that kind. Clicking one records the supply (and a receipt for money or a place) by the person, no peer needed.
  { id: MANUAL_HANDLERS_ID, kind: 'template', text: 'Manual handlers', children: [
    { id: 'lib:manual:readme', kind: 'note', text: 'Fallbacks that work with no peer: the person who did it by hand records it here. Edit the labels to propose better ones; add a row to offer a fallback for another kind of requirement.' },
    { id: 'lib:manual:payment', kind: 'requirement', text: 'Paid outside Fos', requirement: { capability: 'allocation', resource: 'account' } },
    { id: 'lib:manual:points', kind: 'requirement', text: 'Settled the points by hand', requirement: { capability: 'allocation', resource: 'points' } },
    { id: 'lib:manual:time', kind: 'requirement', text: 'Booked the time by hand', requirement: { capability: 'allocation', resource: 'calendar' } },
    { id: 'lib:manual:things', kind: 'requirement', text: 'Set the items aside by hand', requirement: { capability: 'allocation', resource: 'inventory' } },
    { id: 'lib:manual:location', kind: 'requirement', text: 'Enter the location', requirement: { capability: 'allocation', resource: 'location' } },
    { id: 'lib:device:location', kind: 'requirement', text: "Use this device's location", requirement: { capability: 'allocation', resource: 'location' } },
    { id: 'lib:manual:mail', kind: 'requirement', text: 'Sent it myself', requirement: { capability: 'mail' } },
    { id: 'lib:manual:repo', kind: 'requirement', text: 'Opened the issue by hand', requirement: { capability: 'repo' } },
    { id: 'lib:manual:llm', kind: 'requirement', text: 'Answered it myself', requirement: { capability: 'llm' } },
    { id: 'lib:manual:search', kind: 'requirement', text: 'Searched by hand', requirement: { capability: 'search' } },
    { id: 'lib:manual:tool', kind: 'requirement', text: 'Ran it by hand', requirement: { capability: 'tool' } },
    { id: 'lib:manual:market', kind: 'requirement', text: 'Arranged it outside the market', requirement: { capability: 'market' } }
  ] }
]

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
    if (row.kind !== 'requirement' || !req || !row.title.trim()) return []
    return [{ id: row.id, label: row.title.trim(), capability: req.capability, ...(req.resource ? { resource: req.resource } : {}), device: row.id.startsWith('lib:device:') }]
  })
}

/** The library's fallbacks that fit one requirement: same capability and, for allocations, the same resource. */
export function manualHandlersFor(r: Replica, requirement: { capability: Requirement['capability']; resource?: Requirement['resource'] }, at?: Scope): ManualHandler[] {
  return manualHandlers(r, at).filter(h => h.capability === requirement.capability && (requirement.capability !== 'allocation' || h.resource === requirement.resource))
}

export function libraryInfo(r: Replica, path: Scope): LibraryInfo | null {
  const value = readNodeValue<LibraryInfo>(r, path, LIBRARY_ARGUMENT)
  return value && typeof value.version === 'number' && Array.isArray(value.seeded) ? value : null
}

/** Add the given rows below `path` where they are missing (by id); rows the node once had and lost are not re-added. */
export function seedLibraryRows(r: Replica, path: Scope, rows: SeedRow[], now: number, version = LIBRARY_VERSION, source?: LibraryInfo['source']): Replica {
  const before = r
  const info = libraryInfo(r, path), seeded = new Set(info?.seeded ?? [])
  const add = (at: Scope, list: SeedRow[]) => {
    for (const row of list) {
      if (!view(r, at)?.tasks.some(t => t.id === row.id) && !seeded.has(row.id)) {
        r = row.kind === 'types' ? addRowTypesRow(r, at, row, now)
          : addRow(r, at, row.kind, row.text, now, { id: row.id, ...(row.requirement ? { requirement: row.requirement } : {}), ...(row.allocation ? { allocation: row.allocation } : {}), ...(row.resource ? { resource: row.resource } : {}) })
        seeded.add(row.id)
      }
      if (row.children?.length && view(r, at)?.tasks.some(t => t.id === row.id)) add([...at, row.id], row.children)
    }
  }
  add(path, rows)
  if (r === before && info?.version === version && seeded.size === (info?.seeded.length ?? -1) && (source === undefined || info?.source === source)) return before
  return writeNodeValue(r, path, LIBRARY_ARGUMENT, { version, seeded: [...seeded], ...(source ? { source } : info?.source ? { source: info.source } : {}) }, now)
}

/** The Row types group as a library row, built from the exact contents of its types (which rows pin by cid). */
function addRowTypesRow(r: Replica, at: Scope, row: SeedRow, now: number): Replica {
  if (row.nodes) importNodes(r.store, row.nodes)
  const group = put(r.store, rowTypesContent(r.store, row.types ?? seedTypes(r.store)))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, node => ({ ...node, children: [...node.children, rowEdgeAt(r.store, 'plain', group, at)] })), now)
  return { ...r }
}

/** Add the rows of the standard library that `path` does not have yet; a no-op when it is complete. */
export function seedStandardLibrary(r: Replica, path: Scope, now: number): Replica {
  return seedLibraryRows(r, path, STANDARD_LIBRARY, now, LIBRARY_VERSION, 'server')
}

/** The library's rows as data (what `fos library export` writes for client builds): titles, kinds and typed fields, no bookkeeping. */
export function exportLibraryRows(r: Replica, path: Scope, depth = 0): SeedRow[] {
  if (depth > 16) return []
  const rows: SeedRow[] = []
  for (const row of view(r, path)?.tasks ?? []) {
    if (!['template', 'note', 'plain', 'requirement', 'task', 'allocation', 'resource', 'comment'].includes(row.kind) || row.id.startsWith('fos:')) continue
    const data = row as TaskView
    if (row.id === ROW_TYPES_ID) {
      // the exact contents: rows pin row types by cid, so a build's copy must make the same nodes
      const types = rowTypeContents(r.store, resolveScope(r.store, headCid(r), [...path, row.id])!)
      const nodes = reachableNodes(r.store, types.flatMap(type => type.children.map(([, t]) => t)))
      rows.push({ id: row.id, kind: 'types', text: row.title, types: types.map(type => ({ data: type.data, children: type.children })), ...(Object.keys(nodes).length ? { nodes } : {}) })
      continue
    }
    const seed: SeedRow = { id: row.id, kind: row.kind as SeedRow['kind'], text: row.title }
    if (row.kind === 'task' && row.done) seed.done = true
    if (data.requirement) { const { satisfied, summary, have, need, ...requirement } = data.requirement; void satisfied; void summary; void have; void need; seed.requirement = requirement }
    if (data.allocation) seed.allocation = data.allocation
    if (data.resource) { const { allocated, available, ...resource } = data.resource; void allocated; void available; seed.resource = resource }
    const children = exportLibraryRows(r, [...path, row.id], depth + 1)
    if (children.length) seed.children = children
    rows.push(seed)
  }
  return rows
}

/** Where this account's Home links the shared library (people who contribute and vote add it), if it does. */
export function libraryLink(r: Replica): Scope | null {
  const home = homePath(r), cid = resolveScope(r.store, headCid(r), home)
  const link = cid && findChild(r.store, cid, LIBRARY_ID)
  return link && (content(r.store, link).data.ref?.owner || r.meta.sharedNodes?.[JSON.stringify([...home, LIBRARY_ID])]) ? [...home, LIBRARY_ID] : null
}

/**
 * The library a device root ships: its library row (`ensureLibraryRow`; a device root loaded from older data gets
 * it here) filled with the build's bundle, or the in-code seed when the build carries none. Seeds what is missing,
 * once. Only device roots ship it; other roots are nested in a device root (`nestScope`).
 */
export function ensureDeviceLibrary(r: Replica, bundle: LibraryBundle, now: number): Replica {
  const path = [LIBRARY_ID]
  if (!resolveScope(r.store, headCid(r), path)) { ensureLibraryRow(r.store); r = { ...r } }
  if (libraryInfo(r, path)) return r
  const rows = bundle.rows.length ? bundle.rows : STANDARD_LIBRARY
  // the build's Row types are the ones this root ships (the root started with the seed's)
  const typesRow = rows.find(row => row.kind === 'types'), types = typesRow?.types
  if (types?.length) {
    if (typesRow?.nodes) importNodes(r.store, typesRow.nodes)
    const group = put(r.store, rowTypesContent(r.store, types))
    commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: node.children.map(edge => content(r.store, edge[1]).data.alias?.id === ROW_TYPES_ID ? [edge[0], group] as [string, string] : edge) })), now)
    r = { ...r }
  }
  return seedLibraryRows(r, path, rows, now, bundle.rows.length ? bundle.version : LIBRARY_VERSION, 'bundle')
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
  r = addRow(r, home, 'ref', address.title, now, { id: LIBRARY_ID, refOwner: address.owner, refId: address.path.at(-1) ?? LIBRARY_ID })
  const path = [...home, LIBRARY_ID]
  r = writeNodeValue(r, path, 'fos:shared-link', { owner: address.owner, path: address.path, share: address.share }, now)
  return { replica: r, path, added: true }
}

/** What the `fos` CLI pulled: the library's nodes, root first, each with the request that fetched it (node-provider protocol). */
export type PulledLibrary = { address: LibraryAddress; nodes: Array<{ request: NodeRequest; node: ProvidedNode }> }

/**
 * The bundle a client build carries, assembled from the nodes the `fos` CLI pulled through the account
 * (`fos library export`): the nodes are accepted into a scratch replica exactly as the app would accept them, then
 * exported as rows, so the build's copy is the live library at build time.
 */
export function exportProvidedLibrary(pulled: PulledLibrary, now: number): LibraryBundle {
  const root = pulled.nodes[0]
  if (!root) return { address: pulled.address, version: 0, rows: [] }
  // a scratch row beside the scratch root's own shipped library
  const PULLED = 'fos:pulled-library'
  let r = addRow(createReplica('fos:cli'), [], 'ref', pulled.address.title, now, { id: PULLED, refOwner: pulled.address.owner, refId: pulled.address.path.at(-1) ?? LIBRARY_ID })
  for (const { request, node } of pulled.nodes) r = acceptProvidedNode(r, [PULLED, ...request.path.slice(root.request.path.length)], request, node, now)
  const rows = exportLibraryRows(r, [PULLED]), types = exactPulledTypes(r, pulled)
  return { address: pulled.address, version: libraryInfo(r, [PULLED])?.version ?? LIBRARY_VERSION, rows: types ? rows.map(row => row.kind === 'types' ? { ...row, ...types } : row) : rows }
}

/**
 * The Row types as they were served: rows pin types by cid, so the bundle needs their exact content, which a pulled
 * projection does not keep (it holds received rows as links of the peer). A type is its data and its pattern rows,
 * which are plain rows; both come straight from the pulled shapes.
 */
function exactPulledTypes(r: Replica, pulled: PulledLibrary): Pick<SeedRow, 'types' | 'nodes'> | null {
  const base = pulled.nodes[0]!.request.path.length
  const shapes = new Map(pulled.nodes.map(({ request, node }) => [JSON.stringify(request.path.slice(base)), node]))
  const group = shapes.get(JSON.stringify([ROW_TYPES_ID]))
  if (!group) return null
  const types: FosNodeContent[] = []
  for (const row of group.children) {
    const type = shapes.get(JSON.stringify([ROW_TYPES_ID, row.id]))
    if (!type) return null
    const children = type.children.map((pattern): FosPathElem => {
      const shape = shapes.get(JSON.stringify([ROW_TYPES_ID, row.id, pattern.id]))
      if (!shape) throw new Error(`The pulled library lacks pattern ${pattern.id} of ${row.id}.`)
      return [pattern.template, put(r.store, { data: { alias: { id: pattern.id }, ...shape.data }, children: [] })]
    })
    types.push({ data: type.data, children })
  }
  return { types, nodes: reachableNodes(r.store, types.flatMap(type => type.children.map(([, t]) => t))) }
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
