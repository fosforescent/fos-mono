import { definitionRowKind } from './legacy-row-types'
import { exchangeNodeContext } from './node-context'
import { mergeNodes } from './merge'
import type { FosDataContent, FosNodeContent, FosNodesData } from '../types'
import { isCid, isCurrentCid } from '../dag-implementation/cid'
import { content, valueContent, identityCid, rowKindOf, pinnedRowEdge, pinnedTemplateOf, missingTemplateOf, rowTemplateOf, isShippedLibrary, resolveScope, isHandle, isPeerReference,
  scopeBranches, branchSelection, isBranchChoice, readChoice, CAPABILITIES, putStripped, readProposals, proposalContent, withProposal, submissionAdditions, removeProposalByCid, isRowEdge, importNodes, reachableNodes, capabilityTarget, refValueCid, withMainBranchPolicy, ROW_KINDS, readMembers, memberFor, updateAtScope, commitRoot, put, refNodeContent, bookkeepingOf, type Scope } from './graph'
import { loadReplica, serializeReplica, headCid, type Replica } from './replica'
import { sameValue } from './merge'
import { provideNode, parseNodeRequest, inheritedNodeGrants, nodeLinkMaskAt, nodeLinkEndpoint, setNodeLinkMask, nodeRequestLinkId, NodeAccessError,
  type NodeBranch, type NodeRequest, type NodeShape, type NodeChild, type ProvidedNode, type NodeAuthority } from './node-provider'

export type NodeSyncState = { local: NodeShape; remote: NodeShape & Pick<ProvidedNode, 'proposals' | 'grants'> }
const forbidden = new Set(['alias', 'ref', 'versionControl', 'disabledCapabilities', 'peerId', '__proto__', 'constructor', 'prototype'])
const empty = (): NodeShape => ({ data: {}, children: [] })
// Key order is not content: jsonb storage and object spreads reorder keys of the same value.
const equal = sameValue
const childValue = (child?: NodeChild) => child && { id: child.id, kind: child.kind, template: child.template, ...(child.kind === 'ref' ? { address: child.address } : {}) }
export const nodeSyncKey = (peer: string, path: Scope, branches?: NodeBranch[]): string => JSON.stringify(branches?.length ? [peer, path, [...branches].sort((a, b) => JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope)))] : [peer, path])

export function validateNodeShape(shape: NodeShape): void {
  // the only cids on the wire are pinned templates: a peer in another cid format has to update first
  if (Array.isArray(shape?.children) && shape.children.some(c => isCid(c?.template) && !isCurrentCid(c.template))) throw new NodeAccessError('This peer uses another content id format. Update the app to sync.')
  if (!shape || !shape.data || typeof shape.data !== 'object' || Array.isArray(shape.data) || !Array.isArray(shape.children) || shape.children.length > 10000 ||
    Object.keys(shape.data).some(key => forbidden.has(key)) || shape.children.some(c => !c || typeof c.id !== 'string' || !c.id || c.id.length > 256 || !ROW_KINDS.includes(c.kind) || c.kind === 'reference-error' || !isCid(c.template) ||
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
    if (!id || isShippedLibrary(r.store, path, edge)) continue
    const ref = isPeerReference(child) ? child.data.ref : undefined
    // a reference error is the row it stands for, pinned to the template it waits for
    const missing = missingTemplateOf(r.store, edge), template = pinnedTemplateOf(r.store, edge)!
    children.push({ id, kind: ref?.kind && ROW_KINDS.includes(ref.kind as NodeChild['kind']) ? ref.kind as NodeChild['kind'] : missing ? missing.kind : kind, address: { peerId: ref?.peer ?? r.meta.peerId, scope: ref?.scope ?? [...path, id], ...(ref?.branches ? { branches: ref.branches } : !ref && nodeBranches(r, path, false).length ? { branches: nodeBranches(r, path, false) } : {}) }, template })
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
    if (edge) {
      const same = !missingTemplateOf(r.store, edge) && rowKindOf(r.store, edge) === child.kind && pinnedTemplateOf(r.store, edge) === child.template
      return same ? edge : pinnedRowEdge(r.store, child.kind, identityCid(r.store, edge), child.template)
    }
    if (restored.has(child.id)) return pinnedRowEdge(r.store, child.kind, restored.get(child.id)!, child.template)
    return unloadedRowEdge(r.store, child)
  })
  const next = { data: { ...Object.fromEntries(Object.entries(value.data).filter(([key]) => forbidden.has(key))), ...shape.data }, children: [...value.children.filter(e => !rowKindOf(r.store, e) || isShippedLibrary(r.store, path, e)), ...children] }
  const root = held
    // a node its holder sent blank before (a reference with history) gets its content as the version after that reference
    ? updateAtScope(r.store, headCid(r), path, () => refNodeContent(r.store, { alias: before.data.alias }, put(r.store, next), heldHistory(r.store, before, cid)), 'replace')
    : updateAtScope(r.store, headCid(r), path, () => next)
  if (root !== headCid(r)) commitRoot(r.store, root, now)
  return { ...r }
}

