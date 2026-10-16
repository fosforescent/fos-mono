import { exchangeNodeContext } from './node-context'
import type { FosDataContent } from '../types'
import { content, valueContent, identityCid, rowKindOf, rowPrimitive, resolveScope, isHandle, isPeerReference,
  scopeBranches, branchSelection, isBranchChoice, readChoice, CAPABILITIES, putStripped, readProposals, proposalContent, withProposal, importNodes, reachableNodes, capabilityTarget, refValueCid, withMainBranchPolicy, ROW_KINDS, readMembers, updateAtScope, commitRoot, put, refNodeContent, bookkeepingOf, type Scope } from './graph'
import { loadReplica, serializeReplica, headCid, type Replica } from './replica'
import { provideNode, parseNodeRequest, nodeLinkEndpoint, setNodeLinkMask, nodeRequestLinkId, NodeAccessError,
  type NodeBranch, type NodeRequest, type NodeShape, type NodeChild, type ProvidedNode, type NodeAuthority } from './node-provider'

export type NodeSyncState = { local: NodeShape; remote: NodeShape & Pick<ProvidedNode, 'proposals' | 'grants'> }
const forbidden = new Set(['alias', 'ref', 'versionControl', 'disabledCapabilities', 'peerId', '__proto__', 'constructor', 'prototype'])
const empty = (): NodeShape => ({ data: {}, children: [] })
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const childValue = (child?: NodeChild) => child && { id: child.id, kind: child.kind, ...(child.kind === 'ref' ? { address: child.address } : {}) }
export const nodeSyncKey = (peer: string, path: Scope, branches?: NodeBranch[]): string => JSON.stringify(branches?.length ? [peer, path, [...branches].sort((a, b) => JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope)))] : [peer, path])

export function validateNodeShape(shape: NodeShape): void {
  if (!shape || !shape.data || typeof shape.data !== 'object' || Array.isArray(shape.data) || !Array.isArray(shape.children) || shape.children.length > 10000 ||
    Object.keys(shape.data).some(key => forbidden.has(key)) || shape.children.some(c => !c || typeof c.id !== 'string' || !c.id || c.id.length > 256 || !ROW_KINDS.includes(c.kind) ||
      !c.address || typeof c.address.peerId !== 'string' || !Array.isArray(c.address.scope) || c.address.scope.length > 64 || c.address.scope.some(id => typeof id !== 'string' || !id || id === '.' || id === '..')) ||
    new Set(shape.children.map(c => c.id)).size !== shape.children.length || JSON.stringify(shape).length > 1024 * 1024) throw new NodeAccessError('Invalid node update.')
}

/** A shallow value: no history, constructor bodies, or descendant content. */
export function nodeShape(r: Replica, path: Scope, root = headCid(r)): NodeShape {
  const cid = resolveScope(r.store, root, path)
  if (!cid || isHandle(content(r.store, cid))) return empty()
  const value = valueContent(r.store, cid)
  const children: NodeChild[] = []
  for (const edge of value.children) {
    const kind = rowKindOf(r.store, edge)
    if (!kind) continue
    const child = content(r.store, identityCid(r.store, edge)), id = child.data.alias?.id
    if (!id) continue
    const ref = isPeerReference(child) ? child.data.ref : undefined
    children.push({ id, kind: ref?.kind && ROW_KINDS.includes(ref.kind as NodeChild['kind']) ? ref.kind as NodeChild['kind'] : kind, address: { peerId: ref?.peer ?? r.meta.peerId, scope: ref?.scope ?? [...path, id], ...(ref?.branches ? { branches: ref.branches } : !ref && nodeBranches(r, path, false).length ? { branches: nodeBranches(r, path, false) } : {}) } })
  }
  return { data: Object.fromEntries(Object.entries(value.data).filter(([key]) => !forbidden.has(key))) as FosDataContent, children }
}

/** Three-way merge only fields/edges changed by the writer. Missing masked fields
 * are never interpreted as deletions. Conflicts leave both replicas untouched. */
