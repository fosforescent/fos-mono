const drag = require('./helpers/drag.cjs')
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
const { App, mountUi, mountSharedNode, shareUrl, sharedAddress, createMemoryStorage, view, headCid, handlerResult, writePageBase, sharedAddressAt, membershipPathAt, SERVER_MEMBER } = require(path.join(dir, 'app.cjs'))
const c = require(path.join(dir, 'app.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
let a
async function main() {
  // an address is the owner and the node's path; whether it may be visited is the node's membership
  const at = { owner: 'host@example.test', path: [c.HOME_ID, 'poll'] }
  const url = shareUrl(at)
  assert.deepEqual(sharedAddress(new URL(url).hash), at)
  assert.equal(sharedAddress('#share=%bad'), null)
  assert.equal(sharedAddress('#share=' + encodeURIComponent(JSON.stringify({ ...at, path: 'invalid' }))), null)
  const root = document.getElementById('app')
  a = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() })
  a.scheduleSync = () => {}; a.syncNow = async () => {}
  mountUi(root, a)
  a.addTask('My private task')
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new window.Event('close')) }
  document.querySelector('.peer-tabs [aria-label="Fos server"]').click()
  assert(!document.querySelector('.sharing-controls'), 'no separate publication panel under Fos server')
  assert(!document.querySelector('.peer-tabs [aria-label="Add peer"]'), 'publishing sits in the Fos server grid, not an Add peer tab')
  const grid = document.querySelector('.constructor-grid'); assert(!grid.hidden)
  const savedSession = a.state.session, savedConnection = a.state.connection, savedSync = a.syncNow, savedFetch = global.fetch
  a.state.session = { kind: 'user', username: 'publisher', jwt: 'test', baseUrl: 'http://localhost' }; a.state.connection = 'online'
  a.syncNow = async () => { a.state.replica = (r => { const peer = r.meta.serverPeerId ?? 'user:test', nodeSync = {}; for (const p of c.materializedNodePaths(r, r.meta.localScope ?? [])) nodeSync[c.nodeSyncKey(peer, p, c.nodeBranches(r, p))] = { local: c.nodeShape(r, p), remote: c.nodeShape(r, p) }; return { ...r, meta: { ...r.meta, serverPeerId: peer, nodeSync, lastSyncAt: 1 } } })(a.state.replica) }
  for (const [caption, audience] of [['Publish publicly', 'public'], ['Publish to Fos users', 'users']]) {
    document.querySelector('.peer-tabs [aria-label="Fos server"]').click()
    const action = document.querySelector(`.constructor-grid [aria-label="${caption}"]`)
    assert(action?.querySelector('svg')); assert(action.draggable)
    global.fetch = async () => { throw new Error('publishing is a local member edge, not a request') }
    drag(action); await tick()
    // publishing is a row of this node: its controls are in the row, not a dialog
    assert(!document.querySelector('.publish-dialog'), 'no publishing dialog')
    const dialog = document.querySelector('.tree .constructor-body .sharing-controls')?.closest('.constructor-body'); assert(dialog, 'the publishing row holds its controls')
    assert(!dialog.querySelector('details,summary'), 'no added audience accordion')
    // the row is the audience's peer, like any peer: no publish button, its Execute switch lets visitors run the node
    const peer = `audience:${audience}`
    assert(![...dialog.querySelectorAll('button')].some(b => b.textContent === 'Complete' || /publish/i.test(b.textContent)), 'no publish button')
    assert(!dialog.querySelector('[aria-label="Shareable URL"]'), 'no link before the server makes one')
    const execute = dialog.querySelector('.peer-grants input[aria-label$=": execute"]')
    execute.checked = true; execute.dispatchEvent(new window.Event('change')); await tick()
    assert.deepEqual(view(a.state.replica, a.state.view).members.find(m => m.peerId === peer).capabilities, ['execute'])
    // what the server's `url` handler records on its member entry (where share pages are, whose account): the link is made from it
    a.set({ replica: writePageBase(a.state.replica, membershipPathAt(a.state.replica, [], SERVER_MEMBER), { base: 'http://localhost', owner: 'publisher' }, Date.now()) }); await tick()
    const published = document.querySelector('.tree .constructor-body .sharing-controls')?.closest('.constructor-body')
    const link = published.querySelector('[aria-label="Shareable URL"]').value
    assert.deepEqual(sharedAddress(new URL(link).hash), { owner: 'publisher', path: a.state.view })
    const snippet = published.querySelector('.embed-snippet')
    if (audience === 'public') {
      assert.equal(snippet.hidden, false, 'a public link offers an embed snippet')
      assert(snippet.value.startsWith('<script src="http://localhost/embed.js" data-fos-share="http://localhost/#share='), snippet.value)
      assert(snippet.value.includes('data-fos-api="http://localhost"'))
      assert.deepEqual(sharedAddress(new URL(snippet.value.match(/data-fos-share="([^"]+)"/)[1].replace(/&amp;/g, '&')).hash).path, a.state.view)
      assert([...published.querySelectorAll('button')].some(b => b.textContent === 'Copy embed' && !b.hidden))
    } else assert(!snippet, 'links for Fos users need sign-in, so they are not embeddable')
    a.undo(); a.undo(); await tick()
    assert(!view(a.state.replica, a.state.view).members.some(m => m.peerId === peer), 'undo takes the publication back')
  }
  a.state.session = savedSession; a.state.connection = savedConnection; a.syncNow = savedSync; global.fetch = savedFetch

  const requests = []
  const node = { title: 'Lunch?', rows: [], inputs: [{ key: 'text', name: 'Comment', kind: 'text' }], proposals: [{ id: 'proposal:p', label: 'bob: adds Soup' }], revision: 'v1', audience: 'public', counts: {}, rankings: {}, participants: 0, capabilities: ['read', 'edit', 'rank'] }
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body); requests.push({ url, body, headers: init.headers })
    return { ok: true, json: async () => url.endsWith('/input') ? { node: { ...node, mine: { peer: 'visitor:1', revision: 'v1', name: body.name, approvals: body.approvals, ranking: body.ranking, fields: { text: body.fields.text.value } }, participants: 1, counts: { 'proposal:p': 1 } } } : { node, visitorToken: 'guest-only-token' } }
  }
  location.hash = new URL(url).hash
  mountSharedNode(root, a, 'http://localhost')
  await tick()
  assert.equal(a.state.view.length, 3, 'the link sits below the host row in Home')
  const linkId = a.state.view.at(-1)
  assert.deepEqual(sharedAddressAt(a.state.replica, a.state.view), at)
  const home = view(a.state.replica, [c.HOME_ID])
  assert(home.tasks.some(t => t.title === 'My private task'))
  assert(home.tasks.some(t => t.title === 'Host'))
  const panel = document.querySelector('.shared-node')
  assert(root.contains(panel), 'handler belongs to the linked node view, not a separate workspace')
  assert.equal(panel.hidden, false)
  assert(root.classList.contains('shared-site'), 'a published node reads as a website')
  assert.equal(panel.querySelector('.fos-site h1')?.textContent, 'Lunch?')
  assert(panel.querySelector('.fos-site') && !panel.querySelector('.fos-site p.fos-site-text'), 'the page is rendered by the site renderer')
  let form = panel.querySelector('form')
  const name = form.querySelector('input[autocomplete="nickname"]')
  assert.equal(name.required, false, 'a display name is optional')
  name.value = 'Pat'
  const check = form.querySelector('input[type="checkbox"]'); check.click()
  const text = form.querySelector('fieldset input'); text.value = 'Vegetarian'; text.dispatchEvent(new window.Event('input'))
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await tick()
  const saved = requests.find(r => r.url.endsWith('/input'))
  assert.equal(saved.body.name, 'Pat')
  assert.equal(saved.body.visitorToken, 'guest-only-token')
  assert.deepEqual(saved.body.approvals, ['proposal:p'])
  assert(!JSON.stringify(saved.body).includes('My private task'))
  assert.equal(a.state.session, null)
  a.goTo([c.HOME_ID]); await tick(); assert.equal(panel.hidden, true)
  assert(!root.classList.contains('shared-site'), 'leaving the shared ref shows the app again')
  a.openSharedLink(linkId); await tick(); assert.equal(panel.hidden, false)
  assert.equal(view(a.state.replica, [c.HOME_ID]).tasks.filter(t => t.title === 'Host').length, 1)
  assert.equal(panel.querySelector('input[autocomplete="nickname"]').value, 'Pat')
  form = panel.querySelector('form')
  const search = form.querySelector('input[placeholder="Find a value in your context"]')
  search.value = 'My private task'; search.dispatchEvent(new window.Event('input'))
  const choice = [...form.querySelectorAll('button')].find(b => b.textContent === 'My private task')
  assert(choice); choice.click()
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await tick()
  const supplied = requests.filter(r => r.url.endsWith('/input')).at(-1).body
  assert.deepEqual(supplied.fields.text, { value: 'My private task' }, 'anonymous linked values send only the chosen property')
  assert(handlerResult(a.state.replica, a.state.view).sources.text, 'the source remains linked in the anonymous local context')
  console.log('PASS: shareable URLs, Host row in Home, anonymous name/input, private-context isolation, and reopening a shared ref')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
