import { userView } from './test-helpers'
import { proposeRefAt, applyProposalAt, argumentRefs, renameTask, setRowContentAt, capabilityTarget, addMemberAt, addRefAt, addRow, addTask, addSubtasksTemplate, beginTaskWork, content, contextBindings, createReplica, decideTaskResult, headCid, instantiateTemplate, proposeTaskResult, put, refNodeContent, resolveBinding, resolveScope, resolveText, taskWorkContext, view, workAttempts, workHandler } from './index'
import { PLAIN_TYPE, NOTE_TYPE, ALLOCATION_TYPE, TEMPLATE_TYPE } from './library-types'

const literal = (r: ReturnType<typeof createReplica>, text: string) => put(r.store, { data: { description: { content: text } }, children: [] })

test('data and handlers use the same recursively resolved arguments; missing dependencies and cycles stay blocked', () => {
  const r = createReplica(), s = r.store, text = s.primitive.documentField.getId(), callable = s.primitive.llmCapability.getId()
  const value = literal(r, 'context')
  const arg = put(s, refNodeContent(s, { alias: { id: 'input' }, name: { content: 'mytext' } }, null, [], text))
  const body = put(s, { data: {}, children: [[text, arg]] })
  const handler = put(s, refNodeContent(s, {}, body, [], callable))
  expect(resolveBinding(s, callable, handler).status).toBe('missing')
  expect(resolveBinding(s, callable, handler, [{ cid: value, type: text, name: 'mytext' }]).status).toBe('ready')
  expect(resolveBinding(s, text, handler).status).toBe('conflict')
  const ungrounded = put(s, refNodeContent(s, { alias: { id: 'a' } }, null, [], text))
  const other = put(s, refNodeContent(s, { alias: { id: 'b' } }, ungrounded, [], text))
  expect(resolveBinding(s, text, ungrounded, [{ cid: other, type: text }]).status).toBe('cycle')
})

test('explicit bindings stay pinned and multiple providers are a choice', () => {
  const r = createReplica(), type = r.store.primitive.llmCapability.getId()
  const a = literal(r, 'a'), b = literal(r, 'b'), candidates = [a,b].map(cid => ({ cid, type }))
  expect(resolveBinding(r.store, type, null, candidates).status).toBe('ambiguous')
  expect(resolveBinding(r.store, type, a, candidates).cid).toBe(a)
  expect(resolveBinding(r.store, type, 'missing', candidates).status).toBe('missing')
})

test('named text arguments substitute through templates; duplicate assertions report both sources', () => {
  let r = createReplica(); const type = r.store.primitive.documentField.getId()
  r = addRow(r, [], TEMPLATE_TYPE, 'Letter', 1, { id: 'template' })
  r = addRefAt(r, ['template'], 'arg', type, 2, literal(r, 'Ada'), 'mytext')
  r = addTask(r, [], 'Letter to Ada', 3, 'instance')
  r = instantiateTemplate(r, [], 'instance', 'template', 4)
  expect(resolveText(r, ['instance'], 'Hello {{mytext}}').text).toBe('Hello Ada')
  const first = contextBindings(r, ['instance'])[0]!.cid
  r = addRefAt(r, ['instance'], 'other', type, 5, literal(r, 'Grace'), 'mytext')
  const result = resolveText(r, ['instance'], 'Hello {{mytext}}')
  expect(result.text).toBe('Hello {{mytext}}')
  expect(result.bindings[0]!.status).toBe('conflict')
  expect(result.bindings[0]!.sources).toEqual(expect.arrayContaining([first, resolveScope(r.store, headCid(r), ['instance','other'])!]))
})

test('generate subtasks derives readiness from the LLM dependency and creates rows only on approval', () => {
  let r = addTask(createReplica('owner'), [], 'Build rental app', 1, 'project')
  const added = addSubtasksTemplate(r, ['project'], 2); r = added.replica
  const path = ['project', added.requestId]
  expect(workHandler(r, path).status).toBe('missing')
  r = addMemberAt(r, [], 'fos', 'fos', ['llm'], 3)
  expect(workHandler(r, path).status).toBe('ready')
  const preview = taskWorkContext(r, path)
  expect(preview.blockers).toEqual([])
  const run = beginTaskWork(r, path, preview, 4)
  r = proposeTaskResult(run.replica, run.resultPath, '- [ ] Define inventory schema\n- [ ] Test overlapping bookings', 5)
  expect(view(r, ['project'])!.tasks.filter(row => row.checkable)).toHaveLength(0)
  r = decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 6)
  expect(view(r, ['project'])!.tasks.filter(row => row.checkable).map(row => row.title)).toEqual(['Define inventory schema','Test overlapping bookings'])
})

test('legacy note variables and frontmatter use the shared resolver without changing precedence', () => {
  let r = addRow(createReplica(), [], NOTE_TYPE, '---\nmytext: default\n---\nHello {{mytext}}', 1, { id: 'note' })
  r = addRow(r, ['note'], PLAIN_TYPE, 'mytext: child', 2, { id: 'child' })
  expect(resolveText(r, ['note'], 'Hello {{mytext}}').text).toBe('Hello child')
  r = addRow(r, ['note'], PLAIN_TYPE, 'mytext: incompatible', 3, { id: 'other' })
  expect(resolveText(r, ['note'], '{{mytext}}').bindings[0]!.status).toBe('conflict')
})

