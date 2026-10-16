const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-provider-'))

async function main() {
  buildSync({ entryPoints: [path.resolve(__dirname, '../../shared/sync/index.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'core.cjs') })
  const c = require(path.join(dir, 'core.cjs'))
  let host = c.addTask(c.createReplica('host'), [], 'Shared parent', 1, 'parent')
  host = c.addTask(host, ['parent'], 'Visible child', 2, 'child')
  host = c.addTask(host, ['parent'], 'Hidden sibling', 3, 'hidden')
  host = c.addMemberAt(host, [], 'guest', null, ['read', 'edit'], 4)
  const auth = { peerId: 'guest', scope: ['parent'], capabilities: ['provideNode', 'sync'] }
  const req = { peerId: 'guest', scope: ['parent'], path: [], linkId: 'guest-parent' }
  let result = c.exchangeNode(host, req, auth, 5); host = result.replica
  assert.equal(result.node.data.description.content, 'Shared parent', 'a new attachment inherits its parent grant')
  host = c.setNodeLinkMask(host, [], c.NODE_PERMISSION_DEFAULT, '', { fields: ['description'] }, 6)
  host = c.setNodeLinkMask(host, ['parent'], c.NODE_PERMISSION_DEFAULT, '', { children: ['child'] }, 7)
  host = c.setNodeLinkMask(host, ['parent'], 'guest', result.node.remoteLinkId, { fields: ['description', 'todo'] }, 8)
  result = c.exchangeNode(host, req, auth, 9); host = result.replica
  assert.deepEqual(Object.keys(result.node.data), ['description'])
  assert.deepEqual(result.node.children.map(n => n.id), ['child'])
  assert.throws(() => c.exchangeNode(host, { ...req, path: ['hidden'], linkId: 'hidden' }, auth, 10), /mask|denied/)
  assert.throws(() => c.exchangeNode(host, { ...req, update: { base: result.node, value: { ...result.node, data: { ...result.node.data, todo: { done: true } } } } }, auth, 11), /masked/)
  assert(c.hasNodeLinkMasks(host.store, 'another-peer', ['parent']), 'node-wide defaults also block legacy transfers')
  host = c.loadReplica(c.serializeReplica(host))
  assert.deepEqual(c.exchangeNode(host, req, auth, 12).node.children.map(n => n.id), ['child'])
  const childReq = { ...req, path: ['child'], linkId: 'guest-child' }
  host = c.setNodeLinkMask(host, ['parent', 'child'], 'guest', '', { fields: [] }, 13)
  const prepared = c.nodeLinkEndpoint(host, ['parent', 'child'], 'guest')
  host = c.setNodeLinkMask(host, ['parent', 'hidden'], 'guest', '', {}, 13)
  assert.notEqual(c.nodeLinkEndpoint(host, ['parent', 'hidden'], 'guest').id, prepared.id, 'unpaired endpoint identities are distinct per node')
  let child = c.exchangeNode(host, childReq, auth, 14); host = child.replica
  assert.equal(child.node.linkId, prepared.id, 'pairing preserves the prepared local endpoint')
  assert.deepEqual(child.node.data, {})
  assert.equal(c.nodeLinkEndpoint(host, ['parent', 'child'], 'guest').remoteId, 'guest-child')
  assert.throws(() => c.exchangeNode(host, { ...childReq, linkId: 'evade' }, auth, 15), /mismatch/)
  let receiver = c.addTask(c.createReplica('guest'), [], 'Local attachment', 1, 'parent')
  receiver = c.setNodeLinkMask(receiver, [], c.NODE_PERMISSION_DEFAULT, '', { fields: [] }, 2)
  receiver = c.acceptProvidedNode(receiver, ['parent'], req, result.node, 3)
  assert.equal(c.nodeShape(receiver, ['parent']).data.description, undefined, 'incoming data respects receiver parent masks')
  assert.deepEqual(c.nodeLinkEndpoint(receiver, ['parent'], 'host').mask, {}, 'inherited policy is not copied into an explicit child override')
  assert(c.isNodeProjection(receiver, ['parent']))
  assert.equal(c.outgoingNodeShape(receiver, ['parent'], 'host', { data: { description: { content: 'private' } }, children: [] }).data.description, undefined)
  console.log('PASS: inherited grants, node-wide and per-peer masks, first pairing, masked writes, reload, and independent receiving policy')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