/** A row its peer holds and this side has not loaded: a reference to its address, loaded when the UI opens it. */
export function unloadedRowEdge(store: Replica['store'], child: NodeChild): FosNodeContent['children'][number] {
  const stub = put(store, { data: { alias: { id: child.id }, ref: { id: child.id, peer: child.address.peerId, version: 'unloaded', kind: child.kind, scope: child.address.scope, ...(child.address.branches ? { branches: child.address.branches } : {}) } }, children: [] })
  return pinnedRowEdge(store, child.kind, stub, child.template)
}

/**
 * Accept the rows a submission adds (`ProposalView.additions`) as one local edit, without their content: each added
 * row becomes an unloaded row addressed where its peer serves it (`nodes`: the submission's shallow node at each
 * changed path, from proposal preview requests), appended to that node here. Rows already here are kept. When this
 * side syncs the changed nodes, the owner's peer fills those rows from the submission (`exchangeNode`) and closes it
 * once every row it adds is on main. Paths are relative to `at`.
 */
export function acceptSubmissionRows(r: Replica, at: Scope, additions: Array<{ path: Scope; ids: string[] }>, nodes: Array<{ path: Scope; children: NodeChild[] }>, now: number): Replica {
  const store = r.store
  let root = headCid(r)
  for (const addition of additions) {
    const node = nodes.find(n => equal(n.path, addition.path))
    const path = [...at, ...addition.path]
    if (!node || !resolveScope(store, root, path)) throw new NodeAccessError('A node the submission adds rows to is not here.')
    const wanted = new Set(addition.ids)
    root = updateAtScope(store, root, path, value => {
      const present = new Set(value.children.filter(e => isRowEdge(store, e)).map(e => content(store, identityCid(store, e)).data.alias?.id))
      const added = node.children.filter(child => wanted.has(child.id) && !present.has(child.id)).map(child => unloadedRowEdge(store, child))
      return added.length ? { ...value, children: [...value.children, ...added] } : value
    })
  }
  if (root !== headCid(r)) commitRoot(store, root, now)
  return { ...r }
}

function heldHistory(store: Replica['store'], held: FosNodeContent, heldCid: string): FosNodeContent['children'] {
  const prev = store.primitive.previousVersion.getId(), kept = bookkeepingOf(store, held)
  return kept.some(([i]) => i === prev) ? [...kept.filter(([i]) => i !== prev), [prev, heldCid]] : kept
}

