const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-filesystem-'))
const dom = new JSDOM('<main></main>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'localStorage', 'location', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
buildSync({ stdin: { contents: `export { App } from './src/app'; export { mountUi } from './src/ui'; export { createMemoryStorage } from './src/storage'; export * from './src/filesystem'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const { App, mountUi, createMemoryStorage, createReplica, serializeReplica, filesystemRows, linkFilesystem, filesystemTemplate, filesystemNavigation, renderFilesystemNode, filesystemBack } = require(path.join(dir, 'test.cjs'))
const tick = () => new Promise(resolve => setImmediate(resolve))
async function main() {
  const app = { state: { replica: createReplica('local-device'), session: null, view: [] }, refresh() {}, notify(_kind, text) { throw new Error(text) } }
  const before = JSON.stringify(serializeReplica(app.state.replica))
  let entries = [{ name: 'research.md', path: '/work/research.md', is_directory: false }, { name: '.fos', path: '/work/.fos', is_directory: true }]
  let reads = 0, pending
  window.__TAURI__ = { core: { invoke: async (cmd) => {
    if (cmd === 'link_node_directory') return '/work'
    if (cmd === 'read_node_file') return '# Research findings'
    assert.equal(cmd, 'list_node_directory'); reads++
    if (pending) return new Promise(resolve => { pending = resolve })
    return { current_path: '/work', entries }
  } } }
  await linkFilesystem(app, '/work')
  const root = document.querySelector('main')
  const draw = () => { root.replaceChildren(filesystemRows(app)); return root.firstChild }
  draw(); await tick()
  assert.equal(root.querySelectorAll('[data-replicated="false"]').length, 1)
  assert(root.textContent.includes('research.md'))
  assert(root.querySelector('.task .zoom-dot'), 'files use the node outline and zoom control')
  assert.equal(root.querySelector('.kind-badge').textContent, 'Markdown')
  assert.equal(filesystemTemplate('experiment.TS', false), 'TypeScript')
  assert.equal(filesystemTemplate('.config.json', false), 'JSON')
  assert.equal(filesystemTemplate('notes.md', true), 'Folder')
  root.querySelector('.zoom-dot').click()
  assert.equal(filesystemNavigation(app).trail[0].id, '/work/research.md')
  const regions = Object.fromEntries(['node', 'list', 'crumbs', 'choices', 'repository', 'context'].map(key => [key, document.createElement('div')]))
  root.replaceChildren(...Object.values(regions))
  assert(renderFilesystemNode(regions, app))
  await tick()
  assert(regions.node.querySelector('.node-title').textContent.includes('research.md'))
  assert.equal(regions.node.querySelector('.note-body h1').textContent, 'Research findings')
  assert(regions.crumbs.textContent.includes('research.md'))
  filesystemBack(app); assert.equal(filesystemNavigation(app), null)
  entries = [{ name: 'experiments', path: '/work/experiments', is_directory: true }]
  draw(); await tick(); root.querySelector('.zoom-dot').click()
  root.replaceChildren(...Object.values(regions))
  entries = [{ name: 'run.ts', path: '/work/experiments/run.ts', is_directory: false }]
  assert(renderFilesystemNode(regions, app)); await tick()
  assert(regions.list.textContent.includes('run.ts'))
  regions.list.querySelector('.zoom-dot').click()
  assert.deepEqual(filesystemNavigation(app).trail.map(row => row.title), ['experiments', 'run.ts'])
  filesystemBack(app)
  assert.equal(filesystemNavigation(app).trail.at(-1).title, 'experiments')
  filesystemBack(app)
  reads = 1
  entries = [{ name: 'new-findings.md', path: '/work/new-findings.md', is_directory: false }]
  draw(); await tick()
  assert.equal(reads, 2, 'each refresh reads the directory again')
  assert(!root.textContent.includes('research.md')); assert(root.textContent.includes('new-findings.md'))
  assert.equal(JSON.stringify(serializeReplica(app.state.replica)), before, 'neither links nor file rows enter the replica')
  app.state.view = ['another-node']; assert.equal(filesystemRows(app), null)
  app.state.view = []
  pending = true; const old = draw(); await tick()
  root.replaceChildren(); app.state.session = { username: 'another-account', baseUrl: 'http://localhost' }
  pending({ current_path: '/work', entries }); await tick()
  assert(!old.textContent.includes('new-findings.md'), 'late results do not populate a stale account or node')
  assert.equal(filesystemRows(app), null, 'directory links are account scoped')
  pending = false
  const invoke = window.__TAURI__.core.invoke
  window.__TAURI__.core.invoke = async (cmd, args) => {
    if (cmd === 'agent_start') return 'probe'
    if (cmd === 'agent_poll') return { finished: true, events: [{ type: 'availability', codex: false, claude: false }] }
    return invoke(cmd, args)
  }
  const controller = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage(), scopedDocument: true })
  controller.scheduleSync = () => {}
  mountUi(root, controller)
  const id = controller.addRowAt([], 'plain', 'Workspace')
  controller.goTo([id])
  await linkFilesystem(controller, '/work'); await tick(); await tick()
  const graphBefore = JSON.stringify(serializeReplica(controller.state.replica))
  root.querySelector('.filesystem-row .zoom-dot').click(); await tick()
  assert(root.querySelector('.node-title').textContent.includes('new-findings.md'))
  assert(root.querySelector('.note-body h1'))
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  assert.equal(JSON.stringify(serializeReplica(controller.state.replica)), graphBefore, 'file navigation never edits the hosting graph node')
  filesystemBack(controller); await tick()
  assert(root.querySelector('.node-title').textContent.includes('Workspace'), 'parent navigation restores the graph workspace')
  controller.logout()
  console.log('PASS: filesystem projections refresh, remain outside the replica, and isolate nodes/accounts and late responses')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
