/**
 * The standard library: one node, owned by a system account on the server, that every account reads and can
 * propose changes to. Its rows are templates (derived capabilities built from the basic row grammar: tasks,
 * requirements, allocations, choices) that work offline on every device once the node is pulled, because
 * instantiating a template is a local copy. It is shared with the `users` audience, which is an implicit group of
 * all signed-in accounts (`memberFor` in graph.ts), with read, edit (proposals), approve and rank; a merge policy on
 * the node lets the server merge a proposal once enough members approved it (`applyMergePolicy`).
 *
 * Clients also carry a copy in their build: `fos library export` pulls the shared node through the account (the
 * node-provider protocol) and `exportProvidedLibrary` turns it into `web/src/library.json`, so a device that never
 * goes online seeds a local library from it (`ensureBundledLibrary`); the first owner sync replaces that copy with
 * the live reference (`ensureLibraryLink`).
 */
import { addRow, applyProposalAt, createReplica, deleteTask, homePath, resolveRef, view, type Replica } from './replica'
import { readNodeValue, writeNodeValue } from './evaluation'
import { sharedProjection, type SharedAddress } from './sharing'
import { acceptProvidedNode, type NodeRequest, type ProvidedNode } from './node-provider'
import type { Scope, TaskView } from './graph'

/** The library row's alias in its owner's Home, and the id of the reference row in every other Home. */
export const LIBRARY_ID = 'fos:library'
/** A device's own copy of the library, seeded from its build before the account ever synced. */
export const LIBRARY_BUNDLE_ID = 'fos:library-bundle'
/** Node value on the library: which seed version it carries, so later versions add what is missing. */
export const LIBRARY_ARGUMENT = 'fos:library'
export const LIBRARY_VERSION = 1
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
export type SeedRow = { id: string; kind: 'template' | 'note' | 'plain' | 'requirement' | 'task' | 'allocation' | 'resource' | 'comment'; text: string; done?: boolean; requirement?: Requirement; allocation?: Allocation; resource?: Resource; children?: SeedRow[] }
/** What a client build carries: the library's address on the server (null when built without one) and its rows. */
export type LibraryBundle = { address: LibraryAddress | null; version: number; rows: SeedRow[] }

/** The templates every account starts with. Ids are stable so reseeding adds only what is missing. */
export const STANDARD_LIBRARY: SeedRow[] = [
  { id: 'lib:readme', kind: 'note', text: '# Standard library\n\nTemplates every Fos account can use, offline: write `` [ ] `Plan a trip` `` in any node to start one. Edit them here to propose a change; members vote on proposals and the library merges what enough of them approve.' },
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
  ] }
]

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
        r = addRow(r, at, row.kind, row.text, now, { id: row.id, ...(row.requirement ? { requirement: row.requirement } : {}), ...(row.allocation ? { allocation: row.allocation } : {}), ...(row.resource ? { resource: row.resource } : {}) })
        seeded.add(row.id)
      }
      if (row.children?.length && view(r, at)?.tasks.some(t => t.id === row.id)) add([...at, row.id], row.children)
    }
  }
  add(path, rows)
  if (r === before && info?.version === version && seeded.size === (info?.seeded.length ?? -1) && (source === undefined || info?.source === source)) return before
  return writeNodeValue(r, path, LIBRARY_ARGUMENT, { version, seeded: [...seeded], ...(source ? { source } : info?.source ? { source: info.source } : {}) }, now)
}

/** Add the rows of the standard library that `path` does not have yet; a no-op when it is complete. */
export function seedStandardLibrary(r: Replica, path: Scope, now: number): Replica {
  return seedLibraryRows(r, path, STANDARD_LIBRARY, now, LIBRARY_VERSION, 'server')
}

/** The library's rows as data (the server's `GET /library`, which client builds pull): titles, kinds and typed fields, no bookkeeping. */
export function exportLibraryRows(r: Replica, path: Scope, depth = 0): SeedRow[] {
  if (depth > 16) return []
  const rows: SeedRow[] = []
  for (const row of view(r, path)?.tasks ?? []) {
    if (!['template', 'note', 'plain', 'requirement', 'task', 'allocation', 'resource', 'comment'].includes(row.kind) || row.id.startsWith('fos:')) continue
    const data = row as TaskView
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

/** Where this account's Home references the library, if it does. */
export function libraryLink(r: Replica): Scope | null {
  const found = resolveRef(r, LIBRARY_ID)
  return found?.row.refOwner ? [...found.path, found.row.id] : null
}
/** Where this device keeps its bundled copy of the library, if it still has one. */
export function libraryBundlePath(r: Replica): Scope | null {
  const home = homePath(r)
  return view(r, home)?.tasks.some(t => t.id === LIBRARY_BUNDLE_ID) ? [...home, LIBRARY_BUNDLE_ID] : null
}

/**
 * A device that has never synced seeds the library from its build, so the templates are there offline from the
 * first run. The copy is an ordinary row (not a reference); the first owner sync replaces it with the live
 * reference (`ensureLibraryLink`). Rows the bundle lacks fall back to the in-code seed list.
 */
export function ensureBundledLibrary(r: Replica, bundle: LibraryBundle, now: number): { replica: Replica; path: Scope | null; added: boolean } {
  if (libraryLink(r)) return { replica: r, path: libraryLink(r), added: false }
  const existing = libraryBundlePath(r)
  if (existing) return { replica: r, path: existing, added: false }
  const home = homePath(r)
  if (!view(r, home)) return { replica: r, path: null, added: false }
  r = addRow(r, home, 'plain', bundle.address?.title ?? 'Standard library', now, { id: LIBRARY_BUNDLE_ID })
  const path = [...home, LIBRARY_BUNDLE_ID]
  r = seedLibraryRows(r, path, bundle.rows.length ? bundle.rows : STANDARD_LIBRARY, now, bundle.rows.length ? bundle.version : LIBRARY_VERSION, 'bundle')
  if (bundle.address) r = writeNodeValue(r, path, 'fos:shared-link', { owner: bundle.address.owner, path: bundle.address.path, share: bundle.address.share }, now)
  return { replica: r, path, added: true }
}

/**
 * Put the library's reference into this account's Home (once); the shared address lets the app open its vote view.
 * A bundled copy the device seeded before its first sync gives way to the reference: the copy was the build's
 * snapshot of the same node.
 */
export function ensureLibraryLink(r: Replica, address: LibraryAddress, now: number): { replica: Replica; path: Scope; added: boolean } {
  const existing = libraryLink(r)
  if (existing) return { replica: r, path: existing, added: false }
  const home = homePath(r)
  if (!view(r, home)) return { replica: r, path: home, added: false }
  if (libraryBundlePath(r)) r = deleteTask(r, home, LIBRARY_BUNDLE_ID, now)
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
  let r = addRow(createReplica('fos:cli'), [], 'ref', pulled.address.title, now, { id: LIBRARY_ID, refOwner: pulled.address.owner, refId: pulled.address.path.at(-1) ?? LIBRARY_ID })
  for (const { request, node } of pulled.nodes) r = acceptProvidedNode(r, [LIBRARY_ID, ...request.path.slice(root.request.path.length)], request, node, now)
  return { address: pulled.address, version: libraryInfo(r, [LIBRARY_ID])?.version ?? LIBRARY_VERSION, rows: exportLibraryRows(r, [LIBRARY_ID]) }
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
