import { iconSvg } from './icons'
import { hydrateDiagrams, renderMarkdown } from './markdown'
import { parseShareAddress, renderSitePage, siteAnswers, SITE_CSS, type SiteAnswers } from './site'
import type { App } from './app'
import { configureSharing, sharedRequest, type ShareAddress } from './api'
import { sharing, readNodeValue, participants, resolveScope, headCid, valueContent, put, isDirty, scopeBranches, resolveRef, type Poll, type SharedInput, type SharedNode } from '../../shared/sync/index'

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
  return hash.startsWith('#share=') ? parseShareAddress(hash) : null
}
const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** The snippet that renders a public share link on another site (`embed.ts`, served next to the app as /embed.js). */
export function embedSnippet(link: string, api: string): string {
  return `<script src="${attribute(new URL('/embed.js', location.href).href)}" data-fos-share="${attribute(link)}" data-fos-api="${attribute(api.replace(/\/$/, ''))}" async></script>`
}
let siteStyle: HTMLStyleElement | null = null
function ensureSiteStyle(): void {
  if (siteStyle?.isConnected) return
  siteStyle = document.createElement('style'); siteStyle.textContent = SITE_CSS; document.head.append(siteStyle)
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
  // a public, non-template link can also be shown inside another site (the read-only embed records no visitors)
  const embed = element('textarea'); embed.readOnly = true; embed.className = 'embed-snippet'; embed.setAttribute('aria-label', 'Embed snippet')
  const copyEmbed = button('Copy embed', () => { embed.select(); Promise.resolve(navigator.clipboard?.writeText(embed.value)).catch(() => { status.textContent = 'Select and copy the snippet above.' }) })
  const showEmbed = () => {
    embed.value = audience === 'public' && output.value && state.session ? embedSnippet(output.value, state.session.baseUrl) : ''
    embed.hidden = copyEmbed.hidden = !embed.value
  }
  showEmbed()
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
      output.value = enabled ? shareUrl(address) : ''; copy.disabled = !enabled; showEmbed()
      status.textContent = enabled ? 'Link ready. Visitors can submit input; “Apply poll result” on the choice resolves it from their responses.' : 'Link revoked.'
      await app.syncNow('sharing changed')
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error) }
    finally { publish.disabled = revoke.disabled = false }
  }
  const publish = button(policy?.enabled ? 'Update publication' : 'Publish node', () => void save(true))
  const revoke = button('Revoke link', () => void save(false)); revoke.disabled = !policy?.enabled
  publish.disabled = state.session?.kind !== 'user' || !app.isOnline('fos')
  box.append(publish, revoke, output, copy, embed, copyEmbed, status)
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
  // the published node reads as a website: its page, sections and sub-pages (`site.ts`); `trail` is the sub-page shown
  let trail: string[] = [], drawn = 0
  const pageTitle = document.title
  const modes = () => {
    root.classList.toggle('shared-execution', !!node?.execution && !panel.hidden)
    root.classList.toggle('shared-site', !!node && !node.execution && !panel.hidden)
    document.title = node && !panel.hidden ? `${node.title} — Fosforescent` : pageTitle
  }
  // the visitor's answers survive sub-page navigation; a new projection starts from what they submitted
  let answers: SiteAnswers | null = null
  const fieldExtras = (field: SharedInput, current: SiteAnswers): HTMLElement => {
    const box = element('div')
    const search = element('input'); search.placeholder = 'Find a value in your context'; search.setAttribute('aria-label', `Find value for ${field.name}`)
    const matches = element('div'), linked = element('p', current.fields[field.key]?.source ? 'Linked to your context; saving refreshes the requested value.' : '')
    const choose = (id: string) => {
      const match = resolveRef(app.state.replica, id)
      if (!match || (field.kind === 'allocation' && (!match.row.allocation || match.row.allocation.type !== field.type || match.row.allocation.unit !== field.unit))) { linked.textContent = 'Choose a value of the required type.'; return }
      current.fields[field.key] = { source: id }; linked.textContent = `Linked: ${match.row.title}. Only the requested value will be shared.`
    }
    search.oninput = () => {
      matches.replaceChildren()
      for (const { row } of app.searchLocalNodes(search.value).filter(m => field.kind === 'text' || (m.row.allocation?.type === field.type && m.row.allocation?.unit === field.unit)).slice(0, 12)) matches.append(button(row.title, () => choose(row.id)))
    }
    box.ondragover = e => { e.preventDefault() }
    box.ondrop = e => { e.preventDefault(); const raw = e.dataTransfer?.getData('application/x-fos-node') || e.dataTransfer?.getData('text/plain'); if (raw) { try { const data = JSON.parse(raw); choose(data.id ?? data) } catch { choose(raw) } } }
    box.append(search, matches, linked)
    return box
  }
  const submit = async (given: SiteAnswers, revision: string) => {
    const id = generation, snapshot = node!
    try {
      if (currentSession()) { await app.syncNow('before sharing input'); if (isDirty(app.state.replica)) throw new Error('Sync your linked values before submitting.') }
      if (id !== generation) return
      const submitted = { ...given.fields }, sources: Record<string, string> = Object.create(null)
      for (const [key, entry] of Object.entries(given.fields)) if (entry.source) {
        sources[key] = entry.source
        if (!currentSession()) {
          const field = snapshot.inputs.find(f => f.key === key)!, row = resolveRef(app.state.replica, entry.source)?.row
          if (!row) throw new Error('A linked value is no longer available in your context.')
          const allocation = row.allocation
          submitted[key] = { value: field.kind === 'text' ? row.title : allocation ? { amount: allocation.amount, type: allocation.type, unit: allocation.unit, start: allocation.start, end: allocation.end } : null }
        }
      }
      if (!currentSession() && linkedPath) app.rememberSharedSources(linkedPath, sources)
      await request('input', { revision, name: given.name, approvals: [...given.approvals], ranking: given.ranking, fields: submitted })
      if (id === generation) { showError('Input saved.'); if (currentSession()) void app.syncNow('guest input saved') }
    } catch (error) { if (id === generation) showError(error) }
  }
  const drawSite = async (target: HTMLElement) => {
    const id = ++drawn, snapshot = node
    if (!snapshot || !answers) return
    ensureSiteStyle()
    try {
      await renderSitePage(target, snapshot, {
        markdown: renderMarkdown, hydrate: hydrateDiagrams, trail, answers,
        navigate: next => { trail = next; void drawSite(target).then(() => panel.scrollTo?.({ top: 0 })) },
        interact: { signedIn: !!currentSession(), submit, fieldExtras }
      })
    } catch (error) { if (id === drawn) target.textContent = error instanceof Error ? error.message : String(error) }
  }
  const render = () => {
    modes()
    panel.replaceChildren()
    if (node) {
      answers = siteAnswers(node)
      const ownSources = node.sources ?? (linkedPath ? readNodeValue<Record<string, string>>(app.state.replica, linkedPath, 'fos:input-links') : null) ?? {}
      for (const [key, source] of Object.entries(ownSources)) answers.fields[key] = { source }
    }
    if (!node) panel.append(element('h2', 'Shared node'))
    else { const page = element('div'); page.className = 'shared-site-page'; panel.append(page); void drawSite(page) }
    if (node?.execution && document.documentElement.requestFullscreen) {
      const fullscreen = element('button', ''); fullscreen.className = 'icon shared-fullscreen'; fullscreen.type = 'button'
      const update = () => { fullscreen.innerHTML = iconSvg(document.fullscreenElement ? 'exit-fullscreen' : 'fullscreen')!; fullscreen.title = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; fullscreen.setAttribute('aria-label', fullscreen.title) }
      update(); fullscreen.onclick = () => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).then(update).catch(() => {}) }; panel.append(fullscreen)
    }
    if (node?.execution?.error) panel.append(element('p', node.execution.error))
    else if (node?.execution?.status === 'committed') panel.append(element('p', 'Complete'))
    const status = element('p'); status.setAttribute('role', 'status'); panel.append(status)
    const tools = element('footer'); tools.className = 'shared-site-tools'
    tools.append(element('p', `Shared by ${address?.owner} · linked in your Home context.`))
    tools.append(button('Refresh shared node', () => void load()))
    if (!node?.execution) tools.append(button('Back to host peer', () => { if (linkedPath) app.goTo(linkedPath.slice(0, -1)); location.hash = '' }))
    if (!currentSession()) tools.append(button('Sign in with my context', () => app.openModal('connect')))
    panel.append(tools)
  }
  const update = () => {
    if (app.state.connection === 'connecting' && !currentSession()) return
    const next = sharedAddress(location.hash), identity = `${JSON.stringify(next)}:${currentSession()?.username ?? 'anonymous'}`
    if (identity === lastIdentity) { if (linkedPath) panel.hidden = JSON.stringify(app.state.view) !== JSON.stringify(linkedPath); modes(); return }
    lastIdentity = identity; generation++; address = next; node = null; linkedPath = null; token = undefined; trail = []; panel.hidden = !next
    if (!next) { modes(); return }
    try { token = localStorage.getItem(tokenKey()) ?? undefined } catch { /* private browsing */ }
    render(); void load()
  }
  window.addEventListener('hashchange', update); app.subscribe(update)
}
