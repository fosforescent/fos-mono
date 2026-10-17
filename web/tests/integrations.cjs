const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-transport-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })

async function main() {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {sdkAvailable} from './src/agents'; export {createMemoryStorage} from './src/storage'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
  const { App, createMemoryStorage, sdkAvailable } = require(path.join(dir, 'test.cjs'))
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() })
  app.scheduleSync = () => {}; app.refreshRepositories = async () => {}; app.refreshPoints = async () => {}; app.syncNodes = async () => {}
  const session = { username: 'alice', jwt: 'test', kind: 'user', baseUrl: 'http://localhost' }
  const disconnected = { id: 'github', name: 'GitHub', kind: 'oauth', configured: true, connected: false, provides: ['repo'], consumes: [] }
  app.set({ session, integrations: [disconnected] })
  let finishOpen, opened = 0, connected = false
  window.__TAURI__ = { core: { invoke: async command => {
    if (command === 'plugin:opener|open_url') { opened++; return new Promise(resolve => { finishOpen = resolve }) }
    if (command === 'agent_start') return 'probe'
    if (command === 'agent_poll') return { finished: true, events: [{ type: 'availability', codex: true, claude: false, diagnostics: { claude: 'Set ANTHROPIC_API_KEY' } }] }
    throw new Error(command)
  } } }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ url: 'https://github.com/login/oauth/authorize?client_id=test' }) })
  app.refreshIntegrations = async () => { app.set({ integrations: [{ ...disconnected, connected }] }) }
  const opening = app.connectIntegration('github')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(opened, 1)
  assert.equal(app.pendingIntegration.id, 'github', 'track OAuth before the external browser returns')
  await app.checkPendingIntegration()
  assert.equal(app.pendingIntegration.id, 'github', 'early focus does not discard unfinished OAuth')
  finishOpen(); await opening
  connected = true
  await app.syncNow('poll')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.pendingIntegration, null, 'later background poll observes the completed GitHub callback')
  assert.match(app.state.notice.text, /GitHub is connected/)
  app.pendingIntegration = { id: 'github', session }
  app.set({ session: { ...session, username: 'bob' }, notice: null })
  await app.checkPendingIntegration()
  assert.equal(app.pendingIntegration, null)
  assert.equal(app.state.notice, null, 'old account callback cannot announce a connection for another account')
  let releaseStart
  globalThis.fetch = async () => new Promise(resolve => { releaseStart = () => resolve({ ok: true, json: async () => ({ url: 'https://github.com/login/oauth/authorize' }) }) })
  const stale = app.connectIntegration('github')
  app.set({ session: null }); releaseStart(); await stale
  assert.equal(opened, 1, 'late OAuth response after sign-out does not open a browser')
  const parent = app.applyConstructor(app.state.view, { kind: 'plain', text: 'Repository', done: false, peer: 'filesystem' }, false, undefined, '/tmp/project')
  app.goTo(parent)
  // the SDK probe is per provider: codex usable, claude not (with its diagnostic)
  assert.equal(sdkAvailable(app, 'codex'), null, 'unknown until probed')
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve))
  assert.equal(sdkAvailable(app, 'codex'), true)
  assert.equal(sdkAvailable(app, 'claude'), false)
  console.log('PASS: desktop OAuth return, delayed callback polling, account isolation, and per-provider SDK availability')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); dom.window.close() })
