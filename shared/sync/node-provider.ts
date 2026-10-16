import type { FosDataContent } from '../types'
import { hashContent } from '../dag-implementation/cid'
import { content, put, refNodeContent, refValueCid, capabilityTarget, commitRoot, updateAtScope, resolveScope, rowPrimitive, bookkeepingOf, rootTargetCid, withPeer,
  valueContent, readMembers, isHandle, isPeerReference, isBookkeepingEdge, rowKindOf, identityCid, withMainBranchPolicy,
  readProposals, CAPABILITIES, type ProposalView, ROW_KINDS, type Capability, type Scope, type RowKind } from './graph'
import { headCid, type Replica } from './replica'

/** Each endpoint owns its mask. Omitting an allowlist allows all; [] allows none. */
export type NodeMask = { fields?: string[]; children?: string[] }
export type NodeBranch = { scope: Scope; name: string }
export type NodeAddress = { peerId: string; scope: Scope; branches?: NodeBranch[] }
export type NodeRequest = { peerId: string; scope: Scope; path: Scope; linkId: string; branches?: NodeBranch[]; proposal?: { scope: Scope; id: string }; update?: { base: NodeShape; value: NodeShape } }
export type NodeShape = { data: FosDataContent; children: NodeChild[] }
export type NodeChild = { id: string; kind: RowKind; address: NodeAddress }
export type ProvidedNode = {
  peerId: string; linkId: string; remoteLinkId: string; address: NodeAddress
  data: FosDataContent; children: NodeChild[]; mask?: NodeMask; proposals?: ProposalView[]; grants?: Capability[]
}
export type NodeAuthority = {
  /** Supplied by the authenticated transport, never by the request body. */
  peerId: string
  scope: Scope
  owner?: boolean
  proposeOnly?: boolean
  capabilities: Capability[]
}
const LINK_NAME = 'fos:node-link:'
const forbiddenFields = new Set(['alias', 'ref', 'versionControl', 'disabledCapabilities', 'peerId'])
export class NodeAccessError extends Error {}

function validPath(value: unknown): value is Scope {
  return Array.isArray(value) && value.length <= 64 && value.every(id => typeof id === 'string' && !!id && id.length <= 256 && id !== '.' && id !== '..')
}
export function parseNodeRequest(value: unknown): NodeRequest {
  const r = value as NodeRequest
  if (!r || typeof r !== 'object' || typeof r.peerId !== 'string' || !r.peerId || r.peerId.length > 128 ||
    !validPath(r.scope) || !validPath(r.path) || typeof r.linkId !== 'string' || !r.linkId || r.linkId.length > 256) throw new NodeAccessError('Invalid node request.')
  if (r.branches !== undefined && (!Array.isArray(r.branches) || r.branches.length > 64 || r.branches.some(b => !b || !validPath(b.scope) || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200) || new Set(r.branches.map(b => JSON.stringify(b.scope))).size !== r.branches.length)) throw new NodeAccessError('Invalid branch context.')
  if (r.proposal !== undefined && (!r.proposal || !validPath(r.proposal.scope) || typeof r.proposal.id !== 'string' || !r.proposal.id || r.proposal.id.length > 256 || r.update)) throw new NodeAccessError('Proposal previews are read-only.')
  return { peerId: r.peerId, scope: [...r.scope], path: [...r.path], linkId: r.linkId, ...(r.branches?.length ? { branches: r.branches.map(b => ({ scope: [...b.scope], name: b.name })) } : {}), ...(r.proposal ? { proposal: { ...r.proposal, scope: [...r.proposal.scope] } } : {}), ...(r.update !== undefined ? { update: r.update } : {}) }
}
function maskOf(value: unknown): NodeMask {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeAccessError('Invalid node mask.')
  const mask = value as NodeMask
  for (const list of [mask.fields, mask.children]) if (list !== undefined && (!Array.isArray(list) || list.length > 10000 || list.some(v => typeof v !== 'string'))) throw new NodeAccessError('Invalid node mask.')
  return { ...(mask.fields ? { fields: [...new Set(mask.fields)] } : {}), ...(mask.children ? { children: [...new Set(mask.children)] } : {}) }
}
function sourceId(r: Replica, path: Scope): string {
  if (!path.length) return content(r.store, r.store.rootNodeId).data.alias!.id
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new NodeAccessError('Linked node unavailable.')
  return content(r.store, cid).data.alias?.id ?? cid
}
const linkName = (r: Replica, peer: string, path: Scope) => LINK_NAME + JSON.stringify([peer, sourceId(r, path)])
const localLinkId = (peer: string, other: string, id: string) => hashContent({ data: { description: { content: JSON.stringify([peer, other, id]) } }, children: [] })

