/* Money requirements: the device shows the server's payment state and never records a payment itself. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-payments-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const { App, mountUi, createMemoryStorage, addRequirement, settlePayment, HOME_ID } = require(path.join(dir, 'test.cjs'))
const TASK_TYPE = 'task'
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const storage = createMemoryStorage()
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  const task = app.applyConstructor([HOME_ID], { type: TASK_TYPE, text: 'Write the guide', done: false })
  app.set({ replica: addRequirement(app.state.replica, task, 'reward', Date.now(), { capability: 'allocation', resource: 'account', amount: 20, unit: 'usd' }, 'pay') })
  app.set({ replica: addRequirement(app.state.replica, task, 'tip', Date.now(), { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' }, 'tip') })
  app.goTo(task); await tick()
  const row = id => document.querySelector(`.tree .task[data-id="${id}"]`)
  const texts = id => [...row(id).querySelectorAll('button')].map(b => b.textContent)
  assert(row('pay').textContent.includes('$ 20'), 'money shows its marker')
  assert(row('tip').textContent.includes('ff 5'), 'fos points show their own marker, not the money one')
  // nobody offers payments here (no server): the row says the server pays it, with no Pay button
  assert(!texts('pay').some(t => /^Pay/.test(t)), `no Pay button without a payment handler: ${texts('pay')}`)
  assert(row('pay').textContent.includes('account server pays this when the task runs'))

  // A provider confirmation reaches the device as a filled requirement, with no payment record.
  const payPath = [...task, 'pay']
  const payment = { amount: 20, unit: 'usd', payee: 'bob', intent: 'pi_1' }
  const settled = settlePayment(app.state.replica, payPath, payment, Date.now())
  assert(settled.settled); app.set({ replica: settled.replica }); await tick()
  const pay = app.currentView().tasks.find(t => t.id === 'pay')
  assert.equal(pay.requirement.satisfied, true)
  assert(row('pay').textContent.includes('Filled'))
  assert(!texts('pay').some(t => /^Pay/.test(t)))
  assert(!settlePayment(app.state.replica, payPath, payment, Date.now()).settled, 'settling twice is a no-op')
  console.log('PASS: payment requirements stay open until provider confirmation and cannot settle twice')
}
main().catch(error => { console.error(error); process.exit(1) })
