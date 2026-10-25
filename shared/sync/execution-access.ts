import { nodeAuthorityAt } from './node-context'
import { nodeLinkMaskAt, type NodeAuthority } from './node-provider'
/** Owner-authorized execution interactions. Transport must bind identity and scope. */
import { executionInputs } from './sharing'
import { evaluationRecord, evaluationSteps } from './evaluation'
import { addAllocation, consumeAllocation, supplyRequirement } from './arguments'
import { proposeRefAt, headCid, type Replica } from './replica'
import { acceptSubmission } from './approvals'
import { put, type ResourceType, type Scope } from './graph'
import { compileRow } from './ref-compiler'
import { resolveRefExpression, type RefAccess } from './ref-paths'

export function executionSnapshot(r: Replica, path: Scope, authority?: NodeAuthority) {
  if (authority) nodeAuthorityAt(r, path, authority)
  const allowed = (at: Scope, field = 'description') => {
    if (!authority) return true
    try { nodeAuthorityAt(r, at, authority); const mask = nodeLinkMaskAt(r, at, authority.peerId); return !mask.fields || mask.fields.includes(field) } catch { return false }
  }
  const compilation = compileRow(r, path, { canRead: (store, _cid, at) => (!authority || store === r.store) && allowed(at) })
  return { revision: headCid(r), status: evaluationRecord(r, path)?.status ?? 'idle', compilation, canRun: compilation.canRun, inputs: executionInputs(r, path).filter(f => allowed([...path, ...f.path!], f.kind === 'text' || f.kind === 'ref' ? 'description' : f.direction === 'consume' ? 'allocation' : 'requirement')), nodes: evaluationSteps(r, path).filter(s => !s.row?.construction && allowed(s.path)).map(s => ({ path: s.path.slice(path.length), text: s.row?.title ?? '', type: s.row?.type ?? '' })) }
}
export function executionInput(r: Replica, path: Scope, body: any, peer: string, now: number, access: RefAccess = {}): Replica {
  if (body.revision !== headCid(r)) throw new Error('Evaluation changed. Read it again before submitting.')
  const status = evaluationRecord(r, path)?.status ?? 'idle'
  if (!['idle', 'rolled-back'].includes(status)) throw new Error('This evaluation no longer accepts input.')
  const field = executionInputs(r, path).find(f => f.key === body.key)
  if (!field?.path) throw new Error('Only declared inputs may be submitted.')
  const target = [...path, ...field.path], value = body.value
  if (field.kind === 'ref') {
    if (typeof value !== 'string') throw new Error('Supply a ref property path.')
    const resolved = resolveRefExpression(r, target.slice(0, -1), value, access)
    const location = resolved.locations[0]
    if (resolved.status !== 'ready' || !location || location.store !== r.store) throw new Error('The supplied ref is unavailable in this graph.')
    // the visitor's value is its submission; the host accepts it (its approval, under the node's rule)
    const proposal = proposeRefAt(r, target, location.cid, peer, now)
    return acceptSubmission(proposal.replica, target, proposal.proposalCid, r.meta.peerId, now).replica
  }
  if (field.kind === 'text') {
    if (typeof value !== 'string' || value.length > 8000) throw new Error('Text must be at most 8000 characters.')
    const proposal = proposeRefAt(r, target, put(r.store, { data: { description: { content: value } }, children: [] }), peer, now)
    return acceptSubmission(proposal.replica, target, proposal.proposalCid, r.meta.peerId, now).replica
  }
  if (field.kind === 'confirmation' || field.kind === 'choice') {
    if (field.kind === 'confirmation' ? value !== true : !Number.isInteger(value) || value < 0 || value >= (field.options?.length ?? 0)) throw new Error('Invalid requirement response.')
    return supplyRequirement(r, target.slice(0, -1), target.at(-1)!, { by: peer, ...(field.kind === 'choice' ? { choice: value } : {}) }, now)
  }
  if (!value || !Number.isFinite(value.amount) || value.amount < 0 || value.type !== field.type || value.unit !== field.unit || field.direction === 'consume' && value.amount > (field.amount ?? 0) || field.direction !== 'consume' && value.amount < (field.amount ?? 0)) throw new Error('Allocation does not match the declared amount.')
  const allocation = { resource: '', type: field.type as ResourceType, amount: value.amount, unit: field.unit!, ...(value.start !== undefined ? { start: value.start } : {}), ...(value.end !== undefined ? { end: value.end } : {}) }
  // Using an offered allocation is an allocate invocation under the execution; the evaluation moves the authority.
  if (field.direction === 'consume') return consumeAllocation(r, path, target, value.amount, now)
  // A visitor's amount is a plain allocation row inside the requirement: data for the owner, not authority. The
  // requirement is satisfied only when a grant is bound to it through an allocate invocation.
  return addAllocation(r, target, field.name, now, { ...allocation, by: peer })
}
