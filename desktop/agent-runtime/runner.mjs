import { launchCli } from './cli.mjs'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { probeAgents } from './availability.mjs'
import { serveContext } from './context.mjs'

const emit = event => { if (event.text) event.text = event.text.slice(-100_000); if (event.message) event.message = event.message.slice(-100_000); process.stdout.write(JSON.stringify(event) + '\n') }
const abort = new AbortController(), decisions = new Map()
abort.signal.addEventListener('abort', () => { for (const resolve of decisions.values()) resolve(false); decisions.clear() })
let started = false, context
const input = createInterface({ input: process.stdin })
input.on('close', () => abort.abort())
process.on('SIGTERM', () => abort.abort())
input.on('line', line => {
  try {
    const message = JSON.parse(line)
    if (message.cancel) { abort.abort(); for (const resolve of decisions.values()) resolve(false); return }
    if (message.permission) { decisions.get(message.permission)?.(message.allow === true); decisions.delete(message.permission); return }
    if (!started) { started = true; void run(message) }
  } catch { emit({ type: 'error', message: 'Invalid runtime input' }) }
})
async function run(request) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Install Node.js 20 or later on the desktop PATH')
    if (request.probe) {
      emit(await probeAgents())
      return
    }
    if (!['codex','claude'].includes(request.provider) || !request.cwd || !request.prompt?.trim()) throw new Error('Provider, repository, and task prompt are required')
    if (request.cli && request.evaluation) throw new Error('CLI launches require read-only node context')
    if (request.mcp && request.evaluation) throw new Error('A run uses either the node MCP server or an evaluation endpoint')
    if (request.mcp) {
      // the node's own MCP server on this device: the tools it exposes are exactly the grants the user toggled on
      const url = new URL(request.mcp.url)
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || typeof request.mcp.token !== 'string') throw new Error('The node MCP server must be an authenticated loopback endpoint')
      context = { url: url.href, token: request.mcp.token, close() {} }
    } else if (request.evaluation) {
      const url = new URL(request.evaluation.url)
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || typeof request.evaluation.token !== 'string') throw new Error('Evaluation requires an authenticated loopback endpoint')
      context = { url: url.href, token: request.evaluation.token, close() {} }
    } else context = await serveContext(request.context)
    const prompt = request.mcp ? `The fos MCP server is this node on the user's device, with the tools the user granted you (read, propose changes, decide or evaluate). Start with fos_read at []. Record outcomes on the node through those tools.\n\n${request.prompt}` : request.evaluation ? `Use the fos evaluation MCP tools to perform this task. Start with fos_evaluation_read. Provide only declared inputs and consume only offered allocations. Complete when satisfied.\n\n${request.prompt}` : `Work in the selected repository. The fos MCP server exposes the task subtree from which this run was launched, captured at revision ${request.context.revision}. Start with fos_read at []. Read relevant descendants before implementing.\n\n${request.prompt}`
    if (request.cli) {
      await launchCli(request, context, abort.signal, emit)
      emit({ type: abort.signal.aborted ? 'cancelled' : 'completed' }); return
    }
    if (request.provider === 'codex') {
      const { Codex } = await import('@openai/codex-sdk')
      const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY, config: { mcp_servers: { fos: { url: context.url, http_headers: { Authorization: `Bearer ${context.token}` } } } } })
      const thread = codex.startThread({ workingDirectory: request.cwd, sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccessEnabled: false })
      const { events } = await thread.runStreamed(prompt, { signal: abort.signal })
      for await (const event of events) {
        if (event.type === 'thread.started') emit({ type: 'session', id: event.thread_id })
        if (event.type === 'item.completed' && event.item.type === 'agent_message') emit({ type: 'text', text: event.item.text })
        if (event.type === 'turn.failed') throw new Error(event.error.message)
        if (event.type === 'error') throw new Error(event.message)
      }
    } else {
      const { query } = await import('@anthropic-ai/claude-agent-sdk')
      for await (const message of query({ prompt, options: {
        cwd: request.cwd, abortController: abort, permissionMode: 'default', settingSources: [], maxTurns: 100,
        mcpServers: { fos: { type: 'http', url: context.url, headers: { Authorization: `Bearer ${context.token}` } } },
        canUseTool: async (tool, args) => {
          if (abort.signal.aborted) return { behavior: 'deny', message: 'Run cancelled' }
          if (JSON.stringify(args).length > 100_000) return { behavior: 'deny', message: 'Tool input too large to review' }
          const id = randomUUID()
          const allowed = new Promise(resolve => decisions.set(id, resolve))
          emit({ type: 'permission', id, tool, input: args })
          return await allowed ? { behavior: 'allow', updatedInput: args } : { behavior: 'deny', message: 'User denied permission' }
        }
      } })) {
        if (message.type === 'system' && message.subtype === 'init') emit({ type: 'session', id: message.session_id })
        if (message.type === 'assistant') for (const part of message.message.content) if (part.type === 'text') emit({ type: 'text', text: part.text })
        if (message.type === 'result' && message.is_error) throw new Error(message.errors?.join('\n') || 'Claude run failed')
      }
    }
    emit({ type: abort.signal.aborted ? 'cancelled' : 'completed' })
  } catch (error) { emit({ type: abort.signal.aborted ? 'cancelled' : 'error', message: String(error.message || error) }) }
  finally { context?.close(); input.close(); process.stdin.destroy() }
}
