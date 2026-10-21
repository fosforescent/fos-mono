const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const TASK_TYPE = 'lib:type:task'
const TEMPLATE_TYPE = 'lib:type:template'
const dir = mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'fos-handlers-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
try {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
  const { App, mountUi, createMemoryStorage, view, SERVER_TRANSPORT_CAPABILITIES } = require(path.join(dir, 'test.cjs'))
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  const parent = [...app.state.view]
  const template = app.applyConstructor(parent, { type: TEMPLATE_TYPE, text: 'Feature workflow', done: false })
  app.applyConstructor(template, { type: TASK_TYPE, text: 'Acceptance check', done: false })
  app.goTo(template)
  const publish = [...document.querySelectorAll('button')].find(b => b.textContent === 'Publish capability here')
  assert(publish); publish.click()
  app.goTo(parent)
  const offer = app.handlerOffers().find(o => o.label === 'Feature workflow')
  assert(offer?.enabled && offer.active)
  const pick = [...document.querySelectorAll('.constructor-palette button')].find(b => b.getAttribute('aria-label') === 'Feature workflow')
  assert(pick, 'publication appears through the normal constructor catalogue'); pick.click()
  const instance = view(app.state.replica, parent).tasks.find(t => t.checkable && t.title === 'Feature workflow')
  assert(instance)
  assert(view(app.state.replica, [...parent, instance.id]).tasks.some(t => t.title === 'Acceptance check'))
  app.toggleHandler(offer.peerId, offer.id, false)
  const disabled = [...document.querySelectorAll('.constructor-palette button')].find(b => b.getAttribute('aria-label') === 'Feature workflow')
  assert.equal(disabled.getAttribute('aria-disabled'), 'true')
  assert(disabled.draggable, 'disabled templates remain draggable for re-enabling')
  const count = view(app.state.replica, parent).tasks.length; disabled.click()
  assert.equal(view(app.state.replica, parent).tasks.length, count)
  app.toggleHandler(offer.peerId, offer.id, true)
  assert(app.handlerOffers().find(o => o.id === offer.id).enabled)
  // Server services are advertised only when the account server reports a handler for them: a fresh device knows the
  // transport facts, nothing else, so the palette has no "Ask fos" and no cron trigger until the server says so.
  // the palette renders the selected peer tab only: 'Ask fos' lives under the Fos server tab, cron under its Triggers sub-tab
  const palette = (tab) => { document.querySelector(`.peer-tabs [aria-label="${tab}"]`).click(); return [...document.querySelectorAll('.constructor-palette button')].map(b => b.getAttribute('aria-label')) }
  const serverTriggers = () => { palette('Fos server'); document.querySelector('.constructor-grid [aria-label="Triggers"]').click(); return [...document.querySelectorAll('.constructor-palette button')].map(b => b.getAttribute('aria-label')) }
  const fosOffers = () => app.handlerOffers().filter(o => o.peerId === 'fos').map(o => o.capability).sort()
  assert.deepEqual(fosOffers(), [...SERVER_TRANSPORT_CAPABILITIES].sort(), 'a new device records only transport facts for fos')
  for (const cap of ['llm', 'search', 'market', 'send-payment', 'mail']) assert(!app.handlerOffers().some(o => o.peerId === 'fos' && o.capability === cap), `${cap} is not offered without a handler`)
  assert(!palette('Fos server').includes('Ask fos') && !serverTriggers().includes('Cron trigger'))
  app.recordServerOffers([...SERVER_TRANSPORT_CAPABILITIES, 'llm', 'search', 'cron'])
  assert(app.handlerOffers().some(o => o.peerId === 'fos' && o.capability === 'llm'), 'reported offers are recorded on the fos member')
  assert(!app.handlerOffers().some(o => o.peerId === 'fos' && o.capability === 'market'), 'unreported services stay absent')
  assert(palette('Fos server').includes('Ask fos') && serverTriggers().includes('Cron trigger'), 'the palette follows the advertised offers')
  app.recordServerOffers([...SERVER_TRANSPORT_CAPABILITIES, 'search'])
  assert(!app.handlerOffers().some(o => o.peerId === 'fos' && o.capability === 'llm'), 'a narrower report withdraws the offer')
  console.log('PASS: template publication, shared constructor discovery, instantiation, peer toggles, and server offers derived from the host registry')
} finally { rmSync(dir, { recursive: true, force: true }); dom.window.close() }
