/**
 * MCP is one adapter of the event grammar (events.ts): each tool is one event kind, framed as JSON-RPC. The same
 * module serves the account server, the desktop loopback endpoints and the `fos` binary's local server, so agents
 * see one vocabulary wherever they connect. The transport fixes the principal; tool arguments cannot replace it.
 */
import type { Capability } from './graph'
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
  tool('fos_outstanding', 'outstanding', 'List open work inside the attachment: rows not done yet and requirements not satisfied yet, those assigned to you first, with paths, revision (for fos_propose expected), valueRevision (for fos_evaluate) and what blocks them. Read an item, do the work, then propose the result or complete it. Paginate with offset.', { offset: { type: 'integer', minimum: 0, maximum: 1000 } }, []),
  tool('fos_await_task', 'outstanding', 'Wait for the first outstanding task or unmet requirement below path. Uses fos_outstanding ordering: assigned to you first, then depth-first tree order. Returns {status:"task", task, revision, truncated}, or {status:"timeout", task:null, revision, truncated}. Skips claimed subtrees but does not claim work; call fos_claim_task with the task path and revision before working. Another agent can win the claim race. Blocked work includes blockedBy. Call again after a timeout; read and review the task before acting.', { timeoutMs: { type: 'integer', minimum: 0, maximum: 30000, default: 25000, description: 'Maximum wait; 0 checks immediately.' } }, []),
  tool('fos_claim_task', 'work', 'Exclusively claim an outstanding task subtree for 15 minutes. Requires execute and edit. expected is the task revision from discovery or read. On success call tools/list: task tools replace the general tools until successful submission, release or lease expiry.', { expected: { type: 'string' } }, ['path', 'expected'], false),
  tool('fos_task_status', 'work', 'Get your active claim and expiry, or null. Call tools/list after any change of claim.', {}, []),
  tool('fos_propose', 'submit', 'Submit changes against the attachment. Read [] first; expected must equal its revision. An owner applies them; anyone else leaves a named proposal for the owner to review. Does not run effects. Batch related edits.', {
    expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 100 },
    changes: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', properties: { path: pathSchema, operation: { enum: ['add_row', 'add_task', 'add_note', 'add_plain', 'rename', 'complete'] }, type: { type: 'string', description: 'add_row: a standard-library row type, e.g. lib.note' }, id: { type: 'string', description: 'add operations: the new row id, so later changes can add inside it' }, text: { type: 'string', maxLength: 16000 }, done: { type: 'boolean' } }, required: ['path', 'operation'], additionalProperties: false } },
  }, ['expected', 'changes'], false),
  tool('fos_input', 'input', 'Provide one declared input of an evaluation (text, confirmation true, a zero-based choice, or an allocation {type, unit, amount, start?, end?}). Read the node first for keys, bounds and its revision (`expected`).', { expected: { type: 'string' }, key: { type: 'string' }, value: {} }, ['expected', 'key', 'value'], false),
  tool('fos_evaluate', 'complete', 'Evaluate a node. The owner\'s host runs it through its handler registry (checks, effect journal, recovery; can create external effects); anyone else leaves an evaluation request for the owner\'s rules to run or review. expected is valueRevision from fos_read(path). Never retry an uncertain effect automatically.', { expected: { type: 'string' }, recover: { type: 'boolean' } }, ['path', 'expected'], false),
]
export const OWNER_TOOLS = [
  tool('fos_create_branch', 'branch', 'Create a content-addressed alternative at a node. Account owner only. expected is the revision from fos_read([]). Does not change other clients\' selection.', { expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 200 } }, ['path', 'expected', 'name'], false),
  tool('fos_decide', 'decide', 'Approve or reject a pending submission at a node. Requires the edit capability (owners have it).', { proposalId: { type: 'string' }, decision: { enum: ['approve', 'reject'] } }, ['proposalId', 'decision'], false),
  tool('fos_invite', 'invite', 'Make a Fos user a member of a node (they may propose on it; the node appears in their Home). Account owner only.', { user: { type: 'string', minLength: 1, maxLength: 64 } }, ['user'], false),
]
const claimId = { type: 'string', minLength: 1, description: 'The current claim ID. Expired or released claims cannot be used.' }
const taskNames: Record<string, string> = { fos_read: 'fos_task_read', fos_search: 'fos_task_search', fos_propose: 'fos_task_submit', fos_input: 'fos_task_input', fos_evaluate: 'fos_task_evaluate' }
export const TASK_TOOLS = [
  ...MCP_TOOLS.filter(t => taskNames[t.name]).map(t => {
    const { branches: _branches, ...properties } = t.inputSchema.properties
    return { ...t, name: taskNames[t.name]!, description: `Within your claimed task only. [] is the task root; branches are pinned. ${t.kind === 'submit' ? 'A successful submission releases the claim and restores general tools; call tools/list afterward. ' : ''}${t.description}`, inputSchema: { ...t.inputSchema, properties: { ...properties, claimId }, required: [...t.inputSchema.required, 'claimId'] } }
  }),
  tool('fos_task_renew', 'work', 'Extend your task lease by 15 minutes. Renew before expiresAt while working.', { claimId }, ['claimId'], false),
  tool('fos_task_release', 'work', 'Abandon this claim without submitting. Restores the general tools; call tools/list afterward.', { claimId }, ['claimId'], false),
]
export const MCP_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']

