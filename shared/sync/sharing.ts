/**
 * Publishing is membership. A node is published to an audience when that audience's peer is a member that may run
 * it (`execute`; or read it, as the standard library's Fos users may): the world (`audience:public`) or every Fos
 * user (`audience:users`); a person or a group is the same with their own peer. What a visitor sees is the node's
 * execute view (`sharedProjection`), and their inputs are stored in typed refs on it. A published template is an
 * endpoint: each visitor who starts it gets a private execution, a node of which only that visitor is a member.
 */
import { createStore } from './graph'
import { primitive } from './primitives'
import { libraryNode, settingOf } from './graph'
import { nodeLinkMaskAt } from './node-provider'
import { handleAt } from './arguments'
import { instructionPrimitives } from './primitives'
import { argumentRefs, capabilityPeers } from './bindings'
import { evaluationRecord, executionOrigin, handlerResult, readNodeValue, writeExecutionOrigin, writeHandlerResult } from './evaluation'
import { approvalsOf, submissionKey } from './approvals'
import { readRowValue, writeRowValue } from './row-values'
import { addMemberAt, createReplica, deleteTask, homePath, addRow, proposeRefAt, renameTask, resolveRef, headCid, removeMemberAt, setMemberCapabilitiesAt, view, type Replica } from './replica'
import { FosStore } from '../dag-implementation/store'
import { isCid } from '../dag-implementation/cid'
import type { FosPathElem } from '../types'
import { MARKDOWN_TYPE, NUMBER_TYPE, TEXT_TYPE, VISITOR_SUBMISSION } from './published-types'
export * from './published-types'
import { PLAIN_TYPE, REF_TYPE, TEMPLATE_TYPE } from './library-types'
import { isRowEdge, membershipPath, newId, SERVER_MEMBER, aliasIdOf, identityCid, typeIdOf, libAt, nestScope, commitRoot, content, hasCapability, importNodes, makeLink, memberFor, proposalContent, put, reachableNodes, readMembers, readProposals, resolveScope, isRefNode, refValueCid, rootTargetCid, updateAtScope, valueContent, withProposal, type Capability, type Scope } from './graph'

export type Audience = 'public' | 'users'
export const AUDIENCES: readonly Audience[] = ['public', 'users']
export const audiencePeer = (audience: Audience) => `audience:${audience}`
export const AUDIENCE_LABEL: Record<Audience, string> = { public: '🌐 Anyone', users: '✦ Fos users' }
export type Execution = { peer: string; entry: SharedAddress; audience: Audience }
export type Publication = { audience: Audience; template: boolean; execution?: Execution }
/** What a member must hold for the node to be served to it: running it, or reading it. */
const SERVED: Capability[] = ['execute', 'read']
const holds = (m: { capabilities: Capability[]; disabled?: Capability[] } | undefined, caps: Capability[]) => !!m && caps.some(cap => m.capabilities.includes(cap) && !m.disabled?.includes(cap))

