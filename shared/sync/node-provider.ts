import { approvalsOf } from './approvals'
import type { FosDataContent, FosNodeContent, FosNodesData, FosPathElem } from '../types'
import { hashContent, isCid } from '../dag-implementation/cid'
import { content, put, refNodeContent, refValueCid, isRefNode, typeIdOf, libAt, commitRoot, updateAtScope, resolveScope, pinnedRowEdge, pinnedTemplateOf, missingTemplateOf, isShippedLibrary, reachableNodes, bookkeepingOf, rootTargetCid, withPeer,
  membershipOf, valueContent, readMembers, memberFor, memberPeerOf, peerNode, memberEntryPeerAt, isGrantEdge, grantChildId, memberEdgesOf, isMemberEdge, capabilityOf, isHandle, isPeerReference, isBookkeepingEdge, isRowEdge, identityCid, withMainBranchPolicy,
  readProposals, submissionAdditions, capabilityNames, type MemberRecord, type ProposalView, type Capability, type Scope } from './graph'
import { advertisedRows, importNodes } from './graph'
import { sameCapabilityType } from './capabilities'
import { primitiveValue } from './primitives'
import { refSubmissions } from './scoped-refs'
import { headCid, type Replica } from './replica'
import { constructNodeValue, readGraphValue } from './node-values'

/** Each endpoint owns its mask. Omitting an allowlist allows all; [] allows none. */
export type NodeMask = { fields?: string[]; children?: string[] }
export type NodeBranch = { scope: Scope; name: string }
export type NodeAddress = { peerId: string; scope: Scope; branches?: NodeBranch[] }
export type NodeRequest = {
  peerId: string; scope: Scope; path: Scope; linkId: string; branches?: NodeBranch[]; proposal?: { scope: Scope; id: string }; update?: { base: NodeShape; value: NodeShape }
  /** Templates the requester's rows here are pinned to and it has not received (its reference errors): send their content. */
  templates?: string[]
  /** Content of templates the provider asked for (`ProvidedNode.wanted`), or of the grants an update's member entry pins; accepted only for those. */
  templateNodes?: FosNodesData
  /**
   * A proposing peer's branch: its update is the submission named after it (`branch:<name>`, one per peer and branch),
   * a pull request the owner sees as an option of the node, instead of the peer's one `node-sync` submission.
   */
  submission?: string
}
export type NodeShape = { data: FosDataContent; children: NodeChild[] }
/**
 * One child row: `template` is what it is made from (its row edge's left node: a row type or a template row, pinned by
 * cid), so the type travels as the template and nothing else. `held`: its content is not served through this node (a
 * reference row, whose target has its own attachment, or a node another peer holds: `address` says which).
 *
 * Memberships are children too (`template` = the peer's node, their row's left; `peer` = who it is for; `id` = the
 * membership row's alias), listed to the peers that receive them (`memberEntryVisible`) and synced in their own round
 * like any node. In a member entry, its grants
 * and offers (`[CAPABILITY|ACCEPTS, x]`, `template` = that primitive) are immutable children `pinned` to the cid of
 * `x`, whose content travels with the shape (`ProvidedNode.templates`, `NodeRequest.templateNodes`).
 */
/** `peer`: a membership's, whom it is for (the peer on its row's left). */
export type NodeChild = { id: string; address: NodeAddress; template: string; held?: true; pinned?: string; right?: { name?: string; bound: boolean }; peer?: string }
/** Shallow wire projection of a row's right ref. The graph remains the source of
 * truth: the enclosing row supplies its pattern; bound is the presence of TARGET. No values are bundled. */
