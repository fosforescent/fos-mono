import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or later on the desktop PATH')
    if (request.probe) {
      const codex = await import('@openai/codex-sdk').then(({ Codex }) => { new Codex(); return true }).catch(() => false)
      const claude = await import('@anthropic-ai/claude-agent-sdk').then(() => true, () => false)
      emit({ type: 'availability', codex: codex && (!!(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY) || existsSync(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json'))), claude: claude && !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_USE_BEDROCK || process.env.CLAUDE_CODE_USE_VERTEX) })
      return
    }
    if (!['codex','claude'].includes(request.provider) || !request.cwd || !request.prompt?.trim()) throw new Error('Provider, repository, and task prompt are required')
    context = await serveContext(request.context)
    const prompt = `Work in the selected repository. The fos MCP server exposes the task subtree from which this run was launched, captured at revision ${request.context.revision}. Start with fos_read at []. Read relevant descendants before implementing.\n\n${request.prompt}`
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