function linkAt(r: Replica, path: Scope, peer: string, remoteId: string) {
  // One endpoint per peer at a node. A caller cannot evade a mask by choosing a new link id.
  const name = linkName(r, peer, path)
  const edge = content(r.store, r.store.rootNodeId).children.find(e => e[0] === capabilityTarget(r.store, 'provideNode') && content(r.store, e[1]).data.name?.content === name)
  return edge ? { cid: edge[1] } : undefined
}
function readMask(r: Replica, path: Scope, peer: string, remoteId: string): NodeMask {
  const link = linkAt(r, path, peer, remoteId)
  if (!link) return {}
  const target = refValueCid(r.store, content(r.store, link.cid))
  if (!target) throw new NodeAccessError('Node link has no policy.')
  try { return maskOf(JSON.parse(content(r.store, target).data.description?.content ?? 'null')) }
  catch { throw new NodeAccessError('Invalid node link policy.') }
}

export function nodeLinkEndpoint(r: Replica, path: Scope, peer: string): { id: string; remoteId: string; mask: NodeMask } | null {
  const link = linkAt(r, path, peer, '')
  if (!link) return null
  const ref = content(r.store, link.cid)
  return { id: ref.data.alias!.id, remoteId: ref.data.ref!.id, mask: readMask(r, path, peer, ref.data.ref!.id) }
}

/** A local mutable ref points to the other endpoint by peer + alias, never a DAG cycle.
 * Its TARGETPOINTER holds this endpoint's policy; editing it cannot edit the other ref.
 */
export function setNodeLinkMask(r: Replica, path: Scope, peer: string, remoteId: string, mask: NodeMask, now: number, id = localLinkId(r.meta.peerId, peer, remoteId)): Replica {
  const previous = linkAt(r, path, peer, remoteId)
  if (previous && content(r.store, previous.cid).data.ref?.id !== remoteId) throw new NodeAccessError('This node is already linked to another endpoint on that peer.')
  const policy = put(r.store, { data: { description: { content: JSON.stringify(maskOf(mask)) } }, children: [] })
  const ref = put(r.store, refNodeContent(r.store, {
    alias: { id: previous ? content(r.store, previous.cid).data.alias!.id : id },
    ...(previous && content(r.store, previous.cid).data.description ? { description: content(r.store, previous.cid).data.description } : {}),
    name: { content: linkName(r, peer, path) }, ref: { id: remoteId, peer }
  }, policy, previous ? [[r.store.primitive.previousVersion.getId(), previous.cid]] : [], capabilityTarget(r.store, 'provideNode')))
  if (previous && refValueCid(r.store, content(r.store, previous.cid)) === policy) return r
  // Endpoint refs belong to this peer's root alias, outside its shared TARGETPOINTER.
  // They persist locally but never become another peer's mergeable policy.
  const root = content(r.store, r.store.rootNodeId)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => !previous || e[1] !== previous.cid), [capabilityTarget(r.store, 'provideNode'), ref]] })
  r.store.updateCtxCallback?.(r.store.exportContext([]))
  return { ...r }
}

function permitted(r: Replica, cid: string, peer: string, inherited: boolean): boolean {
  const member = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === peer)
  if (!member) return inherited
  if (member.disabled?.includes('read') || member.disabled?.includes('provideNode')) return false
  return member.capabilities.includes('read') || member.capabilities.includes('edit')
}