/** Which grants expose a tool to a non-owner (any one of them). Owners see everything. */
const TOOL_GRANTS: Record<string, Capability[]> = {
  fos_read: ['read', 'edit', 'execute'], fos_search: ['read', 'edit', 'execute'], fos_outstanding: ['execute'], fos_await_task: ['execute'], fos_claim_task: ['execute'], fos_task_status: ['read', 'edit', 'execute'], fos_task_renew: ['execute'], fos_task_release: ['read', 'edit', 'execute'], fos_propose: ['edit'], fos_input: ['edit'],
  fos_evaluate: ['edit', 'execute'], fos_decide: ['edit'], fos_create_branch: [], fos_invite: [],
}
/** The tools a credential may call: all of them for an owner, otherwise those its grants on the attachment allow (none when nothing is granted). */
function visibleTools(owner: boolean, capabilities?: Capability[], claimed = false) {
  const candidates = claimed ? [...TASK_TOOLS, ...MCP_TOOLS.filter(t => t.name === 'fos_task_status')] : [...MCP_TOOLS, ...OWNER_TOOLS]
  if (owner) return candidates
  const grants = capabilities ?? ['read', 'edit']
  return candidates.filter(t => {
    if (t.name === 'fos_claim_task' && !grants.includes('edit')) return false
    const original = Object.keys(taskNames).find(name => taskNames[name] === t.name) ?? t.name
    return TOOL_GRANTS[original]?.some(c => grants.includes(c))
  })
}
export function mcpTools(owner: boolean, capabilities?: Capability[], claimed = false) {
  return visibleTools(owner, capabilities, claimed).map(({ kind: _kind, ...t }) => t)
}

/** Scope and claim ownership are rechecked atomically by the dispatcher, including cached tool calls. */
export function mcpEvent(name: string, args: unknown, owner: boolean, capabilities?: Capability[]): FosEvent {
  const found = [...visibleTools(owner, capabilities), ...visibleTools(owner, capabilities, true)].find(t => t.name === name)
  if (!found) throw new Error('Tool unavailable for this credential.')
  if (args !== undefined && (!args || typeof args !== 'object' || Array.isArray(args))) throw new Error('Tool arguments must be an object.')
  const input = (args ?? {}) as Record<string, unknown>
  const task = Object.values(taskNames).includes(name)
  if (task && (typeof input.claimId !== 'string' || !input.claimId)) throw new Error('A claimId is required.')
  if (task && input.branches !== undefined) throw new Error('Task tools cannot change branches.')
  if (task && Object.keys(input).some(key => !(key in found.inputSchema.properties))) throw new Error('Unexpected task-tool argument.')
  const operations: Record<string, string> = { fos_claim_task: 'claim', fos_task_status: 'status', fos_task_renew: 'renew', fos_task_release: 'release' }
  const event = parseEvent({ ...input, kind: found.kind, ...(operations[name] ? { operation: operations[name] } : {}) })
  return { ...event, mcp: true, ...(task ? { workClaim: input.claimId as string } : {}) }
}

