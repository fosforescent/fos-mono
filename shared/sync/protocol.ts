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
  commitRoot,
  content,
  hasNode,
  importNodes,
  isBookkeepingEdge,
  isLink,
  proposalContent,
  put,
  putStripped,
  reachableNodes,
  reachableSet,
  readProposals,
  resolveScope,
  rootTargetCid,
  stripLink,
  updateAtScope,
  withPeer,
  withProposal,
  type Scope
} from './graph'
import { mergeNodes } from './merge'

export type SyncAction = 'noop' | 'fast-forward' | 'pull' | 'merge' | 'propose'

export type ServeOptions = {
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
  /**
   * Name of the branch this head belongs to (e.g. a git branch). In branch
   * mode each (peer, branch) is its own proposal, so a directory checked out on
   * several branches proposes several values for the same link node.
   */
  branch?: string
}

export type SyncResponse = {
  version: typeof SYNC_FORMAT_VERSION
  cidVersion: CidVersion
  peerId: string
  scope: Scope
  action: SyncAction
  resultCid: string
  nodes: FosNodesData
  newChoiceIds: string[]
  serverTime: number
  /** Peer ids the serving side currently sees online (attachments persist; this is only presence). */
  presence?: string[]
}

export type SyncError = { error: string; code: 'bad-request' | 'scope-not-found' | 'missing-nodes' | 'version-mismatch' }

export function parseSyncRequest(body: unknown): SyncRequest | SyncError {
  if (!body || typeof body !== 'object') return { error: 'request body must be an object', code: 'bad-request' }
  const raw = body as Partial<SyncRequest>
  if (raw.version !== SYNC_FORMAT_VERSION) return { error: `unsupported sync version ${String(raw.version)}`, code: 'bad-request' }
  if (typeof raw.cidVersion !== 'number') return { error: 'cidVersion required', code: 'bad-request' }
  if (typeof raw.peerId !== 'string' || !raw.peerId || raw.peerId.length > 128) return { error: 'peerId must be a non-empty string', code: 'bad-request' }
  if (!Array.isArray(raw.scope) || raw.scope.length > 32 || !raw.scope.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 128)) {
    return { error: 'scope must be an array of ids', code: 'bad-request' }
  }
  if (typeof raw.headCid !== 'string' || !raw.headCid) return { error: 'headCid required', code: 'bad-request' }
  if (raw.baseCid !== null && raw.baseCid !== undefined && typeof raw.baseCid !== 'string') return { error: 'baseCid must be a cid or null', code: 'bad-request' }
  if (raw.nodes !== undefined && (typeof raw.nodes !== 'object' || raw.nodes === null)) return { error: 'nodes must be an object', code: 'bad-request' }
  return {
    version: SYNC_FORMAT_VERSION,
    cidVersion: raw.cidVersion,
    peerId: raw.peerId,
    scope: [...raw.scope],
    baseCid: raw.baseCid ?? null,
    headCid: raw.headCid,
    nodes: raw.nodes ?? {},
    ...(typeof raw.branch === 'string' && raw.branch.length > 0 && raw.branch.length <= 200 ? { branch: raw.branch } : {})
  }
}

export type ServeResult = { response: SyncResponse; changed: boolean } | SyncError

/** Serve a request against the receiving peer's store (mutates it on change). */
export function serveSync(store: FosStore, request: SyncRequest, serverPeerId: string, now: number = Date.now(), options: ServeOptions = {}): ServeResult {
  if (request.cidVersion !== CURRENT_CID_VERSION) {
    return { error: `peer uses cid format v${request.cidVersion}, this side uses v${CURRENT_CID_VERSION}`, code: 'version-mismatch' }
  }
  importNodes(store, request.nodes)
  if (!hasNode(store, request.headCid)) {
    const sent = request.nodes[request.headCid]
    const missing = sent ? sent.children.flat().filter((cid) => !store.table.has(cid)) : []
    const detail = !sent ? 'the head node itself was not sent' : missing.length ? `head references unknown nodes: ${missing.map((c) => c.slice(0, 16)).join(', ')}` : 'the head node did not verify'
    return { error: `head node not provided (${detail})`, code: 'missing-nodes' }
  }

  const rootTarget = rootTargetCid(store)
  const currentCid = resolveScope(store, rootTarget, request.scope)
  if (!currentCid) return { error: 'scope not found', code: 'scope-not-found' }
  if (options.proposeOnly && isLink(content(store, currentCid))) {
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

  const changed = resultCid !== currentCid
  if (changed) {
    const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, resultCid))
    commitRoot(store, newRootTarget, now)
  }

  const known = new Set([...Object.keys(request.nodes), ...reachableSet(store, [headCid, baseCid])])
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
      presence: options.onlinePeers
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
  if (action === 'propose' && branchCid === mainStripped) {
    proposalCid = null
    action = 'pull'
  } else if (action === 'propose') {
    // Unchanged content (even if rejected) keeps the existing proposal node; an edit reopens it.
    // A rebase of a rejected proposal (main moved, the peer did not edit) stays rejected.
    const unchanged = existing && existing.contentCid === branchCid && existing.baseCid === mainStripped
    const peerEdited = !existing || headStripped !== existing.contentCid
    const status = existing?.status === 'rejected' && !peerEdited ? 'rejected' : 'open'
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
    const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, nextLinkCid))
    commitRoot(store, newRootTarget, now)
  }

  // What the peer sees: its branch content plus the node's bookkeeping edges.
  // The peer builds on this node (its next version links PREV to it), so it must
  // be persisted even when the link itself did not change.
  const bookkeeping = content(store, nextLinkCid).children.filter((e) => isBookkeepingEdge(store, e))
  const branch = content(store, branchCid)
  const resultContent = {
    data: { ...branch.data, link: linkValue.data.link ?? { createdAt: now } },
    children: [...branch.children, ...bookkeeping]
  }
  const resultExisted = store.table.has(store.hash(resultContent))
  const resultCid = put(store, resultContent)
  if (!resultExisted) changed = true

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
      presence: options.onlinePeers
    }
  }
}

export type ApplyResult = { reMerged: boolean; newChoiceIds: string[] }

/**
 * Fold a response into the device's store, whose root target is the node at
 * the replica's scope. Returns what changed; the caller records `resultCid` as
 * the new base.
 */
export function applySyncResponse(store: FosStore, request: SyncRequest, response: SyncResponse, localPeerId: string, now: number): ApplyResult {
  if (response.cidVersion !== CURRENT_CID_VERSION) {
    throw new Error(`server uses cid format v${response.cidVersion}, this client uses v${CURRENT_CID_VERSION}`)
  }
  importNodes(store, response.nodes)
  if (!hasNode(store, response.resultCid)) throw new Error('sync response did not include the result node')

  const current = rootTargetCid(store)
  if (current === request.headCid) {
    commitRoot(store, response.resultCid, now)
    return { reMerged: false, newChoiceIds: [...response.newChoiceIds] }
  }
  // Edits happened while the request was in flight: they were made against the sent head.
  const merged = mergeNodes(store, request.headCid, current, response.resultCid, { ours: localPeerId, theirs: response.peerId })
  commitRoot(store, merged.cid, now)
  const localChoiceIds = merged.newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid)
  return { reMerged: true, newChoiceIds: [...response.newChoiceIds, ...localChoiceIds] }
}
