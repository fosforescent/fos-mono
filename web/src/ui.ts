/**
 * DOM rendering. The shell is built once; each state change re-renders the
 * dynamic regions from the app state and the replica's view model (plain ids,
 * titles and flags; no content addresses reach this file).
 */

import QRCode from 'qrcode'
import { isDirty, view as viewAt, type ChoiceView, type MovePosition, type NodeView, type Scope, type TaskView } from '../../shared/sync/index'
import type { App, AppState } from './app'

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
  peers: HTMLElement
  footer: HTMLElement
  modal: HTMLElement
  addInput: HTMLInputElement
}

let editingTaskId: string | null = null
let scanner: { stop(): Promise<void> } | null = null
let lastModalKey = ''

export function mountUi(root: HTMLElement, app: App): void {
  root.innerHTML = `
    <header class="topbar">
      <div class="brand-row">
        <button type="button" class="icon menu-button" data-region="menu-button" aria-label="Menu">☰</button>
        <span class="local-badge" data-region="local-badge" hidden>local</span>
        <div class="brand">Fosforescent</div>
      </div>
      <div class="status" data-region="status"></div>
      <nav class="menu" data-region="menu" hidden></nav>
    </header>
    <section class="banner" data-region="banner" hidden></section>
    <nav class="crumbs" data-region="crumbs"></nav>
    <section class="choices" data-region="choices"></section>
    <section class="link-panel" data-region="link" hidden></section>
    <section class="tasks">
      <form class="add" data-region="add">
        <input name="title" type="text" placeholder="Add a task…" autocomplete="off" enterkeyhint="done" />
        <button type="submit">Add</button>
      </form>
      <ul class="list tree" data-region="list"></ul>
    </section>
    <section class="peers-here" data-region="peers"></section>
    <footer class="footer" data-region="footer"></footer>
    <div class="context-menu" data-region="context" hidden></div>
    <div class="modal-backdrop" data-region="modal" hidden></div>
  `
  const q = <T extends HTMLElement>(name: string): T => root.querySelector(`[data-region="${name}"]`) as T
  const addForm = q<HTMLFormElement>('add')
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
    peers: q('peers'),
    footer: q('footer'),
    modal: q('modal'),
    addInput: addForm.querySelector('input') as HTMLInputElement
  }

  addForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const title = regions.addInput.value
    if (title.trim()) {
      app.addTask(title)
      regions.addInput.value = ''
    }
    regions.addInput.focus()
  })
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

  app.subscribe((state) => render(regions, state, app))
}

function render(regions: Regions, state: AppState, app: App): void {
  renderStatus(regions.status, state)
  regions.localBadge.hidden = !app.isLocal()
  renderMenu(regions.menu, state, app)
  renderBanner(regions.banner, state, app)
  renderModal(regions.modal, state, app)

  const node = app.currentView()
  if (!node) {
    app.goTo([]) // the viewed node vanished (e.g. removed by a merge)
    return
  }
  renderCrumbs(regions.crumbs, state, app)
  renderChoices(regions.choices, node, state, app)
  renderLinkPanel(regions.link, node, state, app)
  renderTree(regions.list, node, state, app)
  renderPeersHere(regions.peers, node, app)
  renderFooter(regions.footer, state, app)
  renderContextMenu(regions.context, state, app)
}

// ---------------------------------------------------------------------------