/** How the node at `path` is published: the widest audience member that may run or read it, or a visitor's execution; null when it is not. */
export function publication(r: Replica, path: Scope): Publication | null {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return null
  const execution = executionAt(r, path)
  if (execution) return { audience: execution.audience, template: false, execution }
  const members = readMembers(r.store, content(r.store, cid))
  const audience = AUDIENCES.find(a => holds(members.find(m => m.peerId === audiencePeer(a)), SERVED))
  if (!audience) return null
  const row = path.length ? view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
  return { audience, template: row?.type === TEMPLATE_TYPE }
}
/** Is the node at `path` published to `audience` (its peer a member here that may run or read it)? */
export function publishedTo(r: Replica, path: Scope, audience: Audience): boolean {
  const cid = resolveScope(r.store, headCid(r), path)
  return !!cid && holds(readMembers(r.store, content(r.store, cid)).find(m => m.peerId === audiencePeer(audience)), SERVED)
}
/** A visitor's private execution of a published template, as the run records its origin (the visitor, the endpoint, the audience); null when the node is no execution. */
function executionAt(r: Replica, path: Scope): Execution | null {
  const execution = executionOrigin<Execution>(r, path)
  return execution && typeof execution.peer === 'string' && AUDIENCES.includes(execution.audience) && Array.isArray(execution.entry?.path) ? execution : null
}
/** The private execution `peer` started of the template endpoint at `template` (instances sit beside it), if any. */
export function visitorExecution(r: Replica, template: Scope, peer: string): Scope | null {
  const parent = template.slice(0, -1)
  for (const row of view(r, parent)?.tasks ?? []) {
    const execution = executionAt(r, [...parent, row.id])
    if (execution?.peer === peer && JSON.stringify(execution.entry.path) === JSON.stringify(template)) return [...parent, row.id]
  }
  return null
}
/** What the account server's `url` handler records on its member entry: where share pages are, and whose account it is. */
export type PageBase = { base: string; owner: string }
const isUrl = (store: Replica['store'], left: string) => left === libraryNode(store, 'capabilities.url')
/** Record where this account's share pages are (the `url` handler, on the server's member entry at `entry`). */
export function writePageBase(r: Replica, entry: Scope, base: PageBase, now: number): Replica {
  const current = readRowValue<PageBase>(r, entry, isUrl)
  return current?.base === base.base && current.owner === base.owner ? r : writeRowValue(r, entry, libAt(r.store, entry).capabilities.url!, base, now, undefined, isUrl)
}
/** The share page's address for a node: the web app with the owner and the node's path. */
export function nodeUrl(webUrl: string, address: SharedAddress): string {
  return `${webUrl.replace(/\/$/, '')}/#share=${encodeURIComponent(JSON.stringify(address))}`
}
/** The share page of the published node at `path`: its account server's page base (nearest above) with the node's place in the account. */
export function publishedUrl(r: Replica, path: Scope): string | null {
  const policy = path.length ? publication(r, path) : null
  if (!policy || policy.execution) return null
  for (let i = path.length; i >= 0; i--) {
    const at = path.slice(0, i), cid = resolveScope(r.store, headCid(r), at)
    if (!cid || !readMembers(r.store, content(r.store, cid)).some(m => m.peerId === SERVER_MEMBER)) continue
    const fos = membershipPath(r.store, headCid(r), at, SERVER_MEMBER)
    const base = fos && readRowValue<PageBase>(r, fos, isUrl)
    if (base) return nodeUrl(base.base, { owner: base.owner, path: [...r.meta.scope, ...path] })
  }
  return null
}
/** Publish the node to `audience`: its peer becomes a member that may run it (execute only). */
export function publish(r: Replica, path: Scope, audience: Audience, now: number): Replica {
  const peer = audiencePeer(audience), member = view(r, path)?.members.find(m => m.peerId === peer)
  if (!member) return addMemberAt(r, path, peer, AUDIENCE_LABEL[audience], ['execute'], now)
  if (holds(member, ['execute'])) return r
  return setMemberCapabilitiesAt(r, path, peer, [...new Set([...member.capabilities, 'execute' as Capability])], (member.disabled ?? []).filter(c => c !== 'execute'), now)
}
export function unpublish(r: Replica, path: Scope, audience: Audience, now: number): Replica {
  return view(r, path)?.members.some(m => m.peerId === audiencePeer(audience)) ? removeMemberAt(r, path, audiencePeer(audience), now) : r
}
/** Make the node at `path` a visitor's private execution: the visitor is its member (execute), and it remembers where it came from. */
export function markExecution(r: Replica, path: Scope, execution: Execution, name: string, now: number): Replica {
  r = addMemberAt(r, path, execution.peer, name, ['execute'], now)
  return writeExecutionOrigin(r, path, execution, now)
}
/**
 * May `peer` see the node at `at` of a publication rooted at `root`? It is served what members it falls under (itself,
 * else its audience, `memberFor`) may run or read, on the way down, within their child masks.
 */
export function servedTo(r: Replica, root: Scope, at: Scope, peer: string): boolean {
  let grants: Capability[] = []
  for (let i = 0; i <= at.length; i++) {
    const cid = resolveScope(r.store, headCid(r), at.slice(0, i))
    if (!cid) return false
    const member = memberFor(r.store, content(r.store, cid), peer)
    if (member) grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
    if (i >= root.length && !SERVED.some(cap => grants.includes(cap))) return false
    const mask = nodeLinkMaskAt(r, at.slice(0, i), peer)
    if (i < at.length && i >= root.length && mask?.children && !mask.children.includes(at[i]!)) return false
  }
  return true
}
/**
 * May `peer` give `capability`-kind input here (read it, approve = edit, rank)? Running the node covers it. Both the
 * visitor and the audience the node is published to must allow it, so narrowing the audience narrows its visitors.
 */
