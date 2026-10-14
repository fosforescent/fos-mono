import { addMemberAt, addRefAt, addRow, addTask, addSubtasksTemplate, beginTaskWork, content, contextBindings, createReplica, decideTaskResult, headCid, instantiateTemplate, proposeTaskResult, put, refNodeContent, resolveBinding, resolveScope, resolveText, taskWorkContext, view, workAttempts, workHandler } from './index'

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
  r = addRow(r, [], 'template', 'Letter', 1, { id: 'template' })
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
  expect(view(r, ['project'])!.tasks.filter(row => row.kind === 'task')).toHaveLength(0)
  r = decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 6)
  expect(view(r, ['project'])!.tasks.filter(row => row.kind === 'task').map(row => row.title)).toEqual(['Define inventory schema','Test overlapping bookings'])
})

test('legacy note variables and frontmatter use the shared resolver without changing precedence', () => {
  let r = addRow(createReplica(), [], 'note', '---\nmytext: default\n---\nHello {{mytext}}', 1, { id: 'note' })
  r = addRow(r, ['note'], 'plain', 'mytext: child', 2, { id: 'child' })
  expect(resolveText(r, ['note'], 'Hello {{mytext}}').text).toBe('Hello child')
  r = addRow(r, ['note'], 'plain', 'mytext: incompatible', 3, { id: 'other' })
  expect(resolveText(r, ['note'], '{{mytext}}').bindings[0]!.status).toBe('conflict')
})

test('handler requirements participate in readiness without executing anything', () => {
  let r = addRow(createReplica(), [], 'plain', 'handler', 1, { id: 'handler' })
  r = addRow(r, ['handler'], 'requirement', 'Approve first', 2, { id: 'approval', requirement: { capability: 'confirmation' } })
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
