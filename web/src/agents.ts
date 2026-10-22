import { localRepositoryHere } from '../../shared/sync/repository'
/**
 * Coding agents on this computer (desktop): Claude Code and Codex are local peers of the device (`agent-cli:<provider>`),
 * Claude Desktop is one too (`agent-app:claude-desktop`). Their launch buttons live on the peer's own panel. A launch
 * opens a session the user can watch: the CLI in a new terminal, connected to this node's MCP as that peer (its Read /
 * Write / Execute grants here decide the tools), or the Claude Code VS Code tab / a Claude Desktop chat with the prompt.
 */
import { argumentRefs, capabilityTarget, content, headCid, refValueCid, resolveScope, resolveText, view, type Replica, type Scope } from '../../shared/sync/index'
import { inTauri, tauriInvoke } from './project'
import { connectNodeAgent, startPeerMcp } from './node-agent'
import { detachSelf } from './api'
import type { App } from './app'

export type AgentProvider = 'claude' | 'codex'
export const AGENT_CLI_NAME: Record<AgentProvider, string> = { claude: 'Claude Code', codex: 'Codex' }
export const agentPeerId = (provider: AgentProvider) => `agent-cli:${provider}`
export const CLAUDE_DESKTOP_PEER = 'agent-app:claude-desktop'

export function localRepository(r: Replica, path: Scope): string | null {
  for (let depth = path.length; depth >= 0; depth--) {
    const binding = localRepositoryHere(r, path.slice(0, depth))
    if (binding) return binding.device === r.meta.peerId ? binding.path : null
  }
  return null
}
/** A read-only projection of the subtree at `at` (feature verification, and the outline a prompt inlines). */
export function agentContext(r: Replica, at: Scope) {
  // `type`: the row's library type (its edge's left node's graph identity)
  const nodes: Array<{ path: Scope; text: string; type: string; done: boolean | null }> = []
  function walk(path: Scope, relative: Scope, type: string) {
    if (relative.length > 64 || nodes.length >= 5000) throw new Error('Task subtree is too large; launch from a smaller task.')
    const node = view(r, path)
    if (!node) throw new Error('Task is no longer available.')
    nodes.push({ path: relative, text: resolveText(r, path, node.name ?? '').text, type, done: node.done })
    for (const row of node.tasks) {
      // Linked values can point outside this subtree; do not disclose their targets.
      if (row.refId !== undefined || !!row.supply || row.construction) continue
      walk([...path, row.id], [...relative, row.id], row.type)
    }
  }
  walk(at, [], at.length ? view(r, at.slice(0, -1))?.tasks.find(t => t.id === at.at(-1))?.type ?? '' : '')
  return { revision: headCid(r), nodes }
}

/**
 * The prompt a launch starts from: the node's text, where it sits, and (for sessions without the node's MCP) an
 * outline of its rows, bounded to `max` characters.
 */
