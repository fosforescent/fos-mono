/**
 * Publishing is membership. A node is published to an audience when that audience's peer is a member that may run
 * it (`execute`; or read it, as the standard library's Fos users may): the world (`audience:public`) or every Fos
 * user (`audience:users`); a person or a group is the same with their own peer. What a visitor sees is the node's
 * execute view (`sharedProjection`), and their inputs are stored in typed refs on it. A published template is an
 * endpoint: each visitor who starts it gets a private execution, a node of which only that visitor is a member.
 */
import { nodeLinkMaskAt } from './node-provider'
import { argumentRefs, capabilityPeers } from './bindings'
import { evaluationRecord, readNodeValue, writeNodeValue, writeLinkedNodeValue } from './evaluation'
import { addMemberAt, createReplica, deleteTask, homePath, addRow, proposeRefAt, renameTask, resolveRef, headCid, removeMemberAt, setMemberCapabilitiesAt, view, type Replica } from './replica'
import { FosStore } from '../dag-implementation/store'
import type { FosPathElem } from '../types'
import { plainEdge } from './patterns'
import { FIELD_TYPES, MARKDOWN_TYPE, PEER_TYPE, VISITOR_SUBMISSION } from './published-types'
export * from './published-types'
import { PLAIN_TYPE, REF_TYPE, TEMPLATE_TYPE } from './library-types'
import { aliasIdOf, identityCid, capabilityTarget, nestScope, commitRoot, content, hasCapability, importNodes, makeLink, memberFor, proposalContent, put, reachableNodes, readMembers, readProposals, resolveScope, isRefNode, refValueCid, rootTargetCid, updateAtScope, valueContent, withProposal, type Capability, type Scope } from './graph'

/** A visitor's private execution of a published template: the visitor, the endpoint it came from, its audience. */
export const EXECUTION_ARGUMENT = 'fos:execution'
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
  const execution = readNodeValue<Execution>(r, path, EXECUTION_ARGUMENT)
  if (execution && typeof execution.peer === 'string' && AUDIENCES.includes(execution.audience)) return { audience: execution.audience, template: false, execution }
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
/** The row the account server keeps for a published node in its member entry above it (`fos:peer:fos`): the node's URL. */
export const publishedUrlId = (aliasId: string) => `fos:url:${aliasId}`
/** The share page's address for a node: the web app with the owner and the node's path. */
export function nodeUrl(webUrl: string, address: SharedAddress): string {
  return `${webUrl.replace(/\/$/, '')}/#share=${encodeURIComponent(JSON.stringify(address))}`
}
/** The server's member entry nearest above `path` (where its rows for the node live), or null. */
function serverEntry(r: Replica, path: Scope): Scope | null {
  for (let i = path.length; i >= 0; i--) {
    const at = path.slice(0, i), cid = resolveScope(r.store, headCid(r), at)
    if (cid && readMembers(r.store, content(r.store, cid)).some(m => m.peerId === 'fos')) return [...at, `fos:peer:fos`]
  }
  return null
}
/**
 * The account server's `url` handler: for the node at `path` and each node above it, a published node (an audience
 * may run or read it) gets its URL as a row in the server's member entry above it, and a node no longer published
 * loses it. The owner's devices receive that entry like any member entry, so the link is graph data, not a route.
 */
