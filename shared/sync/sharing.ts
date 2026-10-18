/** Public participation is a projection of an ordinary node, with inputs stored in typed refs. */
import { nodeAuthorityAt } from './node-context'
import { nodeLinkMaskAt } from './node-provider'
import { argumentRefs, capabilityPeers } from './bindings'
import { readNodeValue, writeNodeValue, writeLinkedNodeValue } from './evaluation'
import { addMemberAt, createReplica, homePath, addRow, resolveRef, headCid, removeMemberAt, setMemberCapabilitiesAt, view, type Replica } from './replica'
import { FosStore } from '../dag-implementation/store'
import { capabilityTarget, commitRoot, content, hasCapability, importNodes, makeLink, proposalContent, put, reachableNodes, readProposals, resolveScope, refValueCid, rootTargetCid, updateAtScope, valueContent, withProposal, type Scope } from './graph'

export const SHARE_ARGUMENT = 'fos:sharing'
export const POLL_ARGUMENT = 'fos:poll'
export const audiencePeer = (audience: 'public' | 'users') => `audience:${audience}`
export type SharePolicy = { id: string; audience: 'public' | 'users'; enabled: boolean; template?: boolean; execution?: { peer: string; entry: SharedAddress } }
export type Poll = { mode: 'approval' | 'rank' }
export type SharedInput = { key: string; name: string; kind: 'text' | 'allocation' | 'confirmation' | 'choice'; path?: Scope; options?: string[]; direction?: 'provide' | 'consume'; type?: string; unit?: string; amount?: number; start?: number; end?: number }
export type Participation = {
  peer: string; name?: string; labels?: Record<string, string>; audience: string; revision: string; updated: number
  approvals: string[]; ranking: string[]; fields: Record<string, string | boolean | number | { amount: number; type: string; unit: string; start?: number; end?: number }>
  account?: { owner: string; ref: string }
}
export type SharedNode = {
  title: string; rows: Array<{ id: string; title: string; kind: string; depth: number }>
  inputs: SharedInput[]; options: Array<{ id: string; label: string }>; poll: Poll | null
  proposals: Array<{ id: string; label: string }>; revision: string
  audience: 'public' | 'users'; counts: Record<string, number>; rankings: Record<string, number>; participants: number
  execution?: { status: string; error?: string };
  mine?: Participation | null; capabilities?: string[]; sources?: Record<string, string>
}
export function sharing(r: Replica, path: Scope): SharePolicy | null {
  const value = readNodeValue<SharePolicy>(r, path, SHARE_ARGUMENT)
  if (!value || typeof value.id !== 'string' || !['public', 'users'].includes(value.audience) || typeof value.enabled !== 'boolean') return null
  return value
}
export function setSharing(r: Replica, path: Scope, policy: SharePolicy, now: number): Replica {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(policy.id) || !['public', 'users'].includes(policy.audience)) throw new Error('Invalid sharing policy.')
  const previous = sharing(r, path)
  if (previous && previous.audience !== policy.audience) r = removeMemberAt(r, path, audiencePeer(previous.audience), now)
  const peer = audiencePeer(policy.audience)
  if (policy.enabled && !view(r, path)?.members.some(m => m.peerId === peer)) {
    r = addMemberAt(r, path, peer, policy.audience === 'public' ? '👤 Anyone with the link' : '🌐 Fos users', ['read', 'approve', 'rank'], now)
    r = setMemberCapabilitiesAt(r, path, peer, ['read', 'approve', 'rank'], [], now)
  } else if (!policy.enabled) r = removeMemberAt(r, path, peer, now)
  return writeNodeValue(r, path, SHARE_ARGUMENT, policy, now)
}
export function configurePoll(r: Replica, path: Scope, mode: Poll['mode'], now: number): Replica {
  const row = path.length ? view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
  if (!['approval', 'rank'].includes(mode) || row?.requirement?.capability !== 'choice' || !row.requirement.options?.length || row.requirement.options.length > 100) throw new Error('A poll needs a choice requirement with 1–100 named options.')
  return writeNodeValue(r, path, POLL_ARGUMENT, { mode }, now, { peer: 'fos', type: capabilityTarget(r.store, 'poll') })
}
export function sharedInputs(r: Replica, path: Scope): SharedInput[] {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return []
  const text = argumentRefs(r.store, cid).filter(a => a.type === r.store.primitive.documentField.getId() && !refValueCid(r.store, content(r.store, a.cid)) && a.name && !a.name.startsWith('fos:')).map(a => ({ key: content(r.store, a.cid).data.alias!.id, name: a.name!, kind: 'text' as const }))
  const allocations = (view(r, path)?.tasks ?? []).flatMap(row => row.requirement?.capability === 'allocation' ? [{ key: row.id, name: row.title, kind: 'allocation' as const, type: row.requirement.resource ?? 'inventory', unit: row.requirement.unit ?? 'unit', amount: row.requirement.amount, ...(row.requirement.start !== undefined ? { start: row.requirement.start } : {}), ...(row.requirement.end !== undefined ? { end: row.requirement.end } : {}) }] : [])
  return [...text, ...allocations].slice(0, 32)
}
/** Only declared, unfilled inputs of an execution are writable by its visitor. */
export function executionInputs(r: Replica, root: Scope): SharedInput[] {
  const result: SharedInput[] = []
  const walk = (path: Scope, depth: number) => {
    if (depth > 8 || result.length >= 32) return
    for (const field of sharedInputs(r, path).filter(f => f.kind === 'text')) result.push({ ...field, key: JSON.stringify([...path.slice(root.length), field.key]), path: [...path.slice(root.length), field.key] })
    for (const row of view(r, path)?.tasks ?? []) {
      if (result.length >= 32) break
      const req = row.requirement, relative = [...path.slice(root.length), row.id]
      if (row.allocation && !view(r, path)?.tasks.some(t => t.supply?.ref === row.id) && !readNodeValue(r, [...path, row.id], 'fos:consumed')) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: 'allocation', direction: 'consume', type: row.allocation.type, unit: row.allocation.unit, amount: row.allocation.amount, start: row.allocation.start, end: row.allocation.end })
      if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability)) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
      if (row.kind !== 'ref' && row.kind !== 'template') walk([...path, row.id], depth + 1)
    }
  }
  const current = root.length ? view(r, root.slice(0, -1))?.tasks.find(row => row.id === root.at(-1)) : null
  const req = current?.requirement
  if (req && !req.satisfied && ['allocation', 'confirmation', 'choice'].includes(req.capability)) result.push({ key: '[]', path: [], name: current!.title, kind: req.capability as 'allocation' | 'confirmation' | 'choice', ...(req.capability === 'choice' ? { options: req.options } : {}), ...(req.capability === 'allocation' ? { type: req.resource ?? 'inventory', unit: req.unit ?? 'unit', amount: req.amount, start: req.start, end: req.end } : {}) })
  if (current?.allocation && !readNodeValue(r, root, 'fos:consumed')) result.push({ key: '[]', path: [], name: current.title, kind: 'allocation', direction: 'consume', ...current.allocation })
  walk(root, 0); return result.slice(0, 32)
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
export function sharedProjection(r: Replica, path: Scope, revision: (value: unknown) => string, peer?: string, interactive = false): SharedNode {
  const node = view(r, path), policy = sharing(r, path)
  if (!node || !policy) throw new Error('Shared node unavailable.')
  const visitor = peer ?? audiencePeer(policy.audience)
  const visible = (at: Scope) => { try { nodeAuthorityAt(r, at, { peerId: visitor, scope: path, capabilities: ['read'] }); return true } catch { return false } }
  const textVisible = (at: Scope) => { const mask = nodeLinkMaskAt(r, at, visitor); return !mask?.fields || mask.fields.includes('description') }
  const current = path.length ? view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
  const rows: SharedNode['rows'] = []
  const walk = (at: Scope, depth: number) => {
    if (depth > 8 || rows.length >= 200) return
    for (const row of view(r, at)?.tasks ?? []) {
      if (rows.length >= 200) break
      const childPath = [...at, row.id]
      if (!visible(childPath)) continue
      rows.push({ id: row.id, title: textVisible(childPath) ? row.title.slice(0, 8000) : '', kind: row.kind, depth })
      // Reference targets, arguments, membership, previous versions and private inputs are never exported.
      if (row.kind !== 'ref') walk([...at, row.id], depth + 1)
    }
  }
  walk(path, 0)
  const configured = readNodeValue<Poll>(r, path, POLL_ARGUMENT)
  const poll = configured && ['approval', 'rank'].includes(configured.mode) && current?.requirement?.capability === 'choice' && capabilityPeers(r, path, 'poll').includes('fos') ? configured : null
  const options = poll ? (current!.requirement!.options ?? []).slice(0, 100).map((label, index) => ({ id: `option:${index}`, label })) : []
  const proposals = node.proposals.filter(p => p.status === 'open').slice(0, 100).map(p => ({ id: `proposal:${p.id}`, label: `${p.name ?? 'Peer'}: ${[...p.summary.added.map(t => `adds ${t}`), ...p.summary.changed.map(t => `changes ${t}`), ...p.summary.removed.map(t => `removes ${t}`)].join('; ') || 'proposed changes'}` }))
  const inputs = ((policy.execution || interactive) ? executionInputs(r, path) : sharedInputs(r, path)).filter(field => { const at = [...path, ...(field.path ?? [field.key])]; return visible(at) && textVisible(at) })
  const key = revision({ policy: policy.id, title: current?.title ?? node.name, rows, inputs, options, poll, proposals })
  const counts: Record<string, number> = {}, rankings: Record<string, number> = {}
  const cid = resolveScope(r.store, headCid(r), path)!
  const active = participants(r, path).filter(p => p.audience === policy.id && p.revision === key && hasCapability(r.store, content(r.store, cid), p.peer, 'read'))
  for (const p of active) {
    if (hasCapability(r.store, content(r.store, cid), audiencePeer(policy.audience), 'approve') && hasCapability(r.store, content(r.store, cid), p.peer, 'approve')) for (const id of p.approvals) counts[id] = (counts[id] ?? 0) + 1
    if (hasCapability(r.store, content(r.store, cid), audiencePeer(policy.audience), 'rank') && hasCapability(r.store, content(r.store, cid), p.peer, 'rank')) p.ranking.forEach((id, i) => { rankings[id] = (rankings[id] ?? 0) + p.ranking.length - i })
  }
  return { ...((policy.execution || interactive) ? { execution: readNodeValue<{ status: string; error?: string }>(r, path, 'fos:evaluation') ?? { status: 'idle' } } : {}), title: textVisible(path) ? (current?.title ?? node.name ?? 'Shared node').slice(0, 8000) : 'Shared node', rows, inputs, options, poll, proposals, revision: key, audience: policy.audience, counts, rankings, participants: active.length }
}

