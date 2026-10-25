const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-file-references-'))
const dom = new JSDOM('<main></main>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'localStorage', 'location', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
buildSync({ stdin: { contents: `export { App } from './src/app'; export { mountUi } from './src/ui'; export { createMemoryStorage } from './src/storage'; export * from './src/filesystem'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const { App, mountUi, createMemoryStorage, serializeReplica, view, fileReferenceAt, forgetFileChecksums, filesystemRows } = require(path.join(dir, 'test.cjs'))
const tick = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)) }

// A fake desktop shell: the project directory /proj with a README and src/main.ts.
const files = { 'README.md': 'v1', 'src/main.ts': 'export {}' }
const hashes = { 'README.md': 'a'.repeat(64), 'src/main.ts': 'c'.repeat(64) }
const calls = []
const relative = (root, p) => p.startsWith(root + '/') ? p.slice(root.length + 1) : p
const shell = { core: { invoke: async (cmd, args = {}) => {
  calls.push(cmd)
  if (cmd === 'agent_start') return 'probe'
  if (cmd === 'agent_poll') return { finished: true, events: [{ type: 'availability', codex: false, claude: false }] }
  if (cmd === 'list_node_directory') {
    const at = relative(args.root, args.path), prefix = args.path === args.root ? '' : at + '/'
    const names = new Set(Object.keys(files).filter(f => f.startsWith(prefix)).map(f => f.slice(prefix.length).split('/')[0]))
    return { current_path: args.path, entries: [...names].map(name => ({ name, path: `${args.path}/${name}`, is_directory: !Object.prototype.hasOwnProperty.call(files, prefix + name) })) }
  }
  if (cmd === 'read_node_file') return files[relative(args.root, args.path)]
  if (cmd === 'hash_node_file') {
    assert.equal(args.root, '/proj')
    const rel = relative(args.root, args.path)
    if (rel.includes('..')) throw new Error('File is outside the linked root')
    return Object.prototype.hasOwnProperty.call(files, rel) ? { path: rel, sha256: hashes[rel], size: files[rel].length } : null
  }
  throw new Error(`unexpected command ${cmd}`)
} } }

function project(home = false) {
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage(), project: { dir: '/proj', branch: () => null, home } })
  app.scheduleSync = () => {}
  return app
}

async function main() {
  window.__TAURI__ = shell
  const root = document.querySelector('main')
  const app = project()
  mountUi(root, app)
  await tick()
  assert.deepEqual(app.state.view, [], 'a project window opens at its root node')
  const listed = () => [...root.querySelectorAll('.filesystem-row')].map(row => row.querySelector('.title').textContent)
  assert.deepEqual(listed().sort(), ['README.md', 'src'], 'the project directory lists at the root without linking it')
  assert(root.querySelector('.filesystem-row[data-replicated="false"]'))
  const graph = JSON.stringify(serializeReplica(app.state.replica))
  assert(!graph.includes('README.md') && !graph.includes('main.ts'), 'listed files never enter the replica')

  // browse into a folder and open a text file read-only
  ;[...root.querySelectorAll('.filesystem-row')].find(row => row.textContent.includes('src')).querySelector('.zoom-dot').click(); await tick()
  assert(root.textContent.includes('main.ts'))
  ;[...root.querySelectorAll('.filesystem-row')].find(row => row.textContent.includes('main.ts')).querySelector('.zoom-dot').click(); await tick()
  assert.equal(root.querySelector('.file-content').textContent, 'export {}')
  assert(!root.querySelector('.file-content').isContentEditable)
  // "Reference this file" in the file's workspace adds the reference to the hosting graph node
  ;[...root.querySelectorAll('button')].find(b => b.textContent === 'Reference this file').click(); await tick()
  const deep = view(app.state.replica, []).tasks.find(row => fileReferenceAt(app.state.replica, [row.id])?.path === 'src/main.ts')
  assert(deep, 'the reference is a row of the project root')
  assert.deepEqual(fileReferenceAt(app.state.replica, [deep.id]), { path: 'src/main.ts', sha256: 'c'.repeat(64), size: 9 })
  ;[...root.querySelectorAll('button')].find(b => b.textContent === 'Parent node').click(); await tick()
  ;[...root.querySelectorAll('button')].find(b => b.textContent === 'Parent node').click(); await tick()

  // the outline's Reference action
  ;[...root.querySelectorAll('.filesystem-row')].find(row => row.textContent.includes('README.md')).querySelector('.file-reference-add').click(); await tick()
  const readme = view(app.state.replica, []).tasks.find(row => fileReferenceAt(app.state.replica, [row.id])?.path === 'README.md')
  assert(readme, 'a file reference is a row of the library type')
  assert.deepEqual(fileReferenceAt(app.state.replica, [readme.id]), { path: 'README.md', sha256: 'a'.repeat(64), size: 2 })
  const state = () => [...root.querySelectorAll('.file-reference')].find(box => box.querySelector('code').textContent === 'README.md')?.dataset.state
  await tick()
  assert.equal(state(), 'current')
  assert(!root.textContent.includes('a'.repeat(64)) && !root.querySelector('.task input[value="README.md"]'), 'the fields are not shown as rows or a hand-edited form')

  // the file changes on disk: the reference is stale until re-pinned
  files['README.md'] = 'v2!'; hashes['README.md'] = 'b'.repeat(64)
  forgetFileChecksums(); app.refresh(); await tick()
  assert.equal(state(), 'stale')
  ;[...root.querySelectorAll('.file-reference')].find(box => box.dataset.state === 'stale').querySelector('button').click(); await tick()
  assert.deepEqual(fileReferenceAt(app.state.replica, [readme.id]), { path: 'README.md', sha256: 'b'.repeat(64), size: 3 })
  await tick(); assert.equal(state(), 'current')

  // the file is removed
  delete files['README.md']
  forgetFileChecksums(); app.refresh(); await tick()
  assert.equal(state(), 'missing')
  files['README.md'] = 'v2!'

  // the reference travels with the replica; a device without the directory shows the path only
  const serialized = serializeReplica(app.state.replica)
  window.__TAURI__ = undefined
  const storage = createMemoryStorage(); storage.saveReplica(serialized)
  const other = new App({ baseUrl: 'http://localhost', autoLogin: null, storage, scopedDocument: true })
  other.scheduleSync = () => {}
  assert(view(other.state.replica, []).tasks.some(row => fileReferenceAt(other.state.replica, [row.id])?.path === 'README.md'))
  root.replaceChildren(); mountUi(root, other); other.refresh(); await tick()
  assert.equal(root.querySelectorAll('.filesystem-row').length, 0, 'no file rows without the desktop shell')
  const away = [...root.querySelectorAll('.file-reference')].find(box => box.textContent.includes('README.md'))
  assert.equal(away.dataset.state, 'unavailable')
  assert(away.closest('.task').textContent.includes('not available on this device'))
  assert.equal(filesystemRows(other), null)
  other.logout()

  // the home context does not list the home directory
  window.__TAURI__ = shell
  const home = project(true)
  root.replaceChildren(); mountUi(root, home); home.refresh(); await tick()
  assert.equal(root.querySelectorAll('.filesystem-row').length, 0, 'Home does not list ~')
  home.logout(); app.logout()
  console.log('PASS: project directories list at the root, file references pin checksums, show stale/missing and re-pin, and travel without the files')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
