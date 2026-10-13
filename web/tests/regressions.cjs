/* Browser-controller regressions with mocked network; no remote accounts or passwords. */
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-web-tests-'))
const root = path.resolve(__dirname, '..')
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export * from './src/storage'; export * from '../shared/sync/index'`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'app.cjs'), external: ['mermaid','katex','katex/*'] })
const { App, mountUi, createMemoryStorage, createLocalStorageAdapter, addTask, buildSyncRequest, completeSync, createReplica, serveSync, view } = require(path.join(dir, 'app.cjs'))
const tick = () => new Promise(resolve => setImmediate(resolve))
const reply = (data, status = 200) => ({ ok: status < 400, status, statusText: String(status), json: async () => data })
const apps = []
function app(storage = createMemoryStorage()) {
  const a = new App({ baseUrl: 'http://localhost', autoLogin: null, storage })
  // Test explicitly controls sync, polling and event notifications.
  a.scheduleSync = () => {}; a.startPolling = () => {}; a.openEvents = () => {}
  a.refreshRequests = async () => {}; a.refreshPoints = async () => {}; a.refreshIntegrations = async () => {}
  apps.push(a); return a
}
async function main() {
  const a = app(); mountUi(document.getElementById('app'), a)
  await tick()
  let input = document.querySelector('input.edit')
  input.focus(); input.value = 'First row'
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await tick()
  assert.equal(document.activeElement, document.querySelector('input.edit'), 'Enter in the empty list keeps the new-row editor focused')
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  input = document.activeElement; input.value = 'Parent with child'
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true, bubbles: true }))
  await tick()
  assert(document.activeElement.matches('input.edit,textarea.edit'))
  assert.equal(a.state.selected.length, 2, 'Ctrl+Shift+Enter creates and selects the first child')
  document.activeElement.value = 'Child text'
  document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await tick()
  assert(document.activeElement.matches('input.edit,textarea.edit'), 'next child remains editable')
  assert(view(a.state.replica, [a.state.selected[0]]).tasks.some(t => t.title === 'Child text'))

  localStorage.clear(); localStorage.setItem('web-mini.password', 'discard-this-test-value')
  localStorage.setItem('web-mini.token', 'test-token'); localStorage.setItem('web-mini.username', 'user2'); localStorage.setItem('web-mini.api-url', 'http://localhost')
  const storage = createLocalStorageAdapter(localStorage)
  assert.equal(localStorage.getItem('web-mini.password'), null)
  const b = app(storage), server = createReplica('server')
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push(url)
    if (url.includes('/attachment')) return reply({ scope: [], scopeNames: [] })
    if (url.endsWith('/peer-sync')) { const result = serveSync(server.store, JSON.parse(init.body), 'server'); return 'error' in result ? reply(result, 400) : reply(result.response) }
    throw new Error(`unexpected request ${url}`)
  }
  b.state.replica = addTask(b.state.replica, [], 'Previously saved', 1, 'existing')
  b.start(); await tick(); await tick()
  assert(requests.some(url => url.endsWith('/peer-sync')), 'stored session reconnects on startup')
  assert.equal(b.state.connection, 'online')
  b.state.replica = addTask(b.state.replica, [], 'Pending edit', 10, 'pending')
  const reset = createReplica('reset'); let pushes = 0
  globalThis.fetch = async (url, init) => {
    pushes++
    const result = serveSync(reset.store, JSON.parse(init.body), 'server')
    return 'error' in result ? reply(result, 400) : reply(result.response)
  }
  await b.syncNow('repair test')
  assert.equal(pushes, 2, 'one full-closure retry follows a rejected delta')
  assert.equal(b.state.connection, 'online')
  assert(view(b.state.replica, []).tasks.some(t => t.id === 'pending'))
  pushes = 0
  globalThis.fetch = async () => { pushes++; return reply({ code: 'missing-nodes', error: 'head node not provided' }, 400) }
  await b.syncNow('unrecoverable test')
  assert.equal(pushes, 2, 'repair is bounded per sync round')
  assert(b.state.notice.text.includes('head node not provided'))
  b.clearTimer('retry')
  globalThis.fetch = async () => reply({ error: 'expired' }, 401)
  await b.syncNow('expired test')
  assert.equal(b.state.session, null)
  assert(b.state.notice.text.includes('Sign in') || b.state.notice.text.includes('sign in'))
  assert.equal(storage.loadSession(), null)
  const c = app(createMemoryStorage())
  const loginServer = createReplica('login-server')
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/auth/login')) {
      assert.deepEqual(JSON.parse(init.body), { username: 'user3', password: 'ephemeral-test-password' })
      return reply({ access_token: 'user3-token' })
    }
    if (url.includes('/attachment')) return reply({ scope: [], scopeNames: [] })
    const served = serveSync(loginServer.store, JSON.parse(init.body), 'server')
    return 'error' in served ? reply(served, 400) : reply(served.response)
  }
  await c.login('user3', 'ephemeral-test-password')
  assert.equal(c.state.connection, 'online')
  assert(!JSON.stringify(c.config.storage.loadSession()).includes('ephemeral-test-password'))
  const saved = createMemoryStorage()
  saved.saveSession({ baseUrl: 'http://localhost', username: 'user3', jwt: 'user3-token', kind: 'user' })
  const d = app(saved); let attachmentCalls = 0
  const liveFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (url.includes('/attachment') && ++attachmentCalls === 1) throw new Error('temporary network failure')
    return liveFetch(url, init)
  }
  d.start(); await tick(); await tick()
  assert.equal(d.state.connection, 'offline')
  d.reconnect('retry test'); await tick(); await tick()
  assert.equal(attachmentCalls, 2)
  assert.equal(d.state.connection, 'online')
  assert(saved.loadSession().jwt)
  console.log('PASS: login, password-free persistence and attachment lookup retry')
  console.log('PASS: first-row/child focus, password removal, stored-session reconnect, bounded sync repair, expired-session notice')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { for (const a of apps) a.logout(); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
