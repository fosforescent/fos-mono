import type { FosDataContent, FosNodesData } from '../types'
import { hashContent, isCid } from '../dag-implementation/cid'
import { content, put, refNodeContent, refValueCid, capabilityTarget, commitRoot, updateAtScope, resolveScope, pinnedRowEdge, pinnedTemplateOf, missingTemplateOf, isShippedLibrary, reachableNodes, bookkeepingOf, rootTargetCid, withPeer,
  valueContent, readMembers, memberFor, isMemberEdge, memberEntryId, MEMBER_ENTRY_PREFIX, isHandle, isPeerReference, isBookkeepingEdge, isRowEdge, identityCid, withMainBranchPolicy,
  readProposals, CAPABILITIES, type ProposalView, type Capability, type Scope } from './graph'
import { headCid, type Replica } from './replica'

/** Each endpoint owns its mask. Omitting an allowlist allows all; [] allows none. */
export type NodeMask = { fields?: string[]; children?: string[] }
export type NodeBranch = { scope: Scope; name: string }
export type NodeAddress = { peerId: string; scope: Scope; branches?: NodeBranch[] }
export type NodeRequest = {
  peerId: string; scope: Scope; path: Scope; linkId: string; branches?: NodeBranch[]; proposal?: { scope: Scope; id: string }; update?: { base: NodeShape; value: NodeShape }
  /** Templates the requester's rows here are pinned to and it has not received (its reference errors): send their content. */
  templates?: string[]
  /** Content of templates the provider asked for (`ProvidedNode.wanted`); accepted only for those. */
  templateNodes?: FosNodesData
}
export type NodeShape = { data: FosDataContent; children: NodeChild[] }
/**
 * One child row: `template` is what it is made from (its row edge's left node: a row type or a template row, pinned by
 * cid), so the type travels as the template and nothing else. `held`: its content is not served through this node (a
 * reference row, whose target has its own attachment, or a node another peer holds: `address` says which).
 */
