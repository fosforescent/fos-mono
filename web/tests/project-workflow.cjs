const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-workflow-'))
const dom = new JSDOM('<body></body>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Option']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
navigator.locks = { request: async (_name, _options, callback) => callback({}) }
async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export * from './src/project-workflow'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'; export {repositoryLoadHandler} from '../backend/sync/repository'`, resolveDir: path.resolve(__dirname, '..') }, alias: { '@fosforescent/shared/sync/index': path.resolve(__dirname, '../../shared/sync/index.ts') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs') })
  const c = require(path.join(dir, 'test.cjs')), storage = c.createMemoryStorage()
  let now = 1000, ready = false
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage }); app.now = () => now; app.scheduleSync = () => {}
  const errors = []; app.notify = (kind, message) => { if (kind === 'error') errors.push(message) }
  app.state.session = { kind: 'user', username: 'test', token: 'test-token' }
  let r = c.addTask(app.state.replica, app.state.view, 'Project', now, 'project')
  const project = [...app.state.view, 'project']
  r = c.bindRepository(r, project, 'acme/project', now)
  const config = { project, repo: 'acme/project', device: r.meta.peerId, provider: 'codex', main: 'main', url: 'https://app.example.test', environment: 'production', verifier: 'claude-desktop', enabled: true }
  r = c.configureProjectWorkflow(r, config, now)
  r = c.addMemberAt(r, project, 'agent-cli:codex', 'Codex', ['read', 'edit'], now)
  r = c.addMemberAt(r, c.workflowPath(project), r.meta.peerId, 'Desktop', [], now)
  r = c.setMemberCapabilitiesAt(r, c.workflowPath(project), r.meta.peerId, [], [], now, ['ref-change'])
  r = app.deviceHandlers.publish(r, c.workflowPath(project), r.meta.peerId, now, ['device:agent', 'device:ref-change'])
  r = c.createBranch(r, project, 'feature', ++now)
  r = c.addTask(r, project, 'Phone edited instructions', ++now, 'new-notes')
  await app.saveWorkflowReplica(r)
  await c.requestProjectCoding(app, project)
  assert.deepEqual(errors, [])
  const workflow = c.workflowPath(project)
  let jobs = () => c.view(app.state.replica, workflow).tasks.map(row => ({ path: [...workflow, row.id], job: c.readNodeValue(app.state.replica, [...workflow, row.id], c.WORKFLOW_JOB) })).filter(row => row.job)
  assert.equal(jobs().length, 1)
  const first = jobs()[0]
  assert.equal(first.job.status, 'queued')
  assert.equal(c.evaluationRecord(app.state.replica, first.job.scope.slice(0, -1)).status, 'awaiting-review', 'dispatch does not claim the coding task is complete')
  await app.saveWorkflowReplica(c.addTask(app.state.replica, project, 'Context updated after queuing', ++now, 'latest-note'))
  c.selectBranch(r.store, 'project', 'main')
  const calls = [], pending = [], replies = []
  window.__TAURI__ = { core: { invoke: async (command, args) => {
    calls.push({ command, args })
    if (command === 'local_git') return { cwd: 'C:/isolated-worktree' }
    if (command === 'node_agent_start') return { id: 'endpoint', url: 'http://127.0.0.1:4321/mcp', token: 'scoped-secret' }
    if (command === 'node_agent_poll') return pending.splice(0)
    if (command === 'node_agent_reply') { replies.push(args); return }
    if (command === 'agent_start') return 'run'
    if (command === 'agent_poll') return { finished: false, events: [] }
    return null
  } } }
  // Synchronized graph configuration alone cannot authorize arbitrary local process launches.
  await c.runProjectWorkflows(app)
  assert.equal(calls.length, 0)
  localStorage.setItem(`fos.workflow:${r.meta.peerId}:${JSON.stringify(project)}`, JSON.stringify({ config: JSON.stringify(config), directory: 'C:/project' }))
  now += 6000; await c.runProjectWorkflows(app)
  assert.equal(jobs()[0].job.status, 'launched')
  const launched = calls.find(call => call.command === 'agent_start').args.request
  assert(launched.prompt.includes('Phone edited instructions'))
  assert(launched.prompt.includes('Context updated after queuing'))
  assert.equal(launched.cwd, 'C:/isolated-worktree')
  assert(launched.mcp.url.includes('127.0.0.1'))
  pending.push({ id: 'read', message: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fos_read', arguments: { path: [] } } } })
  await new Promise(resolve => setTimeout(resolve, 450))
  assert(JSON.stringify(replies).includes('Phone edited instructions'), 'MCP reads the requested branch while desktop displays main')
  assert(!c.view(app.state.replica, project).tasks.some(row => row.id === 'new-notes'), 'dispatch preserves desktop branch selection')
  now += 6000; await c.runProjectWorkflows(app)
  assert.equal(calls.filter(call => call.command === 'agent_start').length, 1, 'a durable launch claim is never replayed')
  // Server node-load refresh mediates GitHub -> Fos request -> Fos merge -> library trigger -> agent request.
  const snapshot = { repo: config.repo, defaultBranch: 'main', canPush: true, branches: [{ name: 'main', sha: 'b'.repeat(40) }, { name: 'feature', sha: 'a'.repeat(40) }], pulls: [{ number: 7, title: 'Feature', url: 'https://github.com/acme/project/pull/7', head: 'feature', base: 'main', sha: 'a'.repeat(40), headRepo: config.repo, state: 'open' }] }
  const handler = c.repositoryLoadHandler({ connected: async () => true, snapshot: async () => snapshot })
  const load = async () => app.saveWorkflowReplica(await handler.load({ userId: 1, replica: app.state.replica, path: project, branches: [{ scope: project, name: 'feature' }], now }))
  await load(); await app.runTriggers()
  assert.equal(jobs().length, 1, 'an open PR requests a Fos merge without triggering verification')
  assert.deepEqual(c.view(app.state.replica, project.slice(0, -1)).tasks.find(row => row.id === 'project').branches.mergeRequests, ['feature'])
  snapshot.pulls[0].state = 'merged'; now += 31000
  await load()
  assert.equal(c.view(app.state.replica, [...project, 'new-notes']).name, 'Phone edited instructions')
  await app.runTriggers()
  assert.equal(jobs().length, 2, 'the Fos merge trigger evaluates the library agent request')
  assert.equal(jobs()[1].job.request.provider, 'claude-desktop')
  assert.deepEqual(errors, [])
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ sha: 'a'.repeat(40), ready }) })
  now += 6000; await c.runProjectWorkflows(app)
  assert(!calls.some(call => call.command === 'open_agent_link'))
  ready = true; now += 6000; await c.runProjectWorkflows(app)
  assert.equal(calls.filter(call => call.command === 'open_agent_link').length, 1)
  assert(jobs().some(row => row.job.status === 'handoff'))
  const link = calls.find(call => call.command === 'open_agent_link').args.url
  assert(decodeURIComponent(link).includes(config.url))
  assert(decodeURIComponent(link).includes('a'.repeat(40)))
  assert(decodeURIComponent(link).includes('Phone edited instructions'), 'verification receives the merged graph context')
  now += 6000; await c.runProjectWorkflows(app)
  assert.equal(calls.filter(call => call.command === 'open_agent_link').length, 1)
  now += 31000; await load(); await app.runTriggers(); await c.runProjectWorkflows(app)
  assert.equal(jobs().length, 2, 'repeated repository loads do not repeat the Fos merge or its continuation')
  let isolated = c.loadReplica(c.serializeReplica(app.state.replica))
  c.selectBranch(isolated.store, 'project', 'feature')
  isolated = c.queueAgentEffect(isolated, first.job.scope, 'evaluation:first-effect', now)
  const replay = c.queueAgentEffect(isolated, first.job.scope, 'evaluation:first-effect', now)
  assert.equal(replay, isolated, 'replaying one effect reuses its durable request')
  isolated = c.queueAgentEffect(isolated, first.job.scope, 'evaluation:second-effect', now)
  assert.equal(c.view(isolated, workflow).tasks.filter(row => c.readNodeValue(isolated, [...workflow, row.id], c.WORKFLOW_JOB)).length, 4, 'distinct effects in one evaluation have distinct jobs')
  app.state.session = null // stop background MCP and terminal watchers
  await new Promise(resolve => setTimeout(resolve, 1100))
  window.dispatchEvent(new window.Event('pagehide'))
  console.log('phone coding request, branch-bound MCP, durable dispatch and deployment gate passed')
}
main().then(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) }, error => { console.error(error); process.exitCode = 1; dom.window.close(); rmSync(dir, { recursive: true, force: true }); process.exit(1) })
