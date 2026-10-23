const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-primitives-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
dom.window.HTMLCanvasElement.prototype.getContext = () => null
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export {parseRowInput} from './src/rows'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 10))

async function main() {
  // a constructor's ref by its declared name (its alias is the library's own)
  const refAlias = (row, name) => c.openRefs(app.state.replica.store, c.rowConstructor(app.state.replica, row)).find(ref => ref.name === name).alias
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}
  c.mountUi(document.getElementById('app'), app); await tick()
  const parse = text => c.parseRowInput(text, c.capabilityDeclarations(app.state.replica.store, app.state.view))
  const me = app.state.replica.meta.peerId
  const offers = app.handlerOffers([]).filter(offer => offer.peerId === me)
  assert(offers.some(offer => offer.capability === 'fetch') && offers.some(offer => offer.capability === 'solve'), 'this device offers fetch and solve')
  const parsed = parse('-fetch POST https://example.com/hook ping')
  assert.deepEqual(parsed.construct, { capability: 'fetch', values: { url: 'https://example.com/hook', method: 'POST' } })
  assert.equal(parsed.extras, undefined, 'nothing about the request is row data')

  // fetch: the row is [fetch, right]; the response is submitted to the right's response ref, not written into it
  const home = [c.HOME_ID]
  const requests = []
  globalThis.fetch = async (url, init) => { requests.push([url, init.method]); return { status: 200, text: async () => 'hello from the network' } }
  const fetchRow = app.applyConstructor(home, parse('-fetch https://example.com/data greeting'))
  app.set({ view: home }); await tick()
  const s = app.state.replica.store, fetchNode = c.libAt(s, home).capabilities.fetch
  const rowEdge = c.findEdge(s, c.valueContent(s, c.resolveScope(s, c.headCid(app.state.replica), home)), `a:${fetchRow.at(-1)}`)
  assert.equal(rowEdge[0], fetchNode, 'the left is the library fetch node itself')
  // the fetch node's rows: what it sends and receives is structural, parameter rows on each ref's left
  const refs = c.openRefs(s, fetchNode), [primitive, negative, string] = ['primitive', 'negative', 'string'].map(name => c.libAt(s).field(name))
  assert.deepEqual(refs.map(ref => [ref.name, ref.sent, ref.received]), [['url', true, false], ['method', true, false], ['response', false, true]])
  assert.deepEqual(c.content(s, refs[0].left).children, [[primitive, string], [negative, c.put(s, { data: {}, children: [] })]])
  assert.equal(c.textOf(app.state.replica, refs[1].defaultValue), 'GET', 'method is an open ref with a default')
  assert(c.matchesGraph(s, refs[0].left, c.put(s, { data: { description: { content: 'https://x' } }, children: [] })), 'a string fits')
  assert(!c.matchesGraph(s, refs[0].left, c.put(s, { data: { scalar: { type: 'number', value: 3 } }, children: [] })), 'a number does not')
  // the right only assigns: the url, by the same ref; the method falls back to the left's default
  assert.equal(c.textOf(app.state.replica, c.assignedValue(app.state.replica, fetchRow, refAlias(fetchRow, 'url'))), 'https://example.com/data')
  assert.equal(c.textOf(app.state.replica, c.assignedValue(app.state.replica, fetchRow, refAlias(fetchRow, 'method'))), 'GET')
  const row = () => app.currentView().tasks.find(t => t.id === fetchRow.at(-1))
  assert.equal(row().requirement, undefined, 'not a requirement row')
  assert.equal(document.querySelector(`.task[data-id="${fetchRow.at(-1)}"] input[aria-label="url"]`).value, 'https://example.com/data', 'the left decides the inputs, the right fills them')
  assert.equal(app.deviceHandlerFor(fetchRow, row()), 'Fetch')
  assert.equal(app.executionInstructions(fetchRow).canRun, true, 'the compiler permits a received output to remain open')
  ;[...document.querySelectorAll(`.task[data-id="${fetchRow.at(-1)}"] button`)].find(b => b.textContent === 'Complete').click()
  await tick(); await tick()
  assert.deepEqual(requests, [['https://example.com/data', 'GET']])
  const response = c.resolveScope(app.state.replica.store, c.headCid(app.state.replica), [...fetchRow, refAlias(fetchRow, 'response')])
  assert(response, 'the right has the response ref')
  const submitted = c.readProposals(app.state.replica.store, c.content(app.state.replica.store, response)).filter(p => p.status === 'open')
  assert.equal(submitted.length, 1)
  assert.equal(c.content(app.state.replica.store, submitted[0].contentCid).data.description.content, 'hello from the network')
  assert.equal(c.refValueCid(app.state.replica.store, c.content(app.state.replica.store, response)), null, 'nothing is bound until it is chosen')
  const responsePick = document.querySelector(`.task[data-id="${fetchRow.at(-1)}"] select[aria-label="Choose response"]`)
  responsePick.value = submitted[0].cid; responsePick.dispatchEvent(new window.Event("change")); await tick()
  assert.equal(c.textOf(app.state.replica, c.assignedValue(app.state.replica, fetchRow, refAlias(fetchRow, 'response'))), 'hello from the network')

  // solve: every person under Trip with a city row is a solution; the placeholder lists them as options
  let r = c.addTask(app.state.replica, home, 'Trip', 1, 'trip')
  const trip = [...home, 'trip']
  for (const [id, city] of [['alice', 'Paris'], ['bob', 'Rome']]) { r = c.addTask(r, trip, id, 1, id); r = c.addRow(r, [...trip, id], c.PLAIN_TYPE, city, 2, { id: `${id}-city` }) }
  app.set({ replica: r, view: trip }); await tick()
  const solveRow = app.applyConstructor(trip, parse('-solve where can we go'))
  r = c.addRefAt(app.state.replica, solveRow, 'city', app.state.replica.store.primitive.documentField.getId(), 3, null, 'city')
  app.set({ replica: r }); await tick()
  assert.equal(c.findEdge(app.state.replica.store, c.valueContent(app.state.replica.store, c.resolveScope(app.state.replica.store, c.headCid(app.state.replica), trip)), `a:${solveRow.at(-1)}`)[0], c.libAt(app.state.replica.store, trip).capabilities.solve)
  await app.evaluateAt(solveRow); await tick()
  const city = c.content(app.state.replica.store, c.resolveScope(app.state.replica.store, c.headCid(app.state.replica), [...solveRow, 'city']))
  const options = c.readProposals(app.state.replica.store, city).filter(p => p.status === 'open').map(p => c.valueContent(app.state.replica.store, p.contentCid).data.description?.content).sort()
  // nearest first: Trip's people, then rows further out (the scope includes ancestors)
  assert.deepEqual(options.filter(o => ['Paris', 'Rome'].includes(o)), ['Paris', 'Rome'])

  // a template used as a pattern: the row's values are submitted to the template's refs, and its view lists them
  r = c.addRow(app.state.replica, home, c.TEMPLATE_TYPE, 'Destination', 4, { id: 'destination' })
  r = c.addRefAt(r, [...home, 'destination'], 'where', r.store.primitive.documentField.getId(), 5, null, 'where')
  app.set({ replica: r, view: trip, templatePicker: { path: [...trip, 'alice'] } })
  app.usePattern('destination'); await tick()
  app.set({ view: [...trip, 'alice'] }); await tick()
  const [binding] = app.patternBindingsAt()
  assert.equal(binding.name, 'where')
  assert.deepEqual(binding.options.map(option => app.valueLabel(option.value)), ['Paris'])
  const pick = document.querySelector('select[aria-label="Bind where"]')
  assert(pick, 'the node shows the pattern ref with its submitted values')
  pick.value = binding.options[0].proposal; pick.dispatchEvent(new window.Event('change')); await tick()
  assert.equal(app.valueLabel(app.patternBindingsAt()[0].value), 'Paris')
  console.log('PASS: fetch and solve as device primitives, responses and solutions as submissions, templates used as patterns')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