function allowedToEdit(r: Replica, path: Scope, authority: NodeAuthority): boolean {
  let allowed = inheritedNodeGrants(r, authority.scope, authority).includes('edit')
  for (let i = authority.scope.length; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) return false
    const member = memberFor(r.store, content(r.store, cid), authority.peerId)
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
  // a holder that sends a node blank no longer makes it available here (Fos storage switched off on its side)
  if (request.update && request.path.length && isBlank(request.update.value) && !isBlank(request.update.base)) return keepAsHeld(r, request, authority, now)
  let served = provideNode(r, request, authority, now)
  if (request.templateNodes && served.node.wanted?.length) {
    // the requester answers our `wanted` list; only those templates are taken in
    if (!authority.capabilities.includes('sync') || !allowedToEdit(served.replica, [...request.scope, ...request.path], authority)) throw new NodeAccessError('Node editing is not permitted.')
    const resolved = acceptTemplateNodes(served.replica, [...request.scope, ...request.path], request.templateNodes, now)
    if (resolved !== served.replica) served = provideNode(resolved, { ...request, templateNodes: undefined }, authority, now)
  }
  if (!request.update) return served
  if (!authority.capabilities.includes('sync')) throw new NodeAccessError('Peer does not accept node synchronization.')
  const path = [...request.scope, ...request.path]
  if (!allowedToEdit(r, path, authority)) throw new NodeAccessError('Node editing is not permitted.')
  r = served.replica
  if (sameNodeShape(request.update.base, request.update.value)) return served
  // Enforce every ancestor mask on writes as well as reads.
  for (let i = authority.scope.length; i <= path.length; i++) {
    const mask = nodeLinkMaskAt(r, path.slice(0, i), request.peerId)
    if (!mask) continue
    if (mask.fields && [...new Set([...Object.keys(request.update.base.data), ...Object.keys(request.update.value.data)])].some(k => !mask.fields!.includes(k))) throw new NodeAccessError('Node field is masked.')
    if (i < path.length && mask.children && !mask.children.includes(path[i]!)) throw new NodeAccessError('Node child is masked.')
    if (i === path.length && mask.children && [...request.update.base.children, ...request.update.value.children].some(c => !mask.children!.includes(c.id))) throw new NodeAccessError('Node child is masked.')
  }
  const merged = mergeNodeShape(request.update.base, request.update.value, served.node)
  const full = nodeShape(r, path)
  // Apply the visible delta to the complete local node, retaining hidden children.
  const final = mergeNodeShape(served.node, merged, full)
  const restored = new Map<string, string>(), accepted: Array<{ at: Scope; proposal: string }> = []
  for (const child of final.children) {
    if (full.children.some(c => c.id === child.id)) continue
    // Newly introduced addresses must belong to the authenticated writer.
    if (child.address.peerId !== request.peerId) {
      const own = authority.owner && child.address.peerId === r.meta.peerId && equal(child.address.scope, [...path, child.id])
      // an earlier version of this node (undo), or a row of an open submission the owner accepted on a device
      const historical = own ? historicalChild(r, [...path, child.id]) : null
      const submitted = own && !historical ? submittedChild(r, [...path, child.id]) : null
      const cid = historical ?? submitted?.cid
      if (!cid) throw new NodeAccessError('New child must be provided by the writing peer.')
      if (submitted) accepted.push(submitted)
      restored.set(child.id, cid)
    }
  }
  if (!sameNodeShape(full, final)) r = installNodeShape(r, path, final, now, restored)
  for (const { at, proposal } of accepted) r = closeAcceptedSubmission(r, at, proposal, now)
  return provideNode(r, { ...request, update: undefined }, authority, now)
}

/** Templates the rows at `path` are pinned to and this peer has not received (its reference errors there). */
export function missingTemplatesAt(r: Replica, path: Scope): string[] {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid || isHandle(content(r.store, cid))) return []
  return [...new Set(valueContent(r.store, cid).children.flatMap(edge => missingTemplateOf(r.store, edge)?.cid ?? []))]
}

/** Content of the templates a peer asked for (`ProvidedNode.wanted`), limited to those the rows at `path` are pinned to. */
export function templateNodesAt(r: Replica, path: Scope, wanted: string[]): FosNodesData | null {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid || isHandle(content(r.store, cid))) return null
  const pinned = new Set(valueContent(r.store, cid).children.flatMap(edge => missingTemplateOf(r.store, edge) ? [] : rowTemplateOf(r.store, edge) ?? []))
  const ask = wanted.filter(t => pinned.has(t) && r.store.table.has(t))
  return ask.length ? reachableNodes(r.store, ask) : null
}

