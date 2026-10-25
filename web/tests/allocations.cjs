/* A bank typed in the UI holds a checked grant; using part of it in the execution view is an evaluated allocate invocation. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-allocations-ui-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {parseRowInput} from './src/rows'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const { App, mountUi, parseRowInput, createMemoryStorage, view, ownerGrants, handleAt, executionInputs, evaluationRecord, typeErrorAt, HOME_ID } = require(path.join(dir, 'test.cjs'))
const tick = () => new Promise(resolve => setImmediate(resolve))
const settle = async () => { for (let i = 0; i < 20; i++) await tick() }

async function main() {
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  const task = app.addRowAtTop(parseRowInput('[ ] Pack boxes\n  @inventory Shelf 12'))
  for (let i = 0; i < 50 && (app.evaluating || !ownerGrants(app.state.replica, [HOME_ID, task, view(app.state.replica, [HOME_ID, task]).tasks.find(t => t.resource).id]).length); i++) await settle()
  const bank = view(app.state.replica, [HOME_ID, task]).tasks.find(t => t.resource)
  assert(bank, 'the bank row was created under the task')
  const grants = ownerGrants(app.state.replica, [HOME_ID, task, bank.id])
  assert.deepEqual(grants.map(g => g.allocation.amount), [12], 'the amount typed on a new bank is issued as one grant checked by the device\'s allocate handler')
  assert.equal(typeErrorAt(app.state.replica, [HOME_ID, task, bank.id]), null, 'the grant row is accepted under the bank')
  const inputs = executionInputs(app.state.replica, [HOME_ID, task])
  assert.deepEqual(inputs.filter(f => f.direction === 'consume').map(f => [f.amount, f.unit]), [[12, 'unit']], 'the grant is offered for use')

  app.goTo([HOME_ID, task])
  await app.startExecution([HOME_ID, task])
  await settle()
  const field = [...document.querySelectorAll('input[type="number"]')].find(input => input.getAttribute('aria-label')?.startsWith('Use'))
  assert(field, 'the grant row offers an amount to use')
  field.value = '5'
  ;[...document.querySelectorAll('button')].find(b => b.textContent === 'Use allocation' && b.previousSibling === field).click()
  for (let i = 0; i < 50 && app.evaluating; i++) await settle()
  await settle()
  const after = ownerGrants(app.state.replica, [HOME_ID, task, bank.id]).map(g => g.allocation.amount).sort((a, b) => a - b)
  assert.deepEqual(after, [5, 7], 'using five of twelve leaves the five used and the explicit seven remaining as grants')
  const invocation = view(app.state.replica, [HOME_ID, task]).tasks.find(t => t.id !== bank.id && t.typeName !== 'Evaluation' && view(app.state.replica, [HOME_ID, task, t.id])?.tasks.length)
  assert(invocation, 'the use is an invocation row under the execution root')
  assert.equal(evaluationRecord(app.state.replica, [HOME_ID, task, invocation.id]).status, 'committed')
  // a bank's own grant leaves the used amount and the remainder with the bank: the invocation holds no handle any more
  assert.deepEqual(view(app.state.replica, [HOME_ID, task, invocation.id]).tasks.map(t => handleAt(app.state.replica, [HOME_ID, task, invocation.id, t.id])).filter(Boolean), [])
  assert(!ownerGrants(app.state.replica, [HOME_ID, task, bank.id]).some(g => g.cid === grants[0].cid), 'the original grant is consumed')
  assert.equal(view(app.state.replica, [HOME_ID, task]).tasks.find(t => t.resource).resource.held, 12, 'the bank still holds twelve across its two grants')
  // issuing and retiring are grant rows; the bank shows their net
  app.changeBankHolding([bank.id], 3); app.changeBankHolding([bank.id], -5) // paths are relative to the view, which is the execution root here
  for (let i = 0; i < 100 && ownerGrants(app.state.replica, [HOME_ID, task, bank.id]).length < 4; i++) await settle()
  const grantsNow = ownerGrants(app.state.replica, [HOME_ID, task, bank.id])
  assert.deepEqual(grantsNow.map(g => g.allocation.amount).sort((a, b) => a - b), [-5, 3, 5, 7])
  assert.equal(view(app.state.replica, [HOME_ID, task]).tasks.find(t => t.resource).resource.held, 10)
  // (grants issued by the allocate native carry no issuer peer; see shared/sync/arguments.ts grantValue)

  // using more than a handle holds is refused before anything is authored
  const before = JSON.stringify(view(app.state.replica, [HOME_ID, task]).tasks.map(t => t.id))
  const used = grantsNow.find(g => g.allocation.amount === 5)
  app.consumeExecutionAllocation({ owner: [HOME_ID, task, bank.id], grant: used.cid }, 9)
  await settle()
  assert.equal(JSON.stringify(view(app.state.replica, [HOME_ID, task]).tasks.map(t => t.id)), before)
  assert.match(app.state.notice?.text ?? '', /between 0 and 5/)

  console.log('allocations ui ok')
}
main().catch(error => { console.error(error); process.exit(1) })
