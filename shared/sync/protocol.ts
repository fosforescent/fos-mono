/**
 * Peer-link sync protocol over FosStore nodes.
 *
 * A device attaches to the user group's document at a `scope` (a path of
 * partition alias ids; [] = the whole document). One round trip:
 *
 *   device → server  { peerId, scope, baseCid, headCid, nodes }
 *   server → device  { action, resultCid, nodes, newChoiceIds }
 *
 * `headCid` is the device's current content node at the scope and `baseCid` the
 * node both sides agreed on last time (null on a new link). `nodes` carries the
 * content-addressed nodes the other side may be missing; because cids are
 * content hashes, both sides simply union them. The server then compares cids:
 *
 *   current == head   → noop
 *   current == base   → fast-forward (adopt head)
 *   head    == base   → pull (device is behind)
 *   otherwise         → mergeNodes(base, current, head); divergences become CHOICE edges
 *
 * The result is written into the server's root (path copy + new root alias with
 * PREV/MERGESOURCE links) and returned. The device adopts it, re-merging any
 * edits made while the request was in flight, and remembers it as the new base.
 * A [PEER, peerRef] edge is kept on the scope node so the graph records which
 * devices are attached where.
 */

import { FosStore } from '../dag-implementation/store'
import { CURRENT_CID_VERSION, type CidVersion } from '../dag-implementation/cid'
import type { FosNodesData } from '../types'
import {
  SYNC_FORMAT_VERSION,
  type Scope,
  bookkeepingOf,
  commitRoot,
  content,
  contextScope,
  HOME_ID,
  homeContextCid,
  findChild,
  hasNode,
  importNodes,
  isBookkeepingEdge,
  isLink,
  withBranches, isBranchChoice, branchSelection, readChoice, putBranches, identityCid, withIdentity,
  proposalContent,
  put,
  putStripped,
  reachableNodes,
  reachableSet,
  readProposals,
  refNodeContent,
  refTypeCid,
  resolveScope,
  rootTargetCid,
  stripLink,
  updateAtScope,
  withPeer,
  withProposal
} from './graph'
import type { Capability } from './graph'
import { replicationView, restorePeerReferences } from './replication'
import { mergeNodes } from './merge'

export type SyncAction = 'noop' | 'fast-forward' | 'pull' | 'merge' | 'propose'

export type ServeOptions = {
  /** Account servers never resolve opaque device references from old stored history. */
  recipient?: 'server' | 'device'
  /**
   * The requesting peer may not change this node directly: at a link node its
   * head becomes (or updates) a proposal, a branch that members approve. Used
   * for credentials granted through invites. At a non-link node the request
   * is merged as usual.
   */
  proposeOnly?: boolean
  /** Display name recorded on the proposal. */
  peerName?: string
  /** Peer ids currently connected to the serving side, reported back as `presence`. */
  onlinePeers?: string[]
  /** Capabilities the serving side registers with the requesting peer (connection kinds and services), reported back as `capabilities`. */
  capabilities?: Capability[]
}

export type SyncRequest = {
  version: typeof SYNC_FORMAT_VERSION
  /** cid format the sender's nodes are addressed in (cid.ts). Peers must agree. */
  cidVersion: CidVersion
  peerId: string
  scope: Scope
  baseCid: string | null
  headCid: string
  nodes: FosNodesData
  /** Synchronize this mutable node including its branch constructor, rather than a selected alternative. */
  wholeNode?: boolean
  /** Content uses peer-held references at nested server-exclusion boundaries. */
  selective?: boolean
  /**
   * Name of the branch this head belongs to (e.g. a git branch). In branch
   * mode each (peer, branch) is its own proposal, so a directory checked out on
   * several branches proposes several values for the same link node.
   */
  branch?: string
  /** Selected ancestor alternatives for a scoped attachment. */
  branches?: Record<string, string>
}

export type SyncResponse = {
  version: typeof SYNC_FORMAT_VERSION
  cidVersion: CidVersion
  peerId: string
  scope: Scope
  action: SyncAction
  resultCid: string
  /** The selected alternative, pinned for subsequent scoped requests. */
  branch?: string
  nodes: FosNodesData
  newChoiceIds: string[]
  serverTime: number
  /** Peer ids the serving side currently sees online (attachments persist; this is only presence). */
  presence?: string[]
  /** Capabilities the serving peer registers with this one (how it can be reached, what it handles). */
  capabilities?: Capability[]
}