export function mayParticipate(r: Replica, path: Scope, peer: string, capability: 'read' | 'edit' | 'rank'): boolean {
  const cid = resolveScope(r.store, headCid(r), path), policy = publication(r, path)
  if (!cid || !policy) return false
  const identity = content(r.store, cid)
  const may = (who: string) => hasCapability(r.store, identity, who, capability) || hasCapability(r.store, identity, who, 'execute')
  return may(peer) && (!!policy.execution || may(audiencePeer(policy.audience)))
}
export type SharedInput = { key: string; name: string; kind: 'text' | 'ref' | 'allocation' | 'confirmation' | 'choice'; path?: Scope; options?: string[]; direction?: 'provide' | 'consume'; type?: string; unit?: string; amount?: number; start?: number | null; end?: number | null; role?: 'input' | 'output' }
/**
 * A visitor's taking part: what it answered and how it ranked, with where its own copy is (`account`: its link row to
 * the node in its account). `approvals` are the submissions it approved, read from their approval rows (approvals.ts),
 * never stored with the rest.
 */
export type Participation = {
  peer: string; name?: string; labels?: Record<string, string>; audience: string; revision: string; updated: number
  approvals: string[]; ranking: string[]; fields: Record<string, string | boolean | number | { amount: number; type: string; unit: string; start?: number | null; end?: number | null }>
  account?: { owner: string; ref: string }
}
/**
 * A published row. `type` is the library row type its edge is made from (the left node's id, the same for every
 * pinned version of that type); viewers render by it. `title` is the short label; a note also carries its whole
 * markdown `body`, a field its current value as `body`.
 */
