import type { App } from './app'
import { contextMembers, handleMcp, isDirty, nodeBranches, type FosEvent } from '../../shared/sync/index'
import { createInvite, claimInvite, answerInviteRequest, pollConnect, detachSelf } from './api'
import { inTauri, tauriInvoke } from './project'

type Connection = { transport: 'desktop' | 'server'; peer: string; scope: string[]; url: string; token: string; stop(): Promise<void> }
const connections = new WeakMap<App, Connection[]>()

export async function connectNodeAgent(app: App, transport: 'desktop' | 'server', name: string): Promise<Connection> {
  const scope = [...app.state.view], session = app.state.session, store = app.state.replica.store
  const current = () => app.state.session === session && app.state.replica.store === store
  const selected = () => current() && JSON.stringify(scope) === JSON.stringify(app.state.view)
  if (!app.canApprove()) throw new Error('Only the node owner can connect an agent.')
  const peer = `agent:${crypto.randomUUID()}`, branches = nodeBranches(app.state.replica, scope)
  let connection: Connection
  if (transport === 'desktop') {
    const endpoint = await tauriInvoke<{ id: string; url: string; token: string }>('node_agent_start')
    if (!endpoint) throw new Error('Desktop app required.')
    const stopNative = async () => { await tauriInvoke('node_agent_stop', { id: endpoint.id }) }
    if (!selected()) { await stopNative(); throw new Error('Selected node changed.') }
    try { app.attachAgentPeer(scope, peer, name) } catch (error) { await stopNative(); throw error }
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
    connection = { transport, peer, scope, url: endpoint.url, token: endpoint.token, async stop() {
      if (stopped) return
      stopped = true; clearTimeout(timer)
      try { await stopNative() } finally { connection.token = ''; if (current()) app.removeAgentPeer(scope, peer) }
    } }
    const poll = async () => {
      if (stopped) return
      if (!current() || !contextMembers(app.state.replica, scope).some(member => member.peerId === peer)) { await connection.stop().catch(() => {}); return }
      try {
        const requests = await tauriInvoke<Array<{ id: string; message: unknown }>>('node_agent_poll', { id: endpoint.id })
        for (const request of requests ?? []) {
          // The loopback is one adapter of the event grammar: the agent is an invited peer at this node.
          const response = await handleMcp(request.message, { owner: false, serverName: 'fos-node', dispatch: async event => {
            if (stopped || !current()) throw new Error('Agent connection ended.')
            const scoped: FosEvent = event.kind !== 'decide' && event.kind !== 'invite' && branches.length && !event.branches?.length ? { ...event, branches: branches.map(b => ({ path: b.scope.slice(scope.length), name: b.name })) } as FosEvent : event
            return app.dispatchLocalEvent({ peerId: peer, owner: false, scope, name }, scoped)
          } })
          await tauriInvoke('node_agent_reply', { id: endpoint.id, requestId: request.id, response })
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
    await answerInviteRequest(session, invite.inviteId, 'approve', ['edit'])
    try {
      const credential = await pollConnect(session.baseUrl, claim.requestId, peer)
      if (credential.status !== 'approved' || !credential.jwt || !selected()) throw new Error('Agent credential unavailable or account changed.')
      app.attachAgentPeer(scope, peer, name)
      connection = { transport, peer, scope, url: `${session.baseUrl.replace(/\/$/, '')}/user/data/peer-sync/mcp`, token: credential.jwt, async stop() {
        await detachSelf(session, peer)
        connection.token = ''
        if (current()) { app.removeAgentPeer(scope, peer); await app.syncNow('agent disconnected') }
      } }
      await app.syncNow('agent connected')
    } catch (error) { await detachSelf(session, peer); throw error }
  }
  connections.set(app, [...(connections.get(app) ?? []), connection])
  return connection
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

/** A short-lived, evaluation-only endpoint; no graph editing tools. */
export async function connectEvaluationAgent(app: App) {
  const path = JSON.stringify(app.executionPath()), store = app.state.replica.store, session = app.state.session
  if (!app.executionPath() || !app.canApprove()) throw new Error('Open an owned evaluation first.')
  const endpoint = await tauriInvoke<{ id: string; url: string; token: string }>('node_agent_start')
  if (!endpoint) throw new Error('Desktop app required.')
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  const current = () => app.state.replica.store === store && app.state.session === session && JSON.stringify(app.executionPath()) === path
  const stop = async () => { if (stopped) return; stopped = true; clearTimeout(timer); await tauriInvoke('node_agent_stop', { id: endpoint.id }) }
  const poll = async () => {
    if (stopped) return
    if (!current()) { await stop().catch(() => {}); return }
    try {
      for (const request of await tauriInvoke<Array<{ id: string; message: unknown }>>('node_agent_poll', { id: endpoint.id }) ?? []) {
        // Evaluation-only loopback: the same tools, as the owner, scoped to the running execution.
        const response = await handleMcp(request.message, { owner: true, serverName: 'fos-evaluation', dispatch: async event => {
          if (stopped || !current()) throw new Error('Evaluation connection ended.')
          if (!['read', 'input', 'complete'].includes(event.kind)) throw new Error('Only reading, inputs and completion are available on an evaluation endpoint.')
          return app.dispatchLocalEvent({ peerId: app.state.replica.meta.peerId, owner: true, scope: app.executionPath()! }, event)
        } })
        await tauriInvoke('node_agent_reply', { id: endpoint.id, requestId: request.id, response })
      }
      if (!stopped) timer = setTimeout(() => void poll(), 200)
    } catch { await stop().catch(() => {}) }
  }
  void poll()
  window.addEventListener('pagehide', () => void stop().catch(() => {}), { once: true })
  return { ...endpoint, stop }
}
