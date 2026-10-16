const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-provider-'))

async function main() {
  buildSync({ entryPoints: [path.resolve(__dirname, '../../shared/sync/index.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'core.cjs') })
  const c = require(path.join(dir, 'core.cjs'))
  let r = c.addTask(c.createReplica('host'), [], 'Main title', 1, 'p')
  r = c.addTask(r, ['p'], 'Nested main', 2, 'nested')
  r = c.addMemberAt(r, ['p'], 'client', null, ['read', 'edit'], 3)
  const auth = { peerId: 'client', scope: ['p'], capabilities: ['provideNode', 'sync'] }
  const req = { peerId: 'client', scope: ['p'], path: [], linkId: 'root-client', branches: [{ scope: ['p'], name: 'feature' }] }
  let served = c.exchangeNode(r, req, auth, 4); r = served.replica
  assert.equal(served.node.data.description.content, 'Main title')
  const value = { ...served.node, data: { ...served.node.data, description: { content: 'Feature title' } } }
  served = c.exchangeNode(r, { ...req, update: { base: served.node, value } }, auth, 5); r = served.replica
  assert.equal(served.node.data.description.content, 'Feature title')
  assert.equal(c.withMainBranchPolicy(r.store, () => c.view(r, ['p']).name), 'Main title')
  const nested = { ...req, path: ['nested'], linkId: 'nested-client' }
  let n = c.exchangeNode(r, nested, auth, 6); r = n.replica
  r = c.exchangeNode(r, { ...nested, update: { base: n.node, value: { ...n.node, data: { ...n.node.data, description: { content: 'Feature nested' } } } } }, auth, 7).replica
  assert.equal(c.exchangeNode(r, nested, auth, 8).node.data.description.content, 'Feature nested')
  assert.equal(c.withMainBranchPolicy(r.store, () => c.view(r, ['p', 'nested']).name), 'Nested main')
  assert.notEqual(c.nodeSyncKey('host', ['p'], req.branches), c.nodeSyncKey('host', ['p']))
  assert.throws(() => c.exchangeNode(r, { ...req, branches: [{ scope: [], name: 'outside' }] }, auth, 9), /outside/)
  r = c.withMainBranchPolicy(r.store, () => c.setMemberCapabilitiesAt(r, ['p', 'nested'], 'client', [], [], 10))
  // Explicitly add a main denial, since changing a nonexistent member is a no-op.
  r = c.withMainBranchPolicy(r.store, () => c.addMemberAt(r, ['p', 'nested'], 'client', null, [], 11))
  assert.throws(() => c.exchangeNode(r, nested, auth, 12), /denied/)
  assert.equal(c.exchangeNode(r, req, auth, 12).node.children.length, 0)
  const masked = c.nodeLinkEndpoint(r, ['p'], 'client')
  r = c.setNodeLinkMask(r, ['p'], 'client', masked.remoteId, { fields: [] }, 13)
  assert.deepEqual(c.exchangeNode(r, req, auth, 14).node.data, {})
  let project = c.addTask(c.createReplica('project'), [], 'Root child', 20, 'child')
  const projectAuth = { peerId: 'owner', scope: [], owner: true, capabilities: ['provideNode', 'sync'] }
  const projectRequest = { peerId: 'owner', scope: [], path: ['child'], linkId: 'project-child', branches: [{ scope: [], name: 'feature' }] }
  let rootBranch = c.exchangeNode(project, projectRequest, projectAuth, 21)
  project = c.exchangeNode(rootBranch.replica, { ...projectRequest, update: { base: rootBranch.node, value: { ...rootBranch.node, data: { ...rootBranch.node.data, description: { content: 'Branch child' } } } } }, projectAuth, 22).replica
  assert.equal(c.exchangeNode(project, projectRequest, projectAuth, 23).node.data.description.content, 'Branch child')
  assert.equal(c.withMainBranchPolicy(project.store, () => c.view(project, ['child']).name), 'Root child')
  console.log('PASS: branch node exchange, main isolation, nested values, live grants and masks')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