/** The sub-peer row for another account below this one's Home (their peer id is its member), created on demand. */
export function subPeerRowAt(r: Replica, owner: string, now: number): { replica: Replica; path: Scope } {
  const home = homePath(r), peer = `user:${owner}`, hostId = `shared-host:${owner}`
  let host = (view(r, home)?.tasks ?? []).find(row => row.id === hostId || (row.requirement?.capability === 'peer' && row.requirement.peer === peer))
  if (!host) {
    r = addRow(r, home, 'plain', owner, now, { id: hostId })
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
  const draft = addRow(createReplica(peer, draftStore), [], 'ref', title, now, { id: linkId, refOwner: owner, refId: aliasId })
  importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
  const proposalCid = put(store, proposalContent(store, peer, name, headCid(draft), base, now))
  commitRoot(store, updateAtScope(store, root, hostPath, current => withProposal(store, makeLink(store, current, now), peer, proposalCid, name), 'node'), now)
  void rootTargetCid
  return { replica: { ...r }, path: hostPath, proposalCid }
}

export type SharedAddress = { owner: string; path: Scope; share: string }
/** A received link is an ordinary foreign ref below its host peer in Home. No guest context is granted to the host. */
export function ensureSharedLink(r: Replica, address: SharedAddress, title: string, now: number, anonymous = false): { replica: Replica; path: Scope } {
  const home = homePath(r), peer = `user:${address.owner}`, hostId = `shared-host:${address.owner}`, linkId = `shared:${address.share}`
  const existing = resolveRef(r, linkId)
  if (existing) return { replica: r, path: [...existing.path, existing.row.id] }
  let host = (view(r, home)?.tasks ?? []).find(row => row.id === hostId || (row.requirement?.capability === 'peer' && row.requirement.peer === peer))
  if (!host) {
    r = addRow(r, home, 'plain', anonymous ? 'Host' : address.owner, now, { id: hostId })
    host = view(r, home)!.tasks.find(row => row.id === hostId)!
  }
  const hostPath = [...home, host.id]
  if (!view(r, hostPath)?.members.some(member => member.peerId === peer)) r = addMemberAt(r, hostPath, peer, anonymous ? 'Host' : address.owner, [], now)
  r = addRow(r, hostPath, 'ref', title, now, { id: linkId, refOwner: address.owner, refId: address.path.at(-1) ?? 'root' })
  const path = [...hostPath, linkId]
  r = writeNodeValue(r, path, 'fos:shared-link', address, now)
  return { replica: r, path }
}