/** One logical node only. No PREV, proposals, reference targets, or descendant values.
 * Scopes are walked through visible row edges, so hashes and aliases are not authority.
 */
export function provideNode(r: Replica, input: NodeRequest, authority: NodeAuthority, now: number): { replica: Replica; node: ProvidedNode } {
  const request = parseNodeRequest(input)
  if (!authority.capabilities.includes('provideNode')) throw new NodeAccessError('This peer does not provide nodes.')
  if (request.peerId !== authority.peerId || request.scope.length !== authority.scope.length || request.scope.some((id, i) => id !== authority.scope[i])) throw new NodeAccessError('Node request is outside the attachment.')
  return withMainBranchPolicy(r.store, () => {
    let cid = resolveScope(r.store, headCid(r), authority.scope)
    if (!cid) throw new NodeAccessError('Attachment unavailable.')
    let access = permitted(r, cid, authority.peerId, authority.owner === true)
    const initialMember = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
    let grants = initialMember ? initialMember.capabilities.filter(cap => !initialMember.disabled?.includes(cap)) : (authority.owner ? CAPABILITIES : [])
    if (!access) throw new NodeAccessError('Node access denied.')
    const path = [...authority.scope]
    let fields: Set<string> | undefined
    const restrictFields = (mask: NodeMask) => {
      if (mask.fields) fields = new Set(mask.fields.filter(key => !fields || fields.has(key)))
    }
    // A mask on the attachment also constrains requests made directly to descendants.
    for (const id of request.path) {
      const mask = readMask(r, path, authority.peerId, request.linkId)
      restrictFields(mask)
      if (mask.children && !mask.children.includes(id)) throw new NodeAccessError('Node access denied.')
      const identity = content(r.store, cid)
      if (isHandle(identity)) throw new NodeAccessError('Reference targets require their own attachment.')
      const edge = valueContent(r.store, cid).children.find(e => rowKindOf(r.store, e) && content(r.store, identityCid(r.store, e)).data.alias?.id === id)
      if (!edge) throw new NodeAccessError('Node unavailable.')
      cid = identityCid(r.store, edge)
      path.push(id)
      const member = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
      if (member) grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
      access = permitted(r, cid, authority.peerId, access)
      if (!access) throw new NodeAccessError('Node access denied.')
    }
    const heldByRequester = isPeerReference(content(r.store, cid)) && content(r.store, cid).data.ref?.peer === request.peerId && !!request.update
    if (isHandle(content(r.store, cid)) && !heldByRequester) throw new NodeAccessError('Reference targets require their own attachment.')
    const mask = readMask(r, path, authority.peerId, request.linkId)
    restrictFields(mask)
    const value = heldByRequester ? { data: {}, children: [] } : valueContent(r.store, cid)
    const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => !forbiddenFields.has(key) && (!fields || fields.has(key)))) as FosDataContent
    const children: NodeChild[] = []
    for (const edge of value.children) {
      if (isBookkeepingEdge(r.store, edge)) continue
      const kind = rowKindOf(r.store, edge)
      if (!kind) continue
      const childCid = identityCid(r.store, edge), child = content(r.store, childCid), id = child.data.alias?.id
      if (!id || (mask.children && !mask.children.includes(id)) || !permitted(r, childCid, authority.peerId, access)) continue
      const remote = isPeerReference(child) ? child.data.ref : undefined
      children.push({ id, kind: remote ? 'ref' : kind, address: { peerId: remote?.peer ?? r.meta.peerId, scope: remote?.scope ?? [...path, id], ...(remote?.branches ? { branches: remote.branches } : {}) } })
    }
    const proposals: ProposalView[] = readProposals(r.store, content(r.store, cid))
      .filter(p => authority.owner || grants.includes('approve') || p.peerId === authority.peerId)
      .map(p => ({ id: p.cid, peerId: p.peerId, name: 'Proposed node changes', status: p.status, timestamp: p.timestamp, summary: { added: [], changed: [], removed: [] } }))
    const existing = linkAt(r, path, authority.peerId, request.linkId)
    if (existing && content(r.store, existing.cid).data.ref?.id !== request.linkId) throw new NodeAccessError('Node link endpoint mismatch.')
    const id = existing ? content(r.store, existing.cid).data.alias!.id : localLinkId(r.meta.peerId, authority.peerId, request.linkId + JSON.stringify(path))
    if (!existing) r = setNodeLinkMask(r, path, authority.peerId, request.linkId, {}, now, id)
    return { replica: r, node: { peerId: r.meta.peerId, linkId: id, remoteLinkId: request.linkId,
      address: { peerId: r.meta.peerId, scope: path }, data, children, proposals, grants, mask: { ...(fields ? { fields: [...fields] } : {}), ...(mask.children ? { children: mask.children } : {}) } } }
  })
}

