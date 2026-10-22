/**
 * Approvals and merge rules: how a pull request (a peer's `branch:<name>` submission, node-sync.ts) becomes main.
 *
 * - An approval is a row of the `approve` capability in the submission's content, named for its approver
 *   (`fos:approval:<approver>`). Its value says who approved what: the subject (the content without its approval
 *   rows, so approvals do not change what they approve), who attests it and when, and a signature over that payload.
 *   The fos server's `approve` handler signs with its identity key for now; a peer's own keypair later (p2p).
 * - A group's merge rule is a row of the `approveMerge` capability on its node: a pattern of approval rows, one per
 *   peer whose approval it takes. Without one, the default: every member that may edit there, and the owner, has
 *   approved (the proposer's submission is its own approval).
 * - A submission whose verified approvals match the rule is applied to main (`applyProposalAt`).
 */
import type { FosPathElem } from '../types'
import { capabilityTarget, content, put, putStripped, readMembers, readProposals, refNodeContent, refValueCid, resolveScope, updateAtScope, valueContent, commitRoot, proposalContent, withProposal, MARKET_PEER, type ProposalRecord, type Scope } from './graph'
import { applyProposalAt, headCid, type Replica } from './replica'
import { constructNodeValue, readGraphValue } from './node-values'
import { plainEdge } from './patterns'
import type { SignatureCheck } from './users'

export const APPROVE = 'approve'
export const APPROVE_MERGE = 'approveMerge'
export const APPROVAL_PREFIX = 'fos:approval:'
export const MERGE_RULE_ID = 'fos:approve-merge'
export const approvalId = (approver: string): string => `${APPROVAL_PREFIX}${approver}`

export type Approval = { approver: string; subject: string; by: string; issuedAt: number; attestation: string }
/** Who signs approvals and how: the fos server's identity key for now (`by` = its peer id). */
export type ApprovalSigner = { by: string; sign(payload: string): string }

/** What an approval signs: approver, subject, attester and time. */
export function approvalPayload(a: Omit<Approval, 'attestation'>): string {
  return JSON.stringify(['fos-approve/1', a.approver, a.subject, a.by, a.issuedAt])
}

const isApprovalRow = (store: Replica['store'], edge: FosPathElem): boolean => plainEdge(store, edge)[0] === capabilityTarget(store, APPROVE)

/** What approvals of `contentCid` approve: the content without its approval rows. */
export function approvalSubject(store: Replica['store'], contentCid: string): string {
  const value = valueContent(store, contentCid)
  return putStripped(store, { ...value, children: value.children.filter(edge => !isApprovalRow(store, edge)) })
}

/** The approvals `contentCid` holds, as written (not yet verified). */
export function readApprovals(store: Replica['store'], contentCid: string): Approval[] {
  const out: Approval[] = []
  for (const edge of valueContent(store, contentCid).children) {
    if (!isApprovalRow(store, edge)) continue
    const target = refValueCid(store, content(store, plainEdge(store, edge)[1]))
    const value = target ? readGraphValue(store, target) as Partial<Approval> | undefined : undefined
    if (value && typeof value.approver === 'string' && typeof value.subject === 'string' && typeof value.by === 'string' && typeof value.issuedAt === 'number' && typeof value.attestation === 'string')
      out.push({ approver: value.approver, subject: value.subject, by: value.by, issuedAt: value.issuedAt, attestation: value.attestation })
  }
  return out
}

/** `contentCid` with `approval` as its approver's approval row (replacing an earlier one of theirs). */
export function withApproval(store: Replica['store'], contentCid: string, approval: Approval): string {
  const id = approvalId(approval.approver), value = valueContent(store, contentCid)
  const target = constructNodeValue(store, approval, id).cid
  const row: FosPathElem = [capabilityTarget(store, APPROVE), put(store, refNodeContent(store, { alias: { id }, name: { content: id } }, target))]
  const others = value.children.filter(edge => !(isApprovalRow(store, edge) && content(store, plainEdge(store, edge)[1]).data.alias?.id === id))
  return put(store, { ...value, children: [...others, row] })
}

/** The approvers whose approvals of `contentCid` check: its subject, an attester whose key is in `keys`, a valid signature. */
export function verifiedApprovers(store: Replica['store'], contentCid: string, keys: Record<string, string>, check: SignatureCheck): string[] {
  const subject = approvalSubject(store, contentCid)
  return readApprovals(store, contentCid).filter(a => {
    if (a.subject !== subject || !keys[a.by]) return false
    try { return check(approvalPayload(a), a.attestation, keys[a.by]!) } catch { return false }
  }).map(a => a.approver)
}

