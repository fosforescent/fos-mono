import { userView } from './test-helpers'
import { addRow, addSupply, addTask, createReplica, evaluateNode, evaluationRecord, view, renameTask, setTaskDone, serializeReplica, loadReplica, type EvaluationDriver, type Replica } from './index'

function setup() {
  let r = addTask(createReplica('owner'), [], 'Parent', 1, 'parent')
  r = addTask(r, ['parent'], 'Child', 2, 'child')
  const events: string[] = []
  const driver: EvaluationDriver = {
    get: () => r, save: value => { r = value }, now: () => 10, check: () => [], handles: () => false,
    open: async s => { events.push(`open ${s.path.at(-1)}`) },
    commit: async s => { events.push(`commit ${s.path.at(-1)}`) }
  }
  return { driver, events, get: () => r, set: (next: Replica) => { r = next } }
}
test('opens parent first, commits leaves first, persists the journal and marks tasks done only after commit', async () => {
  const s = setup()
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('committed')
  expect(s.events).toEqual(['open parent', 'open child', 'commit child', 'commit parent'])
  expect(userView(s.get())!.tasks[0]!.done).toBe(true)
  expect(view(s.get(), ['parent'])!.tasks[0]!.done).toBe(true)
  expect(evaluationRecord(loadReplica(serializeReplica(s.get())), ['parent'])?.status).toBe('committed')
})
test('an unresolved confirmation stops all effects before opening a transaction', async () => {
  const s = setup()
  s.set(addRow(s.get(), ['parent', 'child'], 'requirement', 'Confirm', 3, { requirement: { capability: 'confirmation' } }))
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow(/Unfulfilled confirmation/)
  expect(s.events).toEqual([])
})
test('a failed effect gets a manual recovery task and cannot be repeated after reload', async () => {
  const s = setup()
  s.set(addRow(s.get(), ['parent'], 'requirement', 'Create issue', 3, { id: 'req', requirement: { capability: 'repo' } }))
  s.driver.handles = step => step.row?.requirement?.capability === 'repo'
  s.driver.effect = async () => { throw new Error('Response lost after sending') }
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('needs-recovery')
  expect(view(s.get(), ['parent'])!.tasks.some(t => t.title.includes('Manually roll back'))).toBe(true)
  expect(userView(s.get())!.tasks[0]!.done).toBe(false)
  s.set(loadReplica(serializeReplica(s.get())))
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow(/needs recovery/)
})
test('compensates successful effects in reverse order when commit fails', async () => {
  const s = setup(), reverted: string[] = []
  for (const id of ['a', 'b']) s.set(addRow(s.get(), ['parent'], 'requirement', id, 3, { id, requirement: { capability: 'repo' } }))
  s.driver.handles = step => step.row?.requirement?.capability === 'repo'
  s.driver.effect = async step => { s.set(addSupply(s.get(), step.path.slice(0, -1), step.path.at(-1)!, { capability: 'repo', by: 'test' }, 4)) }
  s.driver.commit = async () => { throw new Error('Commit failed') }
  s.driver.rollback = async step => { reverted.push(step.path.at(-1)!) }
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('rolled-back')
  expect(reverted).toEqual(['a', 'b'])
  expect(userView(s.get())!.tasks[0]!.done).toBe(false)
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'child')!.done).toBe(false)
})
test('refuses instructions changed during open and keeps unrelated edits', async () => {
  const s = setup()
  s.driver.open = async step => { if (step.path.length === 1) s.set(renameTask(s.get(), ['parent'], 'child', 'Changed elsewhere', 5)) }
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('rolled-back')
  expect(view(s.get(), ['parent'])!.tasks[0]!.title).toBe('Changed elsewhere')
})
test('checks competing allocations across the whole tree', async () => {
  const s = setup()
  s.set(addRow(s.get(), [], 'resource', 'Drill', 1, { id: 'bank', resource: { type: 'inventory', unit: 'drill', capacity: 1 } }))
  for (const [path, start, end] of [[['parent'], 10, 20], [[], 15, 25]] as const) s.set(addRow(s.get(), [...path], 'allocation', 'Reservation', 2, { allocation: { resource: 'bank', type: 'inventory', unit: 'drill', amount: 1, start, end } }))
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow(/overlapping/)
})
test('completes task requirements bottom up without publishing partial completion', async () => {
  const s = setup()
  s.set(addRow(s.get(), ['parent'], 'requirement', 'Child task', 1, { id: 'needs-task', requirement: { capability: 'task' } }))
  s.set(addTask(s.get(), ['parent', 'needs-task'], 'Nested', 1, 'nested'))
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('committed')
  expect(userView(s.get())!.tasks[0]!.done).toBe(true)
})

test('a new child or changed binding arriving during open aborts the transaction', async () => {
  const s = setup()
  s.driver.open = async step => { if (step.path.length === 1) s.set(addTask(s.get(), ['parent'], 'New concurrent instruction', 5, 'new')) }
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.error).toMatch(/child rows changed/)
  expect(userView(s.get())!.tasks[0]!.done).toBe(false)
})

test('failure to persist final completion leaves tasks open', async () => {
  const s = setup()
  const save = s.driver.save
  let failed = false
  s.driver.save = next => {
    if (!failed && evaluationRecord(next, ['parent'])?.status === 'committed') { failed = true; throw new Error('Persistence failed') }
    return save(next)
  }
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('rolled-back')
  expect(userView(s.get())!.tasks[0]!.done).toBe(false)
  expect(view(s.get(), ['parent'])!.tasks[0]!.done).toBe(false)
})

test('amount alone does not fulfill a different unit or time window', async () => {
  const s = setup()
  s.set(addRow(s.get(), ['parent'], 'requirement', 'Reservation', 1, { id: 'need', requirement: { capability: 'allocation', resource: 'inventory', unit: 'drill', amount: 1, start: 10, end: 20 } }))
  s.set(addRow(s.get(), ['parent', 'need'], 'allocation', 'Wrong window', 1, { allocation: { resource: 'bank', type: 'inventory', unit: 'drill', amount: 1, start: 30, end: 40 } }))
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'need')!.requirement!.satisfied).toBe(false)
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow()
})

test('declared return slots can start empty, but an effect cannot commit with an unfilled return', async () => {
  const { addRefAt } = await import('./index')
  const s = setup()
  s.set(addRow(s.get(), ['parent'], 'requirement', 'Produce a result', 3, { id: 'req', requirement: { capability: 'tool' } }))
  s.set(addRefAt(s.get(), ['parent', 'req'], 'result', s.get().store.primitive.documentField.getId(), 4))
  s.driver.handles = step => step.row?.requirement?.capability === 'tool'
  s.driver.outputs = () => ['result']
  s.driver.effect = async () => { s.set(addSupply(s.get(), ['parent'], 'req', { capability: 'tool', by: 'tool' }, 5)) }
  const record = await evaluateNode(['parent'], s.driver)
  expect(record.status).toBe('needs-recovery')
  expect(record.error).toMatch(/valid return value/)
  expect(userView(s.get())!.tasks[0]!.done).toBe(false)
})
