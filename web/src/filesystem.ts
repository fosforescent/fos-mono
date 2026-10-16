import type { App } from './app'
import { inTauri, tauriInvoke } from './project'
import { localRepository } from './agents'
import { combobox } from './combobox'
import { iconSvg } from './icons'
import { renderMarkdown } from './markdown'

/** Provider rows are view data, never graph tasks or replica serialization input. */
export type UnreplicatedRow = { replicated: false; provider: 'filesystem'; id: string; title: string; directory: boolean; template: string }
type Entry = { name: string; path: string; is_directory: boolean }
type Listing = { current_path: string; entries: Entry[] }
export function filesystemProjection(entries: Entry[]): UnreplicatedRow[] {
  return entries.filter(entry => entry.name !== '.fos' && entry.name !== '.git').map(entry => ({ replicated: false, provider: 'filesystem', id: entry.path, title: entry.name, directory: entry.is_directory, template: filesystemTemplate(entry.name, entry.is_directory) }))
}
export function filesystemTemplate(name: string, directory: boolean): string {
  if (directory) return 'Folder'
  const extension = name.lastIndexOf('.') > 0 ? name.split('.').at(-1)!.toLowerCase() : ''
  return ({ md: 'Markdown', markdown: 'Markdown', txt: 'Text', json: 'JSON', csv: 'CSV', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', py: 'Python', rs: 'Rust', html: 'HTML', css: 'CSS' } as Record<string, string>)[extension] ?? (extension ? `${extension.toUpperCase()} file` : 'File')
}
function bindingKey(app: App): string {
  return 'fos:filesystem:' + JSON.stringify([app.state.session?.baseUrl ?? location.origin, app.state.session?.username ?? null, app.state.replica.meta.peerId, app.state.replica.meta.scope, app.state.view])
}

type Navigation = { key: string; store: App['state']['replica']['store']; root: string; trail: UnreplicatedRow[] }
const navigation = new WeakMap<App, Navigation>()
export function filesystemNavigation(app: App): Navigation | null {
  const value = navigation.get(app)
  if (value && value.key === bindingKey(app) && value.store === app.state.replica.store) return value
  navigation.delete(app); return null
}
function open(app: App, root: string, row: UnreplicatedRow, trail: UnreplicatedRow[] = []) {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  navigation.set(app, { key: bindingKey(app), store: app.state.replica.store, root, trail: [...trail, row] })
  app.state.selected = null
  app.refresh()
}
export function filesystemBack(app: App): void {
  const value = filesystemNavigation(app)
  if (!value) return
  value.trail.pop()
  if (!value.trail.length) navigation.delete(app)
  app.refresh()
}
function action(label: string, run: () => void, className = 'secondary small'): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.onclick = run; return button
}
function directoryRows(app: App, root: string, path: string, trail: UnreplicatedRow[], search: string): HTMLElement {
  const loading = document.createElement('li'); loading.className = 'muted'; loading.textContent = 'Loading...'
  const key = bindingKey(app), store = app.state.replica.store
  queueMicrotask(async () => {
    try {
      const listing = await tauriInvoke<Listing>('list_node_directory', { root, path })
      if (!loading.isConnected || key !== bindingKey(app) || store !== app.state.replica.store || !listing) return
      const rows = filesystemProjection(listing.entries).filter(row => !search || row.title.toLowerCase().includes(search.toLowerCase())).map(row => {
        const item = document.createElement('li'); item.className = 'task kind-plain filesystem-row'; item.dataset.replicated = 'false'; item.tabIndex = 0
        item.style.setProperty('--depth', '0')
        const enter = () => open(app, root, row, trail)
        const zoom = action('', enter, 'zoom-dot'); zoom.innerHTML = iconSvg('\u25c9') ?? ''; zoom.setAttribute('aria-label', `Open ${row.title}`)
        const title = document.createElement('span'); title.className = 'title'; title.textContent = row.title
        const template = document.createElement('span'); template.className = 'kind-badge tpl'; template.textContent = row.template
        item.append(zoom, title, template)
        item.ondblclick = enter
        item.onkeydown = event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); const sibling = event.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling; if (sibling instanceof HTMLElement) sibling.focus(); return } if (event.key === 'Enter' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); enter() } }
        return item
      })
      if (rows.length) loading.replaceWith(...rows)
      else loading.textContent = 'No files.'
    } catch (error) { if (loading.isConnected) loading.textContent = String(error) }
  })
  return loading
}

