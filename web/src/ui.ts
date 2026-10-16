import { desktopAgentControls, localRepository } from './agents'
import { inTauri, tauriInvoke } from './project'
import { parsePastedRows } from './paste'
import { SETTING_LABELS, settingKeyFromName } from './settings'
import { combobox } from './combobox'
import { iconSvg } from './icons'
import { alternativePicker, proposalPreview, clearProposal } from './alternatives'
/**
 * DOM rendering. The shell is built once; each state change re-renders the
 * dynamic regions from the app state and the replica's view model (plain ids,
 * titles and flags; no content addresses reach this file).
 */

import QRCode from 'qrcode'
import { sharingControls } from './sharing'
import { requirementOutputs, resolveRequirementOutput, resolveScope, resolveText, put, content, headCid, viewNode, findChild, WORK_SYSTEM, isDirty, view as viewAt, type ChoiceView, HOME_ID, type MovePosition, type NodeView, type Scope, type TaskView } from '../../shared/sync/index'
import type { App, AppState } from './app'
import { exportNote, noteContext, noteFilename, type NoteChild } from './notes'
import { hydrateDiagrams, renderMarkdown } from './markdown'
import { ROW_KIND_LABEL, SYNTAX_HELP, allocationTag, describeParsed, downloadText, formatAmount, parseRowInput, rawRowText, renderInlineText } from './rows'
import { CAPABILITY_LABEL, type Capability, type PeerPolicy, type RowKind } from '../../shared/sync/index'

type Regions = {
  context: HTMLElement
  repository: HTMLElement
  node: HTMLElement
  status: HTMLElement
  menuButton: HTMLButtonElement
  menu: HTMLElement
  banner: HTMLElement
  crumbs: HTMLElement
  choices: HTMLElement
  list: HTMLElement
  mic: HTMLButtonElement
  footer: HTMLElement
  modal: HTMLElement
}

/**
 * Workflowy-style tree: a blank row at the top is where typing starts (the cursor
 * defaults there); the selected row is always editable; ↑/↓ move between rows,
 * Enter adds a blank row below, Backspace on a blank row deletes it. Ctrl+H shows
 * every key and row marker. How many levels show at once depends on the screen:
 * phones show one level and zoom into a row to see its children, larger screens
 * expand/collapse a few levels in place.
 */
let renderDepth = 0
const KEY_HELP: Array<[string, string]> = [
  ['Ctrl/⌘ Z · Ctrl/⌘ Shift Z', 'undo / redo committed edits (last 100 this session); while typing, undo draft text'],
  ['↑ / ↓', 'move between rows (↑ from the first row returns to the blank row at the top)'],
  ['Shift+Enter', 'create and edit a new branch'],
  ['Alt+Enter', 'new line in a cell; indent lines to create child rows'],
  ['Enter', 'new row below (on a requirement, bank or allocation: edit its text)'],
  ['Ctrl+Enter', 'mark a task done or open; on other rows, new row below'],
  ['Ctrl+Shift+Enter', 'new row inside'],
  ['Tab / Shift+Tab', 'indent / outdent'],
  ['Alt+↑ / Alt+↓', 'move the row up / down'],
  ['Alt+→ / Alt+←', 'zoom into the row / zoom out'],
  ['→ / ←', 'expand / collapse the row'],
  ['Backspace', 'on a blank row: delete it; with nothing selected: zoom out'],
  ['Ctrl+Shift+Backspace', 'delete the row'],
  ['Ctrl+. or .', 'row actions (also right-click or the ⋯ button)'],
  ['Esc', 'leave the row'],
  ['Ctrl+H', 'this help'],
  ['drag', 'move the row; Alt+drag places a reference, Ctrl+drag a copy']
]
/** Ctrl+H (also ⌘H): the keys and row-syntax help. */
function isHelpKey(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === 'h' || event.key === 'H')
}
function maxDepth(): number {
  const w = window.innerWidth
  const h = window.innerHeight
  if (w < 640) return 1
  return Math.max(2, Math.min(6, Math.floor(h / 140)))
}
let lastDepth = maxDepth()
let scanner: { stop(): Promise<void> } | null = null
let lastModalKey = ''

export function mountUi(root: HTMLElement, app: App): void {
  try { const theme = localStorage.getItem('fos.device.theme'); if (theme && ['light', 'dark', 'system'].includes(theme)) document.documentElement.dataset.theme = theme } catch { /* browser storage disabled */ }
  root.innerHTML = `
    <header class="topbar">
      <div class="brand-row">
        <button type="button" class="icon menu-button" data-region="menu-button" aria-label="Menu">☰</button>
        <div class="brand"><img src="/icon-192.png" width="24" height="24" alt="">Fosforescent</div>
        <button type="button" class="icon help-button" data-region="help-button" title="Keys and row syntax (Ctrl+H)" aria-label="Keys and row syntax">?</button>
      </div>
      <div class="status" data-region="status"></div>
      <nav class="menu" data-region="menu" hidden></nav>
    </header>
    <section class="banner" data-region="banner" hidden></section>
    <nav class="crumbs" data-region="crumbs"></nav>
    <div class="voice-controls"><button type="button" class="icon mic" data-region="mic" title="Record a voice note (transcribed and organized into notes)" aria-label="Record a voice note">🎙</button></div>
    <section class="repository" data-region="repository"></section>
    <section class="node-detail" data-region="node"></section>
    <section class="choices" data-region="choices"></section>
    <section class="tasks">
      <div class="children-toolbar" data-region="children-toolbar"></div>
      <ul class="list tree" data-region="list"></ul>
    </section>
    <footer class="footer" data-region="footer"></footer>
    <div class="context-menu" data-region="context" hidden></div>
    <div class="modal-backdrop" data-region="modal" hidden></div>
  `
  const q = <T extends HTMLElement>(name: string): T => root.querySelector(`[data-region="${name}"]`) as T
  const regions: Regions = {
    context: q('context'),
    repository: q('repository'),
    node: q('node'),
    status: q('status'),
    menuButton: q('menu-button'),
    menu: q('menu'),
    banner: q('banner'),
    crumbs: q('crumbs'),
    choices: q('choices'),
    list: q('list'),
    mic: q('mic'),
    footer: q('footer'),
    modal: q('modal')
  }

  regions.list.addEventListener('dragover', event => { if (event.dataTransfer?.types.some(t => [CONSTRUCTOR_DRAG_TYPE, NODE_DRAG_TYPE, OUTPUT_DRAG_TYPE, 'application/x-fos-placeholder', 'application/x-fos-trigger'].includes(t))) event.preventDefault() })
  regions.list.addEventListener('drop', event => {
    if (dropTrigger(event, app, app.state.view) || (event.target as HTMLElement).closest('[data-id], [data-argument]')) return
    if (event.dataTransfer?.types.includes(OUTPUT_DRAG_TYPE)) { event.preventDefault(); app.linkOutput(app.state.view, event.dataTransfer.getData(OUTPUT_DRAG_TYPE)) }
    else if (event.dataTransfer?.types.includes(NODE_DRAG_TYPE)) { event.preventDefault(); app.linkNode(event.dataTransfer.getData(NODE_DRAG_TYPE)) }
  })
  installRowClipboard(regions.list, app)
  regions.mic.addEventListener('click', () => { void app.toggleVoice() })
  q<HTMLButtonElement>('help-button').addEventListener('click', () => toggleHelp(app))
  regions.menuButton.innerHTML = iconSvg('☰')!
  regions.menuButton.addEventListener('click', (event) => {
    event.stopPropagation()
    app.toggleMenu()
  })
  document.addEventListener('click', (event) => {
    if (app.state.menuOpen && !regions.menu.contains(event.target as Node)) app.toggleMenu(false)
    const target = event.target as HTMLElement
    if (app.state.contextMenu && !regions.context.contains(target) && !target.closest('.more')) app.closeContextMenu()
  })
  document.addEventListener('keydown', (event) => handleKey(event, app))
  regions.modal.addEventListener('click', (event) => {
    if (event.target === regions.modal) app.closeModal()
  })

  let rendering = false
  let pending: AppState | null = null
  app.subscribe((state) => {
    pending = state
    if (rendering) return
    rendering = true
    try {
      while (pending) { const next = pending; pending = null; renderDepth++; try { render(regions, next, app) } finally { renderDepth-- } }
    } finally { rendering = false }
  })
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => { if (maxDepth() !== lastDepth) { lastDepth = maxDepth(); app.refresh() } }, 150)
  })
}

function render(regions: Regions, state: AppState, app: App): void {
  renderStatus(regions.status, state, app)
  renderMenu(regions.menu, state, app)
  renderBanner(regions.banner, state, app)
  renderMic(regions.mic, state, app)
  renderModal(regions.modal, state, app)

  document.activeElement?.dispatchEvent(new window.Event('render-commit'))
  const node = app.currentView()
  if (!node) {
    app.goTo([]) // the viewed node vanished (e.g. removed by a merge)
    return
  }
  renderCrumbs(regions.crumbs, state, app)
  renderRepository(regions.repository, state, app)
  renderNodeDetail(regions.node, state, app)
  renderChoices(regions.choices, node, state, app)
  renderTree(regions.list, node, state, app)
  renderFooter(regions.footer, state, app)
  renderContextMenu(regions.context, state, app)
  for (const [name, element] of [['repository', regions.repository], ['voice', regions.mic.parentElement!]] as const) {
    const slot = regions.node.querySelector(`[data-slot="${name}"]`)
    if (slot && element.parentElement !== slot) slot.append(element)
  }
}

// ---------------------------------------------------------------------------

function renderStatus(el: HTMLElement, state: AppState, app: App): void {
  const dirty = isDirty(state.replica)
  const labels: Record<AppState['connection'], string> = { offline: 'Offline', connecting: 'Connecting…', online: 'Online', syncing: 'Syncing…' }
  const lastSync = state.replica.meta.lastSyncAt
  el.className = `status status-${state.connection}`
  el.replaceChildren(
    span('dot', ''),
    state.connection === 'offline'
      ? button('link status-text', labels[state.connection], () => app.goToAccountPeer())
      : span('status-text', labels[state.connection]),
    ...(app.isLocal() ? [span('local-badge', 'Local')] : []),
    ...(dirty ? [span('badge', state.connection === 'offline' ? 'unsynced changes' : 'pending')] : []),
    ...(lastSync && !dirty ? [span('muted', `synced ${ago(lastSync)}`)] : [])
  )
}

function renderMenu(el: HTMLElement, state: AppState, app: App): void {
  el.hidden = !state.menuOpen
  if (!state.menuOpen) { el.replaceChildren(); return }
  const items: HTMLElement[] = []
  // Any menu action closes the menu first, so it can never stay open over the page.
  const item = (label: string, onClick: () => void, cls = '') => items.push(button(`menu-item ${cls}`, label, () => { if (cls !== 'hint') app.toggleMenu(false); onClick() }))
  const session = state.session
  if (!session) item('Connect…', () => app.goToAccountPeer(), 'primary-text')
  item('⚙ Settings', () => app.goToRoot())
  if (session?.kind === 'user') {
    item('Invite a device here', () => void app.startInvite())
    item(`Connection requests${state.requests.length ? ` (${state.requests.length})` : ''}`, () => app.openModal('requests'))
  }
  if (state.replica.meta.scope.length > 0 && session?.kind === 'user') {
    const toRoot = button('menu-item', 'Sync whole account on this device', () => app.attachAt([]))
    toRoot.disabled = !app.canAttach([])
    items.push(toRoot)
  }
  if (session) item(`Sign out (${session.username})`, () => app.logout())
  el.replaceChildren(...items)
}

function renderMic(el: HTMLButtonElement, state: AppState, app: App): void {
  const v = state.voice
  el.hidden = false
  el.classList.toggle('recording', v?.phase === 'recording')
  el.classList.toggle('busy', v?.phase === 'uploading')
  el.disabled = v?.phase === 'uploading' || (!v && !app.canRecordVoice())
  el.textContent = v?.phase === 'recording' ? '■' : v?.phase === 'uploading' ? '…' : '🎙'
  if (!v) el.innerHTML = iconSvg('🎙')!
  el.title = v?.phase === 'recording' ? 'Stop recording' : v?.phase === 'uploading' ? 'Transcribing and organizing…' : app.canRecordVoice() ? 'Record a voice note (transcribed and organized into notes)' : 'Connect to your account to record voice notes'
}

function renderBanner(el: HTMLElement, state: AppState, app: App): void {
  const showing = state.session !== null && (state.connection === 'offline' || state.connection === 'connecting')
  el.hidden = !showing
  if (!showing) { el.replaceChildren(); return }
  const retry = button('secondary', state.connection === 'connecting' ? 'Connecting…' : 'Retry', () => app.reconnect('manual'))
  retry.disabled = state.connection === 'connecting'
  el.replaceChildren(
    div('banner-text', 'Server unreachable. Working locally: your changes are saved on this device and will merge when the connection returns.'),
    ...(state.loginError ? [div('error', state.loginError)] : []),
    retry
  )
}

function shortCrumb(text: string): string {
  const clean = text.replace(/^\[ \]\s*/, '☐ ').replace(/^\[[xX]\]\s*/, '☑ ').replace(/^>\s*/, '▤ ').replace(/^\/\/\s*/, '☏ ')
  const chars = Array.from(clean)
  return chars.length > 17 ? chars.slice(0, 7).join('') + '…' + chars.slice(-7).join('') : clean
}
function matchesSearch(row: TaskView, query: string): boolean {
  const types = [...query.matchAll(/(?:^|\s)type:([\w-]+)/g)].map(m => m[1])
  const text = query.replace(/(?:^|\s)type:[\w-]+/g, '').trim().toLowerCase()
  return (!types.length || types.includes(row.kind) || types.includes(row.requirement?.capability ?? '') || types.includes(row.allocation?.type ?? '')) && row.title.toLowerCase().includes(text)
}
function pathLabel(names: string[]): string {
  return names.length === 0 ? '/' : '/' + names.join('/')
}

function renderCrumbs(el: HTMLElement, state: AppState, app: App): void {
  const { view } = state
  const labels = app.labels()
  const crumbs = document.createElement('div')
  crumbs.className = 'crumb-path'
  const settingsContext = view.length > 0 && view[0] !== HOME_ID && !state.replica.meta.scope.length && !!viewAt(state.replica, [])?.tasks.some(row => row.id === HOME_ID)
  const homeCrumb = button('crumb', settingsContext ? 'Settings' : labels.scope.length ? shortCrumb(pathLabel(labels.scope)) : '⌂', () => settingsContext ? app.goToRoot() : app.goTo([]))
  if (!settingsContext && !labels.scope.length) { homeCrumb.innerHTML = iconSvg('⌂')!; homeCrumb.setAttribute('aria-label', 'Home'); homeCrumb.title = 'Home' }
  if (state.atRoot) {
    crumbs.append(span('crumb current', 'Settings'))
  } else {
    crumbs.append(homeCrumb)
    view.forEach((_id, index) => {
      if (_id === HOME_ID) return
      const row = viewAt(state.replica, view.slice(0, index), true)?.tasks.find(row => row.id === _id)
      const crumb = button('crumb', shortCrumb(labels.view[index] ?? '…'), () => app.goTo(view.slice(0, index + 1)))
      crumb.title = labels.view[index] ?? ''
      const symbol = ({ task: '☑', note: 'note', comment: 'comment', template: '✦', allocation: 'money', requirement: '⑂' } as Record<string, string>)[row?.kind ?? '']
      if (symbol) { const icon = span('crumb-icon', ''); icon.innerHTML = iconSvg(symbol) ?? ''; crumb.prepend(icon) }
      crumbs.append(span('sep', '›'), crumb)
    })
    const current = crumbs.lastElementChild as HTMLElement
    current.classList.add('current')
  }

  el.replaceChildren(crumbs)
}

function branchSelector(task: TaskView, at: Scope, app: App, absolute = false): HTMLElement {
  return alternativePicker(app, [...(absolute ? [] : app.state.view), ...at, task.id], task)
}

function renderRepository(el: HTMLElement, state: AppState, app: App): void {
  if (el.querySelector('.combo-panel:not([hidden])') || (el.contains(document.activeElement) && document.activeElement?.closest('.row-combobox, .argument-editor, .setting-row, .account-form'))) return
  const path = state.view, id = path.at(-1)
  const task = id ? viewAt(state.replica, path.slice(0, -1))?.tasks.find(row => row.id === id) : null
  const info = app.repositoryInfo()
  const items: HTMLElement[] = []
  if (info) {
    const row = div('row', '')
    row.append(span('', `GitHub · ${info.repo}`), button('secondary small', 'Refresh branches and PRs', () => void app.refreshRepositories(true)))
    if (!state.integrations.some(i => i.id === 'github' && i.connected)) row.append(button('secondary small', 'Connect GitHub', () => void app.connectIntegration('github')))
    if (info.snapshot && !info.snapshot.canPush) row.append(span('muted', 'Read-only on GitHub · diffs are available below'))
    items.push(row)
    for (const pull of info.snapshot?.pulls ?? []) {
      const card = document.createElement('article'); card.className = 'proposal'
      const link = document.createElement('a'); link.href = pull.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `#${pull.number} ${pull.title}`
      card.append(link, div('muted', `${pull.head} → ${pull.base} · ${pull.state}`), div('muted', app.repositoryDiff(pull)))
      if (pull.state === 'open' && info.snapshot?.canPush && app.hasRepositoryPeer(path)) card.append(button('primary small', 'Approve and merge on GitHub', () => {
        if (window.confirm(`Merge GitHub PR #${pull.number} into ${pull.base}?`)) void app.decideRepoPull(pull, 'merge')
      }), button('danger small', 'Close PR', () => void app.decideRepoPull(pull, 'close')))
      items.push(card)
    }
  }
  el.hidden = !items.length
  el.replaceChildren(...items)
}

function renderChoices(el: HTMLElement, node: NodeView, state: AppState, app: App): void {
  const choices = node.choices
  if (choices.length === 0) { el.replaceChildren(); return }
  const heading = document.createElement('h2')
  heading.textContent = choices.length === 1 ? '1 conflict to resolve' : `${choices.length} conflicts to resolve`
  el.replaceChildren(heading, ...choices.map((choice) => renderChoice(choice, state, app)))
}

function renderChoice(choice: ChoiceView, state: AppState, app: App): HTMLElement {
  return renderChoiceCard(choice, state, (index) => app.resolveChoice(choice.id, index))
}

function renderChoiceCard(choice: ChoiceView, state: AppState, pick: (index: number | null) => void): HTMLElement {
  const card = document.createElement('article')
  card.dataset.choice = choice.id
  card.className = 'choice' + (state.highlighted.includes(choice.id) ? ' highlighted' : '')
  const title = document.createElement('h3')
  title.textContent = `“${choice.subject}” was changed in two places`
  card.append(title)
  const diff = document.createElement('div')
  diff.className = 'diff'
  if (choice.base || choice.baseLabel) diff.append(renderVersion('Before', choice.base, choice.baseLabel, null, null))
  choice.options.forEach((option, index) => {
    diff.append(renderVersion(peerLabel(option.peerId, state), option.task, option.label, choice.base, () => pick(index)))
  })
  card.append(diff)
  const actions = div('choice-actions', '')
  actions.append(button('danger small', 'Delete it instead', () => pick(null)))
  card.append(actions)
  return card
}

function renderVersion(label: string, task: TaskView | null, plainLabel: string | null, base: TaskView | null, onPick: (() => void) | null): HTMLElement {
  const col = document.createElement('div')
  col.className = 'version' + (onPick ? ' option' : ' base')
  col.append(div('version-label', label))
  if (task) {
    const titleEl = div('field title', task.title)
    if (base && base.title !== task.title) titleEl.classList.add('changed')
    const doneEl = div('field done', task.done ? '✓ done' : '○ open')
    if (base && base.done !== task.done) doneEl.classList.add('changed')
    col.append(titleEl, doneEl)
  } else if (plainLabel) {
    col.append(div('field title', plainLabel))
  } else {
    col.append(div('deleted', 'deleted'))
  }
  if (onPick) col.append(button('primary small', 'Keep this', onPick))
  return col
}

/** The blank row at the top of the tree should take the focus on the next render (first paint, ↑ from the first row, Esc). */
let focusGhost = true
/** Rows whose body carries controls (requirements, supplies, queries, banks, allocations) keep it while selected; this is the one being text-edited (double-click / Enter). */
let editingSpecial: string | null = null
const SPECIAL_KINDS: ReadonlySet<RowKind> = new Set<RowKind>(['requirement', 'supply', 'query', 'resource', 'allocation'])
type DragMode = 'move' | 'ref' | 'copy'
let drag: { id: string; at: Scope; mode: DragMode } | null = null
let pointerDown = false
/** Rendered-markdown cache keyed by expanded note text, so re-renders are synchronous after the first paint. */
const noteHtml = new Map<string, string>()
document.addEventListener('mouseup', () => { pointerDown = false })