export function agentPrompt(app: App, scope: Scope, { outline = false, max = 12_000 } = {}): string {
  const r = app.state.replica, node = view(r, scope)
  const where = JSON.stringify(scope) === JSON.stringify(app.state.view) ? app.labels().view.slice(0, -1) : []
  const lines = [node?.name?.trim() || '(untitled node)']
  if (where.length) lines.push('', `In: ${where.join(' / ')}`)
  if (outline) {
    let nodes: ReturnType<typeof agentContext>['nodes'] = []
    try { nodes = agentContext(r, scope).nodes.slice(1) } catch { /* too large: the title alone */ }
    if (nodes.length) lines.push('', 'Rows in this node:', ...nodes.map(n => `${'  '.repeat(n.path.length - 1)}- ${n.done === null ? '' : n.done ? '[x] ' : '[ ] '}${n.text}`))
  }
  const text = lines.join('\n')
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

type Launch = { id: string; provider: AgentProvider; scope: Scope; stopMcp?: () => Promise<void> }
const launches = new WeakMap<App, Launch[]>()
/** The terminal sessions this app opened for `provider` (they end when the terminal closes or the user stops them). */
export function runningAgents(app: App, provider: AgentProvider): Launch[] {
  return (launches.get(app) ?? []).filter(l => l.provider === provider)
}
export async function stopAgent(app: App, launch: Launch): Promise<void> {
  await tauriInvoke('agent_control', { id: launch.id, message: { cancel: true } })?.catch(() => {})
  await launch.stopMcp?.().catch(() => {})
}

/**
 * Open the provider's CLI in a new visible terminal on the node at `scope`. It is connected to the node's MCP as the
 * agent peer, so it reads notes and rows on demand, lists outstanding work (execute), and proposes results (write).
 * Feature verification (`verify`) instead hands it a read-only snapshot of the subtree.
 */
export async function launchAgent(app: App, provider: AgentProvider, options: { scope?: Scope; cwd?: string; prompt?: string; verify?: boolean; chrome?: boolean; branch?: string; throwErrors?: boolean } = {}): Promise<void> {
  const name = AGENT_CLI_NAME[provider], scope = [...(options.scope ?? app.state.view)], store = app.state.replica.store
  try {
    if (!inTauri()) throw new Error('Agents launch from the desktop app.')
    const cwd = options.cwd ?? localRepository(app.state.replica, scope) ?? ''
    let mcp: Awaited<ReturnType<typeof startPeerMcp>> | undefined
    const request: Record<string, unknown> = { provider, cwd, prompt: options.prompt ?? agentPrompt(app, scope), ...(options.chrome ? { chrome: true } : {}) }
    if (options.verify) Object.assign(request, { verify: true, context: agentContext(app.state.replica, scope) })
    else { mcp = await startPeerMcp(app, agentPeerId(provider), scope, name, options.branch); request.mcp = { url: mcp.url, token: mcp.token } }
    let id: string | null | undefined
    try { id = await tauriInvoke<string>('agent_start', { request }) } catch (error) { await mcp?.stop(); throw error }
    if (!id) { await mcp?.stop(); throw new Error('Desktop app required.') }
    const launch: Launch = { id, provider, scope, stopMcp: mcp?.stop }
    launches.set(app, [...(launches.get(app) ?? []), launch])
    app.notify('info', `${name} opened in a new terminal. Approve its tools there; close the terminal to end the session.`)
    app.refresh()
    void watch(app, launch, store, app.state.session)
  } catch (error) { if (options.throwErrors) throw error; app.notify('error', String(error instanceof Error ? error.message : error)) }
}
async function watch(app: App, launch: Launch, store: Replica['store'], session: App['state']['session']) {
  try {
    for (;;) {
      if (app.state.replica.store !== store || app.state.session !== session) { await stopAgent(app, launch); break }
      const poll = await tauriInvoke<{ finished: boolean; events: Array<{ type: string; message?: string }> }>('agent_poll', { id: launch.id })
      for (const event of poll?.events ?? []) if (event.type === 'error' && event.message) app.notify('error', `${AGENT_CLI_NAME[launch.provider]}: ${event.message}`)
      if (!poll || poll.finished) break
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  } catch { /* the run is gone */ }
  await launch.stopMcp?.().catch(() => {})
  launches.set(app, (launches.get(app) ?? []).filter(l => l !== launch))
  app.refresh()
}

/** The Claude Code VS Code tab, prefilled (not sent) with the node's text and an outline of its rows. */
export async function openInVsCode(app: App, scope: Scope = app.state.view): Promise<void> {
  const prompt = agentPrompt(app, scope, { outline: true, max: 5_000 })
  try { await tauriInvoke('open_agent_link', { url: `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(prompt)}` }); app.notify('info', 'Opened a Claude Code tab in VS Code with this task; review the prompt and send it there.') }
  catch (error) { app.notify('error', String(error)) }
}

/** A new Claude Desktop chat, prefilled (not sent) with the node's text and an outline of its rows. */
export async function openInClaudeDesktop(app: App, scope: Scope = app.state.view): Promise<void> {
  const prompt = agentPrompt(app, scope, { outline: true, max: 12_000 })
  try { await tauriInvoke('open_agent_link', { url: `claude://claude.ai/new?q=${encodeURIComponent(prompt)}` }); app.notify('info', 'Opened a Claude Desktop chat with this task; review the prompt and send it there.') }
  catch (error) {
    try { await navigator.clipboard.writeText(prompt); app.notify('error', `Claude Desktop did not open (${String(error)}). The prompt is on the clipboard.`) }
    catch { app.notify('error', `Claude Desktop did not open: ${String(error)}`) }
  }
}

type DesktopConfig = { path: string; name: string; entry: unknown; kept: string[]; written: boolean }
/** The Claude Desktop config entry name for a node. */
const desktopServerName = (scope: Scope) => `fos-${(scope.at(-1) ?? 'home').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'node'}`
/**
 * Register this node's hosted MCP endpoint in Claude Desktop, only on the user's explicit confirmation: create a
 * credential for the Claude Desktop peer with its grants here, show exactly what will be written (the file, the entry,
 * the servers kept), and write it on confirm. Cancelling revokes the credential again.
 */
export async function connectClaudeDesktop(app: App): Promise<void> {
  const scope = [...app.state.view], name = desktopServerName(scope)
  try {
    const capabilities = app.peerCapabilities(CLAUDE_DESKTOP_PEER, scope).filter((c): c is 'read' | 'edit' | 'execute' => ['read', 'edit', 'execute'].includes(c))
    if (!capabilities.length) throw new Error('Turn on read, write or execute for Claude Desktop here first.')
    const connection = await connectNodeAgent(app, 'server', 'Claude Desktop', { peerId: CLAUDE_DESKTOP_PEER, capabilities })
    let preview: DesktopConfig | null
    try { preview = await tauriInvoke<DesktopConfig>('claude_desktop_mcp', { name, url: connection.url, token: connection.token, write: false }) } catch (error) { await connection.stop().catch(() => {}); throw error }
    if (!preview) { await connection.stop().catch(() => {}); throw new Error('Desktop app required.') }
    const dialog = document.createElement('dialog'); dialog.className = 'constructor-dialog'
    const heading = document.createElement('h3'); heading.textContent = 'Connect to Claude Desktop'
    const info = document.createElement('p'); info.textContent = `This adds the MCP server "${name}" to ${preview.path} (the previous file is kept as .bak)${preview.kept.length ? `, keeping ${preview.kept.join(', ')}` : ''}. Claude Desktop starts it with npx mcp-remote, so Node.js must be installed. Restart Claude Desktop afterwards.`
    const entry = document.createElement('textarea'); entry.readOnly = true; entry.rows = 10; entry.className = 'mcp-config'; entry.value = JSON.stringify({ mcpServers: { [name]: preview.entry } }, null, 2); entry.setAttribute('aria-label', 'Claude Desktop configuration')
    const write = document.createElement('button'); write.textContent = 'Write configuration'
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel'
    let written = false
    write.onclick = async () => {
      write.disabled = true
      try { await tauriInvoke('claude_desktop_mcp', { name, url: connection.url, token: connection.token, write: true }); written = true; dialog.close(); app.notify('info', `Claude Desktop now has "${name}". Restart Claude Desktop to load it.`) }
      catch (error) { info.textContent = String(error); write.disabled = false }
    }
    cancel.onclick = () => dialog.close()
    dialog.addEventListener('close', () => { if (!written) void connection.stop().catch(() => {}); dialog.remove() })
    dialog.append(heading, info, entry, write, cancel); document.body.append(dialog); dialog.showModal()
  } catch (error) { app.notify('error', String(error instanceof Error ? error.message : error)) }
}
/** Remove this node's entry from Claude Desktop's config and revoke the credential it carried. */
export async function disconnectClaudeDesktop(app: App): Promise<void> {
  try {
    await tauriInvoke('claude_desktop_mcp', { name: desktopServerName(app.state.view), write: true })
    if (app.state.session?.kind === 'user') await detachSelf(app.state.session, CLAUDE_DESKTOP_PEER).catch(() => {})
    app.notify('info', 'Removed from Claude Desktop. Restart it to drop the server.')
  } catch (error) { app.notify('error', String(error)) }
}
