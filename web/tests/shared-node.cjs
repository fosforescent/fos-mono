// A node another account shared with this one opens as a live projection: provided by the account server as that
// account's peer `user:<me>`, edited through proposals, run on the owner's host with the `execute` grant.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const PLAIN_TYPE = 'title'
const REF_TYPE = 'ref'
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-shared-node-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })

async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), logLevel: 'silent', external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  const HOME = c.HOME_ID
  // alice's account on the server: a node shared with bob (read, edit, execute)
  let alice = c.addTask(c.ensureHomeContext(c.createReplica('user:alice'), 1), [HOME], 'Plan the group trip', 2, 'trip')
  alice = c.addTask(alice, [HOME, 'trip'], 'Book flights', 3, 'flights')
  alice = c.addMemberAt(alice, [HOME, 'trip'], 'user:bob', 'bob', ['read', 'edit', 'execute'], 4)
  const serverCaps = c.SERVER_TRANSPORT_CAPABILITIES
  const calls = []
  let now = 100
  globalThis.fetch = async (url, init) => {
    const u = new URL(url), body = init?.body ? JSON.parse(init.body) : null
    calls.push({ path: u.pathname + u.search, body })
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/user/data/peer-sync/locate') {
      return u.searchParams.get('owner') === 'alice' && u.searchParams.get('id') === 'trip' ? json(200, { owner: 'alice', aliasId: 'trip', path: [HOME, 'trip'], title: 'Plan the group trip', grants: ['read', 'edit', 'execute'] }) : json(403, { error: 'This node is not shared with you.' })
    }
    if (u.pathname === '/user/data/peer-sync/provide-node') {
      assert.equal(body.owner, 'alice'); assert.equal(body.peerId, 'user:bob')
      const { owner, ...request } = body
      const served = c.exchangeNode(alice, request, { peerId: 'user:bob', scope: request.scope, owner: false, proposeOnly: true, capabilities: serverCaps }, ++now)
      alice = served.replica
      return json(200, served.node)
    }
    if (u.pathname === '/user/data/events') {
      assert.equal(body.owner, 'alice')
      const dispatched = c.dispatchEvent(alice, body.event, { peerId: 'user:bob', owner: false, scope: body.scope }, ++now)
      alice = dispatched.replica
      if (dispatched.evaluate) { calls.push({ evaluated: dispatched.evaluate }); return json(200, { evaluation: { status: 'committed' } }) }
      return json(200, dispatched.result)
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }
  // bob's device: signed in, with the shared node as a foreign ref in his Home (as an accepted invite leaves it)
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}
  const origSyncNow = app.syncNow.bind(app); app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  let bob = c.ensureHomeContext(c.createReplica('user:bob'), 1)
  bob = { ...bob, meta: { ...bob.meta, peerId: 'user:bob', serverPeerId: 'user:bob' } }
  bob = c.addRow(bob, [HOME], PLAIN_TYPE, 'alice', 2, { id: 'shared-host:alice' })
  bob = c.addRow(bob, [HOME, 'shared-host:alice'], REF_TYPE, 'Plan the group trip', 3, { id: 'member:trip', refOwner: 'alice', refId: 'trip' })
  app.set({ replica: bob, session: { kind: 'user', username: 'bob', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  const at = [HOME, 'shared-host:alice', 'member:trip']
  app.goTo([HOME, 'shared-host:alice'])
  assert(document.querySelector('.ref-link'), 'the shared node is a foreign ref row')

  // open: locate + provide-node, then the row is a projection and the view moves there
  await app.openSharedNode(at)
  assert(app.isPeerNode(at), 'the ref became a live projection')
  assert.deepEqual(app.state.view, at)
  assert.deepEqual(app.sharedNodeAt(at), { owner: 'alice', scope: [HOME, 'trip'], root: at })
  assert.deepEqual(app.sharedGrants(at), ['read', 'edit', 'execute'])
  assert(document.querySelector('.shared-grants').textContent.includes('Shared by @alice'))
  assert(document.querySelector('.shared-grants').textContent.includes('run evaluations'))
  assert(!document.querySelector('.node-toolbar .evaluate').disabled, 'Run is enabled with the execute grant')
  const children = c.view(app.state.replica, at).tasks
  assert.deepEqual(children.map(t => [t.id, t.refPeer]), [['flights', 'user:alice']], 'children are stubs held by the owner')

  // children load through the owner's account as user:bob, and a local edit syncs back as bob's proposal there
  await app.loadPeerNode([...at, 'flights'])
  assert.equal(c.view(app.state.replica, [...at, 'flights']).name, 'Book flights')
  app.set({ replica: c.renameTask(app.state.replica, at, 'flights', 'Book flights early', 50) })
  await app.syncSharedNodes(false)
  const trip = c.view(alice, [HOME, 'trip'])
  assert.deepEqual(trip.proposals.map(p => [p.peerId, p.name, p.status]), [['user:bob', '', 'open']], 'the edit is a proposal on the owner\'s node')
  assert.equal(c.view(alice, [HOME, 'trip', 'flights']).name, 'Book flights', 'main content is untouched until alice decides')

  // Run: alice's host evaluates the node for bob (execute); the request names her and the node's path in her account
  await app.evaluateAt(at)
  const evaluated = calls.find(call => call.evaluated)
  assert(evaluated, 'the owner\'s host was asked to evaluate')
  assert.deepEqual(evaluated.evaluated.path, [HOME, 'trip'])
  assert(calls.some(call => call.path === '/user/data/events' && call.body.event.kind === 'complete' && call.body.owner === 'alice'))

  // without execute, Run is refused before anything is sent
  alice = c.setMemberCapabilitiesAt(alice, [HOME, 'trip'], 'user:bob', ['read', 'edit'], [], 60)
  app.set({ replica: { ...app.state.replica, meta: { ...app.state.replica.meta, nodeSync: Object.fromEntries(Object.entries(app.state.replica.meta.nodeSync).map(([k, v]) => [k, { ...v, remote: { ...v.remote, grants: ['read', 'edit'] } }])) } } })
  const before = calls.length
  await app.evaluateAt(at)
  assert.equal(calls.length, before, 'nothing was sent')
  assert(app.state.notice?.text.includes('run evaluations'))
  assert(document.querySelector('.node-toolbar .evaluate').disabled)

  // a listing without a grant falls back to the market view
  bob = app.state.replica
  app.set({ replica: c.addRow(bob, [HOME], REF_TYPE, 'A listing', 70, { id: 'listing', refOwner: 'carol', refId: 'job' }) })
  let market = null; app.openMarket = async (owner, id) => { market = [owner, id] }
  await app.openSharedNode([HOME, 'listing'])
  assert.deepEqual(market, ['carol', 'job'])
  void origSyncNow
  console.log('shared-node ok')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
