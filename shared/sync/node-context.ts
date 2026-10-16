import { branchEdge, capabilityTarget, commitRoot, content, identityCid, importNodes, isBranchChoice, isHandle, isPeerReference, put, putBranches, readChoice, readMembers, readProposals, reachableNodes, resolveScope, rowPrimitive, updateAtScope, withIdentity, withBranches, withMainBranchPolicy, type Scope, type Capability } from './graph'
import { createBranch } from './branches'
import { headCid, loadReplica, serializeReplica, type Replica } from './replica'
import { NodeAccessError, parseNodeRequest, inheritedNodeGrants, nodeLinkMaskAt, type NodeAuthority, type NodeRequest, type ProvidedNode } from './node-provider'

const prefix = (a: Scope, b: Scope) => a.length <= b.length && a.every((v, i) => v === b[i])
type Exchange = (r: Replica, request: NodeRequest, authority: NodeAuthority, now: number) => { replica: Replica; node: ProvidedNode }

/** Branch values never supply their own authority. Walk the current main policy
 * first, including ancestors shared by newly introduced branch-only nodes. */
export function nodeAuthorityAt(r: Replica, path: Scope, authority: NodeAuthority): Capability[] {
  return withMainBranchPolicy(r.store, () => {
    if (!prefix(authority.scope, path)) throw new NodeAccessError('Node is outside the attachment.')
    let grants: Capability[] = inheritedNodeGrants(r, authority.scope, authority)
    for (let i = authority.scope.length; i <= path.length; i++) {
      const at = path.slice(0, i), cid = resolveScope(r.store, headCid(r), at)
      if (!cid) { if (i === authority.scope.length) throw new NodeAccessError('Attachment unavailable.'); break }
      const member = readMembers(r.store, content(r.store, cid)).find(m => m.peerId === authority.peerId)
      if (member) grants = member.capabilities.filter(c => !member.disabled?.includes(c) && !(c === 'read' && member.disabled?.includes('provideNode')))
      if (!grants.includes('read') && !grants.includes('edit')) throw new NodeAccessError('Node access denied.')
      if (member?.disabled?.includes('read') || member?.disabled?.includes('provideNode')) throw new NodeAccessError('Node access denied.')
      const mask = nodeLinkMaskAt(r, at, authority.peerId)
      if (i < path.length && mask?.children && !mask.children.includes(path[i]!)) throw new NodeAccessError('Node child is masked.')
      if (i < path.length && isHandle(content(r.store, cid))) throw new NodeAccessError('Reference targets require their own attachment.')
    }
    return grants
  })
}

/** Flatten only the explicitly requested alternatives in an isolated store,
 * exchange one logical node, then put its value back into those alternatives.
 * Siblings, main, and the receiver's current branch selection are untouched. */