export function rightChild(r: Replica, edge: FosPathElem): NodeChild['right'] {
  const ref = content(r.store, identityCid(r.store, edge))
  return isRowEdge(r.store, edge) && ref.data.alias && isRefNode(r.store, ref) && ref.data.name ? { ...(ref.data.name ? { name: ref.data.name.content } : {}), bound: !!refValueCid(r.store, ref) } : undefined
}
export const exchangedValueEdge = (r: Replica, edge: FosPathElem): boolean => isRowEdge(r.store, edge)
export const validRightChild = (child: NodeChild): boolean => child.right === undefined || (!!child.right && typeof child.right === 'object' && typeof child.right.bound === 'boolean' && !('type' in child.right) && (child.right.name === undefined || typeof child.right.name === 'string' && child.right.name.length <= 1024) && !child.pinned)
export function unloadedRightEdge(store: Replica['store'], child: NodeChild): FosPathElem {
  const data = { alias: { id: child.id }, ...(child.right?.name !== undefined ? { name: { content: child.right.name } } : {}), ...(child.right?.bound ? { ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', ...(child.held ? { held: true } : {}), scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } } : {}) }
  return pinnedRowEdge(store, put(store, refNodeContent(store, data, child.right?.bound ? put(store, { data: {}, children: [] }) : null, [])), child.template)
}
export type ProvidedNode = {
  peerId: string; linkId: string; remoteLinkId: string; address: NodeAddress
  data: FosDataContent; children: NodeChild[]; mask?: NodeMask; proposals?: ProposalView[]; grants?: Capability[]
  /** What the serving peer offers (its transport facts plus the services declared by its handler rows), for the requester to record. */
  capabilities?: Capability[]
  /** The account's peers online now (the account server adds it), for the requester's online dots. */
  presence?: string[]
  /** The requested templates' content, and that of the grants a member entry's shape pins (nodes reachable from each). */
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
  if (r.submission !== undefined && (typeof r.submission !== 'string' || !r.submission.trim() || r.submission.length > 200)) throw new NodeAccessError('Invalid submission name.')
  return { peerId: r.peerId, scope: [...r.scope], path: [...r.path], linkId: r.linkId, ...(r.branches?.length ? { branches: r.branches.map(b => ({ scope: [...b.scope], name: b.name })) } : {}), ...(r.proposal ? { proposal: { ...r.proposal, scope: [...r.proposal.scope] } } : {}), ...(r.update !== undefined ? { update: r.update } : {}),
    ...(r.templates?.length ? { templates: [...new Set(r.templates)] } : {}), ...(r.templateNodes ? { templateNodes: r.templateNodes } : {}), ...(r.submission ? { submission: r.submission } : {}) }
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
const localLinkId = (peer: string, other: string, id: string) => hashContent({ data: { description: { content: JSON.stringify([peer, other, id]) } }, children: [] })

function linkAt(r: Replica, path: Scope, peer: string, remoteId: string) {
  // One endpoint per peer at a node. A caller cannot evade a mask by choosing a new link id.
  const node = sourceId(r, path)
  const edge = content(r.store, r.store.rootNodeId).children.find(e => {
    if (!content(r.store, e[1]).data.nodeLink) return false
    const data = content(r.store, e[1]).data
    return data.nodeLink?.node === node && data.ref?.peer === peer
  })
  return edge ? { cid: edge[1] } : undefined
}
function readMask(r: Replica, path: Scope, peer: string, remoteId: string): NodeMask {
  const link = linkAt(r, path, peer, remoteId)
  if (!link) return {}
  const target = refValueCid(r.store, content(r.store, link.cid))
  if (!target) throw new NodeAccessError('Node link has no policy.')
  try { return maskOf(readGraphValue(r.store, target)) }
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
    if (!content(r.store, e[1]).data.nodeLink) return false
    const link = content(r.store, e[1]).data.nodeLink
    return !!link?.projection && link.node === id
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
  const policy = constructNodeValue(r.store, maskOf(mask), previous ? content(r.store, previous.cid).data.alias!.id : id, previous?.cid).cid
  const ref = put(r.store, refNodeContent(r.store, {
    alias: { id: previous ? content(r.store, previous.cid).data.alias!.id : id },
    nodeLink: { node: sourceId(r, path), ...(previous && content(r.store, previous.cid).data.nodeLink?.projection ? { projection: true } : {}) },
    ref: { id: remoteId, peer }
  }, policy, previous ? [[r.store.primitive.previousVersion.getId(), previous.cid]] : []))
  if (previous && content(r.store, previous.cid).data.ref?.id === remoteId && refValueCid(r.store, content(r.store, previous.cid)) === policy) return r
  // Endpoint refs belong to this peer's root alias, outside its shared TARGETPOINTER.
  // They persist locally but never become another peer's mergeable policy.
  const root = content(r.store, r.store.rootNodeId)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => !previous || e[1] !== previous.cid), [libAt(r.store).capabilities.provideNode!, ref]] })
  r.store.updateCtxCallback?.(r.store.exportContext([]))
  return { ...r }
}

/** Grants that include reading the node: read itself, and edit and execute (a peer reads what it changes or runs). */
const READING: Capability[] = ['read', 'edit', 'execute']
export function inheritedNodeGrants(r: Replica, path: Scope, authority: NodeAuthority): Capability[] {
  let grants: Capability[] = authority.owner ? capabilityNames(r.store) : []
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) throw new NodeAccessError('Attachment unavailable.')
    const member = decidingMember(r.store, content(r.store, cid), authority)
    if (!member) continue
    grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
    if (member.disabled?.includes('read') || member.disabled?.includes('provideNode') || !grants.some(cap => READING.includes(cap))) throw new NodeAccessError('Parent permissions deny node access.')
  }
  return grants
}