/** Install a shallow projection and the independently mutable receiving endpoint.
 * Descendants remain peer references until explicitly requested.
 */
export function acceptProvidedNode(r: Replica, at: Scope, request: NodeRequest, node: ProvidedNode, now: number): Replica {
  if (node.remoteLinkId !== request.linkId || JSON.stringify(node.address.scope) !== JSON.stringify([...request.scope, ...request.path])) throw new NodeAccessError('Node response does not match the request.')
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) throw new NodeAccessError('The receiving node no longer exists.')
  const before = content(r.store, cid), local = readMask(r, at, node.peerId, node.linkId)
  const data = Object.fromEntries(Object.entries(node.data).filter(([key]) => !forbiddenFields.has(key) && (!local.fields || local.fields.includes(key)))) as FosDataContent
  const children = node.children.filter(child => !local.children || local.children.includes(child.id)).map(child => {
    const stub = put(r.store, { data: { alias: { id: child.id }, ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', kind: child.kind, scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } }, children: [] })
    return [stub, rowPrimitive(r.store, child.kind)] as [string, string]
  })
  // Preserve local grants and masks; the provider cannot replace them with its own.
  const identity = withPeer(r.store, refNodeContent(r.store, { alias: before.data.alias ?? { id: request.linkId } }, put(r.store, { data, children }), bookkeepingOf(r.store, before)), node.peerId)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, () => identity, 'replace'), now)
  r = setNodeLinkMask({ ...r }, at, node.peerId, node.linkId, local, now, request.linkId)
  const endpoint = linkAt(r, at, node.peerId, node.linkId)!, ref = content(r.store, endpoint.cid)
  const marked = put(r.store, { ...ref, data: { ...ref.data, description: { content: 'fos:node-projection' } } })
  const root = content(r.store, r.store.rootNodeId)
  r.store.rootNodeId = put(r.store, { ...root, children: root.children.map(edge => edge[1] === endpoint.cid ? [edge[0], marked] : edge) })
  return { ...r }
}

/** The legacy whole-graph protocol cannot express field masks. Refuse it before
 * any import/export when this attachment has a masked endpoint; use node pulls.
 */
export function hasNodeLinkMasks(store: Replica['store'], peer: string | null, scope: Scope): boolean {
  const sourceIds = new Set<string>([content(store, store.rootNodeId).data.alias?.id ?? store.rootNodeId])
  for (let i = 1; i <= scope.length; i++) {
    const cid = resolveScope(store, rootTargetCid(store), scope.slice(0, i))
    if (cid) sourceIds.add(content(store, cid).data.alias?.id ?? cid)
  }
  const scoped = resolveScope(store, rootTargetCid(store), scope)
  const pending = scoped ? [scoped] : [], visited = new Set<string>()
  while (pending.length) {
    const cid = pending.pop()!
    if (visited.has(cid)) continue
    visited.add(cid)
    const node = content(store, cid)
    sourceIds.add(node.data.alias?.id ?? cid)
    if (isHandle(node)) continue
    for (const edge of valueContent(store, cid).children) if (rowKindOf(store, edge)) pending.push(identityCid(store, edge))
  }
  return content(store, store.rootNodeId).children.some(edge => {
    if (edge[0] !== capabilityTarget(store, 'provideNode')) return false
    const ref = content(store, edge[1]), name = ref.data.name?.content
    if (!name?.startsWith(LINK_NAME) || (peer && ref.data.ref?.peer !== peer)) return false
    try {
      const [, id] = JSON.parse(name.slice(LINK_NAME.length)) as [string, string]
      if (!sourceIds.has(id)) return false
      if (ref.data.description?.content === 'fos:node-projection') return true
      const target = refValueCid(store, ref)
      const mask = maskOf(JSON.parse(target ? content(store, target).data.description?.content ?? 'null' : 'null'))
      return mask.fields !== undefined || mask.children !== undefined
    } catch { return true }
  })
}