const multiRows = new WeakMap<App, { scope: string; paths: Set<string>; anchor?: string }>()
function selectedRows(app: App) {
  const scope = JSON.stringify([app.state.replica.meta.peerId, app.state.view])
  let selection = multiRows.get(app)
  if (!selection || selection.scope !== scope) { selection = { scope, paths: new Set() }; multiRows.set(app, selection) }
  return selection
}
function installRowClipboard(list: HTMLElement, app: App): void {
  list.addEventListener('click', event => {
    const target = event.target as HTMLElement, row = target.closest<HTMLElement>('.task[data-path]')
    if (!row || target.closest('button,a,.row-combobox')) return
    const selection = selectedRows(app), key = row.dataset.path!
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) { selection.paths.clear(); selection.anchor = key; list.querySelectorAll('.multi-selected').forEach(el => el.classList.remove('multi-selected')); return }
    event.preventDefault(); event.stopImmediatePropagation()
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    const rows = Array.from(list.querySelectorAll<HTMLElement>('.task[data-path]'))
    if (event.shiftKey && selection.anchor) {
      const start = rows.findIndex(el => el.dataset.path === selection.anchor), end = rows.findIndex(el => el.dataset.path === key)
      if (start >= 0) for (const el of rows.slice(Math.min(start, end), Math.max(start, end) + 1)) selection.paths.add(el.dataset.path!)
      else selection.paths.add(key)
    } else { selection.paths.has(key) ? selection.paths.delete(key) : selection.paths.add(key); selection.anchor = key }
    app.select(null)
    for (const el of list.querySelectorAll<HTMLElement>('.task[data-path]')) { const selected = selection.paths.has(el.dataset.path!); el.classList.toggle('multi-selected', selected); el.setAttribute('aria-selected', String(selected)) }
  }, true)
  document.addEventListener('copy', event => {
    if (!list.isConnected) return
    const input = document.activeElement
    if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) && input.selectionStart !== input.selectionEnd) return
    const paths = Array.from(list.querySelectorAll<HTMLElement>('.task[data-path]')).map(el => el.dataset.path!).filter(path => selectedRows(app).paths.has(path)).map(path => JSON.parse(path) as Scope)
    if (!paths.length || !event.clipboardData) return
    const lines = paths.map(path => {
      const row = app.rowAt(path)!, depth = paths.filter(parent => parent.length < path.length && parent.every((id, i) => id === path[i])).length
      return '  '.repeat(depth) + '- ' + rawRowText(row.kind === 'ref' && !row.refOwner ? app.refTarget(row.refId ?? '')?.row ?? row : row).replace(/\n/g, '\n' + '  '.repeat(depth + 1))
    })
    event.preventDefault(); event.clipboardData.setData('text/plain', lines.join('\n'))
  })
  document.addEventListener('paste', event => {
    const input = event.target as HTMLTextAreaElement
    if (!list.isConnected || !(input instanceof HTMLTextAreaElement) || (!list.contains(input) && !input.matches('.node-text')) || input.readOnly) return
    const text = event.clipboardData?.getData('text/plain') ?? '', element = input.closest<HTMLElement>('.task[data-path]'), path: Scope = element ? JSON.parse(element.dataset.path!) : []
    try {
      if (!input.value.trim() && text.startsWith('fos-ref:') && !input.matches('.node-text')) { event.preventDefault(); event.stopImmediatePropagation(); app.pasteNodeLink(path.slice(0, -1), path.at(-1) ?? null, decodeURIComponent(text.slice(8).trim())); return }
      if (/^\s*["']?v2-[a-f0-9]+["']?:\s*\n/i.test(text)) {
        event.preventDefault(); event.stopImmediatePropagation()
        input.dispatchEvent(new window.Event('commit-edit'))
        app.importYaml(text, [...app.state.view, ...path]); return
      }
      if (!text.includes('\n') && !/^\s*(?:[-*+] |\d+[.)] |#{1,6} )/.test(text)) return
      const rows = parsePastedRows(text)
      if (!rows.length) return
      event.preventDefault(); event.stopImmediatePropagation();
      if (input.matches('.node-text') || input.value.trim()) { input.dispatchEvent(new window.Event('commit-edit')); app.pasteRows(rows, path) }
      else app.pasteRows(rows, path.slice(0, -1), path.at(-1))
    } catch (error) { event.preventDefault(); app.notify('error', error instanceof Error ? error.message : String(error)) }
  }, true)
}

type NodeLayout = 'tree' | 'chat' | 'grid' | 'queue'
type WorkspacePrefs = { tab: 'peers' | 'integrations' | 'device' | 'input' | 'values' | 'utilities' | 'constructors' | 'actions' | 'marketplace'; layout: NodeLayout; actionTab: string; search: string; trigger?: string; open: Record<string, boolean> }
const workspacePrefs = new WeakMap<App, WorkspacePrefs>()
const workspaceSearch = new WeakMap<App, { key: string; values: Map<string, string> }>()
function workspace(app: App): WorkspacePrefs {
  let prefs = workspacePrefs.get(app)
  if (!prefs) { prefs = { tab: 'constructors', layout: 'tree', actionTab: 'main', search: '', open: {} }; workspacePrefs.set(app, prefs) }
  const key = JSON.stringify([app.state.atRoot, app.state.view])
  let search = workspaceSearch.get(app)
  if (!search) { search = { key, values: new Map() }; workspaceSearch.set(app, search) }
  if (search.key !== key) { search.values.set(search.key, prefs.search); prefs.search = search.values.get(key) ?? ''; search.key = key }
  return prefs
}

function iconButton(icon: string, label: string, action: () => void): HTMLButtonElement {
  const b = button('icon', icon, action); const svg = iconSvg(icon, label); if (svg) b.innerHTML = svg; b.title = label; b.setAttribute('aria-label', label); return b
}
function accordion(app: App, key: string, label: string, ...children: HTMLElement[]): HTMLDetailsElement {
  const d = document.createElement('details'), summary = document.createElement('summary')
  d.className = 'node-accordion'; d.dataset.accordion = key; d.open = workspace(app).open[key] ?? false
  summary.innerHTML = iconSvg(key === 'context' ? '✦' : key === 'actions' ? '▶' : 'inventory') ?? label
  summary.title = label; summary.setAttribute('aria-label', label); d.append(summary, ...children)
  const prefs = workspace(app)
  d.addEventListener('toggle', () => { prefs.open[key] = d.open })
  return d
}
const CONSTRUCTOR_DRAG_TYPE = 'application/x-fos-constructor'
const CONSTRUCTORS = [
  { id: 'peer', label: 'Peer', icon: '♙' },
  { id: 'integration', label: 'Integration', icon: '▦' },
  { id: 'inventory', label: 'Inventory allocation', icon: 'inventory' },
  { id: 'calendar', label: 'Calendar allocation', icon: 'calendar' },
  { id: 'account', label: 'Money allocation', icon: 'money' },
  { id: 'bank', label: 'Resource bank', icon: 'inventory' },
  { id: 'repository', label: 'Repository', icon: '⑂' }
] as const
function constructorOptions(app: App) {
  return [...app.handlerOffers().filter(o => o.enabled && o.active && o.type === app.state.replica.store.primitive.templateField.getId()).map(o => ({ id: `handler:${o.cid}`, label: o.label, icon: '✦', output: 'template' })), ...CONSTRUCTORS.map(c => ({ ...c, output: c.id === 'peer' || c.id === 'integration' ? 'peer' : c.id === 'repository' ? 'repo' : c.id })),
    ...(['search', 'llm', 'market'] as const).filter(cap => app.capabilityAvailable(cap, app.constructorContext())).map(cap => ({ id: `action:${cap}`, label: CAPABILITY_LABEL[cap] ?? cap, icon: '▶', output: cap })),
    ...app.pullPeers().map(p => ({ id: 'pull', label: `Pull / sync from ${p.name}`, icon: '⟳', output: 'tool' })),
    ...app.triggerKinds(app.constructorContext()).map(kind => ({ id: `trigger:${kind}`, label: kind === 'task-completion' ? 'When parent completes' : kind === 'request' ? 'On request' : kind === 'cron' ? 'Cron trigger' : 'Timer trigger', icon: 'calendar', output: kind }))]
}
function insertConstructor(app: App, id: string, path = app.constructorContext(), replace = false): void {
  if (proposalPreview(app)) return
  if (id.startsWith('handler:')) { try { app.insertHandler(id.slice(8), path) } catch (error) { app.notify('error', String(error)) }; return }
  if (id === 'pull') { try { app.addPullConstructor(path) } catch (error) { app.notify('error', String(error)) }; return }
  if (id.startsWith('action:')) {
    const cap = id.slice(7) as 'search' | 'llm' | 'market'
    if (!['search','llm','market'].includes(cap) || !app.capabilityAvailable(cap, path)) { app.notify('error', 'This action has no active handler here.'); return }
    try { app.applyConstructor(path, { kind: 'requirement', text: CAPABILITY_LABEL[cap] ?? cap, done: false, extras: { requirement: { capability: cap } } }) } catch (error) { app.notify('error', String(error)) }
    return
  }
  if (!id.startsWith('trigger:')) { openConstructor(app, id, path, replace); return }
  const kind = id.slice(8) as import('../../shared/sync/triggers').TriggerKind
  if (!app.triggerKinds(path).includes(kind)) { app.notify('error', 'The trigger provider is not active.'); return }
  const store = app.state.replica.store, dialog = document.createElement('dialog'), form = document.createElement('form')
  dialog.className = 'import-dialog'
  const input = document.createElement('input'); input.type = kind === 'timer' ? 'datetime-local' : 'text'; input.setAttribute('aria-label', 'Trigger schedule'); input.placeholder = 'Five-field UTC cron expression'; input.required = kind === 'timer' || kind === 'cron'; input.hidden = !input.required
  const submit = button('primary', 'Add trigger', () => undefined); submit.type = 'submit'
  const error = div('error', '')
  form.append(h4('Trigger'), span('muted', 'Creates a paused workflow. Add its children, then enable it.'), input, error, submit, button('secondary', 'Cancel', () => dialog.close()))
  form.onsubmit = event => {
    event.preventDefault()
    if (app.state.replica.store !== store || proposalPreview(app)) { error.textContent = 'The editing context changed.'; return }
    const before = headCid(app.state.replica)
    app.configureTrigger(kind, input.value, true, path, false)
    if (headCid(app.state.replica) !== before) dialog.close()
    else error.textContent = app.state.notice?.text ?? 'Check the trigger schedule.'
  }
  dialog.append(form); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}
function suggestedConstructors(app: App): HTMLElement {
  const panel = div('constructor-palette suggestions', '')
  const needs = app.constructorNeeds(), all = constructorOptions(app)
  const matches = needs.length ? all.filter(c => needs.includes(c.output) || (needs.includes('allocation') && ['inventory','calendar','account'].includes(c.output))) : all
  for (const c of matches) { const b = iconButton(c.icon, c.label, () => insertConstructor(app, c.id)); constructorDrag(b, c.id); panel.append(b) }
  if (!matches.length) panel.append(span('muted', 'Search for a constructor matching this input.'))
  return panel
}

function constructorDrag(el: HTMLElement, id: string): void {
  el.draggable = true
  el.addEventListener('dragstart', event => { event.stopPropagation(); event.dataTransfer?.setData(CONSTRUCTOR_DRAG_TYPE, id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy' })
}
function constructorPalette(app: App, ids: string[]): HTMLElement {
  const palette = div('constructor-palette', '')
  for (const item of CONSTRUCTORS.filter(c => ids.includes(c.id))) {
    const b = iconButton(item.id === 'integration' ? 'integration' : item.icon, `Add ${item.label.toLowerCase()}`, () => insertConstructor(app, item.id))
    constructorDrag(b, item.id); palette.append(b)
  }
  return palette
}
function openConstructor(app: App, kind: string, path: Scope = [...app.state.view], replace = false): void {
  if (!CONSTRUCTORS.some(c => c.id === kind) || proposalPreview(app)) return
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  const store = app.state.replica.store, dialog = document.createElement('dialog'), form = document.createElement('form')
  dialog.className = 'import-dialog constructor-dialog'
  const row = path.length ? viewAt(app.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1)) : undefined
  const title = document.createElement('input'); title.setAttribute('aria-label', 'Constructor label'); title.placeholder = 'Label (optional)'; title.value = replace && row?.kind !== 'requirement' ? row?.title ?? '' : ''
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Constructor type')
  const options = kind === 'peer' ? [['invite','Invite'],['direct','Direct connection'],['virtual','Virtual peer'],['fos','Fos server']] : kind === 'integration' ? [...(inTauri() ? [['claude','Claude Agent SDK'], ['codex','Codex SDK']] : []), ['google','Google'],['github','GitHub'],['discord','Discord'],['stripe','Stripe'],['phone','Phone']] : kind === 'repository' ? [...(inTauri() ? [['filesystem', 'Filesystem Git repository']] : []), ['github','GitHub'],['gitlab','GitLab (unavailable)']] : [['inventory','Inventory'],['calendar','Calendar'],['account','Money']]
  for (const [value, label] of options) { const option = new Option(label, value); option.disabled = value === 'gitlab'; select.append(option) }
  if (['inventory','calendar','account'].includes(kind)) select.value = kind
  const amount = document.createElement('input'); amount.type = 'number'; amount.min = '0'; amount.step = 'any'; amount.value = '1'; amount.setAttribute('aria-label', 'Amount')
  const unit = document.createElement('input'); unit.setAttribute('aria-label', 'Unit')
  const repository = document.createElement('input'); repository.placeholder = 'owner/repository'; repository.setAttribute('aria-label', 'Repository'); repository.required = kind === 'repository'
  const bank = document.createElement('select'); bank.setAttribute('aria-label', 'Source bank')
  const start = document.createElement('input'), end = document.createElement('input')
  start.type = end.type = 'datetime-local'; start.setAttribute('aria-label', 'Allocation start'); end.setAttribute('aria-label', 'Allocation end'); start.title = 'Start (optional, local time)'; end.title = 'End (optional, local time)'
  const resource = ['inventory','calendar','account','bank'].includes(kind)
  const update = () => {
    repository.placeholder = select.value === 'filesystem' ? '/path/to/git/checkout' : 'owner/repository'
    unit.value = select.value === 'calendar' ? 'h' : select.value === 'account' ? 'USD' : 'unit'
    start.hidden = end.hidden = kind === 'bank' || !['calendar', 'inventory'].includes(select.value)
    bank.replaceChildren(new Option('Unbound allocation', ''))
    for (const entry of app.banks()) if (entry.row.resource.type === select.value) bank.append(new Option(entry.row.title, entry.row.id))
  }
  select.onchange = update; update()
  const error = div('error', ''), submit = button('primary', replace && row?.kind !== 'requirement' && row?.id !== HOME_ID ? 'Apply constructor' : 'Add child', () => undefined); submit.type = 'submit'
  const field = (text: string, input: HTMLElement) => { const label = document.createElement('label'); label.append(span('', text), input); return label }
  form.append(h4(CONSTRUCTORS.find(c => c.id === kind)!.label), title, field(resource ? 'Resource' : 'Handler', select))
  if (resource) { form.append(field(kind === 'bank' ? 'Capacity' : 'Amount', amount), field('Unit', unit)); if (kind !== 'bank') form.append(field('Source bank', bank), start, end) }
  if (kind === 'repository') form.append(field('Repository', repository))
  form.append(error, submit, button('secondary', 'Cancel', () => dialog.close()))
  form.onsubmit = async event => {
    event.preventDefault()
    try {
      if (app.state.replica.store !== store || proposalPreview(app)) throw new Error('The data session changed. Open the constructor again.')
      const type = select.value as 'inventory' | 'calendar' | 'account', value = Number(amount.value)
      if (resource && (!Number.isFinite(value) || value < 0)) throw new Error('Enter a non-negative amount.')
      const begins = !start.hidden && start.value ? new Date(start.value).getTime() : undefined, ends = !end.hidden && end.value ? new Date(end.value).getTime() : undefined
      if ((begins !== undefined && !Number.isFinite(begins)) || (ends !== undefined && !Number.isFinite(ends)) || (begins !== undefined && ends !== undefined && ends <= begins)) throw new Error('The allocation end must be after its start.')
      if (kind === 'repository' && !['github', 'filesystem'].includes(select.value)) throw new Error('This repository handler is unavailable.')
      const parsed = kind === 'peer' || kind === 'integration' ? { kind: 'plain' as const, text: title.value, done: false, peer: select.value }
        : kind === 'bank' ? { kind: 'resource' as const, text: title.value || 'Resource bank', done: false, extras: { resource: { type, capacity: value, unit: unit.value } } }
        : resource ? { kind: 'allocation' as const, text: title.value, done: false, extras: { allocation: { type, amount: value, unit: unit.value, resource: bank.value, ...(begins !== undefined ? { start: begins } : {}), ...(ends !== undefined ? { end: ends } : {}) } } }
        : { kind: 'plain' as const, text: title.value || repository.value, done: false }
      if (kind === 'repository' && select.value === 'filesystem') {
        submit.disabled = true
        const revision = headCid(app.state.replica)
        const directory = await tauriInvoke<string>('validate_agent_repository', { path: repository.value.trim() })
        if (!directory) throw new Error('Filesystem repositories require the desktop app.')
        if (!dialog.isConnected) return
        if (app.state.replica.store !== store || headCid(app.state.replica) !== revision || proposalPreview(app)) throw new Error('The node changed while validating the path. Try again.')
        app.applyConstructor(path, { ...parsed, peer: 'filesystem' }, replace, undefined, directory)
      } else app.applyConstructor(path, parsed, replace, kind === 'repository' ? repository.value.trim() : undefined)
      dialog.close()
    } catch (e) { error.textContent = e instanceof Error ? e.message : String(e); submit.disabled = false }
  }
  dialog.append(form); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}

function dropTrigger(event: DragEvent, app: App, path: Scope, replace = false): boolean {
  const constructor = event.dataTransfer?.getData(CONSTRUCTOR_DRAG_TYPE)
  if (constructor && (CONSTRUCTORS.some(c => c.id === constructor) || constructor === 'pull' || constructor.startsWith('trigger:') || constructor.startsWith('action:') || constructor.startsWith('handler:'))) { event.preventDefault(); event.stopPropagation(); insertConstructor(app, constructor, path, replace); return true }
  const type = event.dataTransfer?.types.includes('application/x-fos-placeholder') ? event.dataTransfer.getData('application/x-fos-placeholder') : ''
  if (type) { event.preventDefault(); event.stopPropagation(); app.addPlaceholder('value_' + Math.random().toString(36).slice(2, 8), type, path); return true }
  const kind = (event.dataTransfer?.types.includes('application/x-fos-trigger') ? event.dataTransfer.getData('application/x-fos-trigger') : '') as import('../../shared/sync/triggers').TriggerKind | undefined
  if (!kind || !app.triggerKinds(path).includes(kind)) return false
  event.preventDefault(); event.stopPropagation()
  const value = kind === 'timer' ? window.prompt('When? Include a timezone, e.g. 2026-10-15T09:00:00-07:00') : kind === 'cron' ? window.prompt('Five-field UTC cron expression', '0 9 * * *') : ''
  if (value !== null) app.configureTrigger(kind, value, true, path)
  return true
}
function choiceButton(app: App, at: Scope, id: string, choice: number, label: string, absolute = false): HTMLButtonElement {
  const b = button('secondary small', label, () => app.supplyRequirementAt(at, id, { capability: 'choice', choice }, absolute))
  const connection = app.connectionOption([...(absolute ? at : [...app.state.view, ...at]), id], choice)
  if (connection && !connection.enabled) { b.disabled = true; b.title = 'Requires an active Fos server and a configured provider' }
  return b
}
function yamlImportButton(app: App): HTMLElement {
  return button('secondary small', 'Import', () => openImport(app))
}
function openImport(app: App): void {
  const at = [...app.state.view], store = app.state.replica.store
  const dialog = document.createElement('dialog'); dialog.className = 'import-dialog'
  const title = h4('Import'), input = document.createElement('input'); input.type = 'file'; input.accept = '.yaml,.yml,.md,.markdown,text/markdown,application/yaml'; input.setAttribute('aria-label', 'Markdown or YAML file')
  const format = document.createElement('select'); format.setAttribute('aria-label', 'Import format'); format.append(new Option('Detect from file', ''), new Option('Markdown', 'markdown'), new Option('YAML', 'yaml'))
  const error = div('error', '')
  dialog.append(title, format, input, error, button('secondary', 'Cancel', () => dialog.close()))
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return
    try {
      if (file.size > 1024 * 1024) throw new Error('Import up to 1 MB at a time.')
      const text = await file.text()
      if (store !== app.state.replica.store) throw new Error('The data session changed. Open Import again.')
      app.importText(text, format.value || (/\.ya?ml$/i.test(file.name) ? 'yaml' : 'markdown'), at)
      dialog.close()
    } catch (e) { error.textContent = e instanceof Error ? e.message : String(e) }
  }
  dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}
function mediaPicker(app: App, label: string, accept: string, attach = false): HTMLElement {
  const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.hidden = true; input.setAttribute('aria-label', label)
  const box = span('media-input', ''), trigger = iconButton(attach ? 'file' : accept.startsWith('image') ? 'image' : 'video', label, () => { at = [...app.state.view]; store = app.state.replica.store; input.click() })
  let at = [...app.state.view], store = app.state.replica.store
  input.onchange = async () => { const file = input.files?.[0]; if (!file || store !== app.state.replica.store) return; try { if (attach) await app.attachFile(file, at); else await app.inputMedia(file, at) } catch (error) { app.notify('error', String(error)) } finally { input.value = '' } }
  box.append(trigger, input); return box
}

function currentNodeActions(app: App): Action[] {
  const row = app.currentRow()
  return row ? [
    { label: 'Change template', run: () => app.openTemplatePicker(app.state.view) },
    { label: 'Add choice', run: () => app.newBranchAt(app.state.view) },
    { label: 'Link', run: () => void app.copyNodeLink(app.state.view) }
  ] : []
}

function renderNodeContext(el: HTMLElement, state: AppState, app: App): void {
  const prefs = workspace(app), tabs = div('node-tabs', '')
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Node context')
  for (const [tab, icon, label] of [['constructors', '✦', 'Constructors'], ['actions', '▶', 'Node actions'], ['peers', '♙', 'Peers and sharing'], ['integrations', '▦', 'Integrations'], ['device', '▣', 'This device'], ['input', '✎', 'Input / edit'], ['values', 'inventory', 'Node values'], ['utilities', 'utilities', 'Utilities'], ['marketplace', '▦', 'Marketplace']] as const) {
    const b = iconButton(icon, label, () => { prefs.tab = tab; app.refresh() })
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(prefs.tab === tab));
    if (tab === 'peers' || tab === 'integrations') constructorDrag(b, tab === 'peers' ? 'peer' : 'integration')
    tabs.append(b)
  }
  const panel = div('node-context-panel', ''); panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-label', prefs.tab)
  const rows = document.createElement('ul'); rows.className = 'list context-peers'
  if (prefs.tab === 'marketplace') {
    const form = document.createElement('form'), query = document.createElement('input')
    query.placeholder = 'Find a capability…'; query.setAttribute('aria-label', 'Search marketplace'); query.required = true
    const submit = button('secondary', 'Search', () => undefined); submit.type = 'submit'; submit.disabled = !app.isOnline('fos')
    form.append(query, submit)
    form.onsubmit = event => { event.preventDefault(); const id = app.addRowAt([], 'query', query.value, { extras: { query: { market: true } } }); const row = app.currentView()?.tasks.find(r => r.id === id); if (row) void app.runQueryAt([], row) }
    panel.append(span('muted', 'Capabilities published by Fos peers. Private offers remain in their own contexts.'), form)
    if (app.currentRow()?.kind === 'template') panel.append(button('secondary', 'Publish capability to marketplace', () => app.publishCurrentTemplate(true)))
    el.replaceChildren(tabs, panel); return
  }
  if (prefs.tab === 'utilities') { panel.append(constructorPalette(app, ['inventory', 'calendar', 'account', 'bank'])); el.replaceChildren(tabs, panel); return }
  if (prefs.tab === 'input' || prefs.tab === 'values' || prefs.tab === 'constructors' || prefs.tab === 'actions') { el.replaceChildren(tabs); return }
  if (!state.atRoot) rows.append(...renderRootRows(state, app, prefs.tab));
  else panel.append(span('muted', 'Settings and peer constructors are editable child rows below.'))
  panel.append(rows)
  if (prefs.tab === 'peers' || prefs.tab === 'integrations') panel.append(constructorPalette(app, [prefs.tab === 'peers' ? 'peer' : 'integration']))
  panel.append(span('muted', 'Type @{ in a new row to add a peer.'))
  if (prefs.tab === 'integrations') panel.prepend(div('muted', app.isOnline('fos') ? 'Connections are managed by your Fos server. Offers can be overridden for this node and its children.' : 'Requires an active Fos server connection.'))
  if (prefs.tab === 'device' && app.transport()) panel.append(span('muted', `Device syncs ${pathLabel(app.labels().scope)}`))
  if (prefs.tab === 'peers') {
    const spawn = button('secondary small', 'Spawn virtual peer…', () => app.openModal('virtual'))
    spawn.disabled = !app.canSpawnVirtualPeer()
    panel.append(spawn, span('muted', `${app.currentView()?.versions ?? 0} previous versions`))
  }
  const active = document.activeElement as HTMLElement | null
  if (active && el.contains(active) && active.matches('input,select')) return
  el.replaceChildren(tabs, panel)

}
function settingControl(key: string, state: AppState, app: App): HTMLElement {
  const box = div('setting-control', ''); box.dataset.setting = key
  if (key === 'resetHome') box.classList.add('reset-data-row')
  if (key === 'sessions') box.classList.add('data-sessions-row')
  if (key === 'history') box.append(span('muted', `${viewAt(state.replica, [])?.versions ?? 0} previous versions`))
  else if (key === 'name') {
    const input = document.createElement('input'); input.value = app.settingValue<string>('name') ?? state.deviceName; input.setAttribute('aria-label', 'Device name')
    input.onchange = () => app.setDeviceName(input.value); box.append(input)
  } else if (key === 'theme') {
    const input = document.createElement('select'); input.setAttribute('aria-label', 'Device theme')
    for (const value of ['system', 'light', 'dark']) input.append(new Option(value, value))
    input.value = app.settingValue<string>('theme') ?? 'system'
    input.onchange = () => { app.setSetting('theme', input.value); document.documentElement.dataset.theme = input.value; try { localStorage.setItem('fos.device.theme', input.value) } catch {} }; box.append(input)
  } else if (['microphone', 'camera', 'geolocation'].includes(key)) {
    box.append(button('secondary small', `Check ${SETTING_LABELS[key].toLowerCase()} permission`, async () => {
      try { const result = await navigator.permissions.query({ name: key as PermissionName }); app.setSetting(key, result.state) }
      catch { app.notify('info', 'Status unavailable in this browser. Use the browser’s site permissions.') }
    }), span('muted', app.settingValue<string>(key) ?? 'Not checked'))
  } else if (key === 'server' || key === 'direct' || key === 'virtual') {
    const control = button('secondary small', SETTING_LABELS[key], () => key === 'server' ? app.goToAccountPeer() : app.openModal(key as 'direct' | 'virtual'))
    control.disabled = key === 'virtual' && !app.canSpawnVirtualPeer(); box.append(control)
  } else if (key === 'peer') {
    box.append(span('muted', 'Type @{ in a new row to choose a peer handler.'))
  } else if (key === 'invite') {
    const control = button('secondary small', SETTING_LABELS[key], () => void app.startInvite()); control.disabled = state.session?.kind !== 'user'; box.append(control)
  } else if (key === 'phone') {
    const control = button('secondary small', SETTING_LABELS[key], () => void app.connectIntegration('phone')); control.disabled = !state.integrations.find(p => p.id === 'phone')?.configured || !app.isOnline('fos'); box.append(control)
  } else if (key === 'share') box.append(sharingControls(app))
  else if (key === 'export') box.append(button('secondary small', 'Export YAML', () => downloadText('fos-nodes.yaml', app.exportYaml())))
  else if (key === 'import') box.append(yamlImportButton(app))
  else if (key === 'sessions') {
    const input = document.createElement('select'); input.setAttribute('aria-label', 'Saved data session')
    for (const session of app.dataSessions()) input.append(new Option(`${session.owner?.username ?? 'Offline'} · ${session.id.slice(0, 8)}`, session.id))
    input.value = app.activeDataSession()?.id ?? ''; input.onchange = () => app.switchDataSession(input.value)
    box.append(input, span('muted', 'Switching keeps each session’s data separate.'))
  } else if (key === 'resetHome' || key === 'resetAccount') {
    const control = button('danger small', `${SETTING_LABELS[key]}…`, () => {
      if (window.confirm(key === 'resetHome' ? 'Clear the attached node content? This syncs to connected devices. You can undo this during this session.' : 'Clear all account content, including outside this device’s subtree? This syncs to other devices. You can undo this during this session.')) {
        if (key === 'resetHome') app.resetHome(); else void app.resetAccount()
      }
    }); control.disabled = !app.canResetHome() || (key === 'resetAccount' && state.session?.kind !== 'user'); box.append(control)
  }
  box.addEventListener('click', event => event.stopPropagation()); box.addEventListener('keydown', event => event.stopPropagation())
  return box
}
function constructorBody(task: TaskView, state: AppState, app: App, path: Scope = state.view): HTMLElement {
  const box = div('title constructor-body', ''), key = settingKeyFromName(task.construction?.name)
  if (key) {
    box.classList.add('setting-row'); box.append(span('constructor-label', SETTING_LABELS[key] ?? key))
    if (task.construction?.name === app.settingKey(key)) box.append(settingControl(key, state, app))
    else box.append(span('muted', 'Owned by another device'))
  }
  else if (task.construction?.handler) {
    const handler = task.construction.handler
    box.append(span('constructor-label', `@{${handler}}`))
    const run = () => {
      app.goTo(path)
      if (handler === 'invite') void app.startInvite()
      else if (handler === 'direct' || handler === 'virtual') app.openModal(handler)
      else if (handler === 'fos') app.goToAccountPeer()
      else if (['google', 'github', 'discord', 'stripe', 'phone'].includes(handler)) void app.connectIntegration(handler)
      else app.attachNamedPeer(handler)
    }
    const action = button('secondary small', handler === 'invite' ? 'Create invite code' : handler === 'virtual' ? 'Open new tab' : handler === 'peer' ? 'Choose a handler by editing @{…}' : 'Connect', run)
    action.disabled = handler === 'peer'; box.append(action)
    if (handler === 'invite' && state.invite && JSON.stringify(state.invite.scope) === JSON.stringify([...state.replica.meta.scope, ...path.slice(0, -1)])) box.append(codeBox(state.invite.token))
  }
  else if (task.construction?.peerId) {
    const peer = renderRootRows(state, app, 'peers', task.construction.peerId)[0]
    if (peer) { const body = peer.querySelector('.peer-body'); if (body) box.append(...Array.from(body.children)) } else box.append(span('', task.title))
  }
  return box
}
function placeholderForm(app: App): HTMLElement {
  let selected = ''
  const option = (label: string, value: string, group: string) => ({ label, group, drag: { type: 'application/x-fos-placeholder', value }, run: () => {
    selected = value; box.draggable = true; box.title = 'Drag this placeholder onto a row'
    box.querySelector('.combo-trigger > span')!.textContent = label
  } })
  const box = combobox('Placeholder template', 'Choose a placeholder template…', query => [
    option('Text', 'text', 'Types'),
    ...app.allCapabilities().map(cap => option(CAPABILITY_LABEL[cap] ?? cap, cap, 'Types')),
    ...app.searchLocalNodes(query, 'template').map(found => option(found.row.title, 'template:' + found.row.id, 'Templates'))
  ], () => [], 'Search template types, then drag…')
  box.addEventListener('dragstart', event => { if (!selected) return; event.stopPropagation(); event.dataTransfer?.setData('application/x-fos-placeholder', selected); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy' })
  return box
}

const OUTPUT_DRAG_TYPE = 'application/x-fos-output'
const destructuring = new WeakMap<App, Set<string>>()
const NODE_DRAG_TYPE = 'application/x-fos-node'
const details = new WeakMap<HTMLElement, { key: string; store: AppState['replica']['store']; input: HTMLTextAreaElement; baseline: string; draft: { store: AppState['replica']['store']; head: string; path: Scope }; controls: HTMLElement }>()
function renderNodeDetail(el: HTMLElement, state: AppState, app: App): void {
  if (!state.session && JSON.stringify(details.get(el)?.draft.path) === JSON.stringify(state.view) && el.contains(document.activeElement) && document.activeElement?.closest('.account-form')) { const error = el.querySelector('.account-form .error'); if (error) error.textContent = state.loginError ?? ''; return }
  if (el.querySelector('.combo-panel:not([hidden])') || (el.contains(document.activeElement) && document.activeElement?.closest('.row-combobox, .argument-editor, .setting-row'))) return
  const row = app.currentRow()
  el.hidden = false
  const preview = proposalPreview(app)
  const title = preview?.node.name ?? row?.title ?? (state.atRoot ? 'Settings' : 'Home')
  const key = JSON.stringify([state.atRoot, state.view, row?.branches?.selected, preview?.proposal.id])
  let cached = details.get(el)
  if (!cached || cached.key !== key || cached.store !== state.replica.store) {
    const input = document.createElement('textarea'); input.className = 'node-text'; input.rows = 4
    input.setAttribute('aria-label', 'Current node text'); input.value = row?.id === HOME_ID ? '' : title; input.hidden = row?.id === HOME_ID || (!row && !preview); input.readOnly = !!preview || row?.id === HOME_ID
    const controls = div('node-actions', '')
    const entry = { key, store: state.replica.store, input, baseline: title, draft: { store: state.replica.store, head: headCid(state.replica), path: [...state.view] }, controls }
    const save = () => {
      if (entry.input.readOnly || entry.input.value === entry.baseline) return
      const text = entry.input.value; entry.baseline = text
      app.editCurrentText(text, entry.draft)
      entry.draft = { ...entry.draft, head: headCid(app.state.replica) }
    }
    if (row?.construction || row?.template) { input.readOnly = true; input.title = 'Use Change template → Edit template to edit the constructor.' }
    input.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes(CONSTRUCTOR_DRAG_TYPE)) event.preventDefault() })
    input.addEventListener('drop', event => { if (event.dataTransfer?.types.includes(CONSTRUCTOR_DRAG_TYPE)) { save(); dropTrigger(event, app, [...state.view], true) } })
    input.addEventListener('commit-edit', save)
    input.addEventListener('blur', () => { if (!renderDepth) save() })
    input.addEventListener('keydown', event => {
      event.stopPropagation()
      if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !input.readOnly) { event.preventDefault(); save(); app.newBranchAt([...state.view]); return }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); save() }
      if (event.key === 'Escape') { event.preventDefault(); input.value = entry.baseline; input.blur() }
    })
    const search = combobox('Find a node to link', 'Find a node or constructor…', query => [...constructorOptions(app).filter(c => c.label.toLowerCase().includes(query.toLowerCase())).map(c => ({ label: c.label, group: 'Constructors', drag: { type: CONSTRUCTOR_DRAG_TYPE, value: c.id }, run: () => insertConstructor(app, c.id) })), ...(query ? app.searchLocalNodes(query).map(found => ({
      label: `${found.row.title} · ${found.row.kind}`, group: 'Values', disabled: !app.canLinkNode(found.row.id),
      drag: { type: NODE_DRAG_TYPE, value: found.row.id }, run: () => app.linkNode(found.row.id)
    })) : [])], () => [], 'Search nodes or constructors…')
    search.classList.add('node-search')
    const toolbar = div('node-toolbar', '')
    toolbar.append(iconButton('⋯', 'Current node actions', () => app.openContextMenu({ kind: 'node' })))
    toolbar.lastElementChild!.classList.add('more', 'node-menu-button')
    const context = div('node-context', '')
    const values = div('node-values', '')
    const dynamicValues = div('node-values-dynamic', '')
    values.append(placeholderForm(app), dynamicValues)
    const voice = div('', ''); voice.dataset.slot = 'voice'
    const repository = div('', ''); repository.dataset.slot = 'repository'
    const edit = div('node-input', ''); edit.append(div('input-controls', ''), input, voice)
    const suggestions = div('constructor-suggestions', '')
    const panels = div('workspace-panels', ''); panels.append(accordion(app, 'context', 'Constructors and node context', search, suggestions, context, controls, repository, edit, values))
    el.replaceChildren(toolbar, panels)
    details.set(el, entry); cached = entry
  } else if (cached.input.value === cached.baseline) {
    cached.baseline = title; cached.input.value = title
    cached.draft.head = headCid(state.replica)
  }
  const toolbar = el.querySelector<HTMLElement>('.node-toolbar')!
  toolbar.querySelector('.alternative-picker')?.remove()
  if (row?.branches || app.currentView()?.proposals.length) toolbar.append(alternativePicker(app, state.view, row))
  if (preview && workspace(app).tab === 'values') workspace(app).tab = 'peers'
  renderNodeContext(el.querySelector<HTMLElement>('.node-context')!, state, app)
  const proposed = el.querySelector<HTMLElement>('.constructor-suggestions')!
  proposed.hidden = !!preview || workspace(app).tab !== 'constructors'; proposed.replaceChildren(suggestedConstructors(app))
  const controls = cached.controls
  controls.replaceChildren()
  controls.hidden = workspace(app).tab !== 'actions'
  if (!row || row.kind !== 'template' || row.id === HOME_ID) {
    const play = button('evaluate', app.evaluating ? 'Evaluating…' : '▶ Evaluate', () => { cached!.input.dispatchEvent(new window.Event('commit-edit')); void app.evaluateCurrent() })
    play.disabled = app.evaluating; controls.append(play)
  }
  if (row?.kind === 'task') { const generate = button('secondary small', 'Generate subtasks…', () => app.generateSubtasks([])); generate.dataset.capability = 'llm'; generate.disabled = app.subtasksAvailability([]).status !== 'ready'; generate.title = generate.disabled ? 'Requires an active language-model handler' : ''; controls.append(generate) }
  if (row?.requirement?.capability === 'llm') { const work = button('secondary small', 'Context & results', () => app.openWork(state.view.slice(0, -1), row.id, true)); work.dataset.capability = 'llm'; controls.append(work) }
  if (row?.requirement && !row.requirement.satisfied && !insideTemplate(state, state.view)) {
    if (row.requirement.capability === 'confirmation' && state.session) controls.append(button('secondary small', 'Confirm', () => app.supplyRequirementAt(state.view.slice(0, -1), row.id, { capability: 'confirmation' }, true)))
    if (row.requirement.capability === 'choice') for (const [choice, label] of (row.requirement.options ?? []).entries()) controls.append(choiceButton(app, state.view.slice(0, -1), row.id, choice, label, true))
  }
  const edit = el.querySelector<HTMLElement>('.node-input')!
  edit.hidden = workspace(app).tab !== 'input'
  const inputs = edit.querySelector<HTMLElement>('.input-controls')!; inputs.replaceChildren()
  for (const redo of [false, true]) {
    const control = iconButton(redo ? '↪' : '↶', redo ? 'Redo in this node' : 'Undo in this node', () => { document.activeElement?.dispatchEvent(new window.Event('commit-edit')); if (document.activeElement !== cached!.input) cached!.input.dispatchEvent(new window.Event('commit-edit')); app.undoNode(redo) })
    control.disabled = !!preview || !app.canUndoNode(redo); control.onmousedown = e => e.preventDefault(); inputs.append(control)
  }
  if (!preview) {
    inputs.append(mediaPicker(app, 'Picture input', 'image/jpeg,image/png,image/webp'), mediaPicker(app, 'Video input', 'video/mp4,video/webm'), mediaPicker(app, 'Attach file (up to 1 MB)', '', true), yamlImportButton(app))

  }
  if (preview) {
    controls.replaceChildren(span('muted', 'Read-only proposed branch'))
    if (state.view.length) controls.append(button('secondary small', 'Copy to branch…', () => {
      const name = window.prompt('Name for your editable copy', 'alternative')
      if (name && app.copyProposalToBranch(preview.proposal.id, name)) { clearProposal(app); app.refresh() }
    }))
    if (app.canApprove(app.currentView()!) && preview.proposal.status === 'open') controls.append(button('primary small', 'Approve and merge', () => void app.decideProposal(preview.proposal.id, 'approve')), button('danger small', 'Reject', () => void app.decideProposal(preview.proposal.id, 'reject')))
    if (preview.proposal.peerId === state.replica.meta.peerId && preview.proposal.status === 'rejected') controls.append(button('secondary small', 'Discard rejected changes', () => app.discardProposal(preview.proposal.id)))
  }
  if (!preview && row?.kind === 'template') controls.append(button('secondary small', 'Publish capability here', () => app.publishCurrentTemplate()))
  const agents = !preview && desktopAgentControls(app); if (agents) controls.append(agents)
  const integration = app.integrationHandler()
  if (integration && !preview) { const connect = button('secondary small', `Connect ${integration.provider}`, () => void app.connectIntegration(integration.provider)); connect.disabled = !integration.enabled; controls.append(connect) }
  if (row?.construction) controls.append(constructorBody(row, state, app))
  if (!state.session && (row?.construction?.peerId === 'fos' || row?.construction?.handler === 'fos')) { const auth = div('account-form', ''); renderConnect(auth, state, app); controls.append(auth) }
  if (inTauri() && row && app.repositoryInfo() && !localRepository(state.replica, state.view)) controls.append(button('secondary small', 'Attach local checkout…', () => openConstructor(app, 'repository', [...state.view], true)))
  if (row && app.isOnline('integration:github')) controls.append(button('secondary small', 'Connect GitHub repository…', () => { const repo = window.prompt('Repository (owner/name)'); if (repo) app.bindNodeRepository(state.view.slice(0, -1), row.id, repo, true) }))
  inputs.append(button('secondary small', 'Export YAML', () => downloadText('fos-nodes.yaml', app.exportYaml())))
  el.querySelector<HTMLElement>('.node-toolbar')!.hidden = !!preview || !row
  el.querySelector<HTMLElement>('.node-values')!.hidden = !!preview || workspace(app).tab !== 'values'
  const dynamicValues = el.querySelector<HTMLElement>('.node-values-dynamic')!
  dynamicValues.replaceChildren()
  for (const arg of app.placeholders()) {
    const line = div('placeholder-row', '')
    line.append(span('', `${arg.name} · ${arg.type}`), span('muted', insideTemplate(state, state.view) || row?.kind === 'template' ? 'template parameter' : arg.status))
    argumentDrop(line, app, [], arg.id)
    if (arg.type === 'text') line.append(argumentEditor(app, [], arg.id, arg.name, app.textArguments([]).find(a => a.id === arg.id)?.text ?? ''))
    else if (arg.child) line.append(div('argument-child muted', `${arg.child} · ${arg.type} — drop or choose a matching value`))
    else if (arg.status !== 'ready') line.append(button('secondary small', `Create ${arg.type} child`, () => app.createArgumentChild(arg.id)))
    const pick = document.createElement('select'); pick.setAttribute('aria-label', `Bind ${arg.name}`); pick.append(new Option('Choose matching value…', ''))
    for (const candidate of arg.candidates) pick.append(new Option(candidate.label, candidate.cid))
    if (arg.type !== 'text') { const branches = argumentBranchPicker(app, [], arg.id); if (branches) line.append(branches) }
    pick.disabled = !arg.candidates.length; pick.addEventListener('change', () => app.bindPlaceholder(arg.id, pick.value)); line.append(pick); dynamicValues.append(line)
  }
  const trigger = app.currentTrigger(), triggerState = app.currentTriggerState()
  if (trigger) dynamicValues.append(span('muted', `${trigger.kind}: ${trigger.enabled ? 'enabled' : 'paused'}${triggerState ? ' · ' + triggerState.status : ''}${triggerState?.error ? ' — ' + triggerState.error : ''}`), button('secondary small', trigger.enabled ? 'Pause trigger' : 'Enable trigger', () => app.toggleTrigger()))
  if (triggerState && ['failed', 'running'].includes(triggerState.status)) dynamicValues.append(button('secondary small', 'Review / rearm trigger', () => app.retryCurrentTrigger()))
  const record = app.evaluationStatus()
  if (record) controls.append(span('evaluation-status', `Evaluation: ${record.status}${record.error ? ' — ' + record.error : ''}`))
  if (record && !['committed', 'rolled-back'].includes(record.status)) controls.append(button('secondary small', 'Review recovery', () => void app.recoverCurrentEvaluation()))
  const tags = new Set<string>()
  const collect = (path: Scope) => { if (path.length > 64) return; for (const child of viewAt(state.replica, path)?.tasks ?? []) { tags.add(child.requirement?.capability ?? child.allocation?.type ?? child.kind); if (child.childCount) collect([...path, child.id]) } }
  if (preview) {
    const collectPreview = (cid: string, depth: number) => {
      if (depth > 32) return
      for (const child of viewNode(state.replica.store, cid).tasks) {
        tags.add(child.requirement?.capability ?? child.allocation?.type ?? child.kind)
        const nested = child.kind !== 'ref' ? findChild(state.replica.store, cid, child.id) : null
        if (nested) collectPreview(nested, depth + 1)
      }
    }
    collectPreview(preview.cid, 0)
  } else collect(state.view)
  const childToolbar = el.parentElement?.querySelector<HTMLElement>('[data-region="children-toolbar"]')
  if (!childToolbar) return
  const savedSearch = childToolbar.querySelector<HTMLInputElement>('.child-search')
  for (const child of Array.from(childToolbar.children)) if (child !== savedSearch) child.remove()

  const actionTabs = div('node-tabs', ''); actionTabs.setAttribute('role', 'tablist'); actionTabs.setAttribute('aria-label', 'Node action capabilities')
  const availableTabs: Array<[string, string, string]> = [['main', '⌂', 'Main actions']]
  if (row?.kind === 'task' || row?.requirement?.capability === 'llm') availableTabs.push(['llm', '✦', 'Language model actions'])
  if (app.repositoryInfo() || localRepository(state.replica, state.view)) availableTabs.push(['repo', '⑂', 'Repository actions'])
  if (!availableTabs.some(([key]) => key === workspace(app).actionTab)) workspace(app).actionTab = 'main'
  for (const [key, icon, label] of availableTabs) {
    const b = iconButton(icon, label, () => { workspace(app).actionTab = key; app.refresh() }); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(workspace(app).actionTab === key)); actionTabs.append(b)
  }
  for (const control of Array.from(controls.children) as HTMLElement[]) control.hidden = workspace(app).actionTab !== 'main' && control.dataset.capability !== workspace(app).actionTab
  const actionBody = div('node-action-body', '')
  actionBody.setAttribute('role', 'tabpanel'); actionBody.setAttribute('aria-label', 'Selected node actions')
  actionBody.append(...Array.from(controls.childNodes))
  controls.append(actionTabs, actionBody)
  el.querySelector<HTMLElement>('[data-slot="voice"]')!.hidden = !!preview
  el.querySelector<HTMLElement>('[data-slot="repository"]')!.hidden = !!preview || workspace(app).tab !== 'actions' || !['main', 'repo'].includes(workspace(app).actionTab)
  const layouts = div('node-tabs', ''); layouts.setAttribute('role', 'group'); layouts.setAttribute('aria-label', 'Child view')
  for (const [layout, icon, label] of [['tree', '☷', 'Tree view'], ['chat', '☏', 'Chat view'], ['grid', '▦', 'Grid / pin view'], ['queue', '☑', 'Queue view']] as const) {
    const b = iconButton(icon, label, () => { workspace(app).layout = layout; app.refresh() }); b.setAttribute('aria-pressed', String(workspace(app).layout === layout)); layouts.append(b)
  }
  childToolbar.append(layouts)
  let filter = childToolbar.querySelector<HTMLInputElement>('.child-search')
  if (!filter) {
    filter = document.createElement('input'); filter.type = 'search'; filter.className = 'child-search'; filter.placeholder = 'Filter children…'; filter.setAttribute('aria-label', 'Filter children'); filter.value = workspace(app).search
    filter.addEventListener('input', () => { workspace(app).search = filter!.value; app.refresh() }); childToolbar.prepend(filter)
  }
  const suggestions = document.createElement('datalist'); suggestions.id = 'child-filter-options'
  for (const tag of tags) suggestions.append(new Option(`type:${tag}`, `type:${tag}`))
  for (const child of app.currentView()?.tasks ?? []) suggestions.append(new Option(child.title, child.title))
  filter.setAttribute('list', suggestions.id); childToolbar.append(suggestions)

}

