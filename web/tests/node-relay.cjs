const assert = require('node:assert/strict')
const { build } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-api-'))
async function main() {
  await build({ stdin: { contents: `export {createNodeProvider} from './backend/sync/provideNode'; export {NodeRelay} from './backend/sync/nodeRelay'; export * from './shared/sync/index'`, resolveDir: path.resolve(__dirname, '../..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), plugins: [{ name: 'injected-persistence', setup(b) {
    b.onResolve({ filter: /^\.\/accountStore$/ }, () => ({ path: 'accountStore', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const withUserLock = async (_, f) => f(); export const serverPeerIdFor = name => 'user:' + name` }))
    b.onResolve({ filter: /^@fosforescent\/shared\/sync\/index$/ }, () => ({ path: path.resolve(__dirname, '../../shared/sync/index.ts') }))
  } }] })
  const c = require(path.join(dir, 'test.cjs'))
  let browser = c.ensureHomeContext(c.createReplica('browser'), 1)
  browser = c.addTask(browser, [c.HOME_ID], 'On-demand browser value', 2, 'held')
  browser = c.addTask(browser, [c.HOME_ID, 'held'], 'Unrequested descendant secret', 3, 'deep')
  let server = c.ensureHomeContext(c.createReplica('user:alice'), 1)
  const serverShape = c.nodeShape(server, [c.HOME_ID])
  server = c.installNodeShape(server, [c.HOME_ID], { ...serverShape, children: [{ id: 'held', kind: 'task', address: { peerId: 'browser', scope: [c.HOME_ID, 'held'] } }] }, 4)
  const relay = new c.NodeRelay(30)
  const closes = [], packets = []
  let answer = true, pending
  const socket = { readyState: 1, on: (_, fn) => closes.push(fn), send(text) {
    const packet = JSON.parse(text); packets.push(packet)
    pending = () => {
      const result = c.exchangeNode(browser, packet.request, { peerId: 'user:alice', scope: [c.HOME_ID], owner: true, capabilities: ['provideNode', 'sync'] }, 5)
      browser = result.replica
      relay.receive(1, socket, { type: 'provided_node', id: packet.id, node: result.node })
    }
    if (answer) queueMicrotask(pending)
  } }
  relay.register(1, 'browser', socket, [c.HOME_ID], ['provideNode'])
  let saves = 0
  const handler = c.createNodeProvider({ loadStore: async () => ({ user: { id: 1, username: 'alice' }, store: server.store }), saveStore: async () => { saves++ } }, relay)
  const call = async (request, selectedHandler = handler) => {
    const out = { status: 200, body: null }; const res = { status(n) { out.status = n; return res }, json(body) { out.body = body; return res }, setHeader() {} }
    await selectedHandler({ body: request, claims: { username: 'alice', kind: 'user' } }, res)
    return out
  }
  const request = { peerId: 'reader', scope: [], path: [c.HOME_ID, 'held'], linkId: 'reader-held' }
  const first = await call(request)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.data.description.content, 'On-demand browser value')
  assert(!JSON.stringify(first.body).includes('Unrequested descendant secret'))
  assert.equal(packets.length, 1)
  assert.equal(first.body.peerId, 'user:alice')
  assert.equal(first.body.children[0].address.peerId, 'browser')
  assert.equal((await call(request)).status, 200)
  assert.equal(packets.length, 1, 'already held node does not ask its browser again')
  const a = c.nodeLinkEndpoint(browser, [c.HOME_ID, 'held'], 'user:alice')
  const b = c.nodeLinkEndpoint(server, [c.HOME_ID, 'held'], 'browser')
  assert.equal(a.remoteId, b.id); assert.equal(b.remoteId, a.id)
  await assert.rejects(relay.request(2, 'browser', [c.HOME_ID, 'held'], { peerId: 'user:bob', linkId: 'x' }), /offline/)
  await assert.rejects(relay.request(1, 'browser', ['private'], { peerId: 'user:alice', linkId: 'x' }), /outside/)
  answer = false
  const deep = { ...request, path: [c.HOME_ID, 'held', 'deep'], linkId: 'reader-deep' }
  const malicious = c.createNodeProvider({ loadStore: async () => ({ user: { id: 1, username: 'alice' }, store: server.store }), saveStore: async () => { throw new Error('must not persist forged response') } }, { request: async (_user, _peer, address, input) => ({ ...first.body, peerId: 'browser', address: { peerId: 'browser', scope: address }, remoteLinkId: input.linkId, children: [{ id: 'stolen', kind: 'ref', address: { peerId: 'other-peer', scope: ['private'] } }] }) })
  assert.equal((await call(deep, malicious)).status, 403, 'a provider cannot introduce another provider through the relay')
  const stale = call(deep)
  await new Promise(resolve => setImmediate(resolve))
  assert(relay.receive(2, socket, { type: 'provided_node', id: packets.at(-1).id, node: first.body }))
  assert(relay.receive(1, { ...socket }, { type: 'provided_node', id: packets.at(-1).id, node: first.body }))
  // Revoke the reader after dispatch, before the provider responds.
  server = c.addMemberAt(server, [c.HOME_ID], 'reader', null, [], 6)
  pending()
  assert.equal((await stale).status, 403, 'live grants are rechecked after the wait')
  assert.equal(saves, 1, 'revoked response is never persisted')
  await assert.rejects(relay.request(1, 'browser', [c.HOME_ID, 'held'], { peerId: 'user:alice', linkId: 'x' }), /timed out/)
  const disconnected = relay.request(1, 'browser', [c.HOME_ID, 'held'], { peerId: 'user:alice', linkId: 'x' })
  closes.forEach(fn => fn())
  await assert.rejects(disconnected, /disconnected/)
  relay.register(1, 'browser', socket, [c.HOME_ID], [])
  await assert.rejects(relay.request(1, 'browser', [c.HOME_ID, 'held'], { peerId: 'user:alice', linkId: 'x' }), /provideNode/)
  console.log('PASS: HTTP/browser relay, reciprocal links, lazy descendants, account/socket isolation, revocation, timeout and disconnect')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