/** The open submission named `name` on the node at `at`. */
export function openSubmission(r: Replica, at: Scope, name: string): ProposalRecord {
  const cid = resolveScope(r.store, headCid(r), at)
  const found = cid && readProposals(r.store, content(r.store, cid)).find(p => p.name === name && p.status === 'open')
  if (!found) throw new Error(`No open submission ${name} here.`)
  return found
}

/** Approve the submission `name` at `at` as `approver`: its content gets their signed approval row. */
export function approveSubmission(r: Replica, at: Scope, name: string, approver: string, signer: ApprovalSigner, now: number): Replica {
  const store = r.store, submission = openSubmission(r, at, name)
  const unsigned = { approver, subject: approvalSubject(store, submission.contentCid), by: signer.by, issuedAt: now }
  const value = withApproval(store, submission.contentCid, { ...unsigned, attestation: signer.sign(approvalPayload(unsigned)) })
  const proposal = put(store, proposalContent(store, submission.peerId, submission.name, value, submission.baseCid, now))
  commitRoot(store, updateAtScope(store, headCid(r), at, node => withProposal(store, node, submission.peerId, proposal, submission.name), 'node'), now)
  return { ...r }
}

/** The group's merge rule at `at`: the approvers its `approveMerge` row's pattern names, or null (the default rule). */
export function mergeRule(r: Replica, at: Scope): string[] | null {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return null
  const type = capabilityTarget(r.store, APPROVE_MERGE)
  const row = valueContent(r.store, cid).children.map(edge => plainEdge(r.store, edge)).find(edge => edge[0] === type)
  const pattern = row && refValueCid(r.store, content(r.store, row[1]))
  if (!pattern) return null
  return content(r.store, pattern).children.filter(edge => isApprovalRow(r.store, edge))
    .map(edge => content(r.store, plainEdge(r.store, edge)[1]).data.alias?.id ?? '')
    .filter(id => id.startsWith(APPROVAL_PREFIX)).map(id => id.slice(APPROVAL_PREFIX.length))
}

/** Set the group's merge rule at `at`: approval of each of `approvers` (a pattern of their approval rows). */
export function setMergeRule(r: Replica, at: Scope, approvers: string[], now: number): Replica {
  const store = r.store, type = capabilityTarget(store, APPROVE_MERGE), approve = capabilityTarget(store, APPROVE)
  const pattern = put(store, { data: {}, children: approvers.map(p => [approve, put(store, refNodeContent(store, { alias: { id: approvalId(p) }, name: { content: approvalId(p) } }, null))] as FosPathElem) })
  const row: FosPathElem = [type, put(store, refNodeContent(store, { alias: { id: MERGE_RULE_ID }, name: { content: MERGE_RULE_ID } }, pattern))]
  commitRoot(store, updateAtScope(store, headCid(r), at, value => ({ ...value, children: [...value.children.filter(edge => plainEdge(store, edge)[0] !== type), row] })), now)
  return { ...r }
}

/** The default rule: the owner and every member that may edit at `at`, but the proposer (its submission is its approval). */
export function defaultApprovers(r: Replica, at: Scope, proposer: string): string[] {
  const cid = resolveScope(r.store, headCid(r), at)
  const members = cid ? readMembers(r.store, content(r.store, cid)) : []
  const editors = members.filter(m => m.capabilities.includes('edit') && !m.disabled?.includes('edit') && m.peerId !== 'fos' && m.peerId !== MARKET_PEER).map(m => m.peerId)
  return [...new Set([r.meta.peerId, ...editors])].filter(p => p !== proposer)
}

/** Who still has to approve the submission `name` at `at` under the group's rule. */
export function missingApprovals(r: Replica, at: Scope, name: string, keys: Record<string, string>, check: SignatureCheck): string[] {
  const submission = openSubmission(r, at, name)
  const approved = new Set(verifiedApprovers(r.store, submission.contentCid, keys, check))
  return (mergeRule(r, at) ?? defaultApprovers(r, at, submission.peerId)).filter(p => !approved.has(p))
}

/** Apply the submission `name` at `at` to main when the group's rule is met; else nothing changes. */
export function mergeIfApproved(r: Replica, at: Scope, name: string, keys: Record<string, string>, check: SignatureCheck, now: number): { replica: Replica; merged: boolean; missing: string[] } {
  const missing = missingApprovals(r, at, name, keys, check)
  if (missing.length) return { replica: r, merged: false, missing }
  return { replica: applyProposalAt(r, at, openSubmission(r, at, name).cid, r.meta.peerId, now), merged: true, missing }
}
