import { iconSvg } from './icons'
import type { App } from './app'
import { configureSharing, sharedRequest, type ShareAddress } from './api'
import { sharing, readNodeValue, participants, resolveScope, headCid, valueContent, put, isDirty, scopeBranches, resolveRef, type Poll, type SharedNode } from '../../shared/sync/index'

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); el.textContent = text; return el
}
function button(text: string, run: () => void): HTMLButtonElement {
  const el = element('button', text); el.type = 'button'; el.onclick = run; return el
}
function label(text: string, input: HTMLElement): HTMLLabelElement {
  const el = element('label', text); el.append(input); return el
}
export function shareUrl(address: ShareAddress): string {
  const url = new URL(location.href)
  url.search = ''; url.hash = `share=${encodeURIComponent(JSON.stringify(address))}`
  return url.href
}
export function sharedAddress(hash: string): ShareAddress | null {
  if (!hash.startsWith('#share=') || hash.length > 24000) return null
  try {
    const at = JSON.parse(decodeURIComponent(hash.slice(7))) as ShareAddress
    return typeof at.owner === 'string' && !!at.owner && at.owner.length <= 128 && typeof at.share === 'string' && /^[\w-]{16,128}$/.test(at.share) && Array.isArray(at.path) && at.path.length <= 32 && at.path.every(id => typeof id === 'string' && !!id && id.length <= 256) ? { owner: at.owner, path: at.path, share: at.share } : null
  } catch { return null }
}

/** Publishing configuration opened by the audience's Add peer constructor. */
export function sharingControls(app: App, audience: 'public' | 'users', templateTrigger = false): HTMLElement {
  const box = element('div'); box.className = 'sharing-controls'
  const state = app.state, policy = sharing(state.replica, state.view), poll = readNodeValue<Poll>(state.replica, state.view, 'fos:poll')
  const mode = element('select'); mode.append(new Option('No poll', ''), new Option('Approval poll', 'approval'), new Option('Ranking poll', 'rank')); mode.value = poll?.mode ?? ''
  mode.disabled = app.currentRow()?.requirement?.capability !== 'choice' || !app.capabilityAvailable('poll')
  box.append(label('Choice handler ', mode))
  if (mode.disabled) box.append(element('p', 'To create a poll, use a choice requirement, for example: -choice: Monday | Tuesday'))
  if (templateTrigger) box.append(element('p', 'Each visitor gets a private execution of this template. Returning visitors resume their execution.'))
  const endpoint = element('textarea'); endpoint.readOnly = true; endpoint.setAttribute('aria-label', 'Trigger endpoint'); endpoint.hidden = !templateTrigger
  if (templateTrigger) box.append(endpoint)
  const status = element('p'); status.setAttribute('role', 'status')
  const output = element('input'); output.readOnly = true; output.setAttribute('aria-label', 'Shareable URL')
  if (policy?.enabled && state.session?.kind === 'user') output.value = shareUrl({ owner: state.session.username, path: app.currentScope(), share: policy.id })
  const copy = button('Copy link', () => { output.select(); void navigator.clipboard.writeText(output.value).catch(() => { status.textContent = 'Select and copy the URL above.' }) }); copy.disabled = !output.value
  const path = [...state.view], scope = app.currentScope(), session = state.session
  const save = async (enabled: boolean) => {
    publish.disabled = revoke.disabled = true
    try {
      if (!session || session.kind !== 'user' || !app.isOnline('fos')) throw new Error('Connect your account to share this node.')
      if (Object.keys(scopeBranches(state.replica.store, headCid(state.replica), path)).length || state.replica.meta.branch) throw new Error('Sharing nodes inside branch choices is not supported yet.')
      document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
      await app.syncNow('before sharing')
      if (app.state.session !== session || JSON.stringify(app.state.view) !== JSON.stringify(path) || JSON.stringify(app.currentScope()) !== JSON.stringify(scope)) throw new Error('The account or selected node changed. Try again.')
      const r = app.state.replica, cid = resolveScope(r.store, headCid(r), path)
      if (!cid || isDirty(r) || !app.isOnline('fos')) throw new Error('Finish syncing this node before sharing it.')
      const address = await configureSharing(session, { path: app.currentScope(), expected: put(r.store, valueContent(r.store, cid)), audience, enabled, template: templateTrigger, poll: (mode.value || null) as Poll['mode'] | null })
      if (templateTrigger) endpoint.value = enabled ? JSON.stringify({ method: 'POST', url: `${session.baseUrl.replace(/\/$/, '')}/${audience === 'public' ? 'public/node' : 'user/data/sharing'}/visit`, body: { owner: address.owner, path: address.path, share: address.share } }, null, 2) : ''
      output.value = enabled ? shareUrl(address) : ''; copy.disabled = !enabled
      status.textContent = enabled ? 'Link ready. Visitors can submit input; “Apply poll result” on the choice resolves it from their responses.' : 'Link revoked.'
      await app.syncNow('sharing changed')
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error) }
    finally { publish.disabled = revoke.disabled = false }
  }
  const publish = button(policy?.enabled ? 'Update publication' : 'Publish node', () => void save(true))
  const revoke = button('Revoke link', () => void save(false)); revoke.disabled = !policy?.enabled
  publish.disabled = state.session?.kind !== 'user' || !app.isOnline('fos')
  box.append(publish, revoke, output, copy, status)
  const records = participants(state.replica, state.view)
  if (records.length) {
    const results = element('details'); results.append(element('summary', `Guest input (${records.length})`))
    for (const record of records) {
      const row = element('div'); row.append(element('strong', record.name || record.account?.owner || 'Anonymous guest'))
      const named = (id: string) => record.labels?.[id] ?? 'Earlier option'
      if (record.approvals.length) row.append(element('p', `Approves: ${record.approvals.map(named).join('; ')}`))
      if (record.ranking.length) row.append(element('p', `Preference: ${record.ranking.map(named).join(' → ')}`))
      for (const [key, value] of Object.entries(record.fields)) row.append(element('p', `${record.labels?.[key] ?? 'Input'}: ${typeof value === 'object' ? `${value.amount} ${value.unit}` : String(value)}`))
      row.append(element('small', `Saved ${new Date(record.updated).toLocaleString()}`)); results.append(row)
    }
    box.append(results)
  }
  return box
}

