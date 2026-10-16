import { hashContent } from '../dag-implementation/cid'
import type { NodeRequest, ProvidedNode, NodeShape } from './node-provider'

const pathSchema = { type: 'array', items: { type: 'string' }, maxItems: 64 }
const tools = [
  { name: 'fos_read', description: 'Read one node and its visible child IDs. Paths are relative to this connection. Start at [].', inputSchema: { type: 'object', properties: { path: pathSchema }, additionalProperties: false } },
  { name: 'fos_propose_text', description: 'Propose replacement node text for owner review. Read the node first and pass its revision. Does not merge changes or run effects.', inputSchema: { type: 'object', properties: { path: pathSchema, expected: { type: 'string' }, text: { type: 'string', maxLength: 16000 } }, required: ['expected', 'text'], additionalProperties: false } },
]
function shape(node: ProvidedNode): NodeShape { return { data: node.data, children: node.children } }
function revision(node: ProvidedNode): string { return hashContent({ data: { description: { content: JSON.stringify(shape(node)) } }, children: [] }) }

/** Transport supplies a fixed identity/scope. Tool arguments cannot replace either. */
export async function agentMcp(message: any, exchange: (path: string[], update?: NodeRequest['update']) => Promise<ProvidedNode>): Promise<unknown | null> {
  if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || ('id' in message && typeof message.id !== 'string' && typeof message.id !== 'number')) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }
  if (!('id' in message)) return null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result })
  if (message.method === 'initialize') return ok({ protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'fos-node', version: '1.0.0' } })
  if (message.method === 'ping') return ok({})
  if (message.method === 'tools/list') return ok({ tools })
  if (message.method !== 'tools/call') return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unknown method' } }
  try {
    const args = message.params?.arguments ?? {}, path = args.path ?? []
    if (!Array.isArray(path) || path.length > 64 || path.some(id => typeof id !== 'string' || !id || id.length > 256 || id === '.' || id === '..')) throw new Error('Use child IDs relative to this connection.')
    if (!tools.some(tool => tool.name === message.params?.name)) throw new Error('Unknown tool')
    let node = await exchange(path)
    if (message.params.name === 'fos_propose_text') {
      if (typeof args.text !== 'string' || args.text.length > 16000) throw new Error('Text must be at most 16000 characters.')
      if (args.expected !== revision(node)) throw new Error('Node changed. Read it again before proposing.')
      if (!Object.hasOwn(node.data, 'description')) throw new Error('Node text is not exposed to this peer.')
      const base = shape(node)
      node = await exchange(path, { base, value: { ...base, data: { ...base.data, description: { content: args.text } } } })
    }
    return ok({ content: [{ type: 'text', text: JSON.stringify({ path, revision: revision(node), data: node.data, children: node.children.map(child => ({ id: child.id, kind: child.kind, path: [...path, child.id] })), ...(message.params.name === 'fos_propose_text' ? { status: 'pending-owner-review' } : {}) }) }] })
  } catch (error) { return ok({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }) }
}
