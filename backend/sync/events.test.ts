import type { Request, Response } from 'express'
import { addRequirement, addRow, addTask, addMemberAt, instantiateTemplate, setTaskDone, applyProposalAt, createBranch, createReplica, removeMemberAt, setMemberCapabilitiesAt, selectBranch, view, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createEventService } from './events'
import { PLAIN_TYPE, TEMPLATE_TYPE } from '@fosforescent/shared/sync/library-types'
function setup() {
  let r = addTask(createReplica('owner'), [], 'Private sibling', 1, 'private')
  r = addTask(r, [], 'Project specification', 1, 'project')
  r = addTask(r, ['project'], 'UI details', 1, 'ui')
  r = addMemberAt(r, ['project'], 'agent', 'Coding agent', ['read', 'edit'], 2)
  let saves = 0, rejectSave = false
  const evaluate = jest.fn(async () => ({ status: 'committed' }))
  const handler = createEventService({ loadStore: async username => username === 'owner' ? { user: { id: 1, username }, store: r.store } : null, saveStore: async (_user, store) => { if (rejectSave) throw new Error('Save failed'); saves++; r = { ...r, store } }, now: () => 50 }, evaluate).mcp
  async function rpc(method: string, params?: unknown, extra: any = {}) {
    let status = 200, body: any
    const headers: Record<string, string> = {}
    const res = { setHeader(k: string, v: string) { headers[k] = v }, status(n: number) { status = n; return res }, json(v: unknown) { body = v; return res }, end(v?: unknown) { if (v !== undefined) body = v; return res } } as unknown as Response
    await handler({ method: 'POST', headers: {}, query: {}, claims: { username: 'owner', kind: 'peer', peerId: 'agent', scope: ['project'] }, body: { jsonrpc: '2.0', id: 0, method, params }, ...extra } as Request, res)
    return { status, body, headers }
  }
  const call = async (name: string, args: unknown = {}, extra?: any) => {
    const result = await rpc('tools/call', { name, arguments: args }, extra)
    return result.body?.result?.isError ? { error: result.body.result.content[0].text } : JSON.parse(result.body.result.content[0].text)
  }
  return { rpc, call, get: () => r, set: (value: Replica) => { r = value }, saves: () => saves, evaluate, failSave: (fail: boolean) => { rejectSave = fail } }
}

