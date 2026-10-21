// The MCP servers are sub-peers: the device's loopback endpoint for a node (`mcp:local`) and the account server's
// hosted one (`mcp:server`). Their read / write / execute toggles decide which tools they expose; with everything
// off they accept no connections. Credentials never enter the graph.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const PLAIN_TYPE = 'lib:type:plain'
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-agent-ui-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
const tick = () => new Promise(resolve => setImmediate(resolve))
let app
async function main() {
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new window.Event('close')) }
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export * from './src/node-agent'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  const storage = c.createMemoryStorage()
  app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage, scopedDocument: true })
  app.scheduleSync = () => {}; app.startPolling = () => {}; app.openEvents = () => {}
  c.mountUi(document.getElementById('app'), app)
  const id = app.addRowAt([], PLAIN_TYPE, 'Agent project'); app.goTo([id])
  let stopped = 0, pending = [], replies = []
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    if (command === 'node_agent_start') return { id: 'endpoint', url: 'http://127.0.0.1:1234/mcp', token: 'local-secret' }
    if (command === 'node_agent_poll') { const result = pending; pending = []; return result }
    if (command === 'node_agent_reply') { replies.push(args); return }
    if (command === 'node_agent_stop') { stopped++; return }
    if (command === 'agent_start') return 'probe'
    if (command === 'agent_poll') return { finished: true, events: [{ type: 'availability', codex: false, claude: false }] }
    if (command === 'agent_clis') return { claude: null, codex: null }
    throw new Error(command)
  } } }
  app.refresh()
  const grid = () => document.querySelector('.constructor-grid')
  document.querySelector('.children-toolbar .constructors-toggle').click(); await tick()
  document.querySelector('.peer-tabs [aria-label="This device"]').click(); await tick()
  assert(![...document.querySelectorAll('.node-context button')].some(b => b.textContent === 'Connect to agent'), 'no separate agent connection row')
  const local = grid().querySelector('button.sub-peer[aria-label="Local MCP server"]')
  assert(local && local.classList.contains('peer-status-disabled'), 'the local MCP server is a grey sub-peer of the device until granted')
  local.click(); await tick()
  assert(document.querySelector('.node-context').textContent.includes('accepts no connections'), 'all toggles off: disabled')
  assert.equal(stopped, 0)

  // read on: the endpoint starts and serves fos_read / fos_search only; the member peer is mcp:local
  const toggle = label => document.querySelector(`.peer-grants input[aria-label="Local MCP server: ${label}"]`)
  toggle('read').checked = true; toggle('read').dispatchEvent(new window.Event('change')); await tick(); await tick()
  assert(c.contextMembers(app.state.replica, [id]).some(m => m.peerId === 'mcp:local' && m.capabilities.includes('read')))
  assert(document.querySelector('.node-context textarea[aria-label="MCP configuration"]').value.includes('http://127.0.0.1:1234/mcp'))
  pending.push({ id: 'list', message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })
  for (let i = 0; i < 30 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.deepEqual(replies[0].response.result.tools.map(t => t.name).sort(), ['fos_read', 'fos_search', 'fos_task_status'], 'read exposes the reading tools only')
  replies = []
  pending.push({ id: 'read', message: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fos_read', arguments: {} } } })
  for (let i = 0; i < 30 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(JSON.parse(replies[0].response.result.content[0].text).data.description.content, 'Agent project')
  replies = []
  pending.push({ id: 'propose', message: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'fos_propose', arguments: { expected: 'x', changes: [{ path: [], operation: 'add_task', text: 'nope' }] } } } })
  for (let i = 0; i < 30 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert(replies[0].response.result.isError && replies[0].response.result.content[0].text.includes('unavailable'), 'writing is not offered without the write grant')
  assert(!JSON.stringify(storage.loadReplica()).includes('local-secret'), 'credentials are never saved in the graph')

  // write and execute widen what is exposed; all off stops the endpoint
  toggle('write').checked = true; toggle('write').dispatchEvent(new window.Event('change')); await tick()
  assert(c.contextMembers(app.state.replica, [id]).find(m => m.peerId === 'mcp:local').capabilities.includes('edit'))
  replies = []
  pending.push({ id: 'list2', message: { jsonrpc: '2.0', id: 4, method: 'tools/list' } })
  for (let i = 0; i < 30 && !replies.length; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert(replies[0].response.result.tools.some(t => t.name === 'fos_propose') && replies[0].response.result.tools.some(t => t.name === 'fos_decide'))
  toggle('execute').checked = true; toggle('execute').dispatchEvent(new window.Event('change')); await tick()
  replies = []
  pending.push({ id: 'await', message: { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'fos_await_task', arguments: { timeoutMs: 5000 } } } })
  await new Promise(resolve => setTimeout(resolve, 400))
  pending.push({ id: 'parallel-read', message: { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'fos_read', arguments: {} } } })
  for (let i = 0; i < 30 && !replies.some(r => r.requestId === 'parallel-read'); i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert(replies.some(r => r.requestId === 'parallel-read'), 'a pending await must not block subsequent desktop MCP requests')
  assert(!replies.some(r => r.requestId === 'await'))
  app.set({ replica: c.addTask(app.state.replica, [id], 'Arrived while waiting', 10, 'new-task') })
  for (let i = 0; i < 35 && !replies.some(r => r.requestId === 'await'); i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(JSON.parse(replies.find(r => r.requestId === 'await').response.result.content[0].text).task.title, 'Arrived while waiting')
  // Separate MCP sessions on one endpoint claim different tasks; their tool lists follow the claim.
  async function rpc(requestId, method, params, sessionId = 'worker-a') {
    pending.push({ id: requestId, sessionId, message: { jsonrpc: '2.0', id: requestId, method, params } })
    for (let i = 0; i < 40 && !replies.some(r => r.requestId === requestId); i++) await new Promise(resolve => setTimeout(resolve, 50))
    const response = replies.find(r => r.requestId === requestId)?.response
    assert(response, `missing response for ${requestId}`)
    return response.result
  }
  const tool = async (id, name, args, sessionId) => {
    const result = await rpc(id, 'tools/call', { name, arguments: args }, sessionId)
    return result.isError ? { error: result.content[0].text } : JSON.parse(result.content[0].text)
  }
  const beforeClaim = await tool('claim-read', 'fos_read', { path: ['new-task'] })
  const claimed = await tool('claim', 'fos_claim_task', { path: ['new-task'], expected: beforeClaim.revision })
  assert.equal(claimed.status, 'claimed')
  const taskTools = await rpc('claimed-tools', 'tools/list')
  assert(taskTools.tools.some(t => t.name === 'fos_task_submit') && !taskTools.tools.some(t => t.name === 'fos_read'))
  const conflict = await tool('competing-claim', 'fos_claim_task', { path: ['new-task'], expected: beforeClaim.revision }, 'worker-b')
  assert.match(conflict.error, /already claimed/)
  const taskRead = await tool('task-read', 'fos_task_read', { claimId: claimed.claim.id })
  assert.equal(taskRead.title, 'Arrived while waiting')
  const originalFlush = storage.flush
  storage.flush = async () => { throw new Error('Disk unavailable') }
  const failed = await tool('failed-task-submit', 'fos_task_submit', { claimId: claimed.claim.id, expected: taskRead.revision, changes: [{ path: [], operation: 'add_note', text: 'Tested result' }] })
  assert.equal(failed.error, 'Disk unavailable')
  storage.flush = originalFlush
  assert.equal((await tool('still-claimed', 'fos_task_status', {})).claim.id, claimed.claim.id)
  assert.equal((await tool('still-original', 'fos_task_read', { claimId: claimed.claim.id })).revision, taskRead.revision)
  const submitted = await tool('task-submit', 'fos_task_submit', { claimId: claimed.claim.id, expected: taskRead.revision, changes: [{ path: [], operation: 'add_note', text: 'Tested result' }] })
  assert.equal(submitted.status, 'awaiting-review')
  assert.equal(submitted.releasedClaimId, claimed.claim.id)
  assert((await rpc('restored-tools', 'tools/list')).tools.some(t => t.name === 'fos_await_task'))
  toggle('execute').checked = false; toggle('execute').dispatchEvent(new window.Event('change')); await tick()
  for (const label of ['read', 'write']) { toggle(label).checked = false; toggle(label).dispatchEvent(new window.Event('change')); await tick() }
  for (let i = 0; i < 30 && stopped < 1; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(stopped, 1, 'with nothing granted the endpoint stops')
  assert(document.querySelector('.node-context').textContent.includes('accepts no connections'))

  // the hosted MCP server: a scoped credential whose capabilities are the grants
  app.set({ session: { kind: 'user', username: 'alice', jwt: 'owner-token', baseUrl: 'http://localhost' }, connection: 'online' })
  app.syncNow = async () => { app.state.replica = (r => { const peer = r.meta.serverPeerId ?? 'user:test', nodeSync = {}; for (const p of c.materializedNodePaths(r, r.meta.localScope ?? [])) nodeSync[c.nodeSyncKey(peer, p, c.nodeBranches(r, p))] = { local: c.nodeShape(r, p), remote: c.nodeShape(r, p) }; return { ...r, meta: { ...r.meta, serverPeerId: peer, nodeSync, lastSyncAt: 1 } } })(app.state.replica) }
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    const body = url.endsWith('/peer-invite') ? { token: 'invitation', inviteId: 7 }
      : url.endsWith('/peer/connect') ? { requestId: 'claim' }
      : url.includes('/peer/connect/claim?') ? { status: 'approved', jwt: 'scoped-agent-token' } : {}
    return { ok: true, json: async () => body }
  }
  document.querySelector('.peer-tabs [aria-label="Fos server"]').click(); await tick()
  const hostedIcon = grid().querySelector('button.sub-peer[aria-label="Fos MCP server"]')
  assert(hostedIcon, 'the hosted MCP server is a sub-peer of the server'); hostedIcon.click(); await tick()
  const hosted = label => document.querySelector(`.peer-grants input[aria-label="Fos MCP server: ${label}"]`)
  hosted('read').checked = true; hosted('read').dispatchEvent(new window.Event('change')); await tick()
  hosted('execute').checked = true; hosted('execute').dispatchEvent(new window.Event('change')); await tick()
  const create = [...document.querySelectorAll('.node-context button')].find(b => b.textContent === 'Create credential')
  assert(create && !create.disabled); create.click()
  for (let i = 0; i < 30 && !document.querySelector('.node-context textarea[aria-label="MCP configuration"]'); i++) await new Promise(resolve => setTimeout(resolve, 50))
  const config = document.querySelector('.node-context textarea[aria-label="MCP configuration"]').value
  assert(config.includes('scoped-agent-token') && config.includes('/peer-sync/mcp'))
  assert.deepEqual(JSON.parse(calls.find(call => call.url.endsWith('/peer-invite')).init.body).scope, [id])
  assert.deepEqual(JSON.parse(calls.find(call => call.url.endsWith('/7/approve')).init.body).capabilities.sort(), ['execute', 'read'], 'the credential carries exactly the grants')
  assert(!c.contextMembers(app.state.replica, [id]).some(m => m.peerId.startsWith('agent:')), 'no throwaway agent member: the sub-peer is the member')
  const connection = c.hostedMcpConnection(app, [id])
  assert(connection && connection.peer === 'mcp:server')
  await connection.stop()
  assert(calls.some(call => call.init?.method === 'DELETE' && call.url.includes(encodeURIComponent('mcp:server'))))
  console.log('PASS: MCP servers as sub-peers with read/write/execute toggles, filtered tools, and scoped hosted credentials')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { if (app) app.logout(); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
