import {
  addMemberAt, addPlanningTemplate, addRef, addRow, addSupply, addTask, beginTaskWork,
  createReplica, decideTaskResult, loadReplica, proposeTaskResult,
  renameTask, serializeReplica, setTaskDone, taskWorkContext, view, workAttempts
} from './index'

function setup() {
  let r = addMemberAt(createReplica('owner'), [], 'fos', 'fos', ['llm'], 0)
  r = addRow(r, [], 'plain', 'Home', 1, { id: 'home' })
  r = addTask(r, ['home'], 'Rental app', 2, 'project')
  r = addRow(r, ['home', 'project'], 'note', 'Architecture: keep inventory in one database.', 3, { id: 'brief' })
  r = addTask(r, ['home', 'project'], 'Unrelated secret task', 3, 'other')
  r = addTask(r, ['home', 'project'], 'Reservations', 4, 'task')
  r = addRow(r, ['home', 'project', 'task'], 'note', 'Two simultaneous requests must not reserve the same dress.', 5, { id: 'spec' })
  r = addRow(r, ['home', 'project', 'task'], 'requirement', 'Propose a reservation plan.', 6, { id: 'request', requirement: { capability: 'llm' } })
  return { r, path: ['home', 'project', 'task', 'request'] }
}

test('preview includes ancestor notes and local details without sibling tasks; begin pins exact context and stale previews fail', () => {
  let { r, path } = setup()
  const preview = taskWorkContext(r, path)
  expect(preview.prompt).toContain('Architecture:')
  expect(preview.prompt).toContain('Two simultaneous')
  expect(preview.prompt).not.toContain('Unrelated secret')
  expect(preview.blockers).toEqual([])
  const run = beginTaskWork(r, path, preview, 7)
  r = run.replica
  expect(workAttempts(r, path)[0]!.context).toBe(preview.prompt)
  expect(taskWorkContext(r, path).prompt).toBe(preview.prompt)
  r = renameTask(r, ['home', 'project', 'task'], 'spec', 'Changed criteria', 8)
  expect(() => beginTaskWork(r, path, preview, 9)).toThrow(/changed/)
})

test('model completion remains a persisted proposal; rejection and acceptance drive the existing requirement', () => {
  let { r, path } = setup()
  const run = beginTaskWork(r, path, taskWorkContext(r, path), 7)
  r = proposeTaskResult(run.replica, run.resultPath, 'Use transactions; test conflicting reservations.', 8)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  const req = () => view(r, path.slice(0, -1))!.tasks.find((t) => t.id === 'request')!
  expect(req().requirement!.satisfied).toBe(false)
  const first = workAttempts(r, path)[0]!.proposals[0]!
  r = decideTaskResult(r, path, run.resultPath, first.cid, false, 9)
  expect(workAttempts(r, path)[0]!.proposals[0]!.status).toBe('rejected')
  expect(req().requirement!.satisfied).toBe(false)
  const again = beginTaskWork(r, path, taskWorkContext(r, path), 10)
  r = proposeTaskResult(again.replica, again.resultPath, 'Revised plan with acceptance examples.', 11)
  const next = workAttempts(r, path)[1]!.proposals[0]!
  r = decideTaskResult(r, path, again.resultPath, next.cid, true, 12)
  expect(req().requirement!.satisfied).toBe(true)
  expect(view(r, ['home', 'project'])!.tasks.find((t) => t.id === 'task')!.done).toBe(false)
  expect(view(r, path)!.tasks.some((t) => t.text?.mediaType === 'text/markdown' && t.title.startsWith('Revised plan'))).toBe(true)
  expect(() => decideTaskResult(r, path, again.resultPath, next.cid, true, 13)).toThrow()
  r = setTaskDone(r, ['home', 'project'], 'task', true, 14)
  expect(view(r, ['home', 'project'])!.tasks.find((t) => t.id === 'task')!.done).toBe(true)
})

test('accepted work becomes an explicit input to another task; missing or unaccepted inputs block delegation', () => {
  let { r, path } = setup()
  r = addTask(r, ['home', 'project'], 'Implement reservation', 7, 'dependent')
  r = addRef(r, ['home', 'project', 'dependent'], 'request', 8)
  r = addRow(r, ['home', 'project', 'dependent'], 'requirement', 'Refine implementation steps.', 9, { id: 'next', requirement: { capability: 'llm' } })
  const dependent = ['home', 'project', 'dependent', 'next']
  expect(taskWorkContext(r, dependent).blockers.join()).toMatch(/not accepted/)
  const run = beginTaskWork(r, path, taskWorkContext(r, path), 10)
  r = proposeTaskResult(run.replica, run.resultPath, 'Accepted design: use transactional reservations.', 11)
  r = decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 12)
  expect(taskWorkContext(r, dependent).blockers).toEqual([])
  expect(taskWorkContext(r, dependent).prompt).toContain('Accepted design:')
})

test('changed criteria prevent accepting an old answer, and oversized context is not silently truncated', () => {
  let { r, path } = setup()
  const run = beginTaskWork(r, path, taskWorkContext(r, path), 7)
  r = proposeTaskResult(run.replica, run.resultPath, 'Old answer', 8)
  r = renameTask(r, ['home', 'project', 'task'], 'spec', 'New criteria', 9)
  expect(() => decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 10)).toThrow(/context changed/)
  r = addRow(r, ['home', 'project', 'task'], 'note', 'x'.repeat(20_001), 11)
  expect(taskWorkContext(r, path).blockers.join()).toMatch(/20,000/)
})

test('the reusable work template requires readiness and uses the existing instantiator', () => {
  let r = addMemberAt(createReplica('owner'), [], 'fos', 'fos', ['llm'], 0)
  r = addTask(r, [], 'Build availability', 1, 'task')
  r = addPlanningTemplate(r, ['task'], 2)
  const rows = view(r, ['task'])!.tasks
  expect(rows.filter((t) => t.text?.mediaType === 'text/markdown')).toHaveLength(2)
  const req = rows.find((t) => t.kind === 'requirement')!
  const path = ['task', req.id]
  expect(taskWorkContext(r, path).blockers.join()).toMatch(/ready/)
  const confirm = view(r, path)!.tasks[0]!
  r = addSupply(r, path, confirm.id, { capability: 'confirmation', by: 'owner' }, 3)
  expect(taskWorkContext(r, path).blockers).toEqual([])
  const run = beginTaskWork(r, path, taskWorkContext(r, path), 4)
  expect(workAttempts(run.replica, path)).toHaveLength(1)
})


test('the sent context stays pinned even if someone edits the visible snapshot note', () => {
  let { r, path } = setup()
  const preview = taskWorkContext(r, path)
  const run = beginTaskWork(r, path, preview, 7)
  r = run.replica
  const note = view(r, run.path)!.tasks.find((t) => t.text?.mediaType === 'text/markdown')!
  r = renameTask(r, run.path, note.id, 'An edited visible note', 8)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  expect(workAttempts(r, path)[0]!.context).toBe(preview.prompt)
  expect(workAttempts(r, path)[0]!.system).toBe(run.system)
})

test('planning uses a note’s own variable context as well as passed text arguments', () => {
  let { r, path } = setup()
  r = addRow(r, path.slice(0, -1), 'note', 'Required: {{subject}}', 7, { id: 'templated-note' })
  r = addRow(r, [...path.slice(0, -1), 'templated-note'], 'plain', 'subject: prevent double bookings', 8)
  const preview = taskWorkContext(r, path)
  expect(preview.blockers).toEqual([])
  expect(preview.prompt).toContain('Required: prevent double bookings')
})
