/** Minimal shared-only repros of flows the backend handlers rely on (see backend/sync/hostHandlers.ts). */
import { addAllocation, addBank, addRequirement, addRow, addTask, allocateCapability, allocateNative, allocationPattern, argumentSupplier, bindIssuedAuthority, createReplica, ensureHomeContext, evaluateNode, grantValue, handlerResult, headCid, HOME_ID, issueGrant, libAt, nativeRef, ownerGrants, resolveScope, supplyRequirement, view, writeHandlerResult, type EvaluationDriver, type Replica } from './index'
import { NOTE_TYPE, PLAIN_TYPE } from './library-types'

const driverOf = (get: () => Replica, set: (r: Replica) => void, executors: EvaluationDriver['executors'] = () => []): EvaluationDriver =>
  ({ get, save: set, now: () => 10, check: () => [], executors })

test('rows and the handler result written inside an open requirement survive supplying it', () => {
  let r = addTask(createReplica('owner'), [], 'Find', 1, 'find')
  r = addRequirement(r, ['find'], 'logo designers', 2, { capability: 'search' }, 'ask')
  r = addRow(r, ['find', 'ask'], PLAIN_TYPE, 'a hit', 3, { id: 'hit' })
  r = writeHandlerResult(r, ['find', 'ask'], { answer: 42 }, 4)
  expect(view(r, ['find', 'ask'])!.tasks.map(t => t.title)).toEqual(['a hit'])
  expect(handlerResult(r, ['find', 'ask'])).toEqual({ answer: 42 })
  r = supplyRequirement(r, ['find'], 'ask', { by: 'fos', receipt: '1 hit' }, 5)
  expect(view(r, ['find'])!.tasks.find(t => t.id === 'ask')!.requirement!.satisfied).toBe(true)
  expect(argumentSupplier(r, ['find', 'ask'])).toBe('fos')
  // what the UI shows inside the requirement after it is filled (the evaluator's own execute row aside)
  expect(view(r, ['find', 'ask'])!.tasks.filter(t => t.type !== 'capabilities.execute').map(t => t.title)).toEqual(['a hit'])
  expect(handlerResult(r, ['find', 'ask'])).toEqual({ answer: 42 })
})

// a return ref declared inside a requirement: drove a legacy executor; natives answer values (arguments.test.ts, evaluation.test.ts)

// a task whose choice requirement is answered: drove a legacy executor; natives answer values (arguments.test.ts, evaluation.test.ts)

test('supplying a requirement by reference to a row inside it satisfies it (an accepted model answer)', () => {
  let r = addTask(createReplica('owner'), [], 'Plan', 1, 'plan')
  r = addRequirement(r, ['plan'], 'Draft the plan', 2, { capability: 'llm' }, 'ask')
  r = addRow(r, ['plan', 'ask'], NOTE_TYPE, '1. Announce', 3, { id: 'answer' })
  r = supplyRequirement(r, ['plan'], 'ask', { by: 'fos', ref: 'answer' }, 4)
  expect(view(r, ['plan'])!.tasks.find(t => t.id === 'ask')!.requirement!.satisfied).toBe(true)
  expect(argumentSupplier(r, ['plan', 'ask'])).toBe('fos')
})

test('a host-minted grant bound with bindIssuedAuthority names its issuer as the supplier', () => {
  let r = addTask(createReplica('owner'), [], 'Offsite', 1, 'offsite')
  r = addRequirement(r, ['offsite'], 'Kickoff hour', 2, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h', start: 5, end: 3_600_005 }, 'slot')
  const allocation = { resource: '', type: 'calendar' as const, amount: 1, unit: 'h', start: 5, end: 3_600_005, by: 'fos' }
  const grant = grantValue(r.store, allocationPattern(r.store, ['offsite'], allocation, true), allocateCapability(r.store, ['offsite']), allocation, { description: { content: 'on Google Calendar' }, peerId: { content: 'fos' } })
  r = bindIssuedAuthority(r, ['offsite', 'slot'], grant, 'fos', 3)
  expect(view(r, ['offsite'])!.tasks.find(t => t.id === 'slot')!.requirement!.satisfied).toBe(true)
  expect(argumentSupplier(r, ['offsite', 'slot'])).toBe('fos')
})

// a requirement with named inputs (mail to/subject): drove a legacy executor; natives answer values (arguments.test.ts, evaluation.test.ts)

test('a bank inside Home is credited by an invocation evaluated there', async () => {
  // the host offers the allocate contract's handler, as the backend's `allocateHandler` does through `hostOffers()`
  const catalogue = createReplica().store
  const definition = { id: 'allocate', label: 'allocate', type: (store: typeof catalogue, at: string[] = []) => libAt(store, at).capabilities.allocate! }
  const type = definition.type(catalogue), ref = nativeRef(catalogue, 'fos', definition)
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['allocate'], native: { peers: { fos: [[type, ref]] }, nodes: Object.fromEntries([...catalogue.table.entries()].map(([cid, node]) => [cid, node])) } } as any)
  r = addBank(r, [HOME_ID], 'Budget', 2, { type: 'account', unit: 'USD' }, 'bank')
  r = issueGrant(r, [HOME_ID, 'bank'], { type: 'account', unit: 'USD', amount: 10 }, 3, 'Initial', 'g0')
  const driver = driverOf(() => r, next => { r = next }, () => [{ native: allocateNative }])
  const result = await evaluateNode([HOME_ID, 'g0'], driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(ownerGrants(r, [HOME_ID, 'bank']).map(g => g.allocation.amount)).toEqual([10])
})

