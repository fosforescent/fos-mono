const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-provider-'))

async function main() {
  buildSync({ entryPoints: [path.resolve(__dirname, '../../shared/sync/index.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'core.cjs') })
  const c = require(path.join(dir, 'core.cjs'))
  let source = c.createReplica('server')
  source = c.addTask(source, [], 'Visible parent', 1, 'parent')
  source = c.addTask(source, ['parent'], 'Secret grandchild body', 2, 'child')
  source = c.addTask(source, [], 'Hidden sibling', 3, 'hidden')
  source = c.addMemberAt(source, [], 'client', null, ['read'], 4)
  source = c.addMemberAt(source, ['hidden'], 'client', null, [], 5)
  const request = { peerId: 'client', scope: [], path: [], linkId: 'client-link' }
  const authority = { peerId: 'client', scope: [], capabilities: ['provideNode', 'sync'] }
  let result = c.provideNode(source, request, authority, 6); source = result.replica
  assert.deepEqual(result.node.children.map(child => child.id), ['parent'])
  assert(!JSON.stringify(result.node).includes('Secret grandchild body'))
  assert(!JSON.stringify(result.node).includes('Hidden sibling'))
  assert.throws(() => c.provideNode(source, { ...request, path: ['hidden'] }, authority, 7), /denied/)
  assert.throws(() => c.provideNode(source, { ...request, peerId: 'someone-else' }, authority, 7), /attachment/)
  assert.throws(() => c.provideNode(source, request, { ...authority, capabilities: [] }, 7), /does not provide/)
  assert.throws(() => c.provideNode(source, { ...request, linkId: 'mask-bypass' }, authority, 7), /endpoint mismatch/)
  let client = c.acceptProvidedNode(c.createReplica('client'), [], request, result.node, 7)
  const a = c.nodeLinkEndpoint(source, [], 'client'), b = c.nodeLinkEndpoint(client, [], 'server')
  assert.notEqual(a.id, b.id)
  assert.equal(a.remoteId, b.id)
  assert.equal(b.remoteId, a.id)
  assert.equal(c.view(client, []).tasks[0].refPeer, 'server')
  client = c.setNodeLinkMask(client, [], 'server', b.remoteId, { fields: [], children: [] }, 8)
  assert.deepEqual(c.nodeLinkEndpoint(source, [], 'client').mask, {})
  client = c.acceptProvidedNode(client, [], request, result.node, 9)
  assert.equal(c.view(client, []).tasks.length, 0)
  source = c.setNodeLinkMask(source, [], 'client', a.remoteId, { fields: [], children: ['parent'] }, 10)
  const parentReq = { ...request, path: ['parent'], linkId: 'parent-client-link' }
  const parent = c.provideNode(source, parentReq, authority, 11)
  source = parent.replica
  assert.deepEqual(parent.node.data, {}, 'ancestor field masks apply to direct descendant requests')
  assert.throws(() => c.provideNode(source, { ...request, path: ['hidden'], linkId: 'new-id' }, authority, 12), /denied/)
  let calls = 0
  const peer = { id: 'server', capabilities: ['provideNode'], request: async req => { calls++; return c.provideNode(source, req, authority, 13).node } }
  await c.pullNode(request, [{ ...peer, capabilities: [], request: () => { throw new Error('must not run') } }, peer])
  assert.equal(calls, 1)
  await assert.rejects(() => c.pullNodeTree(request, peer), /eager sync/)
  const loaded = c.loadReplica(c.serializeReplica(source))
  assert.deepEqual(c.nodeLinkEndpoint(loaded, [], 'client').mask, { fields: [], children: ['parent'] })
  assert.throws(() => c.buildSyncRequest(client), /node masks/)
  const incoming = c.buildSyncRequest(c.createReplica('client'))
  assert.equal(c.serveSync(source.store, incoming, 'server', 14).code, 'bad-request')
  let eagerSource = c.addTask(c.createReplica('server'), [], 'Outer', 1, 'outer')
  eagerSource = c.addTask(eagerSource, ['outer'], 'Inner', 2, 'inner')
  eagerSource = c.addMemberAt(eagerSource, [], 'client', null, ['read'], 3)
  let eagerCalls = 0
  const eagerPeer = { id: 'server', capabilities: ['provideNode', 'sync'], request: async req => {
    eagerCalls++; const served = c.provideNode(eagerSource, req, authority, 4); eagerSource = served.replica; return served.node
  } }
  const traversal = await c.pullNodeTree(request, eagerPeer)
  assert.equal(traversal.length, 3)
  assert.equal(new Set(traversal.map(n => n.remoteLinkId)).size, 3, 'every node has its own receiving ref')
  assert.equal((await c.pullNodeTree(request, eagerPeer)).length, 3, 'repeated traversal preserves endpoint identities')
  const eagerEndpoint = c.nodeLinkEndpoint(eagerSource, [], 'client')
  eagerSource = c.setNodeLinkMask(eagerSource, [], 'client', eagerEndpoint.remoteId, { children: [] }, 5)
  eagerCalls = 0
  assert.equal((await c.pullNodeTree(request, eagerPeer)).length, 1)
  assert.equal(eagerCalls, 1, 'eager traversal stops at the same mask as lazy pulls')
  let relay = c.createReplica('relay')
  const foreign = c.put(relay.store, { data: { alias: { id: 'remote' }, ref: { id: 'remote', peer: 'device', version: 'unloaded', scope: ['device-home', 'remote'] } }, children: [] })
  c.commitRoot(relay.store, c.put(relay.store, { data: {}, children: [[foreign, c.rowPrimitive(relay.store, 'plain')]] }), 1)
  const forwarded = c.provideNode(relay, request, { ...authority, owner: true }, 2).node
  assert.deepEqual(forwarded.children[0].address, { peerId: 'device', scope: ['device-home', 'remote'] }, 'a relay preserves the actual provider address')
  const safeRequest = c.buildSyncRequest(c.createReplica('client'))
  const boundary = c.serveSync(source.store, safeRequest, 'server', 14)
  assert.equal(boundary.code, 'bad-request', 'legacy sync cannot bypass an endpoint mask')
  let moving = c.addTask(c.createReplica('server'), [], 'Moves with policy', 1, 'moving')
  moving = c.addTask(moving, [], 'Destination', 2, 'destination')
  moving = c.addMemberAt(moving, [], 'client', null, ['read'], 3)
  const moveRequest = { ...request, path: ['moving'], linkId: 'moving-link' }
  const original = c.provideNode(moving, moveRequest, authority, 4); moving = original.replica
  moving = c.setNodeLinkMask(moving, ['moving'], 'client', 'moving-link', { fields: [] }, 5)
  moving = c.moveNode(moving, [], 'moving', [], { into: 'destination' }, 6)
  const moved = c.provideNode(moving, { ...moveRequest, path: ['destination', 'moving'] }, authority, 7)
  assert.equal(moved.node.linkId, original.node.linkId)
  assert.deepEqual(moved.node.data, {}, 'node masks follow the stable identity through moves')
  // Writes use the same live permissions and independently mutable masks.
  let writable = c.addTask(c.createReplica('writer-host'), [], 'Parent', 20, 'p')
  writable = c.addTask(writable, ['p'], 'Retained child body', 21, 'kept')
  writable = c.addMemberAt(writable, ['p'], 'editor', null, ['read', 'edit'], 22)
  const writeRequest = { peerId: 'editor', scope: ['p'], path: [], linkId: 'write-link' }
  const writeAuth = { peerId: 'editor', scope: ['p'], capabilities: ['provideNode', 'sync'] }
  let offered = c.exchangeNode(writable, writeRequest, writeAuth, 23); writable = offered.replica
  const changed = { ...offered.node, data: { ...offered.node.data, description: { content: 'Changed parent' } } }
  writable = c.exchangeNode(writable, { ...writeRequest, update: { base: offered.node, value: changed } }, writeAuth, 24).replica
  assert.equal(c.view(writable, ['p']).name, 'Changed parent')
  assert.equal(c.view(writable, ['p', 'kept']).name, 'Retained child body')
  const endpoint = c.nodeLinkEndpoint(writable, ['p'], 'editor')
  writable = c.setNodeLinkMask(writable, ['p'], 'editor', endpoint.remoteId, { fields: [] }, 25)
  assert.throws(() => c.exchangeNode(writable, { ...writeRequest, update: { base: changed, value: offered.node } }, writeAuth, 26), /masked/)
  const beforeDenied = c.headCid(writable)
  assert.throws(() => c.exchangeNode(writable, { ...writeRequest, scope: [], update: { base: offered.node, value: changed } }, writeAuth, 27), /attachment/)
  assert.equal(c.headCid(writable), beforeDenied)
  const baseShape = { data: { name: { content: 'Base' } }, children: [] }
  const mergedFields = c.mergeNodeShape(baseShape, { ...baseShape, data: { name: { content: 'Local' } } }, { ...baseShape, data: { ...baseShape.data, description: { content: 'Remote' } } })
  assert.equal(mergedFields.data.name.content, 'Local')
  assert.equal(mergedFields.data.description.content, 'Remote')
  console.log('PASS: shallow pulls, provider selection, reciprocal refs, masks, revoked children, scope checks and reload')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
