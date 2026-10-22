import { settingOf } from '@fosforescent/shared/sync/index'
import type { Request, Response } from 'express'
import { evaluationRecord, formTitle, recoverEvaluation, setTaskDone, discoverHandlers, setHandlerEnabledAt, addRow, addTask, addRefAt, applyProposalAt, proposeRefAt, capabilityTarget, content, headCid, memberHandlers, refArguments, resolveScope, setMemberCapabilitiesAt, valueContent, createReplica, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createMcpPeerHandlers, mcpMembersAbove, mcpToolHandler, type McpPeerDeps, type McpServerInfo } from './mcpPeers'
import { createEventService } from '../sync/events'
import { createEvaluationService } from '../sync/evaluation'
import { createHostRuntime } from '../sync/host-runtime'
import { withUserLock } from '../sync/accountStore'
import { ALLOCATION_TYPE } from '@fosforescent/shared/sync/library-types'
import { NOTE_TYPE } from '@fosforescent/shared/sync/library-types'
import { addRefCall } from '@fosforescent/shared/sync/index'

function setup(servers: McpServerInfo[]) {
  let r: Replica = createReplica('server')
  r = addTask(r, [], 'research', 1, 'proj')
  r = addTask(r, ['proj'], 'weather for the trip', 2, 'trip')
  r = addRow(r, ['proj', 'trip'], ALLOCATION_TYPE, 'Paris next week', 3, { id: 'rq', requirement: { capability: 'tool', tool: 'weather' } })
  r = addRow(r, ['proj', 'trip'], ALLOCATION_TYPE, 'anything', 4, { id: 'rq2', requirement: { capability: 'tool', tool: 'weather' } })
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
  // `-tool` requirements run as a runtime effect reached through a `complete` event (the web's Run on the requirement)
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
  const offer = discoverHandlers(replica(), ['proj']).find(value => value.id === 'mcp:5/forecast')!
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

test('completing a tool requirement calls the attached server and records the answer as a note plus a supply', async () => {
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
  expect(view(replica(), ['proj', 'trip', 'rq'])!.tasks.filter(t => t.type === NOTE_TYPE || t.supply).map((t) => [t.type, !!t.supply, t.title])).toEqual([[NOTE_TYPE, false, 'weather(Paris next week) = sunny'], [ALLOCATION_TYPE, true, 'run by mcp:5']])
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
  const { deps, replica, saved, run } = setup([weather, other])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const invoked: number[] = []
  deps.callTool = async (server) => { invoked.push(server.id); throw new Error('offline') }
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(400)
  const firstSaves = saved.length
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/needs recovery/)
  expect(saved.length).toBe(firstSaves) // a failed run is not retried by itself
  await call(h.attach, { scope: ['proj', 'trip'], serverId: 6 })
  deps.callTool = async (server) => { invoked.push(server.id); return 'returned' }
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/needs recovery/)
  expect(invoked).toEqual([5])
  let recovered = replica()
  const scope = ['proj', 'trip', 'rq']
  expect(evaluationRecord(recovered, scope)?.status).toBe('needs-recovery')
  // the journal names the rows asking for a manual rollback
  for (const task of evaluationRecord(recovered, scope)!.effects.flatMap(e => e.task ? [e.task] : [])) recovered = setTaskDone(recovered, scope, task, true, 20)
  recoverEvaluation(recovered, scope, 21)
  expect((await run(['proj', 'trip'], 'rq')).json.evaluation.status).toBe('committed')
  expect(invoked).toEqual([5, 5]) // the pinned provider, not the nearer one attached later
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(200) // already satisfied: nothing to call
  expect(invoked).toHaveLength(2)
  expect(view(replica(), ['proj', 'trip'])!.tasks[0]!.requirement!.satisfied).toBe(true)
})

test('an unavailable bound provider does not fall back and unsatisfied dependencies block calls', async () => {
  const { deps, replica, calls, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  let r = replica()
  r = addRow(r, ['proj', 'trip', 'rq'], ALLOCATION_TYPE, 'Confirm', 20, { id: 'confirm', requirement: { capability: 'confirmation' } })
  expect((await run(['proj', 'trip'], 'rq')).json.error).toMatch(/unresolved dependencies|Unfulfilled confirmation/)
  expect(calls).toHaveLength(0)
  // Use the second request to test a bound provider disappearing.
  deps.callTool = async () => { throw new Error('offline') }
  await run(['proj', 'trip'], 'rq2')
  deps.servers = async () => [{ ...weather, id: 6 }]
  await call(h.attach, { scope: ['proj', 'trip'], serverId: 6 })
  expect((await run(['proj', 'trip'], 'rq2')).json.error).toMatch(/needs recovery/)
})

test('an explicit handler ref is honored and the return ref addresses the result note', async () => {
  const other = { ...weather, id: 6, name: 'Other weather' }
  const { deps, replica, calls, run } = setup([weather, other])
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
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(200)
  expect(calls[0]![0]).toBe(5)
  r = replica()
  const request = valueContent(store, resolveScope(store, headCid(r), scope)!)
  expect(refArguments(store, request, capabilityTarget(store, 'tool'))[0]!.targetCid).toBe(handler)
  const returned = refArguments(store, request, store.primitive.documentField.getId()).filter(a => !settingOf(store, content(store, a.cid)))
  expect(returned).toHaveLength(1)
  expect(formTitle(store, valueContent(store, returned[0]!.targetCid!))).toBe('weather(Paris next week) = sunny')
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

test('multiple matching tools require a choice instead of silently choosing the first', async () => {
  const { deps, replica, calls, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  addRow(replica(), ['proj', 'trip'], ALLOCATION_TYPE, 'choose a tool', 20, { id: 'ambiguous', requirement: { capability: 'tool' } })
  const result = await run(['proj', 'trip'], 'ambiguous')
  expect(result.json.error).toMatch(/Choose a binding/)
  expect(calls).toEqual([])
})

test('disabling one advertised tool cannot fall back to the primitive marker while another remains enabled', async () => {
  const { deps, calls, replica, run } = setup([weather])
  const h = createMcpPeerHandlers(deps)
  await call(h.attach, { scope: ['proj'], serverId: 5 })
  const offer = discoverHandlers(replica(), ['proj']).find(o => valueContent(replica().store, o.cid).data.description?.content === 'weather')!
  setHandlerEnabledAt(replica(), ['proj'], 'mcp:5', offer.id, false, 3)
  expect(mcpMembersAbove(replica(), ['proj'])).toHaveLength(1)
  expect((await run(['proj', 'trip'], 'rq')).status).toBe(400)
  expect(calls).toEqual([])
})