/**
 * Take in template content received for the reference errors at `path` (verified by cid; nothing else is
 * accepted) and pin those rows to the arrived templates. Returns the same replica when nothing resolved.
 */
export function acceptTemplateNodes(r: Replica, path: Scope, nodes: FosNodesData, now: number): Replica {
  const missing = new Set(missingTemplatesAt(r, path))
  const wanted = Object.fromEntries(Object.entries(reachableFrom(nodes, [...missing])))
  if (!Object.keys(wanted).length) return r
  importNodes(r.store, wanted)
  return resolveReferenceErrors(r, path, now)
}

/** Replace reference errors at `path` whose template this store now holds by rows pinned to it. */
export function resolveReferenceErrors(r: Replica, path: Scope, now: number): Replica {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid || isHandle(content(r.store, cid))) return r
  const ready = (edge: [string, string]) => { const missing = missingTemplateOf(r.store, edge); return !!missing && r.store.table.has(missing.cid) && definitionRowKind(valueContent(r.store, missing.cid)) === missing.kind }
  if (!valueContent(r.store, cid).children.some(ready)) return r
  const root = updateAtScope(r.store, headCid(r), path, value => ({ ...value, children: value.children.map(edge => ready(edge) ? [missingTemplateOf(r.store, edge)!.cid, edge[1]] as [string, string] : edge) }))
  commitRoot(r.store, root, now)
  return { ...r }
}