function renderStatus(el: HTMLElement, state: AppState): void {
  const dirty = isDirty(state.replica)
  const labels: Record<AppState['connection'], string> = { offline: 'Offline', connecting: 'Connecting…', online: 'Online', syncing: 'Syncing…' }
  const lastSync = state.replica.meta.lastSyncAt
  el.className = `status status-${state.connection}`
  el.replaceChildren(
    span('dot', ''),
    span('status-text', labels[state.connection]),
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
  item('Keyboard: ↑↓ select · Enter edit · Space done · Tab/⇧Tab indent · Alt+↑↓ move · Z zoom · ⌫ zoom out · Del delete · . menu', () => undefined, 'hint')
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
  if (session) item('Detach this device from its node', () => void app.detach(), 'danger')
  const name = document.createElement('div')
  name.className = 'menu-meta'
  name.append(span('muted', `This device: ${state.deviceName}`), button('link small', 'rename', () => {
    const next = window.prompt('Name this device', state.deviceName)
    if (next) app.setDeviceName(next)
  }))
  items.push(name)
  el.replaceChildren(...items)
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
  const chipText = transport === 'direct'
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
  const rootCrumb = button('crumb', pathLabel(labels.scope), () => app.goTo([]))
  crumbs.append(rootCrumb)
  view.forEach((_id, index) => {
    crumbs.append(span('sep', '›'), button('crumb', labels.view[index] ?? '…', () => app.goTo(view.slice(0, index + 1))))
  })
  if (view.length === 0) rootCrumb.classList.add('current')
  else (crumbs.lastElementChild as HTMLElement).classList.add('current')

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

let addingUnder: string | null = null
let drag: { id: string; at: Scope } | null = null
let pointerDown = false
document.addEventListener('mouseup', () => { pointerDown = false })

function renderTree(el: HTMLElement, node: NodeView, state: AppState, app: App): void {
  if (node.tasks.length === 0 && node.choices.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty'
    empty.textContent = 'No tasks here yet.'
    el.replaceChildren(empty)
    return
  }
  el.replaceChildren(...renderRows(node, [], 0, state, app))
}

/** Rows for `node`'s tasks (and nested choices) at `depth`; `at` is the path relative to the view. */
function renderRows(node: NodeView, at: Scope, depth: number, state: AppState, app: App): HTMLElement[] {
  const rows: HTMLElement[] = []
  node.tasks.forEach((task, index) => {
    rows.push(renderRow(task, at, depth, index, node.tasks.length, state, app))
    const expanded = !state.collapsed.includes(task.id)
    if (addingUnder === task.id) rows.push(renderInlineAdd(task, at, depth + 1, app))
    if (expanded && (task.childCount > 0 || task.childChoices > 0)) {
      const child = viewAt(state.replica, [...state.view, ...at, task.id])
      if (child) {
        child.choices.forEach((choice) => rows.push(renderNestedChoice(choice, [...at, task.id], depth + 1, state, app)))
        rows.push(...renderRows(child, [...at, task.id], depth + 1, state, app))
      }
    }
  })
  return rows
}

function renderRow(task: TaskView, at: Scope, depth: number, index: number, siblingCount: number, state: AppState, app: App): HTMLElement {
  const path: Scope = [...at, task.id]
  const selected = !!state.selected && state.selected.length === path.length && state.selected.every((p, i) => path[i] === p)
  const li = document.createElement('li')
  li.className = 'task' + (task.checkable ? '' : ' plain') + (task.done ? ' done' : '') + (task.isLink ? ' linked' : '') + (selected ? ' selected' : '')
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
    if ((event.target as HTMLElement).closest('input, button')) return
    if (!selected) app.select(path)
  })
  li.addEventListener('contextmenu', (event) => { event.preventDefault(); app.select(path); app.openContextMenu({ kind: 'task', at, task }) })

  // --- drag and drop: above / below / into, decided by where the pointer is on the row
  li.addEventListener('dragstart', (event) => {
    drag = { id: task.id, at }
    event.dataTransfer?.setData('text/plain', task.id)
    li.classList.add('dragging')
  })
  li.addEventListener('dragend', () => { drag = null; li.classList.remove('dragging'); clearDropMarks(li) })
  li.addEventListener('dragover', (event) => {
    if (!drag || drag.id === task.id) return
    event.preventDefault()
    const position = dropPosition(li, event.clientY)
    li.classList.toggle('drop-above', position === 'above')
    li.classList.toggle('drop-below', position === 'below')
    li.classList.toggle('drop-into', position === 'into')
  })
  li.addEventListener('dragleave', () => clearDropMarks(li))
  li.addEventListener('drop', (event) => {
    event.preventDefault()
    clearDropMarks(li)
    if (!drag || drag.id === task.id) return
    const position = dropPosition(li, event.clientY)
    const move: MovePosition = position === 'into' ? { into: task.id } : { relativeTo: task.id, position }
    app.moveTask(drag.at, drag.id, at, move)
    drag = null
  })

  const handle = span('handle', '⋮⋮')
  handle.title = 'Drag to move'

  const hasChildren = task.childCount > 0 || task.childChoices > 0
  const toggle = button('icon toggle', hasChildren ? (state.collapsed.includes(task.id) ? '▸' : '▾') : '·', () => { if (hasChildren) app.toggleCollapsed(task.id) })
  toggle.disabled = !hasChildren
  toggle.tabIndex = -1

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = task.done
  checkbox.hidden = !task.checkable // a legacy plain node has no completion
  checkbox.disabled = !task.checkable
  checkbox.tabIndex = -1
  checkbox.addEventListener('change', () => app.toggleTaskAt(at, task))

  let body: HTMLElement
  if (editingTaskId === task.id) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'edit'
    input.value = task.title
    const commit = () => {
      if (editingTaskId !== task.id) return
      editingTaskId = null
      app.renameTaskAt(at, task.id, input.value)
      app.refresh()
    }
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit()
      if (event.key === 'Escape') { editingTaskId = null; app.refresh() }
      event.stopPropagation()
    })
    input.addEventListener('blur', commit)
    body = input
    queueMicrotask(() => { input.focus(); input.select() })
  } else {
    body = span('title', task.title)
    body.title = 'Double-click or press Enter to edit'
    body.addEventListener('dblclick', () => { editingTaskId = task.id; app.refresh() })
  }

  const meta = span('row-meta', '')
  if (task.subtreeTasks > 0) meta.append(span('muted', `${task.subtreeDone}/${task.subtreeTasks}`))
  if (task.isLink) { const b = span('link-badge', '⛓'); b.title = 'Link node: other devices attach here; their changes arrive as proposals'; meta.append(b) }

  const more = button('icon more', '⋯', () => { app.select(path); app.openContextMenu({ kind: 'task', at, task }) })
  more.title = 'Actions (or right-click)'
  more.tabIndex = -1
  void index; void siblingCount

  li.append(handle, toggle, checkbox, body, meta, more)
  return li
}