export type SyncError = { error: string; code: 'bad-request' | 'scope-not-found' | 'missing-nodes' | 'version-mismatch'; missingNodeIds?: string[] }

export function parseSyncRequest(body: unknown): SyncRequest | SyncError {
  if (!body || typeof body !== 'object') return { error: 'request body must be an object', code: 'bad-request' }
  const raw = body as Partial<SyncRequest>
  if (raw.version !== SYNC_FORMAT_VERSION) return { error: `unsupported sync version ${String(raw.version)}; update the app`, code: 'version-mismatch' }
  if (typeof raw.cidVersion !== 'number') return { error: 'cidVersion required', code: 'bad-request' }
  if (typeof raw.peerId !== 'string' || !raw.peerId || raw.peerId.length > 128) return { error: 'peerId must be a non-empty string', code: 'bad-request' }
  if (!Array.isArray(raw.scope) || raw.scope.length > 32 || !raw.scope.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 128)) {
    return { error: 'scope must be an array of ids', code: 'bad-request' }
  }
  if (typeof raw.headCid !== 'string' || !raw.headCid) return { error: 'headCid required', code: 'bad-request' }
  if (raw.baseCid !== null && raw.baseCid !== undefined && typeof raw.baseCid !== 'string') return { error: 'baseCid must be a cid or null', code: 'bad-request' }
  if (raw.nodes !== undefined && (typeof raw.nodes !== 'object' || raw.nodes === null)) return { error: 'nodes must be an object', code: 'bad-request' }
  if (raw.branches !== undefined && (!raw.branches || typeof raw.branches !== 'object' || Array.isArray(raw.branches) || Object.keys(raw.branches).length > 32 || Object.entries(raw.branches).some(([id, name]) => !id || id.length > 128 || typeof name !== 'string' || !name || name.length > 200))) return { error: 'Invalid ancestor branch selections', code: 'bad-request' }
  return {
    version: SYNC_FORMAT_VERSION,
    cidVersion: raw.cidVersion,
    peerId: raw.peerId,
    scope: [...raw.scope],
    baseCid: raw.baseCid ?? null,
    headCid: raw.headCid,
    nodes: raw.nodes ?? {},
    ...(raw.selective === true ? { selective: true } : {}),
    ...(raw.wholeNode === true ? { wholeNode: true } : {}),
    ...(raw.branches ? { branches: { ...raw.branches } } : {}),
    ...(typeof raw.branch === 'string' && raw.branch.length > 0 && raw.branch.length <= 200 ? { branch: raw.branch } : {})
  }
}

export type ServeResult = { response: SyncResponse; changed: boolean } | SyncError

