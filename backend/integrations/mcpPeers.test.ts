import type { Request, Response } from 'express'
import { addRow, addTask, addRefAt, applyProposalAt, proposeRefAt, capabilityTarget, content, headCid, memberHandlers, refArguments, resolveScope, setMemberCapabilitiesAt, valueContent, createReplica, view, type Replica } from '@fosforescent/shared/sync/index'
import { createMcpPeerHandlers, mcpMembersAbove, type McpPeerDeps, type McpServerInfo } from './mcpPeers'

function setup(servers: McpServerInfo[]) {
  let r: Replica = createReplica('server')
  r = addTask(r, [], 'research', 1, 'proj')
  r = addTask(r, ['proj'], 'weather for the trip', 2, 'trip')
  r = addRow(r, ['proj', 'trip'], 'requirement', 'Paris next week', 3, { id: 'rq', requirement: { capability: 'tool', tool: 'weather' } })
  r = addRow(r, ['proj', 'trip'], 'requirement', 'anything', 4, { id: 'rq2', requirement: { capability: 'tool', tool: 'weather' } })
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
  expect(view(replica(), ['proj'])!.tasks[0]!.blockedBy).toEqual(['tool weather']) // rq2 still open
  expect(saved.length).toBeGreaterThan(0)
  // the listener runs what is still open (rq2 explicitly requests weather too)
  const n = await h.runOpenToolRequests({ id: 1, username: 'ada' }, replica().store)
  expect(n).toBe(1)
  expect(calls.at(-1)).toEqual([5, 'weather', 'anything'])
  expect(view(replica(), ['proj'])!.tasks[0]!.blockedBy).toBeUndefined()
})

test('failed calls retain their binding, retries cannot silently switch to a nearer provider', async () => {
  const other = { ...weather, id: 6, name: 'Other weather' }
  const { deps, replica, saved } = setup([weather, other])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const invoked: number[] = []
  deps.callTool = async (server) => { invoked.push(server.id); throw new Error('offline') }
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(409)
  const firstSaves = saved.length
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(409)
  expect(saved.length).toBe(firstSaves) // no endless after-save retry loop
  await call(h.attach, { scope: ['proj', 'trip'], serverId: 6 })
  deps.callTool = async (server) => { invoked.push(server.id); return 'returned' }
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(200)
  expect(invoked).toEqual([5, 5, 5])
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(409)
  expect(invoked).toHaveLength(3)
  expect(view(replica(), ['proj', 'trip'])!.tasks[0]!.requirement!.satisfied).toBe(true)
})

test('an unavailable bound provider does not fall back and unsatisfied dependencies block calls', async () => {
  const { deps, replica, calls } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  let r = replica()
  r = addRow(r, ['proj', 'trip', 'rq'], 'requirement', 'Confirm', 20, { id: 'confirm', requirement: { capability: 'confirmation' } })
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).json.error).toMatch(/dependencies/)
  expect(calls).toHaveLength(0)
  // Use the second request to test a bound provider disappearing.
  deps.callTool = async () => { throw new Error('offline') }
  await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq2' })
  deps.servers = async () => [{ ...weather, id: 6 }]
  await call(h.attach, { scope: ['proj', 'trip'], serverId: 6 })
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq2' })).json.error).toMatch(/bound MCP handler is unavailable/)
})


test('an explicit handler ref is honored and the return ref addresses the result note', async () => {
  const other = { ...weather, id: 6, name: 'Other weather' }
  const { deps, replica, calls } = setup([weather, other])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  await call(h.attach, { scope: ['proj', 'trip'], serverId: 6 })
  let r = replica()
  const store = r.store, scope = ['proj', 'trip', 'rq']
  const ads = memberHandlers(store, content(store, resolveScope(store, headCid(r), ['proj'])!), 'mcp:5')
  expect(ads).toHaveLength(2)
  const handler = ads.find((cid) => valueContent(store, cid).data.description?.content === 'weather')!
  r = addRefAt(r, scope, 'selected-provider', capabilityTarget(store, 'tool'), 20)
  const proposal = proposeRefAt(r, [...scope, 'selected-provider'], handler, 'owner', 21)
  r = applyProposalAt(proposal.replica, [...scope, 'selected-provider'], proposal.proposalCid, 'owner', 22)
  // Editing grants must preserve handler refs, including template-backed ones.
  r = setMemberCapabilitiesAt(r, ['proj'], 'mcp:5', ['tool', 'read'], [], 23)
  expect(memberHandlers(store, content(store, resolveScope(store, headCid(r), ['proj'])!), 'mcp:5')).toEqual(ads)
  expect((await call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' })).status).toBe(200)
  expect(calls[0]![0]).toBe(5)
  r = replica()
  const request = valueContent(store, resolveScope(store, headCid(r), scope)!)
  expect(refArguments(store, request, capabilityTarget(store, 'tool'))[0]!.targetCid).toBe(handler)
  const returned = refArguments(store, request, store.primitive.documentField.getId())
  expect(returned).toHaveLength(1)
  expect(content(store, returned[0]!.targetCid!).data.description!.content).toBe('weather(Paris next week) = sunny')
})

test('manual and listener runs share the user lock and reload completed work', async () => {
  const { deps, replica, calls } = setup([weather])
  let tail: Promise<unknown> = Promise.resolve()
  deps.withUserLock = (_key, fn) => {
    const pending = tail.then(fn)
    tail = pending.catch(() => undefined)
    return pending
  }
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const [manual, listened] = await Promise.all([
    call(h.run, { scope: ['proj', 'trip'], requirementId: 'rq' }),
    h.runOpenToolRequests({ id: 1, username: 'ada' }, replica().store)
  ])
  expect([200, 409]).toContain(manual.status)
  expect(listened).toBe(manual.status === 200 ? 1 : 2)
  expect(calls).toEqual([[5, 'weather', 'Paris next week'], [5, 'weather', 'anything']])
})

test('multiple matching tools require a choice instead of silently choosing the first', async () => {
  const { deps, replica, calls } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  addRow(replica(), ['proj', 'trip'], 'requirement', 'choose a tool', 20, { id: 'ambiguous', requirement: { capability: 'tool' } })
  const result = await call(h.run, { scope: ['proj', 'trip'], requirementId: 'ambiguous' })
  expect(result.json.error).toMatch(/Choose a binding/)
  expect(calls).toEqual([])
})
