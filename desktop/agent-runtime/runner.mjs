import { launchCli } from './cli.mjs'
import { createInterface } from 'node:readline'
import { serveContext } from './context.mjs'

const emit = event => { if (event.text) event.text = event.text.slice(-100_000); if (event.message) event.message = event.message.slice(-100_000); process.stdout.write(JSON.stringify(event) + '\n') }
const abort = new AbortController()
let started = false, context
const input = createInterface({ input: process.stdin })
input.on('close', () => abort.abort())
process.on('SIGTERM', () => abort.abort())
input.on('line', line => {
  try {
    const message = JSON.parse(line)
    if (message.cancel) { abort.abort(); return }
    if (!started) { started = true; void run(message) }
  } catch { emit({ type: 'error', message: 'Invalid runtime input' }) }
})
/**
 * Open the provider's CLI in a visible terminal. With `mcp` it is connected to the node's own MCP endpoint on this
 * device (the agent peer's grants decide its tools); otherwise (feature verification) it gets a read-only snapshot.
 */
async function run(request) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Install Node.js 20 or later on the desktop PATH')
    if (!['codex','claude'].includes(request.provider) || !request.cwd || !request.prompt?.trim()) throw new Error('Provider, directory, and task prompt are required')
    if (request.mcp) {
      const url = new URL(request.mcp.url)
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || typeof request.mcp.token !== 'string') throw new Error('The node MCP server must be an authenticated loopback endpoint')
      context = { url: url.href, token: request.mcp.token, close() {} }
    } else context = await serveContext(request.context)
    await launchCli(request, context, abort.signal, emit)
    emit({ type: abort.signal.aborted ? 'cancelled' : 'completed' })
  } catch (error) { emit({ type: abort.signal.aborted ? 'cancelled' : 'error', message: String(error.message || error) }) }
  finally { context?.close(); input.close(); process.stdin.destroy() }
}