const ghostRows = new WeakMap<HTMLElement, { row: HTMLElement; store: AppState['replica']['store']; path: string }>()

function renderTree(el: HTMLElement, node: NodeView, state: AppState, app: App): void {
  if (el.querySelector('.combo-panel:not([hidden])') || (el.contains(document.activeElement) && document.activeElement?.closest('.row-combobox, .argument-editor, .setting-row, .account-form'))) return
  const cached = ghostRows.get(el)
  const path = JSON.stringify(state.view)
  const reuse = cached && cached.store === state.replica.store && cached.path === path && cached.row.parentNode === el
  if (!reuse && !state.selected) focusGhost = true
  const ghost = reuse ? cached.row : renderGhostRow(node, state, app)
  const prefs = workspace(app)
  el.className = `list tree layout-${prefs.layout}`
  const textMatches = (row: TaskView, path: Scope): boolean => matchesSearch(row, prefs.search) || (path.length < 64 && !!viewAt(state.replica, path)?.tasks.some(child => textMatches(child, [...path, child.id])))
  const matches = (row: TaskView): boolean => textMatches(row, [...state.view, row.id])
  node = { ...node, tasks: node.tasks.filter(row => settingKeyFromName(row.construction?.name) !== 'history') }
  const filtered = prefs.search ? { ...node, tasks: node.tasks.filter(matches) } : node
  let rows = renderRows(filtered, [], 0, state, app)
  if (prefs.layout === 'chat' || prefs.layout === 'queue') {
    const entries: Array<{ row: TaskView; at: Scope }> = [], seen = new Set<string>()
    const collect = (node: NodeView, at: Scope) => {
      if (at.length > 64 || seen.size >= 5000) return
      for (const row of node.tasks) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        if ((prefs.layout === 'chat' ? row.kind === 'comment' : row.kind === 'task' && !row.done) && matchesSearch(row, prefs.search)) entries.push({ row, at })
        if (row.childCount) { const child = viewAt(state.replica, [...state.view, ...at, row.id]); if (child) collect(child, [...at, row.id]) }
      }
    }
    collect(node, [])
    entries.sort((a, b) => prefs.layout === 'queue' ? a.at.length - b.at.length : (b.row.author?.time ?? b.row.createdAt) - (a.row.author?.time ?? a.row.createdAt))
    rows = entries.map(({ row, at }, i) => {
      const el = renderRow(row, at, 0, i, entries.length, state, app)
      const label = [...at, row.id].map((id, index) => viewAt(state.replica, [...state.view, ...at.slice(0, index)])?.tasks.find(r => r.id === id)?.title ?? id).map(shortCrumb).join(' › ')
      el.append(button('link chat-path', label, () => app.zoomTo([...at, row.id])))
      return el
    })
    if (!rows.length) {
      const empty = document.createElement('li'); empty.className = 'muted view-empty'
      empty.textContent = prefs.layout === 'chat' ? 'No comments here yet. Write a message to start; tasks remain in Tree and Queue.' : 'No open tasks here.'
      rows.push(empty)
    }
  }
  const preview = proposalPreview(app)
  if (preview) {
    el.className = `list tree layout-${prefs.layout}`
    const renderReadOnly = (cid: string, depth: number, trail: string[] = []): HTMLElement[] => {
      if (depth > 32) return []
      return viewNode(state.replica.store, cid).tasks.flatMap(task => {
        const li = document.createElement('li'); li.className = 'task'; li.style.setProperty('--depth', String(depth)); li.append(span('title', task.title)); li.dataset.depth = String(depth); li.dataset.time = String(task.author?.time ?? task.createdAt)
        if (prefs.layout === 'chat' || prefs.layout === 'queue') { li.style.setProperty('--depth', '0'); li.append(span('chat-path muted', [...trail, task.title].map(shortCrumb).join(' › '))) }
        const nested = task.kind !== 'ref' ? findChild(state.replica.store, cid, task.id) : null
        const descendants = nested ? renderReadOnly(nested, depth + 1, [...trail, task.title]) : []
        const tag = task.requirement?.capability ?? task.allocation?.type ?? task.kind
        const include = (!prefs.search || matchesSearch(task, prefs.search)) && (prefs.layout !== 'chat' || task.kind === 'comment') && (prefs.layout !== 'queue' || task.kind === 'task' && !task.done)
        return [...(include ? [li] : []), ...(prefs.layout === 'tree' || prefs.layout === 'chat' || prefs.layout === 'queue' ? descendants : [])]
      })
    }
    const entries = renderReadOnly(preview.cid, 0)
    if (prefs.layout === 'chat') entries.sort((a,b) => Number(b.dataset.time) - Number(a.dataset.time))
    if (prefs.layout === 'queue') entries.sort((a,b) => Number(a.dataset.depth) - Number(b.dataset.depth))
    el.replaceChildren(...entries); ghostRows.delete(el); focusGhost = false; return
  }
  if (reuse) {
    // Keep the actual draft input attached: replacing it loses focus, text undo and the caret on sync.
    for (const child of Array.from(el.children)) if (child !== ghost && child.parentNode === el) child.remove()
    if (state.atRoot) ghost.before(...rows); else el.append(...rows)
  } else {
    el.replaceChildren(...(state.atRoot ? [...rows, ghost] : [ghost, ...rows]))
    ghostRows.set(el, { row: ghost, store: state.replica.store, path })
  }
  if (focusGhost && !state.selected && !state.modal && !state.contextMenu && !state.menuOpen) {
    focusGhost = false
    const input = ghost.querySelector<HTMLTextAreaElement>('textarea.edit')!
    queueMicrotask(() => {
      const active = document.activeElement
      if (!app.state.selected && input.isConnected && active !== input && (!active || active === document.body || !active.closest('input, textarea, select, button'))) input.focus()
    })
  }
}

