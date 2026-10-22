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
const { App, mountUi, createMemoryStorage, addRow, addSupply, writePaymentRecord, settlePaymentRecord, paymentRecord, HOME_ID } = require(path.join(dir, 'test.cjs'))
const MONEY_TYPE = 'money'
const TASK_TYPE = 'task'
const ALLOCATION_TYPE = 'allocation'
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const storage = createMemoryStorage()
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  const task = app.applyConstructor([HOME_ID], { type: TASK_TYPE, text: 'Write the guide', done: false })
  app.set({ replica: addRow(app.state.replica, task, MONEY_TYPE, 'reward', Date.now(), { id: 'pay', requirement: { capability: 'allocation', resource: 'account', amount: 20, unit: 'usd' } }) })
  app.set({ replica: addRow(app.state.replica, task, ALLOCATION_TYPE, 'tip', Date.now(), { id: 'tip', requirement: { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' } }) })
  app.goTo(task); await tick()
  const row = id => document.querySelector(`.tree .task[data-id="${id}"]`)
  const texts = id => [...row(id).querySelectorAll('button')].map(b => b.textContent)
  assert(row('pay').textContent.includes('$ 20'), 'money shows its marker')
  assert(row('tip').textContent.includes('ff 5'), 'fos points show their own marker, not the money one')
  // nobody offers payments here (no server): the row says the server pays it, with no Pay button
  assert(!texts('pay').some(t => /^Pay/.test(t)), `no Pay button without a payment handler: ${texts('pay')}`)
  assert(row('pay').textContent.includes('account server pays this when the task runs'))

  // the server opened a payment: the row links to the payment page and says who is awaited
  const payPath = [...task, 'pay']
  app.set({ replica: writePaymentRecord(app.state.replica, payPath, { id: 'cs_1', url: 'https://checkout.example/cs_1', status: 'pending', amount: 20, unit: 'usd', payer: 'owner', payee: 'bob', created: Date.now() }, Date.now()) })
  await tick()
  assert(texts('pay').includes('Pay 20 USD'), `pending payment offers the payment page: ${texts('pay')}`)
  assert(row('pay').textContent.includes('awaiting payment confirmation for @bob'))
  let opened = null
  window.open = url => { opened = url }
  ;[...row('pay').querySelectorAll('button')].find(b => b.textContent === 'Pay 20 USD').click()
  assert.equal(opened, 'https://checkout.example/cs_1', 'the payment page opens in a new tab')
  assert.equal(paymentRecord(app.state.replica, payPath).status, 'pending', 'opening the page records nothing')

  // the execution view shows the same control for the requirement itself
  await app.startExecution(payPath); await tick()
  assert([...document.querySelectorAll('.execution-root-input button')].some(b => b.textContent === 'Pay 20 USD'), 'execution view offers the payment page')
  app.exitExecution(); app.goTo(task); await tick()

  // the confirmation arrives (through sync): the requirement is filled by fos and the controls disappear
  const settled = settlePaymentRecord(app.state.replica, payPath, { intent: 'pi_1' }, Date.now())
  assert(settled.settled); app.set({ replica: settled.replica }); await tick()
  const pay = app.currentView().tasks.find(t => t.id === 'pay')
  assert.equal(pay.requirement.satisfied, true)
  assert(row('pay').textContent.includes('Filled'))
  assert(!texts('pay').some(t => /^Pay/.test(t)))
  assert.equal(paymentRecord(app.state.replica, payPath).status, 'paid')
  assert(!settlePaymentRecord(app.state.replica, payPath, {}, Date.now()).settled, 'settling twice is a no-op')

  // a failed payment explains itself and, without a handler, offers no retry button
  const other = app.applyConstructor([HOME_ID], { type: TASK_TYPE, text: 'Another', done: false })
  app.set({ replica: addRow(app.state.replica, other, MONEY_TYPE, 'fee', Date.now(), { id: 'fee', requirement: { capability: 'allocation', resource: 'account', amount: 3, unit: 'eur' } }) })
  app.set({ replica: writePaymentRecord(app.state.replica, [...other, 'fee'], { id: 'cs_2', url: null, status: 'failed', amount: 3, unit: 'eur', payer: 'owner', payee: 'bob', created: Date.now(), error: 'The payment page expired before it was paid.' }, Date.now()) })
  app.goTo(other); await tick()
  assert(row('fee').textContent.includes('expired before it was paid'))
  void addSupply
  console.log('PASS: money requirements show the server payment state, link to the payment page and fill when confirmed')
}
main().catch(error => { console.error(error); process.exit(1) })