export type NodeChild = { id: string; address: NodeAddress; template: string; held?: true }
export type ProvidedNode = {
  peerId: string; linkId: string; remoteLinkId: string; address: NodeAddress
  data: FosDataContent; children: NodeChild[]; mask?: NodeMask; proposals?: ProposalView[]; grants?: Capability[]
  /** What the serving peer offers (its transport facts plus the services its handler registry has), for the requester to record. */
  capabilities?: Capability[]
  /** The account's peers online now (the account server adds it), for the requester's online dots. */
  presence?: string[]
  /** The requested templates' content (nodes reachable from each). */
  templates?: FosNodesData
  /** Templates this node's children are pinned to that the provider has not received; the requester answers with `templateNodes`. */
  wanted?: string[]
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
  if (r.templates !== undefined && (!Array.isArray(r.templates) || r.templates.length > 256 || r.templates.some(cid => !isCid(cid)))) throw new NodeAccessError('Invalid template request.')
  if (r.templateNodes !== undefined && (!r.templateNodes || typeof r.templateNodes !== 'object' || Array.isArray(r.templateNodes) || JSON.stringify(r.templateNodes).length > 4 * 1024 * 1024)) throw new NodeAccessError('Invalid template content.')
  return { peerId: r.peerId, scope: [...r.scope], path: [...r.path], linkId: r.linkId, ...(r.branches?.length ? { branches: r.branches.map(b => ({ scope: [...b.scope], name: b.name })) } : {}), ...(r.proposal ? { proposal: { ...r.proposal, scope: [...r.proposal.scope] } } : {}), ...(r.update !== undefined ? { update: r.update } : {}),
    ...(r.templates?.length ? { templates: [...new Set(r.templates)] } : {}), ...(r.templateNodes ? { templateNodes: r.templateNodes } : {}) }
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

/** Node-wide policy uses a private, unpaired endpoint; it is never sent as a peer. */
export const NODE_PERMISSION_DEFAULT = 'fos:all-linked-peers'
export function nodeLinkMaskAt(r: Replica, path: Scope, peer: string): NodeMask {
  let fields: string[] | undefined, children: string[] | undefined
  for (let i = 0; i <= path.length; i++) {
    const at = path.slice(0, i)
    if (!resolveScope(r.store, headCid(r), at)) break
    for (const target of [NODE_PERMISSION_DEFAULT, peer]) {
      const mask = readMask(r, at, target, '')
      if (mask.fields) fields = fields ? fields.filter(f => mask.fields!.includes(f)) : [...mask.fields]
      if (i < path.length && mask.children && !mask.children.includes(path[i]!)) throw new NodeAccessError('Parent permissions mask this child.')
      if (i === path.length && mask.children) children = children ? children.filter(id => mask.children!.includes(id)) : [...mask.children]
    }
  }
  return { ...(fields ? { fields } : {}), ...(children ? { children } : {}) }
}
export function isNodeProjection(r: Replica, path: Scope): boolean {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return false
  if (isPeerReference(content(r.store, cid))) return true
  const id = sourceId(r, path)
  return content(r.store, r.store.rootNodeId).children.some(e => {
    if (e[0] !== capabilityTarget(r.store, 'provideNode')) return false
    const ref = content(r.store, e[1])
    if (ref.data.description?.content !== 'fos:node-projection') return false
    try { return JSON.parse(ref.data.name?.content?.slice(LINK_NAME.length) ?? 'null')?.[1] === id } catch { return false }
  })
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
export function setNodeLinkMask(r: Replica, path: Scope, peer: string, remoteId: string, mask: NodeMask, now: number, id = localLinkId(r.meta.peerId, peer, remoteId + sourceId(r, path))): Replica {
  const previous = linkAt(r, path, peer, remoteId)
  if (previous && content(r.store, previous.cid).data.ref?.id && content(r.store, previous.cid).data.ref?.id !== remoteId) throw new NodeAccessError('This node is already linked to another endpoint on that peer.')
  const policy = put(r.store, { data: { description: { content: JSON.stringify(maskOf(mask)) } }, children: [] })
  const ref = put(r.store, refNodeContent(r.store, {
    alias: { id: previous ? content(r.store, previous.cid).data.alias!.id : id },
    ...(previous && content(r.store, previous.cid).data.description ? { description: content(r.store, previous.cid).data.description } : {}),
    name: { content: linkName(r, peer, path) }, ref: { id: remoteId, peer }
  }, policy, previous ? [[r.store.primitive.previousVersion.getId(), previous.cid]] : [], capabilityTarget(r.store, 'provideNode')))
  if (previous && content(r.store, previous.cid).data.ref?.id === remoteId && refValueCid(r.store, content(r.store, previous.cid)) === policy) return r
  // Endpoint refs belong to this peer's root alias, outside its shared TARGETPOINTER.
  // They persist locally but never become another peer's mergeable policy.
  const root = content(r.store, r.store.rootNodeId)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => !previous || e[1] !== previous.cid), [capabilityTarget(r.store, 'provideNode'), ref]] })
  r.store.updateCtxCallback?.(r.store.exportContext([]))
  return { ...r }
}

/** Grants that include reading the node: read itself, and edit and execute (a peer reads what it changes or runs). */
const READING: Capability[] = ['read', 'edit', 'execute']
export function inheritedNodeGrants(r: Replica, path: Scope, authority: NodeAuthority): Capability[] {
  let grants: Capability[] = authority.owner ? [...CAPABILITIES] : []
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) throw new NodeAccessError('Attachment unavailable.')
    const member = memberFor(r.store, content(r.store, cid), authority.peerId)
    if (!member) continue
    grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
    if (member.disabled?.includes('read') || member.disabled?.includes('provideNode') || !grants.some(cap => READING.includes(cap))) throw new NodeAccessError('Parent permissions deny node access.')
  }
  return grants
}

function permitted(r: Replica, cid: string, peer: string, inherited: boolean): boolean {
  const member = memberFor(r.store, content(r.store, cid), peer)
  if (!member) return inherited
  if (member.disabled?.includes('read') || member.disabled?.includes('provideNode')) return false
  return member.capabilities.some(cap => READING.includes(cap) && !member.disabled?.includes(cap))
}

