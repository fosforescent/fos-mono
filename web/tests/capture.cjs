/* Captures organized into a node: typed/pasted text and voice notes become an `organize` requirement in the node they
   were captured at, run on the account server (a `complete` event; its organize handler applies the plan there and
   keeps the raw capture as a note), and the filled request is removed. No organize route. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-capture-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from './src/recording'; export {isLongProse} from './src/paste'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
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
  let failOrganize = false, app = null
  globalThis.fetch = async (url, init) => {
    const u = new URL(url)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/user/data/voice-notes') {
      requests.push({ path: u.pathname, query: u.search, type: init.headers['Content-Type'] })
      return json(200, { transcript: 'the tomatoes need stakes and we should start a compost bin' })
    }
    if (u.pathname === '/user/data/events') {
      // the account server: a `complete` on the organize requirement runs its organize handler (syncs are no-ops here,
      // so the result is applied to the device's replica as a sync would bring it)
      const body = JSON.parse(init.body), path = body.scope, r = app.state.replica, target = path.slice(0, -1)
      const request = c.organizeRequestAt(r, path)
      requests.push({ path: u.pathname, event: body.event.kind, at: path, request, outline: request && await c.captureOutline(r, target) })
      if (!request) return json(400, { error: 'not an organize requirement' })
      if (failOrganize) return json(400, { error: 'organizing failed: model down' })
      const plan = c.parseOrganizePlan({ title: 'Garden plans', items: [
        { ref: 'n1', parent: 'tomatoes', text: 'buy stakes' },
        { ref: 'n2', parent: null, text: 'Compost' },
        { ref: 'n3', parent: 'n2', text: 'start a bin' },
        { ref: 'n4', parent: 'not-here', text: 'stays inside' },
      ] }, requests.at(-1).outline.map(e => e.id))
      const applied = await c.applyOrganizePlan(r, target, plan, { label: request.label, stamp: 'now', text: request.text }, 10)
      let next = c.writeNodeValue(applied.replica, path, c.ORGANIZED_VALUE, { rows: applied.rows.length, under: [], captureId: applied.captureId, title: plan.title }, 10)
      next = c.addSupply(next, target, path.at(-1), { capability: 'organize', by: 'fos', ref: applied.captureId }, 10)
      app.set({ replica: next })
      return json(200, { evaluation: { status: 'committed' } })
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }

  app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  let me = c.ensureHomeContext(c.createReplica('user:me'), 1)
  me = { ...me, meta: { ...me.meta, peerId: 'user:me', serverPeerId: 'user:me' } }
  me = c.addRow(me, [HOME], 'plain', 'Garden', 2, { id: 'garden' })
  me = c.addRow(me, [HOME, 'garden'], 'plain', 'Tomatoes', 3, { id: 'tomatoes' })
  me = c.addRow(me, [HOME], 'plain', 'Work', 4, { id: 'work' })
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
  assert(sent.at.at(-1).startsWith(c.ORGANIZE_REQUEST_PREFIX))
  assert.deepEqual(sent.request, { label: 'Pasted text', text: 'tomatoes need stakes; start a compost bin' })
  assert.deepEqual(sent.outline.map(e => e.id), ['tomatoes'], 'the outline is the target\'s subtree, without the request')
  assert(!c.view(app.state.replica, [HOME, 'garden']).tasks.some(t => t.id === sent.at.at(-1)), 'the filled request is removed')
  assert.deepEqual(rows([HOME, 'garden', 'tomatoes']), ['buy stakes'])
  const compost = c.view(app.state.replica, [HOME, 'garden']).tasks.find(t => t.title === 'Compost')
  assert(compost, 'a new group under the node')
  assert.deepEqual(rows([HOME, 'garden', compost.id]), ['start a bin'])
  assert(rows([HOME, 'garden']).includes('stays inside'), 'an unknown parent is the node itself')
  assert.deepEqual(rows([HOME, 'work']), [], 'nothing lands outside the node')
  assert(rows([HOME, 'garden']).some(t => t.startsWith('## Pasted text: Garden plans') && t.endsWith('tomatoes need stakes; start a compost bin')), 'the raw text is kept as a note')
  assert.equal(box.value, '', 'the box clears once filed')
  assert.equal(app.state.voice, null)
  assert.match(app.state.notice.text, /Pasted text organized: 4 rows added here/)

  // a voice note: transcribed (iOS MP4 accepted as is), then organized into the node it was recorded at
  requests.length = 0
  await app.submitVoice(new Blob([new Uint8Array(4000)], { type: 'audio/mp4' }), [HOME, 'garden'])
  assert.deepEqual(requests[0], { path: '/user/data/voice-notes', query: '?transcript=only', type: 'audio/mp4' })
  assert.deepEqual(requests[1].request, { label: 'Voice note', text: 'the tomatoes need stakes and we should start a compost bin' })
  assert(requests[1].outline.some(e => e.id === compost.id && e.title === 'Compost'), 'the outline includes rows organized earlier')
  assert(rows([HOME, 'garden']).some(t => t.startsWith('## Voice note: Garden plans') && t.includes('compost bin')), 'the transcript is kept as a note')
  assert.deepEqual(rows([HOME, 'garden', 'tomatoes']), ['buy stakes', 'buy stakes'])
  assert.equal(app.state.voice, null)

  // the model unreachable: the capture is still kept, unorganized, and the person is told
  failOrganize = true
  const count = rows([HOME, 'garden']).length
  assert.equal(await app.organizeText('remember the hose', [HOME, 'garden']), true)
  assert.equal(rows([HOME, 'garden']).length, count + 1)
  assert(rows([HOME, 'garden']).at(-1).endsWith('remember the hose'))
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
  const nodeText = document.querySelector('.node-text')
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