/**
 * The member entry that decides what `authority` may do on a node: for another peer its own entry, else its audience's
 * (`memberFor`). The owner's devices are the owner: audiences say what others may do, and a device's own entry decides
 * only when it is a grant (switched on or off), not when it only carries that device's offers (`publishTemplate`,
 * `offerRelay` make a device a member that way).
 */
export function decidingMember(store: Replica['store'], value: FosNodeContent, authority: Pick<NodeAuthority, 'peerId' | 'owner'>): MemberRecord | undefined {
  if (!authority.owner) return memberFor(store, value, authority.peerId)
  const own = readMembers(store, value).find(m => m.peerId === authority.peerId)
  return own && grantsOf(store, value, own) ? own : undefined
}

/**
 * Whether `member` (a membership of `value`) says anything about grants: one that grants nothing and is not loaded here
 * yet (its device pushes it next), or carries only offers (its peer's handlers, the transport that reaches it), does not.
 */
export function grantsOf(store: Replica['store'], value: FosNodeContent, member: MemberRecord): boolean {
  if (member.capabilities.length) return true
  const entry = membershipOf(store, value, member.peerId), node = entry && content(store, entry[1])
  return !(node && (isPeerReference(node) || node.children.some(e => e[0] === store.primitive.acceptsNode.getId())))
}

function permitted(r: Replica, cid: string, authority: Pick<NodeAuthority, 'peerId' | 'owner'>, inherited: boolean): boolean {
  const member = decidingMember(r.store, content(r.store, cid), authority)
  if (!member) return inherited
  if (member.disabled?.includes('read') || member.disabled?.includes('provideNode')) return false
  return member.capabilities.some(cap => READING.includes(cap) && !member.disabled?.includes(cap))
}

/**
 * Which member entries of a node a peer receives, as children of that node: the owner (its own devices) all of them,
 * any other peer only its own (the one whose left is that peer: its grants, its offers, the rows left there for it such as its
 * relay queue). Everything else about who else is a member stays the owner's.
 */
export function memberEntryVisible(peer: string, authority: Pick<NodeAuthority, 'peerId' | 'owner'>): boolean {
  return !!authority.owner || peer === authority.peerId
}

/** A member entry a peer listed and this side has not loaded: who it names, no grants yet (so it grants nothing). */
export function unloadedMemberEdge(store: Replica['store'], child: NodeChild): FosPathElem {
  const ref = { id: child.id, peer: child.address.peerId, version: 'unloaded', ...(child.held ? { held: true } : {}), scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) }
  return [peerNode(store, child.peer!), put(store, { data: { alias: { id: child.id }, ref }, children: [] })]
}

/** Fields a membership's shape carries besides the usual ones (what is switched off; who it is for is its row's left). */
export const MEMBER_ENTRY_FIELDS = new Set(['disabledCapabilities', 'disabledConstructors'])

/** The children of the node `cid` (at `path`) as node exchange lists them: its rows, then its member entries (or, in a member entry, its grants). */
/**
 * Whether a membership is exchanged: one for a store reached through this machine's files (granted `local`,
 * `linkLocalStore`) is this machine's link and never leaves it, and so is one that only holds this device's transport
 * to its peer.
 */
export function exchangedMember(store: Replica['store'], edge: FosPathElem): boolean {
  const right = content(store, edge[1])
  if (right.children.some(e => capabilityOf(store, e) === 'local')) return false
  return !(right.children.length && right.children.every(e => isTransportOffer(store, e)))
}
/** A peer's transport offered here (`offerNodeTransport`): a native `provideNode` value, this device's connection to that peer, never exchanged. */
export function isTransportOffer(store: Replica['store'], edge: FosPathElem): boolean {
  if (edge[0] !== store.primitive.acceptsNode.getId()) return false
  return advertisedRows(store, edge[1]).some(([left, ref]) => typeIdOf(store, left) === 'capabilities.provideNode' && refSubmissions(store, ref).some(value => primitiveValue(store, value)))
}
export function exchangedChildren(r: Replica, cid: string, path: Scope): Array<{ id: string; edge: FosPathElem; member?: true; grant?: true }> {
  const value = valueContent(r.store, cid), out: Array<{ id: string; edge: FosPathElem; member?: true; grant?: true }> = []
  const entry = memberEntryPeerAt(r.store, headCid(r), path) !== null
  for (const edge of value.children) {
    if (entry && isGrantEdge(r.store, edge)) { if (!isTransportOffer(r.store, edge)) out.push({ id: grantChildId(r.store, edge), edge, grant: true }); continue }
    if (isBookkeepingEdge(r.store, edge) || !exchangedValueEdge(r, edge)) continue
    const id = content(r.store, identityCid(r.store, edge)).data.alias?.id
    if (id && !isShippedLibrary(r.store, path, edge)) out.push({ id, edge })
  }
  if (!entry && !isHandle(content(r.store, cid))) for (const edge of memberEdgesOf(r.store, cid)) {
    const id = content(r.store, edge[1]).data.alias?.id
    if (id && exchangedMember(r.store, edge)) out.push({ id, edge, member: true })
  }
  return out
}