test('a host offering a legacy handler for the allocation capability runs a points requirement without ambiguity', async () => {
  const catalogue = createReplica().store
  const definition = { id: 'points', label: 'allocation', type: (store: typeof catalogue, at: string[] = []) => libAt(store, at).capabilities.allocation! }
  const type = definition.type(catalogue), ref = nativeRef(catalogue, 'fos', definition)
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['allocation'], native: { peers: { fos: [[type, ref]] }, nodes: Object.fromEntries([...catalogue.table.entries()].map(([cid, node]) => [cid, node])) } } as any)
  r = addTask(r, [HOME_ID], 'Survey', 2, 'survey')
  r = addRequirement(r, [HOME_ID, 'survey'], 'reward', 2, { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' }, 'pay')
  const driver = driverOf(() => r, next => { r = next }, step => step.row?.requirement?.resource === 'points' ? [{ native: async (operands, context) => {
    const allocation = { resource: '', type: 'points' as const, amount: 5, unit: 'ff', by: 'fos' }
    const at = context.step.slice(0, -1)
    return { outputs: { self: grantValue(context.store, allocationPattern(context.store, at, allocation, true), allocateCapability(context.store, at), allocation, { description: { content: '5 ff' }, peerId: { content: 'fos' } }) } }
  } }] : [])
  const result = await evaluateNode([HOME_ID, 'survey'], driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(view(r, [HOME_ID, 'survey'])!.tasks.find(t => t.id === 'pay')!.requirement!.satisfied).toBe(true)
  void addAllocation; void resolveScope; void headCid
})

// a handler result written inside the requirement by: drove a legacy executor; natives answer values (arguments.test.ts, evaluation.test.ts)

// a legacy executor binding a host-minted grant: drove a legacy executor; natives answer values (arguments.test.ts, evaluation.test.ts)

test('a bank inside Home is still credited after the account context is ensured again (as every request does)', async () => {
  const catalogue = createReplica().store
  const definition = { id: 'allocate', label: 'allocate', type: (store: typeof catalogue, at: string[] = []) => libAt(store, at).capabilities.allocate! }
  const type = definition.type(catalogue), ref = nativeRef(catalogue, 'fos', definition)
  const offers = { server: ['allocate'], native: { peers: { fos: [[type, ref]] }, nodes: Object.fromEntries([...catalogue.table.entries()].map(([cid, node]) => [cid, node])) } } as any
  let r = ensureHomeContext(createReplica('user:owner'), 1, offers)
  r = addBank(r, [HOME_ID], 'Budget', 2, { type: 'account', unit: 'USD' }, 'bank')
  r = issueGrant(r, [HOME_ID, 'bank'], { type: 'account', unit: 'USD', amount: 10 }, 3, 'Initial', 'g0')
  r = ensureHomeContext(r, 0, offers)
  const driver = driverOf(() => r, next => { r = next }, () => [{ native: allocateNative }])
  const result = await evaluateNode([HOME_ID, 'g0'], driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(ownerGrants(r, [HOME_ID, 'bank']).map(g => g.allocation.amount)).toEqual([10])
})

test('a native runs under a driver that declares `outputs(step)` (the backend driver shape): the compiler must not read it as a list', async () => {
  const catalogue = createReplica().store
  const definition = { id: 'allocate', label: 'allocate', type: (store: typeof catalogue, at: string[] = []) => libAt(store, at).capabilities.allocate! }
  const type = definition.type(catalogue), ref = nativeRef(catalogue, 'fos', definition)
  const offers = { server: ['allocate'], native: { peers: { fos: [[type, ref]] }, nodes: Object.fromEntries([...catalogue.table.entries()].map(([cid, node]) => [cid, node])) } } as any
  let r = ensureHomeContext(createReplica('user:owner'), 1, offers)
  r = addBank(r, [HOME_ID], 'Budget', 2, { type: 'account', unit: 'USD' }, 'bank')
  r = issueGrant(r, [HOME_ID, 'bank'], { type: 'account', unit: 'USD', amount: 10 }, 3, 'Initial', 'g0')
  const driver: EvaluationDriver = { ...driverOf(() => r, next => { r = next }, () => [{ native: allocateNative }]), isPeerActive: () => true }
  const result = await evaluateNode([HOME_ID, 'g0'], driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(ownerGrants(r, [HOME_ID, 'bank']).map(g => g.allocation.amount)).toEqual([10])
})

test('a driver whose isPeerActive knows only the host peers (the backend driver) still resolves the owner\'s own bank declaration', async () => {
  // backend/sync/evaluation.ts answers `isPeerActive` for `fos` and the integration peers it checked; the owner's own
  // rows (peer `user:owner`) are not peers it asks about, yet the resolver treats the bank as unavailable when it says no
  const catalogue = createReplica().store
  const definition = { id: 'allocate', label: 'allocate', type: (store: typeof catalogue, at: string[] = []) => libAt(store, at).capabilities.allocate! }
  const type = definition.type(catalogue), ref = nativeRef(catalogue, 'fos', definition)
  const offers = { server: ['allocate'], native: { peers: { fos: [[type, ref]] }, nodes: Object.fromEntries([...catalogue.table.entries()].map(([cid, node]) => [cid, node])) } } as any
  let r = ensureHomeContext(createReplica('user:owner'), 1, offers)
  r = addBank(r, [HOME_ID], 'Budget', 2, { type: 'account', unit: 'USD' }, 'bank')
  r = issueGrant(r, [HOME_ID, 'bank'], { type: 'account', unit: 'USD', amount: 10 }, 3, 'Initial', 'g0')
  const driver: EvaluationDriver = { ...driverOf(() => r, next => { r = next }, () => [{ native: allocateNative }]), isPeerActive: peer => peer === 'fos' }
  const result = await evaluateNode([HOME_ID, 'g0'], driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(ownerGrants(r, [HOME_ID, 'bank']).map(g => g.allocation.amount)).toEqual([10])
})