export function syncPublishedUrls(r: Replica, path: Scope, webUrl: string, now: number): Replica {
  const owner = r.meta.peerId.startsWith('user:') ? r.meta.peerId.slice(5) : null
  if (!owner) return r
  for (let i = path.length; i >= 1; i--) {
    const at = path.slice(0, i)
    if (at.some(id => id.startsWith('fos:peer:'))) continue
    const entry = serverEntry(r, at)
    if (!entry || !resolveScope(r.store, headCid(r), entry)) continue
    const id = publishedUrlId(at.at(-1)!), url = nodeUrl(webUrl, { owner, path: at })
    const row = view(r, entry)?.tasks.find(t => t.id === id)
    if (publication(r, at) && !readNodeValue(r, at, EXECUTION_ARGUMENT)) {
      if (!row) r = addRow(r, entry, PLAIN_TYPE, url, now, { id })
      else if (row.title !== url) r = renameTask(r, entry, id, url, now)
    } else if (row) r = deleteTask(r, entry, id, now)
  }
  return r
}
/** The URL the account server made for the published node at `path` (its row in the server's entry above), or null. */
export function publishedUrl(r: Replica, path: Scope): string | null {
  if (!path.length) return null
  const id = publishedUrlId(path.at(-1)!)
  for (let i = path.length; i >= 0; i--) {
    const entry = [...path.slice(0, i), 'fos:peer:fos']
    const row = resolveScope(r.store, headCid(r), entry) ? view(r, entry)?.tasks.find(t => t.id === id) : undefined
    if (row?.title) return row.title
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
  return writeNodeValue(r, path, EXECUTION_ARGUMENT, execution, now)
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
export type SharedInput = { key: string; name: string; kind: 'text' | 'ref' | 'allocation' | 'confirmation' | 'choice'; path?: Scope; options?: string[]; direction?: 'provide' | 'consume'; type?: string; unit?: string; amount?: number; start?: number; end?: number; role?: 'input' | 'output' }
export type Participation = {
  peer: string; name?: string; labels?: Record<string, string>; audience: string; revision: string; updated: number
  approvals: string[]; ranking: string[]; fields: Record<string, string | boolean | number | { amount: number; type: string; unit: string; start?: number; end?: number }>
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
  const text = argumentRefs(r.store, cid).filter(a => a.type === r.store.primitive.documentField.getId() && !refValueCid(r.store, content(r.store, a.cid)) && a.name && !a.name.startsWith('fos:')).map(a => ({ key: content(r.store, a.cid).data.alias!.id, name: a.name!, kind: 'text' as const }))
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
  const walk = (path: Scope, depth: number) => {
    if (depth > 8 || result.length >= 32) return
    const cid = resolveScope(r.store, headCid(r), path)
    for (const arg of cid ? argumentRefs(r.store, cid) : []) {
      const ref = content(r.store, arg.cid), id = ref.data.alias?.id
      if (!id || arg.name?.startsWith('fos:') || ref.data.refExpression) continue
      const relative = [...path.slice(root.length), id]
      if (!refValueCid(r.store, ref)) result.push({ key: JSON.stringify(relative), path: relative, name: arg.name ?? id,
        kind: arg.type === r.store.primitive.documentField.getId() ? 'text' : 'ref', type: arg.type, role: ref.data.refRole ?? 'input' })
      else walk([...path, id], depth + 1)
    }
    for (const row of view(r, path)?.tasks ?? []) {
      if (result.length >= 32) break
      const req = row.requirement, relative = [...path.slice(root.length), row.id]
      if (row.allocation && !view(r, path)?.tasks.some(t => t.supply?.ref === row.id) && !readNodeValue(r, [...path, row.id], 'fos:consumed')) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: 'allocation', direction: 'consume', type: row.allocation.type, unit: row.allocation.unit, amount: row.allocation.amount, start: row.allocation.start, end: row.allocation.end })
      if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability)) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
      if (row.refId === undefined && row.type !== TEMPLATE_TYPE) walk([...path, row.id], depth + 1)
    }
  }
  const current = root.length ? view(r, root.slice(0, -1))?.tasks.find(row => row.id === root.at(-1)) : null
  const req = current?.requirement
  if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability)) result.push({ key: '[]', path: [], name: current!.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
  if (current?.allocation && !readNodeValue(r, root, 'fos:consumed')) result.push({ key: '[]', path: [], name: current.title, kind: 'allocation', direction: 'consume', ...current.allocation })
  walk(root, 0); return result.slice(0, 32)
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
  const base = put(store, valueContent(store, cid)), draftStore = new FosStore()
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

/** Keep the foreign identity on the ordinary ref; its target contains only the permitted projection. */
export function writeParticipation(r: Replica, path: Scope, record: Participation, now: number): Replica {
  return writeLinkedNodeValue(r, path, `fos:guest:${record.peer}`, record, now, record.account ? { state: { owner: record.account.owner, id: record.account.ref } } : {})
}

export function participation(r: Replica, path: Scope, peer: string): Participation | null {
  const value = readNodeValue<Participation>(r, path, `fos:guest:${peer}`)
  return value && value.peer === peer && Array.isArray(value.approvals) && value.approvals.every(v => typeof v === 'string') && Array.isArray(value.ranking) && value.ranking.every(v => typeof v === 'string') && value.fields && typeof value.fields === 'object' ? value : null
}
/** Everyone who took part: members with a record, and audience members (implicit, see `memberFor`) whose record is on the node. */
export function participants(r: Replica, path: Scope): Participation[] {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return []
  const peers = new Set([...(view(r, path)?.members ?? []).map(m => m.peerId), ...argumentRefs(r.store, cid).flatMap(a => a.name?.startsWith('fos:guest:') ? [a.name.slice('fos:guest:'.length)] : [])])
  return [...peers].flatMap(peer => { const record = participation(r, path, peer); return record ? [record] : [] })
}
/** The row edge with alias `id` among the rows of the node at `parent`. */
export function childRowEdge(store: FosStore, parent: string | null, id: string): FosPathElem | null {
  if (!parent) return null
  return valueContent(store, parent).children.find(edge => {
    try { const cid = identityCid(store, edge); return (aliasIdOf(content(store, cid)) ?? aliasIdOf(valueContent(store, cid))) === id } catch { return false }
  }) ?? null
}
/** The library row type a row is made from (its view's `type`, the left node's id), when it is one: what a published page renders by. */
const libraryType = (row: { type: string } | null | undefined): string | undefined => row?.type.startsWith('lib:type:') ? row.type : undefined
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
  const markdown = (row: { text?: { mediaType?: string } } | null | undefined) => row?.text?.mediaType === 'text/markdown'
  const store = r.store, edgeAt = (at: Scope) => at.length ? childRowEdge(store, resolveScope(store, headCid(r), at.slice(0, -1)), at.at(-1)!) : null
  const page = present(current?.title ?? node.name ?? 'Shared node', libraryType(current), textVisible(path), markdown(current))
  const walk = (at: Scope, depth: number, presented: string[] | undefined) => {
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
      if (edge && content(store, identityCid(store, edge)).data.name && !(type && (FIELD_TYPES.includes(type) || type === MARKDOWN_TYPE))) continue
      hashed.push({ id: row.id, title: shown ? row.title.slice(0, 8000) : '', type: row.type, depth })
      if (type && FIELD_TYPES.includes(type)) {
        // a field of its row's product: the one the row presents (a note's body) is already shown by the row; an
        // empty one is asked of the visitor, who submits a candidate value
        const label = edge ? valueContent(store, identityCid(store, edge)).data.name?.content ?? '' : ''
        if (presented?.length === 1 && presented[0] === label) continue
        const relative = childPath.slice(path.length)
        rows.push({ id: row.id, depth, type, title: label, ...(shown ? { body: row.title.slice(0, 8000) } : {}) })
        if (shown && !row.title.trim() && type !== PEER_TYPE) fields.push({ key: JSON.stringify(relative), path: relative, name: label || 'Value', kind: 'text' })
        continue
      }
      if (type === MARKDOWN_TYPE && !row.title.trim()) continue
      rows.push({ id: row.id, depth, ...present(row.title, type, shown, markdown(row)) })
      const definition = edge && store.table.has(plainEdge(store, edge)[0]) ? content(store, plainEdge(store, edge)[0]) : null
      // Reference targets, arguments, membership, previous versions and private inputs are never exported.
      if (row.refId === undefined) walk([...at, row.id], depth + 1, definition?.data.form?.title)
    }
  }
  const own = edgeAt(path)
  walk(path, 0, own && store.table.has(plainEdge(store, own)[0]) ? content(store, plainEdge(store, own)[0]).data.form?.title : undefined)
  // visitors' own submissions are the owner's to review, not options other visitors vote on
  const proposals = node.proposals.filter(p => p.status === 'open' && p.name !== VISITOR_SUBMISSION).slice(0, 100).map(p => ({ id: `proposal:${p.id}`, label: `${p.name ?? 'Peer'}: ${[...p.summary.added.map(t => `adds ${t}`), ...p.summary.changed.map(t => `changes ${t}`), ...p.summary.removed.map(t => `removes ${t}`)].join('; ') || 'proposed changes'}` }))
  const inputs = ((policy.execution || interactive) ? executionInputs(r, path) : [...sharedInputs(r, path), ...fields].slice(0, 32)).filter(field => { const at = [...path, ...(field.path ?? [field.key])]; return visible(at) && textVisible(at) })
  const key = revision({ audience: policy.audience, title: current?.title ?? node.name, rows: hashed, inputs, proposals })
  const counts: Record<string, number> = {}, rankings: Record<string, number> = {}
  const cid = resolveScope(r.store, headCid(r), path)!
  void cid
  const active = participants(r, path).filter(p => p.audience === audiencePeer(policy.audience) && p.revision === key && mayParticipate(r, path, p.peer, 'read'))
  for (const p of active) {
    if (mayParticipate(r, path, p.peer, 'edit')) for (const id of p.approvals) counts[id] = (counts[id] ?? 0) + 1
    if (mayParticipate(r, path, p.peer, 'rank')) p.ranking.forEach((id, i) => { rankings[id] = (rankings[id] ?? 0) + p.ranking.length - i })
  }
  return { ...((policy.execution || interactive) ? { execution: evaluationRecord(r, path) ?? { status: 'idle' } } : {}), ...page, title: page.title || 'Shared node', ...(policy.template ? { template: true as const } : {}), rows, inputs, proposals, revision: key, audience: policy.audience, counts, rankings, participants: active.length }
}

