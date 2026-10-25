import { createStore } from './graph'
import { primitive } from './primitives'
import { valueOfPattern } from './structural'
import { userView, installTestHandler } from './test-helpers'
import { setHandlerEnabledAt, discoverHandlers, setMemberCapabilitiesAt, proposeRefAt, applyProposalAt, argumentRefs, renameTask, setRowContentAt, libAt, addMemberAt, addRefAt, addRow, addTask, addSubtasksTemplate, beginTaskWork, content, contextBindings, createReplica, decideTaskResult, headCid, instantiateTemplate, proposeTaskResult, put, refNodeContent, resolveBinding, resolveScope, resolveText, taskWorkContext, view, workAttempts, workHandler, nestScope, textValue } from './index'
import { FosStore } from '../dag-implementation/store'
import { PLAIN_TYPE, NOTE_TYPE, TEMPLATE_TYPE } from './library-types'
import { addRequirement } from './arguments'

const literal = (r: ReturnType<typeof createReplica>, text: string) => textValue(r.store, text)

test('data and handlers use the same recursively resolved arguments; missing dependencies and cycles stay blocked', () => {
  const r = createReplica(), s = r.store, text = primitive(s, 'string'), callable = put(s, { data: {}, children: [] })
  const value = literal(r, 'context')
  const arg = put(s, refNodeContent(s, { alias: { id: 'input' }, name: { content: 'mytext' } }, null, []))
  const body = put(s, { data: {}, children: [[text, arg]] })
  const handler = put(s, refNodeContent(s, {}, body, []))
  expect(resolveBinding(s, callable, handler).status).toBe('missing')
  expect(resolveBinding(s, callable, handler, [{ cid: value, type: text, name: 'mytext' }]).status).toBe('ready')
  expect(resolveBinding(s, text, handler).status).toBe('conflict')
  const ungrounded = put(s, refNodeContent(s, { alias: { id: 'a' } }, null, []))
  const other = put(s, refNodeContent(s, { alias: { id: 'b' } }, ungrounded, []))
  expect(resolveBinding(s, callable, ungrounded, [{ cid: other, type: callable }]).status).toBe('cycle')
})

test('explicit bindings stay pinned and multiple providers are a choice', () => {
  const r = createReplica(), type = primitive(r.store, 'string')
  const a = literal(r, 'a'), b = literal(r, 'b'), candidates = [a,b].map(cid => ({ cid, type }))
  expect(resolveBinding(r.store, type, null, candidates).status).toBe('ambiguous')
  expect(resolveBinding(r.store, type, a, candidates).cid).toBe(a)
  expect(resolveBinding(r.store, type, 'missing', candidates).status).toBe('missing')
})

test('following a binding uses its declaration scope, not a caller override', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'outer-value', type, 1, literal(r, 'Outer'), 'value')
  const expression = put(r.store, { data: { refExpression: { up: 0, path: ['value'], lexical: true } }, children: [] })
  r = addRefAt(r, [], 'source', type, 2, expression, 'source')
  r = addTask(r, [], 'Child', 3, 'child')
  r = addRefAt(r, ['child'], 'inner-value', type, 4, literal(r, 'Inner'), 'value')
  expect(resolveText(r, ['child'], '{source} / {value}').text).toBe('Outer / Inner')
  const nested = createReplica()
  nestScope(nested.store, { store: r.store, root: headCid(r), at: ['child'] })
  expect(resolveText(nested, [], '{source} / {value}').text).toBe('Outer / Inner')
})

test('named text arguments substitute through templates; duplicate assertions report both sources', () => {
  let r = createReplica(); const type = primitive(r.store, 'string')
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
  r = installTestHandler(r, 'fos', 'llm')
  expect(workHandler(r, path).status).toBe('ready')
  const preview = taskWorkContext(r, path)
  expect(preview.blockers).toEqual([])
  const run = beginTaskWork(r, path, preview, 4)
  r = proposeTaskResult(run.replica, run.resultPath, '- [ ] Define inventory schema\n- [ ] Test overlapping bookings', 5)
  expect(view(r, ['project'])!.tasks.filter(row => row.checkable)).toHaveLength(0)
  r = decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 6)
  expect(view(r, ['project'])!.tasks.filter(row => row.checkable).map(row => row.title)).toEqual(['Define inventory schema','Test overlapping bookings'])
})

test('text names bind only to declarations: key-value titles and frontmatter are text, not bindings', () => {
  let r = addRow(createReplica(), [], NOTE_TYPE, '---\nmytext: default\n---\nHello {{mytext}}', 1, { id: 'note' })
  r = addRow(r, ['note'], PLAIN_TYPE, 'mytext: child', 2, { id: 'child' })
  expect(resolveText(r, ['note'], 'Hello {{mytext}}').bindings[0]!.status).toBe('missing')
  r = addRefAt(r, ['note'], 'declared', primitive(r.store, 'string'), 3, literal(r, 'declared'), 'mytext')
  expect(resolveText(r, ['note'], 'Hello {{mytext}}').text).toBe('Hello declared')
})

