import { connectEvaluationAgent } from './node-agent'
import { iconSvg } from './icons'
/** Native SDK adapters use ordinary repository arguments and a scoped graph projection. */
import { argumentRefs, capabilityTarget, content, headCid, refValueCid, resolveScope, view, type Replica, type Scope } from '../../shared/sync/index'
import { inTauri, tauriInvoke } from './project'
import type { App } from './app'

export function localRepository(r: Replica, path: Scope): string | null {
  for (let depth = path.length; depth >= 0; depth--) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, depth))
    if (!cid) continue
    const args = argumentRefs(r.store, cid).filter(a => a.name === 'local-repository' && a.type === capabilityTarget(r.store, 'repo'))
    if (!args.length) continue
    if (args.length !== 1) return null
    const value = refValueCid(r.store, content(r.store, args[0]!.cid))
    try {
      const binding = JSON.parse(value ? content(r.store, value).data.description?.content ?? '' : '')
      return binding.device === r.meta.peerId && typeof binding.path === 'string' ? binding.path : null
    } catch { return null }
  }
  return null
}
export function agentContext(r: Replica, at: Scope) {
  const nodes: Array<{ path: Scope; text: string; kind: string; done: boolean | null }> = []
  function walk(path: Scope, relative: Scope, kind: string) {
    if (relative.length > 64 || nodes.length >= 5000) throw new Error('Task subtree is too large; launch from a smaller task.')
    const node = view(r, path)
    if (!node) throw new Error('Task is no longer available.')
    nodes.push({ path: relative, text: node.name ?? '', kind, done: node.done })
    for (const row of node.tasks) {
      // Linked values can point outside this subtree; do not disclose their targets.
      if (row.kind === 'ref' || row.kind === 'supply' || row.construction) continue
      walk([...path, row.id], [...relative, row.id], row.kind)
    }
  }
  walk(at, [], 'task')
  return { revision: headCid(r), nodes }
}
type Event = { type: string; message?: string; text?: string; id?: string; tool?: string; input?: unknown; codex?: boolean; claude?: boolean; diagnostics?: Partial<Record<'codex' | 'claude', string>> }
type Poll = { finished: boolean; events: Event[] }
const availability = new WeakMap<App, { codex?: boolean; claude?: boolean; diagnostics?: Partial<Record<'codex' | 'claude', string>>; error?: string; loading?: boolean }>()
async function probe(app: App) {
  const state = { loading: true } as NonNullable<ReturnType<typeof availability.get>>; availability.set(app, state)
  try {
    const id = await tauriInvoke<string>('agent_start', { request: { probe: true } })
    for (let i = 0; i < 40; i++) {
      const result = await tauriInvoke<Poll>('agent_poll', { id })
      const event = result?.events.find(e => e.type === 'availability')
      if (event) { state.codex = event.codex; state.claude = event.claude; state.diagnostics = event.diagnostics; break }
      if (result?.finished) throw new Error(result.events.find(e => e.type === 'error')?.message || 'SDK runtime unavailable')
      await new Promise(resolve => setTimeout(resolve, 250))
      if (i === 39) { await tauriInvoke('agent_control', { id, message: { cancel: true } }); throw new Error('SDK check timed out') }
    }
  } catch (e) { state.error = String(e) }
  state.loading = false; app.refresh()
}
export function desktopAgentControls(app: App): HTMLElement | null {
  const cwd = localRepository(app.state.replica, app.state.view)
  if (!cwd || !inTauri()) return null
  const el = document.createElement('div'); el.dataset.capability = 'repo'
  const label = document.createElement('small'); label.textContent = `Local Git · ${cwd}`; el.append(label)
  const state = availability.get(app)
  if (!state) { void probe(app); return el }
  for (const provider of ['claude', 'codex'] as const) if (state[provider]) {
    const b = document.createElement('button'); b.textContent = `Run ${provider === 'claude' ? 'Claude' : 'Codex'}…`; b.onclick = () => openRun(app, provider, cwd); el.append(b)
  }
  for (const provider of ['claude', 'codex'] as const) if (!state[provider] && state.diagnostics?.[provider]) { const info = document.createElement('p'); info.textContent = `${provider === 'claude' ? 'Claude' : 'Codex'}: ${state.diagnostics[provider]}`; el.append(info) }
  const check = document.createElement('button'); check.textContent = state.loading ? 'Checking SDKs…' : 'Check agent integrations'; check.disabled = !!state.loading; check.onclick = () => void probe(app); el.append(check)
  if (state.error || (!state.loading && !state.claude && !state.codex && !state.diagnostics)) { const info = document.createElement('p'); info.textContent = state.error ?? 'Configure Codex native sign-in or Claude API credentials in the desktop environment, then check again.'; el.append(info) }
  return el
}
function openRun(app: App, provider: 'claude' | 'codex', cwd: string, evaluation = false) {
  const replica = app.state.replica, store = replica.store, path = [...app.state.view]
  let context: ReturnType<typeof agentContext>
  try { context = evaluation ? { revision: headCid(replica), nodes: [{ path: [], text: app.currentRow()?.title ?? '', kind: 'task', done: false }] } : agentContext(replica, path) } catch (e) { app.notify('error', String(e)); return }
  const dialog = document.createElement('dialog'); dialog.className = 'import-dialog'
  const heading = document.createElement('h3'); heading.textContent = evaluation ? `Delegate to ${provider}` : `Run ${provider} in ${cwd}`
  const note = document.createElement('p'); note.textContent = evaluation ? 'The agent can interact with this evaluation through its declared inputs. Close or cancel to end the connection.' : 'Uses the current filesystem checkout and a read-only snapshot of this task subtree. Review code changes in Git. This does not switch Git branches.'
  const prompt = document.createElement('textarea'); prompt.rows = 5; prompt.value = context.nodes[0]?.text || ''; prompt.setAttribute('aria-label', 'Agent task')
  const output = document.createElement('pre'); output.style.cssText = 'white-space:pre-wrap;max-height:40vh;overflow:auto'
  const permissions = document.createElement('div'), start = document.createElement('button'), close = document.createElement('button')
  start.textContent = 'Start'; close.textContent = 'Close'
  let id: string | null = null, running = false
  const control = (message: unknown) => tauriInvoke('agent_control', { id, message })
  close.onclick = () => { if (running) { void control({ cancel: true }); close.disabled = true } else dialog.close() }
  dialog.addEventListener('cancel', e => { if (running) { e.preventDefault(); void control({ cancel: true }) } })
  dialog.addEventListener('close', () => dialog.remove())
  start.onclick = async () => {
    if (!prompt.value.trim()) return
    if (app.state.replica.store !== store) { output.textContent = 'Data session changed. Reopen the launcher.'; return }
    running = true; start.disabled = true; prompt.readOnly = true; close.textContent = 'Cancel run'
    let endpoint: Awaited<ReturnType<typeof connectEvaluationAgent>> | undefined
    try {
      if (evaluation) endpoint = await connectEvaluationAgent(app)
      id = await tauriInvoke<string>('agent_start', { request: { provider, cwd, prompt: prompt.value, context, ...(endpoint ? { evaluation: { url: endpoint.url, token: endpoint.token } } : {}) } })
      while (id) {
        if (app.state.replica.store !== store || evaluation && JSON.stringify(app.executionPath()) !== JSON.stringify(path)) { await control({ cancel: true }); throw new Error('Run cancelled because the data session changed.') }
        const poll = await tauriInvoke<Poll>('agent_poll', { id })
        for (const event of poll?.events ?? []) {
          if (event.type === 'permission') {
            const row = document.createElement('div'), details = document.createElement('pre'); details.style.whiteSpace = 'pre-wrap'; details.textContent = `${event.tool}\n${JSON.stringify(event.input, null, 2)}`; row.append(details)
            for (const allow of [true, false]) { const b = document.createElement('button'); b.textContent = allow ? 'Allow' : 'Deny'; b.onclick = () => { void control({ permission: event.id, allow }); row.remove() }; row.append(b) }
            permissions.append(row)
          } else { output.textContent = ((output.textContent ?? '') + (event.text ?? event.message ?? event.type) + '\n').slice(-100_000); output.scrollTop = output.scrollHeight }
        }
        if (poll?.finished) break
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (e) { output.textContent += `\n${String(e)}` }
    finally { await endpoint?.stop().catch(() => {}); running = false; close.disabled = false; close.textContent = 'Close'; permissions.replaceChildren() }
  }
  dialog.append(heading, note, prompt, start, close, permissions, output); document.body.append(dialog); dialog.showModal()
  if (evaluation) start.click()
}

export function evaluationAgentControl(app: App): HTMLButtonElement | null {
  if (!inTauri() || !app.canApprove()) return null
  const state = availability.get(app)
  if (!state) { void probe(app); return null }
  const provider = state.codex ? 'codex' : state.claude ? 'claude' : null
  if (!provider) return null
  const button = document.createElement('button'); button.type = 'button'; button.className = 'icon execution-delegate'; button.title = 'Delegate to agent'; button.setAttribute('aria-label', button.title); button.innerHTML = iconSvg('agent')!
  button.disabled = app.evaluating || app.evaluationStatus()?.status === 'committed'
  button.onclick = () => openRun(app, provider, localRepository(app.state.replica, app.state.view) ?? '', true)
  return button
}
