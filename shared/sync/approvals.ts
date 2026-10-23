/**
 * Accepting a submission. Every submission to a mutable ref (a node's edits, a branch's pull request, a value for a
 * ref, an evaluation request, a visitor's input, a library update) is accepted the same way: whoever accepts it
 * approves it (`acceptSubmission`), and it is applied once the approvals its node's merge rule asks for are there.
 *
 * - An approval is a row of the submission (beside who sent it, its content and its base): its left the `approve`
 *   capability, its right the approver (a reference to the approver's member entry, with their peer). A submission
 *   node never travels (peers see it summarized, `ProposalView`), so every approval in it was recorded by the store
 *   holding the node, for an approver it authenticated: those are what its rule counts. When a peer attests an
 *   approval (the fos server, for the accounts it serves), it has a row whose left is the attester's published key
 *   (its key row on its member entry, content-addressed) and whose right is the signature over what was approved (the
 *   approver and the content), so that anyone else can check it (`verifyApproval`; one that cannot be checked is no
 *   approval there).
 * - The merge rule is the node's `approveMerge` row: a pattern of approvals, one per peer whose approval it takes.
 *   Without one, the standard library's default: an approval by any peer that may change the node directly (the owner,
 *   this store's peer, or a member that may edit there) other than the proposer, whose submission is its approval.
 * Approvals belong to the submission, not its content: a new content is a new submission, and its approvals are gone.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosPathElem } from '../types'
import { hashContent } from '../dag-implementation/cid'
import { libAt, typeIdOf, commitRoot, content, memberEdgesOf, memberPeerOf, put, readMembers, readProposal, readProposals, refNodeContent, refValueCid, resolveScope, updateAtScope, valueContent, withProposal, MARKET_PEER, SERVER_MEMBER, type ProposalRecord, type Scope } from './graph'
import { applyProposalAt, headCid, type Replica } from './replica'
import { plainEdge } from './patterns'
import { isUserType, readUser, type SignatureCheck } from './users'
import { rowWithLeft } from './row-values'

export type Approval = { approver: string; signature?: { key: string; value: string } }
/** Who attests approvals and how: a peer with a published key (the fos server for now; peers' own keys later). */
export type Attester = { key: string; sign(payload: string): string }

const isApproval = (store: FosStore, left: string) => typeIdOf(store, left) === 'capabilities.approve'
const isMergeRule = (store: FosStore, left: string) => typeIdOf(store, left) === 'capabilities.approveMerge'
/** An approval's identity among the submission's rows: whose it is (approving again replaces it). */
const approvalId = (approver: string) => hashContent({ data: { peerId: { content: approver }, description: { content: 'approval' } }, children: [] })

/** What an approval attests: who approved which content. */
export function approvalPayload(approver: string, contentCid: string): string {
  return JSON.stringify(['fos-approve/2', approver, contentCid])
}

/** The approver an approval node names. */
function approverOf(store: FosStore, node: string): string | null {
  return store.table.get(node)?.data.peerId?.content ?? null
}

/** The approvals the submission `proposalCid` holds, as written (not yet verified). */
export function approvalsOf(store: FosStore, proposalCid: string): Approval[] {
  return content(store, proposalCid).children.flatMap(([key, node]) => {
    if (!isApproval(store, key)) return []
    const approver = approverOf(store, node)
    if (!approver) return []
    const sig = content(store, node).children[0]
    return [{ approver, ...(sig ? { signature: { key: sig[0], value: content(store, sig[1]).data.description?.content ?? '' } } : {}) }]
  })
}

/** The submission `proposalCid` with `approver`'s approval (signed by `attester` when given), in place of an earlier one of theirs. */
function withApproval(store: FosStore, proposalCid: string, approver: string, at: Scope, attester?: Attester): string {
  const proposal = readProposal(store, proposalCid)
  if (!proposal) throw new Error('That submission is gone.')
  const signature: FosPathElem[] = attester ? [[attester.key, put(store, { data: { description: { content: attester.sign(approvalPayload(approver, proposal.contentCid)) } }, children: [] })]] : []
  const node = put(store, { data: { alias: { id: approvalId(approver) }, peerId: { content: approver } }, children: signature })
  const left = libAt(store, at).capabilities.approve!, submission = content(store, proposalCid)
  const others = submission.children.filter(([key, n]) => !(isApproval(store, key) && approverOf(store, n) === approver))
  return put(store, { ...submission, children: [...others, [left, node]] })
}

/** A submission's identity apart from its approvals: the same however many have approved it. */
export function submissionKey(store: FosStore, proposalCid: string): string {
  const node = content(store, proposalCid)
  return hashContent({ ...node, children: node.children.filter(([key]) => !isApproval(store, key)) })
}

/** Withdraw `approver`'s approval of the submission `proposalCid` at `at` (nothing when they have none there). */
export function withdrawApproval(r: Replica, at: Scope, proposalCid: string, approver: string, now: number): Replica {
  const store = r.store, record = readProposal(store, proposalCid)
  if (!record) return r
  const node = content(store, proposalCid)
  const kept = node.children.filter(([key, n]) => !(isApproval(store, key) && approverOf(store, n) === approver))
  if (kept.length === node.children.length) return r
  const next = put(store, { ...node, children: kept })
  commitRoot(store, updateAtScope(store, headCid(r), at, value => withProposal(store, value, record.peerId, next, record.name), 'node'), now)
  return { ...r }
}