/** Serve a request against the receiving peer's store (mutates it on change). */
export function serveSync(store: FosStore, request: SyncRequest, serverPeerId: string, now: number = Date.now(), options: ServeOptions = {}): ServeResult {
  if (request.branches) return withBranches(store, request.branches, () => serveSync(store, { ...request, branches: undefined }, serverPeerId, now, options))
  if (request.version !== SYNC_FORMAT_VERSION) return { error: 'Sync format changed; update the app', code: 'version-mismatch' }
  if (request.cidVersion !== CURRENT_CID_VERSION) {
    return { error: `peer uses cid format v${request.cidVersion}, this side uses v${CURRENT_CID_VERSION}`, code: 'version-mismatch' }
  }
  importNodes(store, request.nodes)
  if (!hasNode(store, request.headCid)) {
    const sent = request.nodes[request.headCid]
    const references = (node: typeof sent): string[] => node && Array.isArray(node.children) ? node.children.flat().filter((cid): cid is string => typeof cid === 'string') : []
    const missing = references(sent).filter((cid) => !store.table.has(cid))
    const detail = !sent ? 'the head node itself was not sent' : missing.length ? `head references unknown nodes: ${missing.map((c) => c.slice(0, 16)).join(', ')}` : 'the head node did not verify'
    const missingNodeIds = [...new Set([request.headCid, ...Object.values(request.nodes).flatMap(references)])].filter((cid) => !store.table.has(cid) && !request.nodes[cid])
    return { error: `head node not provided (${detail})`, code: 'missing-nodes', missingNodeIds }
  }

  const peerKnown = reachableSet(store, [request.headCid, request.baseCid])
  const rootTarget = rootTargetCid(store)
  // Older root devices edit the Home instance; normalize both ends of their merge base.
  if (!request.scope.length && findChild(store, rootTarget, HOME_ID) && !findChild(store, request.headCid, HOME_ID)) {
    request = { ...request, headCid: homeContextCid(store, request.headCid, 0), baseCid: request.baseCid ? homeContextCid(store, request.baseCid, 0) : null }
  }
  const scope = contextScope(store, rootTarget, request.scope)
  const scopedRequest = scope === request.scope ? request : { ...request, scope }
  if (scopedRequest !== request) {
    const result = serveSync(store, scopedRequest, serverPeerId, now, options)
    if (!('error' in result)) result.response.scope = request.scope
    return result
  }
  let currentCid = resolveScope(store, rootTarget, request.scope)
  if (!currentCid) return { error: 'scope not found', code: 'scope-not-found' }
  const originalCurrent = currentCid
  if (request.selective || options.recipient === 'server') {
    const sent = content(store, request.headCid)
    const live = request.headCid === request.baseCid || (!Object.keys(sent.data).length && !sent.children.length) ? currentCid : request.headCid
    const projection = replicationView(store, [live, currentCid, request.headCid, request.baseCid], request.peerId)
    currentCid = projection.project(currentCid)
    request = { ...request, headCid: projection.project(request.headCid), baseCid: request.baseCid && hasNode(store, request.baseCid) ? projection.project(request.baseCid) : null }
  }
  if (!request.selective && options.recipient !== 'server') {
    const available = [currentCid, request.headCid]
    currentCid = restorePeerReferences(store, currentCid, available)
    request = { ...request, headCid: restorePeerReferences(store, request.headCid, available), baseCid: request.baseCid && hasNode(store, request.baseCid) ? restorePeerReferences(store, request.baseCid, available) : null }
  }
  if ((!request.wholeNode || options.proposeOnly) && isBranchChoice(store, content(store, currentCid))) {
    // Serve exactly one alternative. A temporary root lets the ordinary sync and
    // permission/proposal path run unchanged, without a global selection mutation.
    const choice = readChoice(store, currentCid)
    const name = request.branch ?? branchSelection(store, currentCid)
    const selected = choice.options.find(option => option.peerId === name)?.edge
    if (!selected) return { error: `branch not found: ${name}`, code: 'scope-not-found' }
    const branchStore = new FosStore()
    importNodes(branchStore, reachableNodes(store, [identityCid(store, selected), request.headCid, request.baseCid]))
    commitRoot(branchStore, identityCid(store, selected), now)
    const served = serveSync(branchStore, { ...request, scope: [], branch: undefined, nodes: {} }, serverPeerId, now, options)
    if ('error' in served) return served
    const branchHead = rootTargetCid(branchStore)
    importNodes(store, reachableNodes(branchStore, [branchHead, served.response.resultCid]))
    if (served.changed) {
      const replacement = putBranches(store, choice.id, choice.base, choice.options.map(option => option.peerId === name ? { ...option, edge: withIdentity(store, selected, branchHead) } : option), choice.defaultName)
      const next = request.scope.length ? updateAtScope(store, rootTarget, request.scope.slice(0, -1), value => ({ ...value, children: value.children.map(edge => identityCid(store, edge) === currentCid ? withIdentity(store, edge, replacement) : edge) })) : replacement
      commitRoot(store, next, now)
    }
    served.response.scope = request.scope
    served.response.branch = name
    return served
  }
  if (options.proposeOnly && isLink(store, content(store, currentCid))) {
    return serveProposal(store, request, serverPeerId, now, options, rootTarget, currentCid)
  }

  const headCid = request.headCid
  const baseCid = hasNode(store, request.baseCid) ? request.baseCid : null
  const emptyCid = baseCid ?? put(store, { data: {}, children: [] })

  let action: SyncAction
  let mergedCid: string
  let newChoiceCids: string[] = []
  if (currentCid === headCid) {
    action = 'noop'
    mergedCid = currentCid
  } else if (currentCid === emptyCid) {
    action = 'fast-forward'
    mergedCid = headCid
  } else if (headCid === emptyCid) {
    action = 'pull'
    mergedCid = currentCid
  } else {
    action = 'merge'
    const merged = mergeNodes(store, baseCid, currentCid, headCid, { ours: serverPeerId, theirs: request.peerId })
    mergedCid = merged.cid
    newChoiceCids = merged.newChoiceCids
  }

  // Record the device as a peer of this node.
  const withPeerContent = withPeer(store, content(store, mergedCid), request.peerId)
  const resultCid = withPeerContent === content(store, mergedCid) ? mergedCid : put(store, withPeerContent)

  const changed = resultCid !== originalCurrent
  if (changed) {
    const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, resultCid), request.wholeNode ? 'replace' : 'node')
    commitRoot(store, newRootTarget, now)
  }

  const known = new Set([...Object.keys(request.nodes), ...peerKnown])
  return {
    changed,
    response: {
      version: SYNC_FORMAT_VERSION,
      cidVersion: CURRENT_CID_VERSION,
      peerId: serverPeerId,
      scope: request.scope,
      action,
      resultCid,
      nodes: reachableNodes(store, [resultCid], known),
      newChoiceIds: newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid),
      serverTime: now,
      presence: options.onlinePeers,
      capabilities: options.capabilities
    }
  }
}

