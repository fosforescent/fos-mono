const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-template-ui-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export {parseRowInput} from './src/rows'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'app.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const { App, mountUi, createMemoryStorage, parseRowInput, view, HOME_ID, resolveScope, headCid, requirementOutputs, argumentRefs } = require(path.join(dir, 'app.cjs'))
const PLAIN_TYPE = 'lib:type:plain'
const TEMPLATE_TYPE = 'lib:type:template'
const tick = () => new Promise(resolve => setImmediate(resolve))
async function main() {
  const a = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() })
  a.scheduleSync = () => {}; mountUi(document.getElementById('app'), a)
  const id = a.addRowAtTop(parseRowInput('Rental booking'))
  const child = a.addRowAt([id], PLAIN_TYPE, 'Details')
  a.select(null); await tick()
  let toggle = document.querySelector(`.task[data-id="${id}"] .toggle svg`)
  assert.equal(toggle.getAttribute('data-icon'), 'chevron-down')
  document.querySelector(`.task[data-id="${id}"] .toggle`).click()
  assert.equal(document.querySelector(`.task[data-id="${id}"] .toggle svg`).getAttribute('data-icon'), 'chevron-right')
  a.openContextMenu({ kind: 'task', at: [], task: a.rowAt([id]) })
  assert(![...document.querySelectorAll('.menu-group-label')].some(n => n.textContent === 'Change type'))
  ;[...document.querySelectorAll('.context-menu button')].find(b => b.textContent === 'Change template').click()
  assert.equal(a.state.modal, 'template')
  document.querySelector('.modal [aria-label="Note"]').click()
  assert.equal(a.rowAt([id]).text.mediaType, 'text/markdown'); assert(view(a.state.replica, [HOME_ID, id]).tasks.some(row => row.id === child))
  a.openTemplatePicker([HOME_ID, id])
  document.querySelector('[aria-label="New template name"]').value = 'Rental record'
  document.querySelector('[aria-label="New template icon"]').value = '👗'
  document.querySelector('#template-in-home').checked = true
  document.querySelector('.new-template-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  assert.equal(a.state.modal, null); assert.equal(a.currentRow().type, TEMPLATE_TYPE)
  const templatePath = [...a.state.view]
  assert.equal(templatePath[0], HOME_ID)
  assert.equal(view(a.state.replica, [HOME_ID]).tasks.find(r => r.id === id).template.id, templatePath.at(-1))
  assert.equal(a.templateIcon([HOME_ID, id]), '👗')
  const budget = a.addRowAtTop(parseRowInput('-$ 50 Budget')); a.select(null); await tick()
  document.querySelector(`.task[data-id="${budget}"] [aria-label="Destructure requirement"]`).dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }))
  assert(document.querySelector('.destructure-panel'))
  const split = (name, amount) => {
    document.querySelector('[aria-label="Output name"]').value = name
    document.querySelector('[aria-label="Split amount"]').value = String(amount)
    document.querySelector('.destructure-panel form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  }
  split('deposit', 10); split('balance', 40)
  assert.equal(document.querySelectorAll('.output-placeholder').length, 2)
  const before = headCid(a.state.replica); split('tooMuch', 1)
  assert.equal(headCid(a.state.replica), before)
  assert(a.state.notice.text.includes('cannot exceed'))
  const output = requirementOutputs(a.state.replica.store, resolveScope(a.state.replica.store, headCid(a.state.replica), [...templatePath, budget]))[0]
  const record = a.addRowAt([], PLAIN_TYPE, 'Receipt')
  const target = document.querySelector(`.task[data-id="${record}"]`)
  const drop = new window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: { types: ['application/x-fos-output'], getData: () => output.cid } })
  target.dispatchEvent(drop)
  const args = argumentRefs(a.state.replica.store, resolveScope(a.state.replica.store, headCid(a.state.replica), [...templatePath, record]))
  assert.equal(args[0].name, 'deposit')
  console.log('PASS: matching carets, Change template modal, linked Home template/icon, destructuring and placeholder drop')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')); dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
