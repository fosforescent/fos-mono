/** Requirements and allocations are one kind of row, inverses of each other; authority moves through the allocate primitive. */
import { addTask, createReplica, headCid, view, type Replica } from './replica'
import { content, libAt, resolveScope, valueContent } from './graph'
import { primitiveRef, publishPrimitive, primitiveExecutors } from './primitives'
import { evaluateNode, evaluationSteps, type EvaluationDriver } from './evaluation'
import { addAllocation, addBank, addRequirement, allocatePrimitive, bindArgument, consumeAllocation, debitGrant, handleAt, issueGrant, ownerGrants, supplyRequirement } from './arguments'
import { transactionWrites } from './transactions'
import { setTaskDone, addRow } from './replica'
import { TASK_TYPE } from './library-types'
import { TASK_DEMAND } from './test-helpers'

/** A host's allocate handler: the shared primitive, published as a primitive ref like a device's fetch or solve. */
function installAllocate(r: Replica, host: string, at: string[] = []): Replica {
  const definition = { id: `${host}:allocate`, label: 'allocate', capability: (store: Replica['store'], scope: string[]) => libAt(store, scope).capabilities.allocate! }
  return publishPrimitive(r, at, host, primitiveRef(r.store, host, definition, { ...definition, run: allocatePrimitive }, at), 0)
}

function fixture() {
  let r = createReplica('owner')
  r = installAllocate(r, 'owner')
  r = addBank(r, [], 'Budget', 1, { type: 'account', unit: 'USD' }, 'bank')
  r = addTask(r, [], 'Work', 3, 'work')
  let clock = 10
  const driver: EvaluationDriver = {
    get: () => r, save: next => { r = next }, now: () => ++clock, check: () => [],
    executors: step => primitiveExecutors(r, step, 'owner').map(value => ({ run: value.implementation.run! }))
  }
  return { get: () => r, set: (next: Replica) => { r = next }, driver, amounts: () => ownerGrants(r, ['bank']).map(grant => grant.allocation.amount).sort((a, b) => a - b) }
}
const invocations = (r: Replica, at: string[]) => view(r, at)!.tasks.filter(row => !row.resource && !row.checkable).map(row => row.id)

