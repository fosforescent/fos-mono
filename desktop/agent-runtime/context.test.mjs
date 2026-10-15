import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contextTools, serveContext } from './context.mjs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const tree = { revision: 'snapshot', nodes: [{ path: [], text: 'Feature' }, { path: ['one'], text: 'Implement button' }] }
test('snapshot navigation cannot escape the attached subtree', () => {
  const tools = contextTools(tree)
  assert.equal(tools.read().children[0].text, 'Implement button')
  assert.equal(tools.search('BUTTON').length, 1)
  assert.throws(() => tools.read(['..']))
  assert.throws(() => tools.read(['other']))
  assert.throws(() => contextTools({ nodes: [tree.nodes[0], tree.nodes[0]] }))
})
test('SDK-compatible HTTP MCP requires bearer token and exposes read/search only', async () => {
  const server = await serveContext(tree)
  const client = new Client({ name: 'test', version: '1' })
  try {
    assert.equal((await fetch(server.url, { method: 'POST' })).status, 403)
    assert.equal((await fetch(server.url, { method: 'POST', headers: { Authorization: `Bearer ${server.token}`, Origin: 'https://example.com' } })).status, 403)
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: `Bearer ${server.token}` } } }))
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['fos_read', 'fos_search'])
    const result = await client.callTool({ name: 'fos_read', arguments: { path: [] } })
    assert.equal(JSON.parse(result.content[0].text).children[0].text, 'Implement button')
    assert.equal((await client.callTool({ name: 'fos_read', arguments: { path: ['outside'] } })).isError, true)
  } finally { await client.close(); server.close() }
})