/** One logical node only. No PREV, proposals, reference targets, or descendant values.
 * Scopes are walked through visible row edges and member entries, so hashes and aliases are not authority.
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
      const mask = nodeLinkMaskAt(r, path, authority.peerId)
      restrictFields(mask)
      if (mask.children && !mask.children.includes(id)) throw new NodeAccessError('Node access denied.')
      const identity = content(r.store, cid)
      if (isHandle(identity)) throw new NodeAccessError('Reference targets require their own attachment.')
      // a member entry is a child like a row, for the peers that receive it (`memberEntryVisible`)
      const edge = exchangedChildren(r, cid, path).find(child => child.id === id && !child.grant && (!child.member || memberEntryVisible(memberPeerOf(r.store, child.edge), authority)))?.edge
      if (!edge) throw new NodeAccessError('Node unavailable.')
      cid = identityCid(r.store, edge)
      path.push(id)
      const member = decidingMember(r.store, content(r.store, cid), authority)
      if (member) grants = member.capabilities.filter(cap => !member.disabled?.includes(cap))
      access = permitted(r, cid, authority, access)
      if (!access) throw new NodeAccessError('Node access denied.')
    }
    // a row the requester added holds its content on the requester's side: it is served blank, and its update fills it
    const heldByRequester = isPeerReference(content(r.store, cid)) && content(r.store, cid).data.ref?.peer === request.peerId
    if (isHandle(content(r.store, cid)) && !heldByRequester) throw new NodeAccessError('Reference targets require their own attachment.')
    const mask = nodeLinkMaskAt(r, path, authority.peerId)
    restrictFields(mask)
    const identity = content(r.store, cid)
    const value = heldByRequester ? { data: {}, children: [] } : valueContent(r.store, cid)
    const entry = memberEntryPeerAt(r.store, headCid(r), path) !== null
    const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => (!forbiddenFields.has(key) || (entry && MEMBER_ENTRY_FIELDS.has(key))) && (!fields || fields.has(key)))) as FosDataContent
    const children: NodeChild[] = []
    const pinned = new Set<string>(), wanted = new Set<string>(), grantNodes: string[] = []
    for (const { id, edge, member, grant } of heldByRequester ? [] : exchangedChildren(r, cid, path)) {
      if ((mask.children && !mask.children.includes(id)) || (member && !memberEntryVisible(memberPeerOf(r.store, edge), authority))) continue
      // a grant is pinned by its node's cid; its content goes with the answer (it is small and immutable)
      if (grant) { grantNodes.push(edge[1]); children.push({ id, address: { peerId: r.meta.peerId, scope: [...path, id] }, template: edge[0], pinned: edge[1] }); continue }
      const childCid = identityCid(r.store, edge), child = content(r.store, childCid)
      if (!permitted(r, childCid, authority, access)) continue
      const remote = isPeerReference(child) ? child.data.ref : undefined
      // a reference error is reported as the row it stands for; the provider asks for the template it lacks.
      // The template belongs to the edge, so rows held by another peer carry it too. A member entry's is MEMBER.
      const right = rightChild(r, edge)
      if (right) grantNodes.push(pinnedTemplateOf(r.store, edge)!)
      const missing = !member && missingTemplateOf(r.store, edge), template = member ? edge[0] : pinnedTemplateOf(r.store, edge)!
      if (!member) (missing ? wanted : pinned).add(template)
      children.push({ id, ...(right ? { right } : {}), ...(isHandle(child) ? { held: true as const } : {}), ...(member ? { peer: memberPeerOf(r.store, edge) } : {}), address: { peerId: remote?.peer ?? r.meta.peerId, scope: remote?.scope ?? [...path, id], ...(remote?.branches ? { branches: remote.branches } : {}) }, template })
    }
    // Only templates this node's visible rows are pinned to are served, never an arbitrary cid.
    const served = (request.templates ?? []).filter(cid => pinned.has(cid))
    const templates = served.length || grantNodes.length ? reachableNodes(r.store, [...served, ...grantNodes]) : null
    const proposals: ProposalView[] = readProposals(r.store, content(r.store, cid))
      .filter(p => authority.owner || grants.includes('edit') || p.peerId === authority.peerId)
      // the owner sees what each submission is called and which rows it adds (ids only: the rows load when opened)
      .map(p => ({ id: p.cid, peerId: p.peerId, name: authority.owner || p.peerId === authority.peerId ? p.name : '', status: p.status, timestamp: p.timestamp, summary: { added: [], changed: [], removed: [] }, approvals: approvalsOf(r.store, p.cid),
        ...(authority.owner && p.status === 'open' ? { additions: submissionAdditions(r.store, p.baseCid, p.contentCid) } : {}) }))
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
  // a member entry is not a projection of its own: it syncs in its node's rounds (node-sync.ts `installNodeShape`)
  if (memberEntryPeerAt(r.store, headCid(r), at) !== null) throw new NodeAccessError('A member entry syncs with its node.')
  const before = content(r.store, cid), local = nodeLinkMaskAt(r, at, node.peerId), ownMask = readMask(r, at, node.peerId, node.linkId)
  const data = Object.fromEntries(Object.entries(node.data).filter(([key]) => !forbiddenFields.has(key) && (!local.fields || local.fields.includes(key)))) as FosDataContent
  const listed = node.children.filter(child => (!local.children || local.children.includes(child.id)) && !child.pinned)
  // A typed declaration carries its immutable schema, never the field's value or history.
  if (node.templates) {
    const schemas: FosNodesData = {}, pending = listed.flatMap(child => child.right ? [child.template] : [])
    while (pending.length) {
      const id = pending.pop()!, schema = node.templates[id]
      if (!schema || schemas[id]) continue
      schemas[id] = schema
      for (const edge of schema.children) pending.push(...edge)
    }
    importNodes(r.store, schemas)
  }
  const children = listed.filter(child => child.peer === undefined).map(child => {
    if (child.right) return unloadedRightEdge(r.store, child)
    const stub = put(r.store, { data: { alias: { id: child.id }, ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', ...(child.held ? { held: true } : {}), scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } }, children: [] })
    return pinnedRowEdge(r.store, stub, child.template)
  })
  // Preserve local grants and masks; the provider cannot replace them with its own (member entries it lists that are
  // not here arrive unloaded, granting nothing until they sync). A root keeps its shipped library.
  const shipped = valueContent(r.store, cid).children.filter(edge => isShippedLibrary(r.store, at, edge))
  const kept = isPeerReference(before) ? [] : bookkeepingOf(r.store, before).filter(e => !isMemberEdge(r.store, e))
  const memberships = isPeerReference(before) ? [] : memberEdgesOf(r.store, cid), known = new Set(memberships.map(e => memberPeerOf(r.store, e)))
  const members = listed.filter(child => typeof child.peer === 'string' && !known.has(child.peer)).map(child => unloadedMemberEdge(r.store, child))
  const identity = withPeer(r.store, refNodeContent(r.store, { alias: before.data.alias ?? { id: request.linkId }, ...(before.data.name ? { name: before.data.name } : {}) }, put(r.store, { data, children: [...shipped, ...children, ...memberships, ...members] }), kept), node.peerId)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, () => identity, 'replace'), now)
  r = setNodeLinkMask({ ...r }, at, node.peerId, node.linkId, ownMask, now, request.linkId)
  const endpoint = linkAt(r, at, node.peerId, node.linkId)!, ref = content(r.store, endpoint.cid)
  const marked = put(r.store, { ...ref, data: { ...ref.data, nodeLink: { node: ref.data.nodeLink!.node, projection: true } } })
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
        node.children.some(child => !child || !validRightChild(child) || typeof child.id !== 'string' || !child.id || (child.held !== undefined && child.held !== true) || (child.pinned !== undefined && !isCid(child.pinned)) || typeof child.address?.peerId !== 'string' || !child.address.peerId || !validPath(child.address.scope) ||
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
    for (const child of node.children) if (!child.held && !child.pinned) {
      const path = [...next.path, child.id]
      const linkId = nodeRequestLinkId(request.peerId, { peerId: peer.id, scope: [...request.scope, ...path] })
      queue.push({ ...request, path, linkId })
    }
  }
  return result
}
