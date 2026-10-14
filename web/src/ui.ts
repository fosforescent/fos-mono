/**
 * DOM rendering. The shell is built once; each state change re-renders the
 * dynamic regions from the app state and the replica's view model (plain ids,
 * titles and flags; no content addresses reach this file).
 */

import QRCode from 'qrcode'
import { content, headCid, WORK_SYSTEM, isDirty, view as viewAt, type ChoiceView, HOME_ID, type MovePosition, type NodeView, type Scope, type TaskView } from '../../shared/sync/index'
import type { App, AppState } from './app'
import { exportNote, noteContext, noteFilename, type NoteChild } from './notes'
import { hydrateDiagrams, renderMarkdown } from './markdown'
import { ROW_KIND_LABEL, SYNTAX_HELP, allocationTag, describeParsed, downloadText, formatAmount, parseRowInput, rawRowText, renderInlineText } from './rows'
import { CAPABILITY_LABEL, type Capability, type PeerPolicy, type RowKind } from '../../shared/sync/index'

type Regions = {
  context: HTMLElement
  link: HTMLElement
  status: HTMLElement
  menuButton: HTMLButtonElement
  localBadge: HTMLElement
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
  ['Shift+Enter', 'new line in a cell; indent lines to create child rows'],
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
  root.innerHTML = `
    <header class="topbar">
      <div class="brand-row">
        <button type="button" class="icon menu-button" data-region="menu-button" aria-label="Menu">☰</button>
        <span class="local-badge" data-region="local-badge" hidden>local</span>
        <div class="brand">Fosforescent</div>
        <button type="button" class="icon help-button" data-region="help-button" title="Keys and row syntax (Ctrl+H)" aria-label="Keys and row syntax">?</button>
      </div>
      <div class="status" data-region="status"></div>
      <nav class="menu" data-region="menu" hidden></nav>
    </header>
    <section class="banner" data-region="banner" hidden></section>
    <nav class="crumbs" data-region="crumbs"></nav>
    <div class="voice-controls"><button type="button" class="icon mic" data-region="mic" title="Record a voice note (transcribed and organized into notes)" aria-label="Record a voice note">🎙</button></div>
    <section class="choices" data-region="choices"></section>
    <section class="link-panel" data-region="link" hidden></section>
    <section class="tasks">
      <ul class="list tree" data-region="list"></ul>
    </section>
    <footer class="footer" data-region="footer"></footer>
    <div class="context-menu" data-region="context" hidden></div>
    <div class="modal-backdrop" data-region="modal" hidden></div>
  `
  const q = <T extends HTMLElement>(name: string): T => root.querySelector(`[data-region="${name}"]`) as T
  const regions: Regions = {
    context: q('context'),
    link: q('link'),
    status: q('status'),
    menuButton: q('menu-button'),
    localBadge: q('local-badge'),
    menu: q('menu'),
    banner: q('banner'),
    crumbs: q('crumbs'),
    choices: q('choices'),
    list: q('list'),
    mic: q('mic'),
    footer: q('footer'),
    modal: q('modal')
  }

  regions.mic.addEventListener('click', () => { void app.toggleVoice() })
  q<HTMLButtonElement>('help-button').addEventListener('click', () => toggleHelp(app))
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
  regions.localBadge.hidden = !app.isLocal()
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
  renderChoices(regions.choices, node, state, app)
  renderLinkPanel(regions.link, node, state, app)
  renderTree(regions.list, node, state, app)
  renderFooter(regions.footer, state, app)
  renderContextMenu(regions.context, state, app)
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
      ? button('link status-text', labels[state.connection], () => app.openModal('connect'))
      : span('status-text', labels[state.connection]),
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
  if (!session) item('Connect…', () => app.openModal('connect'), 'primary-text')
  item('⚙ Settings', () => app.goToRoot())
  if (app.canSpawnVirtualPeer()) item('Spawn virtual peer…', () => app.openModal('virtual'))
  if (app.canUndo) item('Undo (Ctrl/⌘ Z)', () => runHistory(app, false))
  if (app.canRedo) item('Redo (Ctrl/⌘ Shift Z)', () => runHistory(app, true))
  item('Keys and row syntax (Ctrl+H)', () => app.openModal('help'))
  if (session?.kind === 'user') {
    item('Invite a device here', () => void app.startInvite())
    item(`Connection requests${state.requests.length ? ` (${state.requests.length})` : ''}`, () => app.openModal('requests'))
  }
  item('Direct connect (device to device)…', () => app.openModal('direct'))
  if (state.replica.meta.scope.length > 0 && session?.kind === 'user') {
    const toRoot = button('menu-item', 'Sync whole account on this device', () => app.attachAt([]))
    toRoot.disabled = !app.canAttach([])
    items.push(toRoot)
  }
  if (session) item(`Sign out (${session.username})`, () => app.logout())
  const name = document.createElement('div')
  name.className = 'menu-meta'
  name.append(span('muted', `This device: ${state.deviceName}`), button('link small', 'rename', () => {
    const next = window.prompt('Name this device', state.deviceName)
    if (next) app.setDeviceName(next)
  }))
  items.push(name, legalLinks('Fosforescent'))
  el.replaceChildren(...items)
}

