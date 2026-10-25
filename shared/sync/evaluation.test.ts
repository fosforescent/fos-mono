import { TASK_DEMAND, answering, userView } from './test-helpers'
import { TASK_TYPE } from './library-types'
import { addAllocation, addBank, addRequirement, addRow, addTask, createReplica, evaluateNode, evaluationRecord, evaluationSteps, handleAt, ownerGrants, selectExecutor, supplyRequirement, view, renameTask, serializeReplica, loadReplica, type EvaluationDriver, type Replica } from './index'

function setup() {
  let r = addTask(createReplica('owner'), [], 'Parent', 1, 'parent')
  r = addTask(r, ['parent'], 'Child', 2, 'child')
  const events: string[] = []
  const driver: EvaluationDriver = {
    get: () => r, save: value => { r = value }, now: () => 10, check: () => [], executors: () => [],
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
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(true)
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'child')!.done).toBe(true)
  expect(evaluationRecord(loadReplica(serializeReplica(s.get())), ['parent'])?.status).toBe('committed')
})
test('an unresolved confirmation stops all effects before opening a transaction', async () => {
  const s = setup()
  s.set(addRequirement(s.get(), ['parent', 'child'], 'Confirm', 3, { capability: 'confirmation' }))
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow(/Unfulfilled confirmation/)
  expect(s.events).toEqual([])
})
test('a primitive that fails leaves nothing behind: its writes were pending, the run rolls back and can be repeated after reload', async () => {
  const s = setup()
  s.set(addRequirement(s.get(), ['parent'], 'Create issue', 3, { capability: 'repo' }, 'req'))
  s.driver.executors = step => step.row?.requirement?.capability === 'repo' ? [{ run: async () => { throw new Error('Response lost after sending') } }] : []
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.error).toMatch(/Response lost/)
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(false)
  s.set(loadReplica(serializeReplica(s.get())))
  s.driver.executors = step => step.row?.requirement?.capability === 'repo' ? [{ run: answering('test') }] : []
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('committed')
})
test('a failed commit discards every primitive\'s answers: no requirement stays filled, no task done', async () => {
  const s = setup()
  for (const id of ['a', 'b']) s.set(addRequirement(s.get(), ['parent'], id, 3, { capability: 'repo' }, id))
  s.driver.executors = step => step.row?.requirement?.capability === 'repo' ? [{ run: answering('test') }] : []
  s.driver.commit = async () => { throw new Error('Commit failed') }
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.effects.map(e => e.status)).toEqual(['reverted', 'reverted'])
  expect(view(s.get(), ['parent'])!.tasks.filter(t => t.requirement).map(t => t.requirement!.satisfied)).toEqual([false, false])
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(false)
})
test('refuses instructions changed during open and keeps unrelated edits', async () => {
  const s = setup()
  s.driver.open = async step => { if (step.path.length === 1) s.set(renameTask(s.get(), ['parent'], 'child', 'Changed elsewhere', 5)) }
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('rolled-back')
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'child')!.title).toBe('Changed elsewhere')
})
test('amount rows are data: evaluating them moves no authority and a bank without grants holds none', async () => {
  const s = setup()
  s.set(addBank(s.get(), [], 'Drill', 1, { type: 'inventory', unit: 'drill' }, 'bank'))
  for (const path of [['parent'], []]) s.set(addAllocation(s.get(), path, 'Reservation', 2, { resource: '', type: 'inventory', unit: 'drill', amount: 1 }, { id: `reservation-${path.length}` }))
  expect(evaluationSteps(s.get(), ['parent']).map(step => step.path)).toEqual([['parent'], ['parent', 'child']])
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('committed')
  expect(ownerGrants(s.get(), ['bank'])).toEqual([])
  expect(handleAt(s.get(), ['parent', 'reservation-1'])).toBeNull()
})

test('completes task requirements bottom up without publishing partial completion', async () => {
  const s = setup()
  s.set(addRequirement(s.get(), ['parent'], 'Child task', 1, TASK_DEMAND, 'needs-task'))
  s.set(addRow(s.get(), ['parent', 'needs-task'], TASK_TYPE, 'Nested', 1, { id: 'nested' }))
  expect((await evaluateNode(['parent'], s.driver)).status).toBe('committed')
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(true)
})

test('a new child or changed binding arriving during open aborts the transaction', async () => {
  const s = setup()
  s.driver.open = async step => { if (step.path.length === 1) s.set(addTask(s.get(), ['parent'], 'New concurrent instruction', 5, 'new')) }
  const result = await evaluateNode(['parent'], s.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.error).toMatch(/child rows changed/)
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(false)
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
  expect(userView(s.get())!.tasks.find(t => t.id === 'parent')!.done).toBe(false)
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'child')!.done).toBe(false)
})

test('a plain amount typed inside a resource requirement is data and does not fulfil it', async () => {
  const s = setup()
  s.set(addRequirement(s.get(), ['parent'], 'Reservation', 1, { capability: 'allocation', resource: 'inventory', unit: 'drill', amount: 1 }, 'need'))
  s.set(addAllocation(s.get(), ['parent', 'need'], 'Wrong unit', 1, { resource: '', type: 'inventory', unit: 'hammer', amount: 1 }))
  expect(view(s.get(), ['parent'])!.tasks.find(t => t.id === 'need')!.requirement!.satisfied).toBe(false)
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow()
})

test('a step with several executors is a choice for its owner, never the first one a host lists', async () => {
  const s = setup(), ran: string[] = []
  s.set(addRequirement(s.get(), ['parent'], 'Create issue', 3, { capability: 'repo' }, 'req'))
  const executor = (name: string) => ({ run: async () => { ran.push(name); return {} } })
  s.driver.executors = step => step.row?.requirement?.capability === 'repo' ? [executor('first'), executor('second')] : []
  await expect(evaluateNode(['parent'], s.driver)).rejects.toThrow(/2 handlers can run this step/)
  expect(ran).toEqual([])
  expect(selectExecutor([executor('only')]).executor).not.toBeNull()
  expect(selectExecutor([])).toEqual({ executor: null, problem: null })
})