export function mergeNodeShape(base: NodeShape, next: NodeShape, current: NodeShape): NodeShape {
  const data = { ...current.data } as Record<string, unknown>
  for (const key of new Set([...Object.keys(base.data), ...Object.keys(next.data)])) {
    const before = (base.data as Record<string, unknown>)[key], after = (next.data as Record<string, unknown>)[key], present = data[key]
    if (equal(before, after)) continue
    if (!equal(present, before) && !equal(present, after)) throw new NodeAccessError(`Concurrent change to node field "${key}". Local changes were kept.`)
    if (after === undefined) delete data[key]; else data[key] = after
  }
  const children = new Map(current.children.map(child => [child.id, child]))
  const old = new Map(base.children.map(child => [child.id, child])), desired = new Map(next.children.map(child => [child.id, child]))
  for (const id of new Set([...old.keys(), ...desired.keys()])) {
    const before = old.get(id), after = desired.get(id), present = children.get(id)
    if (equal(childValue(before), childValue(after))) continue
    if (!equal(childValue(present), childValue(before)) && !equal(childValue(present), childValue(after))) throw new NodeAccessError(`Concurrent change to child "${id}". Local changes were kept.`)
    if (after) children.set(id, after); else children.delete(id)
  }
  const beforeOrder = base.children.map(c => c.id), nextOrder = next.children.map(c => c.id)
  const common = new Set(beforeOrder.filter(id => desired.has(id) && children.has(id)))
  const originalOrder = beforeOrder.filter(id => common.has(id)), desiredOrder = nextOrder.filter(id => common.has(id)), currentOrder = current.children.map(c => c.id).filter(id => common.has(id))
  if (!equal(originalOrder, desiredOrder) && !equal(currentOrder, originalOrder) && !equal(currentOrder, desiredOrder)) throw new NodeAccessError('Concurrent child reorder. Local changes were kept.')
  const order = equal(beforeOrder, nextOrder) ? current.children.map(c => c.id) : nextOrder
  return { data: data as FosDataContent, children: [...new Set([...order, ...children.keys()])].flatMap(id => children.has(id) ? [children.get(id)!] : []) }
}
export function sameNodeShape(a: NodeShape, b: NodeShape): boolean {
  return equal(a.data, b.data) && equal(a.children.map(childValue), b.children.map(childValue))
}