/**
 * The blank row at the top of the view: an ordinary-looking row that is not in the replica until something
 * is typed into it. Enter makes it the first row here (with its marker parsed) and opens a new row below;
 * leaving it with text makes the row without moving on; ↓ goes to the first real row.
 */
const lastCreatedRows = new WeakMap<App, { parent: string; id: string }>()
function peerAutocomplete(input: HTMLTextAreaElement, app: App): HTMLElement {
  const handlers = ['invite', 'direct', 'virtual', 'fos', 'google', 'github', 'discord', 'stripe', 'phone']
  return combobox('Peer handler', '', () => [...new Set([...handlers, ...app.knownPeers().map(p => p.name)])].map(name => ({
    label: `@{${name}}`, group: 'Peers', run: () => { input.value = `@{${name}}`; input.dispatchEvent(new window.Event('commit-edit')) }
  })), query => query && !handlers.includes(query) ? [{ label: `Use @{${query}}`, group: 'Peers', run: () => { input.value = `@{${query}}`; input.dispatchEvent(new window.Event('commit-edit')) } }] : [], 'Choose a peer…', input)
}
function insertNewline(event: KeyboardEvent, input: HTMLTextAreaElement): boolean {
  if (event.key !== 'Enter' || !event.altKey) return false
  event.preventDefault(); event.stopPropagation(); input.setRangeText('\n', input.selectionStart, input.selectionEnd, 'end'); input.dispatchEvent(new window.Event('input')); return true
}

function renderGhostRow(node: NodeView, state: AppState, app: App): HTMLElement {
  const li = document.createElement('li')
  li.className = 'task ghost kind-plain'
  li.style.setProperty('--depth', '0')
  const toggle = button('icon toggle', '', () => undefined)
  toggle.disabled = true
  toggle.tabIndex = -1
  const input = document.createElement('textarea')
  input.rows = 1
  input.className = 'edit'
  input.placeholder = window.innerWidth < 640 ? 'New row…' : 'New row… (ctrl + H for tips)'
  void node
  const preview = kindPreview(input)
  input.autocomplete = 'off'
  let committed = false
  /** Make the typed row; null when nothing was typed or the row could not be made (e.g. an allocation with no bank). */
  const store = state.replica.store
  const path = JSON.stringify(state.view)
  const commit = (): string | null => {
    if (app.state.replica.store !== store || JSON.stringify(app.state.view) !== path) return null
    if (committed) return null
    const raw = workspace(app).layout === 'chat' && input.value.trim() ? '// ' + input.value : input.value
    if (!raw.trim()) return null
    committed = true
    const parsed = parseRowInput(raw)
    const created = app.addRowAtTop(parsed)
    if (!created) { committed = false; return null }
    lastCreatedRows.set(app, { parent: path, id: created })
    input.value = ''
    input.dispatchEvent(new window.Event('input'))
    committed = false
    return created
  }
  input.addEventListener('commit-edit', () => commit())
  input.addEventListener('keydown', (e: Event) => {
    const event = e as KeyboardEvent
    if (isHelpKey(event)) { event.preventDefault(); toggleHelp(app); return }
    if (insertNewline(event, input) || indentDraft(event, input)) return
    const k = event.key
    if (historyShortcut(event) !== null && input.value === '') { event.preventDefault(); event.stopPropagation(); runHistory(app, historyShortcut(event)!); return }
    if (k === 'ArrowLeft' && event.altKey) { event.preventDefault(); commit(); focusGhost = true; app.zoomOut(); return }
    if (k === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); const id = commit(); if (id) app.newBranchAt([...state.view, id]); return }
    if (k === 'Tab' && !event.shiftKey && !input.value.trim()) { const last = lastCreatedRows.get(app); if (last?.parent === path) { event.preventDefault(); event.stopPropagation(); focusGhost = false; app.addRowInside([], last.id); return } }
    if (k === 'Enter' && (!event.shiftKey || event.ctrlKey || event.metaKey)) {
      // the typed row becomes the first row here; the blank row stays on top, ready for the next one (no extra blank row below)
      event.preventDefault()
      event.stopPropagation()
      focusGhost = true // Set before commit: adding the first row renders synchronously.
      const created = commit()
      if (created && (event.ctrlKey || event.metaKey) && !event.shiftKey) { const row = app.rowAt([created]); if (row?.kind === 'task') app.toggleTaskAt([], row) }
      if (created && (event.ctrlKey || event.metaKey) && event.shiftKey) { focusGhost = false; app.addRowInside([], created, workspace(app).layout === 'chat' ? 'comment' : 'plain') }
      return
    }
    if (k === 'ArrowDown' && !event.altKey) { event.preventDefault(); event.stopPropagation(); focusGhost = true; const created = commit(); if (!created && node.tasks.length) moveSelection(app, 1); return }
    if (k === 'Escape') { event.preventDefault(); input.value = ''; input.dispatchEvent(new window.Event('input')); input.blur(); return }
    event.stopPropagation()
  })
  input.addEventListener('focus', () => { if (app.state.selected) { focusGhost = true; app.select(null) } })
  input.addEventListener('blur', () => { if (!renderDepth) commit() })
  li.append(span('zoom-dot', ''), span('handle', ''), toggle, input, preview, peerAutocomplete(input, app))
  return li
}

/**
 * A small badge after an editor that says what the typed line is recognized as ("requirement · money 50 USD",
 * "allocation · time 1 h", "task", "bank · fos points"), updated as the text changes; empty for plain text.
 */
/** Tab edits indentation inside a multiline draft; outside a draft it moves the row. */
function indentDraft(event: KeyboardEvent, input: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (event.key !== 'Tab' || !input.value.includes('\n')) return false
  event.preventDefault(); event.stopPropagation()
  const caret = input.selectionStart ?? 0
  const line = input.value.lastIndexOf('\n', caret - 1) + 1
  const remove = event.shiftKey ? (input.value.slice(line).match(/^(?: {1,2}|\t)/)?.[0].length ?? 0) : 0
  input.setRangeText(event.shiftKey ? '' : '  ', line, line + remove, 'preserve')
  input.dispatchEvent(new window.Event('input'))
  return true
}

function kindPreview(input: HTMLInputElement | HTMLTextAreaElement): HTMLElement {
  const badge = span('kind-preview', '')
  const update = () => {
    const text = input.value
    if (input instanceof HTMLTextAreaElement) input.rows = Math.min(16, Math.max(1, text.split('\n').length))
    const what = text.trim() ? describeParsed(parseRowInput(text)) : ''
    badge.textContent = what
    badge.hidden = !what
  }
  input.addEventListener('input', update)
  update()
  return badge
}

/** Open or close the keys/syntax help. */
function toggleHelp(app: App): void {
  if (app.state.modal === 'help') app.closeModal()
  else app.openModal('help')
}

/** Arguments use the same typed ref whether filled by a dropped value or inline text. */
function argumentDrop(el: HTMLElement, app: App, at: Scope, id: string): void {
  el.addEventListener('dragover', event => {
    if (!event.dataTransfer?.types.some(t => t === CONSTRUCTOR_DRAG_TYPE || t === NODE_DRAG_TYPE || t === OUTPUT_DRAG_TYPE) && !drag) return
    event.preventDefault(); event.stopPropagation(); el.classList.add('drop-into')
  })
  el.addEventListener('dragleave', () => el.classList.remove('drop-into'))
  el.addEventListener('drop', event => {
    if (!event.dataTransfer?.types.some(t => t === CONSTRUCTOR_DRAG_TYPE || t === NODE_DRAG_TYPE || t === OUTPUT_DRAG_TYPE) && !drag) return
    event.preventDefault(); event.stopPropagation(); el.classList.remove('drop-into')
    if (dropTrigger(event, app, [...app.state.view, ...at, id])) return
    if (event.dataTransfer?.types.includes(OUTPUT_DRAG_TYPE)) { app.bindOutputArgument(at, id, event.dataTransfer.getData(OUTPUT_DRAG_TYPE)); return }
    app.dropArgument(at, id, event.dataTransfer?.getData(NODE_DRAG_TYPE) || drag?.id || '')
  })
}
function argumentBranchPicker(app: App, at: Scope, id: string): HTMLElement | null {
  const arg = app.placeholders(at).find(p => p.id === id)
  if (!arg?.branches) return null
  const select = document.createElement('select'); select.setAttribute('aria-label', `Value branch for ${arg.name}`)
  for (const [index, name] of arg.branches.names.entries()) select.append(new Option(name.startsWith('value-v') ? `Alternative ${index + 1} · ${name.slice(-8)}` : name, name))
  select.value = arg.branches.selected
  select.addEventListener('change', () => { const name = select.value; select.blur(); app.selectArgumentBranch(at, id, name) })
  return select
}
function argumentEditor(app: App, at: Scope, id: string, name: string, text: string): HTMLElement {
  const panel = div('argument-editor', '')
  argumentDrop(panel, app, at, id)
  const label = span('muted', `${name} · text — drop a matching value or add text below`)
  const input = document.createElement('textarea'); input.className = 'argument-value'; input.rows = 1
  input.value = text; input.placeholder = 'Add text…'; input.setAttribute('aria-label', `Text for ${name}`)
  let baseline = text
  const save = () => { if (input.value !== baseline) { baseline = input.value; app.setTextArgument(at, id, baseline) } }
  input.addEventListener('commit-edit', save)
  input.addEventListener('blur', () => { if (!renderDepth) { save(); queueMicrotask(() => { if (input.isConnected) app.refresh() }) } })
  input.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); save() }
    if (event.key === 'Escape') { input.value = baseline; input.blur() }
  })
  panel.append(label, input); const branches = argumentBranchPicker(app, at, id); if (branches) panel.append(branches); return panel
}

/** Rows for `node`'s tasks (and nested choices) at `depth`; `at` is the path relative to the view. */
function renderRows(node: NodeView, at: Scope, depth: number, state: AppState, app: App): HTMLElement[] {
  const query = workspace(app).search
  const matches = (row: TaskView, path: Scope): boolean => matchesSearch(row, query) || (path.length < 64 && !!viewAt(state.replica, [...state.view, ...path])?.tasks.some(child => matches(child, [...path, child.id])))
  if (query) node = { ...node, tasks: node.tasks.filter(row => matches(row, [...at, row.id])) }
  const rows: HTMLElement[] = []
  for (const arg of app.textArguments(at)) {
    const li = document.createElement('li'); li.className = 'task argument-row'; li.dataset.argument = arg.id; li.style.setProperty('--depth', String(depth))
    li.append(argumentEditor(app, at, arg.id, arg.name, arg.text))
    if (arg.problems.length && !insideTemplate(state, [...state.view, ...at])) li.append(span('blocked-badge', arg.problems.join('; ')))
    rows.push(li)
  }
  node.tasks.forEach((task, index) => {
    rows.push(renderRow(task, at, depth, index, node.tasks.length, state, app))
    const path = [...at, task.id]
    const editingBelow = !!state.selected && state.selected.length > path.length && path.every((id, i) => state.selected![i] === id)
    // Responsive depth limits must not hide the child the user just opened for editing.
    const expanded = editingBelow || (workspace(app).layout === 'tree' && !state.collapsed.includes(task.id) && depth + 1 < maxDepth())
    if (expanded && (task.childCount > 0 || task.childChoices > 0 || app.textArguments(path).length > 0)) {
      const child = viewAt(state.replica, [...state.view, ...at, task.id])
      if (child) {
        child.choices.forEach((choice) => rows.push(renderNestedChoice(choice, [...at, task.id], depth + 1, state, app)))
        rows.push(...renderRows(child, [...at, task.id], depth + 1, state, app))
      }
    }
  })
  if (!at.length) for (const choice of node.choices) {
    const li = document.createElement('li'); li.className = 'task conflict-row'; li.style.setProperty('--depth', String(depth))
    li.append(span('title', choice.subject), span('blocked-badge', 'Conflict'), button('secondary small', 'Resolve', () => { const card = document.querySelector<HTMLElement>(`[data-choice="${choice.id}"]`); card?.scrollIntoView({ block: 'start' }); card?.querySelector<HTMLButtonElement>('button')?.focus() }))
    rows.push(li)
  }
  return rows
}

