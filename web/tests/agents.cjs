const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const TASK_TYPE = 'task'
const PLAIN_TYPE = 'plain'
const dir = mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'fos-agent-test-'))
try {
  buildSync({ stdin: { contents: `export * from './src/agents'; export {App} from './src/app'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs') })
  const { App, createMemoryStorage, localRepository, agentContext, headCid } = require(path.join(dir, 'test.cjs'))
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() }); app.scheduleSync = () => {}
  const parent = app.applyConstructor(app.state.view, { type: PLAIN_TYPE, text: 'Repository', done: false, peer: 'filesystem' }, false, undefined, '/tmp/project')
  const child = app.applyConstructor(parent, { type: TASK_TYPE, text: 'Implement feature', done: false })
  app.applyConstructor(child, { type: TASK_TYPE, text: 'Add button', done: false })
  app.applyConstructor(parent, { type: TASK_TYPE, text: 'Private sibling', done: false })
  assert.equal(localRepository(app.state.replica, child), '/tmp/project')
  const context = agentContext(app.state.replica, child)
  assert.equal(context.nodes[0].text, 'Implement feature')
  assert.equal(context.nodes[1].text, 'Add button')
  assert(!JSON.stringify(context).includes('Private sibling'))
  assert.equal(context.revision, headCid(app.state.replica))
  assert.equal(localRepository({ ...app.state.replica, meta: { ...app.state.replica.meta, peerId: 'another-device' } }, child), null)
  app.undo()
  assert.equal(context.nodes.length, 2, 'captured context is independent of later graph changes')
  console.log('desktop agent context tests passed')
} finally { rmSync(dir, { recursive: true, force: true }) }
