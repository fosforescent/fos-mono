import type { App } from './app'
import { inTauri, tauriInvoke } from './project'
import { localRepository } from './agents'
import { combobox } from './combobox'
import { iconSvg } from './icons'
import { renderMarkdown } from './markdown'
import type { FileReference, Scope } from '../../shared/sync/index'

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
function bindingKey(app: App, at: Scope = app.state.view): string {
  return 'fos:filesystem:' + JSON.stringify([app.state.session?.baseUrl ?? location.origin, app.state.session?.username ?? null, app.state.replica.meta.peerId, app.state.replica.meta.scope, at])
}
/**
 * The directory whose files show at the node `at` on this device: a "Link with directory" binding there, a local
 * repository argument at or above it, or, at the root of a project window (`fos <dir>`), the project directory.
 * Desktop only; nothing here is stored in the replica.
 */
export function linkedDirectory(app: App, at: Scope = app.state.view): string | null {
  if (!inTauri()) return null
  try { const bound = localStorage.getItem(bindingKey(app, at)); if (bound) return bound } catch { /* storage unavailable */ }
  return localRepository(app.state.replica, at) ?? (at.length === 0 ? app.projectRoot() : null)
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
      const host = [...app.state.view]
      const rows = filesystemProjection(listing.entries).filter(row => !search || row.title.toLowerCase().includes(search.toLowerCase())).map(row => {
        const item = document.createElement('li'); item.className = 'task kind-plain filesystem-row'; item.dataset.replicated = 'false'; item.tabIndex = 0
        item.style.setProperty('--depth', '0')
        const enter = () => open(app, root, row, trail)
        const zoom = action('', enter, 'zoom-dot'); zoom.innerHTML = iconSvg('\u25c9') ?? ''; zoom.setAttribute('aria-label', `Open ${row.title}`)
        const title = document.createElement('span'); title.className = 'title'; title.textContent = row.title
        const template = document.createElement('span'); template.className = 'kind-badge tpl'; template.textContent = row.template
        item.append(zoom, title, template)
        if (!row.directory) { const reference = action('Reference', () => void referenceFile(app, root, row.id, host), 'secondary small file-reference-add'); reference.title = 'Add a row to this node that references the file (its path and checksum)'; reference.onkeydown = event => event.stopPropagation(); item.append(reference) }
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
  const root = linkedDirectory(app)
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
  const host = [...app.state.view]
  controls.append(summary, action('Refresh', () => { forgetFileChecksums(); app.refresh() }), action('Parent node', () => filesystemBack(app)))
  if (!row.directory) controls.append(action('Reference this file', () => void referenceFile(app, location.root, row.id, host)))
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

// ---------------------------------------------------------------------------
// File references: a replicated plain row whose data names a file by its path relative to the linked directory and
// pins the SHA-256 it was made against (`data.file`, shared/sync/replica.ts). The desktop recomputes the checksum
// (`hash_node_file`, confined to the linked directory) to show whether the file changed or is gone.

/** Recent checksums by directory and path, so re-rendering does not hash large files again. */
const checksums = new Map<string, { at: number; result: Promise<FileReference | null> }>()
const CHECKSUM_TTL_MS = 5000
function checksum(root: string, path: string, fresh = false): Promise<FileReference | null> {
  const key = JSON.stringify([root, path]), cached = checksums.get(key)
  if (!fresh && cached && Date.now() - cached.at < CHECKSUM_TTL_MS) return cached.result
  const call = tauriInvoke<FileReference | null>('hash_node_file', { root, path })
  if (!call) return Promise.resolve(null)
  const result = call.then(value => value ?? null)
  checksums.set(key, { at: Date.now(), result })
  result.catch(() => checksums.delete(key))
  return result
}
/** The next render hashes files again (Refresh). */
export function forgetFileChecksums(): void { checksums.clear() }

/** Where the reference row at `path` finds its file: the nearest node at or above its parent with a linked directory. */
export function referenceDirectory(app: App, path: Scope): string | null {
  for (let depth = path.length - 1; depth >= 0; depth--) {
    const root = linkedDirectory(app, path.slice(0, depth))
    if (root) return root
  }
  return null
}

/** Add a row under `at` referencing the file `path` (absolute from a listing, or relative to `root`). */
export async function referenceFile(app: App, root: string, path: string, at: Scope = [...app.state.view]): Promise<void> {
  const store = app.state.replica.store
  try {
    const file = await checksum(root, path, true)
    if (!file) throw new Error('The file no longer exists.')
    if (store !== app.state.replica.store) return
    app.addFileReference(at, file)
  } catch (error) { app.notify('error', String(error)) }
}

/** The file a row references: its path and, on a device with the directory, whether it still matches. */
export function renderFileReference(app: App, path: Scope, file: FileReference): HTMLElement {
  const box = document.createElement('span'); box.className = 'file-reference'
  const name = document.createElement('code'); name.className = 'file-reference-path'; name.textContent = file.path
  const status = document.createElement('span'); status.className = 'kind-badge'
  box.append(name, status)
  const root = referenceDirectory(app, path)
  if (!root) { status.textContent = 'not available on this device'; status.title = 'The directory holding this file is not linked on this device'; box.dataset.state = 'unavailable'; return box }
  status.textContent = 'checking'; box.dataset.state = 'checking'
  const store = app.state.replica.store, at = path.slice(0, -1), id = path.at(-1)!
  const mark = (state: string, label: string, className: string, title: string) => { status.textContent = label; status.className = `kind-badge ${className}`; status.title = title; box.dataset.state = state }
  checksum(root, file.path).then(current => {
    if (!box.isConnected || store !== app.state.replica.store) return
    if (!current) { mark('missing', 'missing', 'tpl unmet', `${file.path} is no longer in the linked directory`); return }
    if (current.sha256 === file.sha256) {
      mark('current', 'current', 'ok', `SHA-256 ${file.sha256}`)
      const separator = root.includes('\\') ? '\\' : '/'
      const entry: UnreplicatedRow = { replicated: false, provider: 'filesystem', id: root.replace(/[\\/]+$/, '') + separator + file.path.split('/').join(separator), title: file.path.split('/').at(-1)!, directory: false, template: filesystemTemplate(file.path, false) }
      box.append(action('Open file', () => open(app, root, entry)))
      return
    }
    mark('stale', 'stale', 'needs', `The file changed since it was referenced (SHA-256 was ${file.sha256}, now ${current.sha256})`)
    box.append(action('Update reference', () => {
      void checksum(root, file.path, true).then(latest => {
        if (store !== app.state.replica.store) return
        if (!latest) { app.notify('error', 'The file no longer exists.'); return }
        app.setFileReference(at, id, latest)
      }).catch(error => app.notify('error', String(error)))
    }))
  }).catch(error => { if (box.isConnected) mark('error', 'unreadable', 'tpl unmet', String(error)) })
  return box
}
