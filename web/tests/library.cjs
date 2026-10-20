/* The standard library: a node another account (the server's library account) shares with every user; it opens as a
   live projection in Home, is pulled whole so its templates work offline, and offers the vote on proposed changes. */
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
const { parseRowInput } = c
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

async function main() {
  const HOME = c.HOME_ID, LIB = c.LIBRARY_ID, share = 'library-share-0123456789'
  // the library account on the server: the node, shared with every user, seeded
  let lib = c.ensureHomeContext(c.createReplica('user:fos-library'), 1)
  lib = c.addRow(lib, [HOME], 'plain', 'Standard library', 1, { id: LIB })
  lib = c.setSharing(lib, [HOME, LIB], { id: share, audience: 'users', enabled: true }, 2)
  lib = c.setMemberCapabilitiesAt(lib, [HOME, LIB], 'audience:users', ['read', 'edit', 'rank'], [], 2)
  lib = c.seedStandardLibrary(lib, [HOME, LIB], 3)
  const address = { owner: 'fos-library', path: [HOME, LIB], share, title: 'Standard library' }
  let now = 100, offline = false
  const calls = []
  globalThis.fetch = async (url, init) => {
    if (offline) throw new TypeError('fetch failed')
    const u = new URL(url), body = init?.body ? JSON.parse(init.body) : null
    calls.push(u.pathname)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/user/data/peer-sync/locate') return json(200, { owner: 'fos-library', aliasId: LIB, path: [HOME, LIB], title: 'Standard library', grants: ['read', 'edit', 'approve', 'rank'] })
    if (u.pathname === '/user/data/peer-sync/provide-node') {
      assert.equal(body.owner, 'fos-library'); assert.equal(body.peerId, 'user:me')
      const { owner, ...request } = body
      // the server answers as the library account; `user:me` holds its grants only through the users audience
      const served = c.exchangeNode(lib, request, { peerId: 'user:me', scope: request.scope, owner: false, proposeOnly: true, capabilities: c.SERVER_TRANSPORT_CAPABILITIES }, ++now)
      lib = served.replica
      return json(200, served.node)
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }

  // my device: signed in; the person explicitly links the shared library into Home
  const app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  c.mountUi(document.getElementById('app'), app)
  let me = c.ensureHomeContext(c.createReplica('user:me'), 1)
  me = { ...me, meta: { ...me.meta, peerId: 'user:me', serverPeerId: 'user:me' } }
  me = c.ensureLibraryLink(me, address, 2).replica
  app.set({ replica: me, session: { kind: 'user', username: 'me', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  app.recordServerOffers(c.SERVER_TRANSPORT_CAPABILITIES) // what the account server advertises: it provides nodes
  app.goTo([HOME]); await tick()
  const row = document.querySelector(`.tree .task[data-id="${LIB}"]`)
  assert(row, 'Home lists the standard library')
  assert(row.textContent.includes('📚') && row.textContent.includes('Standard library'))
  assert(row.querySelector('.library-updates'), 'the row offers the vote on updates')
  assert.deepEqual(c.libraryLink(app.state.replica), [HOME, LIB])

  // opening pulls the projection through the users audience (no explicit membership) and the whole tree follows
  row.querySelector('.ref-link').click()
  for (let i = 0; i < 40 && !c.findTemplateByName(app.state.replica, 'Plan a trip'); i++) await tick()
  assert(app.isPeerNode([HOME, LIB]), 'the reference became a live projection')
  assert.deepEqual(app.state.view, [HOME, LIB])
  const trip = c.findTemplateByName(app.state.replica, 'Plan a trip')
  assert(trip, 'the library\'s templates are in the local replica')
  // the template's requirements, beside its pattern rows (what tasks made from it accept)
  const tripRows = () => (c.view(app.state.replica, trip.path.concat(trip.row.id))?.tasks ?? []).filter(t => t.kind !== 'pattern')
  for (let i = 0; i < 40 && tripRows().length < 5; i++) await tick()
  assert.equal(tripRows().length, 5, 'template children were pulled too: ' + JSON.stringify([trip.path, trip.row.id, app.isPeerNode([...trip.path, trip.row.id]), c.view(app.state.replica, [...trip.path, trip.row.id]).tasks.map(t => t.id), calls.length]))
  assert(calls.filter(p => p.endsWith('provide-node')).length >= 7, `the tree was materialized node by node: ${calls.length} requests`)

  // offline: a task made from a library template gets the template's requirements, with no request to the server
  offline = true
  const before = calls.length
  app.goTo([HOME])
  const task = [HOME, app.addRowAt([], 'task', 'Trip', { templateName: 'Plan a trip' })]
  const requirements = c.view(app.state.replica, task).tasks.filter(t => t.kind === 'requirement')
  assert.equal(requirements.length, 5, 'the template instantiated offline')
  assert.deepEqual(requirements.map(t => t.requirement.capability), ['confirmation', 'allocation', 'allocation', 'task', 'task'])
  assert.equal(calls.length, before, 'nothing was requested while offline')
  assert(app.libraryConstructors().some(item => item.id === 'lib:trip'), 'the menu reads the live library projection')

  // The library's manual fallbacks: a device that never synced has them from its build. Doing a thing by hand
  // records the supply (and a receipt for money or a place) as the person; no peer is involved.
  const fresh = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() }); fresh.scheduleSync = () => {}
  assert.deepEqual(c.libraryPath(fresh.state.replica), [c.LIBRARY_ID], 'a never-synced device ships the library in its root')
  assert(!c.view(fresh.state.replica, [HOME]).tasks.some(row => row.id === LIB), 'Home has no library row unless explicitly linked')
  assert(c.manualHandlers(fresh.state.replica).length >= 12, 'the shipped copy carries the manual handlers')
  document.getElementById('app').replaceChildren()
  c.mountUi(document.getElementById('app'), fresh)
  const libraryTab = () => document.querySelector('.peer-tabs [aria-label="Standard library"]')
  const constructor = label => document.querySelector(`.constructor-palette [aria-label="${label}"]`)
  libraryTab().click()
  assert(constructor('Plan a trip') && constructor('Invoice'), 'the menu discovers bundled library templates offline')
  assert(!constructor('Manual handlers'), 'the fallback-handler group is not an executable workflow')
  const initialHead = c.headCid(fresh.state.replica)
  constructor('Plan a trip').click()
  const fromMenu = c.view(fresh.state.replica, [HOME]).tasks.find(row => row.template?.id === 'lib:trip')
  assert(fromMenu, 'click instantiates the selected library definition by identity')
  assert.equal(c.view(fresh.state.replica, [HOME, fromMenu.id]).tasks.length, 5)
  fresh.undo()
  assert.equal(c.headCid(fresh.state.replica), initialHead, 'one undo removes the whole instantiation')

  const bundlePath = c.libraryPath(fresh.state.replica)
  let edited = c.renameTask(fresh.state.replica, bundlePath, 'lib:trip', 'Travel plan', Date.now())
  edited = c.addRow(edited, bundlePath, 'template', 'Custom workflow', Date.now(), { id: 'lib:custom' })
  edited = c.addRow(edited, [...bundlePath, 'lib:custom'], 'requirement', 'Check the result', Date.now(), { id: 'lib:custom:check', requirement: { capability: 'confirmation' } })
  edited = c.writeNodeValue(edited, [...bundlePath, 'lib:custom'], 'fos:icon', 'confirm', Date.now())
  fresh.set({ replica: edited })
  assert(!constructor('Plan a trip') && constructor('Travel plan') && constructor('Custom workflow'), 'renames and additions appear without a UI catalog change')
  assert.equal(fresh.libraryConstructors().find(item => item.id === 'lib:custom').icon, 'confirm')
  // A local template with the same name must not shadow the library definition.
  fresh.applyConstructor([HOME], { kind: 'template', text: 'Custom workflow', done: false })
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

  const destination = fresh.applyConstructor([HOME], { kind: 'plain', text: 'Keep this title', done: false })
  const retained = fresh.applyConstructor(destination, { kind: 'note', text: 'Keep this child', done: false })
  fresh.select(null)
  const drop = target => {
    const event = new window.Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['application/x-fos-constructor'], getData: type => type === 'application/x-fos-constructor' ? 'library:lib:custom' : '' } })
    target.dispatchEvent(event)
  }
  drop(document.querySelector(`.tree .task[data-id="${destination.at(-1)}"]`))
  let targetRow = c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === destination.at(-1))
  assert.equal(targetRow.kind, 'task'); assert.equal(targetRow.title, 'Keep this title'); assert.equal(targetRow.template.id, 'lib:custom')
  assert(c.view(fresh.state.replica, destination).tasks.some(row => row.id === retained.at(-1)), 'drop preserves existing children')
  assert(c.view(fresh.state.replica, destination).tasks.some(row => row.title === 'Check the result'), 'drop copies the library definition, even with a same-named local template')
  fresh.undo()
  assert.equal(c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === destination.at(-1)).kind, 'plain')

  const needed = fresh.applyConstructor([HOME], { kind: 'requirement', text: 'A workflow', done: false, extras: { requirement: { capability: 'task' } } })
  fresh.select([needed.at(-1)])
  assert(document.querySelector('.constructor-chip[aria-label="Custom workflow"]'), 'task requirements suggest library constructors')
  drop(document.querySelector(`.tree .task[data-id="${needed.at(-1)}"]`))
  assert.equal(c.view(fresh.state.replica, [HOME]).tasks.find(row => row.id === needed.at(-1)).kind, 'requirement', 'drop preserves the requirement')
  assert(c.view(fresh.state.replica, needed).tasks.some(row => row.template?.id === 'lib:custom'), 'drop inserts an execution inside the requirement')
  fresh.select(null)
  fresh.addPlaceholder('workflow', 'template:lib:custom', [HOME])
  const workflow = fresh.placeholders().find(arg => arg.name === 'workflow')
  fresh.insertLibraryConstructor('lib:custom', [HOME, workflow.id])
  const boundArgument = c.resolveScope(fresh.state.replica.store, c.headCid(fresh.state.replica), [HOME, workflow.id])
  const boundValue = c.refValueCid(fresh.state.replica.store, c.content(fresh.state.replica.store, boundArgument))
  assert(boundValue, 'a library execution binds an input typed by its definition')
  // the argument's type is the template row: the bound value is an execution of it ([template, value] as a typed ref)
  assert.equal(c.content(fresh.state.replica.store, c.refTypeCid(fresh.state.replica.store, c.content(fresh.state.replica.store, boundArgument))).data.alias.id, 'lib:custom')
  assert.equal(fresh.placeholders().find(arg => arg.id === workflow.id).status, 'missing', 'its confirmation remains unresolved until the workflow is completed')
  fresh.addPlaceholder('text_only', 'text', [HOME])
  const textOnly = fresh.placeholders().find(arg => arg.name === 'text_only')
  const incompatibleHead = c.headCid(fresh.state.replica)
  assert.throws(() => fresh.insertLibraryConstructor('lib:custom', [HOME, textOnly.id]), /matching/, 'incompatible inputs reject the constructor')
  assert.equal(c.headCid(fresh.state.replica), incompatibleHead)
  fresh.set({ replica: c.deleteTask(fresh.state.replica, bundlePath, 'lib:custom', Date.now()) })
  assert(!constructor('Custom workflow'), 'removed library constructors leave the menu')
  assert.throws(() => fresh.insertLibraryConstructor('lib:custom'), /unavailable/, 'a stale drag cannot instantiate a deleted definition')
  fresh.select(null)
  const errand = fresh.applyConstructor([HOME], { kind: 'task', text: 'Errand', done: false })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, 'requirement', 'Tell the client', Date.now(), { id: 'mail', requirement: { capability: 'mail' } }) })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, 'requirement', 'fee', Date.now(), { id: 'fee', requirement: { capability: 'allocation', resource: 'account', amount: 20, unit: 'usd' } }) })
  const parsedPlace = parseRowInput('-at Eiffel Tower')
  assert.deepEqual(parsedPlace.extras.requirement, { capability: 'allocation', resource: 'location', place: 'Eiffel Tower' }, `"-at <place>" is a location requirement: ${JSON.stringify(parsedPlace)}`)
  assert.equal(parseRowInput('at Paris').extras.allocation.location.name, 'Paris', '"at <place>" is a location allocation')
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, 'requirement', parsedPlace.text, Date.now(), { id: 'where', requirement: parsedPlace.extras.requirement }) })
  fresh.set({ replica: c.addRow(fresh.state.replica, errand, 'requirement', 'Somewhere nearby', Date.now(), { id: 'near', requirement: { capability: 'allocation', resource: 'location' } }) })
  fresh.goTo(errand); await tick()
  const handlers = id => [...document.querySelectorAll(`.tree .task[data-id="${id}"] .manual-handler`)]
  assert.deepEqual(handlers('mail').map(b => b.textContent), ['Sent it myself'])
  assert.deepEqual(handlers('fee').map(b => b.textContent), ['Paid outside Fos'])
  assert.deepEqual(handlers('where').map(b => b.textContent), ['Enter the location'], 'a place offers manual entry; the device position only once the device reports one')
  handlers('mail')[0].click(); await tick()
  const req = id => fresh.currentView().tasks.find(t => t.id === id)
  assert.equal(req('mail').requirement.satisfied, true, 'a supply by the person fills a mail requirement')
  assert.deepEqual(c.view(fresh.state.replica, [...errand, 'mail']).tasks.map(t => [t.kind, t.supply.by]), [['supply', fresh.actorName()]])
  handlers('fee')[0].click(); await tick()
  assert.equal(req('fee').requirement.satisfied, true, 'a receipt plus supply fills a money requirement')
  const receipt = c.view(fresh.state.replica, [...errand, 'fee']).tasks.find(t => t.kind === 'allocation')
  assert.deepEqual([receipt.allocation.type, receipt.allocation.amount, receipt.allocation.unit, receipt.allocation.by, receipt.allocation.resource], ['account', 20, 'usd', fresh.actorName(), 'fee'])
  document.querySelector('.tree .task[data-id="where"] .manual-place').value = 'Eiffel Tower, Paris'
  handlers('where')[0].click(); await tick()
  assert.equal(req('where').requirement.satisfied, true, 'a named place fills a location requirement')
  assert.equal(c.view(fresh.state.replica, [...errand, 'where']).tasks.find(t => t.kind === 'allocation').allocation.location.name, 'Eiffel Tower, Paris')
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: ok => ok({ coords: { latitude: 48.85837, longitude: 2.294481 } }) }, configurable: true })
  fresh.refresh(); await tick()
  const device = handlers('near').find(b => b.dataset.handler === 'lib:device:location')
  assert(device, 'the device handler shows when the device reports its position')
  device.click(); await tick(); await tick()
  assert.equal(req('near').requirement.satisfied, true, 'the device position fills a location requirement')
  assert.deepEqual(c.view(fresh.state.replica, [...errand, 'near']).tasks.find(t => t.kind === 'allocation').allocation.location, { lat: 48.85837, lng: 2.29448 })
  console.log('PASS: live and bundled library discovery, menu/search, click/drop, typed inputs, undo, library edits, and manual fallbacks')
}
main().catch(error => { console.error(error); process.exit(1) })