/** Preserve existing child bodies and local metadata when replacing a shallow value. */
export function installNodeShape(r: Replica, path: Scope, shape: NodeShape, now: number, restored = new Map<string, string>()): Replica {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new NodeAccessError('Node no longer exists.')
  const before = content(r.store, cid), held = isPeerReference(before)
  const value = held ? { data: {}, children: [] } : valueContent(r.store, cid)
  const existing = new Map(value.children.filter(e => rowKindOf(r.store, e)).map(e => [content(r.store, identityCid(r.store, e)).data.alias?.id, e]))
  const children = shape.children.map(child => {
    const edge = existing.get(child.id)
    if (edge) return rowKindOf(r.store, edge) === child.kind ? edge : [identityCid(r.store, edge), rowPrimitive(r.store, child.kind)] as [string, string]
    if (restored.has(child.id)) return [restored.get(child.id)!, rowPrimitive(r.store, child.kind)] as [string, string]
    const stub = put(r.store, { data: { alias: { id: child.id }, ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', kind: child.kind, scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } }, children: [] })
    return [stub, rowPrimitive(r.store, child.kind)] as [string, string]
  })
  const next = { data: { ...Object.fromEntries(Object.entries(value.data).filter(([key]) => forbidden.has(key))), ...shape.data }, children: [...value.children.filter(e => !rowKindOf(r.store, e)), ...children] }
  const root = held
    ? updateAtScope(r.store, headCid(r), path, () => refNodeContent(r.store, { alias: before.data.alias }, put(r.store, next), bookkeepingOf(r.store, before)), 'replace')
    : updateAtScope(r.store, headCid(r), path, () => next)
  if (root !== headCid(r)) commitRoot(r.store, root, now)
  return { ...r }
}

function allowedToEdit(r: Replica, path: Scope, authority: NodeAuthority): boolean {
  let allowed = authority.owner === true
  for (let i = authority.scope.length; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) return false
    const member = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
    if (member) allowed = member.capabilities.includes('edit') && !member.disabled?.includes('edit')
  }
  return allowed
}

/** Same request on HTTP, RTC, and virtual channels. Authorization is rechecked on
 * every node; the transport must serialize load/modify/save. */
export function exchangeNode(r: Replica, input: NodeRequest, authority: NodeAuthority, now: number): { replica: Replica; node: ProvidedNode } {
  const request = parseNodeRequest(input)
  if (request.branches?.length || request.proposal) return exchangeNodeContext(r, request, authority, now, exchangeNode)
  return withMainBranchPolicy(r.store, () => authority.proposeOnly ? exchangeProposedNode(r, input, authority, now) : exchangeNodeOnMain(r, input, authority, now))
}

function exchangeNodeOnMain(r: Replica, input: NodeRequest, authority: NodeAuthority, now: number): { replica: Replica; node: ProvidedNode } {
  const request = parseNodeRequest(input)
  if (request.update) { validateNodeShape(request.update.base); validateNodeShape(request.update.value) }
  const served = provideNode(r, request, authority, now)
  if (!request.update) return served
  if (!authority.capabilities.includes('sync')) throw new NodeAccessError('Peer does not accept node synchronization.')
  const path = [...request.scope, ...request.path]
  if (!allowedToEdit(r, path, authority)) throw new NodeAccessError('Node editing is not permitted.')
  r = served.replica
  if (sameNodeShape(request.update.base, request.update.value)) return served
  // Enforce every ancestor mask on writes as well as reads.
  for (let i = authority.scope.length; i <= path.length; i++) {
    const mask = nodeLinkEndpoint(r, path.slice(0, i), request.peerId)?.mask
    if (!mask) continue
    if (mask.fields && [...new Set([...Object.keys(request.update.base.data), ...Object.keys(request.update.value.data)])].some(k => !mask.fields!.includes(k))) throw new NodeAccessError('Node field is masked.')
    if (i < path.length && mask.children && !mask.children.includes(path[i]!)) throw new NodeAccessError('Node child is masked.')
    if (i === path.length && mask.children && [...request.update.base.children, ...request.update.value.children].some(c => !mask.children!.includes(c.id))) throw new NodeAccessError('Node child is masked.')
  }
  const merged = mergeNodeShape(request.update.base, request.update.value, served.node)
  const full = nodeShape(r, path)
  // Apply the visible delta to the complete local node, retaining hidden children.
  const final = mergeNodeShape(served.node, merged, full)
  const restored = new Map<string, string>()
  for (const child of final.children) {
    if (full.children.some(c => c.id === child.id)) continue
    // Newly introduced addresses must belong to the authenticated writer.
    if (child.address.peerId !== request.peerId) {
      const cid = authority.owner && child.address.peerId === r.meta.peerId && equal(child.address.scope, [...path, child.id]) ? historicalChild(r, [...path, child.id]) : null
      if (!cid) throw new NodeAccessError('New child must be provided by the writing peer.')
      restored.set(child.id, cid)
    }
  }
  if (!sameNodeShape(full, final)) r = installNodeShape(r, path, final, now, restored)
  return provideNode(r, { ...request, update: undefined }, authority, now)
}

export function materializedNodePaths(r: Replica, at: Scope): Scope[] {
  const paths: Scope[] = [], queue = [at]
  while (queue.length) {
    const path = queue.pop()!, cid = resolveScope(r.store, headCid(r), path)
    if (!cid || isHandle(content(r.store, cid))) continue
    paths.push(path)
    for (const child of nodeShape(r, path).children) if (child.kind !== 'ref') queue.push([...path, child.id])
  }
  return paths.sort((a, b) => a.length - b.length)
}

/** Persistence boundaries are inherited; neither a dirty descendant nor an
 * explicit load can cause a private subtree to be uploaded to Fos. */
export function nodePersistenceAllowed(r: Replica, path: Scope): boolean {
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) return false
    if (readMembers(r.store, content(r.store, cid)).some(m => m.peerId === 'fos' && m.disabled?.includes('persist'))) return false
  }
  return true
}