function renderMic(el: HTMLButtonElement, state: AppState, app: App): void {
  const v = state.voice
  el.classList.toggle('recording', v?.phase === 'recording')
  el.classList.toggle('busy', v?.phase === 'uploading')
  el.disabled = v?.phase === 'uploading'
  el.textContent = v?.phase === 'recording' ? '■' : v?.phase === 'uploading' ? '…' : '🎙'
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

function pathLabel(names: string[]): string {
  return names.length === 0 ? '/' : '/' + names.join('/')
}

function renderCrumbs(el: HTMLElement, state: AppState, app: App): void {
  const { replica, view } = state
  const labels = app.labels()
  const transport = app.transport()
  const chipText = state.virtual
    ? `${transport === 'virtual' ? 'Virtual peer' : 'Disconnected virtual peer'} of ${state.virtual.hostName}`
    : transport === 'direct'
    ? `Syncing with ${state.direct?.remoteName ?? 'another device'}`
    : transport === 'account'
      ? `${state.session?.kind === 'peer' ? 'Invited to' : 'Device syncs'} ${pathLabel(labels.scope)}`
      : 'Local only'
  const attached = span('chip', chipText)
  attached.title = `peer ${replica.meta.peerId}`
  const branch = app.currentBranch()
  const branchChip = branch ? span('chip', `⎇ ${branch}`) : null
  if (branchChip) branchChip.title = 'git branch of this project directory; each branch keeps its own tasks and proposal'

  const crumbs = document.createElement('div')
  crumbs.className = 'crumb-path'
  const homeCrumb = button('crumb', labels.scope.length ? pathLabel(labels.scope) : 'Home', () => app.goTo([]))
  if (state.atRoot) {
    crumbs.append(span('crumb current', 'Settings'))
  } else {
    crumbs.append(homeCrumb)
    view.forEach((_id, index) => {
      if (_id === HOME_ID) return
      crumbs.append(span('sep', '›'), button('crumb', labels.view[index] ?? '…', () => app.goTo(view.slice(0, index + 1))))
    })
    const current = crumbs.lastElementChild as HTMLElement
    current.classList.add('current')
  }

  const controls: HTMLElement[] = []
  if (view.length > 0 && state.session?.kind === 'user') {
    const here = app.currentScope()
    const attachHere = button('secondary small', `Sync only ${pathLabel([...labels.scope, ...labels.view])} on this device`, () => app.attachAt(here))
    attachHere.disabled = !app.canAttach(here)
    attachHere.title = attachHere.disabled ? 'Available while online with no unsynced changes' : ''
    controls.push(attachHere)
  }
  el.replaceChildren(attached, ...(branchChip ? [branchChip] : []), crumbs, ...controls)
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

const ghostRows = new WeakMap<HTMLElement, { row: HTMLElement; store: AppState['replica']['store']; path: string }>()

function renderTree(el: HTMLElement, node: NodeView, state: AppState, app: App): void {
  const cached = ghostRows.get(el)
  const path = JSON.stringify(state.view)
  const reuse = cached && cached.store === state.replica.store && cached.path === path && cached.row.parentNode === el
  if (!reuse && !state.selected) focusGhost = true
  const ghost = reuse ? cached.row : renderGhostRow(node, state, app)
  const rows = state.atRoot ? renderRootRows(state, app) : renderRows(node, [], 0, state, app)
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
      if (input.isConnected && active !== input && (!active || active === document.body || !active.closest('input, textarea, select, button'))) input.focus()
    })
  }
}

/**
 * The blank row at the top of the view: an ordinary-looking row that is not in the replica until something
 * is typed into it. Enter makes it the first row here (with its marker parsed) and opens a new row below;
 * leaving it with text makes the row without moving on; ↓ goes to the first real row.
 */
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
    const raw = input.value
    if (!raw.trim()) return null
    committed = true
    const parsed = parseRowInput(raw)
    const created = app.addRowAtTop(parsed)
    if (!created) { committed = false; return null }
    input.value = ''
    input.dispatchEvent(new window.Event('input'))
    committed = false
    return created
  }
  input.addEventListener('commit-edit', () => commit())
  input.addEventListener('keydown', (e: Event) => {
    const event = e as KeyboardEvent
    if (isHelpKey(event)) { event.preventDefault(); toggleHelp(app); return }
    if (indentDraft(event, input)) return
    const k = event.key
    if (historyShortcut(event) !== null && input.value === '') { event.preventDefault(); event.stopPropagation(); runHistory(app, historyShortcut(event)!); return }
    if (k === 'ArrowLeft' && event.altKey) { event.preventDefault(); commit(); focusGhost = true; app.zoomOut(); return }
    if (k === 'Enter' && (!event.shiftKey || event.ctrlKey || event.metaKey)) {
      // the typed row becomes the first row here; the blank row stays on top, ready for the next one (no extra blank row below)
      event.preventDefault()
      event.stopPropagation()
      focusGhost = true // Set before commit: adding the first row renders synchronously.
      const created = commit()
      if (created && (event.ctrlKey || event.metaKey) && !event.shiftKey) { const row = app.rowAt([created]); if (row?.kind === 'task') app.toggleTaskAt([], row) }
      if (created && (event.ctrlKey || event.metaKey) && event.shiftKey) { focusGhost = false; app.addRowInside([], created) }
      return
    }
    if (k === 'ArrowDown' && !event.altKey) { event.preventDefault(); event.stopPropagation(); focusGhost = true; const created = commit(); if (!created && node.tasks.length) moveSelection(app, 1); return }
    if (k === 'Escape') { event.preventDefault(); input.value = ''; input.dispatchEvent(new window.Event('input')); input.blur(); return }
    event.stopPropagation()
  })
  input.addEventListener('focus', () => { if (app.state.selected) { focusGhost = true; app.select(null) } })
  input.addEventListener('blur', () => { if (!renderDepth) commit() })
  li.append(span('zoom-dot', ''), span('handle', ''), toggle, input, preview)
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

