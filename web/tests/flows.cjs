// One story through the UI, two accounts and the account server between them (the server runs the shared core on
// alice's account, as the backend does): alice writes a note with LaTeX in its body row and publishes it, shares the
// node with her friend bob, bob opens it, adds a task and a comment, and his changes reach alice as one submission
// she reviews read-only and merges.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-flows-'))
const dom = new JSDOM('<!doctype html><div id="alice"></div><div id="bob"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location', 'KeyboardEvent', 'Event']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')) }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const key = (el, k, init = {}) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...init }))

async function main() {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export {renderSitePage} from './src/site'; export {markdownToSafeHtml} from './src/markdown-core'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'flows.cjs'), logLevel: 'silent', external: ['mermaid'], loader: { '.css': 'empty' } }) // KaTeX is bundled: the note body renders real math
  const c = require(path.join(dir, 'flows.cjs'))
  const HOME = c.HOME_ID
  let now = 1000
  const routes = []

  // alice: her device is her account here (what she does is what the server holds for her)
  const alice = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  alice.scheduleSync = () => {}
  const agree = r => { const peer = 'user:alice', nodeSync = {}; for (const p of c.materializedNodePaths(r, r.meta.localScope ?? [])) nodeSync[c.nodeSyncKey(peer, p, c.nodeBranches(r, p))] = { local: c.nodeShape(r, p), remote: c.nodeShape(r, p) }; return { ...r, meta: { ...r.meta, serverPeerId: peer, nodeSync, lastSyncAt: 1 } } }
  alice.syncNow = async () => { alice.state.replica = agree(alice.state.replica) }
  const account = () => alice.state.replica
  const host = r => alice.set({ replica: agree(r) })
  const aliceRoot = document.getElementById('alice')
  c.mountUi(aliceRoot, alice)
  alice.set({ session: { kind: 'user', username: 'alice', jwt: 'alice-token', baseUrl: 'http://localhost' }, connection: 'online' })
  const $ = (root, selector) => root.querySelector(selector)
  const $$ = (root, selector) => [...root.querySelectorAll(selector)]

  // the account server: who calls is told by the bearer token
  globalThis.fetch = async (url, init) => {
    const u = new URL(url), body = init?.body ? JSON.parse(init.body) : null
    const who = (init?.headers?.Authorization ?? init?.headers?.authorization ?? '').includes('bob') ? 'bob' : 'alice'
    routes.push(`${who} ${init?.method ?? 'GET'} ${u.pathname}`)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    if (u.pathname === '/groups/search/name') return json(200, { users: [{ user_name: 'alice' }, { user_name: 'bob' }].filter(x => x.user_name.includes(u.searchParams.get('name'))) })
    if (u.pathname === '/user/data/events' && who === 'alice') {
      const dispatched = c.dispatchEvent(account(), body.event, { peerId: 'user:alice', owner: true, scope: body.scope ?? [] }, ++now)
      host(dispatched.replica); return json(200, dispatched.result)
    }
    if (u.pathname === '/user/data/peer-sync/locate' && who === 'bob') {
      const shared = c.view(account(), [HOME])?.tasks.find(t => t.id === u.searchParams.get('id'))
      const member = shared && c.contextMembers(account(), [HOME, shared.id]).find(m => m.peerId === 'user:bob')
      return member ? json(200, { owner: 'alice', aliasId: shared.id, path: [HOME, shared.id], title: shared.title, grants: member.capabilities }) : json(403, { error: 'This node is not shared with you.' })
    }
    if (u.pathname === '/user/data/peer-sync/provide-node' && who === 'bob') {
      const { owner, ...request } = body
      // the server's copy of an account is the peer `user:<name>`
      const device = account().meta.peerId
      const served = c.exchangeNode({ ...account(), meta: { ...account().meta, peerId: 'user:alice' } }, request, { peerId: 'user:bob', scope: request.scope, owner: false, proposeOnly: true, capabilities: c.SERVER_TRANSPORT_CAPABILITIES }, ++now)
      host({ ...served.replica, meta: { ...served.replica.meta, peerId: device } }); return json(200, served.node)
    }
    if (u.pathname.includes('decide') || (u.pathname === '/user/data/events' && body?.event?.kind === 'decide')) {
      const event = body.event ?? { kind: 'decide', path: [], proposalId: body.proposalId, decision: body.decision }
      const dispatched = c.dispatchEvent(account(), event, { peerId: 'user:alice', owner: true, scope: body.scope ?? body.path ?? [] }, ++now)
      host(dispatched.replica); return json(200, dispatched.result)
    }
    return json(404, { error: `unexpected ${who} ${u.pathname}` })
  }

  // 1. alice writes a note: its row is one title line, its body a Markdown row of its own with LaTeX in it
  const ghost = () => $(aliceRoot, '.tree .task.ghost textarea.edit')
  ghost().focus(); ghost().value = 'Math notes'; key(ghost(), 'Enter'); await tick()
  const notesId = c.view(account(), [HOME]).tasks.find(t => t.title === 'Math notes').id
  alice.zoomTo([notesId]); await tick()
  assert.equal($(aliceRoot, '.node-title-input').value, 'Math notes', 'the title is the node’s own row editor')
  ghost().focus(); ghost().value = "> Euler's identity"; key(ghost(), 'Enter'); await tick()
  const note = alice.currentView().tasks.find(t => t.type === c.NOTE_TYPE)
  assert.equal(note.title, "Euler's identity")
  const bodyId = `${note.id}/field/body`
  assert($(aliceRoot, `.tree .task[data-id="${bodyId}"]`), 'the note shows its body row beneath it')
  // click the body row to edit it, type LaTeX, leave with Escape
  alice.select([note.id, bodyId]); await tick()
  const bodyEditor = $(aliceRoot, `.tree .task[data-id="${bodyId}"] textarea.edit`)
  assert(bodyEditor, 'the body row edits in place')
  bodyEditor.value = 'For every real $x$:\n\n$$e^{i\\pi} + 1 = 0$$'
  key(bodyEditor, 'Escape'); await tick()
  assert.equal(c.view(account(), [HOME, notesId, note.id]).tasks.find(t => t.id === bodyId).title, 'For every real $x$:\n\n$$e^{i\\pi} + 1 = 0$$')
  assert.equal(c.view(account(), [HOME, notesId]).tasks.find(t => t.id === note.id).title, "Euler's identity", 'the title stays one line')
  alice.select(null); await tick() // a selected row shows its editor; unselected, its rendering
  for (let i = 0; i < 50 && !$(aliceRoot, `.tree .task[data-id="${bodyId}"] .note-body .katex`); i++) await new Promise(resolve => setTimeout(resolve, 20))
  assert($(aliceRoot, `.tree .task[data-id="${bodyId}"] .note-body .katex-display`), 'the body row renders its LaTeX as math')

  // 2. let anyone run the node: the Fos server's constructor makes the audience's peer row, whose Execute switch is on
  alice.select(null); await tick() // constructors add inside the selected row, else into the node
  $(aliceRoot, '.children-toolbar .constructors-toggle').click(); await tick()
  $(aliceRoot, '.peer-tabs [aria-label="Fos server"]').click(); await tick()
  $(aliceRoot, '.constructor-grid [aria-label="Publish publicly"]').click(); await tick()
  const publishRow = () => $$(aliceRoot, '.tree .constructor-body').find(b => b.querySelector('.sharing-controls'))
  assert(publishRow(), 'the audience row holds its switches')
  const execute = $(publishRow(), '.peer-grants input[aria-label$=": execute"]')
  execute.checked = true; execute.dispatchEvent(new window.Event('change')); await tick()
  assert.deepEqual(c.publication(account(), [HOME, notesId]), { audience: 'public', template: false }, 'the node is published: anyone may run it')
  assert.deepEqual(c.view(account(), [HOME, notesId]).members.find(m => m.peerId === 'audience:public').capabilities, ['execute'])
  // the server's `url` handler (it runs after this write reaches the account) makes the node's link a row of its entry
  const device = account().meta.peerId
  host((r => ({ ...r, meta: { ...r.meta, peerId: device } }))(c.syncPublishedUrls({ ...account(), meta: { ...account().meta, peerId: 'user:alice' } }, [HOME, notesId], 'http://localhost', ++now)))
  const link = $(publishRow(), '[aria-label="Shareable URL"]')?.value
  assert(link && link.includes('#share='), 'the audience row shows the link the server made')
  // what a visitor sees: the note's title and its body as Markdown, math included
  const projection = c.sharedProjection(account(), [HOME, notesId], value => JSON.stringify(value).length.toString())
  assert.deepEqual(projection.rows.filter(r => r.type === c.NOTE_TYPE || r.type === c.MARKDOWN_TYPE).map(r => [r.type, r.title, r.body]), [[c.NOTE_TYPE, "Euler's identity", undefined], [c.MARKDOWN_TYPE, '', 'For every real $x$:\n\n$$e^{i\\pi} + 1 = 0$$']])
  const page = document.createElement('div')
  await c.renderSitePage(page, projection, { trail: [], navigate: () => {}, markdown: async text => c.markdownToSafeHtml(text) })
  assert(page.querySelector('.fos-site-section .fos-site-markdown'), 'the body renders as Markdown inside the note’s section')
  assert(page.textContent.includes("Euler's identity") && page.textContent.includes('e^{i\\pi} + 1 = 0'), 'the page carries the title and the LaTeX source for math rendering')

  // 3. add a friend: the Fos server's "Share with a Fos user" row searches and invites
  $(aliceRoot, '.peer-tabs [aria-label="Fos server"]').click(); await tick()
  $(aliceRoot, '.constructor-grid [aria-label="Share with a Fos user"]').click(); await tick()
  const search = $(aliceRoot, '.tree .constructor-body [aria-label="Search Fos users"]')
  assert(search, 'the sharing row has the user search')
  search.value = 'bob'; search.closest('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
  for (let i = 0; i < 20 && !$(aliceRoot, '.fos-user-results button'); i++) await tick()
  $$(aliceRoot, '.fos-user-results button').find(b => b.textContent === 'Add @bob').click()
  for (let i = 0; i < 20 && !c.contextMembers(account(), [HOME, notesId]).some(m => m.peerId === 'user:bob'); i++) await tick()
  assert(c.contextMembers(account(), [HOME, notesId]).some(m => m.peerId === 'user:bob' && m.capabilities.includes('edit')), 'bob is a member who may propose')

  // 4. bob opens the shared node from his Home (where the server delivered it)
  const bob = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  bob.scheduleSync = () => {}; bob.syncNow = async () => {}
  let bobReplica = c.ensureHomeContext(c.createReplica('user:bob'), 1)
  bobReplica = { ...bobReplica, meta: { ...bobReplica.meta, peerId: 'user:bob', serverPeerId: 'user:bob' } }
  bobReplica = c.addRow(bobReplica, [HOME], c.PLAIN_TYPE, 'alice', 2, { id: 'shared-host:alice' })
  bobReplica = c.addRow(bobReplica, [HOME, 'shared-host:alice'], c.REF_TYPE, 'Math notes', 3, { id: `member:${notesId}`, refOwner: 'alice', refId: notesId })
  const bobRoot = document.getElementById('bob')
  aliceRoot.replaceChildren()
  c.mountUi(bobRoot, bob)
  bob.set({ replica: bobReplica, session: { kind: 'user', username: 'bob', jwt: 'bob-token', baseUrl: 'http://localhost' }, connection: 'online' })
  const at = [HOME, 'shared-host:alice', `member:${notesId}`]
  await bob.openSharedNode(at); await tick()
  assert.deepEqual(bob.state.view, at)
  assert($(bobRoot, '.shared-grants').textContent.includes('Shared by @alice'))
  await bob.loadPeerNode([...at, note.id]); await tick()
  assert.equal(c.view(bob.state.replica, at).tasks.find(t => t.id === note.id)?.title, "Euler's identity", 'bob reads the note')

  // 5. bob adds a task and a comment through his tree; they reach alice as his submission
  const bobGhost = () => $(bobRoot, '.tree .task.ghost textarea.edit')
  bobGhost().focus(); bobGhost().value = '[ ] Prove it for complex x'; key(bobGhost(), 'Enter'); await tick()
  bobGhost().focus(); bobGhost().value = '// Nice: this is the special case of e^{ix} = cos x + i sin x'; key(bobGhost(), 'Enter'); await tick()
  await bob.syncSharedNodes(false)
  const proposals = c.view(account(), [HOME, notesId]).proposals
  assert.deepEqual(proposals.map(p => [p.peerId, p.status]), [['user:bob', 'open']], 'bob’s edits are one open submission on alice’s node')
  assert(!c.view(account(), [HOME, notesId]).tasks.some(t => t.title.startsWith('Prove it')), 'main is untouched until alice decides')

  // 6. alice reviews the submission read-only from the title row's branches, then merges it
  bobRoot.replaceChildren(); c.mountUi(aliceRoot, alice); alice.goTo([HOME, notesId]); await tick()
  $(aliceRoot, '.node-choices .combo-trigger').click(); await tick()
  const option = $$(aliceRoot, '.node-choices [role="option"]').find(o => o.textContent.includes('user:bob'))
  assert(option, 'the submission is offered among the branches')
  option.click(); await tick()
  assert(alice.state.view.length && $(aliceRoot, '.node-title-input').readOnly, 'the submission previews read-only')
  for (let i = 0; i < 20 && !$(aliceRoot, '.tree').textContent.includes('Prove it'); i++) await tick()
  assert($(aliceRoot, '.tree').textContent.includes('Prove it for complex x'), 'the preview shows bob’s task')
  const approve = $$(aliceRoot, 'button').find(b => b.textContent === 'Approve and merge')
  assert(approve, 'the owner can approve it')
  approve.click()
  for (let i = 0; i < 20 && !c.view(account(), [HOME, notesId]).tasks.some(t => t.title === 'Prove it for complex x'); i++) await tick()
  const merged = c.view(account(), [HOME, notesId]).tasks
  assert(merged.some(t => t.title === 'Prove it for complex x' && t.checkable), 'bob’s task is merged')
  const comment = merged.find(t => t.type === c.COMMENT_TYPE)
  assert(comment && comment.title.startsWith('Nice: this is the special case'), 'bob’s comment is merged')
  assert.equal(comment.author?.name, 'bob', 'the comment is attributed to bob')
  assert(merged.some(t => t.id === note.id), 'alice’s note is still there')
  console.log('PASS: LaTeX note published, friend invited, their task and comment submitted, reviewed and merged')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { rmSync(dir, { recursive: true, force: true }); setTimeout(() => process.exit(process.exitCode ?? 0), 200) })