function renderRow(task: TaskView, at: Scope, depth: number, index: number, siblingCount: number, state: AppState, app: App): HTMLElement {
  const path: Scope = [...at, task.id]
  const selected = !!state.selected && state.selected.length === path.length && state.selected.every((p, i) => path[i] === p)
  const li = document.createElement('li')
  li.className = 'task kind-' + task.kind + (task.done ? ' done' : '') + (task.isLink ? ' linked' : '') + (selected ? ' selected' : '')
  li.style.setProperty('--depth', String(depth))
  if (task.construction) li.classList.add('has-constructor')
  li.draggable = true
  li.tabIndex = 0
  li.dataset.id = task.id
  li.dataset.path = JSON.stringify(path)
  li.classList.toggle('multi-selected', selectedRows(app).paths.has(li.dataset.path))
  // Selecting re-renders the list, which would destroy a row that is being dragged:
  // select on keyboard focus and on click (after any drag has ended), never on mouse-down focus.
  li.addEventListener('focus', () => { if (!selected && !pointerDown) app.select(path) })
  li.addEventListener('mousedown', () => { pointerDown = true })
  li.addEventListener('click', (event) => {
    pointerDown = false
    if ((event.target as HTMLElement).closest('input, textarea, button, .destructure-trigger')) return
    if (!selected) app.select(path)
  })
  li.addEventListener('contextmenu', (event) => { event.preventDefault(); app.select(path); app.openContextMenu({ kind: 'task', at, task }) })

  // --- drag and drop: above / below / into, decided by where the pointer is on the row
  li.addEventListener('dragstart', (event) => {
    // Alt + drag places a reference to this row; Ctrl/⌘ + drag places a copy; plain drag moves it.
    const mode: DragMode = event.altKey ? 'ref' : (event.ctrlKey || event.metaKey) ? 'copy' : 'move'
    drag = { id: task.id, at, mode }
    event.dataTransfer?.setData('text/plain', task.id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = mode === 'move' ? 'move' : 'copyLink'
    li.classList.add('dragging', `drag-${mode}`)
    const tree = li.closest('.tree') as HTMLElement | null
    if (tree) tree.dataset.dragMode = mode
  })
  li.addEventListener('dragend', () => {
    drag = null
    li.classList.remove('dragging', 'drag-move', 'drag-ref', 'drag-copy')
    clearDropMarks(li)
    const tree = li.closest('.tree') as HTMLElement | null
    if (tree) delete tree.dataset.dragMode
  })
  const peerDrag = (event: DragEvent) => !!event.dataTransfer?.types.includes(PEER_DRAG_TYPE)
  li.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types.some(t => [CONSTRUCTOR_DRAG_TYPE, NODE_DRAG_TYPE, OUTPUT_DRAG_TYPE, 'application/x-fos-placeholder', 'application/x-fos-trigger'].includes(t))) { event.preventDefault(); li.classList.add('drop-into'); return }
    if (peerDrag(event)) { event.preventDefault(); li.classList.add('drop-into'); return }
    if (!drag || drag.id === task.id) return
    event.preventDefault()
    // a requirement takes what is dropped on it as a child (an allocation fills it, a template adds its requirements)
    const position = task.kind === 'requirement' ? 'into' : dropPosition(li, event.clientY)
    li.classList.toggle('drop-above', position === 'above')
    li.classList.toggle('drop-below', position === 'below')
    li.classList.toggle('drop-into', position === 'into')
  })
  li.addEventListener('dragleave', () => clearDropMarks(li))
  li.addEventListener('drop', (event) => {
    if (event.dataTransfer?.types.includes(OUTPUT_DRAG_TYPE)) { event.preventDefault(); event.stopPropagation(); clearDropMarks(li); app.linkOutput([...state.view, ...at, task.id], event.dataTransfer.getData(OUTPUT_DRAG_TYPE)); return }
    if (dropTrigger(event, app, [...app.state.view, ...at, task.id], true)) { clearDropMarks(li); return }
    event.preventDefault()
    clearDropMarks(li)
    if (event.dataTransfer?.types.includes(NODE_DRAG_TYPE)) { app.linkNode(event.dataTransfer.getData(NODE_DRAG_TYPE), [...app.state.view, ...at, task.id]); return }
    if (peerDrag(event)) {
      // a peer dropped on a row: the row becomes a group with that peer as a member
      try { const peer = JSON.parse(event.dataTransfer?.getData(PEER_DRAG_TYPE) ?? '') as { id: string; name: string }; if (peer?.id) app.addPeerToRow(at, task.id, peer.id, peer.name) } catch { /* not a peer */ }
      return
    }
    if (!drag || drag.id === task.id) return
    const dragged = app.rowAt([...drag.at, drag.id])
    if (task.kind === 'requirement' && dragged) {
      // onto a requirement: an allocation is supplied to it (it stays in its bank), a template is executed inside it
      // (its requirements show as rows under this one), anything else is moved inside
      if (dragged.kind === 'allocation') { app.supplyRequirementAt(at, task.id, { capability: 'allocation', ref: dragged.id }); drag = null; return }
      if (dragged.kind === 'template') { app.addRowAt([...at, task.id], 'task', dragged.title, { templateName: dragged.title }); drag = null; return }
    }
    const position = task.kind === 'requirement' ? 'into' : dropPosition(li, event.clientY)
    const move: MovePosition = position === 'into' ? { into: task.id } : { relativeTo: task.id, position }
    if (drag.mode === 'ref') app.addRefAt(at, drag.id, move)
    else if (drag.mode === 'copy') app.copyRowAt(drag.at, drag.id, at, move)
    else app.moveTask(drag.at, drag.id, at, move)
    drag = null
  })

  const zoom = button('icon zoom-dot', '◉', () => app.zoomTo(path))
  zoom.title = 'Zoom in (Alt+→)'
  zoom.tabIndex = -1
  const handle = span('handle', '⋮⋮')
  handle.title = 'Drag to move'

  const hasChildren = task.childCount > 0 || task.childChoices > 0 || app.textArguments(path).length > 0
  const canExpandHere = depth + 1 < maxDepth()
  // rows without children show no bullet; notes keep a middot so a note block reads as an item in the outline
  const toggle = hasChildren && !canExpandHere
    ? button('icon toggle zoom', '›', () => app.zoomTo([...at, task.id]))
    : button('icon toggle', hasChildren ? (state.collapsed.includes(task.id) ? '▸' : '▾') : task.kind === 'note' ? '·' : '', () => { if (hasChildren) app.toggleCollapsed(task.id) })
  if (hasChildren && !canExpandHere) toggle.title = `Open (${task.childCount} inside)`
  toggle.disabled = !hasChildren
  toggle.tabIndex = -1

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = task.done
  checkbox.hidden = !task.checkable // a legacy plain node has no completion
  checkbox.disabled = !task.checkable || (!task.done && !!task.blockedBy?.length)
  if (task.blockedBy?.length) checkbox.title = `Needs: ${task.blockedBy.join(', ')}`
  checkbox.tabIndex = -1
  checkbox.addEventListener('change', () => app.toggleTaskAt(at, task))

  let body: HTMLElement
  if (task.id === HOME_ID) { body = span('title home-node', ''); body.innerHTML = iconSvg('⌂')!; body.setAttribute('aria-label', 'Home'); body.title = 'Home' }
  else if (task.construction && !(task.construction.handler && selected)) { body = constructorBody(task, state, app, [...state.view, ...at, task.id]) }
  else if (selected && task.kind !== 'ref' && (!SPECIAL_KINDS.has(task.kind) || editingSpecial === task.id)) {
    body = renderEditor(task, at, state, app)
  } else if (task.kind === 'ref') {
    body = renderRefBody(task, app)
  } else if (task.kind === 'note') {
    body = renderNoteBody(task, at, state, app)
  } else if (SPECIAL_KINDS.has(task.kind)) {
    body = renderSpecialBody(task, at, state, app)
    body.addEventListener('click', (event) => { if ((event.target as HTMLElement).closest('a,button,.destructure-trigger,.destructure-panel')) return; event.stopPropagation(); editingSpecial = task.id; app.select(path); app.refresh() })
  } else {
    body = span('title', '')
    if (task.kind === 'template' && task.id !== HOME_ID) { const b = span('kind-badge tpl', '`template'); b.title = 'Template: the nested rows and arguments inside are copied into every task that executes it ([ ] `name`)'; body.append(b, document.createTextNode(' ')) }
    body.append(renderInlineText(task.title))
    if (task.kind === 'comment') {
      const who = span('author', task.author?.name ? `${task.author.name} · ${new Date(task.author.time).toLocaleString()}` : 'comment')
      body.prepend(who)
    }
    body.title = 'Click to edit'
  }

  const attachment = app.attachment([...state.view, ...at, task.id])
  if (attachment) body.append(button('secondary small', 'Download attachment', () => {
    try {
      const encoded = attachment.data.split(',')[1] ?? '', bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })), a = document.createElement('a'); a.href = url; a.download = attachment.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { app.notify('error', 'This attachment could not be read.') }
  }))
  const templateIcon = app.templateIcon([...state.view, ...at, task.id])
  if (templateIcon) body.prepend(span('template-icon', templateIcon))
  if (task.branches || viewAt(state.replica, [...state.view, ...path])?.proposals.length) body.append(branchSelector(task, at, app))

  const meta = span('row-meta', '')
  const opRef = span('op-icon op-ref', '🔗'); opRef.title = 'Alt + drag: place a reference to this row'
  const opCopy = span('op-icon op-copy', '⧉'); opCopy.title = 'Ctrl + drag: place a copy of this row'
  meta.append(opRef, opCopy)
  if (task.template) { const b = span('kind-badge tpl' + (task.blockedBy?.length ? ' unmet' : ''), `\`${task.template.name}`); b.title = `Executes the template “${task.template.name}”: its nested rows were copied underneath${task.blockedBy?.length ? ` (${task.blockedBy.length} still unmet)` : ''}`; meta.append(b) }
  // allocations under a row show as little tags on it (money, time, things, people)
  if (task.childCount > 0 && task.kind !== 'resource') {
    for (const child of viewAt(state.replica, [...state.view, ...path])?.tasks ?? []) {
      if (child.kind === 'allocation' && child.allocation) { const t = span('alloc-tag', allocationTag(child.allocation)); t.title = `${child.title || 'allocation'}${child.allocation.by ? ` · ${child.allocation.by}` : ''}`; meta.append(t) }
    }
  }
  if (!insideTemplate(state, [...state.view, ...path]) && task.kind === 'requirement' && task.requirement && !task.requirement.satisfied) li.classList.add('unmet')
  if (task.subtreeTasks > 0) meta.append(span('muted', `${task.subtreeDone}/${task.subtreeTasks}`))
  if (task.market) { const b = span('market-badge', '🛒'); b.title = 'Listed on the market: other accounts can find this and propose'; meta.append(b) }
  if (task.blockedBy?.length && !insideTemplate(state, [...state.view, ...path])) { const b = span('blocked-badge', `Needs: ${task.blockedBy.join(', ')}`); b.title = `Needs: ${task.blockedBy.join(', ')}`; meta.append(b) }

  const more = button('icon more', '⋯', () => { app.select(path); app.openContextMenu({ kind: 'task', at, task }) })
  more.title = 'Actions (or right-click)'
  more.tabIndex = -1
  void index; void siblingCount

  li.append(zoom, handle, toggle, checkbox, body, meta, more)
  return li
}

const PEER_DRAG_TYPE = 'application/x-fos-peer'

/** Visible rows in display order, with the relative path of each (rebuilt from the flat DOM list). */
function visibleRows(): Array<{ el: HTMLElement; path: Scope }> {
  const rows = [...document.querySelectorAll<HTMLElement>('.tree .task[data-id]')]
  return rows.map((row, index) => {
    if (row.dataset.path) return { el: row, path: JSON.parse(row.dataset.path) as Scope }
    const path: string[] = [row.dataset.id as string]
    let depth = Number(row.style.getPropertyValue('--depth'))
    for (let i = index - 1; i >= 0 && depth > 0; i--) {
      const d = Number(rows[i]!.style.getPropertyValue('--depth'))
      if (d < depth) { path.unshift(rows[i]!.dataset.id as string); depth = d }
    }
    return { el: row, path }
  })
}

/** Select the row `delta` steps away from the selected one (or the first/last row); ↑ from the first row returns to the blank row at the top. */
function moveSelection(app: App, delta: number): void {
  const rows = visibleRows()
  const sel = app.state.selected
  const index = sel ? rows.findIndex((r) => r.path.join('/') === sel.join('/')) : -1
  if (delta < 0 && index <= 0 && sel) { focusGhost = true; app.select(null); return }
  if (!rows.length) return
  const next = index < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, index + delta))
  app.select(rows[next]!.path)
}

function caretOnEdge(input: HTMLInputElement | HTMLTextAreaElement, edge: 'first' | 'last'): boolean {
  if (input instanceof HTMLInputElement) return true
  const pos = input.selectionStart ?? 0
  const value = input.value
  return edge === 'first' ? !value.slice(0, pos).includes('\n') : !value.slice(pos).includes('\n')
}

/** The selected row's text, editable in place. Keys: ↑/↓ rows, Enter new row below, Ctrl+Enter done (notes: new row),
 *  Ctrl+Shift+Enter row inside, Tab/⇧Tab indent, Alt+↑/↓ move, Alt+→ zoom in, Alt+← zoom out, Backspace on blank deletes, Esc leaves. */
function renderEditor(task: TaskView, at: Scope, state: AppState, app: App): HTMLElement {
  const multiline = task.kind === 'note'
  const input = document.createElement('textarea')
  input.rows = multiline ? Math.min(16, Math.max(2, task.title.split('\n').length + 1)) : 1
  input.className = 'edit'
  // the editor shows the row in its raw marker form ("-$ 50 lunch", "[x] done", "> note"), exactly as it was typed
  const draft = { store: state.replica.store, head: headCid(state.replica), parent: [...state.view, ...at] }
  const raw = task.kind === 'ref' || task.kind === 'supply' ? task.title : rawRowText(task)
  input.value = raw
  input.placeholder = task.kind === 'note' ? '> Markdown…' : task.kind === 'comment' ? '// Comment…' : 'ctrl + H for tips'
  let committed = false
  const commit = () => {
    if (committed) return
    committed = true
    if (editingSpecial === task.id) editingSpecial = null
    if (input.value === raw) { if (!input.value.trim()) app.dropBlankRow(draft.parent, task.id, draft.store); return }
    if (task.kind === 'ref' || task.kind === 'supply') { app.rewriteRowAt(at, task.id, { kind: task.kind, text: input.value, done: task.done }, draft); return }
    // the text is re-parsed whole: the marker decides the kind, the rest its text and data; the row keeps its id and children
    const parsed = parseRowInput(input.value)
    if (parsed.kind === 'plain' && !parsed.text) { if (!task.title.trim() && !task.childCount && !task.childChoices) app.dropBlankRow(draft.parent, task.id, draft.store); else app.rewriteRowAt(at, task.id, { ...parsed, text: ' ' }, draft); return }
    app.rewriteRowAt(at, task.id, parsed, draft)
  }
  const path: Scope = [...at, task.id]
  input.addEventListener('commit-edit', () => commit())
  input.addEventListener('render-commit', () => { if (input.value !== raw && input.value.trim()) commit() })
  input.addEventListener('keydown', (e: Event) => {
    const event = e as KeyboardEvent
    const k = event.key
    if (insertNewline(event, input) || indentDraft(event, input)) return
    if (historyShortcut(event) !== null && input.value === raw) { event.preventDefault(); event.stopPropagation(); runHistory(app, historyShortcut(event)!); return }
    const alt = event.altKey
    const ctrl = event.ctrlKey || event.metaKey
    if (isHelpKey(event)) { event.preventDefault(); commit(); toggleHelp(app); return }
    if (k === 'ArrowUp' && alt) { event.preventDefault(); commit(); app.select(path); app.moveSelected('up'); return }
    if (k === 'ArrowDown' && alt) { event.preventDefault(); commit(); app.select(path); app.moveSelected('down'); return }
    if (k === 'ArrowRight' && alt) { event.preventDefault(); commit(); focusGhost = true; app.zoomTo(path); return }
    if (k === 'ArrowLeft' && alt) { event.preventDefault(); commit(); focusGhost = true; app.zoomOut(); return }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && !alt && !ctrl && !event.shiftKey && input.selectionStart === input.selectionEnd && (k === 'ArrowLeft' ? input.selectionStart === 0 : input.selectionEnd === input.value.length)) { event.preventDefault(); commit(); const collapsed = app.state.collapsed.includes(task.id); if ((k === 'ArrowLeft' && !collapsed) || (k === 'ArrowRight' && collapsed)) app.toggleCollapsed(task.id); return }
    if (k === 'ArrowUp' && !event.shiftKey && caretOnEdge(input, 'first')) { event.preventDefault(); commit(); moveSelection(app, -1); return }
    if (k === 'ArrowDown' && !event.shiftKey && caretOnEdge(input, 'last')) { event.preventDefault(); commit(); moveSelection(app, 1); return }
    if (k === 'Enter' && event.shiftKey && !ctrl) { event.preventDefault(); event.stopPropagation(); commit(); app.newBranchAt([...state.view, ...path]); return }
    if (k === 'Enter' && workspace(app).layout === 'chat' && !event.shiftKey) { event.preventDefault(); commit(); focusGhost = true; app.select(null); app.refresh(); return }
    if (k === 'Enter' && ctrl && event.shiftKey) { event.preventDefault(); commit(); app.addRowInside(at, task.id, workspace(app).layout === 'chat' ? 'comment' : 'plain'); return }
    if (k === 'Enter' && ctrl) { event.preventDefault(); commit(); const current = app.rowAt(path); if (current?.kind === 'task') { app.toggleTaskAt(at, current); app.refresh() } else if (current) app.addRowBelow(at, task.id); return }
    if (k === 'Enter' && !multiline && !event.shiftKey) { event.preventDefault(); commit(); app.addRowBelow(at, task.id); return }
    if (k === 'Tab') { event.preventDefault(); if (input.value.trim()) commit(); else committed = true; app.select(path); app.indentSelected(event.shiftKey); return }
    if (k === 'Backspace' && input.value === '' && (ctrl || !multiline)) { event.preventDefault(); committed = true; moveSelection(app, -1); app.deleteTaskAt(at, task.id); return }
    if (k === 'Backspace' && ctrl && event.shiftKey) { event.preventDefault(); committed = true; moveSelection(app, -1); app.deleteTaskAt(at, task.id); return }
    if (k === 'Escape') { event.preventDefault(); commit(); input.blur(); queueMicrotask(() => { const row = document.querySelector<HTMLElement>(`.tree .task[data-id="${task.id}"]`); if (row) row.focus(); else { focusGhost = true; app.select(null) } }); return }
    if (k === '.' && ctrl) { event.preventDefault(); app.openContextMenu({ kind: 'task', at, task }); return }
    event.stopPropagation()
  })
  input.addEventListener('blur', () => { if (!renderDepth) commit() })
  // keep the focus on the editor when the row is (re)rendered as selected
  queueMicrotask(() => {
    const active = document.activeElement as HTMLElement | null
    if (active?.matches('input,textarea,select') && !active.closest('.tree')) return
    if (input.isConnected && document.activeElement !== input && !state.modal && !state.contextMenu) {
      input.focus()
      const end = input.value.length
      try { input.setSelectionRange(end, end) } catch { /* not all inputs */ }
    }
  })
  // the editor plus a badge saying what the typed line is recognized as
  const wrap = span('title editing', '')
  wrap.append(input, kindPreview(input), peerAutocomplete(input, app))
  return wrap
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').replace(/^#+\s*/, '').slice(0, 60)
}

/** A reference row shows the title of the row it points at and follows it on click. */
function renderRefBody(task: TaskView, app: App): HTMLElement {
  const body = span('title ref', '')
  const arrow = span('ref-arrow', '→')
  if (task.refPeer) {
    body.append(arrow, span('muted', 'Content held by peer ' + task.refPeer.slice(0, 8)))
    body.title = 'Connect directly to the owning peer to receive this node. Fos does not store its content.'
    return body
  }
  if (app.sharedLink(task.id)) {
    body.append(arrow, button('link ref-link', firstLine(task.title) || 'Shared node', () => app.openSharedLink(task.id)))
    return body
  }
  if (task.refOwner) {
    // a market result: the node lives in another account; open it to read it and propose
    const link = button('link ref-link', `🛒 ${firstLine(task.title) || '(untitled)'}`, () => void app.openMarket(task.refOwner!, task.refId ?? '', task.title))
    link.title = `Listed on the market by ${task.refOwner}; click to view and propose`
    body.append(arrow, link, span('muted', ` — ${task.refOwner}`))
    return body
  }
  const target = app.refTarget(task.refId ?? '')
  if (target) {
    const link = button('link ref-link', firstLine(target.row.title) || '(untitled)', () => app.followRef(task.refId ?? ''))
    link.title = `Reference to a ${ROW_KIND_LABEL[target.row.kind].toLowerCase()}; click to go there`
    body.append(arrow, link)
    if (target.row.kind === 'task') body.append(span('muted', target.row.done ? ' (done)' : ''))
  } else {
    body.append(arrow, span('muted', ' (missing reference)'))
  }
  return body
}