/** The member entry `id` names on the node `cid`, when the requester may step into it: its own (the owner: any). */
function memberEntryStep(r: Replica, cid: string, id: string, authority: NodeAuthority): string | null {
  if (id !== memberEntryId(authority.peerId) && !(authority.owner && id.startsWith(MEMBER_ENTRY_PREFIX))) return null
  const edge = content(r.store, cid).children.find(e => isMemberEdge(r.store, e) && content(r.store, e[1]).data.alias?.id === id)
  return edge ? edge[1] : null
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
    let grants = inheritedNodeGrants(r, authority.scope, authority)
    let access = grants.includes('read') || grants.includes('edit')
    if (!access) throw new NodeAccessError('Node access denied.')
    const path = [...authority.scope]
    let fields: Set<string> | undefined
    const restrictFields = (mask: NodeMask) => {
      if (mask.fields) fields = new Set(mask.fields.filter(key => !fields || fields.has(key)))
    }
    // A mask on the attachment also constrains requests made directly to descendants.
    for (const id of request.path) {
      // A peer's own member entry is its place on the node (what is left there for it, e.g. its relay queue).
      const entry = memberEntryStep(r, cid, id, authority)
      if (entry) { cid = entry; path.push(id); continue }
      const mask = nodeLinkMaskAt(r, path, authority.peerId)
      restrictFields(mask)
      if (mask.children && !mask.children.includes(id)) throw new NodeAccessError('Node access denied.')
      const identity = content(r.store, cid)
      if (isHandle(identity)) throw new NodeAccessError('Reference targets require their own attachment.')
      const edge = valueContent(r.store, cid).children.find(e => isRowEdge(r.store, e) && content(r.store, identityCid(r.store, e)).data.alias?.id === id)
      if (!edge) throw new NodeAccessError('Node unavailable.')
      cid = identityCid(r.store, edge)
      path.push(id)
      const member = memberFor(r.store, content(r.store, cid), authority.peerId)
      if (member) grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
      access = permitted(r, cid, authority.peerId, access)
      if (!access) throw new NodeAccessError('Node access denied.')
    }
    const heldByRequester = isPeerReference(content(r.store, cid)) && content(r.store, cid).data.ref?.peer === request.peerId && !!request.update
    if (isHandle(content(r.store, cid)) && !heldByRequester) throw new NodeAccessError('Reference targets require their own attachment.')
    const mask = nodeLinkMaskAt(r, path, authority.peerId)
    restrictFields(mask)
    const value = heldByRequester ? { data: {}, children: [] } : valueContent(r.store, cid)
    const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => !forbiddenFields.has(key) && (!fields || fields.has(key)))) as FosDataContent
    const children: NodeChild[] = []
    const pinned = new Set<string>(), wanted = new Set<string>()
    for (const edge of value.children) {
      if (isBookkeepingEdge(r.store, edge)) continue
      if (!isRowEdge(r.store, edge)) continue
      const childCid = identityCid(r.store, edge), child = content(r.store, childCid), id = child.data.alias?.id
      if (!id || isShippedLibrary(r.store, path, edge) || (mask.children && !mask.children.includes(id)) || !permitted(r, childCid, authority.peerId, access)) continue
      const remote = isPeerReference(child) ? child.data.ref : undefined
      // a reference error is reported as the row it stands for; the provider asks for the template it lacks.
      // The template belongs to the edge, so rows held by another peer carry it too.
      const missing = missingTemplateOf(r.store, edge), template = pinnedTemplateOf(r.store, edge)!
      ;(missing ? wanted : pinned).add(template)
      children.push({ id, ...(isHandle(child) ? { held: true as const } : {}), address: { peerId: remote?.peer ?? r.meta.peerId, scope: remote?.scope ?? [...path, id], ...(remote?.branches ? { branches: remote.branches } : {}) }, template })
    }
    // Only templates this node's visible rows are pinned to are served, never an arbitrary cid.
    const served = (request.templates ?? []).filter(cid => pinned.has(cid))
    const templates = served.length ? reachableNodes(r.store, served) : null
    const proposals: ProposalView[] = readProposals(r.store, content(r.store, cid))
      .filter(p => authority.owner || grants.includes('edit') || p.peerId === authority.peerId)
      .map(p => ({ id: p.cid, peerId: p.peerId, name: 'Proposed node changes', status: p.status, timestamp: p.timestamp, summary: { added: [], changed: [], removed: [] } }))
    const existing = linkAt(r, path, authority.peerId, request.linkId)
    if (existing && content(r.store, existing.cid).data.ref?.id && content(r.store, existing.cid).data.ref?.id !== request.linkId) throw new NodeAccessError('Node link endpoint mismatch.')
    const id = existing ? content(r.store, existing.cid).data.alias!.id : localLinkId(r.meta.peerId, authority.peerId, request.linkId + JSON.stringify(path))
    if (!existing || !content(r.store, existing.cid).data.ref?.id) r = setNodeLinkMask(r, path, authority.peerId, request.linkId, readMask(r, path, authority.peerId, ''), now, id)
    return { replica: r, node: { peerId: r.meta.peerId, linkId: id, remoteLinkId: request.linkId, capabilities: [...authority.capabilities],
      address: { peerId: r.meta.peerId, scope: path }, data, children, proposals, grants, mask: { ...(fields ? { fields: [...fields] } : {}), ...(mask.children ? { children: mask.children } : {}) },
      ...(templates ? { templates } : {}), ...(wanted.size ? { wanted: [...wanted] } : {}) } }
  })
}

