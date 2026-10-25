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
  let failOrganize = false
  globalThis.fetch = async (url, init) => {
    const u = new URL(url)
    requests.push({ path: u.pathname, query: u.search, type: init.headers['Content-Type'] })
    return { ok: true, status: 200, json: async () => ({ transcript: 'the tomatoes need stakes and we should start a compost bin' }) }
  }
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  app.set({ replica: c.ensureHomeContext(app.state.replica, 1, { server: ['organize'] }), session: { kind: 'user', username: 'me', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  app.recordServerOffers([...c.SERVER_TRANSPORT_CAPABILITIES, 'organize'])
  const garden = app.applyConstructor([HOME], { type: PLAIN_TYPE, text: 'Garden', done: false })
  app.goTo(garden)
  c.mountUi(document.getElementById('app'), app)
  app.runOnServer = async at => {
    const request = c.organizeRequestAt(app.state.replica, at)
    requests.push({ request, at })
    if (failOrganize) throw new Error('model down')
    let r = app.state.replica
    const result = await c.evaluateNode(at, {
      get: () => r, save: next => { r = next }, now: () => 20, check: () => [],
      executors: () => [{ native: async (operands, ctx) => {
        const type = c.rowTypeAt(ctx.store, PLAIN_TYPE, at)
        const child = ctx.put({ data: { alias: { id: 'bin' }, description: { content: 'Buy a bin' } }, children: [] })
        const group = ctx.put({ data: { alias: { id: 'compost' }, description: { content: 'Compost' } }, children: [[type, child]] })
        return { outputs: { self: c.valueOfPattern(ctx.store, operands.outputs.self.pattern, { description: { content: 'Garden plans' }, peerId: { content: 'fos' } }, [[type, group]]) } }
      } }]
    })
    assert.equal(result.status, 'committed', result.error)
    app.set({ replica: r })
  }
  const rows = at => c.view(app.state.replica, at).tasks
  assert(await app.organizeText('start composting', garden))
  const request = rows(garden).find(row => row.requirement?.capability === 'organize')
  assert(request.requirement.satisfied)
  const requestPath = [...garden, request.id]
  assert.equal(c.requirementAnswer(app.state.replica, requestPath), 'Garden plans')
  assert.equal(c.organizedRowCount(app.state.replica, requestPath), 2)
  assert(rows([...requestPath, 'compost']).some(row => row.title === 'Buy a bin'))
  assert.match(app.state.notice.text, /organized: 2 rows/)
  assert.equal(c.organizeRequestAt(app.state.replica, requestPath).text, 'start composting', 'source text is preserved')
  requests.length = 0
  await app.submitVoice(new Blob([new Uint8Array(4000)], { type: 'audio/mp4' }), garden)
  assert.deepEqual(requests[0], { path: '/user/data/voice-notes', query: '?transcript=only', type: 'audio/mp4' })
  assert.equal(requests[1].request.label, 'Voice note')
  assert.equal(app.state.voice, null)
  failOrganize = true
  const before = rows(garden).length
  assert(await app.organizeText('remember the hose', garden))
  assert.equal(rows(garden).length, before + 1)
  const kept = rows(garden).at(-1)
  assert(c.view(app.state.replica, [...garden, kept.id]).tasks.some(row => row.title.includes('remember the hose')))
  assert(!rows(garden).some(row => row.requirement?.capability === 'organize' && !row.requirement.satisfied))
  assert.match(app.state.notice.text, /unorganized: model down/)
  failOrganize = false

  // a long prose paste goes to the capture box instead of a row per line; short and structured pastes keep their rows
  const paste = (target, text) => {
    const event = new window.Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } })
    target.dispatchEvent(event)
    return event
  }
  const nodeText = document.querySelector('.current-node-row textarea')
  const prose = ('We walked the beds this morning and the soil is dry. ' .repeat(25) + '\n').repeat(2)
  assert(paste(nodeText, prose).defaultPrevented)
  assert.equal(document.querySelector('.node-input .capture-text').value, prose)
  assert.equal(app.state.notice.kind, 'info')
  const childCount = rows(garden).length
  paste(nodeText, 'short one\nshort two')
  assert.equal(rows(garden).length, childCount + 2, 'short pastes still become rows')

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