test('a nearer name hides an outer one of another type; an unfilled nearer one is a hole bound from further out', () => {
  let r = addTask(createReplica(), [], 'Child', 1, 'child')
  const text = primitive(r.store, 'string'), other = textValue(r.store, 'other type')
  r = addRefAt(r, [], 'outer', text, 2, literal(r, 'Ada'), 'who')
  expect(resolveText(r, ['child'], '{{who}}').text).toBe('Ada')
  r = addRefAt(r, ['child'], 'hole', text, 3, null, 'who')
  expect(resolveText(r, ['child'], '{{who}}').text).toBe('Ada')
  r = addRefAt(r, ['child'], 'inner', other, 4, literal(r, 'Grace'), 'who')
  expect(resolveText(r, ['child'], '{{who}}').text).toBe('Grace')
})

test('nested stores bind names through their enclosing scope, like library and handler lookups', () => {
  let outer = addTask(createReplica(), [], 'Context', 1, 'context')
  outer = addRefAt(outer, ['context'], 'name', primitive(outer.store, 'string'), 2, literal(outer, 'Ada'), 'who')
  const inner = createReplica('draft', createStore())
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: ['context'] })
  expect(resolveText(inner, [], 'Hello {{who}}').text).toBe('Hello Ada')
})

test('handler requirements participate in readiness without executing anything', () => {
  let r = addRow(createReplica(), [], PLAIN_TYPE, 'handler', 1, { id: 'handler' })
  r = addRequirement(r, ['handler'], 'Approve first', 2, { capability: 'confirmation' }, 'approval')
  const handler = resolveScope(r.store, headCid(r), ['handler'])!
  expect(resolveBinding(r.store, put(r.store, { data: {}, children: [] }), handler).status).toBe('missing')
})

test('a disabled or removed Fos binding cannot enable a previously available action', () => {
  let r = addTask(createReplica(), [], 'Task', 1, 'task')
  r = installTestHandler(r, 'fos', 'llm')
  expect(workHandler(r, ['task']).status).toBe('ready')
  r = setHandlerEnabledAt(r, ['task'], 'fos', discoverHandlers(r, ['task'])[0]!.id, false, 3)
  expect(workHandler(r, ['task']).status).toBe('missing')
})

test('offline peers cannot satisfy explicit or transitive handler dependencies', () => {
  const r = createReplica('device'), store = r.store
  const type = libAt(store).capabilities.llm!
  const peer = valueOfPattern(store, type, { peerId: { content: 'fos' }, description: { content: 'llm' } })
  const bound = put(store, refNodeContent(store, { alias: { id: 'handler' } }, peer, []))
  expect(resolveBinding(store, type, bound, [], undefined, { isPeerActive: () => false }).status).toBe('missing')
  expect(resolveBinding(store, type, bound, [], undefined, { isPeerActive: () => true }).status).toBe('ready')
  const higherOrder = put(store, { data: {}, children: [[type, bound]] })
  expect(resolveBinding(store, put(store, { data: {}, children: [] }), higherOrder, [], undefined, { isPeerActive: () => false }).status).toBe('missing')
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
  const { withMember, memberHandlers, advertisement, peerNode } = await import('./index')
  const r = createReplica(), store = r.store, type = libAt(store).capabilities.llm!
  const to = put(store, refNodeContent(store, { alias: { id: 'to' } }, literal(r, 'to'), []))
  const from = put(store, refNodeContent(store, { alias: { id: 'from' } }, literal(r, 'from'), []))
  const member = put(store, { data: { alias: { id: 'peer-entry' } }, children: [[primitive(store, 'grants'), advertisement(store, type, to)], [primitive(store, 'accepts'), advertisement(store, type, from)]] })
  const updated = withMember(store, { data: {}, children: [[peerNode(store, 'peer'), member]] }, 'peer', 'Peer', ['llm'], [], ['llm'])
  expect(memberHandlers(store, updated, 'peer', primitive(store, 'grants'))).toEqual([to])
  expect(memberHandlers(store, updated, 'peer', primitive(store, 'accepts'))).toEqual([from])
})


test('single-brace parameters create stable mutable-ref children through all text edit paths', () => {
  let r = addRow(createReplica('params'), [], TEMPLATE_TYPE, 'Letter {customer} {customer} {{legacy}} \\{literal}', 1, { id: 'letter' })
  const args = () => argumentRefs(r.store, resolveScope(r.store, headCid(r), ['letter'])!)
  expect(args().map(a => a.name)).toEqual(['customer'])
  const original = args()[0]!
  expect(original.type).toBe(primitive(r.store, 'string'))
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
  const bound = addRefAt(createReplica(), [], 'named', primitive(r.store, 'string'), 4, null, 'name')
  expect(argumentRefs(bound.store, headCid(bound))[0]!.name).toBe('name')
})