function renderInlineAdd(parent: TaskView, at: Scope, depth: number, app: App): HTMLElement {
  const li = document.createElement('li')
  li.className = 'task inline-add'
  li.style.setProperty('--depth', String(depth))
  const form = document.createElement('form')
  form.className = 'add'
  form.innerHTML = `<input type="text" placeholder="Subtask of “${parent.title}”…" autocomplete="off" enterkeyhint="done" /><button type="submit">Add</button>`
  const input = form.querySelector('input') as HTMLInputElement
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (input.value.trim()) app.addTaskAt([...at, parent.id], input.value)
    input.value = ''
    input.focus()
  })
  input.addEventListener('keydown', (event) => { if (event.key === 'Escape') { addingUnder = null; app.refresh() } })
  li.append(form)
  queueMicrotask(() => input.focus())
  return li
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
    { label: 'Add subtask', keys: 'Ctrl+Enter', run: () => { addingUnder = task.id; if (state.collapsed.includes(task.id)) app.toggleCollapsed(task.id); else app.refresh() } },
    { label: 'Zoom in', keys: 'Z', run: () => app.zoomTo([...at, task.id]) },
    { label: 'Edit title', keys: 'Enter', run: () => { editingTaskId = task.id; app.refresh() } },
    { label: task.done ? 'Mark open' : 'Mark done', keys: 'Space', run: () => app.toggleTaskAt(at, task) },
    { label: 'Indent', keys: 'Tab', run: () => { app.select([...at, task.id]); app.indentSelected(false) } },
    { label: 'Outdent', keys: 'Shift+Tab', run: () => { app.select([...at, task.id]); app.indentSelected(true) }, disabled: at.length === 0 },
    { label: 'Move up', keys: 'Alt+↑', run: () => { app.select([...at, task.id]); app.moveSelected('up') } },
    { label: 'Move down', keys: 'Alt+↓', run: () => { app.select([...at, task.id]); app.moveSelected('down') } },
    ...(canInvite ? [{ label: 'Invite a device here', run: () => { app.zoomTo([...at, task.id]); void app.startInvite() } }] : []),
    ...(canInvite ? [{ label: 'Sync only this on this device', run: () => app.attachAt([...app.currentScope(), ...at, task.id]), disabled: !app.canAttach([...app.currentScope(), ...at, task.id]) }] : []),
    { label: 'Delete', keys: 'Del', run: () => app.deleteTaskAt(at, task.id), danger: true }
  ]
}