/** Files join the existing outline; they never become graph tasks. */
export function filesystemRows(app: App, search = ''): HTMLElement | null {
  if (!inTauri()) return null
  let root: string | null = null
  try { root = localStorage.getItem(bindingKey(app)) } catch { /* storage unavailable */ }
  root ??= localRepository(app.state.replica, app.state.view)
  return root ? directoryRows(app, root, root, [], search) : null
}

/** The same workspace regions now point at a transient filesystem node. */
export function renderFilesystemNode(regions: { node: HTMLElement; list: HTMLElement; crumbs: HTMLElement; choices: HTMLElement; repository: HTMLElement; context: HTMLElement }, app: App): boolean {
  const location = filesystemNavigation(app)
  if (!location) return false
  const row = location.trail.at(-1)!
  const header = document.createElement('div'); header.className = 'node-header'
  const titleSection = document.createElement('div'); titleSection.className = 'node-title-section'
  const title = document.createElement('h1'); title.className = 'node-title'
  title.append(combobox(row.title, row.title, () => [{ label: `Template: ${row.template}`, group: 'From filesystem', disabled: true, run() {} }]))
  titleSection.append(title); header.append(titleSection)
  const controls = document.createElement('details'); controls.className = 'node-accordion'
  const summary = document.createElement('summary'); summary.textContent = 'Constructors'
  controls.append(summary, action('Refresh', () => app.refresh()), action('Parent node', () => filesystemBack(app)))
  const content = document.createElement('div'); content.className = 'node-input'
  regions.node.replaceChildren(header, content, controls)
  regions.choices.replaceChildren(); regions.repository.replaceChildren(); regions.context.replaceChildren()
  regions.list.className = 'list tree layout-tree'
  regions.crumbs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => navigation.delete(app), { capture: true }))
  for (let i = 0; i < location.trail.length; i++) {
    const ancestor = location.trail[i]!
    regions.crumbs.append(action(ancestor.title, () => { location.trail = location.trail.slice(0, i + 1); app.refresh() }, 'crumb'))
  }
  if (row.directory) regions.list.replaceChildren(directoryRows(app, location.root, row.id, location.trail, ''))
  else {
    regions.list.replaceChildren()
    const text = document.createElement(row.template === 'Markdown' ? 'div' : 'pre'); text.className = row.template === 'Markdown' ? 'note-body' : 'file-content'; text.textContent = 'Loading...'; content.append(text)
    void tauriInvoke<string>('read_node_file', { root: location.root, path: row.id })?.then(async value => {
      const html = row.template === 'Markdown' ? await renderMarkdown(value) : null
      if (text.isConnected && filesystemNavigation(app) === location) { if (html !== null) text.innerHTML = html; else text.textContent = value }
    }).catch(error => { if (text.isConnected) text.textContent = String(error) })
  }
  return true
}
export async function linkFilesystem(app: App, directory: string): Promise<void> {
  const key = bindingKey(app), store = app.state.replica.store
  try {
    const call = tauriInvoke<string>('link_node_directory', { path: directory })
    if (!call) throw new Error('Directory peers require the desktop app.')
    const root = await call
    if (store !== app.state.replica.store || key !== bindingKey(app)) return
    localStorage.setItem(key, root)
    app.refresh()
  } catch (error) { app.notify('error', String(error)) }
}
