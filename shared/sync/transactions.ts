/**
 * Proposed writes of one evaluation: pending submissions on the refs it will change, published together at commit.
 * A write addresses a declaration the resolver returned (`ScopedBinding`), never a path a primitive worked out, and
 * its value must satisfy the declaration's pattern.
 */
import { primitive } from './primitives'
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent } from '../types'
import { bookkeepingOf, commitRoot, content, identityCid, isBookkeepingEdge, isProposalEdge, isRefNode, isRowEdge, proposalContent, put, readProposals, refNodeContent, refValueCid, resolveScope, updateAtScope, valueContent, withPrev, withProposal, type ProposalRecord, type Scope } from './graph'
import { isHandlerStateLeft } from './capabilities'
import type { FosPathElem } from '../types'
import { headCid, type Replica } from './replica'
import { patternIsValuePredicate, refValueCompatible } from './scoped-refs'
import type { BindingLocation } from './scope-bindings'

const sender = (evaluationId: string) => `transaction:${evaluationId}`

/**
 * What a write is based on: the ref as accepted, without its proposals and without the handler-state rows inside its
 * value (the evaluator's own journal lands there while the run goes on; it is not a change of the value).
 */
function writeBase(store: FosStore, node: FosNodeContent): string {
  const value = refValueCid(store, node)
  const kept = value && store.table.has(value) ? { ...content(store, value), children: content(store, value).children.filter(edge => !(isRowEdge(store, edge) && isHandlerStateLeft(store, edge[0]))) } : null
  // a hole the journal alone gave a container to still holds nothing
  const stable = kept && (Object.keys(kept.data).length || kept.children.length) ? put(store, kept) : null
  const { updated: _updated, ...data } = node.data
  return put(store, { data, children: [...(stable ? [[primitive(store, 'target'), stable] as FosPathElem] : []), ...node.children.filter(edge => edge[0] !== primitive(store, 'target') && !isBookkeepingEdge(store, edge))] })
}

/** Propose the next value of the declaration `binding`. Nothing reads it as the ref's value until the evaluation commits. */
export function proposeTransactionWrite(r: Replica, binding: BindingLocation, next: string, evaluationId: string, now: number): Replica {
  const store = r.store, at = binding.path
  if (binding.store !== store) throw new Error('A transaction writes only declarations of this graph; foreign owners need their own handlers.')
  const cid = resolveScope(store, headCid(r), at)
  if (!cid || !store.table.has(next)) throw new Error('The transaction destination or its proposed value is unavailable.')
  const node = content(store, cid)
  if (!isRefNode(store, node)) throw new Error('A transaction can only write a ref row.')
  if (binding.pattern && patternIsValuePredicate(store, binding.pattern) && !refValueCompatible(store, binding.pattern, next)) throw new Error(`The proposed value does not satisfy the destination (${at.join('/')}).`)
  // A later step of the same evaluation writes over an earlier step's pending value; the base stays what was accepted.
  const previous = pendingTransactionWrite(store, node, evaluationId)
  const base = previous?.baseCid ?? writeBase(store, node)
  const proposal = put(store, proposalContent(store, sender(evaluationId), `${evaluationId}:${JSON.stringify(at)}`, next, base, now))
  commitRoot(store, updateAtScope(store, headCid(r), at, current => withProposal(store, current, sender(evaluationId), proposal), 'node'), now)
  return { ...r }
}

function pendingTransactionWrite(store: FosStore, node: FosNodeContent, evaluationId: string): ProposalRecord | null {
  return readProposals(store, node).find(proposal => proposal.status === 'open' && proposal.peerId === sender(evaluationId)) ?? null
}

/** The value the ref row at `at` will hold once the evaluation commits, or its current value. */
export function transactionValue(r: Replica, at: Scope, evaluationId: string): string | null {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return null
  const node = content(r.store, cid)
  const pending = pendingTransactionWrite(r.store, node, evaluationId)
  if (pending) return pending.contentCid
  const target = node.children.find(([key]) => key === primitive(r.store, 'target'))
  return target ? target[1] : null
}

/** Every pending write of the evaluation, with the ref row it addresses. */
export function transactionWrites(r: Replica, evaluationId: string): Array<{ path: Scope; proposal: ProposalRecord }> {
  const store = r.store, result: Array<{ path: Scope; proposal: ProposalRecord }> = [], seen = new Set<string>()
  let budget = 20000
  const visit = (cid: string, path: Scope) => {
    if (--budget < 0) throw new Error('Transaction scan exceeds its traversal limit.')
    if (seen.has(cid)) return
    seen.add(cid)
    const node = content(store, cid)
    if (isRefNode(store, node)) { const pending = pendingTransactionWrite(store, node, evaluationId); if (pending) result.push({ path, proposal: pending }) }
    for (const edge of valueContent(store, cid).children) {
      if (!isRowEdge(store, edge)) continue
      const child = identityCid(store, edge), id = store.table.get(child)?.data.alias?.id
      if (id) visit(child, [...path, id])
    }
  }
  visit(headCid(r), [])
  return result
}

/** Publish every pending write of the evaluation in one commit. A ref changed since its write was proposed rejects the whole transaction. */
export function commitTransactionWrites(r: Replica, evaluationId: string, now: number): Replica {
  const store = r.store, writes = transactionWrites(r, evaluationId)
  if (!writes.length) return r
  for (const { path, proposal } of writes) {
    const node = content(store, resolveScope(store, headCid(r), path)!)
    if (proposal.baseCid !== writeBase(store, node)) throw new Error(`A transaction destination changed before commit (${path.join('/')}); run the evaluation again.`)
  }
  for (const write of writes) for (const other of writes) if (other !== write && other.path.length < write.path.length && other.path.every((id, index) => write.path[index] === id))
    throw new Error('A transaction destination cannot replace another destination\'s enclosing scope.')
  let root = headCid(r)
  for (const { path, proposal } of writes) root = updateAtScope(store, root, path, node => {
    const bookkeeping = bookkeepingOf(store, node).filter(edge => !(isProposalEdge(store, edge) && edge[1] === proposal.cid))
    return withPrev(store, refNodeContent(store, { ...node.data, updated: { time: now } }, proposal.contentCid, bookkeeping), put(store, node))
  }, 'node')
  commitRoot(store, root, now)
  return { ...r }
}

/** Drop every pending write of the evaluation. */
export function discardTransactionWrites(r: Replica, evaluationId: string, now: number): Replica {
  const store = r.store
  let root = headCid(r), changed = false
  for (const { path } of transactionWrites(r, evaluationId)) { root = updateAtScope(store, root, path, node => withProposal(store, node, sender(evaluationId), null), 'node'); changed = true }
  if (!changed) return r
  commitRoot(store, root, now)
  return { ...r }
}