/** The sub-peer row for another account below this one's Home (their peer id is its member), created on demand. */
export function subPeerRowAt(r: Replica, owner: string, now: number): { replica: Replica; path: Scope } {
  const home = homePath(r), peer = `user:${owner}`, hostId = `shared-host:${owner}`
  let host = (view(r, home)?.tasks ?? []).find(row => row.id === hostId || (row.requirement?.capability === 'peer' && row.requirement.peer === peer))
  if (!host) {
    r = addRow(r, home, PLAIN_TYPE, owner, now, { id: hostId })
    host = view(r, home)!.tasks.find(row => row.id === hostId)!
  }
  const hostPath = [...home, host.id]
  // the sub-peer: a member of this node (so the fos server tab lists them) and of its row, with nothing granted
  if (!view(r, home)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, home, peer, owner, [], now)
  if (!view(r, hostPath)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, hostPath, peer, owner, [], now)
  return { replica: r, path: hostPath }
}

export const inviteRequestName = (title: string) => `invite: ${title}`

/**
 * Another account made this one a member of a node: the request lands as a *proposal* by that account on its sub-peer
 * row below Home (the fos server relays it), adding the node as a foreign ref there. Nothing is granted to the
 * inviter, and the ref appears only when this account accepts the proposal (`decide`); until then it is a pending
 * submission like any other.
 */
