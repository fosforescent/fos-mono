const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-agent-ui-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
const tick = () => new Promise(resolve => setImmediate(resolve))
let app, connection
async function main() {
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new window.Event('close')) }
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export * from './src/node-agent'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  const storage = c.createMemoryStorage()
  app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage, scopedDocument: true })
  app.scheduleSync = () => {}; app.startPolling = () => {}; app.openEvents = () => {}
  c.mountUi(document.getElementById('app'), app)
  const id = app.addRowAt([], 'plain', 'Agent project'); app.goTo([id])
  let stopped = 0, pending = [], replies = []
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    if (command === 'node_agent_start') return { id: 'endpoint', url: 'http://127.0.0.1:1234/mcp', token: 'local-secret' }
    if (command === 'node_agent_poll') { const result = pending; pending = []; return result }
    if (command === 'node_agent_reply') { replies.push(args); return }
    if (command === 'node_agent_stop') { stopped++; return }
    if (command === 'agent_start') return 'probe'
    if (command === 'agent_poll') return { finished: true, events: [{ type: 'availability', codex: false, claude: false }] }
    throw new Error(command)
  } } }
  app.refresh()
  const buttons = () => [...document.querySelectorAll('.node-context button')]
  buttons().find(button => button.textContent === 'Connect to agent').click()
  assert(document.querySelector('.node-agent-dialog'))
  assert(!document.querySelector('.node-agent-dialog select'), 'host comes from the selected peer menu')
  document.querySelector('.node-agent-dialog button[type="button"]').click()
  document.querySelector('.peer-tabs [aria-label="Add peer"]').click()
  assert(!buttons().some(button => button.textContent === 'Connect to agent'), 'Add peer does not duplicate host actions')
  document.querySelector('.peer-tabs [aria-label="Fos server"]').click()
  assert(buttons().find(button => button.textContent === 'Connect to agent').disabled)
  connection = await c.connectNodeAgent(app, 'desktop', 'Local agent')
  assert(c.contextMembers(app.state.replica, [id]).some(member => member.peerId === connection.peer))
  pending.push({ id: 'read', message: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fos_read', arguments: {} } } })
  for (let i = 0; i < 20 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(JSON.parse(replies[0].response.result.content[0].text).data.description.content, 'Agent project')
  assert(!JSON.stringify(storage.loadReplica()).includes('local-secret'), 'credentials are never saved in the graph')
  await connection.stop(); connection = null
  assert.equal(stopped, 1)
  assert(!c.contextMembers(app.state.replica, [id]).some(member => member.name === 'Local agent'))
  const task = app.applyConstructor([], { kind: 'task', text: 'Delegated evaluation', done: false })
  await app.startExecution(task)
  connection = await c.connectEvaluationAgent(app)
  replies = []
  pending.push({ id: 'evaluation-read', message: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fos_read', arguments: {} } } })
  for (let i = 0; i < 20 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(JSON.parse(replies[0].response.result.content[0].text).evaluation.nodes[0].text, 'Delegated evaluation')
  assert(!JSON.stringify(storage.loadReplica()).includes('local-secret'))
  app.exitExecution()
  for (let i = 0; i < 20 && stopped < 2; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(stopped, 2, 'leaving execution revokes the evaluation endpoint')
  await connection.stop(); connection = null
  app.goTo([id])
  app.set({ session: { kind: 'user', username: 'alice', jwt: 'owner-token', baseUrl: 'http://localhost' }, connection: 'online' })
  app.syncNow = async () => { app.state.replica.meta.baseCid = c.headCid(app.state.replica) }
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    const body = url.endsWith('/peer-invite') ? { token: 'invitation', inviteId: 7 }
      : url.endsWith('/peer/connect') ? { requestId: 'claim' }
      : url.includes('/peer/connect/claim?') ? { status: 'approved', jwt: 'scoped-agent-token' } : {}
    return { ok: true, json: async () => body }
  }
  const hosted = await c.connectNodeAgent(app, 'server', 'Hosted agent')
  assert.equal(hosted.token, 'scoped-agent-token')
  assert(hosted.url.endsWith('/peer-sync/mcp'))
  assert.deepEqual(JSON.parse(calls.find(call => call.url.endsWith('/peer-invite')).init.body).scope, [id])
  assert.deepEqual(JSON.parse(calls.find(call => call.url.endsWith('/7/approve')).init.body).capabilities, ['edit'])
  await hosted.stop()
  assert(calls.some(call => call.init?.method === 'DELETE' && call.url.includes(encodeURIComponent(hosted.peer))))
  console.log('PASS: host-specific agent menus, local bridge, scoped hosted credentials, and disconnection')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { if (connection) await connection.stop(); if (app) app.logout(); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