test('hosted await releases the account lock, sees new work, and stops after execute revocation', async () => {
  const s = setup()
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read', 'execute'], [], 3))
  const waiting = s.call('fos_await_task', { path: ['ui'], timeoutMs: 2000 })
  await new Promise(resolve => setTimeout(resolve, 25))
  expect((await s.call('fos_read')).title).toBe('Project specification')
  s.set(addTask(s.get(), ['project', 'ui'], 'New work', 4, 'new'))
  expect(await waiting).toMatchObject({ status: 'task', task: { path: ['ui', 'new'], title: 'New work' } })
  s.set(setTaskDone(s.get(), ['project', 'ui'], 'new', true, 5))
  const revoked = s.call('fos_await_task', { path: ['ui'], timeoutMs: 2000 })
  await new Promise(resolve => setTimeout(resolve, 25))
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read'], [], 6))
  expect((await revoked).error).toMatch(/execute/)
})
test('MCP initialization handles id zero, notifications and scoped navigation', async () => {
  const s = setup()
  expect((await s.rpc('initialize', {})).body).toMatchObject({ id: 0, result: { protocolVersion: '2025-03-26' } })
  expect((await s.rpc('notifications/initialized', {}, { body: { jsonrpc: '2.0', method: 'notifications/initialized' } })).status).toBe(202)
  const root = await s.call('fos_read')
  expect(root.title).toBe('Project specification')
  expect(root.children.map((t: any) => t.title)).toEqual(['UI details'])
  expect((await s.call('fos_read', { path: ['ui'] })).ancestors[0].title).toBe('Project specification')
  expect((await s.call('fos_read', { path: ['private'] })).error).toBeDefined()
  expect((await s.call('fos_read', { path: ['..'] })).error).toBeDefined()
  expect((await s.call('fos_search', { query: 'Private' })).matches).toEqual([])
  expect((await s.call('fos_read', {}, { query: { scope: '[]' } })).title).toBe('Project specification')
  expect(s.saves()).toBe(0)
})
test('revocation and per-child restrictions apply immediately, including search', async () => {
  const s = setup()
  s.set(addMemberAt(s.get(), ['project', 'ui'], 'agent', 'No access', [], 3))
  expect((await s.call('fos_read')).children).toEqual([])
  expect((await s.call('fos_read', { path: ['ui'] })).error).toMatch(/access/)
  expect((await s.call('fos_search', { query: 'UI' })).matches).toEqual([])
  s.set(removeMemberAt(s.get(), ['project'], 'agent', 4))
  // with nothing granted, the tools are not even offered to the credential
  expect((await s.call('fos_read')).error).toMatch(/read access|Tool unavailable/)
})
test('branch selection is scoped, validated, and does not change subsequent requests', async () => {
  const s = setup()
  let r = createBranch(s.get(), ['project', 'ui'], 'alternative', 3)
  r = addTask(r, ['project', 'ui'], 'Alternative detail', 4, 'detail')
  selectBranch(r.store, 'ui', 'main'); s.set(r)
  const branches = [{ path: ['ui'], name: 'alternative' }]
  expect((await s.call('fos_read', { path: ['ui'], branches })).children[0].title).toBe('Alternative detail')
  expect((await s.call('fos_read', { path: ['ui'] })).children).toEqual([])
  expect((await s.call('fos_read', { branches: [{ path: ['private'], name: 'alternative' }] })).error).toBeDefined()
  expect((await s.call('fos_read', { branches: [{ path: ['ui'], name: 'typo' }] })).error).toBeDefined()
})
test('agent edits are ordinary proposals, stale requests and duplicate names cannot overwrite work', async () => {
  const s = setup(), before = await s.call('fos_read')
  const args = { expected: before.revision, name: 'implementation', changes: [{ path: ['ui'], operation: 'rename', text: 'Detailed UI' }, { path: ['ui'], operation: 'add_note', text: 'Acceptance criteria' }] }
  const result = await s.call('fos_propose', args)
  expect(result.status).toBe('awaiting-review')
  expect(view(s.get(), ['project'])!.tasks[0]!.title).toBe('UI details')
  expect((await s.call('fos_propose', args)).error).toMatch(/changed/)
  const after = await s.call('fos_read')
  expect((await s.call('fos_propose', { ...args, expected: after.revision })).error).toMatch(/already exists/)
  expect(s.saves()).toBe(1)
  s.set(applyProposalAt(s.get(), ['project'], result.proposalId, 'owner', 60))
  expect(view(s.get(), ['project'])!.tasks[0]!.title).toBe('Detailed UI')
  expect(view(s.get(), ['project', 'ui'])!.tasks[0]!.title).toBe('Acceptance criteria')
})
test('read-only and revoked child edit grants cannot submit changes', async () => {
  const s = setup()
  s.set(addMemberAt(s.get(), ['project', 'ui'], 'agent', 'Viewer', ['read'], 3))
  let revision = (await s.call('fos_read')).revision
  expect((await s.call('fos_propose', { expected: revision, name: 'bad', changes: [{ path: ['ui'], operation: 'rename', text: 'Oops' }] })).error).toMatch(/cannot edit/)
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read'], [], 4))
  revision = (await s.call('fos_read')).revision
  expect((await s.call('fos_propose', { expected: revision, name: 'bad', changes: [{ path: [], operation: 'add_task', text: 'Oops' }] })).error).toMatch(/cannot propose|Tool unavailable/)
  expect(s.saves()).toBe(0)
})
test("a peer's evaluation becomes a request the owner's rules decide on; owner-only tools are absent for peers", async () => {
  const s = setup()
  expect((await s.rpc('tools/list')).body.result.tools.some((t: any) => t.name === 'fos_create_branch')).toBe(false)
  expect((await s.call('fos_create_branch', { path: [], expected: 'x', name: 'alt' })).error).toMatch(/unavailable/)
  const peerRow = await s.call('fos_read', { path: ['ui'] })
  expect((await s.call('fos_evaluate', { path: ['ui'], expected: peerRow.valueRevision })).error).toMatch(/accepts evaluation requests/)
  s.set(setMemberCapabilitiesAt(addMemberAt(s.get(), ['project'], 'owner-device', 'Laptop', [], 5), ['project'], 'owner-device', [], [], 5, ['request']))
  const requested = await s.call('fos_evaluate', { path: ['ui'], expected: (await s.call('fos_read', { path: ['ui'] })).valueRevision })
  expect(requested.status).toBe('requested')
  expect(view(s.get(), ['project'])!.proposals.some(p => p.peerId === 'agent' && p.name === requested.request)).toBe(true)
  expect((await s.call('fos_evaluate', { path: ['ui'], expected: (await s.call('fos_read', { path: ['ui'] })).valueRevision })).error).toMatch(/already requested/)
  expect(s.evaluate).not.toHaveBeenCalled()
  const owner = { claims: { username: 'owner' }, query: { scope: '["project"]' } }
  const row = await s.call('fos_read', { path: ['ui'] }, owner)
  await s.call('fos_evaluate', { path: ['ui'], expected: row.valueRevision }, owner)
  expect(s.evaluate).toHaveBeenCalledWith('owner', { path: ['project', 'ui'], branches: {}, expected: row.valueRevision })
  expect((await s.rpc('tools/list', {}, { claims: { username: 'owner' } })).status).toBe(400)
  expect((await s.rpc('tools/list', {}, { claims: {} })).status).toBe(401)
  expect((await s.rpc('tools/list', {}, { headers: { origin: 'https://evil.test' } })).status).toBe(403)
  expect((await s.rpc('tools/list', {}, { method: 'GET' })).status).toBe(405)
})
test('a proposal on a selected branch stays in that branch and concurrent stale writers fail', async () => {
  const s = setup()
  let r = createBranch(s.get(), ['project'], 'alternate', 3)
  r = addTask(r, ['project'], 'Branch-only task', 4, 'branch-task')
  selectBranch(r.store, 'project', 'main'); s.set(r)
  const branches = [{ path: [], name: 'alternate' }]
  const before = await s.call('fos_read', { branches })
  const args = { branches, expected: before.revision, name: 'branch-edit', changes: [{ path: ['branch-task'], operation: 'rename', text: 'Branch acceptance criteria' }] }
  const results = await Promise.all([s.call('fos_propose', args), s.call('fos_propose', args)])
  expect(results.filter(r => r.error)).toHaveLength(1)
  expect((await s.call('fos_read')).proposals).toEqual([])
  expect((await s.call('fos_read', { branches })).proposals).toHaveLength(1)
  expect((await s.call('fos_read', { path: ['branch-task'] })).error).toBeDefined()
  expect(s.saves()).toBe(1)
})
test('a rejected persistent save never reports successful proposal publication', async () => {
  const s = setup()
  const handler = createEventService({ loadStore: async () => ({ user: { id: 1, username: 'owner' }, store: s.get().store }), saveStore: async () => { throw new Error('Concurrent store update') } }).mcp
  const expected = (await s.call('fos_read')).revision
  let body: any
  const res = { setHeader() {}, status() { return res }, json(v: unknown) { body = v; return res } } as unknown as Response
  await handler({ method: 'POST', headers: {}, query: {}, claims: { username: 'owner', kind: 'peer', peerId: 'agent', scope: ['project'] }, body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fos_propose', arguments: { expected, name: 'update', changes: [{ path: [], operation: 'add_task', text: 'New specification' }] } } } } as unknown as Request, res)
  expect(body.result.isError).toBe(true)
})
test('child pagination and bounded search preserve paths without duplicating results', async () => {
  const s = setup()
  let r = s.get()
  for (let i = 0; i < 105; i++) r = addTask(r, ['project'], `Criterion ${i}`, 3, `criterion-${i}`)
  s.set(r)
  const first = await s.call('fos_read')
  const second = await s.call('fos_read', { offset: first.nextOffset })
  expect(first.children).toHaveLength(100)
  expect(second.children).toHaveLength(6)
  expect(second.nextOffset).toBeNull()
  const a = await s.call('fos_search', { query: 'Criterion' })
  const b = await s.call('fos_search', { query: 'Criterion', offset: a.nextOffset })
  expect(a.matches).toHaveLength(50)
  expect(b.matches).toHaveLength(50)
  expect(new Set([...a.matches, ...b.matches].map((m: any) => JSON.stringify(m.path))).size).toBe(100)
})

test('a peer granted execute lists the open work in its scope, its own first, and sees rows added after it attached', async () => {
  const s = setup()
  let r = setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['execute'], [], 3)
  r = addTask(r, ['project'], 'Write the tests', 4, 'tests')
  r = addTask(r, ['project'], 'Already shipped', 4, 'shipped')
  r = setTaskDone(r, ['project'], 'shipped', true, 5)
  r = addTask(r, ['project', 'shipped'], 'Hidden under done work', 5, 'under-done')
  r = addRequirement(r, ['project', 'ui'], 'Sign-off', 5, { capability: 'confirmation' }, 'signoff')
  r = addMemberAt(r, ['project', 'tests'], 'agent', 'Coding agent', ['execute'], 6)
  s.set(r)
  const tools = (await s.rpc('tools/list')).body.result.tools.map((t: any) => t.name)
  expect(tools).toEqual(expect.arrayContaining(['fos_outstanding', 'fos_read', 'fos_evaluate']))
  expect(tools).not.toContain('fos_propose')
  const work = await s.call('fos_outstanding')
  expect(work.revision).toBe((await s.call('fos_read')).revision)
  expect(work.items.map((i: any) => i.path)).toEqual([['tests'], ['ui'], ['ui', 'signoff']])
  expect(work.items[0]).toMatchObject({ title: 'Write the tests', assigned: true, done: false, parent: [] })
  expect(work.items[0].valueRevision).toEqual(expect.any(String))
  expect(work.items[1]).toMatchObject({ title: 'UI details', assigned: false, blockedBy: ['confirmation'] })
  expect(work.items[2]).toMatchObject({ requirement: 'confirmation', assigned: false })
  // a row added later (from a phone, say) is open work on the next call; nothing outside the attachment shows
  s.set(addTask(s.get(), ['project'], 'Added from the phone', 7, 'phone'))
  const again = await s.call('fos_outstanding')
  expect(again.items.map((i: any) => i.title)).toContain('Added from the phone')
  expect(again.items.map((i: any) => i.title)).not.toContain('Private sibling')
  // the row's type decides: a plain row and a template are not work, a task made from the template is
  let t = addRow(s.get(), ['project'], PLAIN_TYPE, 'Background reading', 8, { id: 'context' })
  t = addRow(t, ['project'], TEMPLATE_TYPE, 'Release checklist', 8, { id: 'tpl' })
  t = addTask(t, ['project', 'tpl'], 'Tag the release', 8, 'tag')
  t = addTask(t, ['project'], 'Release 1.0', 9, 'release')
  s.set(instantiateTemplate(t, ['project'], 'release', 'tpl', 9))
  const titles = (await s.call('fos_outstanding')).items.map((i: any) => i.title)
  expect(titles).toEqual(expect.arrayContaining(['Release 1.0']))
  expect(titles).not.toContain('Background reading')
  expect(titles).not.toContain('Release checklist')
  expect(titles.filter((title: string) => title === 'Tag the release')).toHaveLength(1)
  expect(s.saves()).toBe(0)
  // without execute the tool is not offered
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read'], [], 8))
  expect((await s.rpc('tools/list')).body.result.tools.map((t: any) => t.name)).not.toContain('fos_outstanding')
  expect((await s.call('fos_outstanding')).error).toMatch(/unavailable/)
})


test('hosted sessions race for exclusive claims and emit tool-list changes; failed durable submissions retain ownership', async () => {
  const s = setup()
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read', 'edit', 'execute'], [], 3))
  const sessions = await Promise.all([s.rpc('initialize'), s.rpc('initialize')])
  const a = sessions[0].headers['Mcp-Session-Id'], b = sessions[1].headers['Mcp-Session-Id']
  expect(a).toBeTruthy(); expect(b).not.toBe(a)
  expect(sessions[0].body.result.capabilities.tools.listChanged).toBe(true)
  const connection = (id: string, events = false) => ({ headers: { 'mcp-session-id': id, ...(events ? { accept: 'application/json, text/event-stream' } : {}) } })
  const read = await s.call('fos_read', { path: ['ui'] }, connection(a))
  const args = { path: ['ui'], expected: read.revision }
  const results = await Promise.all([s.call('fos_claim_task', args, connection(a)), s.call('fos_claim_task', args, connection(b))])
  expect(results.filter(r => r.status === 'claimed')).toHaveLength(1)
  expect(results.filter(r => /already claimed/.test(r.error))).toHaveLength(1)
  const winner = results[0].status === 'claimed' ? a : b
  const claimId = results.find(r => r.claim)?.claim.id
  const tools = (await s.rpc('tools/list', {}, connection(winner))).body.result.tools.map((t: any) => t.name)
  expect(tools).toContain('fos_task_submit'); expect(tools).not.toContain('fos_propose')
  const task = await s.call('fos_task_read', { claimId }, connection(winner))
  s.failSave(true)
  const submission = { claimId, expected: task.revision, changes: [{ path: [], operation: 'add_note', text: 'Done and tested' }] }
  expect((await s.call('fos_task_submit', submission, connection(winner))).error).toBe('Save failed')
  s.failSave(false)
  expect((await s.call('fos_task_status', {}, connection(winner))).claim.id).toBe(claimId)
  expect((await s.call('fos_task_read', { claimId }, connection(winner))).revision).toBe(task.revision)
  const response = await s.rpc('tools/call', { name: 'fos_task_submit', arguments: submission }, connection(winner, true))
  expect(response.headers['Content-Type']).toBe('text/event-stream')
  const messages = response.body.split('\n').filter((line: string) => line.startsWith('data: ')).map((line: string) => JSON.parse(line.slice(6)))
  expect(messages[0].method).toBe('notifications/tools/list_changed')
  expect(JSON.parse(messages[1].result.content[0].text).releasedClaimId).toBe(claimId)
  expect((await s.rpc('tools/list', {}, connection(winner))).body.result.tools.some((t: any) => t.name === 'fos_claim_task')).toBe(true)
  expect((await s.rpc('tools/list', {}, connection('invented'))).status).toBe(404)
})
