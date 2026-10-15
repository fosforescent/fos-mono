import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

// A projection of the selected subtree, not a second graph store. Paths never address the host filesystem.
export function contextTools(tree) {
  if (!tree || !Array.isArray(tree.nodes) || tree.nodes.length > 5000) throw new Error('Invalid task context')
  const nodes = new Map()
  for (const node of tree.nodes) {
    if (!Array.isArray(node.path) || node.path.length > 64 || node.path.some(p => typeof p !== 'string' || !p || p === '..') || typeof node.text !== 'string') throw new Error('Invalid task path')
    const key = JSON.stringify(node.path)
    if (nodes.has(key)) throw new Error('Duplicate task path')
    nodes.set(key, node)
  }
  for (const node of nodes.values()) if (node.path.length && !nodes.has(JSON.stringify(node.path.slice(0, -1)))) throw new Error('Missing task parent')
  if (!nodes.has('[]')) throw new Error('Missing task root')
  const read = (path = []) => {
    const node = nodes.get(JSON.stringify(path))
    if (!node) throw new Error('Task outside the attached subtree or unavailable')
    const children = [...nodes.values()].filter(n => n.path.length === path.length + 1 && path.every((p,i) => n.path[i] === p))
    return { ...node, children: children.map(n => ({ path: n.path, text: n.text, kind: n.kind })), snapshot: true }
  }
  return { read, search: query => [...nodes.values()].filter(n => n.text.toLowerCase().includes(query.toLowerCase())).slice(0,100) }
}
export async function serveContext(tree) {
  const tools = contextTools(tree), token = randomBytes(32).toString('hex')
  const http = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}` || req.headers.origin || req.url !== '/mcp') { res.writeHead(403).end(); return }
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    const server = new McpServer({ name: 'fos-task', version: '1.0.0' }, { instructions: 'Start with fos_read at path []. Navigate children by their path arrays. This is the selected Fos subtree at launch; outside nodes and other branches are unavailable.' })
    const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })
    server.registerTool('fos_read', { description: 'Read a task and its immediate children within the attached subtree.', annotations: { readOnlyHint: true }, inputSchema: { path: z.array(z.string()).max(64).optional() } }, ({ path }) => result(tools.read(path)))
    server.registerTool('fos_search', { description: 'Search within this task subtree.', annotations: { readOnlyHint: true }, inputSchema: { query: z.string().min(1).max(200) } }, ({ query }) => result(tools.search(query)))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    try {
      await server.connect(transport)
      res.on('close', () => { void transport.close(); void server.close() })
      await transport.handleRequest(req, res)
    } catch { if (!res.headersSent) res.writeHead(500); res.end() }
  })
  await new Promise((resolve,reject) => { http.once('error',reject); http.listen(0, '127.0.0.1', resolve) })
  return { url: `http://127.0.0.1:${http.address().port}/mcp`, token, close: () => { http.closeAllConnections(); http.close() } }
}