/** The key nodes this graph's members publish (the key row on each entry, by its node's cid), with their keys. */
function publishedKeyNodes(r: Replica): Map<string, string> {
  const keys = new Map<string, string>()
  for (const member of memberEdgesOf(r.store, headCid(r))) {
    const peerId = memberPeerOf(r.store, member)
    for (const edge of content(r.store, member[1]).children) {
      const plain = plainEdge(r.store, edge)
      if (!isUserType(r.store, plain[0])) continue
      const user = readUser(r.store, plain[0], valueContent(r.store, plain[1]))
      if (user && user.username === peerId && user.publicKey) keys.set(plain[1], user.publicKey)
    }
  }
  return keys
}

/** Whether an attested approval of the submission checks: signed over its content by a key this graph's members publish. */
export function verifyApproval(r: Replica, contentCid: string, approval: Approval, check: SignatureCheck): boolean {
  const key = approval.signature && publishedKeyNodes(r).get(approval.signature.key)
  if (!key) return false
  try { return check(approvalPayload(approval.approver, contentCid), approval.signature!.value, key) } catch { return false }
}

/** A pattern of approvals: one approval row per peer. */
function approvalPattern(store: FosStore, approvers: string[], at: Scope): string {
  const left = libAt(store, at).capabilities.approve!
  return put(store, { data: {}, children: approvers.map(p => [left, put(store, { data: { peerId: { content: p } }, children: [] })] as FosPathElem) })
}

/** The group's merge rule at `at`, its approveMerge row's pattern of approvals; null when the default holds. */
export function mergeRule(r: Replica, at: Scope): string | null {
  const cid = resolveScope(r.store, headCid(r), at)
  const row = cid ? rowWithLeft(r.store, cid, isMergeRule) : null
  return row ? refValueCid(r.store, content(r.store, row.ref)) : null
}

/** Set the group's merge rule at `at`: the approval of each of `approvers` (the approveMerge capability's handler there is that pattern). */
export function setMergeRule(r: Replica, at: Scope, approvers: string[], now: number): Replica {
  const store = r.store, left = libAt(store, at).capabilities.approveMerge!, pattern = approvalPattern(store, approvers, at)
  const row: FosPathElem = [left, put(store, refNodeContent(store, { alias: { id: left } }, pattern))]
  commitRoot(store, updateAtScope(store, headCid(r), at, value => ({ ...value, children: [...value.children.filter(edge => plainEdge(store, edge)[0] !== left), row] })), now)
  return { ...r }
}

/** Who may approve under the default rule (one of them suffices): the owner and every member that may edit at `at`, but the proposer. */
export function defaultApprovers(r: Replica, at: Scope, proposer: string): string[] {
  const cid = resolveScope(r.store, headCid(r), at)
  const editors = (cid ? readMembers(r.store, content(r.store, cid)) : [])
    .filter(m => m.capabilities.includes('edit') && !m.disabled?.includes('edit') && m.peerId !== SERVER_MEMBER && m.peerId !== MARKET_PEER).map(m => m.peerId)
  return [...new Set([r.meta.peerId, ...editors])].filter(p => p !== proposer)
}

/**
 * Whose approval the rule at `at` still waits for on the submission `proposalCid`: under a pattern, each approver it
 * names that has not approved; under the default, the eligible approvers until one of them has.
 */
export function missingApprovals(r: Replica, at: Scope, proposalCid: string): string[] {
  const proposal = readProposal(r.store, proposalCid)
  if (!proposal) return []
  const approved = new Set(approvalsOf(r.store, proposalCid).map(a => a.approver))
  const pattern = mergeRule(r, at)
  if (pattern) return approvalsOf(r.store, pattern).map(a => a.approver).filter(p => !approved.has(p))
  const eligible = defaultApprovers(r, at, proposal.peerId)
  return eligible.some(p => approved.has(p)) ? [] : eligible
}

/** The open submission at `at` from `peerId` carrying the branch `name` (its main one for ''). */
export function openSubmission(r: Replica, at: Scope, name: string, peerId?: string): ProposalRecord {
  const cid = resolveScope(r.store, headCid(r), at)
  const found = cid && readProposals(r.store, content(r.store, cid)).find(p => p.name === name && p.status === 'open' && (!peerId || p.peerId === peerId))
  if (!found) throw new Error(`No open submission ${name || 'main'} here.`)
  return found
}

/**
 * Accept the submission `proposalCid` at `at` as `approver`: their approval is added to it (attested by `attester`
 * when given), and it is applied once the node's merge rule holds. Answers what is still missing when it does not.
 */
export function acceptSubmission(r: Replica, at: Scope, proposalCid: string, approver: string, now: number, options: { attester?: Attester } = {}): { replica: Replica; merged: boolean; missing: string[]; proposal: string } {
  const store = r.store, cid = resolveScope(store, headCid(r), at)
  const record = readProposal(store, proposalCid)
  if (!cid || !record || record.status !== 'open' || !readProposals(store, content(store, cid)).some(p => p.cid === proposalCid)) throw new Error('That submission is no longer open here.')
  const approved = withApproval(store, proposalCid, approver, at, options.attester)
  commitRoot(store, updateAtScope(store, headCid(r), at, node => withProposal(store, node, record.peerId, approved, record.name), 'node'), now)
  r = { ...r }
  const missing = missingApprovals(r, at, approved)
  if (missing.length) return { replica: r, merged: false, missing, proposal: approved }
  return { replica: applyProposalAt(r, at, approved, approver, now), merged: true, missing, proposal: approved }
}

/** The key row a peer publishes on its member entry of this graph's root (its node's cid), for attesting approvals. */
export function attesterKey(r: Replica, peerId: string): string | null {
  for (const [node] of publishedKeyNodes(r)) {
    const entry = memberEdgesOf(r.store, headCid(r)).find(m => memberPeerOf(r.store, m) === peerId)
    if (entry && content(r.store, entry[1]).children.some(edge => plainEdge(r.store, edge)[1] === node)) return node
  }
  return null
}
