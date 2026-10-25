import type { Request, Response } from 'express'
import { evaluationRecord, discoverHandlers, setHandlerEnabledAt, addRequirement, argumentSupplier, requirementAnswer, addTask, createReplica, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createMcpPeerHandlers, mcpMembersAbove, mcpToolHandler, type McpPeerDeps, type McpServerInfo } from './mcpPeers'
import { createEventService } from '../sync/events'
import { createEvaluationService } from '../sync/evaluation'
import { createHostRuntime } from '../sync/host-runtime'
import { withUserLock } from '../sync/accountStore'
import { addRefCall } from '@fosforescent/shared/sync/index'

function setup(servers: McpServerInfo[]) {
  let r: Replica = createReplica('server')
  r = addTask(r, [], 'research', 1, 'proj')
  r = addTask(r, ['proj'], 'weather for the trip', 2, 'trip')
  r = addRequirement(r, ['proj', 'trip'], 'Paris next week', 3, { capability: 'tool', inputs: { tool: 'weather' } }, 'rq')
  r = addRequirement(r, ['proj', 'trip'], 'anything', 4, { capability: 'tool', inputs: { tool: 'weather' } }, 'rq2')
  const calls: Array<[number, string, string]> = []
  const saved: string[] = []
  const deps: McpPeerDeps = {
    loadStore: async (username) => ({ user: { id: 1, username }, store: r.store }),
    saveStore: async (user) => { saved.push(user.username) },
    withUserLock,
    usernameOf: async (id) => (id === 1 ? 'ada' : null),
    userId: async (req) => (req as unknown as { userId: number }).userId,
    servers: async () => servers,
    callTool: async (server, tool, input) => { calls.push([server.id, tool, input]); return `${tool}(${input}) = sunny` },
    now: () => 10
  }
  // `-tool` requirements run as a primitive reached through a `complete` event (the web's Run on the requirement)
  const events = createEventService(deps, createEvaluationService(deps, createHostRuntime([mcpToolHandler(deps)])).runNode)
  const run = async (scope: string[], requirementId: string) => {
    let status = 200, json: any
    const res = { setHeader() {}, status(c: number) { status = c; return res }, json(v: unknown) { json = v; return res } } as unknown as Response
    const expected = (await events.handle(events.principalOf({ username: 'ada' }, scope), { kind: 'read', path: [requirementId] }) as { valueRevision: string }).valueRevision
    await events.http({ claims: { username: 'ada' }, body: { scope, event: { kind: 'complete', path: [requirementId], expected } } } as unknown as Request, res)
    return { status, json }
  }
  return { deps, calls, saved, run, replica: () => ({ store: r.store, meta: r.meta }) as Replica }
}

function call(handler: (req: Request, res: Response) => Promise<unknown>, body: unknown) {
  let status = 200
  let json: any
  const res = { status(c: number) { status = c; return res }, json(v: unknown) { json = v; return res } } as unknown as Response
  return handler({ userId: 1, body } as unknown as Request, res).then(() => ({ status, json }))
}

const weather: McpServerInfo = { id: 5, name: 'Weather MCP', endpoint: 'ws://x', credentials: {}, tools: [{ name: 'weather', description: null }, { name: 'forecast', description: null }] }

test('an MCP primitive ref executes as a row instruction without a capability-name requirement', async () => {
  const { deps, calls, replica, run } = setup([weather])
  await call(createMcpPeerHandlers(deps).attach, { scope: ['proj'], serverId: 5 })
  const offer = discoverHandlers(replica(), ['proj']).find(value => value.peerId === 'mcp:5' && value.label === 'forecast')!
  addRefCall(replica(), ['proj', 'trip'], offer.cid, 11, 'direct')
  expect(view(replica(), ['proj', 'trip'])!.tasks.find(row => row.id === 'direct')!.requirement).toBeUndefined()
  const result = await run(['proj', 'trip'], 'direct')
  expect(result.json.error).toBeUndefined()
  expect(result.status).toBe(200)
  expect(calls).toEqual([[5, 'forecast', 'forecast']])
  setHandlerEnabledAt(replica(), ['proj'], offer.peerId, offer.id, false, 12)
  addRefCall(replica(), ['proj', 'trip'], offer.cid, 13, 'disabled')
  expect((await run(['proj', 'trip'], 'disabled')).status).toBe(400)
  expect(calls).toHaveLength(1)
})