/** Direct children of a note (with their sub-rows and resolved refs), for variables. */
function noteChildren(task: TaskView, at: Scope, state: AppState, app: App): NoteChild[] {
  const node = viewAt(state.replica, [...state.view, ...at, task.id])
  if (!node) return []
  return node.tasks.map((row) => {
    const subRows = row.childCount ? viewAt(state.replica, [...state.view, ...at, task.id, row.id])?.tasks ?? [] : []
    if (row.kind !== 'ref') return { row, subRows }
    const target = app.refTarget(row.refId ?? '')
    const targetSub = target && target.row.childCount ? viewAt(state.replica, [...target.path, target.row.id])?.tasks ?? [] : []
    return { row, subRows, refTarget: target ? { row: target.row, subRows: targetSub } : null }
  })
}

/** A note block: markdown with variables expanded; math and diagrams fill in asynchronously. */
function renderNoteBody(task: TaskView, at: Scope, state: AppState, app: App): HTMLElement {
  const body = div('title note-body', '')
  body.title = 'Click or press Enter to edit (Ctrl+Enter saves)'
  const ctx = noteContext(task.title, noteChildren(task, at, state, app))
  const resolve = noteResolver(ctx, [...state.view, ...at, task.id], state)
  const expanded = ctx.body.trim() ? expandNoteText(ctx, resolve) : ''
  if (!expanded) { body.append(span('muted', '(empty note)')); return body }
  const cached = noteHtml.get(expanded)
  if (cached) {
    body.innerHTML = cached
    void hydrateDiagrams(body)
  } else {
    body.textContent = expanded
    void renderMarkdown(expanded).then((html) => {
      noteHtml.set(expanded, html)
      if (body.isConnected) { body.innerHTML = html; void hydrateDiagrams(body) }
    })
  }
  return body
}

function noteResolver(ctx: ReturnType<typeof noteContext>, path: Scope, state: AppState) {
  const store = state.replica.store
  const defaults = Object.entries(ctx.vars).map(([name, variable]) => ({
    name, type: store.primitive.documentField.getId(),
    cid: put(store, { data: { description: { content: Array.isArray(variable.value) ? variable.value.map(v => `- ${v}`).join('\n') : variable.value } }, children: [] })
  }))
  return (name: string) => {
    const resolved = resolveText(state.replica, path, `{{${name}}}`, defaults)
    return resolved.bindings.every(b => b.status === 'ready') ? resolved.text : undefined
  }
}

function expandNoteText(ctx: ReturnType<typeof noteContext>, resolve: (name: string) => string | undefined): string {
  return exportNote(ctx, resolve).replace(/^---\n[\s\S]*?\n---\n\n?/, '')
}

function insideTemplate(state: AppState, fullPath: Scope): boolean {
  return fullPath.some((id, i) => id !== HOME_ID && viewAt(state.replica, fullPath.slice(0, i))?.tasks.some(row => row.id === id && row.kind === 'template'))
}

/** Requirement, supply, query, resource-bank and allocation rows: a kind badge, the text, and a status/balance. */
function outputChips(cid: string, state: AppState, app: App): HTMLElement {
  const box = span('output-chips', '')
  for (const output of requirementOutputs(state.replica.store, cid)) {
    const resolved = resolveRequirementOutput(state.replica.store, output.cid)
    const label = `${output.name}${output.amount !== undefined ? ` · ${output.amount}` : ''}`
    const chip = span('chip output-placeholder', label); chip.draggable = true; chip.tabIndex = 0
    chip.title = resolved?.error ?? 'Drag this placeholder into a constructor or argument'
    chip.setAttribute('aria-label', `${label}: ${resolved?.error ? 'waiting for requirement' : 'ready'}`)
    chip.addEventListener('dragstart', event => { event.stopPropagation(); event.dataTransfer?.setData(OUTPUT_DRAG_TYPE, output.cid); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'link' })
    chip.addEventListener('click', event => event.stopPropagation()); box.append(chip)
  }
  return box
}
function destructurePanel(task: TaskView, at: Scope, state: AppState, app: App): HTMLElement {
  const panel = div('destructure-panel', ''), path = [...state.view, ...at, task.id], req = task.requirement!
  panel.addEventListener('click', event => event.stopPropagation()); panel.addEventListener('keydown', event => event.stopPropagation())
  const cid = resolveScope(state.replica.store, headCid(state.replica), path)!
  if (req.capability === 'choice') panel.append(combobox('Requirement constructors (read-only)', 'Choice constructors', () => (req.options ?? []).map(label => ({ label, group: 'Constructors', disabled: true, run: () => {} })), () => [], 'Inspect constructors…'))
  else { const used = requirementOutputs(state.replica.store, cid).reduce((sum, output) => sum + (output.amount ?? 0), 0); panel.append(span('muted', `${used} / ${req.amount ?? 0} ${req.unit ?? ''} planned · usable after fulfillment`)) }
  const form = document.createElement('form')
  const name = document.createElement('input'); name.placeholder = 'Placeholder name'; name.required = true; name.setAttribute('aria-label', 'Output name')
  const amount = document.createElement('input'); amount.type = 'number'; amount.step = 'any'; amount.min = '0'; amount.placeholder = 'Amount'; amount.setAttribute('aria-label', 'Split amount'); amount.required = req.capability === 'allocation'; amount.hidden = !amount.required
  const add = button('secondary small', req.capability === 'allocation' ? 'Split amount' : 'Expose selected value', () => undefined); add.type = 'submit'
  form.append(name, amount, add); form.onsubmit = event => { event.preventDefault(); app.destructure(path, name.value, req.capability === 'allocation' ? Number(amount.value) : undefined) }
  panel.append(form, outputChips(cid, state, app), button('secondary small', 'Done inspecting', () => { destructuring.get(app)?.delete(task.id); app.refresh() }))
  return panel
}

function renderSpecialBody(task: TaskView, at: Scope, state: AppState, app: App): HTMLElement {
  const body = span('title special', '')
  const badge = (text: string, cls = '') => { const b = span('kind-badge ' + cls, text); body.append(b) }
  const stop = (el: HTMLElement) => { el.addEventListener('click', (e) => e.stopPropagation()); return el }
  if (task.kind === 'requirement' && task.requirement) {
    const r = task.requirement
    const marker: Record<string, string> = { account: '$', calendar: ':', inventory: '#', person: '@' }
    const label = r.capability === 'peer' && r.peer ? `@${r.peer}` : r.capability === 'allocation' ? `${marker[r.resource ?? ''] ?? '$'}${r.amount !== undefined ? ' ' + formatAmount(r.amount, r.unit ?? '') : ''}` : r.capability === 'task' ? '[ ]' : r.capability === 'search' ? '?' : r.capability
    badge(r.satisfied ? '✓ ' + label : '- ' + label, r.satisfied ? 'ok' : insideTemplate(state, [...state.view, ...at, task.id]) ? 'tpl' : 'needs')
    if (r.capability === 'allocation' || r.capability === 'choice') {
      const trigger = body.lastElementChild as HTMLElement
      trigger.classList.add('destructure-trigger'); trigger.tabIndex = 0; trigger.setAttribute('role', 'button'); trigger.title = 'Double-click to destructure'; trigger.setAttribute('aria-label', 'Destructure requirement')
      const open = () => { const set = destructuring.get(app) ?? new Set<string>(); set.add(task.id); destructuring.set(app, set); app.refresh() }
      trigger.addEventListener('click', event => event.stopPropagation()); trigger.addEventListener('dblclick', event => { event.stopPropagation(); open() })
      trigger.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); open() } })
      if (destructuring.get(app)?.has(task.id)) { body.append(destructurePanel(task, at, state, app)); return body }
      const cid = resolveScope(state.replica.store, headCid(state.replica), [...state.view, ...at, task.id])
      if (cid) body.append(outputChips(cid, state, app))
    }
    body.append(document.createTextNode(' ' + task.title))
    if (r.have !== undefined && r.need !== undefined && r.need > 0) {
      // how much of the amount is covered: the green part of the bar
      const bar = span('req-progress', '')
      const fill = span('req-progress-fill', '')
      fill.style.width = `${Math.min(100, Math.round((r.have / r.need) * 100))}%`
      bar.append(fill)
      bar.title = `${formatAmount(r.have, r.unit ?? '')} of ${formatAmount(r.need, r.unit ?? '')} allocated`
      body.append(bar, span('muted req-have', ` ${formatAmount(r.have, r.unit ?? '')} / ${formatAmount(r.need, r.unit ?? '')}`))
    }
    if (r.capability === 'llm') body.append(stop(button('secondary small', 'Context & results', () => app.openWork(at, task.id))))
    if (!r.satisfied) {
      const peers = app.contextPeers()
      const handler = (cap: 'search' | 'market' | 'mail') => app.capabilityAvailable(cap, [...state.view, ...at, task.id]) ? peers.find((p) => p.online && p.capabilities.includes(cap)) : undefined
      const hint = (text: string) => body.append(span('muted req-hint', ' ' + text))
      if (r.capability === 'confirmation') body.append(stop(button('secondary small', state.session ? 'Confirm' : 'Sign in to confirm', () => app.supplyRequirementAt(at, task.id, { capability: 'confirmation' }))))
      if (r.capability === 'choice') (r.options ?? []).forEach((opt, i) => body.append(stop(choiceButton(app, at, task.id, i, opt))))
      if (r.capability === 'task') hint('add a [ ] task inside and check it off')
      if (r.capability === 'search') {
        const fos = handler('search')
        if (fos) body.append(stop(button('secondary small', `Ask ${fos.name} to search`, () => void app.askPeerAt(at, task))))
        else hint('add a ? query inside and run it' + (peers.length ? '' : ' (connect: fos runs searches)'))
      }
      if (r.capability === 'market') {
        const fos = handler('market')
        if (fos) body.append(stop(button('secondary small', 'List on the market', () => void app.askPeerAt(at, task))))
        else hint('connect to your account: fos provides the market')
      }
      if (r.capability === 'mail') {
        const fos = handler('mail')
        const b = button('secondary small', fos ? `Ask ${fos.name} to send` : 'No mail handler', () => void app.askPeerAt(at, task))
        stop(b)
        b.disabled = true
        b.title = 'Mail is registered as a capability of fos, but no handler is wired to it yet'
        if (fos) body.append(b)
      }
      if (r.capability === 'repo') {
        const github = state.integrations.find((p) => p.id === 'github')
        if (github?.connected && app.capabilityAvailable('repo', [...state.view, ...at, task.id])) body.append(stop(button('secondary small', `Open issue${r.repo ? ' in ' + r.repo : ''}`, () => void app.askPeerAt(at, task))))
        else hint('sign in with GitHub (root › GitHub) to open the issue')
      }
      if (r.capability === 'tool') {
        if (r.tool === 'fos.pull') {
          const run = button('secondary small', '▶ Pull', () => void app.askPeerAt(at, task)); run.disabled = app.evaluating || !app.pullPeers().some(p => p.id === r.peer); body.append(stop(run))
        } else if (app.capabilityAvailable('tool', [...state.view, ...at, task.id])) body.append(stop(button('secondary small', `Run${r.tool ? ' ' + r.tool : ''}`, () => void app.askPeerAt(at, task))))
        else hint('sign in: an MCP peer attached above runs it')
      }
      if (r.capability === 'allocation' && (r.resource === 'calendar' || r.resource === 'person') && r.start !== undefined) {
        const google = state.integrations.find((p) => p.id === 'google')
        if (google?.connected && app.capabilityAvailable('calendar', [...state.view, ...at, task.id])) body.append(stop(button('secondary small', 'Add to Google Calendar', () => void app.askPeerAt(at, task))))
      }
      if (r.capability === 'peer') {
        if (r.peer && r.peer === app.actorName()) body.append(stop(button('secondary small', 'Done (confirm)', () => app.supplyRequirementAt(at, task.id, { capability: 'peer' }))))
        else hint(`waiting for ${r.peer ? '@' + r.peer : 'a peer'}`)
      }
      if (r.capability === 'allocation') {
        const options = app.allocations().filter(({ row }) => !r.resource || row.allocation?.type === r.resource)
        const select = document.createElement('select')
        select.className = 'small'
        select.append(new Option(options.length ? 'Supply an existing allocation…' : 'No matching allocation yet', ''))
        for (const { row } of options) select.append(new Option(`${formatAmount(row.allocation!.amount, row.allocation!.unit)} ${row.title}`.trim(), row.id))
        select.addEventListener('change', () => { if (select.value) app.supplyRequirementAt(at, task.id, { capability: 'allocation', ref: select.value }) })
        body.append(stop(select))
        hint(`or type "${marker[r.resource ?? ''] ?? '$'} ${r.amount ?? 'amount'}" inside, or drop an allocation here`)
      }
    }
  } else if (task.kind === 'supply' && task.supply) {
    badge('supplied', 'ok')
    body.append(document.createTextNode(` ${task.title}${task.title.includes(task.supply.by) ? '' : ` · ${task.supply.by}`}`))
    if (task.supply.ref) { const t = app.refTarget(task.supply.ref); if (t) body.append(stop(button('link small', firstLine(t.row.title) || t.row.kind, () => app.followRef(task.supply!.ref!)))) }
  } else if (task.kind === 'query') {
    badge('?' + (task.query?.market ? ' market' : ''), 'query')
    body.append(document.createTextNode(' ' + task.title + ' '))
    body.append(stop(button('secondary small', task.query?.executedAt ? 'Refresh' : 'Search', () => void app.runQueryAt(at, task))))
  } else if (task.kind === 'resource' && task.resource) {
    badge(task.resource.type, 'bank')
    body.append(document.createTextNode(' ' + task.title + ' '))
    const r = task.resource
    body.append(span('muted', r.capacity === undefined ? `${formatAmount(r.allocated, r.unit)} allocated` : `${formatAmount(r.available ?? 0, r.unit)} of ${formatAmount(r.capacity, r.unit)} available`))
  } else if (task.kind === 'allocation' && task.allocation) {
    const a = task.allocation
    badge('+' + formatAmount(a.amount, a.unit), 'alloc')
    const when = a.start ? ` ${new Date(a.start).toLocaleDateString()}${a.end ? '–' + new Date(a.end).toLocaleDateString() : ''}` : ''
    body.append(document.createTextNode(` ${task.title}${when}${a.by ? ` · ${a.by}` : ''}`))
  }
  body.title = 'Click (or Enter) to edit the text'
  return body
}

function renderNestedChoice(choice: ChoiceView, at: Scope, depth: number, state: AppState, app: App): HTMLElement {
  const li = document.createElement('li')
  li.className = 'task nested-choice'
  li.style.setProperty('--depth', String(depth))
  const card = renderChoiceCard(choice, state, (index) => app.resolveChoiceAt(at, choice.id, index))
  li.append(card)
  return li
}

type Action = { label: string; keys?: string; run: () => void; danger?: boolean; disabled?: boolean }

function taskActions(at: Scope, task: TaskView, app: App): Action[] {
  const path = [...app.state.view, ...at, task.id]
  return [
    { label: 'Change template', run: () => app.openTemplatePicker(path) },
    { label: 'Add choice', keys: 'Shift+Enter', run: () => app.newBranchAt(path) },
    { label: 'Link', run: () => void app.copyNodeLink(path) }
  ]
}

function renderContextMenu(el: HTMLElement, state: AppState, app: App): void {
  const menu = state.contextMenu
  el.hidden = !menu
  if (!menu) { el.replaceChildren(); return }
  const actions: Action[] = menu.kind === 'node' ? currentNodeActions(app) : menu.kind === 'task'
    ? taskActions(menu.at, app.rowAt([...menu.at, menu.task.id]) ?? menu.task, app)
    : []
  const items: HTMLElement[] = actions.map(a => {
    const b = button('menu-item', a.label, () => { app.closeContextMenu(); a.run() })
    if (a.keys) b.append(span('key-hint', a.keys))
    b.disabled = !!a.disabled
    return b
  })
  el.replaceChildren(...items)
  // place next to the selected row (or the peers list)
  const anchor = menu.kind === 'node' ? document.querySelector<HTMLElement>('.node-menu-button') : menu.kind === 'task'
    ? (document.querySelector(`.tree .task[data-id="${menu.task.id}"] .more`) as HTMLElement | null)
    : (document.querySelector(`.peer-row[data-peer="${menu.peerId}"] .more`) as HTMLElement | null)
  const rect = anchor?.getBoundingClientRect()
  el.style.top = `${Math.max(8, Math.min(rect ? rect.bottom + 4 : 80, window.innerHeight - Math.min(el.scrollHeight, window.innerHeight * .7) - 8))}px`
  el.style.right = `${Math.max(8, window.innerWidth - (rect ? rect.right : window.innerWidth - 16))}px`
}

function historyShortcut(event: KeyboardEvent): boolean | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  return key === 'z' ? event.shiftKey : key === 'y' && !event.shiftKey ? true : null
}

function runHistory(app: App, redo: boolean): void {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  focusGhost = true
  if (redo) app.redo(); else app.undo()
}

function handleKey(event: KeyboardEvent, app: App): void {
  if (isHelpKey(event)) { event.preventDefault(); toggleHelp(app); return }
  const target = event.target as HTMLElement | null
  if (target && target.closest('input, textarea, select, [contenteditable]')) return
  if (proposalPreview(app) && !app.state.modal) { if (event.key === 'Escape') { clearProposal(app); app.refresh() } else if (event.ctrlKey || event.metaKey || event.key === 'Enter' || event.key === 'Delete' || event.key === 'Backspace') event.preventDefault(); return }
  if (!app.state.modal && historyShortcut(event) !== null) { event.preventDefault(); runHistory(app, historyShortcut(event)!); return }
  if (app.state.modal) { if (event.key === 'Escape') app.closeModal(); return }
  if (event.key === 'Escape') { const menu = app.state.contextMenu; app.closeContextMenu(); app.toggleMenu(false); if (menu?.kind === 'task') queueMicrotask(() => document.querySelector<HTMLElement>(`.task[data-id="${menu.task.id}"]`)?.focus()); return }
  const state = app.state
  const node = app.currentView()
  if (!node) return
  // flat list of visible rows in display order, for ↑/↓
  const rows = [...document.querySelectorAll<HTMLElement>('.tree .task[data-id]')]
  const sel = state.selected
  const selectedIndex = sel ? rows.findIndex((r) => r.dataset.id === sel[sel.length - 1]) : -1
  const pathOf = (row: HTMLElement): Scope => {
    // rebuild the relative path from the DOM: walk back to shallower rows
    const path: string[] = [row.dataset.id as string]
    let depth = Number(row.style.getPropertyValue('--depth'))
    for (let i = rows.indexOf(row) - 1; i >= 0 && depth > 0; i--) {
      const d = Number(rows[i]!.style.getPropertyValue('--depth'))
      if (d < depth) { path.unshift(rows[i]!.dataset.id as string); depth = d }
    }
    return path
  }
  const focusRow = (i: number) => { const r = rows[i]; if (r) { app.select(pathOf(r)); r.focus() } }

  if (event.key === 'ArrowDown' && !event.altKey) { event.preventDefault(); moveSelection(app, 1); return }
  if (event.key === 'ArrowUp' && !event.altKey) { event.preventDefault(); moveSelection(app, -1); return }
  void focusRow
  if (!sel || selectedIndex < 0) {
    if (event.key === 'Backspace' || (event.key === 'ArrowLeft' && event.altKey)) { event.preventDefault(); focusGhost = true; app.zoomOut() }
    return
  }
  const at = sel.slice(0, -1)
  const id = sel[sel.length - 1] as string
  const task = (viewAt(state.replica, [...state.view, ...at])?.tasks ?? []).find((t) => t.id === id)
  if (!task) return
  const alt = event.altKey
  switch (true) {
    case event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey:
      event.preventDefault(); app.addRowInside(at, task.id); break
    case event.key === 'Enter' && (event.ctrlKey || event.metaKey):
      event.preventDefault(); if (task.kind === 'task') app.toggleTaskAt(at, task); else app.addRowBelow(at, task.id); break
    case event.key === 'Enter' && SPECIAL_KINDS.has(task.kind):
      event.preventDefault(); editingSpecial = task.id; app.refresh(); break
    case event.key === 'Enter':
      event.preventDefault(); app.addRowBelow(at, task.id); break
    case event.key === 'Tab':
      event.preventDefault(); app.indentSelected(event.shiftKey); break
    case event.key === 'ArrowRight' && !alt:
      event.preventDefault(); if (state.collapsed.includes(task.id)) app.toggleCollapsed(task.id); break
    case event.key === 'ArrowLeft' && !alt:
      event.preventDefault(); if (!state.collapsed.includes(task.id) && (task.childCount || task.childChoices)) app.toggleCollapsed(task.id); break
    case event.key === 'ArrowUp' && alt:
      event.preventDefault(); app.moveSelected('up'); break
    case event.key === 'ArrowDown' && alt:
      event.preventDefault(); app.moveSelected('down'); break
    case event.key === 'ArrowRight' && alt:
      event.preventDefault(); focusGhost = true; app.zoomTo([...at, task.id]); break
    case event.key === 'ArrowLeft' && alt:
      event.preventDefault(); focusGhost = true; app.zoomOut(); break
    case event.key === 'Backspace' && (event.ctrlKey || event.metaKey) && event.shiftKey:
      event.preventDefault(); app.deleteTaskAt(at, task.id); break
    case event.key === 'Backspace':
      event.preventDefault(); focusGhost = true; app.zoomOut(); break
    case event.key === '.' || (event.key === 'F10' && event.shiftKey):
      event.preventDefault(); app.openContextMenu({ kind: 'task', at, task }); break
  }
}