export function ensureInviteRequest(r: Replica, owner: string, aliasId: string, title: string, now: number): { replica: Replica; path: Scope; proposalCid: string | null } {
  const peer = `user:${owner}`, linkId = `member:${aliasId}`, name = inviteRequestName(title || owner)
  const sub = subPeerRowAt(r, owner, now)
  r = sub.replica
  const hostPath = sub.path
  if (resolveRef(r, linkId)) return { replica: r, path: hostPath, proposalCid: null }
  const store = r.store, root = headCid(r), hostCid = resolveScope(store, root, hostPath)!
  const identity = content(store, hostCid)
  const pending = readProposals(store, identity).find(p => p.peerId === peer && p.name === name && p.status === 'open')
  if (pending) return { replica: r, path: hostPath, proposalCid: pending.cid }
  // the proposal's content: the row's current value plus the ref, built in a scratch store rooted at that value
  const base = put(store, valueContent(store, hostCid)), draftStore = new FosStore()
  importNodes(draftStore, reachableNodes(store, [base]))
  commitRoot(draftStore, base, now)
  nestScope(draftStore, { store, root, at: hostPath })
  const draft = addRow(createReplica(peer, draftStore), [], REF_TYPE, title, now, { id: linkId, refOwner: owner, refId: aliasId })
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
  const home = homePath(r), peer = `user:${address.owner}`, hostId = `shared-host:${address.owner}`, linkId = `shared:${address.owner}:${address.path.at(-1) ?? 'root'}`
  const existing = resolveRef(r, linkId)
  if (existing) return { replica: r, path: [...existing.path, existing.row.id] }
  let host = (view(r, home)?.tasks ?? []).find(row => row.id === hostId || (row.requirement?.capability === 'peer' && row.requirement.peer === peer))
  if (!host) {
    r = addRow(r, home, PLAIN_TYPE, anonymous ? 'Host' : address.owner, now, { id: hostId })
    host = view(r, home)!.tasks.find(row => row.id === hostId)!
  }
  const hostPath = [...home, host.id]
  if (!view(r, hostPath)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, hostPath, peer, anonymous ? 'Host' : address.owner, [], now)
  r = addRow(r, hostPath, REF_TYPE, title, now, { id: linkId, refOwner: address.owner, refId: address.path.at(-1) ?? 'root' })
  const path = [...hostPath, linkId]
  r = writeNodeValue(r, path, 'fos:shared-link', address, now)
  return { replica: r, path }
}