test('an MCP server attaches to a node as a member advertising tool; it is found from rows below', async () => {
  const { deps, replica } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  expect((await call(h.list, {})).json).toEqual({ peers: [{ id: 'mcp:5', serverId: 5, name: 'Weather MCP', tools: ['weather', 'forecast'] }] })
  expect((await call(h.attach, { scope: ['nope'], serverId: 5 })).status).toBe(404)
  expect((await call(h.attach, { scope: ['proj'], serverId: 9 })).status).toBe(404)
  const attached = await call(h.attach, { scope: ['proj'], serverId: 5 })
  expect(attached.json).toEqual({ ok: true, peerId: 'mcp:5', tools: ['weather', 'forecast'] })
  expect(view(replica(), ['proj'])!.members).toEqual([{ peerId: 'mcp:5', name: 'Weather MCP', capabilities: ['tool', 'read', 'edit'], accepts: ['tool'] }])
  expect(mcpMembersAbove(replica(), ['proj', 'trip'])).toEqual([{ serverId: 5, peerId: 'mcp:5' }])
  expect(mcpMembersAbove(replica(), [])).toEqual([])
})

test('completing a tool requirement calls the attached server; the result is the answer, supplied by the peer', async () => {
  const { deps, calls, saved, replica, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(400) // nothing attached yet: no active provider in this context
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const ran = await run(['proj', 'trip'], 'rq')
  expect(ran.status).toBe(200)
  expect(ran.json.evaluation.status).toBe('committed')
  expect(calls).toEqual([[5, 'weather', 'Paris next week']])
  const rq = view(replica(), ['proj', 'trip'])!.tasks.find((t) => t.id === 'rq')!
  expect(rq.requirement?.satisfied).toBe(true)
  expect(requirementAnswer(replica(), ['proj', 'trip', 'rq'])).toBe('weather(Paris next week) = sunny')
  expect(argumentSupplier(replica(), ['proj', 'trip', 'rq'])).toBe('mcp:5')
  expect(view(replica(), ['proj'])!.tasks.find((t) => t.id === 'trip')!.blockedBy).toEqual(['tool weather']) // rq2 still open
  expect(saved.length).toBeGreaterThan(0)
  // the listener runs what is still open (rq2 explicitly requests weather too)
  const n = await h.runOpenToolRequests({ id: 1, username: 'ada' }, replica().store)
  expect(n).toBe(1)
  expect(calls.at(-1)).toEqual([5, 'weather', 'anything'])
  expect(view(replica(), ['proj'])!.tasks.find((t) => t.id === 'trip')!.blockedBy).toBeUndefined()
})

test('a failing call rolls back and leaves the requirement open; the next run calls again, a filled one calls no more', async () => {
  const { deps, replica, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const invoked: number[] = []
  deps.callTool = async (server) => { invoked.push(server.id); throw new Error('offline') }
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/offline/)
  const scope = ['proj', 'trip', 'rq']
  expect(evaluationRecord(replica(), scope)?.status).toBe('rolled-back')
  expect(view(replica(), ['proj', 'trip'])!.tasks.find((t) => t.id === 'rq')!.requirement!.satisfied).toBe(false)
  deps.callTool = async (server) => { invoked.push(server.id); return 'returned' }
  expect((await run(['proj', 'trip'], 'rq')).json.evaluation.status).toBe('committed')
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(200) // already satisfied: nothing to call
  expect(invoked).toEqual([5, 5])
  expect(view(replica(), ['proj', 'trip'])!.tasks.find((t) => t.id === 'rq')!.requirement!.satisfied).toBe(true)
})

test('unsatisfied dependencies block calls', async () => {
  const { deps, replica, calls, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  addRequirement(replica(), ['proj', 'trip', 'rq'], 'Confirm', 20, { capability: 'confirmation' }, 'confirm')
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/unresolved dependencies|Unfulfilled confirmation/)
  expect(calls).toHaveLength(0)
})

test('manual and listener runs share the user lock and reload completed work', async () => {
  const { deps, replica, calls, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const [manual, listened] = await Promise.all([
    run(['proj', 'trip'], 'rq'),
    h.runOpenToolRequests({ id: 1, username: 'ada' }, replica().store)
  ])
  expect([200, 400]).toContain(manual.status)
  expect(listened).toBe(manual.status === 200 ? 1 : 2)
  expect(calls).toEqual([[5, 'weather', 'Paris next week'], [5, 'weather', 'anything']])
})

test('several of the account\'s servers offering the tool are refused instead of silently choosing one', async () => {
  const other = { ...weather, id: 6, name: 'Other weather' }
  const { deps, calls, run } = setup([weather, other])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/Several MCP servers offer weather/)
  expect(calls).toEqual([])
})