function dropPosition(row: HTMLElement, clientY: number): 'above' | 'below' | 'into' {
  const rect = row.getBoundingClientRect()
  const y = (clientY - rect.top) / Math.max(rect.height, 1)
  return y < 0.25 ? 'above' : y > 0.75 ? 'below' : 'into'
}

function clearDropMarks(row: HTMLElement): void {
  row.classList.remove('drop-above', 'drop-below', 'drop-into')
}

// ---------------------------------------------------------------------------
// Peer connection controls

/**
 * Settings at the device's root: one row per peer this device reaches, including the fos
 * account server (sign-in happens on its row when not connected; its policy lines below it) and the members and
 * attached devices of the Home node, with the capability rows the owner exposes to each (`to`) and accepts from each
 * (`from`). Constructors beneath the root use the ordinary row editor.
 */
function renderRootRows(state: AppState, app: App, mode: 'peers' | 'integrations' | 'device', onlyPeer?: string): HTMLElement[] {
  const rows: HTMLElement[] = []
  const rowShell = (cls: string): HTMLLIElement => {
    const li = document.createElement('li')
    li.className = 'task root-row ' + cls
    li.style.setProperty('--depth', '0')
    return li
  }
  const peers = app.contextPeers().filter(p => onlyPeer ? p.id === onlyPeer || (onlyPeer === 'fos' && p.name === 'fos') : mode === 'integrations' ? !!(p.integration || p.mcp) : mode === 'device' ? p.id === state.replica.meta.peerId : !(p.integration || p.mcp) && p.id !== state.replica.meta.peerId)
  const owner = app.canApprove()
  const capTitle: Record<string, string> = {
    read: 'May read the content of the node',
    'read-requests': 'May read the requests (proposals) addressed to it',
    edit: 'May submit proposals on this node (and send rows here, e.g. an allocation bin)',
    approve: 'May merge proposals on this node',
    autopush: 'Changes flow automatically on sync (merged), not only as explicit proposals',
    direct: 'Reachable device to device (WebRTC)',
    http: 'Reachable over HTTP (through a server)',
    ws: 'Reachable over WebSockets (through a server)',
    relay: 'Relays messages for peers that cannot reach each other',
    search: 'Runs "-? …" requirements: a query inside them, results as reference rows',
    market: 'Lists tasks with "-market" requirements and brings back proposals',
    mail: 'Registered, no handler wired yet'
  }
  /** One direction of a peer row as chips; with `change` they are editable (click switches off/on, × removes, a select adds). */
  const chips = (list: Capability[], off: Capability[], online: boolean, change: ((next: Capability[], nextOff: Capability[]) => void) | null, lockedNote?: string): HTMLElement[] => {
    const out: HTMLElement[] = []
    for (const cap of list) {
      const isOff = off.includes(cap)
      const chip = span('chip cap-chip' + (online && !isOff ? '' : ' off') + (isOff ? ' disabled' : ''), CAPABILITY_LABEL[cap] ?? cap)
      chip.title = `${capTitle[cap] ?? cap}${isOff ? ' (switched off)' : online ? '' : ' (offline)'}${change ? ' · click to switch ' + (isOff ? 'on' : 'off') : lockedNote ? ` · ${lockedNote}` : ''}`
      if (change) {
        chip.classList.add('editable')
        chip.addEventListener('click', () => change(list, isOff ? off.filter((c) => c !== cap) : [...off, cap]))
        const x = button('icon cap-remove', '×', () => change(list.filter((c) => c !== cap), off.filter((c) => c !== cap)))
        x.title = `Remove ${CAPABILITY_LABEL[cap] ?? cap}`
        chip.append(x)
      }
      out.push(chip)
    }
    if (!list.length) out.push(span('muted', 'nothing'))
    if (change) {
      const missing = app.allCapabilities().filter((c) => !list.includes(c))
      if (missing.length) {
        const add = document.createElement('select')
        add.className = 'small cap-add'
        add.append(new Option('+ add', ''))
        for (const c of missing) add.append(new Option(CAPABILITY_LABEL[c] ?? c, c))
        add.addEventListener('change', () => { if (add.value) change([...list, add.value as Capability], off) })
        out.push(add)
      }
    }
    return out
  }
  const direction = (label: string, title: string, els: HTMLElement[]): HTMLElement => {
    const line = div('cap-direction', '')
    const l = span('muted cap-dir-label', label)
    l.title = title
    line.append(l, ...els)
    return line
  }
  for (const p of peers) {
    const li = rowShell('peer')
    li.dataset.peer = p.id
    const dot = span('presence' + (p.online ? ' online' : ''), '')
    dot.title = p.online ? 'online' : p.isAccount ? 'offline: what it registered shows as offline until it connects again' : 'offline (still a member; its capabilities show as offline)'
    const title = span('title peer-title', '')
    if (!p.isAccount && !p.integration && !p.mcp) title.append(span('muted small', `${p.id.slice(0, 8)} · `))
    title.append(span('peer-name', p.isAccount || p.member ? `@${p.name}` : p.integration || p.mcp ? p.name : peerLabel(p.id, state)))
    if (p.isAccount && !state.session) title.append(button('primary small', 'Sign in', () => app.goToAccountPeer()), span('muted', ' not connected: sign in to sync with your account and use its services'))
    if (p.isAccount && p.policy && state.session && !state.virtual) title.append(button('link small', 'Disconnect (keep data)', () => app.disconnect()))
    if (p.isAccount && p.points !== null && p.points !== undefined) { const pts = span('alloc-tag points', `✦ ${p.points} fos points`); pts.title = 'The account\'s balance: the default pool for "ff" allocations'; title.append(pts) }
    const connection = div('peer-connection', '')
    if (p.integration) {
      const i = p.integration
      connection.append(span('muted', `${i.kind === 'oauth' ? 'OAuth' : i.kind === 'channel' ? 'SMS' : 'Account'} connection: `))
      if (i.kind === 'platform') {
        connection.append(span('muted', i.connected ? ` set up on the account${i.accountName ? ` (${i.accountName})` : ''}` : ' not set up on the account (subscription or payouts)'))
      } else if (i.connected) {
        connection.append(span('muted', ` ${i.accountName ?? 'connected'}`), button('link small', 'Disconnect', () => void app.disconnectIntegration(p.id.replace(/^integration:/, ''))))
      } else if (i.kind === 'channel') {
        const link = button('secondary small', i.pending ? 'Enter the code' : 'Link phone', () => void app.connectIntegration('phone'))
        link.title = i.configured ? 'Receive SMS notifications about proposals' : 'Texting is not configured on the server (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)'
        link.disabled = !i.configured
        connection.append(link, span('muted', i.pending ? ` ${i.accountName ?? ''}: waiting for the code` : ' not linked'))
      } else {
        const connect = button('secondary small', `Sign in with ${p.name}`, () => void app.connectIntegration(p.id.replace(/^integration:/, '')))
        connect.disabled = !i.configured || !state.session
        connect.title = !state.session ? 'Sign in to your fos account first' : i.configured ? `Opens ${p.name}'s sign-in; you come back here connected` : `${p.name} sign-in is not configured on the server (client id and secret)`
        connection.append(connect, span('muted', ' not connected'))
      }
    }
    if (p.mcp) {
      const attach = button('secondary small', state.view.length ? 'Attach here' : 'Attach to Home', () => void app.attachMcpPeer(p.mcp!.serverId))
      attach.title = 'Becomes a member of the node and runs its tools for "-tool name …" requirements under it'
      title.append(attach, span('muted', ` tools: ${p.mcp.tools.join(', ') || 'none advertised'}`))
    }
    const lines = div('peer-lines', '')
    if (p.isAccount && p.policy) {
      const policy = p.policy
      const locked = p.policyLocked ? 'set in fos.config.toml ([server] to / from)' : undefined
      const change = p.policyLocked ? null : (next: PeerPolicy) => app.setServerPolicy(next)
      lines.append(direction('offers:', `What @${p.name} registered with this device`, chips(p.capabilities, [], p.online, null)))
      lines.append(direction(`to @${p.name}:`, 'What leaves this device: read lets it serve our content, autopush sends local changes on every sync, submit proposals allows explicit sends; without autopush nothing but the connection leaves', chips(policy.to, [], true, change ? (next) => change({ ...policy, to: next }) : null, locked)))
      lines.append(direction(`from @${p.name}:`, 'What this device takes in: read pulls our node, read requests shows proposals addressed to us, autopush merges its changes in, relay/search/market/mail use its services', chips(policy.from, [], p.online, change ? (next) => change({ ...policy, from: next }) : null, locked)))
    } else if (p.member) {
      const change = owner ? (next: Capability[], off: Capability[]) => app.setPeerCapabilities(p.id, next, off, p.accepts) : null
      const changeFrom = owner ? (next: Capability[]) => app.setPeerCapabilities(p.id, p.capabilities, p.disabled, next) : null
      lines.append(direction(`to @${p.name}:`, 'What Home exposes to the peer (the rows it will see)', chips(p.capabilities, p.disabled, p.online, change)))
      lines.append(direction(`from @${p.name}:`, 'What Home accepts from the peer (nothing it does not list reaches us; we query for the rest)', chips(p.accepts, [], p.online, changeFrom)))
    } else if (p.integration) {
      lines.append(direction('provides:', `What ${p.name} hands to the tree (handlers for the matching requirements)`, chips(p.integration.provides, [], p.online, null, p.online ? undefined : 'available once connected')))
      lines.append(direction('consumes:', `What ${p.name} reads from or does to the tree`, chips(p.integration.consumes, [], p.online, null, p.online ? undefined : 'available once connected')))
    } else if (p.mcp) {
      lines.append(direction('to it:', 'What an attached node exposes to the MCP peer', chips(p.capabilities, [], true, null)))
    } else if (p.capabilities.length) {
      lines.append(direction('offers:', 'How this device can reach the peer', chips(p.capabilities, [], p.online, null)))
    }
    const offers = p.name === 'fos' ? p.capabilities : p.integration ? p.integration.provides : p.accepts
    if (offers.length) lines.append(direction('available here:', 'Handlers available to this node and its children. Overrides inherit until another node overrides them.', offers.map(cap => {
      const b = button('chip cap-chip' + (p.disabled.includes(cap) || !p.online ? ' off' : ''), CAPABILITY_LABEL[cap] ?? cap, () => app.setPeerOffers(p.name === 'fos' ? 'fos' : p.id, [cap], p.disabled.includes(cap)))
      if (cap === 'persist' && p.name === 'fos') b.title = 'Disabling Fos storage pauses account replication of this entire attached group and its history. Direct device replication remains available. Re-enabling does not release excluded history; use a separate data session for server-synced content.'
      b.disabled = !owner; b.setAttribute('aria-pressed', String(!p.disabled.includes(cap))); return b
    })))
    const customOffers = app.handlerOffers().filter(o => o.peerId === p.id && !o.capability)
    if (customOffers.length) lines.append(direction('capabilities:', 'Published typed handlers; toggles apply to this context and its children.', customOffers.map(offer => {
      const b = button('chip cap-chip' + (!offer.enabled || !offer.active ? ' off' : ''), offer.label, () => app.toggleHandler(offer.peerId, offer.id, !offer.enabled))
      b.disabled = !owner; b.setAttribute('aria-pressed', String(offer.enabled)); return b
    })))
    const meta = span('row-meta', '')
    if (p.member && owner) { const remove = button('icon more small-icon', '×', () => app.removePeerHere(p.id)); remove.title = `Remove @${p.name} from Home`; meta.append(remove) }
    else if (state.session?.kind === 'user' && !p.isAccount && !p.member && !p.integration && !p.mcp && p.id !== state.replica.meta.peerId) { const more = button('icon more small-icon', '⋯', () => app.openContextMenu({ kind: 'peer', peerId: p.id })); more.title = 'Device actions'; meta.append(more) }
    const body = div('peer-body', '')
    const details = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = 'Connection and capabilities'
    details.append(summary, connection, lines)
    details.className = 'peer-details'
    const prefs = workspace(app); details.open = prefs.open[`peer:${p.id}`] ?? false
    details.addEventListener('toggle', () => { prefs.open[`peer:${p.id}`] = details.open })
    body.append(title, details)
    li.append(span('zoom-dot', ''), span('handle', ''), dot, body, meta)
    rows.push(li)
  }
  return rows
}

function renderFooter(el: HTMLElement, state: AppState, app: App): void {
  const items: HTMLElement[] = []
  if (state.virtual) items.push(div('muted', `${state.virtual.name} · virtual peer of ${state.virtual.hostName}${state.virtual.capabilities.includes('read') && !state.virtual.capabilities.includes('edit') ? ' · read-only (local edits stay here)' : ''}`))
  if (state.notice) items.push(div(`notice ${state.notice.kind}`, state.notice.text))
  const meta = div('meta', '')
  if (state.session) meta.append(span('muted', `${state.session.username}${state.session.kind === 'peer' ? ' (invited)' : ''}`))
  items.push(meta, legalLinks(''))
  el.replaceChildren(...items)
}

// ---------------------------------------------------------------------------
// Modals

function renderModal(el: HTMLElement, state: AppState, app: App): void {
  const kind = state.modal
  el.hidden = kind === null
  if (!kind) {
    el.replaceChildren()
    lastModalKey = ''
    void stopScanner()
    return
  }
  // Keep typed input while the same modal re-renders for unrelated state changes.
  const key = modalKey(state)
  if (key === lastModalKey && el.firstElementChild) {
    updateModalDynamic(el, state, app)
    return
  }
  lastModalKey = key
  void stopScanner()

  const card = document.createElement('div')
  card.className = 'modal' + ((kind === 'help' || kind === 'work') ? ' wide' : '')
  const header = document.createElement('div')
  header.className = 'modal-header'
  header.append(span('modal-title', modalTitle(kind)), button('icon', '×', () => app.closeModal()))
  card.append(header)
  const body = div('modal-body', '')
  if (kind === 'template') renderTemplatePicker(body, state, app)
  if (kind === 'connect') renderConnect(body, state, app)
  if (kind === 'invite') renderInvite(body, state, app)
  if (kind === 'requests') renderRequests(body, state, app)
  if (kind === 'virtual') renderVirtual(body, state, app)
  if (kind === 'direct') renderDirect(body, state, app)
  if (kind === 'device') renderDevice(body, state, app)
  if (kind === 'market') renderMarket(body, state, app)
  if (kind === 'help') renderHelp(body)
  if (kind === 'work') renderWork(body, state, app)
  if (kind === 'phone') renderPhone(body, state, app)
  card.append(body)
  el.replaceChildren(card)
}

function renderTemplatePicker(body: HTMLElement, state: AppState, app: App): void {
  const common = div('template-buttons', '')
  for (const [kind, icon, label] of [['plain', '≡', 'Record'], ['task', '☑', 'Task'], ['note', 'note', 'Note'], ['comment', 'comment', 'Comment'], ['requirement', '⑂', 'Requirement'], ['allocation', 'money', 'Allocation'], ['resource', 'inventory', 'Resource bank'], ['template', '✦', 'Template']] as const) {
    common.append(iconButton(icon, label, () => app.changeTemplate(kind)))
  }
  body.append(common, combobox('Choose template', 'Find a template…', query => app.searchLocalNodes(query, 'template').filter(found => JSON.stringify(found.path) !== JSON.stringify(state.templatePicker?.path)).map(found => ({ label: found.row.title, group: 'Templates', run: () => app.changeTemplate('plain', found.row.id) })), () => [], 'Search templates…'))
  const form = document.createElement('form'); form.className = 'new-template-form'
  const name = document.createElement('input'); name.placeholder = 'Name (optional)'; name.setAttribute('aria-label', 'New template name')
  const icon = document.createElement('input'); icon.placeholder = 'Icon (optional)'; icon.setAttribute('aria-label', 'New template icon'); icon.maxLength = 16
  const home = document.createElement('input'); home.type = 'checkbox'; home.id = 'template-in-home'
  const label = document.createElement('label'); label.htmlFor = home.id; label.append(home, document.createTextNode('Put in Home'))
  const create = iconButton('+', 'Create linked template', () => undefined); create.type = 'submit'
  form.append(name, icon, label, create); form.onsubmit = event => { event.preventDefault(); app.createLinkedTemplate(name.value, icon.value, home.checked) }
  form.append(iconButton('✎', 'Edit template', () => app.editLinkedTemplate()))
  body.append(form)
}

function renderVirtual(body: HTMLElement, state: AppState, app: App): void {
  body.append(div('muted', 'Open an independent peer at this node in a new tab. Keep this tab open for the connection.'))
  const form = document.createElement('form')
  const name = document.createElement('input'); name.required = true; name.placeholder = 'Role name'; name.setAttribute('aria-label', 'Virtual peer name')
  const role = document.createElement('select'); role.setAttribute('aria-label', 'Virtual peer role')
  role.append(new Option('Editor — changes sync automatically', 'editor'), new Option('Proposer — changes need approval', 'proposer'), new Option('Reviewer — can approve proposals', 'reviewer'), new Option('Viewer — reads only', 'viewer'))
  const label = document.createElement('label')
  const account = document.createElement('input'); account.type = 'checkbox'; account.checked = !!state.session; account.disabled = !state.session
  account.id = 'virtual-use-account'; account.setAttribute('aria-label', 'Use current sign-in'); label.htmlFor = account.id
  label.append(account, document.createTextNode(' Use current sign-in (sign-out stays independent)'))
  const submit = button('primary', 'Spawn peer', () => undefined); submit.type = 'submit'
  form.append(name, role, label, submit)
  form.className = 'virtual-peer-form'
  form.addEventListener('submit', (event) => { event.preventDefault(); app.spawnVirtualPeer(name.value, role.value as 'editor' | 'proposer' | 'reviewer' | 'viewer', account.checked) })
  body.append(form)
  queueMicrotask(() => name.focus())
}

/** Link a phone: the number, then the code that was texted to it. */
function renderPhone(body: HTMLElement, state: AppState, app: App): void {
  const flow = state.phone ?? { phase: 'number' as const }
  body.append(div('muted', 'Link your phone to receive SMS notifications about proposals.'))
  if (flow.error) body.append(div('error', flow.error))
  const form = document.createElement('form')
  form.className = 'row'
  const input = document.createElement('input')
  input.type = 'text'
  input.autocomplete = 'off'
  input.id = flow.phase === 'code' ? 'phone-code' : 'phone-number'
  input.placeholder = flow.phase === 'code' ? 'the 6-digit code' : '+1 555 123 4567'
  if (flow.phase === 'number' && flow.number) input.value = flow.number
  const go = button('primary', flow.phase === 'busy' ? '…' : flow.phase === 'code' ? 'Verify' : 'Text me a code', () => undefined)
  go.type = 'submit'
  go.disabled = flow.phase === 'busy'
  form.append(input, go)
  form.addEventListener('submit', (e) => { e.preventDefault(); if (flow.phase === 'code') void app.phoneVerify(input.value); else void app.phoneStart(input.value) })
  body.append(form)
  if (flow.phase === 'code') body.append(div('muted small-print', `Sent to ${flow.number ?? 'your phone'}. Wrong number? `), button('link small', 'Start over', () => app.phoneRestart()))
  queueMicrotask(() => input.focus())
}

/** Ctrl+H: every key the tree answers to, and every row marker. */
function renderHelp(body: HTMLElement): void {
  const table = (rows: Array<[string, string]>, cls: string) => {
    const t = document.createElement('table')
    t.className = 'help-table ' + cls
    for (const [key, what] of rows) {
      const tr = document.createElement('tr')
      const k = document.createElement('td'); k.className = 'help-key'; const code = document.createElement('code'); code.textContent = key; k.append(code)
      const w = document.createElement('td'); w.textContent = what
      tr.append(k, w)
      t.append(tr)
    }
    return t
  }
  body.append(h4('Keys'), table(KEY_HELP, 'keys'))
  body.append(h4('Row markers (type them at the start of a row)'), table(SYNTAX_HELP, 'syntax'))
  body.append(div('muted small-print', 'A requirement (-) is filled by a child row of the kind it names; the task above it cannot be checked off until every requirement is filled. Allocations ($) draw from the parent context: the bank above them, or the bank the requirement needs. Peers in the context (fos when you are online) register capabilities that act as banks for search, market and mail requirements.'))
  body.append(div('muted small-print', 'Each peer row has two directions: "to" is what leaves this side (read, autopush, submit proposals, how it can be reached, services), "from" is what it takes in (read, read requests, autopush, relay, services). Nothing moves in a direction that is not listed, so no peer adds rows to your context: your sync is the query. A device set to only "from: read, read requests" receives work and sends nothing but the connection. In a project, [server] to / from in fos.config.toml fixes this.'))
  body.append(legalLinks('Fosforescent'))
}

// Links to the static legal pages in web/public (served at /privacy and /terms); `lead` is the text before them.
function legalLinks(lead: string): HTMLElement {
  const el = div('muted small-print legal-links', '')
  const link = (href: string, text: string) => { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a }
  el.append(`${lead} `, link('/terms', 'Terms of Service'), ' and ', link('/privacy', 'Privacy Policy'), '.')
  return el
}

function modalKey(state: AppState): string {
  const d = state.direct
  if (state.modal === 'work') return JSON.stringify([state.work, headCid(state.replica)])
  return [state.modal, JSON.stringify(state.templatePicker?.path), state.connectFlow.phase, state.invite?.token ?? '', state.inviteError ?? '', d?.role ?? '', d?.phase ?? '', (d?.role === 'host' ? d.pendingPeer?.peerId ?? '' : ''), state.manual.requestCode ? 'rq' : '', state.manual.resultCode ? 'rs' : '', state.requests.map((r) => r.id).join(','), state.device?.status ?? '', state.device?.name ?? '', state.market?.aliasId ?? '', state.market?.phase ?? '', state.market?.error ?? '', state.phone?.phase ?? '', state.phone?.error ?? ''].join('|')
}

