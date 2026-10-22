/* The standard library: a mutable ref like any other. A library another account shares (a ref of the Library type it
   published to its members) opens as a live projection in Home, is pulled whole so its templates work offline, and
   is the library rows under Home use. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-library-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export {parseRowInput} from './src/rows'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
const MONEY_TYPE = 'lib:type:allocation:money'
const TASK_TYPE = 'lib:type:task'
const PLAIN_TYPE = 'lib:type:plain'
const NOTE_TYPE = 'lib:type:note'
const ALLOCATION_TYPE = 'lib:type:allocation'
const TEMPLATE_TYPE = 'lib:type:template'
const PATTERN_TYPE = 'lib:type:pattern'
const { parseRowInput } = c
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const HOME = c.HOME_ID, LIB = c.LIBRARY_ID
  // alice's team library: a ref of the Library type in her Home, holding a library, shared with me
  const TEAM = 'team-library'
  let lib = c.ensureHomeContext(c.createReplica('user:alice'), 1)
  lib = c.addRefAt(lib, [HOME], TEAM, c.rowTypeAt(lib.store, 'lib:type:library'), 1, c.valueCidOf(lib.store, c.resolveScope(lib.store, c.headCid(lib), [LIB])), 'Team library')
  lib = c.makeLinkAt(lib, [HOME, TEAM], 2)
  lib = c.addMemberAt(lib, [HOME, TEAM], 'user:me', 'me', ['read', 'edit'], 2)
  let now = 100, offline = false
  const calls = []
  globalThis.fetch = async (url, init) => {
    if (offline) throw new TypeError('fetch failed')
    const u = new URL(url), body = init?.body ? JSON.parse(init.body) : null
    calls.push(u.pathname)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/user/data/peer-sync/locate') return json(200, { owner: 'alice', aliasId: TEAM, path: [HOME, TEAM], title: 'Team library', grants: ['read', 'edit'] })
    if (u.pathname === '/user/data/peer-sync/provide-node') {
      assert.equal(body.owner, 'alice'); assert.equal(body.peerId, 'user:me')
      const { owner, ...request } = body
      // the server answers as alice's account; `user:me` holds its grants as her library's member
      const served = c.exchangeNode(lib, request, { peerId: 'user:me', scope: request.scope, owner: false, proposeOnly: true, capabilities: c.SERVER_TRANSPORT_CAPABILITIES }, ++now)
      lib = served.replica
      return json(200, served.node)
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }

  // my device: signed in; my Home references alice's library (the row her invite placed)
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  let me = c.ensureHomeContext(c.createReplica('user:me'), 1)
  me = { ...me, meta: { ...me.meta, peerId: 'user:me', serverPeerId: 'user:me' } }
  me = c.addRow(me, [HOME], c.REF_TYPE, 'Team library', 2, { id: TEAM, refOwner: 'alice', refId: TEAM, refScope: [HOME, TEAM] })
  app.set({ replica: me, session: { kind: 'user', username: 'me', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  app.recordServerOffers(c.SERVER_TRANSPORT_CAPABILITIES) // what the account server advertises: it provides nodes
  app.goTo([HOME]); await tick()
  assert(!app.isLibrary([HOME, TEAM]), 'a reference is no library until its content is here')

  // opening pulls the projection as her library's member, and the whole tree follows: it is a library
  await app.openSharedNode([HOME, TEAM])
  // under Home, the team library's template (the device root's library has one of that name too)
  const teamMeet = () => { const t = c.findTemplateByName(app.state.replica, 'Meet up', [HOME]); return t && t.path[1] === TEAM ? t : null }
  for (let i = 0; i < 80 && !teamMeet(); i++) await tick()
  assert(app.isPeerNode([HOME, TEAM]), 'the reference became a live projection')
  assert.deepEqual(app.state.view, [HOME, TEAM])
  assert(app.isLibrary([HOME, TEAM]), 'its content is a library')
  assert.deepEqual(c.libraryPath(app.state.replica), [HOME, TEAM], 'under Home it is the library rows see')
  const trip = teamMeet()
  assert(trip, 'the library\'s templates are in the local replica')
  // the template's requirements, beside its pattern rows (what tasks made from it accept)
  const tripRows = () => (c.view(app.state.replica, trip.path.concat(trip.row.id))?.tasks ?? []).filter(t => !!t.requirement)
  for (let i = 0; i < 40 && tripRows().length < 2; i++) await tick()
  assert.equal(tripRows().length, 2, 'template children were pulled too: ' + JSON.stringify([trip.path, trip.row.id, app.isPeerNode([...trip.path, trip.row.id]), c.view(app.state.replica, [...trip.path, trip.row.id]).tasks.map(t => t.id), calls.length]))
  assert(calls.filter(p => p.endsWith('provide-node')).length > 3, `the tree was materialized node by node: ${calls.length} requests`)

  // offline: a task made from a library template gets the template's requirements, with no request to the server
  offline = true
  const before = calls.length
  app.goTo([HOME])
  const task = [HOME, app.addRowAt([], TASK_TYPE, 'Meeting', { templateName: 'Meet up' })]
  const requirements = c.view(app.state.replica, task).tasks.filter(t => !!t.requirement)
  assert.equal(requirements.length, 2, 'the template instantiated offline')
  assert.deepEqual(requirements.map(t => t.requirement.capability), tripRows().map(t => t.requirement.capability))
  assert.equal(calls.length, before, 'nothing was requested while offline')
  assert(app.libraryConstructors().some(item => item.id === 'lib:meet'), 'the menu reads the live library projection')

  // The library's manual fallbacks: a device that never synced has them from its build. Doing a thing by hand
  // records the supply (and a receipt for money or a place) as the person; no peer is involved.
  const fresh = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() }); fresh.scheduleSync = () => {}
  assert.deepEqual(c.libraryPath(fresh.state.replica), [c.LIBRARY_ID], 'a never-synced device ships the library in its root')
  assert(!c.view(fresh.state.replica, [HOME]).tasks.some(row => fresh.isLibrary([HOME, row.id])), 'Home references no library of its own')
  assert(c.manualHandlers(fresh.state.replica).length >= 12, 'the shipped copy carries the manual handlers')
  document.getElementById('app').replaceChildren()
  c.mountUi(document.getElementById('app'), fresh)
  const libraryTab = () => document.querySelector('.peer-tabs [aria-label="Standard library"]')
  const constructor = label => document.querySelector(`.constructor-palette [aria-label="${label}"]`)
  libraryTab().click()
  assert(!constructor('Plan a trip'), 'Plan a trip is not in the library')
  assert(constructor('Meet up') && constructor('Invoice'), 'the menu discovers bundled library templates offline')
  assert(!constructor('Manual handlers'), 'the fallback-handler group is not an executable workflow')
  const initialHead = c.headCid(fresh.state.replica)
  constructor('Meet up').click()
  const fromMenu = c.view(fresh.state.replica, [HOME]).tasks.find(row => row.template?.id === 'lib:meet')
  assert(fromMenu, 'click instantiates the selected library definition by identity')
  assert.equal(c.view(fresh.state.replica, [HOME, fromMenu.id]).tasks.filter(row => row.requirement).length, 2)
  fresh.undo()
  assert.equal(c.headCid(fresh.state.replica), initialHead, 'one undo removes the whole instantiation')

  const bundlePath = c.libraryPath(fresh.state.replica)
  let edited = c.renameTask(fresh.state.replica, bundlePath, 'lib:meet', 'Get together', Date.now())
  edited = c.addRow(edited, bundlePath, TEMPLATE_TYPE, 'Custom workflow', Date.now(), { id: 'lib:custom' })
  edited = c.addRow(edited, [...bundlePath, 'lib:custom'], ALLOCATION_TYPE, 'Check the result', Date.now(), { id: 'lib:custom:check', requirement: { capability: 'confirmation' } })
  edited = c.setTemplateIcon(edited, [...bundlePath, 'lib:custom'], 'confirm', Date.now())
  fresh.set({ replica: edited })
  assert(!constructor('Meet up') && constructor('Get together') && constructor('Custom workflow'), 'renames and additions appear without a UI catalog change')
  assert.equal(fresh.libraryConstructors().find(item => item.id === 'lib:custom').icon, 'confirm')
  // A local template with the same name must not shadow the library definition.
  fresh.applyConstructor([HOME], { type: TEMPLATE_TYPE, text: 'Custom workflow', done: false })
  fresh.select(null)
  const search = document.querySelector('.node-search input')
  search.value = 'Custom workflow'; search.dispatchEvent(new window.Event('input', { bubbles: true }))
  await tick()
  assert([...document.querySelectorAll('.node-search [role="option"]')].some(option => option.textContent.includes('Custom workflow')), 'library constructors participate in menu search')
  search.value = ''; search.dispatchEvent(new window.Event('input', { bubbles: true }))
  fresh.setConstructorEnabled(fresh.state.replica.meta.peerId, 'library:lib:custom', false)
  assert.equal(constructor('Custom workflow').getAttribute('aria-disabled'), 'true')
  const disabledHead = c.headCid(fresh.state.replica)
  constructor('Custom workflow').click()
  assert.equal(c.headCid(fresh.state.replica), disabledHead, 'disabled library constructors cannot be inserted')
  fresh.setConstructorEnabled(fresh.state.replica.meta.peerId, 'library:lib:custom', true)

  const destination = fresh.applyConstructor([HOME], { type: PLAIN_TYPE, text: 'Keep this title', done: false })
  const retained = fresh.applyConstructor(destination, { type: NOTE_TYPE, text: 'Keep this child', done: false })
  fresh.select(null)
  const drop = target => {
    const event = new window.Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['application/x-fos-constructor'], getData: type => type === 'application/x-fos-constructor' ? 'library:lib:custom' : '' } })
    target.dispatchEvent(event)
  }
  drop(document.querySelector(`.tree .task[data-id="${destination.at(-1)}"]`))
  let targetRow = c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === destination.at(-1))
  assert.equal(targetRow.checkable, true); assert.equal(targetRow.title, 'Keep this title'); assert.equal(targetRow.template.id, 'lib:custom')
  assert(c.view(fresh.state.replica, destination).tasks.some(row => row.id === retained.at(-1)), 'drop preserves existing children')
  assert(c.view(fresh.state.replica, destination).tasks.some(row => row.title === 'Check the result'), 'drop copies the library definition, even with a same-named local template')
  fresh.undo()
  assert.equal(c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === destination.at(-1)).type, PLAIN_TYPE)

  const needed = fresh.applyConstructor([HOME], { type: ALLOCATION_TYPE, text: 'A workflow', done: false, extras: { requirement: { capability: 'task' } } })
  fresh.select([needed.at(-1)])
  assert(document.querySelector('.constructor-chip[aria-label="Custom workflow"]'), 'task requirements suggest library constructors')
  drop(document.querySelector(`.tree .task[data-id="${needed.at(-1)}"]`))
  assert.equal(c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === needed.at(-1)).requirement?.capability, 'task', 'drop preserves the requirement')
  assert(c.view(fresh.state.replica, needed).tasks.some(row => row.template?.id === 'lib:custom'), 'drop inserts an execution inside the requirement')
  fresh.select(null)
  fresh.addPlaceholder('workflow', 'template:lib:custom', [HOME])
  const workflow = fresh.placeholders().find(arg => arg.name === 'workflow')
  fresh.insertLibraryConstructor('lib:custom', [HOME, workflow.id])
  const boundArgument = c.resolveScope(fresh.state.replica.store, c.headCid(fresh.state.replica), [HOME, workflow.id])
  const boundValue = c.refValueCid(fresh.state.replica.store, c.content(fresh.state.replica.store, boundArgument))
  assert(boundValue, 'a library execution binds an input typed by its definition')
  // The pattern belongs to the enclosing row, never to the argument node.
  assert.equal(c.content(fresh.state.replica.store, c.argumentRefs(fresh.state.replica.store, c.resolveScope(fresh.state.replica.store, c.headCid(fresh.state.replica), [HOME])).find(arg => arg.cid === boundArgument).type).data.alias.id, 'lib:custom')
  assert.equal(fresh.placeholders().find(arg => arg.id === workflow.id).status, 'missing', 'its confirmation remains unresolved until the workflow is completed')
  fresh.addPlaceholder('peer_only', 'peer', [HOME])
  const peerOnly = fresh.placeholders().find(arg => arg.name === 'peer_only')
  const incompatibleHead = c.headCid(fresh.state.replica)
  assert.throws(() => fresh.insertLibraryConstructor('lib:custom', [HOME, peerOnly.id]), /matching/, 'a workflow without a peer property cannot fill a peer pattern')
  assert.equal(c.headCid(fresh.state.replica), incompatibleHead)
  fresh.set({ replica: c.deleteTask(fresh.state.replica, bundlePath, 'lib:custom', Date.now()) })
  assert(!constructor('Custom workflow'), 'removed library constructors leave the menu')
  assert.throws(() => fresh.insertLibraryConstructor('lib:custom'), /unavailable/, 'a stale drag cannot instantiate a deleted definition')
  fresh.select(null)
  const errand = fresh.applyConstructor([HOME], { type: TASK_TYPE, text: 'Errand', done: false })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, ALLOCATION_TYPE, 'Tell the client', Date.now(), { id: 'mail', requirement: { capability: 'mail' } }) })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, MONEY_TYPE, 'fee', Date.now(), { id: 'fee', requirement: { capability: 'allocation', resource: 'account', amount: 20, unit: 'usd' } }) })
  const parsedPlace = parseRowInput('-at Eiffel Tower')
  assert.deepEqual(parsedPlace.extras.requirement, { capability: 'allocation', resource: 'location', place: 'Eiffel Tower' }, `"-at <place>" is a location requirement: ${JSON.stringify(parsedPlace)}`)
  assert.equal(parseRowInput('at Paris').extras.allocation.location.name, 'Paris', '"at <place>" is a location allocation')
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, ALLOCATION_TYPE, parsedPlace.text, Date.now(), { id: 'where', requirement: parsedPlace.extras.requirement }) })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, ALLOCATION_TYPE, 'Somewhere nearby', Date.now(), { id: 'near', requirement: { capability: 'allocation', resource: 'location' } }) })
  fresh.goTo(errand); await tick()
  const handlers = id => [...document.querySelectorAll(`.tree .task[data-id="${id}"] .manual-handler`)]
  assert.deepEqual(handlers('mail').map(b => b.textContent), ['Sent it myself'])
  assert.deepEqual(handlers('fee').map(b => b.textContent), ['Paid outside Fos'])
  assert.deepEqual(handlers('where').map(b => b.textContent), ['Enter the location'], 'a place offers manual entry; the device position only once the device reports one')
  handlers('mail')[0].click(); await tick()
  const req = id => fresh.currentView().tasks.find(t => t.id === id)
  assert.equal(req('mail').requirement.satisfied, true, 'a supply by the person fills a mail requirement')
  assert.deepEqual(c.view(fresh.state.replica, [...errand, 'mail']).tasks.filter(t => t.supply).map(t => [t.type, t.supply.by]), [[ALLOCATION_TYPE, fresh.actorName()]])
  handlers('fee')[0].click(); await tick()
  assert.equal(req('fee').requirement.satisfied, true, 'a receipt plus supply fills a money requirement')
  const receipt = c.view(fresh.state.replica, [...errand, 'fee']).tasks.find(t => (!!t.allocation && !t.requirement))
  assert.deepEqual([receipt.allocation.type, receipt.allocation.amount, receipt.allocation.unit, receipt.allocation.by, receipt.allocation.resource], ['account', 20, 'usd', fresh.actorName(), 'fee'])
  document.querySelector('.tree .task[data-id="where"] .manual-place').value = 'Eiffel Tower, Paris'
  handlers('where')[0].click(); await tick()
  assert.equal(req('where').requirement.satisfied, true, 'a named place fills a location requirement')
  assert.equal(c.view(fresh.state.replica, [...errand, 'where']).tasks.find(t => (!!t.allocation && !t.requirement)).allocation.location.name, 'Eiffel Tower, Paris')
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: ok => ok({ coords: { latitude: 48.85837, longitude: 2.294481 } }) }, configurable: true })
  fresh.refresh(); await tick()
  const device = handlers('near').find(b => b.dataset.handler === 'lib:device:location')
  assert(device, 'the device handler shows when the device reports its position')
  device.click(); await tick(); await tick()
  assert.equal(req('near').requirement.satisfied, true, 'the device position fills a location requirement')
  assert.deepEqual(c.view(fresh.state.replica, [...errand, 'near']).tasks.find(t => (!!t.allocation && !t.requirement)).allocation.location, { lat: 48.85837, lng: 2.29448 })
  console.log('PASS: live and bundled library discovery, menu/search, click/drop, typed inputs, undo, library edits, and manual fallbacks')
}
main().catch(error => { console.error(error); process.exit(1) })