export function exchangeNodeContext(r: Replica, input: NodeRequest, authority: NodeAuthority, now: number, exchange: Exchange): { replica: Replica; node: ProvidedNode } {
  const request = parseNodeRequest(input), path = [...request.scope, ...request.path]
  if (request.peerId !== authority.peerId || JSON.stringify(request.scope) !== JSON.stringify(authority.scope)) throw new NodeAccessError('Node request is outside the attachment.')
  const grants = nodeAuthorityAt(r, path, authority)
  if (request.update && !grants.includes('edit')) throw new NodeAccessError('Node editing is not permitted.')
  const branches = [...(request.branches ?? [])].sort((a, b) => a.scope.length - b.scope.length)
  for (const branch of branches) if (!prefix(authority.scope, branch.scope) || !prefix(branch.scope, path)) throw new NodeAccessError('Branch is outside the requested attachment.')
  let fork = loadReplica(serializeReplica(r))
  const wrappers: Array<{ scope: Scope; cid: string; name: string; before: string }> = []
  for (const branch of branches) {
    let cid = resolveScope(fork.store, headCid(fork), branch.scope)
    if (!cid) throw new NodeAccessError('Branch node unavailable.')
    let record = isBranchChoice(fork.store, content(fork.store, cid)) ? readChoice(fork.store, cid) : null
    if (!record && branch.name === 'main') continue
    if (!record?.options.some(o => o.peerId === branch.name)) {
      // Creating an alternative requires current main edit rights, even on a read.
      if (!nodeAuthorityAt(r, branch.scope, authority).includes('edit') || authority.proposeOnly) throw new NodeAccessError('Branch not available to this peer.')
      if (branch.scope.length) fork = createBranch(fork, branch.scope, branch.name, now)
      else {
        const edge: [string, string] = [cid, rowPrimitive(fork.store, 'plain')]
        const choice = putBranches(fork.store, content(fork.store, cid).data.alias?.id ?? 'fos:root-branch', edge, [{ peerId: 'main', edge }, { peerId: branch.name, edge, base: edge }])
        commitRoot(fork.store, choice, now)
      }
      cid = resolveScope(fork.store, headCid(fork), branch.scope)!
      record = readChoice(fork.store, cid)
    }
    const edge = record!.options.find(o => o.peerId === branch.name)!.edge!
    const selected = identityCid(fork.store, edge)
    wrappers.push({ scope: branch.scope, cid, name: branch.name, before: selected })
    replaceBranchAt(fork, branch.scope, selected, edge, now)
  }
  if (request.proposal) {
    const at = request.proposal.scope
    if (!prefix(authority.scope, at) || !prefix(at, path)) throw new NodeAccessError('Proposal is outside the attachment.')
    const cid = resolveScope(fork.store, headCid(fork), at)
    const proposal = cid && readProposals(fork.store, content(fork.store, cid)).find(p => p.cid === request.proposal!.id)
    const permissions = nodeAuthorityAt(r, at, authority)
    if (!proposal || (!authority.owner && proposal.peerId !== authority.peerId && !permissions.includes('approve') && !permissions.includes('read-requests'))) throw new NodeAccessError('Proposal is not available to this peer.')
    commitRoot(fork.store, updateAtScope(fork.store, headCid(fork), at, () => content(fork.store, proposal.contentCid), 'replace'), now)
  }
  const served = exchange(fork, { ...request, branches: undefined, proposal: undefined }, { ...authority, owner: request.proposal ? true : authority.owner, proposeOnly: request.proposal ? false : authority.proposeOnly }, now)
  fork = served.replica
  // Re-check every advertised child against live main policy, not branch grants.
  served.node.children = served.node.children.filter(child => {
    try { nodeAuthorityAt(r, [...path, child.id], authority); return true } catch { return false }
  })
  served.node.grants = grants
  served.node.address.branches = branches
  for (const child of served.node.children) if (child.address.peerId === r.meta.peerId) child.address.branches = branches
  if (!request.proposal) {
    for (const wrapper of wrappers.reverse()) {
      const value = resolveScope(fork.store, headCid(fork), wrapper.scope)!
      const choice = readChoice(fork.store, wrapper.cid)
      const next = value === wrapper.before ? wrapper.cid : putBranches(fork.store, choice.id, choice.base, choice.options.map(o => o.peerId === wrapper.name ? { ...o, edge: withIdentity(fork.store, o.edge!, value) } : o), choice.defaultName)
      replaceBranchAt(fork, wrapper.scope, next, [fork.store.primitive.choiceTarget.getId(), next], now)
    }
  }
  importNodes(r.store, reachableNodes(fork.store, [fork.store.rootNodeId]))
  if (!request.proposal && headCid(fork) !== headCid(r)) commitRoot(r.store, headCid(fork), now)
  const type = capabilityTarget(r.store, 'provideNode'), root = content(r.store, r.store.rootNodeId)
  const endpoints = content(fork.store, fork.store.rootNodeId).children.filter(e => e[0] === type)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => e[0] !== type), ...endpoints] })
  return { replica: { ...r }, node: served.node }
}

function replaceBranchAt(r: Replica, at: Scope, cid: string, edge: [string, string], now: number): void {
  if (!at.length) { commitRoot(r.store, cid, now); return }
  const current = resolveScope(r.store, headCid(r), at)
  const next = updateAtScope(r.store, headCid(r), at.slice(0, -1), value => ({ ...value, children: value.children.map(e => identityCid(r.store, e) === current ? edge : e) }))
  commitRoot(r.store, next, now)
}

/** Locate only an already attached reference. A relay caller cannot nominate an
 * arbitrary provider, path, CID, or an alternative outside this attachment. */
export function nodeReferenceAt(r: Replica, request: NodeRequest, authority: NodeAuthority): { cid: string; peer: string; scope: Scope; branches?: import('./node-provider').NodeBranch[] } | null {
  if (request.peerId !== authority.peerId || JSON.stringify(request.scope) !== JSON.stringify(authority.scope)) throw new NodeAccessError('Node request is outside the attachment.')
  const path = [...request.scope, ...request.path]
  nodeAuthorityAt(r, path, authority)
  const selections: Record<string, string> = {}
  return withBranches(r.store, selections, () => {
    for (const branch of request.branches ?? []) {
      if (!prefix(authority.scope, branch.scope) || !prefix(branch.scope, path)) throw new NodeAccessError('Branch is outside the attachment.')
      const cid = withBranches(r.store, selections, () => resolveScope(r.store, headCid(r), branch.scope))
      if (!cid || !isBranchChoice(r.store, content(r.store, cid))) continue
      const choice = readChoice(r.store, cid)
      if (!choice.options.some(o => o.peerId === branch.name)) return null
      selections[choice.id] = branch.name
    }
    return withBranches(r.store, selections, () => {
      const cid = resolveScope(r.store, headCid(r), path)
      if (!cid || !isPeerReference(content(r.store, cid))) return null
      const ref = content(r.store, cid).data.ref!
      return { cid, peer: ref.peer!, scope: ref.scope ?? path, branches: ref.branches }
    })
  })
}
