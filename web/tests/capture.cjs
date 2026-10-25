/* Captures organized into a node: typed/pasted text and voice notes become an `organize` requirement in the node they
   were captured at, run on the account server (a `complete` event; its organize handler submits the plan, with the raw
   capture as a note, as ONE submission by fos on that node), and the filled request is removed. No organize route.
   Nothing lands in the tree until the device accepts the submission: one local edit (one undo takes it all back) that
   references the submitted rows without loading them. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-capture-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from './src/recording'; export {isLongProse} from './src/paste'; export * from '../shared/sync/index'; export {syncWith} from '../shared/sync/test-helpers'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
const PLAIN_TYPE = 'plain'
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const HOME = c.HOME_ID
  // the recording helpers: iOS only records MP4, old WebViews have no isTypeSupported, a denied microphone says how to allow it
  assert.equal(c.recordingMimeType({ isTypeSupported: t => t.startsWith('audio/webm') }), 'audio/webm;codecs=opus')
  assert.equal(c.recordingMimeType({ isTypeSupported: t => t.startsWith('audio/mp4') }), 'audio/mp4;codecs=mp4a.40.2', 'Safari/WKWebView record MP4')
  assert.equal(c.recordingMimeType({}), undefined)
  assert.equal(c.recordingMimeType({ isTypeSupported: () => { throw new Error('x') } }), undefined)
  assert.equal(c.recordedType('', undefined, [], true), 'audio/mp4', 'iOS blobs without a reported type are MP4')
  assert.equal(c.recordedType('', 'audio/webm', []), 'audio/webm')
  assert.equal(c.recordedType('audio/mp4', 'audio/webm', []), 'audio/mp4')
  assert.match(c.microphoneError(Object.assign(new Error('x'), { name: 'NotAllowedError' })), /denied|off for Fos/)
  assert.match(c.microphoneError(Object.assign(new Error('x'), { name: 'NotFoundError' })), /No microphone/)
  assert(c.isLongProse('word '.repeat(300)) && !c.isLongProse('word '.repeat(10)) && !c.isLongProse('- a\n'.repeat(400)) && !c.isLongProse('# Title\n' + 'word '.repeat(300)))

  const requests = []
  let failOrganize = false, app = null, server = null
  const owner = peerId => ({ peerId, scope: [], owner: true, capabilities: c.SERVER_TRANSPORT_CAPABILITIES })
  globalThis.fetch = async (url, init) => {
    const u = new URL(url)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/user/data/voice-notes') {
      requests.push({ path: u.pathname, query: u.search, type: init.headers['Content-Type'] })
      return json(200, { transcript: 'the tomatoes need stakes and we should start a compost bin' })
    }
    if (u.pathname === '/user/data/events') {
      // the account server (`user:me`, holding what the device synced): a `complete` on the organize requirement runs
      // its organize handler, which submits the plan as fos on the target; the device's next sync brings the filled
      // requirement and the target's pending submissions, not their content
      const body = JSON.parse(init.body), path = body.scope, target = path.slice(0, -1)
      const request = c.organizeRequestAt(server, path)
      requests.push({ path: u.pathname, event: body.event.kind, at: path, request, outline: request && await c.captureOutline(server, target) })
      if (!request) return json(400, { error: 'not an organize requirement' })
      if (failOrganize) return json(400, { error: 'organizing failed: model down' })
      const plan = c.parseOrganizePlan({ title: 'Garden plans', items: [
        { ref: 'n1', parent: 'tomatoes', text: 'buy stakes' },
        { ref: 'n2', parent: null, text: 'Compost' },
        { ref: 'n3', parent: 'n2', text: 'start a bin' },
        { ref: 'n4', parent: 'not-here', text: 'stays inside' },
      ] }, requests.at(-1).outline.map(e => e.id))
      const submitted = await c.proposeOrganizePlan(server, target, plan, { label: request.label, stamp: 'now', text: request.text }, 10)
      const result = { rows: submitted.rows.length, under: [], captureId: submitted.captureId, title: plan.title, proposal: submitted.proposalCid, name: submitted.name, additions: submitted.additions }
      server = c.writeHandlerResult(submitted.replica, path, result, 10)
      server = c.supplyRequirement(server, target, path.at(-1), { by: 'fos', ref: submitted.captureId }, 10)
      return json(200, { evaluation: { status: 'committed' } })
    }
    if (u.pathname === '/user/data/peer-sync/provide-node') {
      // node by node, as the account serves it (a proposal preview here: one node of the submission)
      const body = JSON.parse(init.body)
      requests.push({ path: u.pathname, request: body })
      const served = c.exchangeNode(server, body, owner(body.peerId), 11)
      server = served.replica
      return json(200, served.node)
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }

  app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  // the device's sync with its account: node by node, as the real one (pushes its edited nodes, pulls the rest)
  let syncs = 0, holdSync = false
  app.scheduleSync = () => {}; app.syncNow = async () => { if (holdSync) return; syncs++; app.set({ replica: c.syncWith(app.state.replica, server, { now: 50 + syncs }) }) }
  c.mountUi(document.getElementById('app'), app)
  let me = c.ensureHomeContext(c.createReplica('device:me'), 1)
  me = { ...me, meta: { ...me.meta, peerId: 'device:me', serverPeerId: 'user:me' } }
  me = c.addRow(me, [HOME], PLAIN_TYPE, 'Garden', 2, { id: 'garden' })
  me = c.addRow(me, [HOME, 'garden'], PLAIN_TYPE, 'Tomatoes', 3, { id: 'tomatoes' })
  me = c.addRow(me, [HOME], PLAIN_TYPE, 'Work', 4, { id: 'work' })
  server = c.createReplica('user:me')
  me = c.syncWith(me, server, { now: 5 })
  app.set({ replica: me, session: { kind: 'user', username: 'me', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  app.recordServerOffers([...c.SERVER_TRANSPORT_CAPABILITIES, 'llm'])
  app.goTo([HOME, 'garden']); await tick()
  assert(!app.canOrganize(), 'a model alone does not organize: the fos peer offers organize')
  app.recordServerOffers([...c.SERVER_TRANSPORT_CAPABILITIES, 'llm', 'organize'])
  assert(app.canOrganize(), 'the account organizes captures here')
  const rows = at => c.view(app.state.replica, at).tasks.filter(t => !t.scalar).map(t => t.title)

  // typed text: the capture box in the node's input workspace
  document.querySelector('.input-toggle').click(); await tick()
  const box = document.querySelector('.node-input .capture-text'), organize = document.querySelector('.node-input .organize-capture')
  assert(box && organize, 'the input workspace has a capture box')
  assert(organize.disabled, 'nothing to organize yet')
  box.value = 'tomatoes need stakes; start a compost bin'
  box.dispatchEvent(new window.Event('input'))
  assert(!organize.disabled)
  organize.click()
  for (let i = 0; i < 40 && box.value; i++) await tick()
  const sent = requests.find(r => r.path === '/user/data/events')
  assert.equal(sent.event, 'complete', 'organizing is an evaluation of the requirement, not a route')
  assert.deepEqual(sent.at.slice(0, -1), [HOME, 'garden'], 'the requirement sits in the node it organizes into')
  assert.deepEqual(sent.request, { label: 'Pasted text', text: 'tomatoes need stakes; start a compost bin' })
  assert.deepEqual(sent.outline.map(e => e.id), ['tomatoes'], 'the outline is the target\'s subtree, without the request')
  assert(!c.view(app.state.replica, [HOME, 'garden']).tasks.some(t => t.id === sent.at.at(-1)), 'the filled request is removed')
  // nothing is in the tree yet: the result is one pending submission from fos on the node, its content not here
  const ids = at => c.view(app.state.replica, at).tasks.filter(t => !t.scalar).map(t => t.id)
  assert.deepEqual(ids([HOME, 'garden']), ['tomatoes'])
  assert.deepEqual(rows([HOME, 'garden', 'tomatoes']), [])
  const pending = app.currentView().proposals
  assert.equal(pending.length, 1)
  assert.equal(pending[0].peerId, 'fos')
  assert.equal(pending[0].name, 'Pasted text: Garden plans')
  const content = c.readProposal(server.store, pending[0].id).contentCid
  assert(!app.state.replica.store.table.has(content), 'the submission\'s content stays with the account until it is asked for')
  assert.equal(box.value, '', 'the box clears once filed')
  assert.equal(app.state.voice, null)
  // The named result binding now syncs, including the exact four rows reported by the organizer.
  assert.match(app.state.notice.text, /Pasted text organized: 4 rows and the original as a note, waiting for you in Branches/)

  // accepting: one local edit, the submitted rows referenced where the account holds them (not loaded), one undo takes it all back
  requests.length = 0
  holdSync = true // the device is offline for a moment: what accepting does on its own
  await app.decideProposal(pending[0].id, 'approve')
  assert(requests.every(r => r.path === '/user/data/peer-sync/provide-node' && r.request.proposal?.id === pending[0].id), 'only the submission\'s nodes are asked for, not a decision on the server')
  assert.deepEqual(requests.map(r => r.request.path), [[HOME, 'garden'], [HOME, 'garden', 'tomatoes']], 'one shallow node per node it adds rows to')
  assert.equal(ids([HOME, 'garden']).length, 4, 'the node, a new group, the row of an unknown parent and the capture note')
  const garden = c.view(app.state.replica, [HOME, 'garden']).tasks
  assert(garden.filter(t => t.id !== 'tomatoes').every(t => t.refPeer === 'user:me'), 'the rows are the account\'s, loaded when opened')
  assert.equal(ids([HOME, 'garden', 'tomatoes']).length, 1, 'a row filed under an existing row')
  assert.deepEqual(rows([HOME, 'work']), [], 'nothing lands outside the node')
  assert.match(app.state.notice.text, /one edit/)
  assert(!c.view(server, [HOME, 'garden']).tasks.some(t => t.title === 'Compost'), 'the account has nothing on main yet')
  // one undo removes the whole capture; redo brings it back
  app.undo()
  assert.deepEqual(ids([HOME, 'garden']), ['tomatoes'], 'one undo removes the whole capture')
  assert.deepEqual(ids([HOME, 'garden', 'tomatoes']), [])
  app.redo()
  assert.equal(ids([HOME, 'garden']).length, 4)
  // syncing pushes the edited nodes: the account fills the rows from its submission and closes it; the rows load when shown
  holdSync = false
  await app.syncNow('test')
  assert(c.view(server, [HOME, 'garden']).tasks.some(t => t.title === 'Compost'), 'on the account\'s main now')
  assert.deepEqual(c.view(server, [HOME, 'garden']).proposals, [], 'the submission is closed')
  await app.syncNow('poll') // the node that held the submission is pulled again (it was pushed before the last node that closed it)
  assert.deepEqual(app.currentView().proposals, [])
  app.refresh()
  for (let i = 0; i < 40 && !rows([HOME, 'garden']).includes('Compost'); i++) await tick()
  assert(rows([HOME, 'garden']).includes('Compost'), 'a row loads when it is shown')

  // a voice note, with "accept right away" on: transcribed (iOS MP4 accepted as is), organized, accepted as one edit
  const toggle = document.querySelector('.node-input .auto-accept-captures input')
  assert(toggle && !toggle.checked)
  toggle.checked = true; toggle.dispatchEvent(new window.Event('change'))
  assert.equal(app.autoAcceptCaptures, true)
  requests.length = 0
  const beforeVoice = ids([HOME, 'garden']).length
  await app.submitVoice(new Blob([new Uint8Array(4000)], { type: 'audio/mp4' }), [HOME, 'garden'])
  assert.deepEqual(requests[0], { path: '/user/data/voice-notes', query: '?transcript=only', type: 'audio/mp4' })
  assert.deepEqual(requests[1].request, { label: 'Voice note', text: 'the tomatoes need stakes and we should start a compost bin' })
  assert.equal(ids([HOME, 'garden']).length, beforeVoice + 3, 'accepted on the device: the group, the row and the transcript note')
  assert.equal(ids([HOME, 'garden', 'tomatoes']).length, 2)
  assert.match(app.state.notice.text, /Voice note organized: 4 rows added here/)
  assert.equal(app.state.voice, null)
  app.undo()
  assert.equal(ids([HOME, 'garden']).length, beforeVoice, 'still one undo for the whole capture')
  toggle.checked = false; toggle.dispatchEvent(new window.Event('change'))

  // the model unreachable: the capture is still kept, unorganized, and the person is told
  failOrganize = true
  const count = rows([HOME, 'garden']).length
  assert.equal(await app.organizeText('remember the hose', [HOME, 'garden']), true)
  assert.equal(rows([HOME, 'garden']).length, count + 1)
  const kept = c.view(app.state.replica, [HOME, 'garden']).tasks.at(-1)
  assert(c.view(app.state.replica, [HOME, 'garden', kept.id]).tasks.find(t => t.scalar).title.endsWith('remember the hose'), 'the capture is the note body')
  assert(!c.view(app.state.replica, [HOME, 'garden']).tasks.some(t => t.requirement && t.requirement.capability === 'organize'), 'the failed request is removed too')
  assert.match(app.state.notice.text, /unorganized: organizing failed: model down/)
  failOrganize = false

  // a long prose paste goes to the capture box instead of a row per line; short and structured pastes keep their rows
  const paste = (target, text) => {
    const event = new window.Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } })
    target.dispatchEvent(event)
    return event
  }
  const nodeText = document.querySelector('.node-title-input')
  const prose = ('We walked the beds this morning and the soil is dry. ' .repeat(25) + '\n').repeat(2)
  assert(paste(nodeText, prose).defaultPrevented)
  assert.equal(document.querySelector('.node-input .capture-text').value, prose)
  assert.equal(app.state.notice.kind, 'info')
  const childCount = rows([HOME, 'garden']).length
  paste(nodeText, 'short one\nshort two')
  assert.equal(rows([HOME, 'garden']).length, childCount + 2, 'short pastes still become rows')

  // a denied microphone (iOS: the permission switched off) is reported and leaves nothing recording
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }) } }, configurable: true })
  globalThis.MediaRecorder = class { static isTypeSupported(type) { return type.startsWith('audio/mp4') } }
  assert(app.canRecordVoice())
  await app.toggleVoice()
  assert.equal(app.state.voice, null)
  assert.match(app.state.notice.text, /denied|off for Fos/)
  // no MediaRecorder (old WebView): the button explains instead of failing
  delete globalThis.MediaRecorder
  assert(!app.canRecordVoice())
  app.refresh(); await tick()
  assert.match(document.querySelector('[data-region="mic"]').title, /cannot record|iOS 14.3/)
  console.log('capture: ok')
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1) })