/**
 * Branch mode at a link node. The peer's head never touches the main content:
 * it is recorded as this peer's proposal (rebased onto main when main moved),
 * and the peer receives its own branch plus the node's bookkeeping (members,
 * all proposals), so it keeps working on the branch until a member approves.
 */
function serveProposal(store: FosStore, request: SyncRequest, serverPeerId: string, now: number, options: ServeOptions, rootTarget: string, linkCid: string): ServeResult {
  const linkValue = content(store, linkCid)
  const mainStripped = putStripped(store, linkValue)
  const headStripped = putStripped(store, content(store, request.headCid))
  const branchName = request.branch ?? options.peerName ?? request.peerId
  const existing = readProposals(store, linkValue).find((p) => p.peerId === request.peerId && p.name === branchName) ?? null
  const baseStripped = hasNode(store, request.baseCid) ? putStripped(store, content(store, request.baseCid)) : null

  const peerEdited = baseStripped ? headStripped !== baseStripped : !existing || headStripped !== existing.contentCid
  let action: SyncAction = 'noop'
  let branchCid = headStripped
  let newChoiceCids: string[] = []
  let proposalCid: string | null = existing?.cid ?? null
  const branchBase = existing?.baseCid ?? baseStripped

  if (headStripped === mainStripped) {
    proposalCid = null                              // nothing to propose (any more)
    action = existing ? 'pull' : 'noop'
  } else if (branchBase === mainStripped) {
    action = 'propose'                              // main unchanged: the branch is just the peer's head
  } else {
    action = 'propose'                              // main moved: rebase the branch onto it
    const merged = mergeNodes(store, branchBase, headStripped, mainStripped, { ours: request.peerId, theirs: serverPeerId })
    branchCid = merged.cid
    newChoiceCids = merged.newChoiceCids
  }
  if (action === 'propose' && existing?.status === 'rejected' && peerEdited) {
    // Only submit edits made after rejection; unchanged rejected rows must not ride along.
    const fresh = mergeNodes(store, baseStripped ?? existing.contentCid, mainStripped, headStripped, { ours: serverPeerId, theirs: request.peerId })
    branchCid = fresh.cid
    newChoiceCids = fresh.newChoiceCids
  }
  if (action === 'propose' && branchCid === mainStripped) {
    proposalCid = null
    action = 'pull'
  } else if (action === 'propose') {
    // Unchanged content (even if rejected) keeps the existing proposal node; an edit reopens it.
    // A rebase of a rejected proposal (main moved, the peer did not edit) stays rejected.
    const sameContent = existing && existing.contentCid === branchCid && existing.baseCid === mainStripped
    const status = existing?.status === 'rejected' && !peerEdited ? 'rejected' : 'open'
    const unchanged = sameContent && existing.status === status
    proposalCid = unchanged
      ? existing.cid
      : put(store, proposalContent(store, request.peerId, branchName, branchCid, mainStripped, existing && !peerEdited ? existing.timestamp : now, status))
    if (unchanged) action = 'noop'
  }

  // Bookkeeping on the node (proposal added/updated/removed) — content untouched, so no new version.
  const nextLink = withProposal(store, linkValue, request.peerId, proposalCid, branchName)
  const withPeerContent = withPeer(store, nextLink, request.peerId)
  const nextLinkCid = put(store, withPeerContent)
  let changed = nextLinkCid !== linkCid
  if (changed) {
    const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, nextLinkCid), 'node')
    commitRoot(store, newRootTarget, now)
  }

  // What the peer sees: a ref node with the same identity whose value is its branch, plus the
  // node's bookkeeping edges. The peer builds on this node (its next version links PREV to it),
  // so it must be persisted even when the link itself did not change.
  const persisted = content(store, nextLinkCid)
  const bookkeeping = bookkeepingOf(store, persisted)
  const resultContent = refNodeContent(store, { ...persisted.data, alias: persisted.data.alias ?? content(store, branchCid).data.alias ?? { id: request.scope[request.scope.length - 1] ?? '' } }, branchCid, bookkeeping, refTypeCid(store, persisted))
  const resultExisted = store.table.has(store.hash(resultContent))
  const resultCid = put(store, resultContent)
  if (!resultExisted) changed = true
  // Same content but different bookkeeping (a proposal approved/rejected, members changed): the peer must pull it.
  if (action === 'noop' && resultCid !== request.headCid) action = 'pull'

  const known = new Set([...Object.keys(request.nodes), ...reachableSet(store, [request.headCid, request.baseCid])])
  return {
    changed,
    response: {
      version: SYNC_FORMAT_VERSION,
      cidVersion: CURRENT_CID_VERSION,
      peerId: serverPeerId,
      scope: request.scope,
      action,
      resultCid,
      nodes: reachableNodes(store, [resultCid], known),
      newChoiceIds: newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid),
      serverTime: now,
      presence: options.onlinePeers,
      capabilities: options.capabilities
    }
  }
}