export function rememberNodeSync(r: Replica, path: Scope, remote: ProvidedNode, local = nodeShape(r, path)): Replica {
  return { ...r, meta: { ...r.meta, serverPeerId: r.meta.serverPeerId ?? remote.peerId,
    nodeSync: { ...r.meta.nodeSync, [nodeSyncKey(remote.peerId, path, remote.address.branches)]: { local, remote: { data: remote.data, children: remote.children, proposals: remote.proposals, grants: remote.grants } } } } }
}

export function nodeSyncRequest(r: Replica, path: Scope, peer: string, scope: Scope, remotePath: Scope): NodeRequest {
  return { peerId: r.meta.peerId, scope, path: remotePath,
    linkId: nodeLinkEndpoint(r, path, peer)?.id ?? nodeRequestLinkId(r.meta.peerId, { peerId: peer, scope: [...scope, ...remotePath] }) }
}

/** Filter outgoing edits through this endpoint, independently of the remote mask. */
export function outgoingNodeShape(r: Replica, path: Scope, peer: string, shape: NodeShape): NodeShape {
  let fields: string[] | undefined, children: string[] | undefined
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    const member = cid && readMembers(r.store, content(r.store, cid)).find(m => m.peerId === peer)
    if (member && (member.disabled?.includes('read') || member.disabled?.includes('provideNode') || (!member.capabilities.includes('read') && !member.capabilities.includes('edit')))) throw new NodeAccessError('Local node access denied.')
    const mask = nodeLinkEndpoint(r, path.slice(0, i), peer)?.mask
    if (mask?.fields) fields = fields ? fields.filter(f => mask.fields!.includes(f)) : mask.fields
    if (i < path.length && mask?.children && !mask.children.includes(path[i]!)) throw new NodeAccessError('Local link masks this child.')
    if (i === path.length) children = mask?.children
  }
  return { data: Object.fromEntries(Object.entries(shape.data).filter(([key]) => !fields || fields.includes(key))) as FosDataContent,
    children: shape.children.filter(c => !children || children.includes(c.id)) }
}

export function establishNodeSync(r: Replica, path: Scope, request: NodeRequest, remote: ProvidedNode, now: number): Replica {
  const mask = nodeLinkEndpoint(r, path, remote.peerId)?.mask ?? {}
  return setNodeLinkMask(r, path, remote.peerId, remote.linkId, mask, now, request.linkId)
}

/** Proposal-only attachments exchange shallow nodes on their own pending value.
 * Main grants are checked before consulting that value, and main content never
 * changes until the existing proposal approval operation is used. */
