import { nodeAuthorityAt } from './node-context'
import { nodeLinkMaskAt, type NodeAuthority } from './node-provider'
/** Owner-authorized execution interactions. Transport must bind identity and scope. */
import { executionInputs } from './sharing'
import { evaluationRecord, evaluationSteps, writeNodeValue } from './evaluation'
import { proposeRefAt, applyProposalAt, addRow, addSupply, headCid, type Replica } from './replica'
import { put, type ResourceType, type Scope } from './graph'

export function executionSnapshot(r: Replica, path: Scope, authority?: NodeAuthority) {
  if (authority) nodeAuthorityAt(r, path, authority)
  const allowed = (at: Scope, field = 'description') => {
    if (!authority) return true
    try { nodeAuthorityAt(r, at, authority); const mask = nodeLinkMaskAt(r, at, authority.peerId); return !mask.fields || mask.fields.includes(field) } catch { return false }
  }
  return { revision: headCid(r), status: evaluationRecord(r, path)?.status ?? 'idle', inputs: executionInputs(r, path).filter(f => allowed([...path, ...f.path!], f.kind === 'text' ? 'description' : f.direction === 'consume' ? 'allocation' : 'requirement')), nodes: evaluationSteps(r, path).filter(s => !s.row?.construction && allowed(s.path)).map(s => ({ path: s.path.slice(path.length), text: s.row?.title ?? '', kind: s.row?.kind ?? 'task' })) }
}
export function executionInput(r: Replica, path: Scope, body: any, peer: string, now: number): Replica {
  if (body.revision !== headCid(r)) throw new Error('Evaluation changed. Read it again before submitting.')
  const status = evaluationRecord(r, path)?.status ?? 'idle'
  if (!['idle', 'rolled-back'].includes(status)) throw new Error('This evaluation no longer accepts input.')
  const field = executionInputs(r, path).find(f => f.key === body.key)
  if (!field?.path) throw new Error('Only declared inputs may be submitted.')
  const target = [...path, ...field.path], value = body.value
  if (field.kind === 'text') {
    if (typeof value !== 'string' || value.length > 8000) throw new Error('Text must be at most 8000 characters.')
    const proposal = proposeRefAt(r, target, put(r.store, { data: { description: { content: value } }, children: [] }), peer, now)
    return applyProposalAt(proposal.replica, target, proposal.proposalCid, r.meta.peerId, now)
  }
  if (field.kind === 'confirmation' || field.kind === 'choice') {
    if (field.kind === 'confirmation' ? value !== true : !Number.isInteger(value) || value < 0 || value >= (field.options?.length ?? 0)) throw new Error('Invalid requirement response.')
    return addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: field.kind, by: peer, ...(field.kind === 'choice' ? { choice: value } : {}) }, now)
  }
  if (!value || !Number.isFinite(value.amount) || value.amount < 0 || value.type !== field.type || value.unit !== field.unit || field.direction === 'consume' && value.amount > (field.amount ?? 0) || field.direction !== 'consume' && value.amount < (field.amount ?? 0) || field.start !== undefined && (!Number.isFinite(value.start) || value.start > field.start) || field.end !== undefined && (!Number.isFinite(value.end) || value.end < field.end)) throw new Error('Allocation does not match the declared bounds.')
  const allocation = { resource: '', type: field.type as ResourceType, amount: value.amount, unit: field.unit!, ...(field.start !== undefined ? { start: field.start } : {}), ...(field.end !== undefined ? { end: field.end } : {}) }
  if (field.direction === 'consume') return writeNodeValue(r, target, 'fos:consumed', { peer, value: allocation, time: now }, now)
  const id = crypto.randomUUID()
  r = addRow(r, target, 'allocation', field.name, now, { id, allocation })
  return addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: 'allocation', by: peer, ref: id }, now)
}

/** Same interaction vocabulary over stateless MCP. Scope is supplied by the transport. */
export async function executionMcp(message: any, interact: (body: any) => Promise<unknown>) {
  if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || ('id' in message && !['string', 'number'].includes(typeof message.id))) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }
  if (!('id' in message)) return null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result })
  if (message.method === 'initialize') return ok({ protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'fos-evaluation', version: '1.0.0' } })
  if (message.method === 'ping') return ok({})
  if (message.method === 'tools/list') return ok({ tools: [
    { name: 'fos_evaluation_read', description: 'Read this evaluation and its declared inputs.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'fos_evaluation_input', description: 'Provide one declared input or consume one offered allocation. Read first for keys, bounds and revision.', inputSchema: { type: 'object', properties: { revision: { type: 'string' }, key: { type: 'string' }, value: {} }, required: ['revision', 'key', 'value'], additionalProperties: false } },
    { name: 'fos_evaluation_complete', description: 'Complete this evaluation after satisfying its inputs.', inputSchema: { type: 'object', properties: { revision: { type: 'string' } }, required: ['revision'], additionalProperties: false } }
  ] })
  if (message.method !== 'tools/call') return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unknown method' } }
  try {
    const action = ({ fos_evaluation_read: 'read', fos_evaluation_input: 'input', fos_evaluation_complete: 'complete' } as Record<string, string>)[message.params?.name]
    if (!action) throw new Error('Unknown tool')
    const args = message.params?.arguments ?? {}
    const result = await interact({ revision: args.revision, key: args.key, value: args.value, action })
    return ok({ content: [{ type: 'text', text: JSON.stringify(result) }] })
  } catch (error) { return ok({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }) }
}