export type ApplyResult = { reMerged: boolean; newChoiceIds: string[] }

/**
 * Fold a response into the device's store, whose root target is the node at
 * the replica's scope. Returns what changed; the caller records `resultCid` as
 * the new base.
 */
export function applySyncResponse(store: FosStore, request: SyncRequest, response: SyncResponse, localPeerId: string, now: number, localScope: Scope = []): ApplyResult {
  if (response.version !== SYNC_FORMAT_VERSION) throw new Error('Sync format changed; update the app and server')
  if (response.cidVersion !== CURRENT_CID_VERSION) {
    throw new Error(`server uses cid format v${response.cidVersion}, this client uses v${CURRENT_CID_VERSION}`)
  }
  importNodes(store, response.nodes)
  if (!hasNode(store, response.resultCid)) throw new Error('sync response did not include the result node')

  const root = rootTargetCid(store)
  let current = resolveScope(store, root, localScope)
  if (!current) throw new Error('The shared node was removed while sync was in flight.')
  const localContent = current
  if (request.selective) {
    const projection = replicationView(store, [current, request.headCid, response.resultCid], localPeerId)
    current = projection.project(current)
    request = { ...request, headCid: projection.project(request.headCid) }
    response = { ...response, resultCid: projection.project(response.resultCid) }
  }
  const publish = (value: string) => {
    const cid = request.selective ? restorePeerReferences(store, value, [localContent]) : value
    return commitRoot(store, localScope.length ? updateAtScope(store, root, localScope, () => content(store, cid), 'replace') : cid, now)
  }
  if (current === request.headCid) {
    publish(response.resultCid)
    return { reMerged: false, newChoiceIds: [...response.newChoiceIds] }
  }
  // Edits happened while the request was in flight: they were made against the sent head.
  const merged = mergeNodes(store, request.headCid, current, response.resultCid, { ours: localPeerId, theirs: response.peerId })
  publish(merged.cid)
  const localChoiceIds = merged.newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid)
  return { reMerged: true, newChoiceIds: [...response.newChoiceIds, ...localChoiceIds] }
}