/** Shared links live under their host peer in Home; this renders that ref's remote input handler. */
export function mountSharedNode(root: HTMLElement, app: App, baseUrl: string): void {
  let generation = 0, lastIdentity = '', address: ShareAddress | null = null, token: string | undefined, node: SharedNode | null = null
  const panel = element('section'); panel.className = 'shared-node'; panel.hidden = true
  root.querySelector('[data-region="node"]')!.after(panel)
  let linkedPath: string[] | null = null
  const tokenKey = () => `fos:guest:${baseUrl}:${JSON.stringify(address)}`
  const currentSession = () => app.state.session?.kind === 'user' ? app.state.session : null
  const request = async (action: 'visit' | 'input', body: object = {}) => {
    const id = generation, session = currentSession()
    const result = await sharedRequest(baseUrl, session, action, { ...address, ...body, ...(!session && token ? { visitorToken: token } : {}) })
    if (id !== generation) return
    if (result.entryToken) { try { localStorage.setItem(tokenKey(), result.entryToken) } catch {} }
    if (result.address) {
      address = result.address
      window.history.replaceState(null, '', shareUrl(address))
      lastIdentity = `${JSON.stringify(address)}:${currentSession()?.username ?? 'anonymous'}`
    }
    if (result.visitorToken) { token = result.visitorToken; try { localStorage.setItem(tokenKey(), token) } catch { /* private browsing */ } }
    node = result.node
    if (!linkedPath && session) { await app.syncNow('received shared link'); if (id !== generation) return }
    if (!linkedPath) {
      linkedPath = app.receiveSharedLink(address!, node.title)
      app.goTo(linkedPath)
    }
    panel.hidden = JSON.stringify(app.state.view) !== JSON.stringify(linkedPath)
    render()
  }
  const showError = (error: unknown) => {
    const status = panel.querySelector('[role="status"]') ?? panel.appendChild(element('p'))
    status.setAttribute('role', 'status'); status.textContent = error instanceof Error ? error.message : String(error)
  }
  const load = async () => { const id = generation; try { await request('visit') } catch (error) { if (id === generation) showError(error) } }
  const render = () => {
    root.classList.toggle('shared-execution', !!node?.execution && !panel.hidden)
    panel.replaceChildren(element('h2', node?.title ?? 'Shared node'))
    if (node?.execution && document.documentElement.requestFullscreen) {
      const fullscreen = element('button', ''); fullscreen.className = 'icon shared-fullscreen'; fullscreen.type = 'button'
      const update = () => { fullscreen.innerHTML = iconSvg(document.fullscreenElement ? 'exit-fullscreen' : 'fullscreen')!; fullscreen.title = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; fullscreen.setAttribute('aria-label', fullscreen.title) }
      update(); fullscreen.onclick = () => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).then(update).catch(() => {}) }; panel.append(fullscreen)
    }
    panel.append(element('p', `Shared by ${address?.owner} · linked in your Home context.`))
    panel.append(button('Refresh shared node', () => void load()))
    if (!node?.execution) panel.append(button('Back to host peer', () => { if (linkedPath) app.goTo(linkedPath.slice(0, -1)); location.hash = '' }))
    if (!currentSession()) panel.append(button('Sign in with my context', () => app.openModal('connect')))
    const status = element('p'); status.setAttribute('role', 'status'); panel.append(status)
    if (!node) return
    if (node.execution?.error) panel.append(element('p', node.execution.error))
    else if (node.execution?.status === 'committed') panel.append(element('p', 'Complete'))
    const snapshot = node, revision = node.revision, form = element('form')
    for (const row of node.rows) { const el = element('p', row.title); el.style.paddingInlineStart = `${Math.min(row.depth, 8)}em`; panel.append(el) }
    const name = element('input'); name.maxLength = 80; name.setAttribute('autocomplete', 'nickname'); name.value = node.mine?.name ?? ''; name.required = !currentSession() && !!node.poll
    if (!currentSession()) form.append(label(node.poll ? 'Your display name (visible to the host) ' : 'Display name (optional) ', name))
    const approved = new Set(node.mine?.revision === revision ? node.mine.approvals : [])
    const choices = [...(node.poll?.mode === 'approval' ? node.options : []), ...node.proposals]
    for (const option of choices) {
      const check = element('input'); check.type = 'checkbox'; check.checked = approved.has(option.id); check.disabled = !node.capabilities?.includes('edit')
      check.onchange = () => { if (check.checked) approved.add(option.id); else approved.delete(option.id) }
      form.append(label(`${option.label} · ${node.counts[option.id] ?? 0} approval${node.counts[option.id] === 1 ? '' : 's'} `, check))
    }
    const rankOptions = node.poll?.mode === 'rank' ? node.options : node.proposals
    let ranking = node.mine?.revision === revision && node.mine.ranking.length ? [...node.mine.ranking] : rankOptions.map(o => o.id)
    if (rankOptions.length && node.capabilities?.includes('rank')) {
      const ranks = element('fieldset'); ranks.append(element('legend', 'Rank · first is preferred'))
      const list = element('div'); ranks.append(list)
      const draw = () => {
        list.replaceChildren()
        ranking.forEach((id, i) => {
          const row = element('div', `${i + 1}. ${rankOptions.find(o => o.id === id)?.label ?? id} · ${snapshot.rankings[id] ?? 0} points `)
          const move = (d: number) => { [ranking[i], ranking[i + d]] = [ranking[i + d]!, ranking[i]!]; draw() }
          const up = button('↑', () => move(-1)); up.setAttribute('aria-label', `Rank ${i + 1} higher`); up.disabled = i === 0
          const down = button('↓', () => move(1)); down.setAttribute('aria-label', `Rank ${i + 1} lower`); down.disabled = i === ranking.length - 1
          row.append(up, down); list.append(row)
        })
      }; draw(); form.append(ranks)
    } else ranking = []
    const fields: Record<string, { value?: unknown; source?: string }> = Object.create(null)
    const ownSources = node.sources ?? (linkedPath ? readNodeValue<Record<string, string>>(app.state.replica, linkedPath, 'fos:input-links') : null) ?? {}
    for (const field of node.inputs) {
      const box = element('fieldset'); box.append(element('legend', field.direction === 'consume' ? `Use ${field.name}` : field.name))
      if (field.kind === 'confirmation' || field.kind === 'choice') {
        if (field.kind === 'confirmation') {
          const input = element('input'); input.type = 'checkbox'; input.onchange = () => { if (input.checked) fields[field.key] = { value: true }; else delete fields[field.key] }; box.append(label('Confirm ', input))
        } else {
          const input = element('select'); input.append(new Option('Choose an option', '')); for (const [i, option] of (field.options ?? []).entries()) input.append(new Option(option, String(i)))
          input.onchange = () => { if (input.value) fields[field.key] = { value: Number(input.value) }; else delete fields[field.key] }; box.append(input)
        }
        form.append(box); continue
      }
      const input = element('input'); input.type = field.kind === 'text' ? 'text' : 'number'; if (field.kind !== 'text') { input.min = '0'; input.step = 'any'; if (field.direction === 'consume' && field.amount !== undefined) input.max = String(field.amount) }
      const previous = node.mine?.fields[field.key]
      input.value = typeof previous === 'string' ? previous : previous && typeof previous === 'object' ? String(previous.amount) : ''
      const update = () => { fields[field.key] = { value: field.kind === 'text' ? input.value : { amount: Number(input.value), type: field.type, unit: field.unit, start: field.start, end: field.end } } }
      if (previous !== undefined) update()
      if (Object.hasOwn(ownSources, field.key)) fields[field.key] = { source: ownSources[field.key] }
      input.oninput = update; box.append(label(field.kind === 'text' ? 'Text ' : `Amount (${field.unit}) `, input))
      {
        const search = element('input'); search.placeholder = 'Find a value in your context'; search.setAttribute('aria-label', `Find value for ${field.name}`)
        const matches = element('div'), linked = element('p', Object.hasOwn(ownSources, field.key) ? 'Linked to your context; saving refreshes the requested value.' : '')
        const choose = (id: string) => {
          const match = resolveRef(app.state.replica, id)
          if (!match || (field.kind === 'allocation' && (!match.row.allocation || match.row.allocation.type !== field.type || match.row.allocation.unit !== field.unit))) { linked.textContent = 'Choose a value of the required type.'; return }
          fields[field.key] = { source: id }; linked.textContent = `Linked: ${match.row.title}. Only the requested value will be shared.`
        }
        search.oninput = () => {
          matches.replaceChildren()
          for (const { row } of app.searchLocalNodes(search.value).filter(m => field.kind === 'text' || (m.row.allocation?.type === field.type && m.row.allocation?.unit === field.unit)).slice(0, 12)) matches.append(button(row.title, () => choose(row.id)))
        }
        box.ondragover = e => { e.preventDefault() }
        box.ondrop = e => { e.preventDefault(); const raw = e.dataTransfer?.getData('application/x-fos-node') || e.dataTransfer?.getData('text/plain'); if (raw) { try { const data = JSON.parse(raw); choose(data.id ?? data) } catch { choose(raw) } } }
        box.append(search, matches, linked)
      }
      form.append(box)
    }
    const submit = element('button', node.execution ? 'Complete' : 'Save input'); submit.type = 'submit'; submit.disabled = !!node.execution && !['idle', 'rolled-back'].includes(node.execution.status); form.append(submit)
    form.onsubmit = async e => {
      e.preventDefault(); submit.disabled = true
      const id = generation
      try {
        if (currentSession()) { await app.syncNow('before sharing input'); if (isDirty(app.state.replica)) throw new Error('Sync your linked values before submitting.') }
        if (id !== generation) return
        const submitted = { ...fields }, sources: Record<string, string> = Object.create(null)
        for (const [key, entry] of Object.entries(fields)) if (entry.source) {
          sources[key] = entry.source
          if (!currentSession()) {
            const field = snapshot.inputs.find(f => f.key === key)!, row = resolveRef(app.state.replica, entry.source)?.row
            if (!row) throw new Error('A linked value is no longer available in your context.')
            const allocation = row.allocation
            submitted[key] = { value: field.kind === 'text' ? row.title : allocation ? { amount: allocation.amount, type: allocation.type, unit: allocation.unit, start: allocation.start, end: allocation.end } : null }
          }
        }
        if (!currentSession() && linkedPath) app.rememberSharedSources(linkedPath, sources)
        await request('input', { revision, name: name.value, approvals: [...approved], ranking, fields: submitted })
        if (id === generation) { showError('Input saved.'); if (currentSession()) void app.syncNow('guest input saved') }
      } catch (error) { if (id === generation) showError(error) }
      finally { submit.disabled = false }
    }
    form.append(element('p', `${snapshot.participants} response${snapshot.participants === 1 ? '' : 's'}. Responses are tallied; the owner applies the result to the choice. Approvals on proposed edits inform the owner's decision.`)); panel.append(form)
  }
  const update = () => {
    if (app.state.connection === 'connecting' && !currentSession()) return
    const next = sharedAddress(location.hash), identity = `${JSON.stringify(next)}:${currentSession()?.username ?? 'anonymous'}`
    if (identity === lastIdentity) { if (linkedPath) panel.hidden = JSON.stringify(app.state.view) !== JSON.stringify(linkedPath); root.classList.toggle('shared-execution', !!node?.execution && !panel.hidden); return }
    lastIdentity = identity; generation++; address = next; node = null; linkedPath = null; token = undefined; panel.hidden = !next
    if (!next) { root.classList.remove('shared-execution'); return }
    try { token = localStorage.getItem(tokenKey()) ?? undefined } catch { /* private browsing */ }
    render(); void load()
  }
  window.addEventListener('hashchange', update); app.subscribe(update)
}
