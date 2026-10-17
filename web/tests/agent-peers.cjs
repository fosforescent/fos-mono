// Agent CLIs found on this computer's PATH are local peers: discovered at startup (a filesystem query, never a graph
// row), nested under the device tab with their constructor actions, read-only, and maskable like any peer.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-agent-peers-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), logLevel: 'silent', external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  const invokes = []
  let clis = { claude: 'C:\\\\tools\\\\claude.cmd', codex: null }
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    invokes.push({ command, args })
    if (command === 'agent_clis') return clis
    if (command === 'agent_start') return 'probe'
    if (command === 'agent_poll') return { finished: true, events: [{ type: 'availability', claude: false, codex: false }] }
    if (command === 'find_project') return null
    return null
  } } }
  if (!window.HTMLDialogElement.prototype.showModal) { window.HTMLDialogElement.prototype.showModal = function () { this.open = true }; window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')) } }
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  const trip = app.applyConstructor(app.state.view, { kind: 'task', text: 'Plan the group trip', done: false })

  // discovery: only CLIs on PATH become peers
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [{ provider: 'claude', name: 'Claude Code', path: 'C:\\\\tools\\\\claude.cmd' }])
  const peer = app.contextPeers().find(p => p.id === 'agent-cli:claude')
  assert(peer && peer.online && peer.agentCli.provider === 'claude', 'the CLI is a local peer')
  assert(!app.contextPeers().some(p => p.id === 'agent-cli:codex'), 'an absent CLI is no peer')
  assert(!c.view(app.state.replica, app.state.view).tasks.some(t => t.title.includes('Claude')), 'no graph row was created')
  assert(!document.querySelector('.node-actions')?.textContent.includes('Open Claude Code CLI'), 'the old button block is gone')

  // the constructor panel: the agent nests under "This device", with its actions as constructors
  document.querySelector('.children-toolbar .constructors-toggle').click(); await tick()
  document.querySelector('.peer-tabs [aria-label="This device"]').click(); await tick()
  assert(!document.querySelector('.peer-tabs [aria-label="Claude Code"]'), 'local agents are not top-level tabs')
  const agentTab = [...document.querySelectorAll('.device-agents button')].find(b => b.textContent === 'Claude Code')
  assert(agentTab, 'the device tab lists the agent'); agentTab.click(); await tick()
  const open = document.querySelector('.constructor-grid [aria-label="Open Claude Code CLI"]')
  assert(open, 'opening the CLI is a constructor action of the agent peer')
  assert(!document.querySelector('.constructor-grid [aria-label="Run Claude Code…"]'), 'no SDK run without the SDK')
  assert(document.querySelector('.constructor-grid [aria-label="Plan the group trip"]'), 'child masks apply to the agent peer')
  assert(document.querySelector('.node-context').textContent.includes('read-only local peer'))
  open.click(); await tick()
  const dialog = document.querySelector('dialog.import-dialog')
  assert(dialog && dialog.querySelector('h3').textContent === 'Open claude CLI', 'the CLI launcher opened')
  dialog.close()

  // the agent disappears when the CLI does
  clis = { claude: null, codex: null }
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [])
  assert(!app.contextPeers().some(p => p.agentCli))
  void trip
  console.log('agent-peers ok')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
