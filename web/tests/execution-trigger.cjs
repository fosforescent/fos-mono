const assert = require('node:assert/strict')
const { build } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const TEMPLATE_TYPE = 'template'
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-execution-trigger-'))
async function main() {
  await build({ nodePaths: [path.resolve(__dirname, '../node_modules'), ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean)], stdin: { contents: `export {createSharingHandlers} from './backend/sync/sharing'; export {createEventService} from './backend/sync/events'; export * from './shared/sync/execution-access'; export * from './shared/sync/index'`, resolveDir: path.resolve(__dirname, '../..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), plugins: [{ name: 'persistence', setup(b) {
    b.onResolve({ filter: /\/accountStore$/ }, () => ({ path: 'locks', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const serverPeerIdFor = name => 'user:' + name; const locks = new Map(); export async function withUserLock(key, f) { const previous = locks.get(key) ?? Promise.resolve(); let release; const next = new Promise(r => release = r); locks.set(key, previous.then(() => next)); await previous; try { return await f() } finally { release() } }` }))
    b.onResolve({ filter: /^@fosforescent\/shared\/sync\// }, args => ({ path: path.resolve(__dirname, '../../shared/sync', args.path.split('/').at(-1) + '.ts') }))
  } }] })
  const c = require(path.join(dir, 'test.cjs'))
  let host = c.addRow(c.createReplica('user:host'), [], TEMPLATE_TYPE, 'Research form', 1, { id: 'form' })
  host = c.addRefAt(host, ['form'], 'answer', host.store.primitive.documentField.getId(), 2, null, 'Research question')
  host = c.addRequirement(host, ['form'], 'Confirm participation', 2, { capability: 'confirmation' }, 'confirm')
  host = c.addRequirement(host, ['form'], 'Choose topic', 2, { capability: 'choice', options: ['Graphs', 'Biology'] }, 'choice')
  // What visitors may use is a grant of the host's shelf, held by a handle row the form refers to. The host's
  // allocate handler (the server's, here the shared effect) issues it and later runs the visitors' consumption.
  const allocate = { id: 'fos:allocate', label: 'allocate', type: (store, at) => c.libAt(store, at).capabilities.allocate }
  host = c.publishNativeRef(host, [], 'fos', c.nativeRef(host.store, 'fos', allocate, { ...allocate, native: c.allocateNative }, []), 0)
  host = c.addBank(host, [], 'Shelf', 2, { type: 'inventory', unit: 'item' }, 'shelf')
  host = c.issueGrant(host, ['shelf'], { type: 'inventory', unit: 'item', amount: 2 }, 2, 'Stock', 'g0')
  const allocateExecutors = (get, set) => step => c.primitiveExecutors(get(), step, 'fos').map(() => ({ native: c.allocateNative }))
  {
    let r = host
    const issued = await c.evaluateNode(['g0'], { get: () => r, save: next => { r = next }, now: () => 100, check: () => [], executors: allocateExecutors(() => r, next => { r = next }) })
    assert.equal(issued.status, 'committed', issued.error)
    host = r
  }
  host = c.addRefAt(host, [], 'stock', c.libraryTypeAt(host.store, 'allocation', []), 2, null, 'Available items')
  host = c.planAllocation(host, [], { owner: ['shelf'], inputs: [{ grant: c.ownerGrants(host, ['shelf'])[0].cid }], outputs: [{ type: 'inventory', unit: 'item', amount: 2, to: ['stock'] }] }, 2, 'issue')
  {
    let r = host
    const issued = await c.evaluateNode(['issue'], { get: () => r, save: next => { r = next }, now: () => 100, check: () => [], executors: allocateExecutors(() => r, next => { r = next }) })
    assert.equal(issued.status, 'committed', issued.error)
    host = r
  }
  assert.equal(c.handleAt(host, ['stock']).allocation.amount, 2)
  host = c.addTask(host, [], 'Private sibling secret', 3, 'private')
  const replicas = { host, alice: c.createReplica('user:alice'), bob: c.createReplica('user:bob') }
  // The host evaluates finished executions through its own driver: graph-only, plus its allocate handler.
  const evaluate = async (username, request) => {
    let r = c.createReplica('user:' + username, replicas[username].store)
    const result = await c.evaluateNode(request.path, { get: () => r, save: async next => { r = next; replicas[username] = c.createReplica('user:' + username, next.store) }, now: () => 100, check: () => [], executors: allocateExecutors(() => r, next => { r = next }) })
    if (result.status !== 'committed') throw new Error(result.error ?? 'needs recovery')
    return result
  }
  const h = c.createSharingHandlers({ loadStore: async name => replicas[name] ? { user: { id: name === 'host' ? 1 : name === 'alice' ? 2 : 3, username: name }, store: replicas[name].store } : null, saveStore: async (user, store) => { replicas[user.username] = c.createReplica('user:' + user.username, store) }, now: () => 100 }, 'test-secret', evaluate)
  const call = async (action, body, account) => { const result = { status: 200 }; const res = { setHeader() {}, status(n) { result.status = n; return this }, json(value) { result.body = value; return this } }; await h[action]({ body, ...(account ? { claims: { kind: 'user', username: account } } : {}) }, res); return result }
  // publishing the template is the owner's member edge: the audience may run it (execute)
  const configure = async audience => { replicas.host = c.publish(replicas.host, ['form'], audience, 3); return { status: 200 } }
  // Hosted interaction is the event grammar: one service behind HTTP, MCP and the WebSocket. The host evaluates
  // `complete` through its own driver (here: graph-only, no external handlers).
  const hostDeps = { loadStore: async name => replicas[name] ? { user: { id: 1, username: name }, store: replicas[name].store } : null, saveStore: async (user, store) => { replicas[user.username] = c.createReplica('user:' + user.username, store) }, now: () => 100 }
  const events = c.createEventService(hostDeps, evaluate)
  const interact = async (claims, scope, event) => events.handle(events.principalOf(claims, scope), event)
  await assert.rejects(interact({ username: 'host', kind: 'peer' }, [], { kind: 'read', path: ['private'] }), /peer attachment/)
  replicas.host = c.addTask(replicas.host, [], 'API task', 3, 'api-task')
  replicas.host = c.addRequirement(replicas.host, ['api-task'], 'Confirm', 3, { capability: 'confirmation' }, 'api-confirm')
  let snapshot = await interact({ username: 'host' }, ['api-task'], { kind: 'read', path: [] })
  assert.equal(snapshot.evaluation.inputs.length, 1, 'declared inputs travel with the read')
  await assert.rejects(interact({ username: 'host' }, ['api-task'], { kind: 'input', path: [], expected: 'stale', key: snapshot.evaluation.inputs[0].key, value: true }), /changed/)
  await assert.rejects(interact({ username: 'host' }, ['api-task'], { kind: 'input', path: [], expected: snapshot.revision, key: '["private"]', value: true }), /declared/)
  snapshot = await interact({ username: 'host' }, ['api-task'], { kind: 'input', path: [], expected: snapshot.revision, key: snapshot.evaluation.inputs[0].key, value: true })
  const owner = events.principalOf({ username: 'host' }, ['api-task'])
  const escape = await c.handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fos_evaluate', arguments: { path: ['private'], expected: 'x' } } }, { owner: true, dispatch: event => events.handle(owner, event) })
  assert(escape.result.isError, 'MCP cannot leave its bound scope')
  const read = await interact({ username: 'host' }, ['api-task'], { kind: 'read', path: [] })
  const mcp = await c.handleMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fos_evaluate', arguments: { path: [], expected: read.valueRevision } } }, { owner: true, dispatch: event => events.handle(owner, event) })
  assert(!mcp.result.isError, JSON.stringify(mcp))
  assert.equal(c.view(replicas.host, []).tasks.filter(t => t.id !== c.LIBRARY_ID).find(t => t.id === 'private').done, false)
  assert.equal(c.evaluationRecord(replicas.host, ['api-task']).status, 'committed')
  replicas.host = c.addTask(replicas.host, [], 'Peer accessible task', 3, 'peer-task')
  replicas.host = c.addMemberAt(replicas.host, ['peer-task'], 'peer:reader', 'Reader', ['read'], 3)
  replicas.host = c.addMemberAt(replicas.host, ['peer-task'], 'peer:editor', 'Editor', ['read', 'edit'], 3)
  const reader = { username: 'host', kind: 'peer', peerId: 'peer:reader', scope: ['peer-task'] }
  const peerSnapshot = await interact(reader, [], { kind: 'read', path: [] })
  assert.equal(peerSnapshot.evaluation.status, 'idle')
  assert.equal(c.evaluationRecord(replicas.host, ['peer-task']), null, 'endpoint exists without evaluation constructor')
  await assert.rejects(interact(reader, [], { kind: 'complete', path: [], expected: peerSnapshot.valueRevision }), /cannot request/)
  await assert.rejects(interact({ ...reader, peerId: 'peer:editor' }, [], { kind: 'complete', path: [], expected: peerSnapshot.valueRevision }), /accepts evaluation requests/, 'nobody accepts requests here yet')
  replicas.host = c.setMemberCapabilitiesAt(c.addMemberAt(replicas.host, ['peer-task'], 'user:host-laptop', 'Laptop', [], 3), ['peer-task'], 'user:host-laptop', [], [], 3, ['request'])
  const requested = await interact({ ...reader, peerId: 'peer:editor' }, [], { kind: 'complete', path: [], expected: (await interact({ ...reader, peerId: 'peer:editor' }, [], { kind: 'read', path: [] })).valueRevision })
  assert.equal(requested.status, 'requested', 'an editor\'s completion becomes an evaluation request for the owner\'s rules')
  assert(c.view(replicas.host, ['peer-task']).proposals.some(p => p.peerId === 'peer:editor' && p.status === 'open'))
  replicas.host = c.removeMemberAt(replicas.host, ['peer-task'], 'peer:reader', 4)
  await assert.rejects(interact(reader, [], { kind: 'read', path: [] }), /access/)
  const configured = await configure('public'); assert.equal(configured.status, 200)
  const at = { owner: 'host', path: ['form'] }
  let [a, b] = await Promise.all([call('visit', at), call('visit', at)])
  assert.equal(a.status, 200); assert.equal(b.status, 200)
  assert.notDeepEqual(a.body.address, b.body.address)
  assert(!JSON.stringify(a.body).includes('Private sibling secret'))
  assert.equal((await call('visit', a.body.address)).status, 404, 'private URL alone grants no access')
  assert.equal((await call('visit', { ...a.body.address, visitorToken: b.body.visitorToken })).status, 404)
  const again = await call('visit', { ...at, visitorToken: a.body.entryToken })
  assert.deepEqual(again.body.address, a.body.address, 'returning browser resumes one instance')
  assert.equal((await call('visit', { ...a.body.address, visitorToken: a.body.visitorToken })).status, 200)
  // Instantiation closes a template's references into values, so a run cannot carry a live link to the shared stock
  // yet; the host offers it by placing a reference row in each run. Every run then refers to the one handle.
  for (const run of [a, b]) replicas.host = c.addRow(replicas.host, run.body.address.path, 'ref', '', 4, { id: 'offer', refId: 'stock' })
  const refreshed = await call('visit', { ...a.body.address, visitorToken: a.body.visitorToken })
  assert.equal(refreshed.status, 200)
  a = { ...a, body: { ...a.body, node: refreshed.body.node } }
  const offer = a.body.node.inputs.find(f => f.direction === 'consume')
  assert(offer, 'offered allocations are visitor inputs')
  const excessive = await call('submit', { ...a.body.address, visitorToken: a.body.visitorToken, revision: a.body.node.revision, approvals: [], ranking: [], fields: { [offer.key]: { value: { amount: 3, type: 'inventory', unit: 'item' } } } })
  assert.equal(excessive.status, 400, 'cannot consume more than offered')
  const submitted = await call('submit', { ...a.body.address, visitorToken: a.body.visitorToken, revision: a.body.node.revision, approvals: [], ranking: [], fields: Object.fromEntries(a.body.node.inputs.map(f => [f.key, { value: f.kind === 'text' ? 'Only my research' : f.kind === 'confirmation' ? true : f.kind === 'choice' ? 0 : { amount: 1, type: 'inventory', unit: 'item' } }])) })
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body))
  assert.equal(submitted.body.node.execution.status, 'committed', JSON.stringify({ execution: submitted.body.node.execution, inputs: submitted.body.node.inputs }))
  assert.deepEqual(c.ownerGrants(replicas.host, ['shelf']).map(g => g.allocation.amount).sort(), [1, 1], 'the shelf holds the item used and the item remaining as separate grants')
  assert.equal(c.handleAt(replicas.host, ['stock']).allocation.amount, 1, 'the shared handle now names the remainder')
  assert.equal(c.executionInputs(replicas.host, b.body.address.path).length, 4, 'the other visitor is offered what remains of the shared stock')
  assert.equal(c.sharedInputs(replicas.host, ['form']).length, 2, 'template remains unchanged (its text slot and choice)')
  replicas.host = c.removeMemberAt(replicas.host, b.body.address.path, b.body.node.mine.peer, 101)
  assert.equal((await call('visit', { ...at, visitorToken: b.body.entryToken })).status, 404, 'entry cannot reattach a revoked visitor')
  replicas.host = c.unpublish(replicas.host, ['form'], 'public', 102)
  await configure('users'); const userAt = { ...at }
  assert.equal((await call('visit', userAt)).status, 404)
  const alice = await call('visit', userAt, 'alice'), aliceAgain = await call('visit', userAt, 'alice')
  assert.deepEqual(alice.body.address, aliceAgain.body.address)
  assert.equal((await call('visit', alice.body.address, 'bob')).status, 404)
  assert.equal((await call('visit', { ...a.body.address, visitorToken: a.body.visitorToken })).status, 404, 'an endpoint no longer published to its audience revokes its runs')
  console.log('PASS: hosted interaction through the event grammar, template instances, browser/account identity, private link isolation, declared inputs, completion and revocation')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