export type SharedRow = { id: string; title: string; depth: number; type?: string; body?: string; truncated?: true }
export type SharedNode = {
  title: string; type?: string; body?: string; truncated?: true; rows: SharedRow[]
  /** A template endpoint: each visitor who starts it gets a private execution. */
  template?: true
  inputs: SharedInput[]
  proposals: Array<{ id: string; label: string }>; revision: string
  audience: 'public' | 'users'; counts: Record<string, number>; rankings: Record<string, number>; participants: number
  execution?: { status: string; error?: string };
  mine?: Participation | null; capabilities?: string[]; sources?: Record<string, string>
}
export function sharedInputs(r: Replica, path: Scope): SharedInput[] {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return []
  const text = argumentRefs(r.store, cid).filter(a => a.type === primitive(r.store, 'string') && !refValueCid(r.store, content(r.store, a.cid)) && a.name && !settingOf(r.store, content(r.store, a.cid))).map(a => ({ key: content(r.store, a.cid).data.alias!.id, name: a.name!, kind: 'text' as const }))
  // a choice requirement asks the visitor to choose; an allocation requirement asks for an amount
  const choices = (view(r, path)?.tasks ?? []).flatMap(row => row.requirement?.capability === 'choice' && !row.requirement.satisfied && row.requirement.options?.length ? [{ key: row.id, path: [row.id], name: row.title, kind: 'choice' as const, options: row.requirement.options.slice(0, 100) }] : [])
  const allocations = (view(r, path)?.tasks ?? []).flatMap(row => row.requirement?.capability === 'allocation' ? [{ key: row.id, name: row.title, kind: 'allocation' as const, type: row.requirement.resource ?? 'inventory', unit: row.requirement.unit ?? 'unit', amount: row.requirement.amount, ...(row.requirement.start !== undefined ? { start: row.requirement.start } : {}), ...(row.requirement.end !== undefined ? { end: row.requirement.end } : {}) }] : [])
  // the published node itself may be the choice
  const current = path.length ? view(r, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1)) : null
  const own = current?.requirement?.capability === 'choice' && !current.requirement.satisfied && current.requirement.options?.length ? [{ key: '[]', path: [], name: current.title, kind: 'choice' as const, options: current.requirement.options.slice(0, 100) }] : []
  return [...own, ...text, ...choices, ...allocations].slice(0, 32)
}
/** Only declared, unfilled inputs of an execution are writable by its visitor. */
export function executionInputs(r: Replica, root: Scope): SharedInput[] {
  const result: SharedInput[] = []
  const current = root.length ? view(r, root.slice(0, -1))?.tasks.find(row => row.id === root.at(-1)) ?? null : null
  // A grant an invocation row below the root already consumes is taken, whether or not that row has run yet.
  const taken = new Set<string>()
  const primitiveRows = new Set<string>()
  const collect = (path: Scope, depth: number) => {
    if (depth > 8) return
    for (const row of view(r, path)?.tasks ?? []) {
      if (instructionPrimitives(r, { path: [...path, row.id], row }).length) {
        primitiveRows.add(JSON.stringify([...path, row.id]))
        for (const input of view(r, [...path, row.id])?.tasks ?? []) if (input.refId) {
          taken.add(input.id)
          const grant = handleAt(r, [...path, row.id, input.id])
          if (grant) taken.add(grant.cid)
        }
      }
      if (row.refId === undefined && row.type !== TEMPLATE_TYPE) collect([...path, row.id], depth + 1)
    }
  }
  if (instructionPrimitives(r, { path: root, row: current }).length) primitiveRows.add(JSON.stringify(root))
  collect(root, 0)
  const offered = (rowPath: Scope, id: string) => {
    if (taken.has(id)) return null
    const grant = handleAt(r, rowPath)
    return grant && !taken.has(grant.cid) ? grant : null
  }
  const walk = (path: Scope, depth: number) => {
    if (depth > 8 || result.length >= 32) return
    const cid = resolveScope(r.store, headCid(r), path)
    const rows = view(r, path)?.tasks ?? []
    const primitiveRow = primitiveRows.has(JSON.stringify(path))
    for (const arg of cid ? argumentRefs(r.store, cid) : []) {
      const ref = content(r.store, arg.cid), id = ref.data.alias?.id
      if (!id || settingOf(r.store, ref) || ref.data.ref || ref.data.refExpression || primitiveRow && ref.data.refRole === 'output' && !refValueCid(r.store, ref)) continue
      // Requirement refs have their own input controls below; do not also expose them as generic reference slots.
      if (rows.some(row => row.id === id && row.requirement)) continue
      const relative = [...path.slice(root.length), id]
      if (!refValueCid(r.store, ref)) result.push({ key: JSON.stringify(relative), path: relative, name: arg.name ?? id,
        kind: arg.type === primitive(r.store, 'string') ? 'text' : 'ref', type: arg.type, role: ref.data.refRole ?? 'input' })
      else {
        // an argument forwarding an allocation (a passed handle) is offered for use like any handle row
        const held = offered([...path, id], id)
        if (held) result.push({ key: JSON.stringify(relative), path: relative, name: arg.name ?? id, kind: 'allocation', direction: 'consume', type: held.allocation.type, unit: held.allocation.unit, amount: held.allocation.amount, start: held.allocation.start, end: held.allocation.end })
        else walk([...path, id], depth + 1)
      }
    }
    for (const row of rows) {
      if (result.length >= 32) break
      const child = resolveScope(r.store, headCid(r), [...path, row.id])
      if (primitiveRow && child) {
        const ref = content(r.store, child)
        if (ref.data.refRole === 'output' && !refValueCid(r.store, ref)) continue
      }
      const req = row.requirement, relative = [...path.slice(root.length), row.id]
      const held = row.allocation || row.refId !== undefined ? offered([...path, row.id], row.id) : null
      if (held) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: 'allocation', direction: 'consume', type: held.allocation.type, unit: held.allocation.unit, amount: held.allocation.amount, start: held.allocation.start, end: held.allocation.end })
      if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability ?? '')) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
      if (row.refId === undefined && row.type !== TEMPLATE_TYPE) walk([...path, row.id], depth + 1)
    }
  }
  const req = current?.requirement
  if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability ?? '')) result.push({ key: '[]', path: [], name: current!.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
  const rootHeld = current ? handleAt(r, root) : null
  if (current && rootHeld) result.push({ key: '[]', path: [], name: current.title, kind: 'allocation', direction: 'consume', type: rootHeld.allocation.type, unit: rootHeld.allocation.unit, amount: rootHeld.allocation.amount, start: rootHeld.allocation.start, end: rootHeld.allocation.end })
  walk(root, 0)
  // A named ref row is reached both as an argument and as a row; its inputs count once.
  return result.filter((field, index) => result.findIndex(other => other.key === field.key) === index).slice(0, 32)
}

/**
 * A visitor's candidate values for a published node's holes, recorded as that visitor's submissions on the owner's
 * node (the owner reviews and accepts them like any other): a missing binding (an unbound typed argument) gets a
 * binding proposal on its ref, empty fields of rows one node proposal (`VISITOR_SUBMISSION`) setting them. Each
 * visitor is its own peer, so a resubmission replaces only that visitor's earlier candidates. Paths are relative.
 */
export function proposeVisitorValues(r: Replica, path: Scope, peer: string, values: Array<{ path: Scope; value: string }>, now: number): Replica {
  const rows: typeof values = []
  for (const { path: relative, value } of values) {
    const target = [...path, ...relative]
    if (!value.trim()) continue
    const targetCid = resolveScope(r.store, headCid(r), target)
    const ref = targetCid && content(r.store, targetCid)
    if (!(ref && isRefNode(r.store, ref) && !refValueCid(r.store, ref))) { rows.push({ path: relative, value }); continue }
    r = proposeRefAt(r, target, put(r.store, { data: { description: { content: value } }, children: [] }), peer, now).replica
  }
  if (!rows.length) return r
  const store = r.store, root = headCid(r), cid = resolveScope(store, root, path)!
  const base = put(store, valueContent(store, cid)), draftStore = createStore()
  importNodes(draftStore, reachableNodes(store, [base]))
  commitRoot(draftStore, base, now)
  nestScope(draftStore, { store, root, at: path })
  let draft = createReplica(peer, draftStore)
  for (const row of rows) draft = renameTask(draft, row.path.slice(0, -1), row.path.at(-1)!, row.value, now)
  if (headCid(draft) === base) return r
  importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
  const proposalCid = put(store, proposalContent(store, peer, VISITOR_SUBMISSION, headCid(draft), base, now))
  commitRoot(store, updateAtScope(store, root, path, current => withProposal(store, makeLink(store, current, now), peer, proposalCid, VISITOR_SUBMISSION), 'node'), now)
  return { ...r }
}

/**
 * The visitor's record on the node at `path`: the sharing handler's result on the visitor's member entry (a visit
 * makes it a member), holding only the permitted projection.
 */
export function writeParticipation(r: Replica, path: Scope, record: Participation, now: number): Replica {
  const { approvals: _approvals, ...kept } = record
  const entry = membershipPath(r.store, headCid(r), path, record.peer)
  if (!entry) throw new Error('Only a member of the node takes part in it.')
  return writeHandlerResult(r, entry, kept, now)
}

export function participation(r: Replica, path: Scope, peer: string): Participation | null {
  const entry = membershipPath(r.store, headCid(r), path, peer)
  const value = entry && handlerResult<Omit<Participation, 'approvals'>>(r, entry)
  if (!(value && value.peer === peer && Array.isArray(value.ranking) && value.ranking.every(v => typeof v === 'string') && value.fields && typeof value.fields === 'object')) return null
  return { ...value, approvals: approvedBy(r, path, peer) }
}
/** Everyone who took part: the members of the node with a record. */
export function participants(r: Replica, path: Scope): Participation[] {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return []
  return readMembers(r.store, content(r.store, cid)).flatMap(member => { const record = participation(r, path, member.peerId); return record ? [record] : [] })
}
/** A submission's id in the shared projection: it stays the same while approvals are added to it. */
export function sharedProposalId(store: FosStore, proposalCid: string): string {
  return `proposal:${submissionKey(store, proposalCid)}`
}
/** The open submission at `path` the shared projection calls `id`. */
export function sharedProposalCid(r: Replica, path: Scope, id: string): string | null {
  const cid = resolveScope(r.store, headCid(r), path)
  return (cid && readProposals(r.store, content(r.store, cid)).find(p => p.status === 'open' && sharedProposalId(r.store, p.cid) === id)?.cid) || null
}
/** The shared projection's ids of the open submissions at `path` that `peer` approved. */
function approvedBy(r: Replica, path: Scope, peer: string): string[] {
  const cid = resolveScope(r.store, headCid(r), path)
  return cid ? readProposals(r.store, content(r.store, cid)).filter(p => p.status === 'open' && approvalsOf(r.store, p.cid).some(a => a.approver === peer)).map(p => sharedProposalId(r.store, p.cid)) : []
}
/** The row edge with alias `id` among the rows of the node at `parent`. */
export function childRowEdge(store: FosStore, parent: string | null, id: string): FosPathElem | null {
  if (!parent) return null
  return valueContent(store, parent).children.find(edge => {
    try { const cid = identityCid(store, edge); return (aliasIdOf(content(store, cid)) ?? aliasIdOf(valueContent(store, cid))) === id } catch { return false }
  }) ?? null
}
/** The library row type a row is made from (its view's `type`, the left node's id), when it is one: what a published page renders by. */
const libraryType = (row: { type: string } | null | undefined): string | undefined => row && !isCid(row.type) ? row.type : undefined
/** Bounds on published markdown, in characters: one body, and every body of one projection together. */
export const SHARED_BODY_LIMIT = 100_000
export const SHARED_TOTAL_BODY = 1_000_000
export { markdownTitle } from './title'
export function sharedProjection(r: Replica, path: Scope, revision: (value: unknown) => string, peer?: string, interactive = false): SharedNode {
  const node = view(r, path), policy = publication(r, path)
  if (!node || !policy) throw new Error('Shared node unavailable.')
  const visitor = peer ?? audiencePeer(policy.audience)
  const visible = (at: Scope) => servedTo(r, path, at, visitor)
  const textVisible = (at: Scope) => { const mask = nodeLinkMaskAt(r, at, visitor); return !mask?.fields || mask.fields.includes('description') }
  const current = path.length ? view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
  const rows: SharedRow[] = [], hashed: unknown[] = [], fields: SharedInput[] = []
  let budget = SHARED_TOTAL_BODY
  // How a row reads is decided by its type (the left node of its edge) alone: a type whose text is Markdown (a
  // note's body row) publishes that text as its body.
  const present = (title: string, type: string | undefined, shown: boolean, markdown: boolean): Pick<SharedRow, 'title' | 'type' | 'body' | 'truncated'> => {
    if (!shown) return { title: '', ...(type ? { type } : {}) }
    if (!markdown) return { title: title.slice(0, 8000), ...(type ? { type } : {}) }
    const body = title.slice(0, Math.max(0, Math.min(SHARED_BODY_LIMIT, budget)))
    budget -= body.length
    return { title: '', type, body, ...(body.length < title.length ? { truncated: true as const } : {}) }
  }
  const store = r.store
  const page = present(current?.body ?? current?.title ?? node.name ?? 'Shared node', libraryType(current), textVisible(path), current?.body !== undefined)
  const walk = (at: Scope, depth: number) => {
    if (depth > 8 || hashed.length >= 200) return
    const parent = resolveScope(store, headCid(r), at)
    for (const row of view(r, at)?.tasks ?? []) {
      if (hashed.length >= 200) break
      const childPath = [...at, row.id]
      // peer rows (who the node is connected to) are the read/edit view's, never the served page's
      if (!visible(childPath) || row.construction) continue
      const shown = textVisible(childPath), edge = childRowEdge(store, parent, row.id), type = libraryType(row)
      // The execute projection offers declared inputs separately. Their private
      // bindings and runtime state are graph rows, but are not published page content.
      if (edge && content(store, identityCid(store, edge)).data.name) continue
      hashed.push({ id: row.id, title: shown ? row.title.slice(0, 8000) : '', type: row.type, depth, fields: row.fields, body: row.body })
      rows.push({ id: row.id, depth, ...present(row.title, type, shown, false) })
      if (row.body) rows.push({ id: `${row.id}:body`, depth: depth + 1, ...present(row.body, MARKDOWN_TYPE, shown, true) })
      for (const field of row.fields ?? []) {
        // a field of the row: a filled one is shown; an open one is asked of the visitor, who submits a candidate value
        const relative = [...childPath.slice(path.length), field.id], label = field.key ?? ''
        if (!field.open) rows.push({ id: field.id, depth: depth + 1, type: typeof field.value === 'number' ? NUMBER_TYPE : TEXT_TYPE, title: label, ...(shown ? { body: String(field.value ?? '').slice(0, 8000) } : {}) })
        else if (shown) fields.push({ key: JSON.stringify(relative), path: relative, name: label || 'Value', kind: 'text' })
      }
      const definition = edge && store.table.has(edge[0]) ? content(store, edge[0]) : null
      // Reference targets, arguments, membership, previous versions and private inputs are never exported.
      if (row.refId === undefined) walk([...at, row.id], depth + 1)
    }
  }
  walk(path, 0)
  // what a visitor submits (a member who may run the node but not edit it) is the owner's to review, not an option other visitors vote on
  const identity = content(r.store, resolveScope(r.store, headCid(r), path)!)
  // visitors are explicit members (a visit adds them); a peer the audience covers implicitly is no visitor
  const visitorInput = (peer: string) => readMembers(r.store, identity).some(m => m.peerId === peer) && !hasCapability(r.store, identity, peer, 'edit')
  const open = node.proposals.filter(p => p.status === 'open' && !visitorInput(p.peerId)).slice(0, 100)
  const proposals = open.map(p => ({ id: sharedProposalId(store, p.id), label: `${p.name ?? 'Peer'}: ${[...p.summary.added.map(t => `adds ${t}`), ...p.summary.changed.map(t => `changes ${t}`), ...p.summary.removed.map(t => `removes ${t}`)].join('; ') || 'proposed changes'}` }))
  const inputs = ((policy.execution || interactive) ? executionInputs(r, path) : [...sharedInputs(r, path), ...fields].slice(0, 32)).filter(field => { const at = [...path, ...(field.path ?? [field.key])]; return visible(at) && textVisible(at) })
  const key = revision({ audience: policy.audience, title: current?.title ?? node.name, rows: hashed, inputs, proposals })
  // approvals are the submissions' own approval rows; rankings what each visitor answered for this revision
  const counts: Record<string, number> = Object.fromEntries(open.map(p => [sharedProposalId(store, p.id), approvalsOf(store, p.id).length]))
  const rankings: Record<string, number> = {}
  const active = participants(r, path).filter(p => p.audience === audiencePeer(policy.audience) && p.revision === key && mayParticipate(r, path, p.peer, 'read'))
  for (const p of active) if (mayParticipate(r, path, p.peer, 'rank')) p.ranking.forEach((id, i) => { rankings[id] = (rankings[id] ?? 0) + p.ranking.length - i })
  return { ...((policy.execution || interactive) ? { execution: evaluationRecord(r, path) ?? { status: 'idle' } } : {}), ...page, title: page.title || 'Shared node', ...(policy.template ? { template: true as const } : {}), rows, inputs, proposals, revision: key, audience: policy.audience, counts, rankings, participants: active.length }
}

/** The row below Home standing for another account (their peer is its member), if there is one. */
function hostRowOf(r: Replica, owner: string): Scope | null {
  const home = homePath(r), peer = `user:${owner}`
  const host = (view(r, home)?.tasks ?? []).find(row => view(r, [...home, row.id])?.members.some(m => m.peerId === peer) || (row.requirement?.capability === 'peer' && row.requirement.peer === peer))
  return host ? [...home, host.id] : null
}
/** The reference row below a host row standing for `owner`'s node `refId`. */
function linkRowOf(r: Replica, hostPath: Scope, owner: string, refId: string): Scope | null {
  const row = (view(r, hostPath)?.tasks ?? []).find(t => t.refOwner === owner && t.refId === refId)
  return row ? [...hostPath, row.id] : null
}
/** The sub-peer row for another account below this one's Home (their peer id is its member), created on demand. */
export function subPeerRowAt(r: Replica, owner: string, now: number): { replica: Replica; path: Scope } {
  const home = homePath(r), peer = `user:${owner}`
  let hostPath = hostRowOf(r, owner)
  if (!hostPath) { const id = newId(); r = addRow(r, home, PLAIN_TYPE, owner, now, { id }); hostPath = [...home, id] }
  // the sub-peer: a member of this node (so the fos server tab lists them) and of its row, with nothing granted
  if (!view(r, home)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, home, peer, owner, [], now)
  if (!view(r, hostPath)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, hostPath, peer, owner, [], now)
  return { replica: r, path: hostPath }
}


/**
 * Another account made this one a member of a node: the request lands as a *proposal* by that account on its sub-peer
 * row below Home (the fos server relays it), adding the node as a foreign ref there. Nothing is granted to the
 * inviter, and the ref appears only when this account accepts the proposal (`decide`); until then it is a pending
 * submission like any other.
 */
export function ensureInviteRequest(r: Replica, owner: string, aliasId: string, title: string, now: number): { replica: Replica; path: Scope; proposalCid: string | null } {
  const peer = `user:${owner}`, name = title || owner
  const sub = subPeerRowAt(r, owner, now)
  r = sub.replica
  const hostPath = sub.path
  if (linkRowOf(r, hostPath, owner, aliasId)) return { replica: r, path: hostPath, proposalCid: null }
  const store = r.store, root = headCid(r), hostCid = resolveScope(store, root, hostPath)!
  const identity = content(store, hostCid)
  // the open request from that account that adds a reference to this node of theirs
  const pending = readProposals(store, identity).find(p => p.peerId === peer && p.status === 'open' && valueContent(store, p.contentCid).children.some(edge => {
    const ref = content(store, identityCid(store, edge)).data.ref
    return isRowEdge(store, edge) && ref?.owner === owner && ref.id === aliasId
  }))
  if (pending) return { replica: r, path: hostPath, proposalCid: pending.cid }
  // the proposal's content: the row's current value plus the ref, built in a scratch store rooted at that value
  const base = put(store, valueContent(store, hostCid)), draftStore = createStore()
  importNodes(draftStore, reachableNodes(store, [base]))
  commitRoot(draftStore, base, now)
  nestScope(draftStore, { store, root, at: hostPath })
  const draft = addRow(createReplica(peer, draftStore), [], REF_TYPE, title, now, { id: newId(), refOwner: owner, refId: aliasId })
  importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
  const proposalCid = put(store, proposalContent(store, peer, name, headCid(draft), base, now))
  commitRoot(store, updateAtScope(store, root, hostPath, current => withProposal(store, makeLink(store, current, now), peer, proposalCid, name), 'node'), now)
  void rootTargetCid
  return { replica: { ...r }, path: hostPath, proposalCid }
}

/** Where a published node is: its owner's account and its path there. */
export type SharedAddress = { owner: string; path: Scope }
/** A received link is an ordinary foreign ref below its host peer in Home. No guest context is granted to the host. */
export function ensureSharedLink(r: Replica, address: SharedAddress, title: string, now: number, anonymous = false): { replica: Replica; path: Scope } {
  const home = homePath(r), peer = `user:${address.owner}`, refId = address.path.at(-1) ?? 'root'
  let hostPath = hostRowOf(r, address.owner)
  const existing = hostPath && linkRowOf(r, hostPath, address.owner, refId)
  if (existing) return { replica: r, path: existing }
  if (!hostPath) { const id = newId(); r = addRow(r, home, PLAIN_TYPE, anonymous ? 'Host' : address.owner, now, { id }); hostPath = [...home, id] }
  if (!view(r, hostPath)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, hostPath, peer, anonymous ? 'Host' : address.owner, [], now)
  // the reference row says whose node it is and where it is in their account
  const id = newId()
  r = addRow(r, hostPath, REF_TYPE, title, now, { id, refOwner: address.owner, refId, refScope: address.path })
  return { replica: r, path: [...hostPath, id] }
}
/** This account's link row to the shared node at `address`, if it has one (`ensureSharedLink` makes it). */
export function sharedLinkAt(r: Replica, address: SharedAddress): Scope | null {
  const hostPath = hostRowOf(r, address.owner)
  return hostPath && linkRowOf(r, hostPath, address.owner, address.path.at(-1) ?? 'root')
}
/** Where the node a received link at `path` stands for is: its owner and its place in their account. */
export function sharedAddressAt(r: Replica, path: Scope): SharedAddress | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const ref = cid ? content(r.store, cid).data.ref : undefined
  return ref?.owner && Array.isArray(ref.scope) ? { owner: ref.owner, path: ref.scope } : null
}
