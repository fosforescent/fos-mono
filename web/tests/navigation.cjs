/* Navigation: resuming at the Home row last viewed, browser history entries, and when execution offers Complete. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-navigation-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const { App, mountUi, createMemoryStorage, addRow, readNodeValue, HOME_ID } = require(path.join(dir, 'test.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const storage = createMemoryStorage()
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  assert.deepEqual(app.state.view, [HOME_ID], 'a fresh device starts at Home')
  const key = `fos:setting:${app.state.replica.meta.peerId}:view`

  // The Home descendant being viewed is remembered as a row in Home, and only Home descendants are.
  const plan = app.applyConstructor([HOME_ID], { kind: 'task', text: 'Plan the trip', done: false })
  const entries = window.history.length
  app.goTo(plan)
  assert.deepEqual(readNodeValue(app.state.replica, [HOME_ID], key), plan.slice(1), 'the viewed path is stored relative to Home')
  app.goToRoot()
  assert.deepEqual(readNodeValue(app.state.replica, [HOME_ID], key), plan.slice(1), 'Settings does not replace the remembered Home view')
  assert(document.querySelector('.crumb-path .crumb.current.crumb-settings svg'), 'Settings crumb is the gear')
  assert.equal(document.querySelector('.crumb-path .sep').textContent, '‹')
  document.querySelector('.crumb-path .crumb-home[aria-label="Home"]').click()
  assert.deepEqual(app.state.view, [HOME_ID])
  const row = document.querySelector('.setting-control[data-setting="view"]')
  assert(row, 'Home shows its last-viewed row')
  assert(row.textContent.includes('Plan the trip'))
  row.querySelector('button').click()
  assert.deepEqual(app.state.view, plan, 'the row links back to the remembered node')

  // Another session on the same device resumes there; a removed node falls back to Home.
  const resumed = new App({ baseUrl: 'http://localhost', autoLogin: null, storage }); resumed.scheduleSync = () => {}
  assert.deepEqual(resumed.state.view, plan, 'a new visit resumes at the remembered Home descendant')
  storage.savePrefs({ ...(storage.loadPrefs() ?? {}), view: ['stale'] })
  const stale = new App({ baseUrl: 'http://localhost', autoLogin: null, storage })
  assert.deepEqual(stale.state.view, plan, 'local preferences no longer decide the starting view')

  // Browser history mirrors navigation: back returns to the previous node, forward to the next.
  assert(window.history.length > entries, 'navigating adds history entries')
  window.history.back(); await tick(); await tick()
  assert.deepEqual(app.state.view, [HOME_ID], 'back returns to Home')
  window.history.forward(); await tick(); await tick()
  assert.deepEqual(app.state.view, plan, 'forward returns to the node')
  app.goToRoot(); window.history.back(); await tick(); await tick()
  assert.equal(app.state.atRoot, false); assert.deepEqual(app.state.view, plan, 'back leaves Settings')

  // Execution: content such as a note is just shown; work with requirements or allocations can be completed.
  const note = app.applyConstructor([HOME_ID], { kind: 'note', text: 'Packing list\n\n- socks' })
  await app.startExecution(note); await tick()
  const buttons = () => [...document.querySelectorAll('.execution-rows button')].map(b => b.textContent)
  assert(!buttons().includes('Complete') && !buttons().includes('Continue execution'), `a note offers no completion: ${buttons()}`)
  app.exitExecution()
  app.set({ replica: addRow(app.state.replica, [HOME_ID], 'requirement', 'Choose a date', Date.now(), { id: 'choose-date', requirement: { capability: 'choice', options: ['May', 'June'] } }) })
  await app.startExecution([HOME_ID, 'choose-date'])
  assert(buttons().includes('Complete'), `a requirement can be completed: ${buttons()}`)
  app.exitExecution()
  const bank = app.applyConstructor([HOME_ID], { kind: 'task', text: 'Budget', done: false })
  app.set({ replica: addRow(app.state.replica, bank, 'allocation', 'Cash', Date.now(), { id: 'cash', allocation: { type: 'money', unit: 'usd', amount: 10 } }) })
  const holder = app.applyConstructor([HOME_ID], { kind: 'note', text: 'Funds' })
  app.set({ replica: addRow(app.state.replica, holder, 'allocation', 'Petty cash', Date.now(), { id: 'petty', allocation: { type: 'money', unit: 'usd', amount: 5 } }) })
  await app.startExecution(holder)
  assert(buttons().includes('Complete'), `a note holding allocations can be completed: ${buttons()}`)
  app.exitExecution()
  console.log('PASS: Home remembers the last viewed row, history navigates, execution offers Complete only for work')
}
main().catch(error => { console.error(error); process.exit(1) })
