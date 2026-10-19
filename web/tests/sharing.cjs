const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-sharing-tests-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from './src/sharing'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'app.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const { App, mountUi, mountSharedNode, shareUrl, sharedAddress, createMemoryStorage, view, readNodeValue, headCid } = require(path.join(dir, 'app.cjs'))
const c = require(path.join(dir, 'app.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
let a
async function main() {
  const at = { owner: 'host@example.test', path: ['fos:home', 'poll'], share: 'share-id-0123456789' }
  const url = shareUrl(at)
  assert.deepEqual(sharedAddress(new URL(url).hash), at)
  assert.equal(sharedAddress('#share=%bad'), null)
  assert.equal(sharedAddress('#share=' + encodeURIComponent(JSON.stringify({ ...at, share: 'invalid' }))), null)
  const root = document.getElementById('app')
  a = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() })
  a.scheduleSync = () => {}; a.syncNow = async () => {}
  mountUi(root, a)
  a.addTask('My private task')
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new window.Event('close')) }
  document.querySelector('.peer-tabs [aria-label="Fos server"]').click()
  assert(!document.querySelector('.sharing-controls'), 'no separate publication panel under Fos server')
  document.querySelector('.peer-tabs [aria-label="Add peer"]').click()
  const grid = document.querySelector('.constructor-grid'); assert(!grid.hidden)
  const savedSession = a.state.session, savedConnection = a.state.connection, savedSync = a.syncNow, savedFetch = global.fetch
  a.state.session = { kind: 'user', username: 'publisher', jwt: 'test', baseUrl: 'http://localhost' }; a.state.connection = 'online'
  a.syncNow = async () => { a.state.replica = (r => { const peer = r.meta.serverPeerId ?? 'user:test', nodeSync = {}; for (const p of c.materializedNodePaths(r, r.meta.localScope ?? [])) nodeSync[c.nodeSyncKey(peer, p, c.nodeBranches(r, p))] = { local: c.nodeShape(r, p), remote: c.nodeShape(r, p) }; return { ...r, meta: { ...r.meta, serverPeerId: peer, nodeSync, lastSyncAt: 1 } } })(a.state.replica) }
  for (const [caption, audience] of [['Publish publicly', 'public'], ['Publish to Fos users', 'users']]) {
    const action = document.querySelector(`.constructor-grid [aria-label="${caption}"]`)
    assert(action?.querySelector('svg')); assert(action.draggable)
    let published
    global.fetch = async (_url, init) => { published = JSON.parse(init.body); return { ok: true, json: async () => ({ owner: 'publisher', path: a.currentScope(), share: 'share-id-0123456789' }) } }
    action.click()
    const dialog = document.querySelector('.publish-dialog'); assert(dialog)
    assert(!dialog.querySelector('details,summary'), 'no added audience accordion')
    const publish = [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Publish node')
    publish.click(); await tick()
    assert.equal(published.audience, audience)
    assert.deepEqual(published.path, a.currentScope())
    dialog.close()
  }
  a.state.session = savedSession; a.state.connection = savedConnection; a.syncNow = savedSync; global.fetch = savedFetch

  const requests = []
  const node = { title: 'Lunch?', rows: [], inputs: [{ key: 'text', name: 'Comment', kind: 'text' }], options: [{ id: 'option:0', label: 'Soup' }, { id: 'option:1', label: 'Salad' }], poll: { mode: 'approval' }, proposals: [], revision: 'v1', audience: 'public', counts: {}, rankings: {}, participants: 0, capabilities: ['read', 'edit', 'rank'] }
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body); requests.push({ url, body, headers: init.headers })
    return { ok: true, json: async () => url.endsWith('/input') ? { node: { ...node, mine: { peer: 'visitor:1', revision: 'v1', name: body.name, approvals: body.approvals, ranking: body.ranking, fields: { text: body.fields.text.value } }, participants: 1, counts: { 'option:0': 1 } } } : { node, visitorToken: 'guest-only-token' } }
  }
  location.hash = new URL(url).hash
  mountSharedNode(root, a, 'http://localhost')
  await tick()
  assert.deepEqual(a.state.view, ['fos:home', 'shared-host:host@example.test', 'shared:share-id-0123456789'])
  const home = view(a.state.replica, ['fos:home'])
  assert(home.tasks.some(t => t.title === 'My private task'))
  assert(home.tasks.some(t => t.title === 'Host'))
  assert.equal(readNodeValue(a.state.replica, a.state.view, 'fos:shared-link').owner, at.owner)
  const panel = document.querySelector('.shared-node')
  assert(root.contains(panel), 'handler belongs to the linked node view, not a separate workspace')
  assert.equal(panel.hidden, false)
  let form = panel.querySelector('form')
  const name = form.querySelector('input[autocomplete="nickname"]')
  assert.equal(name.required, true)
  name.value = 'Pat'
  const check = form.querySelector('input[type="checkbox"]'); check.click()
  const text = form.querySelector('fieldset input'); text.value = 'Vegetarian'; text.dispatchEvent(new window.Event('input'))
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await tick()
  const saved = requests.find(r => r.url.endsWith('/input'))
  assert.equal(saved.body.name, 'Pat')
  assert.equal(saved.body.visitorToken, 'guest-only-token')
  assert.deepEqual(saved.body.approvals, ['option:0'])
  assert(!JSON.stringify(saved.body).includes('My private task'))
  assert.equal(a.state.session, null)
  a.goTo(['fos:home']); await tick(); assert.equal(panel.hidden, true)
  a.openSharedLink('shared:share-id-0123456789'); await tick(); assert.equal(panel.hidden, false)
  assert.equal(view(a.state.replica, ['fos:home']).tasks.filter(t => t.title === 'Host').length, 1)
  assert.equal(panel.querySelector('input[autocomplete="nickname"]').value, 'Pat')
  form = panel.querySelector('form')
  const search = form.querySelector('input[placeholder="Find a value in your context"]')
  search.value = 'My private task'; search.dispatchEvent(new window.Event('input'))
  const choice = [...form.querySelectorAll('button')].find(b => b.textContent === 'My private task')
  assert(choice); choice.click()
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await tick()
  const supplied = requests.filter(r => r.url.endsWith('/input')).at(-1).body
  assert.deepEqual(supplied.fields.text, { value: 'My private task' }, 'anonymous linked values send only the chosen property')
  assert(readNodeValue(a.state.replica, a.state.view, 'fos:input-links').text, 'the source remains linked in the anonymous local context')
  console.log('PASS: shareable URLs, Host row in Home, anonymous name/input, private-context isolation, and reopening a shared ref')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