type Rpc = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any }
const invalid = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/** Cancellable transport wait. The graph is re-read and authority checked after each wait. */
export function waitMcp(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('MCP request cancelled.')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
type McpHost = { owner: boolean; capabilities?: Capability[]; dispatch(event: FosEvent): unknown | Promise<unknown>; serverName?: string; protocolVersion?: string; toolListChanges?: boolean
  /** Omitted in QuickJS: its native transport repeats the synchronous probe outside the workspace lock. */
  wait?(ms: number): Promise<void>
}
function awaitTask(event: FosEvent, timeoutMs: number, host: McpHost): unknown | Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  const inspect = (result: unknown): unknown | Promise<unknown> => {
    const work = result as { items: unknown[]; revision: string; truncated: boolean }
    if (!Array.isArray(work?.items)) throw new Error('Invalid outstanding-work response.')
    const task = work.items[0] ?? null, remaining = deadline - Date.now()
    if (task || remaining <= 0 || !host.wait) return { status: task ? 'task' : 'timeout', task, revision: work.revision, truncated: work.truncated }
    return host.wait(Math.min(1000, remaining)).then(probe)
  }
  const probe = (): unknown | Promise<unknown> => {
    const result = host.dispatch(event)
    return result instanceof Promise ? result.then(inspect) : inspect(result)
  }
  return probe()
}

/**
 * Frame JSON-RPC around the grammar. `dispatch` returns the event's result (sync or async); the result is the same
 * whichever transport carried the message. Returns null for notifications (no reply).
 */
export function handleMcp(message: unknown, host: McpHost): unknown | null | Promise<unknown | null> {
  const m = message as Rpc
  if (!m || Array.isArray(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string' || ('id' in m && typeof m.id !== 'string' && typeof m.id !== 'number')) return invalid(null, -32600, 'Invalid JSON-RPC request')
  if (!('id' in m)) return null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: m.id, result })
  if (m.method === 'initialize') return ok({ protocolVersion: host.protocolVersion ?? '2025-03-26', capabilities: { tools: host.toolListChanges ? { listChanged: true } : {} }, serverInfo: { name: host.serverName ?? 'fos', version: '1.0.0' } })
  if (m.method === 'ping') return ok({})

  const failure = (error: unknown) => ok({ isError: true, ...(String(m.params?.name).startsWith('fos_task_') ? { _meta: { 'fos/toolsChanged': true } } : {}), content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] })
  const success = (result: unknown) => ok({ ...((result as { toolsChanged?: boolean })?.toolsChanged ? { _meta: { 'fos/toolsChanged': true } } : {}), content: [{ type: 'text', text: JSON.stringify(result) }] })
  try {
    if (m.method === 'tools/list') {
      if (!host.owner && host.capabilities?.length === 0) return ok({ tools: [] })
      const status = host.dispatch({ kind: 'work', operation: 'status', mcp: true })
      const listing = (value: unknown) => ok({ tools: mcpTools(host.owner, host.capabilities, !!(value as { claim?: unknown })?.claim) })
      return status instanceof Promise ? status.then(listing, failure) : listing(status)
    }
    if (m.method !== 'tools/call') return invalid(m.id, -32601, 'Unknown method')
    const event = mcpEvent(m.params?.name, m.params?.arguments, host.owner, host.capabilities)
    let timeoutMs = 25000
    if (m.params?.name === 'fos_await_task') {
      const args = m.params.arguments ?? {}
      if (Object.keys(args).some(key => !['path', 'branches', 'timeoutMs'].includes(key))) throw new Error('Unexpected await-task argument.')
      timeoutMs = args.timeoutMs === undefined ? timeoutMs : args.timeoutMs
      if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 30000) throw new Error('timeoutMs must be an integer between 0 and 30000.')
    }
    const outcome = m.params?.name === 'fos_await_task' ? awaitTask(event, timeoutMs, host) : host.dispatch(event)
    return outcome instanceof Promise ? outcome.then(success, failure) : success(outcome)
  } catch (error) { return failure(error) }
}

export const isMcpTool = (name: unknown): boolean => [...MCP_TOOLS, ...OWNER_TOOLS, ...TASK_TOOLS].some(t => t.name === name)
export { EVENT_KINDS }
