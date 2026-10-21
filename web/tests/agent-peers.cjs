// Agents found on this computer are sub-peers of the device: discovered at startup (a filesystem query, never a graph
// row), shown as icons in the device's constructor grid, opened for their own constructors and grants, draggable into
// a row as a select of their actions, and maskable like any peer. The launch is a button on the agent's own panel: a
// new terminal on this node, connected to it as that peer (its grants decide the MCP tools); Claude Code can also open
// in VS Code and Claude Desktop in a new chat.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const TASK_TYPE = 'lib:type:task'
const PLAIN_TYPE = 'lib:type:plain'
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-agent-peers-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), logLevel: 'silent', external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  const invokes = [], requests = [], replies = []
  let clis = { claude: 'C:\\\\tools\\\\claude.cmd', codex: null, vscode: { claude: true }, claudeDesktop: true }
  let launched = null, finished = false
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    invokes.push({ command, args })
    if (command === 'agent_clis') return clis
    if (command === 'agent_start') { launched = args.request; return 'run-1' }
    if (command === 'agent_poll') return { finished, events: [] }
    if (command === 'agent_control') { finished = true; return }
    if (command === 'node_agent_start') return { id: 'endpoint', url: 'http://127.0.0.1:4321/mcp', token: 'local-secret' }
    if (command === 'node_agent_poll') return requests.splice(0)
    if (command === 'node_agent_reply') { replies.push(args); return }
    if (command === 'node_agent_stop') return
    if (command === 'open_agent_link') return
    if (command === 'find_project') return null
    return null
  } } }
  if (!window.HTMLDialogElement.prototype.showModal) { window.HTMLDialogElement.prototype.showModal = function () { this.open = true }; window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')) } }
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  const trip = app.applyConstructor(app.state.view, { type: TASK_TYPE, text: 'Plan the group trip', done: false })

  // discovery: only CLIs on PATH become peers, and never rows
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [{ provider: 'claude', name: 'Claude Code', path: 'C:\\\\tools\\\\claude.cmd', vscode: true }])
  const peer = app.contextPeers().find(p => p.id === 'agent-cli:claude')
  assert(peer && peer.online && peer.agentCli.provider === 'claude' && peer.parent === 'device', 'the CLI is a sub-peer of the device')
  assert(!app.contextPeers().some(p => p.id === 'agent-cli:codex'), 'an absent CLI is no peer')
  assert(app.contextPeers().some(p => p.id === 'agent-app:claude-desktop' && p.parent === 'device'), 'Claude Desktop is a sub-peer of the device')
  assert(!c.view(app.state.replica, app.state.view).tasks.some(t => t.title.includes('Claude')), 'no graph row was created')
  assert.equal(app.peerStatus(peer), 'disabled', 'nothing granted yet: grey')

  // the device grid shows the agent as an icon; clicking opens its own panel with a crumb back
  document.querySelector('.children-toolbar .constructors-toggle').click(); await tick()
  document.querySelector('.peer-tabs [aria-label="This device"]').click(); await tick()
  assert(!document.querySelector('.peer-tabs [aria-label="Claude Code"]'), 'sub-peers are not top-level tabs')
  const icon = document.querySelector('.constructor-grid button.sub-peer[aria-label="Claude Code"]')
  assert(icon && icon.classList.contains('peer-status-disabled'), 'the agent is an icon in the device grid, grey until granted')
  icon.click(); await tick()
  assert(document.querySelector('.peer-crumb').textContent.includes('Claude Code'))
  assert.equal(document.querySelector('.peer-tabs [aria-label="This device"]').getAttribute('aria-selected'), 'true', 'the device tab stays selected inside its sub-peer')
  assert(!document.querySelector('.constructor-grid [aria-label="Open Claude Code CLI"]') && !document.querySelector('.constructor-grid [aria-label="Run Claude Code…"]'), 'no SDK run or dialog launcher')
  // launching makes the agent's row on this node: its grants, Launch, and the sessions it runs
  document.querySelector('.constructor-grid [aria-label="Launch Claude Code on this task"]').click(); await tick()
  let agentName = 'Claude Code'
  const agentRow = () => [...document.querySelectorAll('.tree .constructor-body')].find(b => b.textContent.includes(`@{${agentName}}`))
  assert(agentRow(), 'the launch constructor makes the agent row')
  const panelButton = label => [...agentRow().querySelectorAll('button')].find(b => b.textContent === label)
  assert(panelButton('Launch Claude Code on this task').disabled, 'nothing granted: the launch is off')
  assert(document.querySelector('.constructor-grid [aria-label="Plan the group trip"]'), 'child masks apply to the agent peer')

  // grants toggles; read turns the agent green and enables the launch
  const toggles = [...agentRow().querySelectorAll('.peer-grants input')]
  assert.deepEqual(toggles.map(t => t.getAttribute('aria-label')), ['Claude Code: read', 'Claude Code: write', 'Claude Code: execute'])
  toggles[0].checked = true; toggles[0].dispatchEvent(new window.Event('change')); await tick()
  assert.deepEqual(app.peerGrants('agent-cli:claude'), ['read'])
  assert.equal(app.peerStatus(app.contextPeers().find(p => p.id === 'agent-cli:claude')), 'online')
  panelButton('Launch Claude Code on this task').click(); await tick(); await tick(); await tick()
  assert(invokes.some(i => i.command === 'node_agent_start'), 'the launch starts an MCP endpoint for this node')
  assert(launched && launched.mcp && launched.mcp.token === 'local-secret' && !launched.context, 'the terminal CLI is connected to the node, not a snapshot')
  assert(launched.prompt.trim(), 'the prompt is the node text')
  assert(!document.querySelector('dialog'), 'no output dialog: the session runs in its own terminal')
  // the endpoint acts as the agent peer with its grants as they are now: read only, then execute adds outstanding work
  const toolNames = async () => {
    requests.push({ id: `r${requests.length}${replies.length}`, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })
    await wait(400)
    return replies.at(-1).response.result.tools.map(t => t.name)
  }
  let names = await toolNames()
  assert(names.includes('fos_read') && !names.includes('fos_outstanding') && !names.includes('fos_propose'))
  app.setPeerGrant('agent-cli:claude', 'execute', true); app.setPeerGrant('agent-cli:claude', 'edit', true); await tick()
  names = await toolNames()
  assert(names.includes('fos_outstanding') && names.includes('fos_propose'), 'execute shows the outstanding work, write proposes')
  requests.push({ id: 'work', message: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fos_outstanding', arguments: {} } } })
  await wait(400)
  const work = JSON.parse(replies.at(-1).response.result.content[0].text)
  assert(work.items.some(item => item.title === 'Plan the group trip'), 'the open task is outstanding work for the agent')
  // the running session shows on the panel and can be stopped
  app.refresh(); await tick()
  assert(agentRow().textContent.includes('session running in a terminal'))
  panelButton('Stop sessions').click(); await wait(1200)
  assert(!agentRow().textContent.includes('session running in a terminal'))

  // VS Code: the Claude Code tab link carries the prompt
  panelButton('Open in VS Code').click(); await tick()
  const vscode = invokes.filter(i => i.command === 'open_agent_link').at(-1)
  assert(vscode.args.url.startsWith('vscode://anthropic.claude-code/open?prompt=') && decodeURIComponent(vscode.args.url).includes('Plan the group trip'))

  // Claude Desktop: its own icon and panel; Open starts a chat with the prompt
  document.querySelector('.peer-crumb .link').click(); await tick()
  document.querySelector('.constructor-grid button.sub-peer[aria-label="Claude Desktop"]').click(); await tick()
  document.querySelector('.constructor-grid [aria-label="Open in Claude Desktop"]').click(); await tick()
  agentName = 'Claude Desktop'
  panelButton('Open in Claude Desktop').click(); await tick()
  const desktop = invokes.filter(i => i.command === 'open_agent_link').at(-1)
  assert(desktop.args.url.startsWith('claude://claude.ai/new?q=') && decodeURIComponent(desktop.args.url).includes('Plan the group trip'))
  assert(panelButton('Connect to Claude Desktop…').disabled, 'connecting needs a grant and a signed-in account')

  // dragging the agent into a row gives its row there, with its grants and launch once that node is open
  app.applyConstructor(trip, { type: PLAIN_TYPE, text: 'Claude Code', done: false, peer: 'agent-cli:claude' })
  app.goTo(trip); await tick()
  agentName = 'Claude Code'
  assert(panelButton('Launch Claude Code on this task'), 'the dropped sub-peer row launches the agent here')

  // the agents disappear when the CLI and the app do
  clis = { claude: null, codex: null }
  await app.probeLocalAgents(); await tick()
  assert.deepEqual(app.state.localAgents, [])
  assert(!app.contextPeers().some(p => p.agentCli || p.agentApp))
  console.log('agent-peers ok')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); setTimeout(() => process.exit(process.exitCode ?? 0), 1000) })