/** A whole-graph transfer cannot safely represent a nested read boundary. */
export function hasNodeReadBoundary(r: Replica, scope: Scope, peer: string): boolean {
  return withMainBranchPolicy(r.store, () => {
    const root = resolveScope(r.store, headCid(r), scope)
    if (!root) return false
    const pending = [root], seen = new Set<string>()
    while (pending.length) {
      const cid = pending.pop()!
      if (seen.has(cid)) continue
      seen.add(cid)
      if (!permitted(r, cid, peer, true)) return true
      if (isHandle(content(r.store, cid))) continue
      for (const edge of valueContent(r.store, cid).children) if (rowKindOf(r.store, edge)) pending.push(identityCid(r.store, edge))
    }
    return false
  })
}

export type NodeProvider = { id: string; capabilities: Capability[]; request(input: NodeRequest): Promise<ProvidedNode> }
export function nodeRequestLinkId(localPeer: string, address: NodeAddress): string {
  return hashContent({ data: { description: { content: JSON.stringify([localPeer, address.peerId, address.scope]) } }, children: [] })
}
/** Only providers attached to this node are candidates. Offline peers fail over; no global search. */
export async function pullNode(request: NodeRequest, peers: NodeProvider[]): Promise<ProvidedNode> {
  const candidates = peers.filter(p => p.capabilities.includes('provideNode'))
  let error: unknown = new NodeAccessError('No attached peer provides this node.')
  for (const peer of candidates) {
    try {
      const node = await peer.request(request)
      if (node.peerId !== peer.id || node.remoteLinkId !== request.linkId || node.address.peerId !== peer.id ||
        JSON.stringify(node.address.scope) !== JSON.stringify([...request.scope, ...request.path])) throw new NodeAccessError('Node response does not match the request.')
      if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data) || typeof node.linkId !== 'string' || !node.linkId || !Array.isArray(node.children) ||
        node.children.some(child => !child || typeof child.id !== 'string' || !child.id || !ROW_KINDS.includes(child.kind) || typeof child.address?.peerId !== 'string' || !child.address.peerId || !validPath(child.address.scope) ||
          (child.address.peerId === peer.id && JSON.stringify(child.address.scope) !== JSON.stringify([...node.address.scope, child.id])) ||
          (child.address.peerId !== peer.id && child.kind !== 'ref')) ||
        new Set(node.children.map(child => child.id)).size !== node.children.length) throw new NodeAccessError('Invalid node response.')
      return node
    } catch (e) { error = e }
  }
  throw error
}

/** Optional eager handler: every step goes through provideNode and its current masks. */
export async function pullNodeTree(request: NodeRequest, peer: NodeProvider, limit = 1000): Promise<ProvidedNode[]> {
  if (!peer.capabilities.includes('sync')) throw new NodeAccessError('This peer does not offer eager sync.')
  const result: ProvidedNode[] = [], queue: NodeRequest[] = [request], seen = new Set<string>()
  while (queue.length) {
    if (result.length >= limit) throw new NodeAccessError('Node traversal limit reached.')
    const next = queue.shift()!, key = JSON.stringify([next.scope, next.path])
    if (seen.has(key)) continue
    seen.add(key)
    const node = await pullNode(next, [peer]); result.push(node)
    for (const child of node.children) if (child.kind !== 'ref') {
      const path = [...next.path, child.id]
      const linkId = nodeRequestLinkId(request.peerId, { peerId: peer.id, scope: [...request.scope, ...path] })
      queue.push({ ...request, path, linkId })
    }
  }
  return result
}