/** The part of a received node set reachable from `roots` (what a template's content is). */
function reachableFrom(nodes: FosNodesData, roots: string[]): FosNodesData {
  const out: FosNodesData = {}, stack = roots.filter(cid => !!nodes[cid])
  while (stack.length) {
    const cid = stack.pop()!
    if (out[cid] || !nodes[cid]) continue
    out[cid] = nodes[cid]!
    for (const [a, b] of nodes[cid]!.children ?? []) stack.push(a, b)
  }
  return out
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
    const member = cid && memberFor(r.store, content(r.store, cid), peer)
    if (member && (member.disabled?.includes('read') || member.disabled?.includes('provideNode') || (!member.capabilities.includes('read') && !member.capabilities.includes('edit')))) throw new NodeAccessError('Local node access denied.')
    const mask = nodeLinkMaskAt(r, path.slice(0, i), peer)
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
  let grants = inheritedNodeGrants(r, authority.scope, authority)
  let read = grants.includes('read') || grants.includes('edit'), edit = grants.includes('edit')
  for (let i = authority.scope.length; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (!cid) { if (i === authority.scope.length) throw new NodeAccessError('Attachment unavailable.'); break }
    const member = memberFor(r.store, content(r.store, cid), authority.peerId)
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
  // The proposer's submission (open or rejected) is what it is served, rebased onto main as it is now, so it sees what
  // changed on main and keeps its own rows. Only a submission with different content reopens a rejected one.
  const existing = readProposals(r.store, main).find(p => p.peerId === authority.peerId && p.name === 'node-sync')
  if (!existing && !request.update) return provideNode(r, request, authority, now)
  // Work on an isolated store so errors cannot mutate main or its pending value.
  let fork = loadReplica(serializeReplica(r))
  const rebased = existing && existing.baseCid !== base
  const pending = !existing ? null : rebased ? mergeNodes(fork.store, existing.baseCid, base, existing.contentCid, { ours: 'main', theirs: authority.peerId }).cid : existing.contentCid
  // the pending value replaces main's value; the node itself (a link's ref node, its identity) stays
  if (pending) commitRoot(fork.store, updateAtScope(fork.store, headCid(fork), authority.scope, value => ({ ...content(fork.store, pending), data: { ...content(fork.store, pending).data, ...(value.data.alias ? { alias: value.data.alias } : {}) } }), 'value'), now)
  const before = resolveScope(fork.store, headCid(fork), authority.scope)!
  const served = exchangeNodeOnMain(fork, request, { ...authority, proposeOnly: false, owner: true }, now)
  fork = served.replica
  const after = resolveScope(fork.store, headCid(fork), authority.scope)!
  // Import local graph records only; the wire response remains a single node.
  importNodes(r.store, reachableNodes(fork.store, [fork.store.rootNodeId]))
  if (after !== before) {
    const value = putStripped(r.store, content(r.store, after))
    // a changed submission is checked again (open), against the main it was rebased onto
    const proposal = put(r.store, proposalContent(r.store, authority.peerId, 'node-sync', value, existing && !rebased ? existing.baseCid : base, now))
    const next = withProposal(r.store, main, authority.peerId, proposal, 'node-sync')
    commitRoot(r.store, updateAtScope(r.store, headCid(r), authority.scope, () => next, 'node'), now)
  }
  const type = capabilityTarget(r.store, 'provideNode'), root = content(r.store, r.store.rootNodeId)
  const endpoints = content(fork.store, fork.store.rootNodeId).children.filter(e => e[0] === type)
  r.store.rootNodeId = put(r.store, { ...root, children: [...root.children.filter(e => e[0] !== type), ...endpoints] })
  served.node.grants = grants
  served.node.children = served.node.children.filter(child => {
    const cid = resolveScope(r.store, headCid(r), [...path, child.id])
    const member = cid && memberFor(r.store, content(r.store, cid), authority.peerId)
    return !member || (!member.disabled?.includes('read') && !member.disabled?.includes('provideNode') && (member.capabilities.includes('read') || member.capabilities.includes('edit')))
  })
  return { replica: { ...r }, node: served.node }
}

const isBlank = (shape: NodeShape) => !Object.keys(shape.data).length && !shape.children.length

/**
 * A node its holder sent blank: no longer available here. It is kept as a reference to that peer, like any node a peer
 * holds, with what this provider had of it as its previous version, and stays blank. When the holder shares it again,
 * its content is the next version after that reference (`installNodeShape`).
 */
function keepAsHeld(r: Replica, request: NodeRequest, authority: NodeAuthority, now: number): { replica: Replica; node: ProvidedNode } {
  const path = [...request.scope, ...request.path], id = path.at(-1)!
  if (!authority.capabilities.includes('sync') || !allowedToEdit(r, path, authority)) throw new NodeAccessError('Node editing is not permitted.')
  const cid = resolveScope(r.store, headCid(r), path), parent = resolveScope(r.store, headCid(r), path.slice(0, -1))
  if (!cid || !parent) throw new NodeAccessError('Node unavailable.')
  const node = content(r.store, cid)
  if (!(isPeerReference(node) && node.data.ref?.peer === request.peerId)) {
    const edge = valueContent(r.store, parent).children.find(e => rowKindOf(r.store, e) && content(r.store, identityCid(r.store, e)).data.alias?.id === id)
    const ref = { id, peer: request.peerId, version: 'unloaded', kind: edge ? rowKindOf(r.store, edge)! : 'task', scope: path }
    const held = { data: { alias: { id }, ref }, children: [[r.store.primitive.previousVersion.getId(), cid]] as FosNodeContent['children'] }
    commitRoot(r.store, updateAtScope(r.store, headCid(r), path, () => held, 'replace'), now)
    r = { ...r }
  }
  return provideNode(r, { ...request, update: { base: empty(), value: empty() } }, authority, now)
}

/**
 * A row an open submission on this node or an ancestor adds at `path`: what an owner's device references when it
 * accepted the submission without loading its rows (`acceptSubmissionRows`). Never an arbitrary hash: only the
 * submission's own content at that exact path.
 */
function submittedChild(r: Replica, path: Scope): { cid: string; at: Scope; proposal: string } | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const at = path.slice(0, i), cid = resolveScope(r.store, headCid(r), at)
    if (!cid) continue
    const rest = path.slice(i)
    for (const proposal of readProposals(r.store, content(r.store, cid))) {
      if (proposal.status !== 'open') continue
      if (!submissionAdditions(r.store, proposal.baseCid, proposal.contentCid).some(a => equal(a.path, rest.slice(0, -1)) && a.ids.includes(rest.at(-1)!))) continue
      const row = resolveScope(r.store, proposal.contentCid, rest)
      if (row) return { cid: row, at, proposal: proposal.cid }
    }
  }
  return null
}

