import type { App } from './app'
import { contextMembers, handleMcp, waitMcp, isDirty, nodeBranches, type FosEvent } from '../../shared/sync/index'
import { createInvite, claimInvite, answerInviteRequest, pollConnect, detachSelf } from './api'
import { inTauri, tauriInvoke } from './project'

type Connection = { transport: 'desktop' | 'server'; peer: string; scope: string[]; url: string; token: string; stop(): Promise<void> }
const connections = new WeakMap<App, Connection[]>()

/**
 * The device's MCP server for the viewed node (`mcp:local`, a sub-peer of the device): a loopback endpoint that
 * serves the node through the event grammar as that peer, exposing exactly the tools its grants here allow. It runs
 * while any grant is on and stops when all are off (then it accepts no connections). Credentials never enter the graph.
 */
type LocalMcp = { scope: string[]; store: App['state']['replica']['store']; url: string; token: string; stop(): Promise<void> }
const localMcp = new WeakMap<App, LocalMcp>()
export function localMcpEndpoint(app: App, scope = app.state.view): { url: string; token: string } | null {
  const running = localMcp.get(app)
  return running && running.store === app.state.replica.store && JSON.stringify(running.scope) === JSON.stringify(scope) ? { url: running.url, token: running.token } : null
}
export async function ensureLocalMcp(app: App, scope: string[]): Promise<{ url: string; token: string } | null> {
  if (!inTauri()) return null
  const existing = localMcp.get(app)
  if (existing && existing.store === app.state.replica.store && JSON.stringify(existing.scope) === JSON.stringify(scope)) return { url: existing.url, token: existing.token }
  if (existing) await existing.stop().catch(() => {})
  const store = app.state.replica.store, branches = nodeBranches(app.state.replica, scope)
  const endpoint = await tauriInvoke<{ id: string; url: string; token: string }>('node_agent_start')
  if (!endpoint) return null
  const controller = new AbortController()
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  const running: LocalMcp = { scope, store, url: endpoint.url, token: endpoint.token, async stop() {
    if (stopped) return
    stopped = true; controller.abort(); clearTimeout(timer)
    if (localMcp.get(app) === running) localMcp.delete(app)
    running.token = ''
    await tauriInvoke('node_agent_stop', { id: endpoint.id })
    app.refresh()
  } }
  localMcp.set(app, running)
  const poll = async () => {
    if (stopped) return
    // the endpoint lives as long as this node is viewed in this data session and the peer keeps a grant here
    if (app.state.replica.store !== store || !app.peerGrants('mcp:local', scope).length) { await running.stop().catch(() => {}); return }
    try {
      const requests = await tauriInvoke<Array<{ id: string; message: unknown; sessionId?: string }>>('node_agent_poll', { id: endpoint.id })
      for (const request of requests ?? []) {
        void (async () => {
          const capabilities = app.peerCapabilities('mcp:local', scope)
          const response = await handleMcp(request.message, { owner: false, capabilities, wait: ms => waitMcp(ms, controller.signal), serverName: 'fos-node', toolListChanges: true, dispatch: async event => {
            if (stopped || app.state.replica.store !== store) throw new Error('MCP server stopped.')
            const scoped: FosEvent = event.kind !== 'decide' && event.kind !== 'invite' && branches.length && !event.branches?.length ? { ...event, branches: branches.map(b => ({ path: b.scope.slice(scope.length), name: b.name })) } as FosEvent : event
            return app.dispatchLocalEvent({ peerId: 'mcp:local', owner: false, scope, sessionId: `${endpoint.id}:${request.sessionId ?? 'default'}`, name: 'Local MCP server' }, scoped)
          } })
          await tauriInvoke('node_agent_reply', { id: endpoint.id, requestId: request.id, response })
        })().catch(() => running.stop().catch(() => {}))
      }
    } catch { await running.stop().catch(() => {}); return }
    if (!stopped) timer = setTimeout(() => void poll(), 300)
  }
  window.addEventListener('pagehide', () => { void running.stop().catch(() => {}) }, { once: true })
  void poll()
  app.refresh()
  return { url: endpoint.url, token: endpoint.token }
}
export async function stopLocalMcp(app: App): Promise<void> { await localMcp.get(app)?.stop().catch(() => {}) }