/** Install a shallow projection and the independently mutable receiving endpoint.
 * Descendants remain peer references until explicitly requested.
 */
export function acceptProvidedNode(r: Replica, at: Scope, request: NodeRequest, node: ProvidedNode, now: number): Replica {
  if (node.remoteLinkId !== request.linkId || JSON.stringify(node.address.scope) !== JSON.stringify([...request.scope, ...request.path])) throw new NodeAccessError('Node response does not match the request.')
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) throw new NodeAccessError('The receiving node no longer exists.')
  const before = content(r.store, cid), local = nodeLinkMaskAt(r, at, node.peerId), ownMask = readMask(r, at, node.peerId, node.linkId)
  const data = Object.fromEntries(Object.entries(node.data).filter(([key]) => !forbiddenFields.has(key) && (!local.fields || local.fields.includes(key)))) as FosDataContent
  const children = node.children.filter(child => !local.children || local.children.includes(child.id)).map(child => {
    const stub = put(r.store, { data: { alias: { id: child.id }, ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', ...(child.held ? { held: true } : {}), scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } }, children: [] })
    return pinnedRowEdge(r.store, stub, child.template)
  })
  // Preserve local grants and masks; the provider cannot replace them with its own. A root keeps its shipped library.
  const shipped = valueContent(r.store, cid).children.filter(edge => isShippedLibrary(r.store, at, edge))
  const identity = withPeer(r.store, refNodeContent(r.store, { alias: before.data.alias ?? { id: request.linkId } }, put(r.store, { data, children: [...shipped, ...children] }), bookkeepingOf(r.store, before)), node.peerId)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, () => identity, 'replace'), now)
  r = setNodeLinkMask({ ...r }, at, node.peerId, node.linkId, ownMask, now, request.linkId)
  const endpoint = linkAt(r, at, node.peerId, node.linkId)!, ref = content(r.store, endpoint.cid)
  const marked = put(r.store, { ...ref, data: { ...ref.data, description: { content: 'fos:node-projection' } } })
  const root = content(r.store, r.store.rootNodeId)
  r.store.rootNodeId = put(r.store, { ...root, children: root.children.map(edge => edge[1] === endpoint.cid ? [edge[0], marked] : edge) })
  return { ...r }
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
        node.children.some(child => !child || typeof child.id !== 'string' || !child.id || (child.held !== undefined && child.held !== true) || typeof child.address?.peerId !== 'string' || !child.address.peerId || !validPath(child.address.scope) ||
          (child.address.peerId === peer.id && JSON.stringify(child.address.scope) !== JSON.stringify([...node.address.scope, child.id])) ||
          (child.address.peerId !== peer.id && !child.held)) ||
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
    for (const child of node.children) if (!child.held) {
      const path = [...next.path, child.id]
      const linkId = nodeRequestLinkId(request.peerId, { peerId: peer.id, scope: [...request.scope, ...path] })
      queue.push({ ...request, path, linkId })
    }
  }
  return result
}
