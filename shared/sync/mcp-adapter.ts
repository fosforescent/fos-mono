/**
 * MCP is one adapter of the event grammar (events.ts): each tool is one event kind, framed as JSON-RPC. The same
 * module serves the account server, the desktop loopback endpoints and the `fos` binary's local server, so agents
 * see one vocabulary wherever they connect. The transport fixes the principal; tool arguments cannot replace it.
 */
import { EVENT_KINDS, parseEvent, type EventKind, type FosEvent } from './events'

const pathSchema = { type: 'array', items: { type: 'string', minLength: 1, maxLength: 128 }, maxItems: 32 }
const common = {
  path: { ...pathSchema, description: 'Stable child IDs relative to the attachment. [] is its root; never titles or filesystem paths.' },
  branches: { type: 'array', maxItems: 32, items: { type: 'object', properties: { path: pathSchema, name: { type: 'string' } }, required: ['path', 'name'], additionalProperties: false }, description: 'Branch selections, outermost first. Paths are relative to the attachment.' },
}
const tool = (name: string, kind: EventKind, description: string, properties: Record<string, unknown>, required: string[], readOnlyHint = true) => ({
  name, kind, description, inputSchema: { type: 'object' as const, properties: { ...common, ...properties }, required, additionalProperties: false },
  annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: kind === 'complete' },
})
export const MCP_TOOLS = [
  tool('fos_read', 'read', 'Read a node: its text, immediate children, branch choices, pending submissions, declared inputs of a running evaluation and the actions available to you. Start at []. Paginate children with offset.', { offset: { type: 'integer', minimum: 0 } }, []),
  tool('fos_search', 'search', 'Search node text inside the attachment (bounded depth-first scan, active branches only). Returns paths for fos_read.', { query: { type: 'string', minLength: 1, maxLength: 200 }, offset: { type: 'integer', minimum: 0, maximum: 5000 } }, ['query']),
  tool('fos_propose', 'submit', 'Submit changes against the attachment. Read [] first; expected must equal its revision. An owner applies them; anyone else leaves a named proposal for the owner to review. Does not run effects. Batch related edits.', {
    expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 100 },
    changes: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', properties: { path: pathSchema, operation: { enum: ['add_task', 'add_note', 'add_plain', 'rename', 'complete'] }, text: { type: 'string', maxLength: 16000 }, done: { type: 'boolean' } }, required: ['path', 'operation'], additionalProperties: false } },
  }, ['expected', 'changes'], false),
  tool('fos_input', 'input', 'Provide one declared input of an evaluation (text, confirmation true, a zero-based choice, or an allocation {type, unit, amount, start?, end?}). Read the node first for keys, bounds and its revision (`expected`).', { expected: { type: 'string' }, key: { type: 'string' }, value: {} }, ['expected', 'key', 'value'], false),
  tool('fos_evaluate', 'complete', 'Evaluate a node. The owner\'s host runs it through its handler registry (checks, effect journal, recovery; can create external effects); anyone else leaves an evaluation request for the owner\'s rules to run or review. expected is valueRevision from fos_read(path). Never retry an uncertain effect automatically.', { expected: { type: 'string' }, recover: { type: 'boolean' } }, ['path', 'expected'], false),
]
export const OWNER_TOOLS = [
  tool('fos_create_branch', 'branch', 'Create a content-addressed alternative at a node. Account owner only. expected is the revision from fos_read([]). Does not change other clients\' selection.', { expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 200 } }, ['path', 'expected', 'name'], false),
  tool('fos_decide', 'decide', 'Approve or reject a pending submission at a node. Requires the approve capability (owners have it).', { proposalId: { type: 'string' }, decision: { enum: ['approve', 'reject'] } }, ['proposalId', 'decision'], false),
]
export const MCP_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']

export function mcpTools(owner: boolean) {
  return [...MCP_TOOLS, ...(owner ? OWNER_TOOLS : [])].map(({ kind: _kind, ...t }) => t)
}

/** The event a tool call stands for. Throws `EventError` for unknown tools or bad arguments. */
export function mcpEvent(name: string, args: unknown, owner: boolean): FosEvent {
  const found = [...MCP_TOOLS, ...(owner ? OWNER_TOOLS : [])].find(t => t.name === name)
  if (!found) throw new Error('Tool unavailable for this credential.')
  if (args !== undefined && (!args || typeof args !== 'object' || Array.isArray(args))) throw new Error('Tool arguments must be an object.')
  return parseEvent({ ...(args as object ?? {}), kind: found.kind })
}

type Rpc = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any }
const invalid = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/**
 * Frame JSON-RPC around the grammar. `dispatch` returns the event's result (sync or async); the result is the same
 * whichever transport carried the message. Returns null for notifications (no reply).
 */
export function handleMcp(message: unknown, host: { owner: boolean; dispatch(event: FosEvent): unknown | Promise<unknown>; serverName?: string; protocolVersion?: string }): unknown | null | Promise<unknown | null> {
  const m = message as Rpc
  if (!m || Array.isArray(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string' || ('id' in m && typeof m.id !== 'string' && typeof m.id !== 'number')) return invalid(null, -32600, 'Invalid JSON-RPC request')
  if (!('id' in m)) return null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: m.id, result })
  if (m.method === 'initialize') return ok({ protocolVersion: host.protocolVersion ?? '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: host.serverName ?? 'fos', version: '1.0.0' } })
  if (m.method === 'ping') return ok({})
  if (m.method === 'tools/list') return ok({ tools: mcpTools(host.owner) })
  if (m.method !== 'tools/call') return invalid(m.id, -32601, 'Unknown method')
  const failure = (error: unknown) => ok({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] })
  const success = (result: unknown) => ok({ content: [{ type: 'text', text: JSON.stringify(result) }] })
  try {
    const event = mcpEvent(m.params?.name, m.params?.arguments, host.owner)
    const outcome = host.dispatch(event)
    return outcome instanceof Promise ? outcome.then(success, failure) : success(outcome)
  } catch (error) { return failure(error) }
}

export const isMcpTool = (name: unknown): boolean => [...MCP_TOOLS, ...OWNER_TOOLS].some(t => t.name === name)
export { EVENT_KINDS }