function updateModalDynamic(el: HTMLElement, state: AppState, app: App): void {
  const err = el.querySelector('[data-dynamic="error"]')
  if (err) err.textContent = state.loginError ?? state.manual.error ?? ''
  void app
}

function modalTitle(kind: AppState['modal']): string {
  return kind === 'template' ? 'Change template' : kind === 'virtual' ? 'Spawn virtual peer' : kind === 'work' ? 'Delegate and review' : kind === 'connect' ? 'Connect this device' : kind === 'invite' ? 'Invite a device' : kind === 'requests' ? 'Connection requests' : kind === 'device' ? 'Approve a sign-in' : kind === 'market' ? 'Market listing' : kind === 'help' ? 'Keys and row syntax' : kind === 'phone' ? 'Link your phone' : 'Direct connect'
}

function renderWork(body: HTMLElement, state: AppState, app: App): void {
  const work = state.work
  if (!work) return
  body.append(div('muted', work.preview.createsSubtasks ? 'This sends the preview to the fos model to propose subtasks. Accepting the result creates unchecked task rows inside the selected task.' : 'This sends the preview below to the fos model to propose a plan or specification. Accepting its result fulfills this request; you still decide when the task is done.'))
  if (work.error) body.append(div('error', work.error))
  for (const blocker of work.preview.blockers) body.append(div('error', blocker))
  const preview = document.createElement('details')
  preview.open = true
  const summary = document.createElement('summary')
  summary.textContent = 'Exact context sent to the model'
  const prompt = document.createElement('pre')
  prompt.className = 'work-context'
  prompt.textContent = `System instructions:\n${WORK_SYSTEM}\n\nTask context:\n${work.preview.prompt}`
  preview.append(summary, prompt)
  body.append(preview)
  const refresh = button('secondary', 'Refresh context', () => app.refreshWork())
  const run = button('primary', work.busy ? 'Running…' : 'Run with this context', () => void app.runWork())
  refresh.disabled = work.busy
  run.disabled = work.busy || work.preview.blockers.length > 0 || state.session?.kind !== 'user'
  body.append(refresh, run)
  if (state.session?.kind !== 'user') body.append(div('muted', 'Sign in to run the model. You can preview the context offline.'))
  for (const attempt of app.workResults().reverse()) {
    const section = div('work-result', '')
    const saved = document.createElement('details'), label = document.createElement('summary')
    label.textContent = 'Context used for this attempt'
    const text = document.createElement('pre'); text.className = 'work-context'; text.textContent = `System instructions:\n${attempt.system}\n\nTask context:\n${attempt.context}`
    saved.append(label, text); section.append(saved)
    if (attempt.resultCid) section.append(div('muted', 'Accepted result'), div('work-context', content(state.replica.store, attempt.resultCid).data.description?.content ?? ''))
    else if (!attempt.proposals.length) section.append(div('muted', work.busy ? 'Awaiting a result…' : 'No result received. You can start a new attempt.'))
    for (const proposal of attempt.proposals) {
      section.append(div('work-context', content(state.replica.store, proposal.contentCid).data.description?.content ?? ''))
      if (proposal.status === 'rejected') { section.append(div('muted', 'Rejected — retained for reference.')); continue }
      const accept = button('primary', 'Accept result', () => app.reviewWork(attempt.resultPath, proposal.cid, true))
      const reject = button('secondary', 'Reject', () => app.reviewWork(attempt.resultPath, proposal.cid, false))
      const changed = attempt.context !== work.preview.prompt
      if (changed) section.append(div('error', 'The task context changed. Run a new attempt before accepting.'))
      accept.disabled = work.busy || changed || work.preview.blockers.length > 0 || !app.canApprove(viewAt(state.replica, work.path))
      reject.disabled = work.busy || !app.canApprove(viewAt(state.replica, work.path))
      section.append(accept, reject)
    }
    body.append(section)
  }
}

/** A listed node of another account: its rows and requirements, this account's proposal, and a form to propose. */
function renderMarket(body: HTMLElement, state: AppState, app: App): void {
  const m = state.market
  if (!m) return
  const head = div('market-head', '')
  head.append(span('market-title', firstLine(m.title) || '(untitled)'), span('muted', ` — listed by ${m.owner}`))
  body.append(head)
  if (m.phase === 'loading') { body.append(div('muted', 'Loading…')); return }
  if (m.error) body.append(div('error', m.error))
  const node = m.node
  if (!node) return
  const rows = document.createElement('ul')
  rows.className = 'market-rows'
  const requirements = node.view.tasks.filter((t) => t.kind === 'requirement' && t.requirement)
  for (const t of node.view.tasks) {
    const li = document.createElement('li')
    const kind = ROW_KIND_LABEL[t.kind] ?? t.kind
    const badgeText = t.kind === 'requirement' ? (t.requirement?.satisfied ? '✓ ' : '! ') + (t.requirement?.capability ?? kind) : kind.toLowerCase()
    li.append(span('kind-badge ' + (t.kind === 'requirement' ? (t.requirement?.satisfied ? 'ok' : 'needs') : ''), badgeText), document.createTextNode(' ' + (firstLine(t.title) || '')))
    rows.append(li)
  }
  if (!node.view.tasks.length) { const li = document.createElement('li'); li.className = 'muted'; li.textContent = 'No rows shown.'; rows.append(li) }
  body.append(rows)
  if (node.capability) { body.append(div('muted', 'Published capability snapshot. This view does not grant edit or execution authority on the publishing peer.')); return }

  if (node.myProposal) {
    const mine = node.view.proposals[0]
    body.append(div('market-mine', `Your proposal: ${node.myProposal.status}${mine?.summary.added.length ? ` — ${mine.summary.added.join('; ')}` : ''}. Only you and ${m.owner} can see it; other bidders cannot.`))
  }

  const form = document.createElement('form')
  form.className = 'market-form'
  const comment = document.createElement('textarea')
  comment.placeholder = node.myProposal ? 'Replace your proposal with a new comment…' : 'Your proposal (a comment the owner will see)…'
  comment.rows = 3
  form.append(comment)
  const picks: Array<{ requirementId: string; select: HTMLSelectElement }> = []
  for (const r of requirements) {
    if (r.requirement!.capability !== 'allocation' || r.requirement!.satisfied) continue
    const line = div('market-req', '')
    line.append(span('', `Supply “${firstLine(r.title)}”: `))
    const select = document.createElement('select')
    const options = app.allocations().filter(({ row }) => !r.requirement!.resource || row.allocation?.type === r.requirement!.resource)
    select.append(new Option(options.length ? 'Pick one of your allocations…' : 'No matching allocation (add one under a bank first)', ''))
    for (const { row } of options) select.append(new Option(`${formatAmount(row.allocation!.amount, row.allocation!.unit)} ${row.title}`.trim(), row.id))
    line.append(select)
    form.append(line)
    picks.push({ requirementId: r.id, select })
  }
  const submit = button('primary', m.phase === 'submitting' ? 'Sending…' : node.myProposal ? 'Replace proposal' : 'Send proposal', () => undefined)
  submit.type = 'submit'
  submit.disabled = m.phase === 'submitting'
  form.append(submit)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void app.submitProposal(comment.value, picks.filter((pk) => pk.select.value).map((pk) => ({ requirementId: pk.requirementId, allocationId: pk.select.value })))
  })
  body.append(form)
}

function renderDevice(body: HTMLElement, state: AppState, app: App): void {
  const device = state.device
  if (!device) return
  body.append(div('muted', `Code ${device.code}`))
  if (device.status === 'loading') body.append(div('pending-box', 'Checking the code…'))
  if (device.status === 'error') body.append(div('error', device.error ?? 'Something went wrong.'))
  if (device.status === 'ready') {
    body.append(div('', `“${device.name ?? 'a device'}” wants to sign in to your account and sync your whole tree. Only approve this if you just started it.`))
    const row = document.createElement('div')
    row.className = 'row'
    row.append(button('primary', 'Approve', () => void app.decideDevice('approve')), button('secondary', 'Deny', () => void app.decideDevice('deny')))
    body.append(row)
  }
  if (device.status === 'approved') body.append(div('pending-box', `Approved. “${device.name ?? 'The device'}” is signing in now; you can close this.`))
  if (device.status === 'denied') body.append(div('error', 'Denied.'))
}

function renderConnect(body: HTMLElement, state: AppState, app: App): void {
  if (state.device) body.append(div('pending-box', `Sign in to approve the sign-in request from “${state.device.name ?? 'a device'}” (code ${state.device.code}).`))
  body.append(div('muted', state.virtual ? 'Sign-in is independent of this virtual peer’s document connection.' : 'Sign in to open that account’s separate data session. Offline data stays here unless you choose to merge it.'))

  // --- sign in
  body.append(h4('Sign in'))
  const form = document.createElement('form')
  form.className = 'login'
  form.innerHTML = `
    <input name="username" type="text" placeholder="username or email" autocomplete="username" required />
    <input name="password" type="password" placeholder="password" autocomplete="current-password" required />
    <button type="submit" class="primary">Sign in</button>
  `
  let registering = false, submitting = false
  const mode = button('link', 'Create an account', () => {
    registering = !registering
    mode.textContent = registering ? 'Already have an account? Sign in' : 'Create an account'
    form.querySelector<HTMLButtonElement>('[type="submit"]')!.textContent = registering ? 'Register' : 'Sign in'
    form.querySelector<HTMLInputElement>('[name="password"]')!.autocomplete = registering ? 'new-password' : 'current-password'
    terms.hidden = !registering; accepted.required = registering
    passwordHint.hidden = !registering
  })
  const terms = document.createElement('label'); terms.hidden = true
  const accepted = document.createElement('input'); accepted.type = 'checkbox'
  terms.append(accepted, document.createTextNode(' I accept the Terms of Service and Privacy Policy.'))
  const passwordHint = div('muted', 'Use at least 8 characters, including an uppercase letter and a number.'); passwordHint.hidden = true
  form.append(terms, passwordHint, mode)
  if (app.canMergeOffline()) {
    const label = document.createElement('label')
    const merge = document.createElement('input'); merge.type = 'checkbox'; merge.name = 'mergeOffline'
    label.append(merge, document.createTextNode(' Merge this offline session’s data into the account'))
    form.append(label)
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting || (registering && !accepted.checked)) return
    const data = new FormData(form), submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!
    submitting = true; submit.disabled = true
    try {
      if (registering) await app.registerAccount(String(data.get('username') ?? ''), String(data.get('password') ?? ''))
      else await app.login(String(data.get('username') ?? ''), String(data.get('password') ?? ''), false, data.get('mergeOffline') === 'on')
    } finally { submitting = false; submit.disabled = false }
  })
  body.append(form, div('error', state.loginError ?? '', 'error'))
  body.append(legalLinks('By signing in you agree to the'))

  const other = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = 'Other connection options'
  other.append(summary)
  other.open = state.connectFlow.phase !== 'idle'
  // --- invite token
  other.append(h4('Connection token or QR code'))
  other.append(div('muted', 'Someone invites this device to one of their nodes; paste the token or scan their QR code, then wait for them to approve.'))
  const flow = state.connectFlow
  if (flow.phase === 'waiting') {
    other.append(div('pending-box', `Waiting for approval to attach to ${pathLabel(flow.scopeNames)}…`))
    other.append(button('secondary small', 'Cancel', () => app.closeModal()))
  } else {
    const tokenRow = document.createElement('div')
    tokenRow.className = 'row'
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'fosinv_…'
    input.autocomplete = 'off'
    const go = button('primary', flow.phase === 'claiming' ? 'Connecting…' : 'Connect', () => void app.connectWithToken(input.value))
    go.disabled = flow.phase === 'claiming'
    tokenRow.append(input, go)
    other.append(tokenRow)
    other.append(scanButton((text) => { input.value = text; void app.connectWithToken(text) }, other))
    if (flow.phase === 'error') other.append(div('error', flow.message))
    if (flow.phase === 'denied') other.append(div('error', 'The owner denied this device.'))
    if (flow.phase === 'expired') other.append(div('error', 'That invite expired. Ask for a new one.'))
  }

  // --- direct
  other.append(h4('Direct, device to device'))
  other.append(div('muted', 'No account needed: connect straight to another device nearby, with a QR code or by pasting codes.'))
  other.append(button('secondary', 'Direct connect…', () => app.openModal('direct')))
  body.append(other)
}

function renderInvite(body: HTMLElement, state: AppState, app: App): void {
  const invite = state.invite
  if (!invite) { body.append(div(state.inviteError ? 'error' : 'muted', state.inviteError ?? 'Creating an invite…')); if (state.inviteError) body.append(button('secondary small', 'Retry', () => void app.startInvite())); return }
  body.append(div('muted', `The device that uses this token attaches to ${invite.scopeNames.length ? pathLabel(invite.scopeNames) : 'your whole account'} once you approve it; you choose then whether it may only propose changes or also approve them. It expires in 15 minutes.`))
  body.append(qrCanvas(invite.token))
  body.append(codeBox(invite.token))
  const requests = state.requests
  body.append(h4(requests.length ? 'Waiting for your approval' : 'No requests yet'))
  requests.forEach((r) => body.append(requestRow(r, app)))
  body.append(button('secondary small', 'Refresh', () => void app.refreshRequests()))
  void app
}

function renderRequests(body: HTMLElement, state: AppState, app: App): void {
  if (state.requests.length === 0) body.append(div('muted', 'No devices are waiting for approval.'))
  state.requests.forEach((r) => body.append(requestRow(r, app)))
  body.append(button('secondary small', 'Refresh', () => void app.refreshRequests()))
}

function requestRow(r: { id: number; peerName: string | null; peerId: string | null; scopeNames: string[] }, app: App): HTMLElement {
  const row = div('request-row', '')
  row.append(div('request-text', `${r.peerName || 'A device'} (${(r.peerId ?? '').slice(0, 8)}) wants to attach to ${r.scopeNames.length ? pathLabel(r.scopeNames) : 'your whole account'}`))
  const actions = div('row', '')
  const propose = button('primary small', 'Approve: may propose', () => void app.answerRequest(r.id, 'approve', ['edit']))
  propose.title = 'The device attaches here; its changes arrive as proposals for members to approve'
  const approve = button('secondary small', 'Approve: may propose and approve', () => void app.answerRequest(r.id, 'approve', ['edit', 'approve']))
  approve.title = 'The device may also merge other members’ proposals'
  actions.append(propose, approve, button('danger small', 'Deny', () => void app.answerRequest(r.id, 'deny')))
  row.append(actions)
  return row
}

function renderDirect(body: HTMLElement, state: AppState, app: App): void {
  const d = state.direct
  if (!app.webRtcAvailable()) body.append(div('error', 'WebRTC is not available here; use the manual relay below.'))

  if (!d) {
    body.append(div('muted', 'One device invites, the other joins. Codes travel by QR code or any way you can move text.'))
    const row = div('row', '')
    row.append(button('primary', 'Invite another device to this node', () => void app.startDirectHost()))
    body.append(h4('Invite'), row)
    body.append(h4('Join'))
    const input = textarea('Paste the other device’s offer code…')
    body.append(input, button('primary', 'Join', () => void app.startDirectGuest(input.value)))
    body.append(scanButton((text) => { input.value = text; void app.startDirectGuest(text) }, body))
    renderManual(body, state, app)
    return
  }

  if (d.role === 'host') {
    if (d.phase === 'creating') body.append(div('muted', 'Preparing the connection…'))
    if (d.phase === 'offer' && d.code) {
      body.append(div('muted', 'Show this to the other device (or send the code), then paste its answer below.'))
      body.append(qrCanvas(d.code), codeBox(d.code))
      const input = textarea('Paste the answer code…')
      body.append(input, button('primary', 'Complete connection', () => void app.hostAcceptAnswer(input.value)))
      body.append(scanButton((text) => { input.value = text; void app.hostAcceptAnswer(text) }, body))
    }
    if (d.phase === 'connecting') body.append(div('muted', 'Connecting…'))
    if (d.phase === 'connected' && d.pendingPeer) {
      body.append(div('pending-box', `${d.pendingPeer.name} wants to sync with this node. Allow?`))
      const row = div('row', '')
      row.append(button('primary', 'Allow', () => app.approveDirectPeer(true)), button('danger', 'Deny', () => app.approveDirectPeer(false)))
      body.append(row)
    } else if (d.phase === 'connected') {
      body.append(div('pending-box', `Connected to ${d.remoteName ?? 'the other device'}. Waiting for it to say hello…`))
    }
    if (d.phase === 'error') body.append(div('error', d.error ?? 'Connection failed'))
    body.append(button('secondary small', d.phase === 'connected' ? 'Disconnect' : 'Cancel', () => { app.cancelDirect(); app.closeModal() }))
    return
  }

  if (d.phase === 'connecting') body.append(div('muted', 'Reading the offer…'))
  if (d.phase === 'answer' && d.code) {
    body.append(div('muted', `Show this answer to ${d.remoteName ?? 'the other device'} (or send the code). The connection opens once it is entered there.`))
    body.append(qrCanvas(d.code), codeBox(d.code))
  }
  if (d.phase === 'connected') body.append(div('pending-box', `Connected to ${d.remoteName ?? 'the other device'}.`))
  if (d.phase === 'denied') body.append(div('error', 'The other device declined.'))
  if (d.phase === 'error') body.append(div('error', d.error ?? 'Connection failed'))
  body.append(button('secondary small', d.phase === 'connected' ? 'Disconnect' : 'Cancel', () => { app.cancelDirect(); app.closeModal() }))
}

function renderManual(body: HTMLElement, state: AppState, app: App): void {
  body.append(h4('Manual relay (no live connection)'))
  body.append(div('muted', 'If no connection can be opened, carry the sync by hand: this device makes a request code, the other device turns it into a result code, and you paste that back here.'))
  const m = state.manual
  const row = div('row', '')
  row.append(button('secondary small', 'Make request code', () => app.manualMakeRequest()))
  body.append(row)
  if (m.requestCode) body.append(codeBox(m.requestCode))
  const resultIn = textarea('Paste a result code here…')
  body.append(resultIn, button('secondary small', 'Apply result', () => app.manualApplyResult(resultIn.value)))
  const requestIn = textarea('…or paste a request code from the other device here')
  body.append(requestIn, button('secondary small', 'Serve request', () => app.manualServe(requestIn.value)))
  if (m.resultCode) body.append(div('muted', 'Result code for the other device:'), codeBox(m.resultCode))
  if (m.error) body.append(div('error', m.error, 'error'))
}

// ---------------------------------------------------------------------------
// QR helpers

function qrCanvas(text: string): HTMLElement {
  const wrap = div('qr', '')
  if (text.length > 2900) {
    wrap.append(div('muted', 'Too long for a QR code; use the text code.'))
    return wrap
  }
  const canvas = document.createElement('canvas')
  wrap.append(canvas)
  QRCode.toCanvas(canvas, text, { width: 240, margin: 1, errorCorrectionLevel: 'L' }).catch(() => {
    wrap.replaceChildren(div('muted', 'Could not draw the QR code; use the text code.'))
  })
  return wrap
}

function codeBox(text: string): HTMLElement {
  const box = div('code-box', '')
  const code = document.createElement('textarea')
  code.readOnly = true
  code.value = text
  code.rows = 3
  code.addEventListener('focus', () => code.select())
  const copy = button('secondary small', 'Copy', () => {
    void navigator.clipboard?.writeText(text).then(() => { copy.textContent = 'Copied' }, () => { code.select() })
  })
  box.append(code, copy)
  return box
}

function scanButton(onResult: (text: string) => void, host: HTMLElement): HTMLElement {
  const wrap = div('scan', '')
  const container = document.createElement('div')
  container.className = 'scanner'
  container.id = `scanner-${Math.random().toString(36).slice(2, 8)}`
  container.hidden = true
  const btn = button('secondary small', 'Scan QR code', async () => {
    if (scanner) { await stopScanner(); btn.textContent = 'Scan QR code'; container.hidden = true; return }
    try {
      container.hidden = false
      const { Html5Qrcode } = await import('html5-qrcode')
      const instance = new Html5Qrcode(container.id)
      scanner = instance
      btn.textContent = 'Stop scanning'
      await instance.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, (decoded) => {
        void stopScanner().then(() => { container.hidden = true; btn.textContent = 'Scan QR code'; onResult(decoded) })
      }, () => undefined)
    } catch (error) {
      container.hidden = true
      wrap.append(div('error', `Camera unavailable: ${error instanceof Error ? error.message : String(error)}`))
    }
  })
  wrap.append(btn, container)
  void host
  return wrap
}

async function stopScanner(): Promise<void> {
  const current = scanner
  scanner = null
  if (current) { try { await current.stop() } catch { /* ignore */ } }
}

// ---------------------------------------------------------------------------

function peerLabel(peerId: string, state: AppState): string {
  if (peerId === state.replica.meta.peerId) return 'This device'
  if (peerId.startsWith('user:')) return `Your account (${peerId.slice(5)})`
  if (state.direct?.remoteName && peerId === state.replica.meta.serverPeerId) return state.direct.remoteName
  return `Device ${peerId.slice(0, 8)}`
}

function ago(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
}

function h4(text: string): HTMLElement {
  const el = document.createElement('h4')
  el.textContent = text
  return el
}

function textarea(placeholder: string): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.placeholder = placeholder
  el.rows = 3
  return el
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = className
  el.textContent = text
  return el
}

function div(className: string, text: string, dynamic?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  el.textContent = text
  if (dynamic) el.dataset.dynamic = dynamic
  return el
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  const svg = iconSvg(text)
  if (svg) { el.innerHTML = svg; el.setAttribute('aria-label', text) } else el.textContent = text
  el.addEventListener('click', onClick)
  return el
}
