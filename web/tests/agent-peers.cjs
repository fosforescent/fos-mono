// Agent CLIs found on this computer's PATH are sub-peers of the device: discovered at startup (a filesystem query,
// never a graph row), shown as icons in the device's constructor grid, opened for their own constructors and grants,
// draggable into a row as a select of their actions, and maskable like any peer.
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
  let launched = null
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    invokes.push({ command, args })
    if (command === 'agent_clis') return clis
    if (command === 'agent_start') { if (args?.request?.cli) launched = args.request; return 'probe' }
    if (command === 'agent_poll') return { finished: true, events: [{ type: 'availability', claude: false, codex: false }] }
    if (command === 'node_agent_start') return { id: 'endpoint', url: 'http://127.0.0.1:4321/mcp', token: 'local-secret' }
    if (command === 'node_agent_poll') return []
    if (command === 'node_agent_stop') return
    if (command === 'find_project') return null
    return null
  } } }
  if (!window.HTMLDialogElement.prototype.showModal) { window.HTMLDialogElement.prototype.showModal = function () { this.open = true }; window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')) } }
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  const trip = app.applyConstructor(app.state.view, { kind: 'task', text: 'Plan the group trip', done: false })

  // discovery: only CLIs on PATH become peers, and never rows
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [{ provider: 'claude', name: 'Claude Code', path: 'C:\\\\tools\\\\claude.cmd' }])
  const peer = app.contextPeers().find(p => p.id === 'agent-cli:claude')
  assert(peer && peer.online && peer.agentCli.provider === 'claude' && peer.parent === 'device', 'the CLI is a sub-peer of the device')
  assert(!app.contextPeers().some(p => p.id === 'agent-cli:codex'), 'an absent CLI is no peer')
  assert(!c.view(app.state.replica, app.state.view).tasks.some(t => t.title.includes('Claude')), 'no graph row was created')
  assert.equal(app.peerStatus(peer), 'disabled', 'nothing granted yet: grey')

  // the device grid shows the agent as an icon; clicking opens its own constructors with a crumb back
  document.querySelector('.children-toolbar .constructors-toggle').click(); await tick()
  document.querySelector('.peer-tabs [aria-label="This device"]').click(); await tick()
  assert(!document.querySelector('.peer-tabs [aria-label="Claude Code"]'), 'sub-peers are not top-level tabs')
  const icon = document.querySelector('.constructor-grid button.sub-peer[aria-label="Claude Code"]')
  assert(icon && icon.classList.contains('peer-status-disabled'), 'the agent is an icon in the device grid, grey until granted')
  icon.click(); await tick()
  assert(document.querySelector('.peer-crumb').textContent.includes('Claude Code'))
  assert.equal(document.querySelector('.peer-tabs [aria-label="This device"]').getAttribute('aria-selected'), 'true', 'the device tab stays selected inside its sub-peer')
  assert(document.querySelector('.constructor-grid [aria-label="Open Claude Code CLI"]'), 'opening the CLI is a constructor action of the agent')
  assert(!document.querySelector('.constructor-grid [aria-label="Run Claude Code…"]'), 'no SDK run without the SDK')
  assert(!document.querySelector('.constructor-grid [aria-label="Launch Claude Code to execute this task"]'), 'no task launch until the agent and the local MCP server are both enabled')
  assert(document.querySelector('.constructor-grid [aria-label="Plan the group trip"]'), 'child masks apply to the agent peer')
  assert(!document.querySelector('.node-context').textContent.includes('Connect to agent'), 'no separate agent connection row')

  // grants toggles replace the capabilities block; read turns the agent green
  const toggles = [...document.querySelectorAll('.peer-grants input')]
  assert.deepEqual(toggles.map(t => t.getAttribute('aria-label')), ['Claude Code: read', 'Claude Code: write', 'Claude Code: execute'])
  toggles[0].checked = true; toggles[0].dispatchEvent(new window.Event('change')); await tick()
  assert.deepEqual(app.peerGrants('agent-cli:claude'), ['read'])
  assert.equal(app.peerStatus(app.contextPeers().find(p => p.id === 'agent-cli:claude')), 'online')
  // with the local MCP server enabled too, the agent can be launched against this node
  document.querySelector('.peer-crumb .link').click(); await tick()
  document.querySelector('.constructor-grid button.sub-peer[aria-label="Local MCP server"]').click(); await tick()
  const mcpRead = document.querySelector('.peer-grants input[aria-label="Local MCP server: read"]')
  mcpRead.checked = true; mcpRead.dispatchEvent(new window.Event('change')); await tick(); await tick()
  assert(invokes.some(i => i.command === 'node_agent_start'), 'enabling the local MCP server starts its endpoint')
  assert(document.querySelector('.node-context textarea[aria-label="MCP configuration"]').value.includes('local-secret'))
  document.querySelector('.peer-crumb .link').click(); await tick()
  document.querySelector('.constructor-grid button.sub-peer[aria-label="Claude Code"]').click(); await tick()
  const launch = document.querySelector('.constructor-grid [aria-label="Launch Claude Code to execute this task"]')
  assert(launch, 'both enabled: the agent can execute the task through the local MCP server')
  launch.click(); await tick(); await tick()
  assert(launched && launched.mcp && launched.mcp.token === 'local-secret' && launched.cli === true, 'the CLI is launched against the node MCP endpoint')
  document.querySelector('dialog.import-dialog')?.close()

  // dragging the agent into a row gives a row with a select of its actions
  app.applyConstructor(trip, { kind: 'plain', text: 'Claude Code', done: false, peer: 'agent-cli:claude' })
  app.goTo(trip); await tick()
  const select = document.querySelector('.tasks select[aria-label="Claude Code action"]')
  assert(select, 'the dropped sub-peer row has an action select')
  assert([...select.options].some(o => o.textContent === 'Open Claude Code CLI'))

  // the agent disappears when the CLI does
  clis = { claude: null, codex: null }
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [])
  assert(!app.contextPeers().some(p => p.agentCli))
  app.setPeerGrant('mcp:local', 'read', false) // all grants off: the endpoint stops and its poll loop with it
  console.log('agent-peers ok')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); setTimeout(() => process.exit(process.exitCode ?? 0), 1000) })
