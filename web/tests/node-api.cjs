const assert = require('node:assert/strict')
const { build } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-api-'))
async function main() {
  await build({ stdin: { contents: `export {createNodeProvider} from './backend/sync/provideNode'; export * from './shared/sync/index'`, resolveDir: path.resolve(__dirname, '../..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), plugins: [{ name: 'injected-persistence', setup(b) {
    b.onResolve({ filter: /^\.\/accountStore$/ }, () => ({ path: 'accountStore', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const withUserLock = async (_, f) => f(); export const serverPeerIdFor = name => 'user:' + name` }))
    b.onResolve({ filter: /^@fosforescent\/shared\/sync\/index$/ }, () => ({ path: path.resolve(__dirname, '../../shared/sync/index.ts') }))
  } }] })
  const c = require(path.join(dir, 'test.cjs'))
  let r = c.addTask(c.createReplica('user:alice'), [], 'Allowed', 1, 'allowed')
  r = c.addTask(r, ['allowed'], 'Nested body', 2, 'nested')
  r = c.addTask(r, [], 'Other private branch', 3, 'private')
  r = c.addMemberAt(r, ['allowed'], 'guest', 'Guest', ['read'], 4)
  let saves = 0
  const handler = c.createNodeProvider({ loadStore: async name => name === 'alice' ? { user: { id: 1, username: name }, store: r.store } : null, saveStore: async () => { saves++ }, now: () => 5 })
  const call = async (body, claims) => {
    const sent = { status: 200, body: null, headers: {} }
    const res = { status(n) { sent.status = n; return res }, json(value) { sent.body = value; return res }, setHeader(k, v) { sent.headers[k] = v } }
    await handler({ body, claims }, res)
    return sent
  }
  const request = { peerId: 'guest', scope: ['allowed'], path: [], linkId: 'guest-link' }
  const claims = { username: 'alice', kind: 'peer', peerId: 'guest', scope: ['allowed'] }
  assert.equal((await call(request)).status, 401)
  const first = await call(request, claims)
  assert.equal(first.status, 200)
  assert.equal(first.body.data.description.content, 'Allowed')
  assert(!JSON.stringify(first.body).includes('Nested body'))
  assert(!JSON.stringify(first.body).includes('Other private branch'))
  assert.equal(first.headers['Cache-Control'], 'no-store')
  assert.equal(saves, 1)
  assert.equal((await call(request, claims)).status, 200)
  assert.equal(saves, 1, 'idempotent fetch does not rewrite the endpoint')
  assert.equal((await call({ ...request, scope: ['private'] }, claims)).status, 403)
  assert.equal((await call({ ...request, peerId: 'owner' }, claims)).status, 403)
  assert.equal((await call({ ...request, path: ['..'] }, claims)).status, 403)
  const proposed = { ...first.body, data: { ...first.body.data, description: { content: 'Proposed title' } } }
  assert.equal((await call({ ...request, update: { base: first.body, value: proposed } }, claims)).status, 403, 'read does not authorize edits')
  r = c.setMemberCapabilitiesAt(r, ['allowed'], 'guest', ['read', 'edit'], [], 6)
  const edit = await call({ ...request, update: { base: first.body, value: proposed } }, claims)
  assert.equal(edit.status, 200)
  assert(edit.body.grants.includes('edit'), 'its grants are what it was granted')
  assert.equal(c.view(r, ['allowed']).name, 'Allowed', 'invited edits cannot change main')
  assert.equal((await call(request, claims)).body.data.description.content, 'Proposed title', 'peer reads its pending value')
  const proposal = c.view(r, ['allowed']).proposals.find(p => p.peerId === 'guest')
  assert(proposal, 'the existing approval UI can find the node proposal')
  r = c.addMemberAt(r, ['allowed'], 'reviewer', null, ['read', 'edit'], 7)
  const reviewRequest = { peerId: 'reviewer', scope: ['allowed'], path: [], linkId: 'review-link', proposal: { scope: ['allowed'], id: proposal.id } }
  const reviewClaims = { ...claims, peerId: 'reviewer' }
  const preview = await call(reviewRequest, reviewClaims)
  assert.equal(preview.status, 200, JSON.stringify(preview.body))
  assert.equal(preview.body.data.description.content, 'Proposed title')
  assert(!JSON.stringify(preview.body).includes('Nested body'))
  r = c.addMemberAt(r, ['allowed'], 'viewer', null, ['read'], 7)
  assert.equal((await call({ ...reviewRequest, peerId: 'viewer', linkId: 'viewer-preview' }, { ...claims, peerId: 'viewer' })).status, 403)
  assert.equal((await call({ ...reviewRequest, update: { base: first.body, value: proposed } }, reviewClaims)).status, 403, 'proposal previews cannot write')
  r = c.applyProposalAt(r, ['allowed'], proposal.cid ?? proposal.id, 'owner', 7)
  assert.equal(c.view(r, ['allowed']).name, 'Proposed title', 'approval applies the node change')
  r = c.setMemberCapabilitiesAt(r, ['allowed'], 'guest', [], [], 6)
  assert.equal((await call(request, claims)).status, 403, 'current grants revoke an already connected peer')
  console.log('PASS: HTTP node-provider authentication, scoped credentials, shallow response, persistence and revocation')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
