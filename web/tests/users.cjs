/* `@name` resolves through the graph: the app places a `verify` requirement for that name, runs it on the account
   server (a `complete` event; the server's verify handler binds the attested user object), and checks the
   attestation with its own verify handler against the key the server published on its member entry (WebCrypto Ed25519). No
   user lookup or key route is asked. */
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync } = require('node:fs')
const { createPrivateKey, createPublicKey, sign } = require('node:crypto')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-users-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Node','Option','navigator','localStorage','sessionStorage','location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export {App} from './src/app'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), external: ['mermaid','katex','katex/*'] })
const c = require(path.join(dir, 'test.cjs'))
const ALLOCATION_TYPE = 'lib:type:allocation'
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

// the server's ed25519 identity key, as backend/sync/verify.ts makes it from a seed
const keyFrom = byte => {
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, byte)]), format: 'der', type: 'pkcs8' })
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' })
  return { privateKey, publicKey: spki.subarray(spki.length - 32).toString('base64') }
}
const server = keyFrom(7), stranger = keyFrom(9)
const attest = (base, key = server) => ({ ...base, verification: { by: 'fos', method: c.USER_SERVER_ATTESTATION, issuedAt: 1000, attestation: sign(null, Buffer.from(c.userAttestationPayload(base, 'fos', c.USER_SERVER_ATTESTATION, 1000)), key.privateKey).toString('base64') } })

async function main() {
  const HOME = c.HOME_ID
  const calls = []
  let app = null, signer = server, tamper = false
  globalThis.fetch = async (url, init) => {
    const u = new URL(url)
    const json = (status, value) => ({ ok: status < 400, status, statusText: 'x', json: async () => value })
    calls.push(u.pathname)
    if (u.pathname === '/user/data/events') {
      // the account server's verify handler: the attested object bound as the requirement's user field, and its supply
      // (syncs are no-ops here, so the result is applied to the device's replica as a sync would bring it)
      const body = JSON.parse(init.body), at = body.scope, r = app.state.replica
      const row = c.view(r, at.slice(0, -1)).tasks.find(t => t.id === at.at(-1))
      assert.equal(body.event.kind, 'complete')
      assert.equal(row.requirement.capability, 'verify')
      const name = row.title.replace(/^@/, '')
      if (name !== 'bob') return json(400, { error: `No Fos user is named @${name}.` })
      const user = attest({ account: '42', username: 'bob', name: 'Bob Builder', publicKey: '' }, signer)
      let next = c.bindUserAt(r, at, tamper ? { ...user, name: 'Mallory' } : user, 10)
      next = c.addSupply(next, at.slice(0, -1), at.at(-1), { capability: 'verify', by: 'fos', ref: '42' }, 10)
      app.set({ replica: next })
      return json(200, { evaluation: { status: 'committed' } })
    }
    return json(404, { error: `unexpected ${u.pathname}` })
  }
  app = new c.App({ baseUrl: 'http://localhost', autoLogin: null, storage: c.createMemoryStorage() })
  app.scheduleSync = () => {}; app.syncNow = async () => {}
  // the account context as the server ensures it: Home, the fos member's offers and the key published on that member's entry
  let me = c.ensureHomeContext(c.createReplica('user:me'), 1, { server: ['verify'], keys: { fos: server.publicKey } })
  me = { ...me, meta: { ...me.meta, peerId: 'user:me', serverPeerId: 'user:me' } }
  me = c.addTask(me, [HOME], 'Review', 2, 'review')
  app.set({ replica: me, session: { kind: 'user', username: 'me', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  app.recordServerOffers([...c.SERVER_TRANSPORT_CAPABILITIES, 'verify'])
  assert.equal(c.publishedKey(app.state.replica, 'fos'), server.publicKey)
  const settle = async () => { for (let i = 0; i < 50 && app.resolvingUsers.size; i++) await tick(); await tick() }
  const named = id => c.view(app.state.replica, [HOME, 'review']).tasks.find(t => t.id === id).user

  // typing "-@bob …" binds the unverified object, then the server's verify handler fills a verify requirement
  app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, 'read it', { id: 'rq', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('bob') } })
  await settle()
  assert.deepEqual(calls, ['/user/data/events'], 'only a complete event: no user or key route')
  const bob = named('rq')
  assert.equal(bob.account, '42')
  assert.equal(bob.verification.by, 'fos')
  assert.deepEqual(c.verifyPublished(app.state.replica, bob, (payload, signature, key) => require('node:crypto').verify(null, Buffer.from(payload), createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'base64')]), format: 'der', type: 'spki' }), Buffer.from(signature, 'base64'))), { ok: true, by: 'fos' })
  assert.deepEqual(c.cachedUser(app.state.replica, 'bob'), bob, 'kept among the people in Home')
  assert(!c.verifyRequestAt(app.state.replica, 'bob'), 'the filled request is removed')
  // later rows bind the cached object without asking again
  app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, 'again', { id: 'rq2', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('bob') } })
  await settle()
  assert.equal(calls.length, 1)
  assert.deepEqual(named('rq2'), bob)

  // an object signed by another key, or changed after signing, fails the device's check against the published key
  for (const [label, setup] of [['foreign key', () => { signer = stranger }], ['tampered', () => { signer = server; tamper = true }]]) {
    setup()
    app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, label, { id: label, extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('bob') } })
    // forget the cached object so the name is asked for again
    app.set({ replica: c.deleteTask(app.state.replica, c.usersPath(app.state.replica), c.userObjectId({ username: 'bob' }), 11) })
    app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, label + ' 2', { id: label + '2', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('bob') } })
    await settle()
    assert.match(app.state.notice.text, /verification of @bob does not check out/, label)
    assert.equal(c.cachedUser(app.state.replica, 'bob'), null, `${label}: nothing is cached`)
    assert.equal(named(label + '2').verification, null, `${label}: the row keeps the unverified object`)
  }
  tamper = false

  // an unknown name: the server's refusal is shown and the request removed
  app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, 'who', { id: 'nobody', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('nobody') } })
  await settle()
  assert.match(app.state.notice.text, /No Fos user is named @nobody/)
  assert(!c.verifyRequestAt(app.state.replica, 'nobody'))

  // the server's key missing from the graph: nothing verifies
  signer = server
  app.set({ replica: c.deleteTask(app.state.replica, [c.memberEntryId('fos')], c.peerKeyId('fos'), 12) })
  app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, 'no key', { id: 'nokey', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('bob') } })
  await settle()
  assert.match(app.state.notice.text, /does not check out/)

  // offline nothing is asked: the row keeps the unverified object until a later edit online
  const before = calls.length
  app.set({ connection: 'offline' })
  app.addRowAt([HOME, 'review'], ALLOCATION_TYPE, 'offline', { id: 'offline', extras: { requirement: { capability: 'peer' }, user: c.unverifiedUser('carol') } })
  await settle()
  assert.equal(calls.length, before)
  assert.equal(named('offline').verification, null)
  assert(!c.verifyRequestAt(app.state.replica, 'carol'), 'no request is left behind')
  console.log('users: ok')
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1) })
