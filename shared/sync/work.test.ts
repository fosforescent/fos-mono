import { textValue } from './index'
import { primitive } from './primitives'
import { installTestHandler } from './test-helpers'
import {
  addMemberAt, addPlanningTemplate, addRef, addRequirement, addRow, addTask, beginTaskWork,
  createReplica, decideTaskResult, loadReplica, proposeTaskResult, supplyRequirement,
  renameTask, serializeReplica, addRefAt, put, setTaskDone, taskWorkContext, view, workAttempts
} from './index'
import { PLAIN_TYPE } from './library-types'
import { NOTE_TYPE } from './library-types'

function setup() {
  let r = installTestHandler(createReplica('owner'), 'fos', 'llm')
  r = addRow(r, [], PLAIN_TYPE, 'Home', 1, { id: 'home' })
  r = addTask(r, ['home'], 'Rental app', 2, 'project')
  r = addRow(r, ['home', 'project'], NOTE_TYPE, 'Architecture: keep inventory in one database.', 3, { id: 'brief' })
  r = addTask(r, ['home', 'project'], 'Unrelated secret task', 3, 'other')
  r = addTask(r, ['home', 'project'], 'Reservations', 4, 'task')
  r = addRow(r, ['home', 'project', 'task'], NOTE_TYPE, 'Two simultaneous requests must not reserve the same dress.', 5, { id: 'spec' })
  r = addRequirement(r, ['home', 'project', 'task'], 'Propose a reservation plan.', 6, { capability: 'llm' }, 'request')
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

// model completion remains a persisted proposal: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end

// accepted work becomes an explicit input to another task: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end

test('changed criteria prevent accepting an old answer, and oversized context is not silently truncated', () => {
  let { r, path } = setup()
  const run = beginTaskWork(r, path, taskWorkContext(r, path), 7)
  r = proposeTaskResult(run.replica, run.resultPath, 'Old answer', 8)
  r = renameTask(r, ['home', 'project', 'task'], 'spec', 'New criteria', 9)
  expect(() => decideTaskResult(r, path, run.resultPath, workAttempts(r, path)[0]!.proposals[0]!.cid, true, 10)).toThrow(/context changed/)
  r = addRow(r, ['home', 'project', 'task'], NOTE_TYPE, 'x'.repeat(20_001), 11)
  expect(taskWorkContext(r, path).blockers.join()).toMatch(/20,000/)
})

// the reusable work template requires readiness: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end

test('the sent context stays pinned even if someone edits the visible snapshot note', () => {
  let { r, path } = setup()
  const preview = taskWorkContext(r, path)
  const run = beginTaskWork(r, path, preview, 7)
  r = run.replica
  const note = view(r, run.path)!.tasks.find((t) => t.type === NOTE_TYPE)!
  r = renameTask(r, run.path, note.id, 'An edited visible note', 8)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  expect(workAttempts(r, path)[0]!.context).toBe(preview.prompt)
  expect(workAttempts(r, path)[0]!.system).toBe(run.system)
})

test('planning resolves a note’s names from its declarations, as passed text arguments', () => {
  let { r, path } = setup()
  r = addRow(r, path.slice(0, -1), NOTE_TYPE, 'Required: {{subject}}', 7, { id: 'templated-note' })
  r = addRefAt(r, [...path.slice(0, -1), 'templated-note'], 'subject', primitive(r.store, 'string'), 8, textValue(r.store, 'prevent double bookings'), 'subject')
  const preview = taskWorkContext(r, path)
  expect(preview.blockers).toEqual([])
  expect(preview.prompt).toContain('Required: prevent double bookings')
})