function renderContextMenu(el: HTMLElement, state: AppState, app: App): void {
  const menu = state.contextMenu
  el.hidden = !menu
  if (!menu) { el.replaceChildren(); return }
  const actions: Action[] = menu.kind === 'task'
    ? taskActions(menu.at, menu.task, app)
    : [{ label: 'Remove this device from the node', run: () => app.removePeer(menu.peerId), danger: true }]
  const items = actions.map((a) => {
    const b = button('menu-item' + (a.danger ? ' danger' : ''), a.label, () => { app.closeContextMenu(); a.run() })
    if (a.keys) b.append(span('key-hint', a.keys))
    b.disabled = !!a.disabled
    return b
  })
  el.replaceChildren(...items)
  // place next to the selected row (or the peers list)
  const anchor = menu.kind === 'task'
    ? (document.querySelector(`.tree .task[data-id="${menu.task.id}"] .more`) as HTMLElement | null)
    : (document.querySelector(`.peer-row[data-peer="${menu.peerId}"] .more`) as HTMLElement | null)
  const rect = anchor?.getBoundingClientRect()
  el.style.top = `${(rect ? rect.bottom : 80) + window.scrollY + 4}px`
  el.style.right = `${Math.max(8, window.innerWidth - (rect ? rect.right : window.innerWidth - 16))}px`
}