/** A submission whose every added row is on main now (its owner accepted it on a device) is done: it is removed. */
function closeAcceptedSubmission(r: Replica, at: Scope, proposalCid: string, now: number): Replica {
  const cid = resolveScope(r.store, headCid(r), at), proposal = cid && readProposals(r.store, content(r.store, cid)).find(p => p.cid === proposalCid)
  if (!proposal) return r
  const rowsAt = (path: Scope) => {
    const value = resolveScope(r.store, headCid(r), [...at, ...path])
    return new Set(value ? valueContent(r.store, value).children.filter(e => isRowEdge(r.store, e)).map(e => content(r.store, identityCid(r.store, e)).data.alias?.id) : [])
  }
  if (!submissionAdditions(r.store, proposal.baseCid, proposal.contentCid).every(a => { const here = rowsAt(a.path); return a.ids.every(id => here.has(id)) })) return r
  commitRoot(r.store, updateAtScope(r.store, headCid(r), at, node => removeProposalByCid(r.store, node, proposalCid), 'node'), now)
  return { ...r }
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

/**
 * One node's exchange with a peer, as steps around the transport (the web app awaits each request; the desktop CLI
 * sends them from Rust): `planNodeSync` says what to ask for, `nodeSyncPush` takes the answer and says what to push
 * (null when nothing changed here), `finishNodeSync` installs the final answer. Where the node sits in each address
 * space: `localRoot` is the local path of the attachment, `scope` the peer's attachment scope, `remoteRoot` the remote
 * path that corresponds to `localRoot`.
 */
export type NodeSyncContext = { peer: string | null; scope: Scope; remoteRoot: Scope; localRoot: Scope; branches: NodeBranch[]; push: boolean }
export type NodeSyncPlan = {
  path: Scope; peer: string | null; scope: Scope; remotePath: Scope; push: boolean; dirty: boolean
  request: NodeRequest; first: NodeRequest; local: NodeShape; baseline: NodeShape; previousRemote: NodeShape | null
}

export function planNodeSync(r: Replica, path: Scope, context: NodeSyncContext): NodeSyncPlan {
  const { peer, scope, remoteRoot, localRoot, branches, push } = context
  const local = nodeShape(r, path)
  const state = peer ? r.meta.nodeSync?.[nodeSyncKey(peer, path, branches)] : undefined
  const main = peer && branches.length ? r.meta.nodeSync?.[nodeSyncKey(peer, path, branches.map(b => ({ ...b, name: 'main' })))] ?? r.meta.nodeSync?.[nodeSyncKey(peer, path)] : undefined
  const branchBase = nodeBranchBase(r, path)
  const baseline = state?.local ?? branchBase ?? main?.local ?? empty()
  const dirty = !sameNodeShape(local, baseline)
  const remotePath = [...remoteRoot.slice(scope.length), ...path.slice(localRoot.length)]
  const request = { ...nodeSyncRequest(r, path, peer ?? 'virtual-host', scope, remotePath), ...(branches.length ? { branches } : {}) }
  // a writer asks with an (empty) update, so the answer tells it what it may write
  const first = push && dirty ? { ...request, update: { base: empty(), value: empty() } } : request
  return { path, peer, scope, remotePath, push, dirty, request, first, local, baseline, previousRemote: state?.remote ?? branchBase ?? main?.remote ?? null }
}

/** Check the answer to `plan.first`, record the link, and return the push to make (null: nothing to push). */
export function nodeSyncPush(r: Replica, plan: NodeSyncPlan, remote: ProvidedNode, now: number): { replica: Replica; peer: string; update: NodeRequest | null } {
  if (plan.peer && remote.peerId !== plan.peer) throw new Error('Node provider identity changed.')
  validateNodeShape(remote)
  if (remote.remoteLinkId !== plan.request.linkId || JSON.stringify(remote.address.scope) !== JSON.stringify([...plan.scope, ...plan.remotePath])) throw new Error('Node response does not match its attachment.')
  const replica = establishNodeSync(r, plan.path, plan.request, remote, now)
  const visible = (shape: NodeShape): NodeShape => ({
    data: Object.fromEntries(Object.entries(shape.data).filter(([key]) => !remote.mask?.fields || remote.mask.fields.includes(key))) as FosDataContent,
    children: shape.children.filter(child => !remote.mask?.children || remote.mask.children.includes(child.id))
  })
  const outgoingBase = visible(outgoingNodeShape(replica, plan.path, remote.peerId, plan.baseline))
  const outgoing = visible(outgoingNodeShape(replica, plan.path, remote.peerId, plan.local))
  const update = plan.push && !sameNodeShape(outgoingBase, outgoing) ? { ...plan.request, update: { base: remote, value: mergeNodeShape(outgoingBase, outgoing, remote) } } : null
  return { replica, peer: remote.peerId, update }
}

/** Install the final answer: three-way merge of what the peer accepted with what changed here meanwhile. */
export function finishNodeSync(r: Replica, plan: NodeSyncPlan, remote: ProvidedNode, now: number): Replica {
  validateNodeShape(remote)
  const peer = remote.peerId
  const current = nodeShape(r, plan.path)
  const normalized = { ...remote, children: remote.children.map(child => {
    const existing = plan.local.children.find(c => c.id === child.id)
    return child.address.peerId === r.meta.peerId && existing ? { ...child, kind: existing.kind } : child
  }) }
  const filtered = outgoingNodeShape(r, plan.path, peer, normalized)
  const previousRemote = outgoingNodeShape(r, plan.path, peer, plan.previousRemote ?? empty())
  // a receive-only round sent nothing: what the peer has is what is agreed, and local changes stay unsent (dirty)
  const accepted = plan.push ? mergeNodeShape(previousRemote, filtered, plan.local) : filtered
  const merged = plan.push ? mergeNodeShape(plan.local, accepted, current) : mergeNodeShape(previousRemote, filtered, current)
  let next = sameNodeShape(current, merged) ? r : installNodeShape(r, plan.path, merged, now)
  next = rememberNodeSync(next, plan.path, normalized, accepted)
  return { ...next, meta: { ...next.meta, lastSyncAt: now } }
}

/**
 * After a node's exchange, the template requests: ask the peer for the templates this replica is missing at the node
 * (reference errors), and answer the ones it asked for (`wanted`) when this side writes there.
 */
export function nodeTemplateRequests(r: Replica, plan: NodeSyncPlan, remote: ProvidedNode): { ask: NodeRequest | null; answer: NodeRequest | null } {
  const missing = missingTemplatesAt(r, plan.path)
  const nodes = plan.push && remote.wanted?.length ? templateNodesAt(r, plan.path, remote.wanted) : null
  return { ask: missing.length ? { ...plan.request, templates: missing } : null, answer: nodes ? { ...plan.request, templateNodes: nodes } : null }
}

/**
 * A node Fos may no longer store (`persist` switched off on it) whose content the peer still has from before: the
 * update that sends it blank. The peer keeps its earlier versions in history and holds it, from then on, as a node this
 * device holds (`keepAsHeld`); nothing below it is sent again. Only the topmost such node is sent blank (its
 * descendants go with it). Null when there is nothing to blank.
 */
export function blankNodeRequest(r: Replica, path: Scope, context: NodeSyncContext): NodeRequest | null {
  if (!context.peer || !path.length || nodePersistenceAllowed(r, path) || (path.length > context.localRoot.length && !nodePersistenceAllowed(r, path.slice(0, -1)))) return null
  const state = r.meta.nodeSync?.[nodeSyncKey(context.peer, path, context.branches)]
  if (!state || (!Object.keys(state.remote.data).length && !state.remote.children.length)) return null
  return { ...planNodeSync(r, path, context).request, update: { base: { data: state.remote.data, children: state.remote.children }, value: empty() } }
}

/** After sending a node blank: nothing of it is agreed with the peer any more; the peer holds it as this device's. */
export function finishBlankNode(r: Replica, path: Scope, remote: ProvidedNode): Replica {
  return rememberNodeSync(r, path, remote, empty())
}

export type NodeTreeSync = { replica: Replica; peer: string | null; synced: number }

/**
 * Sync a whole tree with one peer, node by node (the desktop CLI's sync): the attachment first, then each child the
 * peer's answer lists that is here or held by that peer. A generator so any transport can drive it: it yields
 * each request to send, with the replica as it stands (keep it if the transport fails), and takes the peer's answer;
 * `syncNodeTree` drives it with an async transport. Rows Fos may not store are not visited (one the peer still has
 * content of is sent blank, `blankNodeRequest`); more than `limit` nodes is refused.
 */
export function* nodeTreeSync(r: Replica, context: NodeSyncContext, now: () => number, limit = 1000): Generator<{ request: NodeRequest; replica: Replica }, NodeTreeSync, ProvidedNode> {
  let peer = context.peer, synced = 0
  // `held`: the peer has only a reference to this device's copy, so it is pushed whatever was agreed before
  const queue: Array<{ path: Scope; held: boolean }> = [{ path: context.localRoot, held: false }]
  while (queue.length) {
    const { path, held } = queue.shift()!
    if (!resolveScope(r.store, headCid(r), path)) continue
    // a branch applies to the nodes at and below its scope
    const address = [...context.remoteRoot, ...path.slice(context.localRoot.length)]
    const branches = context.branches.filter(b => b.scope.length <= address.length && b.scope.every((id, i) => address[i] === id))
    if (!nodePersistenceAllowed(r, path)) {
      const blank = context.push ? blankNodeRequest(r, path, { ...context, peer, branches }) : null
      if (blank) r = finishBlankNode(r, path, yield { request: blank, replica: r })
      continue
    }
    if (++synced > limit) throw new Error(`More than ${limit} nodes to sync.`)
    const planned = planNodeSync(r, path, { ...context, peer, branches })
    const plan = held && context.push ? { ...planned, dirty: true, baseline: empty(), first: { ...planned.request, update: { base: empty(), value: empty() } } } : planned
    const remote = yield { request: plan.first, replica: r }
    const step = nodeSyncPush(r, plan, remote, now())
    r = step.replica; peer = step.peer
    const accepted = step.update ? yield { request: step.update, replica: r } : remote
    r = finishNodeSync(r, plan, accepted, now())
    const templates = nodeTemplateRequests(r, plan, accepted)
    if (templates.ask) {
      const reply = yield { request: templates.ask, replica: r }
      if (reply.templates) r = acceptTemplateNodes(r, path, reply.templates, now())
    }
    if (templates.answer) yield { request: templates.answer, replica: r }
    // a child here is pushed (or pulled into); one only the peer has is pulled; one a third peer holds is left alone
    // (the peer lists a child it has not received yet as a reference to this device; reference rows are not nodes)
    for (const child of accepted.children) {
      const cid = resolveScope(r.store, headCid(r), [...path, child.id]), node = cid ? content(r.store, cid) : null
      if (node && (isPeerReference(node) ? node.data.ref?.peer === accepted.peerId : !isHandle(node))) queue.push({ path: [...path, child.id], held: child.kind === 'ref' && child.address.peerId === r.meta.peerId })
    }
  }
  return { replica: r, peer, synced }
}

/** `nodeTreeSync` over an async transport. */
export async function syncNodeTree(r: Replica, context: NodeSyncContext, send: (request: NodeRequest) => Promise<ProvidedNode>, now: () => number = Date.now): Promise<NodeTreeSync> {
  const run = nodeTreeSync(r, context, now)
  let step = run.next()
  while (!step.done) step = run.next(await send(step.value.request))
  return step.value
}
