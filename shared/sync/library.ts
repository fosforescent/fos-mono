/**
 * The standard library: one node, owned by a system account on the server, that every account reads and can
 * propose changes to. Its rows are templates (derived capabilities built from the basic row grammar: tasks,
 * requirements, allocations, choices) that work offline on every device once the node is pulled, because
 * instantiating a template is a local copy. It is shared with the `users` audience, which is an implicit group of
 * all signed-in accounts (`memberFor` in graph.ts), with read, edit (proposals), approve and rank; a merge policy on
 * the node lets the server merge a proposal once enough members approved it (`applyMergePolicy`).
 */
import { addRow, applyProposalAt, homePath, resolveRef, view, type Replica } from './replica'
import { readNodeValue, writeNodeValue } from './evaluation'
import { sharedProjection, type SharedAddress } from './sharing'
import type { Scope } from './graph'

/** The library row's alias in its owner's Home, and the id of the reference row in every other Home. */
export const LIBRARY_ID = 'fos:library'
/** Node value on the library: which seed version it carries, so later versions add what is missing. */
export const LIBRARY_ARGUMENT = 'fos:library'
export const LIBRARY_VERSION = 1
export const MERGE_POLICY_ARGUMENT = 'fos:merge-policy'

export type LibraryAddress = SharedAddress & { title: string }
export type LibraryInfo = { version: number; seeded: string[] }
/** Proposals on the node merge on their own once this many distinct members approved them. */
export type MergePolicy = { approvals: number }
export const DEFAULT_MERGE_POLICY: MergePolicy = { approvals: 2 }

type Requirement = NonNullable<import('../types').FosDataContent['requirement']>
type SeedRow = { id: string; kind: 'template' | 'note' | 'plain' | 'requirement' | 'task'; text: string; requirement?: Requirement; children?: SeedRow[] }

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

/** Add the rows of the standard library that `path` does not have yet (by id); a no-op when it is complete. */
export function seedStandardLibrary(r: Replica, path: Scope, now: number): Replica {
  const before = r
  const info = libraryInfo(r, path), seeded = new Set(info?.seeded ?? [])
  const add = (at: Scope, rows: SeedRow[]) => {
    for (const row of rows) {
      if (!view(r, at)?.tasks.some(t => t.id === row.id) && !seeded.has(row.id)) {
        r = addRow(r, at, row.kind, row.text, now, { id: row.id, ...(row.requirement ? { requirement: row.requirement } : {}) })
        seeded.add(row.id)
      }
      if (row.children?.length && view(r, at)?.tasks.some(t => t.id === row.id)) add([...at, row.id], row.children)
    }
  }
  add(path, STANDARD_LIBRARY)
  if (r === before && info?.version === LIBRARY_VERSION && seeded.size === (info?.seeded.length ?? -1)) return before
  return writeNodeValue(r, path, LIBRARY_ARGUMENT, { version: LIBRARY_VERSION, seeded: [...seeded] }, now)
}

/** Where this account's Home references the library, if it does. */
export function libraryLink(r: Replica): Scope | null {
  const found = resolveRef(r, LIBRARY_ID)
  return found?.row.refOwner ? [...found.path, found.row.id] : null
}

/** Put the library's reference into this account's Home (once); the shared address lets the app open its vote view. */
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
