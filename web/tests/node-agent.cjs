const assert = require('node:assert/strict')
const { build } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-node-agent-'))
async function main() {
  await build({ stdin: { contents: `export {createNodeAgentMcp} from './backend/mcp/nodeAgent'; export {agentMcp} from './shared/sync/agent-mcp'; export * from './shared/sync/index'`, resolveDir: path.resolve(__dirname, '../..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), plugins: [{ name: 'injected-persistence', setup(b) {
    b.onResolve({ filter: /(?:\.\/|\.\.\/sync\/)peerSync$/ }, () => ({ path: 'peerSync', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const withUserLock = async (_, f) => f(); export const serverPeerIdFor = name => 'user:' + name` }))
    b.onResolve({ filter: /^@fosforescent\/shared\/sync\// }, args => ({ path: path.resolve(__dirname, '../../shared/sync', args.path.split('/').at(-1) + '.ts') }))
  } }] })
  const c = require(path.join(dir, 'test.cjs'))
  let r = c.addTask(c.createReplica('user:alice'), [], 'Project', 1, 'project')
  r = c.addTask(r, ['project'], 'Research', 2, 'research')
  r = c.addTask(r, [], 'Private sibling', 3, 'private')
  r = c.addMemberAt(r, ['project'], 'agent:test', 'Research agent', ['read', 'edit'], 4)
  const handler = c.createNodeAgentMcp({ loadStore: async () => ({ user: { id: 1, username: 'alice' }, store: r.store }), saveStore: async () => {}, now: () => 10 })
  const claims = { username: 'alice', kind: 'peer', peerId: 'agent:test', scope: ['project'] }
  const call = async (method, params, options = {}) => {
    const sent = { status: 200, body: null }
    const res = { setHeader() {}, status(code) { sent.status = code; return this }, json(body) { sent.body = body; return this }, end() { return this } }
    await handler({ method: 'POST', headers: {}, claims, body: { jsonrpc: '2.0', id: 1, method, params }, ...options }, res)
    return sent
  }
  const tool = async (name, args) => (await call('tools/call', { name, arguments: args })).body.result
  const data = result => JSON.parse(result.content[0].text)
  assert.equal((await call('initialize')).body.result.serverInfo.name, 'fos-node')
  assert.equal((await call('tools/list')).body.result.tools.length, 2)
  assert.equal((await call('tools/list', {}, { claims: { username: 'alice' } })).status, 401, 'owner tokens are not scoped agent credentials')
  assert.equal((await call('tools/list', {}, { headers: { origin: 'https://untrusted.test' } })).status, 403)
  assert.equal((await call('tools/list', {}, { method: 'GET' })).status, 405)
  assert.equal((await call('notifications/initialized', {}, { body: { jsonrpc: '2.0', method: 'notifications/initialized' } })).status, 202)
  const initial = data(await tool('fos_read', {}))
  assert.equal(initial.data.description.content, 'Project')
  assert(!JSON.stringify(initial).includes('Private sibling'))
  assert.deepEqual(initial.children[0].path, ['research'])
  assert((await tool('fos_read', { path: ['..'] })).isError)
  assert((await tool('fos_read', { path: ['private'] })).isError)
  assert((await tool('fos_propose_text', { expected: 'stale', text: 'No' })).isError)
  const proposed = await tool('fos_propose_text', { expected: initial.revision, text: 'Proposed project' })
  assert(!proposed.isError, JSON.stringify(proposed))
  assert.equal(data(proposed).status, 'pending-owner-review')
  assert.equal(c.view(r, ['project']).name, 'Project', 'agent edits cannot merge themselves')
  assert(c.view(r, ['project']).proposals.some(p => p.peerId === 'agent:test'))
  r = c.setNodeLinkMask(r, ['project', 'research'], 'agent:test', '', { fields: [] }, 12)
  const masked = data(await tool('fos_read', { path: ['research'] }))
  assert(!JSON.stringify(masked).includes('Research'))
  assert((await tool('fos_propose_text', { path: ['research'], expected: masked.revision, text: 'Blocked' })).isError)
  r = c.setMemberCapabilitiesAt(r, ['project'], 'agent:test', [], [], 13)
  assert((await tool('fos_read', {})).isError, 'revocation applies to existing credentials')
  console.log('PASS: scoped MCP initialization, reads, proposals, masks, revocation, and transport boundaries')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => rmSync(dir, { recursive: true, force: true }))
