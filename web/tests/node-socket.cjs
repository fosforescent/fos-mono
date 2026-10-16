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
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}
  class Socket extends EventTarget {
    static OPEN = 1
    static last
    readyState = 1; sent = []
    constructor() { super(); Socket.last = this }
    send(text) { this.sent.push(JSON.parse(text)) }
    close() { this.readyState = 3 }
  }
  globalThis.WebSocket = Socket
  const session = { username: 'alice', jwt: 'test', kind: 'user', baseUrl: 'http://localhost' }
  let r = c.ensureHomeContext(c.createReplica('browser'), 1)
  r = c.addTask(r, [c.HOME_ID], 'Browser body', 2, 'task')
  app.set({ session, replica: r })
  app.openEvents()
  const socket = Socket.last
  socket.dispatchEvent(new Event('open'))
  assert.deepEqual(socket.sent[0].scope, [c.HOME_ID])
  assert(socket.sent[0].capabilities.includes('provideNode'))
  const request = { peerId: 'user:alice', scope: [c.HOME_ID], path: ['task'], linkId: 'server-link' }
  const ask = async (id, value = request) => {
    socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'provide_node', id, request: value }) }))
    await new Promise(resolve => setImmediate(resolve))
    return socket.sent.find(m => m.id === id)
  }
  assert.equal((await ask('ok')).node.data.description.content, 'Browser body')
  assert((await ask('spoof', { ...request, peerId: 'user:bob' })).error)
  app.set({ policy: { ...app.state.policy, to: [] } })
  assert((await ask('receive-only')).error)
  app.set({ policy: { ...app.state.policy, to: ['read'] } })
  app.set({ replica: c.setNodeLinkMask(app.state.replica, [c.HOME_ID, 'task'], 'user:alice', 'server-link', { fields: [] }, 3) })
  assert.deepEqual((await ask('masked')).node.data, {})
  app.set({ replica: c.addMemberAt(app.state.replica, [c.HOME_ID, 'task'], 'fos', null, ['persist'], 4) })
  app.set({ replica: c.setMemberCapabilitiesAt(app.state.replica, [c.HOME_ID, 'task'], 'fos', ['persist'], ['persist'], 5) })
  assert((await ask('private')).error, 'persistence exclusion prevents relaying private node contents')
  app.set({ replica: c.createReplica('other-session') })
  assert((await ask('stale')).error)
  app.closeEvents(); app.closeEvents = null
  console.log('PASS: browser provider registration, authenticated server identity, local masks, receive-only policy, privacy and session isolation')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); dom.window.close() })
