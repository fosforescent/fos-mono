import { userView } from './test-helpers'
import { addRow, addSupply, addTask, argumentRefs, commitRoot, updateAtScope, content, createReplica, deleteTask, destructureRequirement, headCid, instantiateTemplate, linkRequirementOutput, loadReplica, requirementOutputs, resolveBinding, resolveRequirementOutput, resolveScope, serializeReplica, valueContent, view } from './index'
import { PLAIN_TYPE, ALLOCATION_TYPE, TEMPLATE_TYPE } from './library-types'

test('planned slices stay unavailable until fulfillment, reject over-splitting and remain linked after reload', () => {
  let r = addRow(createReplica('owner'), [], ALLOCATION_TYPE, 'Budget', 1, { id: 'budget', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
  r = destructureRequirement(r, ['budget'], 'deposit', 10, 2)
  r = destructureRequirement(r, ['budget'], 'balance', 40, 3)
  expect(() => destructureRequirement(r, ['budget'], 'extra', 1, 4)).toThrow('cannot exceed')
  expect(() => destructureRequirement(r, ['budget'], 'negative', -1, 4)).toThrow('positive')
  const outputs = () => requirementOutputs(r.store, resolveScope(r.store, headCid(r), ['budget'])!)
  expect(outputs()).toHaveLength(2)
  const first = outputs()[0]!
  expect(resolveBinding(r.store, first.type, first.cid).status).toBe('missing')
  expect(userView(r)!.tasks[0]!.requirement?.have).toBe(0)
  r = addRow(r, ['budget'], ALLOCATION_TYPE, 'Funding', 5, { id: 'funding', allocation: { resource: 'bank', type: 'account', amount: 50, unit: 'USD' } })
  r = loadReplica(serializeReplica(r))
  for (const output of outputs()) {
    const result = resolveRequirementOutput(r.store, output.cid)!
    expect(result.error).toBeUndefined()
    expect(content(r.store, result.cid!).data.allocation?.amount).toBe(output.amount)
  }
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['budget'], node => ({ ...node, children: node.children.filter(edge => edge[1] !== first.cid) })), 6)
  expect(resolveRequirementOutput(r.store, first.cid)?.error).toContain('no longer part')
  const remaining = outputs()[0]!
  r = deleteTask(r, ['budget'], 'funding', 7)
  expect(resolveRequirementOutput(r.store, remaining.cid)?.error).toContain('fulfilled')
})

test('choice destructuring exposes the selected value and refuses competing choices', () => {
  let r = addRow(createReplica('owner'), [], ALLOCATION_TYPE, 'Dress', 1, { id: 'dress', requirement: { capability: 'choice', options: ['Red dress', 'Blue dress'] } })
  r = destructureRequirement(r, ['dress'], 'selectedDress', undefined, 2)
  const output = requirementOutputs(r.store, resolveScope(r.store, headCid(r), ['dress'])!)[0]!
  expect(resolveRequirementOutput(r.store, output.cid)?.error).toContain('fulfilled')
  r = addSupply(r, [], 'dress', { capability: 'choice', by: 'user', choice: 1 }, 3)
  expect(content(r.store, resolveRequirementOutput(r.store, output.cid)!.cid!).data.description?.content).toBe('Blue dress')
  r = addSupply(r, [], 'dress', { capability: 'choice', by: 'other', choice: 0 }, 4)
  expect(resolveRequirementOutput(r.store, output.cid)?.error).toContain('exactly one')
})

test('a record instance retains requirements and bound properties with instance-local source refs', () => {
  let r = addRow(createReplica('owner'), [], TEMPLATE_TYPE, 'Rental', 1, { id: 'rental' })
  r = addRow(r, ['rental'], ALLOCATION_TYPE, 'Dress', 2, { id: 'dress', requirement: { capability: 'choice', options: ['Red', 'Blue'] } })
  r = destructureRequirement(r, ['rental', 'dress'], 'dressValue', undefined, 3)
  const output = requirementOutputs(r.store, resolveScope(r.store, headCid(r), ['rental', 'dress'])!)[0]!
  r = addRow(r, ['rental'], PLAIN_TYPE, 'Record', 4, { id: 'record' })
  r = linkRequirementOutput(r, ['rental', 'record'], output.cid, 5)
  expect(() => linkRequirementOutput(r, ['rental', 'dress'], output.cid, 5)).toThrow('own output')
  r = addRow(r, [], PLAIN_TYPE, 'Booking', 6, { id: 'instance' })
  r = instantiateTemplate(r, [], 'instance', 'rental', 7)
  const rows = view(r, ['instance'])!.tasks
  const req = rows.find(t => !!t.requirement)!, record = rows.find(t => t.title === 'Record')!
  expect(req.id).not.toBe('dress')
  const arg = argumentRefs(r.store, resolveScope(r.store, headCid(r), ['instance', record.id])!)[0]!
  expect(resolveBinding(r.store, arg.type, arg.cid).status).toBe('missing')
  r = addSupply(r, ['instance'], req.id, { capability: 'choice', by: 'guest', choice: 0 }, 8)
  const result = resolveBinding(r.store, arg.type, arg.cid)
  expect(result.status).toBe('ready')
  expect(valueContent(r.store, result.cid!).data.description?.content).toBe('Red')
  expect(view(r, ['rental'])!.tasks.find(t => t.id === 'dress')!.requirement?.satisfied).toBe(false)
  // instances of a template row are tasks: the template is the row's instruction
  expect(userView(r)!.tasks.find(t => t.id === 'instance')!.checkable).toBe(true)
})

test('amount outputs bind allocation arguments and enforce the fulfilled source capacity', async () => {
  const { allocationProblems, evaluationSteps } = await import('./index')
  let r = addTask(createReplica('owner'), [], 'Use budget', 1, 'work')
  r = addRow(r, ['work'], ALLOCATION_TYPE, 'Budget', 2, { id: 'budget', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
  r = destructureRequirement(r, ['work', 'budget'], 'deposit', 10, 3)
  r = destructureRequirement(r, ['work', 'budget'], 'balance', 40, 4)
  const outputs = requirementOutputs(r.store, resolveScope(r.store, headCid(r), ['work', 'budget'])!)
  for (const output of outputs) {
    r = addRow(r, ['work'], ALLOCATION_TYPE, output.name, 5, { id: output.name, allocation: { type: 'account', resource: '', amount: 0, unit: 'USD' } })
    r = linkRequirementOutput(r, ['work', output.name], output.cid, 6)
  }
  expect(view(r, ['work'])!.tasks.find(t => t.id === 'deposit')!.allocation).toBeUndefined()
  r = addRow(r, ['work', 'budget'], ALLOCATION_TYPE, 'Funded', 7, { allocation: { type: 'account', resource: 'external', amount: 50, unit: 'USD' } })
  expect(view(r, ['work'])!.tasks.find(t => t.id === 'deposit')!.allocation?.amount).toBe(10)
  expect(allocationProblems(r, evaluationSteps(r, ['work', 'deposit']))).toEqual([])
  r = addRow(r, ['work'], ALLOCATION_TYPE, 'Duplicate spend', 8, { id: 'duplicate', allocation: { type: 'account', resource: '', amount: 0, unit: 'USD' } })
  r = linkRequirementOutput(r, ['work', 'duplicate'], outputs[0]!.cid, 9)
  expect(allocationProblems(r, evaluationSteps(r, ['work', 'duplicate']))).toEqual([expect.stringContaining('Insufficient Budget')])
})