/** Rows for `node`'s tasks (and nested choices) at `depth`; `at` is the path relative to the view. */
function renderRows(node: NodeView, at: Scope, depth: number, state: AppState, app: App): HTMLElement[] {
  const rows: HTMLElement[] = []
  node.tasks.forEach((task, index) => {
    rows.push(renderRow(task, at, depth, index, node.tasks.length, state, app))
    const path = [...at, task.id]
    const editingBelow = !!state.selected && state.selected.length > path.length && path.every((id, i) => state.selected![i] === id)
    // Responsive depth limits must not hide the child the user just opened for editing.
    const expanded = editingBelow || (!state.collapsed.includes(task.id) && depth + 1 < maxDepth())
    if (expanded && (task.childCount > 0 || task.childChoices > 0)) {
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
  li.draggable = true
  li.tabIndex = 0
  li.dataset.id = task.id
  // Selecting re-renders the list, which would destroy a row that is being dragged:
  // select on keyboard focus and on click (after any drag has ended), never on mouse-down focus.
  li.addEventListener('focus', () => { if (!selected && !pointerDown) app.select(path) })
  li.addEventListener('mousedown', () => { pointerDown = true })
  li.addEventListener('click', (event) => {
    pointerDown = false
    if ((event.target as HTMLElement).closest('input, textarea, button')) return
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
    event.preventDefault()
    clearDropMarks(li)
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

  const hasChildren = task.childCount > 0 || task.childChoices > 0
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
  if (selected && task.kind !== 'ref' && (!SPECIAL_KINDS.has(task.kind) || editingSpecial === task.id)) {
    body = renderEditor(task, at, state, app)
  } else if (task.kind === 'ref') {
    body = renderRefBody(task, app)
  } else if (task.kind === 'note') {
    body = renderNoteBody(task, at, state, app)
  } else if (SPECIAL_KINDS.has(task.kind)) {
    body = renderSpecialBody(task, at, state, app)
    body.addEventListener('click', (event) => { if ((event.target as HTMLElement).closest('a,button')) return; event.stopPropagation(); editingSpecial = task.id; app.select(path); app.refresh() })
  } else {
    body = span('title', '')
    if (task.kind === 'template') { const b = span('kind-badge tpl', '`template'); b.title = 'Template: the nested rows and arguments inside are copied into every task that executes it ([ ] `name`)'; body.append(b, document.createTextNode(' ')) }
    body.append(renderInlineText(task.title))
    if (task.kind === 'comment') {
      const who = span('author', task.author?.name ? `${task.author.name} · ${new Date(task.author.time).toLocaleString()}` : 'comment')
      body.prepend(who)
    }
    body.title = 'Click to edit'
  }

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
  if (task.kind === 'requirement' && task.requirement && !task.requirement.satisfied) li.classList.add('unmet')
  if (task.kind === 'template' && task.childCount > 0 && (viewAt(state.replica, [...state.view, ...path])?.tasks ?? []).some((c) => c.kind === 'requirement' && !c.requirement?.satisfied)) li.classList.add('unmet')
  if (task.subtreeTasks > 0) meta.append(span('muted', `${task.subtreeDone}/${task.subtreeTasks}`))
  if (task.isLink) { const b = span('link-badge', '⛓'); b.title = 'Link node: other devices attach here; their changes arrive as proposals'; meta.append(b) }
  if (task.market) { const b = span('market-badge', '🛒'); b.title = 'Listed on the market: other accounts can find this and propose'; meta.append(b) }
  if (task.blockedBy?.length) { const b = span('blocked-badge', `Needs: ${task.blockedBy.join(', ')}`); b.title = `Needs: ${task.blockedBy.join(', ')}`; meta.append(b) }

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
    if (indentDraft(event, input)) return
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
    if (k === 'Enter' && ctrl && event.shiftKey) { event.preventDefault(); commit(); app.addRowInside(at, task.id); return }
    if (k === 'Enter' && ctrl) { event.preventDefault(); commit(); const current = app.rowAt(path); if (current?.kind === 'task') { app.toggleTaskAt(at, current); app.refresh() } else if (current) app.addRowBelow(at, task.id); return }
    if (k === 'Enter' && !multiline && !event.shiftKey) { event.preventDefault(); commit(); app.addRowBelow(at, task.id); return }
    if (k === 'Tab') { event.preventDefault(); commit(); app.select(path); app.indentSelected(event.shiftKey); return }
    if (k === 'Backspace' && input.value === '' && (ctrl || !multiline)) { event.preventDefault(); committed = true; moveSelection(app, -1); app.deleteTaskAt(at, task.id); return }
    if (k === 'Backspace' && ctrl && event.shiftKey) { event.preventDefault(); committed = true; moveSelection(app, -1); app.deleteTaskAt(at, task.id); return }
    if (k === 'Escape') { event.preventDefault(); commit(); input.blur(); queueMicrotask(() => { const row = document.querySelector<HTMLElement>(`.tree .task[data-id="${task.id}"]`); if (row) row.focus(); else { focusGhost = true; app.select(null) } }); return }
    if (k === '.' && ctrl) { event.preventDefault(); app.openContextMenu({ kind: 'task', at, task }); return }
    event.stopPropagation()
  })
  input.addEventListener('blur', () => { if (!renderDepth) commit() })
  // keep the focus on the editor when the row is (re)rendered as selected
  queueMicrotask(() => {
    if (input.isConnected && document.activeElement !== input && !state.modal && !state.contextMenu) {
      input.focus()
      const end = input.value.length
      try { input.setSelectionRange(end, end) } catch { /* not all inputs */ }
    }
  })
  // the editor plus a badge saying what the typed line is recognized as
  const wrap = span('title editing', '')
  wrap.append(input, kindPreview(input))
  return wrap
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').replace(/^#+\s*/, '').slice(0, 60)
}

/** A reference row shows the title of the row it points at and follows it on click. */
function renderRefBody(task: TaskView, app: App): HTMLElement {
  const body = span('title ref', '')
  const arrow = span('ref-arrow', '→')
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
  const expanded = ctx.body.trim() ? expandNoteText(ctx) : ''
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

function expandNoteText(ctx: ReturnType<typeof noteContext>): string {
  return exportNote(ctx).replace(/^---\n[\s\S]*?\n---\n\n?/, '')
}

/** Requirement, supply, query, resource-bank and allocation rows: a kind badge, the text, and a status/balance. */
function renderSpecialBody(task: TaskView, at: Scope, state: AppState, app: App): HTMLElement {
  const body = span('title special', '')
  const badge = (text: string, cls = '') => { const b = span('kind-badge ' + cls, text); body.append(b) }
  const stop = (el: HTMLElement) => { el.addEventListener('click', (e) => e.stopPropagation()); return el }
  if (task.kind === 'requirement' && task.requirement) {
    const r = task.requirement
    const marker: Record<string, string> = { account: '$', calendar: ':', inventory: '#', person: '@' }
    const label = r.capability === 'peer' && r.peer ? `@${r.peer}` : r.capability === 'allocation' ? `${marker[r.resource ?? ''] ?? '$'}${r.amount !== undefined ? ' ' + formatAmount(r.amount, r.unit ?? '') : ''}` : r.capability === 'task' ? '[ ]' : r.capability === 'search' ? '?' : r.capability
    badge(r.satisfied ? '✓ ' + label : '- ' + label, r.satisfied ? 'ok' : 'needs')
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
      const handler = (cap: 'search' | 'market' | 'mail') => peers.find((p) => p.online && p.capabilities.includes(cap))
      const hint = (text: string) => body.append(span('muted req-hint', ' ' + text))
      if (r.capability === 'confirmation') body.append(stop(button('secondary small', state.session ? 'Confirm' : 'Sign in to confirm', () => app.supplyRequirementAt(at, task.id, { capability: 'confirmation' }))))
      if (r.capability === 'choice') (r.options ?? []).forEach((opt, i) => body.append(stop(button('secondary small', opt, () => app.supplyRequirementAt(at, task.id, { capability: 'choice', choice: i })))))
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
        body.append(b)
      }
      if (r.capability === 'repo') {
        const github = state.integrations.find((p) => p.id === 'github')
        if (github?.connected) body.append(stop(button('secondary small', `Open issue${r.repo ? ' in ' + r.repo : ''}`, () => void app.askPeerAt(at, task))))
        else hint('sign in with GitHub (root › GitHub) to open the issue')
      }
      if (r.capability === 'tool') {
        if (state.session?.kind === 'user') body.append(stop(button('secondary small', `Run${r.tool ? ' ' + r.tool : ''}`, () => void app.askPeerAt(at, task))))
        else hint('sign in: an MCP peer attached above runs it')
      }
      if (r.capability === 'allocation' && (r.resource === 'calendar' || r.resource === 'person') && r.start !== undefined) {
        const google = state.integrations.find((p) => p.id === 'google')
        if (google?.connected) body.append(stop(button('secondary small', 'Add to Google Calendar', () => void app.askPeerAt(at, task))))
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
  const state = app.state
  const siblings = app.currentView() && at.length === 0 ? app.currentView()!.tasks : null
  void siblings
  const canInvite = state.session?.kind === 'user'
  return [
    ...(task.kind === 'task' && !task.template ? [{ label: 'Use Implement and verify template', run: () => app.addWorkTemplate(at, task.id) }] : []),
    { label: 'Add row inside', keys: 'Ctrl+Shift+Enter', run: () => app.addRowInside(at, task.id) },
    // typed markers, opened from the menu: the row starts with the marker and the editor takes it from there
    ...[
      { label: 'Add requirement inside: money (-$ 50 …)', run: () => app.addRowInside(at, task.id, 'plain', '-$ ') },
      { label: 'Add requirement inside: time (-: 1h …)', run: () => app.addRowInside(at, task.id, 'plain', '-: ') },
      { label: 'Add requirement inside: things (-# 2 …)', run: () => app.addRowInside(at, task.id, 'plain', '-# ') },
      { label: 'Add requirement inside: a person (-@name …)', run: () => app.addRowInside(at, task.id, 'plain', '-@') },
      { label: 'Add requirement inside: confirmation / task / search (- … · -[ ] … · -? …)', run: () => app.addRowInside(at, task.id, 'plain', '-') }
    ],
    ...(task.kind === 'requirement' && task.requirement?.capability === 'allocation' ? [{ label: `Add allocation inside (${({ account: '$', calendar: ':', inventory: '#', person: '@' } as Record<string, string>)[task.requirement.resource ?? 'account']} amount …)`, run: () => app.addRowInside(at, task.id, 'plain', `${({ account: '$ ', calendar: ': ', inventory: '# ', person: '@' } as Record<string, string>)[task.requirement?.resource ?? 'account']}`) }] : []),
    ...(task.kind === 'resource' ? [{ label: `Add allocation inside (${({ account: '$', calendar: ':', inventory: '#', person: '@' } as Record<string, string>)[task.resource?.type ?? 'account']} amount …)`, run: () => app.addRowInside(at, task.id, 'plain', ({ account: '$ ', calendar: ': ', inventory: '# ', person: '@' } as Record<string, string>)[task.resource?.type ?? 'account'] ?? '$ ') }] : []),
    ...(task.kind !== 'resource' && task.kind !== 'requirement' ? [{ label: 'Add allocation inside ($ amount …)', run: () => app.addRowInside(at, task.id, 'plain', '$ ') }] : []),
    ...(task.kind !== 'ref' && task.kind !== 'supply' ? ['money', 'calendar', 'inventory', 'person'].map((type) => ({ label: `Change to ${type} bank`, run: () => app.rewriteRowAt(at, task.id, { ...parseRowInput(`@${type} `), text: task.title }) })) : []),
    { label: 'Connect peer here…', run: () => { app.zoomTo([...at, task.id]); app.openModal('direct') } },
    ...(app.canSpawnVirtualPeer() ? [{ label: 'Spawn virtual peer here…', run: () => { app.zoomTo([...at, task.id]); app.openModal('virtual') } }] : []),
    ...(state.session?.kind === 'user' ? app.knownPeers().filter((p) => !p.id.startsWith('integration:') && !p.id.startsWith('mcp:')).slice(0, 6).map((p) => ({ label: `Add @${p.name} as a member (make this a group)`, run: () => app.addPeerToRow(at, task.id, p.id, p.name) })) : []),
    ...(state.session?.kind === 'user' ? state.mcpPeers.slice(0, 6).map((m) => ({ label: `Attach MCP peer ${m.name} here (runs ${m.tools.slice(0, 3).join(', ') || 'its tools'})`, run: () => void app.attachMcpPeer(m.serverId, [...at, task.id]) })) : []),
    { label: 'Zoom in', keys: 'Alt+→', run: () => app.zoomTo([...at, task.id]) },
    ...(task.kind === 'task' ? [{ label: task.done ? 'Mark open' : 'Mark done', keys: 'Ctrl+Enter', run: () => app.toggleTaskAt(at, task) }] : []),
    { label: 'Add row below', keys: 'Enter', run: () => app.addRowBelow(at, task.id) },
    ...(task.kind === 'ref' ? [{ label: 'Go to the referenced row', run: () => app.followRef(task.refId ?? '') }] : []),
    { label: 'Add comment', run: () => app.addRowInside(at, task.id, 'comment') },
    ...(task.kind === 'task' ? [{ label: 'Add requirement (type - inside: -[ ] task · -$ 50 · -@calendar 1h · -? search · -@peer …)', run: () => app.addRowInside(at, task.id) }] : []),
    ...(state.session?.kind === 'user' && task.kind !== 'ref' && task.kind !== 'supply' ? [{ label: task.market ? 'Remove from market' : 'List on market', run: () => app.setMarketAtRow(at, task.id, !task.market) }] : []),
    // an allocation bin (a row with requirement and allocation rows inside) goes to another account as a proposal on a node of theirs this account knows
    ...(state.session?.kind === 'user' && task.kind !== 'ref' && task.kind !== 'supply' ? app.knownListings().slice(0, 6).map((l) => ({ label: `Send to @${l.owner} (“${firstLine(l.title) || l.aliasId.slice(0, 8)}”) as a proposal`, run: () => void app.sendRowTo(at, task, l.owner, l.aliasId) })) : []),
    ...(task.kind === 'query' ? [{ label: task.query?.market ? 'Search my rows only' : 'Search the market too', run: () => app.toggleQueryMarket(at, task) }] : []),
    ...(task.kind !== 'ref' ? (['task', 'plain', 'note', 'comment', 'template'] as RowKind[]).filter((k) => k !== task.kind).map((k) => ({ label: `Change to ${ROW_KIND_LABEL[k].toLowerCase()}`, run: () => app.setRowKindAt(at, task.id, k) })) : []),
    ...(task.kind === 'note' ? [{ label: 'Export note (.md)', run: () => { const ctx = noteContext(task.title, noteChildren(task, at, state, app)); downloadText(noteFilename(task.title), exportNote(ctx)) } }] : []),
    { label: 'Indent', keys: 'Tab', run: () => { app.select([...at, task.id]); app.indentSelected(false) } },
    { label: 'Outdent', keys: 'Shift+Tab', run: () => { app.select([...at, task.id]); app.indentSelected(true) }, disabled: at.length === 0 },
    { label: 'Move up', disabled: (viewAt(state.replica, [...state.view, ...at])?.tasks.findIndex((t) => t.id === task.id) ?? 0) <= 0, keys: 'Alt+↑', run: () => { app.select([...at, task.id]); app.moveSelected('up') } },
    { label: 'Move down', disabled: (() => { const rows = viewAt(state.replica, [...state.view, ...at])?.tasks ?? []; return rows.findIndex((t) => t.id === task.id) === rows.length - 1 })(), keys: 'Alt+↓', run: () => { app.select([...at, task.id]); app.moveSelected('down') } },
    ...(canInvite ? [{ label: 'Invite a device here', run: () => { app.zoomTo([...at, task.id]); void app.startInvite() } }] : []),
    ...(canInvite ? [{ label: 'Sync only this on this device', run: () => app.attachAt([...app.currentScope(), ...at, task.id]), disabled: !app.canAttach([...app.currentScope(), ...at, task.id]) }] : []),
    { label: 'Delete', keys: 'Ctrl+Shift+⌫', run: () => app.deleteTaskAt(at, task.id), danger: true }
  ]
}

function renderContextMenu(el: HTMLElement, state: AppState, app: App): void {
  const menu = state.contextMenu
  el.hidden = !menu
  if (!menu) { el.replaceChildren(); return }
  const actions: Action[] = menu.kind === 'task'
    ? taskActions(menu.at, app.rowAt([...menu.at, menu.task.id]) ?? menu.task, app)
    : [{ label: 'Remove this device from the node', run: () => app.removePeer(menu.peerId), danger: true }]
  const groupOf = (label: string) => /^Delete/.test(label) ? 'Delete' : /^Change to/.test(label) ? 'Change type' : /^(Move|Indent|Outdent|Zoom|Go to)/.test(label) ? 'Move' : /^(Connect peer|Spawn virtual|Invite|Sync|Send|List|Remove from market|Add @|Attach MCP)/.test(label) ? 'Sharing' : 'Add and edit'
  const items: HTMLElement[] = []
  for (const group of ['Add and edit', 'Change type', 'Move', 'Sharing', 'Delete']) {
    const grouped = actions.filter((action) => groupOf(action.label) === group)
    if (!grouped.length) continue
    items.push(div('menu-group-label muted', group))
    for (const a of grouped) {
      const b = button('menu-item' + (a.danger ? ' danger' : ''), a.label, () => { app.closeContextMenu(); a.run() })
      if (a.keys) b.append(span('key-hint', a.keys))
      b.disabled = !!a.disabled
      items.push(b)
    }
  }
  el.replaceChildren(...items)
  // place next to the selected row (or the peers list)
  const anchor = menu.kind === 'task'
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
// Link panel: members, history and proposals of the node being viewed

function renderLinkPanel(el: HTMLElement, node: NodeView, state: AppState, app: App): void {
  el.hidden = !node.isLink
  if (!node.isLink) { el.replaceChildren(); return }
  const head = div('link-head', '')
  head.append(span('link-badge', '⛓ link node'), span('muted', ` ${node.versions} previous version${node.versions === 1 ? '' : 's'}`))
  const members = div('muted members', '')
  if (node.members.length) {
    members.append(span('', 'Members: '))
    node.members.forEach((m) => {
      const row = span('peer-row', '')
      const dot = span('presence' + (app.isOnline(m.peerId) ? ' online' : ''), '')
      dot.title = app.isOnline(m.peerId) ? 'online' : 'offline (still a member)'
      row.append(dot, span('', `${m.name ?? peerLabel(m.peerId, state)} · ${m.peerId.slice(0, 8)}${app.isOnline(m.peerId) ? '' : ' · offline'}${m.capabilities.includes('approve') ? ' (can approve)' : ''}`))
      members.append(row)
    })
  } else {
    members.textContent = 'No members yet. Invite a device from the ☰ menu.'
  }
  const items: HTMLElement[] = [head, members]
  if (node.proposals.length && !app.readsRequests()) {
    // requests reach a device only when it reads them (policy "from: read requests"); they are never pushed into its tree
    items.push(div('muted', `${node.proposals.length} request${node.proposals.length === 1 ? '' : 's'} not shown: this device does not read requests (policy towards fos, in the context panel).`))
  } else if (node.proposals.length) {
    const h = document.createElement('h2')
    h.textContent = node.proposals.length === 1 ? '1 proposal' : `${node.proposals.length} proposals`
    items.push(h)
    const mayApprove = app.canApprove(node)
    for (const p of node.proposals) {
      const card = document.createElement('article')
      card.className = 'proposal'
      const mine = p.peerId === state.replica.meta.peerId
      const status = p.status === 'rejected' ? ' (rejected)' : mine ? ' (waiting for approval)' : ''
      card.append(div('proposal-title', `${mine ? 'Your changes' : p.name || peerLabel(p.peerId, state)}${status}`))
      if (p.status === 'rejected') card.classList.add('rejected')
      const parts: string[] = []
      if (p.summary.added.length) parts.push(`adds ${p.summary.added.map((t) => `“${t}”`).join(', ')}`)
      if (p.summary.changed.length) parts.push(`changes ${p.summary.changed.map((t) => `“${t}”`).join(', ')}`)
      if (p.summary.removed.length) parts.push(`removes ${p.summary.removed.map((t) => `“${t}”`).join(', ')}`)
      card.append(div('muted', parts.length ? parts.join('; ') : 'no task changes (order or details)'))
      if (mine && p.status === 'rejected') card.append(button('secondary small', 'Discard rejected changes', () => app.discardProposal(p.id)))
      if (mayApprove && p.status === 'open') {
        const row = div('row', '')
        row.append(button('primary small', 'Approve and merge', () => void app.decideProposal(p.id, 'approve')), button('danger small', 'Reject', () => void app.decideProposal(p.id, 'reject')))
        card.append(row)
      }
      items.push(card)
    }
  }
  el.replaceChildren(...items)
}

/**
 * Settings at the device's root: one row per peer this device reaches, including the fos
 * account server (sign-in happens on its row when not connected; its policy lines below it) and the members and
 * attached devices of the Home node, with the capability rows the owner exposes to each (`to`) and accepts from each
 * (`from`). Constructors beneath the root use the ordinary row editor.
 */
function renderRootRows(state: AppState, app: App): HTMLElement[] {
  const rows: HTMLElement[] = []
  const rowShell = (cls: string): HTMLLIElement => {
    const li = document.createElement('li')
    li.className = 'task root-row ' + cls
    li.style.setProperty('--depth', '0')
    return li
  }
  const peers = app.contextPeers()
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
    if (p.isAccount && !state.session) title.append(button('primary small', 'Sign in', () => app.openModal('connect')), span('muted', ' not connected: sign in to sync with your account and use its services'))
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
    const meta = span('row-meta', '')
    if (p.member && owner) { const remove = button('icon more small-icon', '×', () => app.removePeerHere(p.id)); remove.title = `Remove @${p.name} from Home`; meta.append(remove) }
    else if (state.session?.kind === 'user' && !p.isAccount && !p.member && !p.integration && !p.mcp && p.id !== state.replica.meta.peerId) { const more = button('icon more small-icon', '⋯', () => app.openContextMenu({ kind: 'peer', peerId: p.id })); more.title = 'Device actions'; meta.append(more) }
    const body = div('peer-body', '')
    const details = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = 'Connection and capabilities'
    details.append(summary, connection, lines)
    details.className = 'peer-details'
    body.append(title, details)
    li.append(span('zoom-dot', ''), span('handle', ''), dot, body, meta)
    rows.push(li)
  }
  {
    const li = rowShell('add-peer-row')
    const form = document.createElement('form')
    form.className = 'row add-peer'
    const type = document.createElement('select')
    type.setAttribute('aria-label', 'Peer connection type')
    type.append(new Option('Choose a connection…', ''), new Option('Fos account member', 'member'), new Option('Direct device connection', 'direct'), new Option('Invite device', 'invite'))
    if (app.canSpawnVirtualPeer()) type.append(new Option('Virtual peer (new tab)', 'virtual'))
    for (const p of peers.filter((p) => p.integration && !p.integration.connected)) {
      const option = new Option(`${p.integration!.kind === 'oauth' ? 'OAuth: ' : ''}${p.name}`, p.id)
      option.disabled = !state.session || !p.integration!.configured || p.integration!.kind === 'platform'
      if (option.disabled) option.text += ' (unavailable)'
      type.append(option)
    }
    const input = document.createElement('input')
    input.placeholder = '@username'
    input.autocomplete = 'off'
    input.id = 'add-peer-name'
    input.hidden = true
    type.addEventListener('change', () => { input.hidden = type.value !== 'member' })
    const go = button('secondary small', 'Add peer', () => undefined)
    go.type = 'submit'
    form.append(type, input, go)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      if (type.value === 'member') { if (owner) app.addPeerHere(input.value); else app.notify('error', 'Sign in as the owner to add a member.'); input.value = '' }
      else if (type.value === 'virtual') app.openModal('virtual')
      else if (type.value === 'direct') app.openModal('direct')
      else if (type.value === 'invite') void app.startInvite()
      else if (type.value.startsWith('integration:')) void app.connectIntegration(type.value.slice('integration:'.length))
    })
    li.append(span('zoom-dot', ''), span('handle', ''), form)
    rows.push(li)
  }
  if (app.canResetHome()) {
    const scoped = state.replica.meta.scope.length > 0
    const li = rowShell('reset-data-row')
    li.append(button('danger small', scoped ? 'Reset attached node content…' : 'Reset Home content…', () => {
      if (window.confirm('Clear all rows and choices in this device’s attached node? This change syncs to connected devices. Account, peer connections and version history remain. You can undo this during this session.')) app.resetHome()
    }))
    if (state.session?.kind === 'user') li.append(button('danger small', 'Reset entire account content…', () => {
      if (window.confirm('Clear ALL rows and choices in this account, including outside this device’s attached subtree? This syncs to other devices. Account and peer connections remain. You can undo this during this session.')) void app.resetAccount()
    }))
    rows.push(li)
  }
  const sessions = app.dataSessions()
  if (sessions.length) {
    const li = rowShell('data-sessions-row')
    const label = document.createElement('label'); label.textContent = 'Saved data session: '
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Saved data session')
    for (const session of sessions) select.append(new Option(`${session.owner ? session.owner.username : 'Offline'} · ${session.id.slice(0, 8)}`, session.id))
    select.value = app.activeDataSession()?.id ?? ''
    select.addEventListener('change', () => app.switchDataSession(select.value))
    label.append(select); li.append(label, div('muted', 'Switching keeps each session’s data separate and disconnects sync. Sign in to reconnect its account.'))
    rows.push(li)
  }
  const constructors = app.currentView()
  if (constructors) rows.push(...renderRows(constructors, [], 0, state, app))
  return rows
}

function renderFooter(el: HTMLElement, state: AppState, app: App): void {
  const items: HTMLElement[] = []
  const history = div('row', '')
  for (const redo of [false, true]) {
    const control = button('secondary small', redo ? 'Redo' : 'Undo', () => runHistory(app, redo))
    control.disabled = redo ? !app.canRedo : !app.canUndo
    control.addEventListener('mousedown', (event) => event.preventDefault())
    history.append(control)
  }
  items.push(history)
  if (state.virtual) items.push(div('muted', `${state.virtual.name} · virtual peer of ${state.virtual.hostName}${state.virtual.capabilities.includes('read') && !state.virtual.capabilities.includes('edit') ? ' · read-only (local edits stay here)' : ''}`))
  if (state.notice) items.push(div(`notice ${state.notice.kind}`, state.notice.text))
  const meta = div('meta', '')
  meta.append(span('muted', `${state.deviceName} · ${state.replica.meta.peerId.slice(0, 8)}`))
  if (state.session) meta.append(span('muted', ` · ${state.session.username}${state.session.kind === 'peer' ? ' (invited)' : ''}`))
  if (!state.session && app.isLocal()) meta.append(button('link small', 'Connect', () => app.openModal('connect')))
  items.push(meta)
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
  return [state.modal, state.connectFlow.phase, state.invite?.token ?? '', d?.role ?? '', d?.phase ?? '', (d?.role === 'host' ? d.pendingPeer?.peerId ?? '' : ''), state.manual.requestCode ? 'rq' : '', state.manual.resultCode ? 'rs' : '', state.requests.map((r) => r.id).join(','), state.device?.status ?? '', state.device?.name ?? '', state.market?.aliasId ?? '', state.market?.phase ?? '', state.market?.error ?? '', state.phone?.phase ?? '', state.phone?.error ?? ''].join('|')
}

function updateModalDynamic(el: HTMLElement, state: AppState, app: App): void {
  const err = el.querySelector('[data-dynamic="error"]')
  if (err) err.textContent = state.loginError ?? state.manual.error ?? ''
  void app
}

function modalTitle(kind: AppState['modal']): string {
  return kind === 'virtual' ? 'Spawn virtual peer' : kind === 'work' ? 'Delegate and review' : kind === 'connect' ? 'Connect this device' : kind === 'invite' ? 'Invite a device' : kind === 'requests' ? 'Connection requests' : kind === 'device' ? 'Approve a sign-in' : kind === 'market' ? 'Market listing' : kind === 'help' ? 'Keys and row syntax' : kind === 'phone' ? 'Link your phone' : 'Direct connect'
}

function renderWork(body: HTMLElement, state: AppState, app: App): void {
  const work = state.work
  if (!work) return
  body.append(div('muted', 'This sends the preview below to the fos model to propose a plan or specification. Accepting its result fulfills this request; you still decide when the task is done.'))
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
  if (app.canMergeOffline()) {
    const label = document.createElement('label')
    const merge = document.createElement('input'); merge.type = 'checkbox'; merge.name = 'mergeOffline'
    label.append(merge, document.createTextNode(' Merge this offline session’s data into the account'))
    form.append(label)
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    void app.login(String(data.get('username') ?? ''), String(data.get('password') ?? ''), false, data.get('mergeOffline') === 'on')
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
  if (!invite) { body.append(div('muted', 'Creating an invite…')); return }
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
  el.textContent = text
  el.addEventListener('click', onClick)
  return el
}