function exchangeProposedNode(r: Replica, input: NodeRequest, authority: NodeAuthority, now: number): { replica: Replica; node: ProvidedNode } {
  const request = parseNodeRequest(input), path = [...request.scope, ...request.path]
  if (request.peerId !== authority.peerId || !equal(request.scope, authority.scope)) throw new NodeAccessError('Node request is outside the attachment.')
  let read = authority.owner === true, edit = authority.owner === true
  let grants = authority.owner ? CAPABILITIES : []
  for (let i = authority.scope.length; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) { if (i === authority.scope.length) throw new NodeAccessError('Attachment unavailable.'); break }
    const member = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
    if (member) {
      grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
      read = !member.disabled?.includes('read') && !member.disabled?.includes('provideNode') && (member.capabilities.includes('read') || member.capabilities.includes('edit'))
      edit = member.capabilities.includes('edit') && !member.disabled?.includes('edit')
    }
    if (!read) throw new NodeAccessError('Node access denied.')
    if (i < path.length && isHandle(content(r.store, cid))) throw new NodeAccessError('Reference targets require their own attachment.')
  }
  if (!read || (request.update && !edit)) throw new NodeAccessError('Node editing is not permitted.')
  const attachment = resolveScope(r.store, headCid(r), authority.scope)!
  const main = content(r.store, attachment), base = putStripped(r.store, main)
  const existing = readProposals(r.store, main).find(p => p.peerId === authority.peerId && p.name === 'node-sync')
  if (!existing && !request.update) return provideNode(r, request, authority, now)
  // Work on an isolated store so errors cannot mutate main or its pending value.
  let fork = loadReplica(serializeReplica(r))
  if (existing) commitRoot(fork.store, updateAtScope(fork.store, headCid(fork), authority.scope, () => content(fork.store, existing.contentCid), 'replace'), now)
  const before = resolveScope(fork.store, headCid(fork), authority.scope)!
  const served = exchangeNodeOnMain(fork, request, { ...authority, proposeOnly: false, owner: true }, now)
  fork = served.replica
  const after = resolveScope(fork.store, headCid(fork), authority.scope)!
  // Import local graph records only; the wire response remains a single node.
  importNodes(r.store, reachableNodes(fork.store, [fork.store.rootNodeId]))
  if (after !== before) {
    const value = putStripped(r.store, content(r.store, after))
    const proposal = put(r.store, proposalContent(r.store, authority.peerId, 'node-sync', value, existing?.baseCid ?? base, now))
    const next = withProposal(r.store, main, authority.peerId, proposal, 'node-sync')
    commitRoot(r.store, updateAtScope(r.store, headCid(r), authority.scope, () => next, 'node'), now)
  }
  const type = capabilityTarget(r.store, 'provideNode'), root = content(r.store, r.store.rootNodeId)
  const endpoints = content(fork.store, fork.store.rootNodeId).children.filter(e => e[0] === type)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => e[0] !== type), ...endpoints] })
  served.node.grants = grants
  served.node.children = served.node.children.filter(child => {
    const cid = resolveScope(r.store, headCid(r), [...path, child.id])
    const member = cid && readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
    return !member || (!member.disabled?.includes('read') && !member.disabled?.includes('provideNode') && (member.capabilities.includes('read') || member.capabilities.includes('edit')))
  })
  return { replica: { ...r }, node: served.node }
}

/** Account-owner undo may restore a prior child from this exact attachment,
 * never an arbitrary hash or another scope supplied by the caller. */
function historicalChild(r: Replica, path: Scope): string | null {
  let root: string | undefined = r.store.rootNodeId
  const seen = new Set<string>()
  while (root && !seen.has(root) && seen.size < 256) {
    seen.add(root)
    const node = content(r.store, root), target = refValueCid(r.store, node)
    const cid = target && resolveScope(r.store, target, path)
    if (cid) return cid
    root = node.children.find(e => e[0] === r.store.primitive.previousVersion.getId())?.[1]
  }
  return null
}

/** Branch context of a local node, expressed in its peer's address space. */
export function nodeBranches(r: Replica, path: Scope, remote = true): NodeBranch[] {
  const result: NodeBranch[] = []
  const offset = remote ? r.meta.scope : []
  const root = r.meta.localScope ?? []
  if (r.meta.branch) result.push({ scope: [...offset, ...root], name: r.meta.branch })
  const selections = scopeBranches(r.store, headCid(r), path)
  for (let i = root.length; i <= path.length; i++) {
    const name = selections[path[i - 1]!]
    const scope = [...offset, ...path.slice(0, i)]
    if (name && !result.some(b => JSON.stringify(b.scope) === JSON.stringify(scope))) result.push({ scope, name })
  }
  return result
}

/** A new local alternative starts from its recorded branch base, not an empty
 * document; first sync must send only edits made since branching. */
export function nodeBranchBase(r: Replica, path: Scope): NodeShape | null {
  for (let i = path.length; i >= 0; i--) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid || !isBranchChoice(r.store, content(r.store, cid))) continue
    const choice = readChoice(r.store, cid), name = branchSelection(r.store, cid)
    const base = choice.options.find(o => o.peerId === name)?.base
    if (name !== 'main' && base) return nodeShape(r, path.slice(i), identityCid(r.store, base))
  }
  return null
}