function handleKey(event: KeyboardEvent, app: App): void {
  const target = event.target as HTMLElement | null
  if (target && target.closest('input, textarea, select, [contenteditable]')) return
  if (app.state.modal) return
  if (event.key === 'Escape') { app.closeContextMenu(); app.toggleMenu(false); return }
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

  if (event.key === 'ArrowDown' && !event.altKey) { event.preventDefault(); focusRow(Math.min(rows.length - 1, selectedIndex + 1)); return }
  if (event.key === 'ArrowUp' && !event.altKey) { event.preventDefault(); focusRow(Math.max(0, selectedIndex - 1)); return }
  if (!sel || selectedIndex < 0) {
    if (event.key === 'Backspace') { event.preventDefault(); app.zoomOut() }
    return
  }
  const at = sel.slice(0, -1)
  const id = sel[sel.length - 1] as string
  const task = (viewAt(state.replica, [...state.view, ...at])?.tasks ?? []).find((t) => t.id === id)
  if (!task) return
  const alt = event.altKey
  switch (true) {
    case event.key === 'Enter' && (event.ctrlKey || event.metaKey):
      event.preventDefault(); addingUnder = task.id; if (state.collapsed.includes(task.id)) app.toggleCollapsed(task.id); else app.refresh(); break
    case event.key === 'Enter':
      event.preventDefault(); editingTaskId = task.id; app.refresh(); break
    case event.key === ' ':
      event.preventDefault(); app.toggleTaskAt(at, task); break
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
    case event.key.toLowerCase() === 'z':
      event.preventDefault(); app.zoomTo([...at, task.id]); break
    case event.key === 'Backspace':
      event.preventDefault(); app.zoomOut(); break
    case event.key === 'Delete':
      event.preventDefault(); app.deleteTaskAt(at, task.id); break
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
      row.append(dot, span('', `${m.name ?? peerLabel(m.peerId, state)}${m.capabilities.includes('approve') ? ' (can approve)' : ''}`))
      members.append(row)
    })
  } else {
    members.textContent = 'No members yet. Invite a device from the ☰ menu.'
  }
  const items: HTMLElement[] = [head, members]
  if (node.proposals.length) {
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

function renderPeersHere(el: HTMLElement, node: NodeView, app: App): void {
  if (!node.peers.length) { el.replaceChildren(); el.hidden = true; return }
  el.hidden = false
  const peers = div('peers', '')
  peers.append(span('muted', 'Devices attached here: '))
  for (const p of node.peers) {
    const row = span('peer-row', '')
    row.dataset.peer = p
    const dot = span('presence' + (app.isOnline(p) ? ' online' : ''), '')
    dot.title = app.isOnline(p) ? 'online' : 'offline (still attached)'
    row.append(dot, span('', peerLabel(p, app.state)))
    if (app.state.session?.kind === 'user' && p !== app.state.replica.meta.peerId) {
      const more = button('icon more small-icon', '⋯', () => app.openContextMenu({ kind: 'peer', peerId: p }))
      more.title = 'Device actions'
      row.append(more)
    }
    peers.append(row)
  }
  el.replaceChildren(peers)
}

function renderFooter(el: HTMLElement, state: AppState, app: App): void {
  const items: HTMLElement[] = []
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
  card.className = 'modal'
  const header = document.createElement('div')
  header.className = 'modal-header'
  header.append(span('modal-title', modalTitle(kind)), button('icon', '×', () => app.closeModal()))
  card.append(header)
  const body = div('modal-body', '')
  if (kind === 'connect') renderConnect(body, state, app)
  if (kind === 'invite') renderInvite(body, state, app)
  if (kind === 'requests') renderRequests(body, state, app)
  if (kind === 'direct') renderDirect(body, state, app)
  if (kind === 'device') renderDevice(body, state, app)
  card.append(body)
  el.replaceChildren(card)
}

function modalKey(state: AppState): string {
  const d = state.direct
  return [state.modal, state.connectFlow.phase, state.invite?.token ?? '', d?.role ?? '', d?.phase ?? '', (d?.role === 'host' ? d.pendingPeer?.peerId ?? '' : ''), state.manual.requestCode ? 'rq' : '', state.manual.resultCode ? 'rs' : '', state.requests.map((r) => r.id).join(','), state.device?.status ?? '', state.device?.name ?? ''].join('|')
}

function updateModalDynamic(el: HTMLElement, state: AppState, app: App): void {
  const err = el.querySelector('[data-dynamic="error"]')
  if (err) err.textContent = state.loginError ?? state.manual.error ?? ''
  void app
}

function modalTitle(kind: AppState['modal']): string {
  return kind === 'connect' ? 'Connect this device' : kind === 'invite' ? 'Invite a device' : kind === 'requests' ? 'Connection requests' : kind === 'device' ? 'Approve a sign-in' : 'Direct connect'
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
  body.append(div('muted', 'You are working locally. Connect to sync with your account or another device; your local tasks merge in.'))

  // --- sign in
  body.append(h4('Sign in'))
  const form = document.createElement('form')
  form.className = 'login'
  form.innerHTML = `
    <input name="username" type="text" placeholder="username or email" autocomplete="username" required />
    <input name="password" type="password" placeholder="password" autocomplete="current-password" required />
    <button type="submit" class="primary">Sign in</button>
  `
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    void app.login(String(data.get('username') ?? ''), String(data.get('password') ?? ''))
  })
  body.append(form, div('error', state.loginError ?? '', 'error'))

  // --- invite token
  body.append(h4('Connection token or QR code'))
  body.append(div('muted', 'Someone invites this device to one of their nodes; paste the token or scan their QR code, then wait for them to approve.'))
  const flow = state.connectFlow
  if (flow.phase === 'waiting') {
    body.append(div('pending-box', `Waiting for approval to attach to ${pathLabel(flow.scopeNames)}…`))
    body.append(button('secondary small', 'Cancel', () => app.closeModal()))
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
    body.append(tokenRow)
    body.append(scanButton((text) => { input.value = text; void app.connectWithToken(text) }, body))
    if (flow.phase === 'error') body.append(div('error', flow.message))
    if (flow.phase === 'denied') body.append(div('error', 'The owner denied this device.'))
    if (flow.phase === 'expired') body.append(div('error', 'That invite expired. Ask for a new one.'))
  }

  // --- direct
  body.append(h4('Direct, device to device'))
  body.append(div('muted', 'No account needed: connect straight to another device nearby, with a QR code or by pasting codes.'))
  body.append(button('secondary', 'Direct connect…', () => app.openModal('direct')))
  body.append(div('muted small-print', 'You can keep working locally and connect later from the ☰ menu.'))
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