/** The MCP connection configuration an agent pastes (Claude Code, Codex, any MCP client). */
export function mcpConfig(url: string, token: string): string {
  return JSON.stringify({ mcpServers: { fos: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
}

export async function connectNodeAgent(app: App, transport: 'desktop' | 'server', name: string, options: { peerId?: string; capabilities?: Array<'read' | 'edit' | 'execute'> } = {}): Promise<Connection> {
  const scope = [...app.state.view], session = app.state.session, store = app.state.replica.store
  const current = () => app.state.session === session && app.state.replica.store === store
  const selected = () => current() && JSON.stringify(scope) === JSON.stringify(app.state.view)
  if (!app.canApprove()) throw new Error('Only the node owner can connect an agent.')
  const peer = options.peerId ?? `agent:${crypto.randomUUID()}`, branches = nodeBranches(app.state.replica, scope)
  let connection: Connection
  if (transport === 'desktop') {
    const endpoint = await tauriInvoke<{ id: string; url: string; token: string }>('node_agent_start')
    if (!endpoint) throw new Error('Desktop app required.')
    const stopNative = async () => { await tauriInvoke('node_agent_stop', { id: endpoint.id }) }
    if (!selected()) { await stopNative(); throw new Error('Selected node changed.') }
    try { if (!options.peerId) app.attachAgentPeer(scope, peer, name) } catch (error) { await stopNative(); throw error }
    const controller = new AbortController()
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
    connection = { transport, peer, scope, url: endpoint.url, token: endpoint.token, async stop() {
      if (stopped) return
      stopped = true; controller.abort(); clearTimeout(timer)
      try { await stopNative() } finally { connection.token = ''; if (current() && !options.peerId) app.removeAgentPeer(scope, peer) }
    } }
    const poll = async () => {
      if (stopped) return
      if (!current() || !contextMembers(app.state.replica, scope).some(member => member.peerId === peer)) { await connection.stop().catch(() => {}); return }
      try {
        const requests = await tauriInvoke<Array<{ id: string; message: unknown; sessionId?: string }>>('node_agent_poll', { id: endpoint.id })
        for (const request of requests ?? []) {
          void (async () => {
            // The loopback is one adapter of the event grammar: the agent is an invited peer at this node.
            const response = await handleMcp(request.message, { owner: false, capabilities: app.peerCapabilities(peer, scope), wait: ms => waitMcp(ms, controller.signal), serverName: 'fos-node', toolListChanges: true, dispatch: async event => {
              if (stopped || !current()) throw new Error('Agent connection ended.')
              const scoped: FosEvent = event.kind !== 'decide' && event.kind !== 'invite' && branches.length && !event.branches?.length ? { ...event, branches: branches.map(b => ({ path: b.scope.slice(scope.length), name: b.name })) } as FosEvent : event
              return app.dispatchLocalEvent({ peerId: peer, owner: false, scope, name, sessionId: `${endpoint.id}:${request.sessionId ?? 'default'}` }, scoped)
            } })
            await tauriInvoke('node_agent_reply', { id: endpoint.id, requestId: request.id, response })
          })().catch(() => connection.stop().catch(() => {}))
        }
      } catch { await connection.stop().catch(() => {}); return }
      if (!stopped) timer = setTimeout(() => void poll(), 300)
    }
    window.addEventListener('pagehide', () => { void connection.stop().catch(() => {}) }, { once: true })
    void poll()
  } else {
    if (session?.kind !== 'user' || !app.isOnline('fos')) throw new Error('Connect to Fos first.')
    if (branches.length) throw new Error('Connect hosted agents from the main branch. Desktop connections support the selected branch.')
    const serverScope = [...app.currentScope()]
    await app.syncNow('before connecting agent')
    if (!selected() || isDirty(app.state.replica) || !app.isOnline('fos')) throw new Error('Finish syncing this node before connecting an agent.')
    const invite = await createInvite(session, serverScope, app.labels().view)
    const claim = await claimInvite(session.baseUrl, invite.token, peer, name)
    if (!selected()) { await answerInviteRequest(session, invite.inviteId, 'deny'); throw new Error('Selected node changed.') }
    await answerInviteRequest(session, invite.inviteId, 'approve', options.capabilities ?? ['edit'])
    try {
      const credential = await pollConnect(session.baseUrl, claim.requestId, peer)
      if (credential.status !== 'approved' || !credential.jwt || !selected()) throw new Error('Agent credential unavailable or account changed.')
      if (!options.peerId) app.attachAgentPeer(scope, peer, name)
      connection = { transport, peer, scope, url: `${session.baseUrl.replace(/\/$/, '')}/user/data/peer-sync/mcp`, token: credential.jwt, async stop() {
        await detachSelf(session, peer)
        connection.token = ''
        if (current()) { if (!options.peerId) app.removeAgentPeer(scope, peer); await app.syncNow('agent disconnected') }
      } }
      await app.syncNow('agent connected')
    } catch (error) { await detachSelf(session, peer); throw error }
  }
  connections.set(app, [...(connections.get(app) ?? []), connection])
  return connection
}

/** The hosted MCP connections made from this app (the `mcp:server` sub-peer), by node. */
export function hostedMcpConnection(app: App, scope = app.state.view): Connection | null {
  return (connections.get(app) ?? []).find(c => c.transport === 'server' && c.peer === 'mcp:server' && c.token && JSON.stringify(c.scope) === JSON.stringify(scope)) ?? null
}
export function openNodeAgent(app: App, transport: 'desktop' | 'server'): void {
  const dialog = document.createElement('dialog'), form = document.createElement('form')
  dialog.className = 'constructor-dialog node-agent-dialog'
  const heading = document.createElement('h3'); heading.textContent = 'Connect to agent'
  const name = document.createElement('input'); name.value = 'Agent'; name.required = true; name.maxLength = 80; name.setAttribute('aria-label', 'Agent name')
  const available = transport === 'desktop' ? inTauri() : app.state.session?.kind === 'user' && app.isOnline('fos')
  const info = document.createElement('p'); info.textContent = 'The agent can read this node and visible descendants, and propose text changes for your approval. Copy the connection configuration into your agent.'
  const output = document.createElement('textarea'); output.readOnly = true; output.rows = 9; output.hidden = true; output.setAttribute('aria-label', 'MCP configuration')
  const status = document.createElement('p'); status.setAttribute('role', 'status')
  const start = document.createElement('button'); start.type = 'submit'; start.textContent = 'Create connection'; start.disabled = !available
  if (!available) status.textContent = transport === 'desktop' ? 'Requires the desktop app.' : 'Connect to Fos first.'
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.onclick = () => dialog.close()
  const scope = JSON.stringify(app.state.view), session = app.state.session, store = app.state.replica.store
  form.onsubmit = async event => {
    event.preventDefault(); start.disabled = true; status.textContent = 'Creating connection...'
    try {
      if (scope !== JSON.stringify(app.state.view) || session !== app.state.session || store !== app.state.replica.store) throw new Error('Selected node changed. Reopen Connect to agent.')
      const connection = await connectNodeAgent(app, transport, name.value.trim() || 'Agent')
      if (!dialog.isConnected || session !== app.state.session || scope !== JSON.stringify(app.state.view) || store !== app.state.replica.store) { await connection.stop().catch(() => {}); return }
      output.value = JSON.stringify({ mcpServers: { fos: { type: 'http', url: connection.url, headers: { Authorization: `Bearer ${connection.token}` } } } }, null, 2); output.hidden = false
      status.textContent = transport === 'desktop' ? 'Ready while this desktop window is open.' : 'Ready. This credential is scoped to this node.'
      name.disabled = true
      const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Disconnect agent'
      stop.onclick = async () => { try { await connection.stop(); output.value = ''; output.hidden = true; status.textContent = 'Disconnected'; stop.remove() } catch (error) { status.textContent = String(error) } }
      form.append(stop)
    } catch (error) { status.textContent = String(error); start.disabled = false }
  }
  for (const connection of connections.get(app) ?? []) if (connection.transport === transport && JSON.stringify(connection.scope) === scope && contextMembers(app.state.replica, connection.scope).some(member => member.peerId === connection.peer)) {
    const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Disconnect existing agent'
    stop.onclick = async () => { try { await connection.stop(); stop.remove(); status.textContent = 'Disconnected' } catch (error) { status.textContent = String(error) } }; form.append(stop)
  }
  form.prepend(heading, info, name, start, output, status, close)
  dialog.append(form); dialog.addEventListener('close', () => { output.value = ''; dialog.remove() }); document.body.append(dialog); dialog.showModal()
}

/**
 * A loopback MCP endpoint that acts as `peerId` at `scope` (a launched coding agent): every request is dispatched
 * with the peer's grants there as they are at that moment, so toggling Read / Write / Execute on the peer's panel
 * changes what the agent may do mid-session and switching all of them off ends it. It also ends when the data
 * session changes or `stop` is called. Credentials stay in memory.
 */
export async function startPeerMcp(app: App, peerId: string, scope: string[], name: string, branch?: string): Promise<{ url: string; token: string; stop(): Promise<void> }> {
  if (!inTauri()) throw new Error('Desktop app required.')
  const store = app.state.replica.store, session = app.state.session, branches = nodeBranches(app.state.replica, scope)
  if (!app.peerGrants(peerId, scope).length) throw new Error(`Turn on read, write or execute for ${name} here first.`)
  const endpoint = await tauriInvoke<{ id: string; url: string; token: string }>('node_agent_start')
  if (!endpoint) throw new Error('Desktop app required.')
  const controller = new AbortController()
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  const current = () => app.state.replica.store === store && app.state.session === session
  const stop = async () => { if (stopped) return; stopped = true; controller.abort(); clearTimeout(timer); await tauriInvoke('node_agent_stop', { id: endpoint.id }) }
  const poll = async () => {
    if (stopped) return
    if (!current() || !app.peerGrants(peerId, scope).length) { await stop().catch(() => {}); return }
    try {
      for (const request of await tauriInvoke<Array<{ id: string; message: unknown; sessionId?: string }>>('node_agent_poll', { id: endpoint.id }) ?? []) {
        void (async () => {
          const response = await handleMcp(request.message, { owner: false, capabilities: app.peerCapabilities(peerId, scope), wait: ms => waitMcp(ms, controller.signal), serverName: 'fos-node', toolListChanges: true, dispatch: async event => {
            if (stopped || !current()) throw new Error('Agent connection ended.')
            // Workflow endpoints are pinned to the requested project branch even when the desktop displays main.
            if (branch && 'branches' in event && event.branches?.some(b => b.path.length === 0 && b.name !== branch)) throw new Error('This agent is bound to another project branch.')
            const selected = branch ? [{ path: [], name: branch }] : branches.map(b => ({ path: b.scope.slice(scope.length), name: b.name }))
            const scoped: FosEvent = event.kind !== 'decide' && event.kind !== 'invite' && selected.length ? { ...event, branches: [...selected, ...(event.branches ?? []).filter(b => b.path.length > 0)] } as FosEvent : event
            return app.dispatchLocalEvent({ peerId, owner: false, scope, name, sessionId: `${endpoint.id}:${request.sessionId ?? 'default'}` }, scoped, branch)
          } })
          await tauriInvoke('node_agent_reply', { id: endpoint.id, requestId: request.id, response })
        })().catch(() => stop().catch(() => {}))
      }
    } catch { await stop().catch(() => {}); return }
    if (!stopped) timer = setTimeout(() => void poll(), 300)
  }
  window.addEventListener('pagehide', () => void stop().catch(() => {}), { once: true })
  void poll()
  return { url: endpoint.url, token: endpoint.token, stop }
}
