/* Relay on a device: "Send to <peer>" in a row's menu leaves the row as a relay message addressed to that peer where a
   relay is offered; Home's inbox lists what was delivered to this device (its queue under its member entry on the
   relay node, which arrives by ordinary node sync) with an Acknowledge button that leaves an ack row in the queue. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-relay-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 20))
const HOME = c.HOME_ID, HUB = [HOME, 'hub']

/** A hub in Home that knows the desktop, where the fos server offers relay. */
function withHub(r) {
  r = c.addTask(r, [HOME], 'Hub', 1, 'hub')
  r = c.addMemberAt(r, HUB, 'desktop', 'Desktop', ['read', 'edit'], 2)
  r = c.addMemberAt(r, HUB, 'fos', 'fos', [], 3)
  return c.setMemberCapabilitiesAt(r, HUB, 'fos', [], [], 4, ['relay'])
}

/** An owner's device syncs its Home with the account node by node, as the app and the CLI do. */
function sync(device, server, now) {
  const local = device.meta.localScope ?? []
  const run = c.nodeTreeSync(device, { peer: server.meta.peerId, scope: [], remoteRoot: local, localRoot: local, branches: [], push: true }, () => now)
  const authority = { peerId: device.meta.peerId, scope: [], owner: true, capabilities: c.SERVER_TRANSPORT_CAPABILITIES }
  let step = run.next()
  while (!step.done) step = run.next(c.exchangeNode(server, step.value.request, authority, now).node)
  return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: server.meta.peerId } }
}

async function main() {
  // the phone: "Send to Desktop" on a row of the hub
  const phone = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  phone.scheduleSync = () => {}; phone.syncNow = async () => {}
  mountUi(phone)
  phone.set({ replica: c.addTask(withHub(phone.state.replica), HUB, 'Summarize the repository', 5, 'job') })
  assert.deepEqual(phone.relayRecipients([...HUB, 'job']).map(p => p.peerId), ['desktop'], 'members where a relay is offered, not the fos server')
  assert.deepEqual(phone.relayRecipients([HOME, 'nowhere']), [])
  phone.goTo(HUB)
  phone.openContextMenu({ kind: 'task', at: [], task: c.view(phone.state.replica, HUB).tasks.find(t => t.id === 'job') })
  await tick()
  const send = [...document.querySelectorAll('.menu-item')].find(b => b.textContent === 'Send to Desktop')
  assert(send, 'the row menu offers Send to Desktop')
  send.click()
  await tick()
  const message = c.view(phone.state.replica, HUB).tasks.find(t => t.id.startsWith('relay:job:'))
  assert(message, 'the row was left as a relay message at the hub')
  assert.equal(message.type, c.RELAY_MESSAGE)
  assert.deepEqual(c.view(phone.state.replica, [...HUB, message.id]).tasks.map(t => t.title), ['Summarize the repository'])
  assert(!c.view(phone.state.replica, HUB).tasks.some(t => t.id === 'job'), 'the row moved into the message')
  // where the relay runs (the fos server after the sync), the message moves into the desktop's queue
  const relayed = c.relayAt(phone.state.replica, HUB, 'fos', 10)
  assert.deepEqual(c.view(relayed, [...HUB, 'fos:peer:desktop', c.RELAY_QUEUE_ID]).tasks.map(t => t.id), [message.id])

  // the desktop: the account holds a delivered message; an ordinary sync brings its queue, Home shows the inbox
  let server = c.ensureHomeContext(c.createReplica('user:me'), 1)
  server = c.addTask(withHub(server), HUB, 'Review the pull request', 5, 'review')
  server = c.addRelayMessage(server, HUB, 'desktop', 6, 'm1')
  server = c.moveNode(server, HUB, 'review', HUB, { into: 'm1' }, 7)
  server = c.relayAt(server, HUB, 'fos', 8)
  dom.window.document.body.innerHTML = '<div id="app"></div>'
  const desktop = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  desktop.scheduleSync = () => {}; desktop.syncNow = async () => {}
  mountUi(desktop)
  desktop.set({ replica: sync(c.shareHome(c.ensureHomeContext(c.createReplica('desktop'), 1)), server, 20) })
  desktop.goTo([HOME])
  await tick()
  assert.deepEqual(desktop.relayInbox().map(m => [m.id, m.rows.map(r => r.title)]), [['m1', ['Review the pull request']]])
  const inbox = document.querySelector('.relay-inbox')
  assert(inbox && inbox.textContent.includes('Review the pull request'), 'Home lists the delivered message')
  inbox.querySelector('.relay-ack').click()
  await tick()
  assert.deepEqual(desktop.relayInbox(), [], 'acknowledged here at once')
  assert(!document.querySelector('.relay-inbox'))
  // the ack goes back on the next sync; the relay takes both out, and the following sync clears the queue here
  desktop.set({ replica: sync(desktop.state.replica, server, 30) })
  server = c.relayAfterSubmission(server, [...HUB, 'fos:peer:desktop', c.RELAY_QUEUE_ID, 'relay:ack:m1'], 'fos', 31)
  assert.deepEqual(c.view(server, [...HUB, 'fos:peer:desktop', c.RELAY_QUEUE_ID]).tasks, [])
  desktop.set({ replica: sync(desktop.state.replica, server, 32) })
  assert.deepEqual(c.view(desktop.state.replica, [...HUB, 'fos:peer:desktop', c.RELAY_QUEUE_ID]).tasks, [])
  console.log('relay: ok')
}
function mountUi(app) { c.mountUi(document.getElementById('app'), app) }
main().then(() => process.exit(0), error => { console.error(error); process.exit(1) })
