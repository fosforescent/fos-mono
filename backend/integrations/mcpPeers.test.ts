import type { Request, Response } from 'express'
import { addRow, addTask, createReplica, view, type Replica } from '@fosforescent/shared/sync/index'
import { createMcpPeerHandlers, mcpMembersAbove, type McpPeerDeps, type McpServerInfo } from './mcpPeers'

function setup(servers: McpServerInfo[]) {
  let r: Replica = createReplica('server')
  r = addTask(r, [], 'research', 1, 'proj')
  r = addTask(r, ['proj'], 'weather for the trip', 2, 'trip')
  r = addRow(r, ['proj', 'trip'], 'requirement', 'Paris next week', 3, { id: 'rq', requirement: { capability: 'tool', tool: 'weather' } })
  r = addRow(r, ['proj', 'trip'], 'requirement', 'anything', 4, { id: 'rq2', requirement: { capability: 'tool' } })
  const calls: Array<[number, string, string]> = []
  const saved: string[] = []
  const deps: McpPeerDeps = {
    loadStore: async (username) => ({ user: { id: 1, username }, store: r.store }),
    saveStore: async (user) => { saved.push(user.username) },
    withUserLock: (_k, fn) => fn(),
    usernameOf: async (id) => (id === 1 ? 'ada' : null),
    userId: async (req) => (req as unknown as { userId: number }).userId,
    servers: async () => servers,
    callTool: async (server, tool, input) => { calls.push([server.id, tool, input]); return `${tool}(${input}) = sunny` },
    now: () => 10
  }
  return { deps, calls, saved, replica: () => ({ store: r.store, meta: r.meta }) as Replica }
}

function call(handler: (req: Request, res: Response) => Promise<unknown>, body: unknown) {
  let status = 200
  let json: any
  const res = { status(c: number) { status = c; return res }, json(v: unknown) { json = v; return res } } as unknown as Response
  return handler({ userId: 1, body } as unknown as Request, res).then(() => ({ status, json }))
}

const weather: McpServerInfo = { id: 5, name: 'Weather MCP', endpoint: 'ws://x', credentials: {}, tools: [{ name: 'weather', description: null }, { name: 'forecast', description: null }] }

test('an MCP server attaches to a node as a member advertising tool; it is found from rows below', async () => {
  const { deps, replica } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  expect((await call(h.list, {})).json).toEqual({ peers: [{ id: 'mcp:5', serverId: 5, name: 'Weather MCP', tools: ['weather', 'forecast'] }] })
  expect((await call(h.attach, { scope: ['nope'], serverId: 5 })).status).toBe(404)
  expect((await call(h.attach, { scope: ['proj'], serverId: 9 })).status).toBe(404)
  const attached = await call(h.attach, { scope: ['proj'], serverId: 5 })
  expect(attached.json).toEqual({ ok: true, peerId: 'mcp:5', tools: ['weather', 'forecast'] })
  expect(view(replica(), ['proj'])!.members).toEqual([{ peerId: 'mcp:5', name: 'Weather MCP', capabilities: ['tool', 'read', 'edit'] }])
  expect(mcpMembersAbove(replica(), ['proj', 'trip'])).toEqual([{ serverId: 5, peerId: 'mcp:5' }])
  expect(mcpMembersAbove(replica(), [])).toEqual([])
})

test('running a tool requirement calls the attached server and records the answer as a note plus a supply', async () => {
  const { deps, calls, saved, replica } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(409) // nothing attached yet
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const ran = await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })
  expect(ran.json).toEqual({ text: 'weather(Paris next week) = sunny' })
  expect(calls).toEqual([[5, 'weather', 'Paris next week']])
  const rq = view(replica(), ['proj', 'trip'])!.tasks.find((t) => t.id === 'rq')!
  expect(rq.requirement?.satisfied).toBe(true)
  expect(view(replica(), ['proj', 'trip', 'rq'])!.tasks.map((t) => [t.kind, t.title])).toEqual([['note', 'weather(Paris next week) = sunny'], ['supply', 'run by mcp:5']])
  expect(view(replica(), ['proj'])!.tasks[0]!.blockedBy).toEqual(['tool']) // rq2 still open
  expect(saved.length).toBeGreaterThan(0)
  // the listener runs what is still open (rq2 has no tool named: the server's first tool)
  const n = await h.runOpenToolRequests({ id: 1, username: 'ada' }, replica().store)
  expect(n).toBe(1)
  expect(calls.at(-1)).toEqual([5, 'weather', 'anything'])
  expect(view(replica(), ['proj'])!.tasks[0]!.blockedBy).toBeUndefined()
})