test('a bank issues authority through an evaluated invocation of the allocate handler; nothing is live before commit', async () => {
  const f = fixture()
  expect(f.amounts()).toEqual([])
  f.set(issueGrant(f.get(), ['bank'], { type: 'account', unit: 'USD', amount: 10 }, 2, 'Initial', 'credit'))
  expect(f.amounts()).toEqual([])
  f.driver.commit = async () => { expect(f.amounts()).toEqual([]) }
  const result = await evaluateNode(['credit'], f.driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(f.amounts()).toEqual([10])
  expect(view(f.get(), [])!.tasks.find(row => row.id === 'bank')!.resource!.held).toBe(10)
  expect(transactionWrites(f.get(), result.id)).toEqual([])
  // retiring is a negative grant; the bank holds the net
  delete f.driver.commit
  f.set(debitGrant(f.get(), ['bank'], { type: 'account', unit: 'USD', amount: 3 }, 4, 'Retire', 'debit'))
  const debit = await evaluateNode(['debit'], f.driver)
  expect(debit.error).toBeUndefined()
  expect(debit.status).toBe('committed')
  expect(f.amounts()).toEqual([-3, 10])
  expect(view(f.get(), [])!.tasks.find(row => row.id === 'bank')!.resource!.held).toBe(7)
})

test('a bank without an allocate handler in scope cannot issue', () => {
  let r = createReplica('owner')
  r = addBank(r, [], 'Shelf', 1, { type: 'inventory', unit: 'item' }, 'shelf')
  expect(() => issueGrant(r, ['shelf'], { type: 'inventory', unit: 'item', amount: 12 }, 2)).toThrow(/No allocation checking handler/)
  expect(evaluationSteps(r, ['shelf'])).toHaveLength(1) // the bank itself; its grants are data, not steps
})

async function funded() {
  const f = fixture()
  f.set(issueGrant(f.get(), ['bank'], { type: 'account', unit: 'USD', amount: 10 }, 2, 'Initial', 'credit'))
  expect((await evaluateNode(['credit'], f.driver)).status).toBe('committed')
  // the bank's grant becomes a handle row in the task: a row holding the grant, from which the task spends
  const grant = ownerGrants(f.get(), ['bank'])[0]!
  f.set(consumeAllocation(f.get(), ['work'], { owner: ['bank'], grant: grant.cid }, 10, 3, { id: 'draw' }))
  expect((await evaluateNode(['work', 'draw'], f.driver)).status).toBe('committed')
  const handle = view(f.get(), ['work', 'draw'])!.tasks.find(row => (row.allocation?.amount ?? 0) > 0)!
  return { ...f, grantRow: ['work', 'draw', handle.id] as string[] }
}

test('a requirement for money is a negative argument; a grant consumed from the bank is bound to it at commit, conserving the amount', async () => {
  const f = await funded()
  f.set(addRequirement(f.get(), ['work'], 'lunch', 5, { capability: 'send-payment', resource: 'account', unit: 'USD', amount: 6 }, 'lunch'))
  let row = view(f.get(), ['work'])!.tasks.find(t => t.id === 'lunch')!
  expect(row.requirement).toMatchObject({ capability: 'allocation', satisfied: false, resource: 'account', amount: 6, unit: 'USD', linear: true })
  expect(row.title).toBe('lunch')
  expect(view(f.get(), [])!.tasks.find(t => t.id === 'work')!.blockedBy).toEqual(['account 6 USD'])
  // a plain amount typed inside is data, not authority: the requirement stays open
  f.set(addAllocation(f.get(), ['work', 'lunch'], 'cash', 6, { resource: '', type: 'account', unit: 'USD', amount: 6 }))
  expect(view(f.get(), ['work'])!.tasks.find(t => t.id === 'lunch')!.requirement!.satisfied).toBe(false)
  // binding a grant by hand is refused; it moves through an invocation
  const grant = handleAt(f.get(), f.grantRow)!
  expect(() => bindArgument(f.get(), ['work', 'lunch'], grant.cid, 'owner', 7)).toThrow(/allocate invocation/)
  f.set(consumeAllocation(f.get(), ['work'], f.grantRow, 6, 8, { to: ['work', 'lunch'], id: 'pay' }))
  expect(view(f.get(), ['work'])!.tasks.find(t => t.id === 'lunch')!.requirement!.satisfied).toBe(false)
  const result = await evaluateNode(['work', 'pay'], f.driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  row = view(f.get(), ['work'])!.tasks.find(t => t.id === 'lunch')!
  expect(row.requirement!.satisfied).toBe(true)
  expect(row.title).toBe('lunch')
  expect(f.amounts()).toEqual([4, 6])
  expect(handleAt(f.get(), ['work', 'lunch'])?.allocation.amount).toBe(6)
  expect(handleAt(f.get(), f.grantRow)?.allocation.amount).toBe(4) // the remainder rebinds the handle
  expect(view(f.get(), [])!.tasks.find(t => t.id === 'work')!.blockedBy).toBeUndefined()
  // a smaller grant does not satisfy a requirement for more
  f.set(addRequirement(f.get(), ['work'], 'dinner', 9, { capability: 'send-payment', resource: 'account', unit: 'USD', amount: 7 }, 'dinner'))
  f.set(consumeAllocation(f.get(), ['work'], f.grantRow, 4, 10, { to: ['work', 'dinner'], id: 'under' }))
  const under = await evaluateNode(['work', 'under'], f.driver)
  expect(under.status).toBe('rolled-back')
  expect(under.error).toMatch(/does not satisfy the destination/)
  expect(f.amounts()).toEqual([4, 6])
})

test('discarding the remainder, naming a grant twice and crossing banks are refused without publishing anything', async () => {
  const f = await funded()
  const { planAllocation } = await import('./arguments')
  f.set(planAllocation(f.get(), ['work'], { owner: ['bank'], inputs: [f.grantRow], outputs: [{ type: 'account', unit: 'USD', amount: 6 }] }, 4, 'split'))
  const result = await evaluateNode(['work', 'split'], f.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.error).toMatch(/conserve/)
  expect(f.amounts()).toEqual([10])
  expect(transactionWrites(f.get(), result.id)).toEqual([])
  f.set(planAllocation(f.get(), ['work'], { owner: ['bank'], inputs: [f.grantRow, f.grantRow], outputs: [{ type: 'account', unit: 'USD', amount: 20 }] }, 5, 'twice'))
  const twice = await evaluateNode(['work', 'twice'], f.driver)
  expect(twice.status).toBe('rolled-back')
  expect(twice.error).toMatch(/same grant twice/)
  // a grant of another bank is not this bank's to move
  let r = addBank(f.get(), [], 'Loose', 6, { type: 'account', unit: 'USD' }, 'loose')
  r = issueGrant(r, ['loose'], { type: 'account', unit: 'USD', amount: 5 }, 7, 'loose grant', 'lcredit')
  f.set(r)
  expect((await evaluateNode(['lcredit'], f.driver)).status).toBe('committed')
  const loose = ownerGrants(f.get(), ['loose'])[0]!
  expect(() => planAllocation(f.get(), ['work'], { owner: ['bank'], inputs: [{ grant: loose.cid }], outputs: [{ type: 'account', unit: 'USD', amount: 5 }] }, 9, 'move')).toThrow(/not issued to this bank/)
  f.set(consumeAllocation(f.get(), ['work'], { owner: ['loose'], grant: loose.cid }, 5, 9, { id: 'ldraw' }))
  expect((await evaluateNode(['work', 'ldraw'], f.driver)).status).toBe('committed')
  const looseHandle = view(f.get(), ['work', 'ldraw'])!.tasks.find(row => (row.allocation?.amount ?? 0) > 0)!
  f.set(planAllocation(f.get(), ['work'], { owner: ['bank'], inputs: [['work', 'ldraw', looseHandle.id]], outputs: [{ type: 'account', unit: 'USD', amount: 5 }] }, 10, 'move'))
  const moved = await evaluateNode(['work', 'move'], f.driver)
  expect(moved.status).toBe('rolled-back')
  expect(moved.error).toMatch(/not issued to this bank/)
  expect(ownerGrants(f.get(), ['loose']).map(grant => grant.allocation.amount)).toEqual([5])
})

test('a task requirement is a value containing a done task; a confirmation is a value of its capability supplied by a peer', () => {
  let r = createReplica('owner')
  r = addTask(r, [], 'Trip', 1, 't')
  r = addRequirement(r, ['t'], 'book a table', 2, TASK_DEMAND, 'rt')
  r = addRequirement(r, ['t'], 'ok?', 3, { capability: 'confirmation' }, 'rc')
  r = addRequirement(r, ['t'], 'fast or cheap', 4, { capability: 'choice', options: ['fast', 'cheap'] }, 'rx')
  expect(view(r, ['t'])!.tasks.map(row => [row.id, row.requirement?.satisfied, row.requirement?.summary])).toEqual([['rt', false, 'task'], ['rc', false, 'confirmation'], ['rx', false, 'choice (fast | cheap)']])
  expect(view(r, [])!.tasks.find(t => t.id === 't')!.blockedBy).toEqual(['task', 'confirmation', 'choice (fast | cheap)'])
  // the first row typed inside an open requirement starts the value it is bound to
  r = addRow(r, ['t', 'rt'], TASK_TYPE, 'call the restaurant', 5, { id: 'call' })
  expect(view(r, ['t', 'rt'])!.tasks.map(row => row.title)).toEqual(['call the restaurant'])
  expect(view(r, ['t'])!.tasks[0]!.requirement!.satisfied).toBe(false)
  r = setTaskDone(r, ['t', 'rt'], 'call', true, 6)
  expect(view(r, ['t'])!.tasks[0]!.requirement!.satisfied).toBe(true)
  expect(view(r, ['t'])!.tasks[0]!.title).toBe('book a table')
  // a peer's confirmation and a chosen option bind the holes directly
  r = supplyRequirement(r, ['t'], 'rc', { by: 'user:ada' }, 7)
  expect(() => supplyRequirement(r, ['t'], 'rx', { by: 'user:ada', choice: 5 }, 8)).toThrow(/declared options/)
  r = supplyRequirement(r, ['t'], 'rx', { by: 'user:ada', choice: 1 }, 8)
  expect(view(r, ['t'])!.tasks.map(row => row.requirement!.satisfied)).toEqual([true, true, true])
  expect(view(r, [])!.tasks.find(t => t.id === 't')!.blockedBy).toBeUndefined()
  r = setTaskDone(r, [], 't', true, 9)
  expect(view(r, [])!.tasks.find(t => t.id === 't')!.done).toBe(true)
  // the bound value stays the row's value; the pattern on its left is what was asked
  const cid = resolveScope(r.store, headCid(r), ['t', 'rx'])!
  expect(valueContent(r.store, cid).data.description?.content).toBe('cheap')
  expect(content(r.store, cid).data.description?.content).toBe('fast or cheap')
})