test('handler requirements participate in readiness without executing anything', () => {
  let r = addRow(createReplica(), [], PLAIN_TYPE, 'handler', 1, { id: 'handler' })
  r = addRow(r, ['handler'], ALLOCATION_TYPE, 'Approve first', 2, { id: 'approval', requirement: { capability: 'confirmation' } })
  const handler = resolveScope(r.store, headCid(r), ['handler'])!
  expect(resolveBinding(r.store, r.store.primitive.llmCapability.getId(), handler).status).toBe('missing')
})

test('a disabled or removed Fos binding cannot enable a previously available action', () => {
  let r = addTask(createReplica(), [], 'Task', 1, 'task')
  r = addMemberAt(r, [], 'fos', 'fos', ['llm'], 2)
  expect(workHandler(r, ['task']).status).toBe('ready')
  r = addMemberAt(r, ['task'], 'fos', 'fos', [], 3)
  expect(workHandler(r, ['task']).status).toBe('missing')
})

test('offline peers cannot satisfy explicit or transitive handler dependencies', () => {
  const r = createReplica('device'), store = r.store
  const type = capabilityTarget(store, 'llm')
  const peer = put(store, { data: { peerId: { content: 'fos' }, description: { content: 'llm' } }, children: [] })
  const bound = put(store, refNodeContent(store, { alias: { id: 'handler' } }, peer, [], type))
  expect(resolveBinding(store, type, bound, [], undefined, { isPeerActive: () => false }).status).toBe('missing')
  expect(resolveBinding(store, type, bound, [], undefined, { isPeerActive: () => true }).status).toBe('ready')
  const higherOrder = put(store, { data: {}, children: [[type, bound]] })
  expect(resolveBinding(store, store.primitive.documentField.getId(), higherOrder, [], undefined, { isPeerActive: () => false }).status).toBe('missing')
})

test('disabling an offered handler removes availability without removing its configuration', async () => {
  const { capabilityPeers, setMemberCapabilitiesAt } = await import('./index')
  let r = addMemberAt(createReplica('device'), [], 'integration:github', 'GitHub', [], 1)
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], [], 2, ['repo'])
  expect(capabilityPeers(r, [], 'repo')).toEqual(['integration:github'])
  r = setMemberCapabilitiesAt(r, [], 'integration:github', [], ['repo'], 3, ['repo'])
  expect(capabilityPeers(r, [], 'repo')).toEqual([])
  expect(userView(r)!.members[0]!.accepts).toContain('repo')
})

test('editing memberships preserves typed handlers in their original direction', async () => {
  const { withMember, memberHandlers } = await import('./index')
  const r = createReplica(), store = r.store, type = capabilityTarget(store, 'llm')
  const to = put(store, refNodeContent(store, { alias: { id: 'to' } }, literal(r, 'to'), [], type))
  const from = put(store, refNodeContent(store, { alias: { id: 'from' } }, literal(r, 'from'), [], type))
  const member = put(store, { data: { peerId: { content: 'peer' } }, children: [[store.primitive.capabilityNode.getId(), to], [store.primitive.acceptsNode.getId(), from]] })
  const updated = withMember(store, { data: {}, children: [[store.primitive.memberField.getId(), member]] }, 'peer', 'Peer', ['llm'], [], ['llm'])
  expect(memberHandlers(store, updated, 'peer', store.primitive.capabilityNode.getId())).toEqual([to])
  expect(memberHandlers(store, updated, 'peer', store.primitive.acceptsNode.getId())).toEqual([from])
})


test('single-brace parameters create stable mutable-ref children through all text edit paths', () => {
  let r = addRow(createReplica('params'), [], TEMPLATE_TYPE, 'Letter {customer} {customer} {{legacy}} \\{literal}', 1, { id: 'letter' })
  const args = () => argumentRefs(r.store, resolveScope(r.store, headCid(r), ['letter'])!)
  expect(args().map(a => a.name)).toEqual(['customer'])
  const original = args()[0]!
  expect(original.type).toBe(r.store.primitive.documentField.getId())
  expect(resolveText(r, ['letter'], 'Hello {customer}').bindings[0]!.status).toBe('missing')
  r = renameTask(r, [], 'letter', 'Letter {customer} to {recipient}', 2)
  expect(args().map(a => a.name)).toEqual(['customer', 'recipient'])
  expect(args()[0]!.cid).toBe(original.cid)
  const path = ['letter', content(r.store, original.cid).data.alias!.id]
  const proposed = proposeRefAt(r, path, literal(r, 'Ada'), r.meta.peerId, 3)
  r = applyProposalAt(proposed.replica, path, proposed.proposalCid, r.meta.peerId, 3)
  expect(resolveText(r, ['letter'], 'Hello {customer}').text).toBe('Hello Ada')
  r = setRowContentAt(r, [], 'letter', TEMPLATE_TYPE, 'Only {recipient}', {}, 4)
  expect(args().map(a => a.name)).toEqual(['customer', 'recipient'])
  expect(resolveText(r, ['letter'], 'Hello {customer}').text).toBe('Hello Ada')
  const bound = addRefAt(createReplica(), [], 'named', r.store.primitive.documentField.getId(), 4, null, 'name')
  expect(argumentRefs(bound.store, headCid(bound))[0]!.name).toBe('name')
})
