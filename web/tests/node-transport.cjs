const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-transport-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })

async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {DirectLink} from './src/p2p'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
  const c = require(path.join(dir, 'test.cjs'))
  class Channel extends EventTarget {
    readyState = 'open'; sent = []
    send(text) { this.sent.push(JSON.parse(text)); queueMicrotask(() => this.other.dispatchEvent(new MessageEvent('message', { data: text }))) }
    close() { this.readyState = 'closed'; this.dispatchEvent(new Event('close')) }
  }
  const host = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  const guest = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  for (const app of [host, guest]) { app.scheduleSync = () => {}; app.syncNow = async () => {} }
  let r = c.addTask(c.createReplica('host'), [], 'Parent', 1, 'parent')
  r = c.addTask(r, ['parent'], 'Child', 2, 'child')
  r = c.addTask(r, ['parent', 'child'], 'Grandchild secret', 3, 'grandchild')
  c.commitRoot(r.store, c.updateAtScope(r.store, c.headCid(r), [], value => ({ ...value, data: { ...value.data, description: { content: 'Shared root text' } } })), 3)
  host.set({ replica: r, direct: { role: 'host', phase: 'connected', pendingPeer: { peerId: 'guest', name: 'Guest' } } })
  guest.set({ replica: c.createReplica('guest'), direct: { role: 'guest', phase: 'connected' } })
  const a = new Channel(), b = new Channel(); a.other = b; b.other = a
  const hostLink = new c.DirectLink({ close() {} }, a), guestLink = new c.DirectLink({ close() {} }, b)
  hostLink.remotePeerId = 'guest'; guestLink.remotePeerId = 'host'
  host.attachLink(hostLink, 'host'); guest.attachLink(guestLink, 'guest')
  const request = { peerId: 'guest', scope: [], path: [], linkId: 'guest-root-link' }
  await assert.rejects(() => guestLink.requestNode(request), /not been approved/)
  await assert.rejects(() => guestLink.sync(c.buildSyncRequest(guest.state.replica, undefined, { recipient: 'device' })), /not been approved/)
  host.approveDirectPeer(true)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert(guestLink.remoteCapabilities.includes('provideNode'))
  const node = await guestLink.requestNode(request)
  guest.set({ replica: c.acceptProvidedNode(guest.state.replica, [], request, node, 4) })
  assert.equal(c.view(guest.state.replica, []).tasks[0].refPeer, 'host')
  await guest.loadPeerNode(['parent'])
  assert.equal(c.view(guest.state.replica, ['parent']).name, 'Parent')
  assert.equal(c.view(guest.state.replica, ['parent']).tasks[0].refPeer, 'host')
  assert(!JSON.stringify(a.sent).includes('Grandchild secret'))
  const before = b.sent.filter(m => m.t === 'node').length
  await Promise.all([guest.loadPeerNode(['parent', 'child']), guest.loadPeerNode(['parent', 'child'])])
  assert.equal(b.sent.filter(m => m.t === 'node').length, before + 1, 'concurrent requests for one row share a request')
  assert.equal(c.view(guest.state.replica, ['parent', 'child']).name, 'Child')
  assert(!JSON.stringify(a.sent).includes('Grandchild secret'))
  // The guest also serves nodes over the same approved connection.
  const reverse = await hostLink.requestNode({ peerId: 'host', scope: [], path: [], linkId: c.nodeLinkEndpoint(host.state.replica, [], 'guest').id })
  assert.equal(reverse.peerId, 'guest')
  assert.equal(reverse.data.description.content, 'Shared root text')
  guest.setNodeMask('host', { fields: [] })
  const filtered = await hostLink.requestNode({ peerId: 'host', scope: [], path: [], linkId: c.nodeLinkEndpoint(host.state.replica, [], 'guest').id })
  assert.deepEqual(filtered.data, {}, 'the receiving endpoint independently masks the reverse direction')
  hostLink.close(); guestLink.close()
  console.log('PASS: approved bidirectional WebRTC node requests, on-demand navigation and request deduplication')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); dom.window.close() })
