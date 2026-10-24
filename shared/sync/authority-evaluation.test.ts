import { addRefAt, addRow, addTask, createReplica, headCid, renameTask, type Replica } from './replica'
import { content, put, refValueCid, resolveScope, reachableNodes } from './graph'
import { primitiveRef } from './primitives'
import { constructNodeValue, readGraphValue } from './node-values'
import { resolveRefIdentity } from './ref-paths'
import { resolveBinding } from './bindings'
import { planAuthorityTransfer, resolveAuthorityReference, compileAuthorityInvocation, type AuthorityPlan } from './authority-compilation'
import { authorityGrant, authorityReference, authorityState, linearAuthorityUsage, type AuthorityChecker } from './authority'
import { evaluateNode, type EvaluationDriver } from './evaluation'

const binding = (r: Replica, id: string, at: string[] = []) => {
  const found = resolveRefIdentity(r, at, id)
  if (found.status !== 'ready') throw new Error(`Missing test binding ${id}`)
  return found.locations[0]!
}

function fixture() {
  let r = createReplica('owner')
  const type = put(r.store, { data: {}, children: [] })
  const checker: AuthorityChecker = { usage: linearAuthorityUsage, transition: (store, operation) => {
    const sum = (grants: typeof operation.inputs) => grants.reduce((n, grant) => n + (readGraphValue(store, grant.value) as number), 0)
    return sum(operation.inputs) === sum(operation.outputs) ? [] : ['The explicit remainder must conserve authority.']
  } }
  const native = primitiveRef(r.store, { id: 'checking-handler', type, host: 'owner', native: { authority: checker } })
  const checking = refValueCid(r.store, content(r.store, native))!
  const original = authorityGrant(r.store, checking, constructNodeValue(r.store, 10).cid)
  const declaration = put(r.store, { data: { refDeclaration: { slot: 0 } }, children: [] })
  const state = authorityState(r.store, [[declaration, original]])
  const ownerExpression = put(r.store, { data: { ref: { id: 'authority' } }, children: [] })
  const reference = authorityReference(r.store, ownerExpression, declaration)
  r = addRefAt(r, [], 'authority', type, 1, state, 'authority')
  r = addRefAt(r, [], 'parent', type, 2, reference, 'parent')
  r = addRefAt(r, [], 'copy', type, 3, reference, 'copy')
  r = addRefAt(r, [], 'child', type, 4, null, 'child')
  const program = planAuthorityTransfer(r, ['split'], {
    operations: [{ inputs: [{ binding: binding(r, 'parent') }], outputs: [6, 4].map(n => constructNodeValue(r.store, n).cid) }],
    rebindings: [
      { binding: binding(r, 'child'), result: { operation: 0, output: 0 } },
      { binding: binding(r, 'parent'), result: { operation: 0, output: 1 } }
    ]
  })
  r = addRow(r, [], program, 'Split authority', 5, { id: 'split' })
  let clock = 10
  const driver: EvaluationDriver = { get: () => r, save: next => { r = next }, now: () => ++clock, check: () => [], executors: () => [] }
  const current = () => resolveBinding(r.store, null, binding(r, 'authority'), [], undefined, { checkDependencies: false }).cid!
  const amount = (id: string) => readGraphValue(r.store, resolveAuthorityReference(r, binding(r, id)).grant.value)
  return { get: () => r, set: (next: Replica) => { r = next }, driver, state, current, amount, program, type }
}

test('normal evaluation defers the split and atomically publishes child, remainder and owner state', async () => {
  const f = fixture()
  f.driver.commit = async () => {
    expect(f.current()).toBe(f.state)
    expect(f.amount('parent')).toBe(10)
  }
  const compiled = compileAuthorityInvocation(f.get(), f.program, ['split'])
  const graph = JSON.stringify(reachableNodes(f.get().store, [compiled.cid]))
  expect(graph).not.toContain('"ref"')
  expect(graph).not.toContain('"alias"')
  const result = await evaluateNode(['split'], f.driver)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe('committed')
  expect(f.current()).not.toBe(f.state)
  expect(f.amount('parent')).toBe(4)
  expect(f.amount('child')).toBe(6)
  expect(() => f.amount('copy')).toThrow(/consumed/)
  await expect(evaluateNode(['split'], f.driver)).rejects.toThrow(/changed before commit/)
})

test('copies cannot supply a second input grant, and stale copies cannot be split after commit', async () => {
  const f = fixture(), r = f.get()
  expect(() => planAuthorityTransfer(r, ['bad'], {
    operations: [{ inputs: [binding(r, 'parent'), binding(r, 'copy')].map(binding => ({ binding })), outputs: [constructNodeValue(r.store, 20).cid] }],
    rebindings: [{ binding: binding(r, 'child'), result: { operation: 0, output: 0 } }]
  })).toThrow(/same grant twice/)
  await evaluateNode(['split'], f.driver)
  expect(() => planAuthorityTransfer(f.get(), ['bad'], {
    operations: [{ inputs: [{ binding: binding(f.get(), 'copy') }], outputs: [] }], rebindings: []
  })).toThrow(/consumed/)
})

test('a subsequent split consumes the parent remainder through the same owner', async () => {
  const f = fixture()
  await evaluateNode(['split'], f.driver)
  let r = addRefAt(f.get(), [], 'second-child', f.type, 30, null, 'second-child')
  const program = planAuthorityTransfer(r, ['split-again'], {
    operations: [{ inputs: [{ binding: binding(r, 'parent') }], outputs: [3, 1].map(n => constructNodeValue(r.store, n).cid) }],
    rebindings: [
      { binding: binding(r, 'second-child'), result: { operation: 0, output: 0 } },
      { binding: binding(r, 'parent'), result: { operation: 0, output: 1 } }
    ]
  })
  r = addRow(r, [], program, 'Split remainder', 31, { id: 'split-again' }); f.set(r)
  expect((await evaluateNode(['split-again'], f.driver)).status).toBe('committed')
  expect(f.amount('parent')).toBe(1)
  expect(f.amount('child')).toBe(6)
  expect(f.amount('second-child')).toBe(3)
})

test('failure before commit leaves authority unchanged and preserves unrelated edits', async () => {
  const f = fixture()
  f.set(addTask(f.get(), [], 'Unrelated', 6, 'unrelated'))
  f.driver.commit = async () => {
    f.set(renameTask(f.get(), [], 'unrelated', 'Keep this edit', 30))
    throw new Error('External commit failed')
  }
  const result = await evaluateNode(['split'], f.driver)
  expect(result.status).toBe('rolled-back')
  expect(f.current()).toBe(f.state)
  expect(f.amount('parent')).toBe(10)
  expect(resolveScope(f.get().store, headCid(f.get()), ['unrelated'])).toBeTruthy()
})

test('competing changes to the owner or output refs abort before publication', async () => {
  const f = fixture()
  f.driver.open = async () => { f.set(renameTask(f.get(), [], 'child', 'Changed destination', 30)) }
  const result = await evaluateNode(['split'], f.driver)
  expect(result.status).toBe('rolled-back')
  expect(result.error).toMatch(/changed before commit/)
  expect(f.current()).toBe(f.state)
  expect(f.amount('parent')).toBe(10)
})

test('identical states under distinct owners remain independent authorities', async () => {
  const f = fixture()
  let r = addRefAt(f.get(), [], 'second-owner', f.type, 6, f.state, 'second-owner')
  const first = resolveAuthorityReference(r, binding(r, 'parent'))
  const owner = put(r.store, { data: { ref: { id: 'second-owner' } }, children: [] })
  r = addRefAt(r, [], 'independent', f.type, 7, authorityReference(r.store, owner, first.grant.ref), 'independent')
  f.set(r)
  expect((await evaluateNode(['split'], f.driver)).status).toBe('committed')
  expect(f.amount('independent')).toBe(10)
  expect(f.amount('parent')).toBe(4)
  expect(() => planAuthorityTransfer(f.get(), ['join'], {
    operations: [{ inputs: [binding(f.get(), 'parent'), binding(f.get(), 'independent')].map(binding => ({ binding })), outputs: [] }], rebindings: []
  }))
    .toThrow(/unrelated owners cannot commit atomically/)
})

test('an inherited handle retains its owner despite a nearer owner with the same name', async () => {
  const f = fixture()
  let r = addTask(f.get(), [], 'Group', 6, 'group')
  r = addRefAt(r, ['group'], 'local-authority', f.type, 7, f.state, 'authority')
  const program = planAuthorityTransfer(r, ['group', 'nested-split'], {
    operations: [{ inputs: [{ binding: binding(r, 'parent', ['group']) }], outputs: [4, 6].map(n => constructNodeValue(r.store, n).cid) }],
    rebindings: [
      { binding: binding(r, 'parent'), result: { operation: 0, output: 0 } },
      { binding: binding(r, 'child'), result: { operation: 0, output: 1 } }
    ]
  })
  r = addRow(r, ['group'], program, 'Split outer authority', 8, { id: 'nested-split' }); f.set(r)
  expect((await evaluateNode(['group'], f.driver)).status).toBe('committed')
  const local = resolveBinding(f.get().store, null, binding(f.get(), 'local-authority', ['group']), [], undefined, { checkDependencies: false })
  expect(local.cid).toBe(f.state)
  expect(f.amount('parent')).toBe(4)
})

test('missing or inaccessible owners cannot be replaced by cached grant values', () => {
  const f = fixture(), r = f.get()
  expect(() => resolveAuthorityReference(r, binding(r, 'parent'), { canRead: (_store, _cid, path) => path.at(-1) !== 'authority' }))
    .toThrow(/accessible scoped authority ref/)
  const owner = put(r.store, { data: { ref: { id: 'missing-owner' } }, children: [] })
  const grant = resolveAuthorityReference(r, binding(r, 'parent')).grant
  const isolated = addRefAt(r, [], 'missing-owner-copy', f.type, 30, authorityReference(r.store, owner, grant.ref), 'missing-owner-copy')
  expect(() => resolveAuthorityReference(isolated, binding(isolated, 'missing-owner-copy'))).toThrow(/accessible scoped authority ref/)
})

function nestedPlan(r: Replica): AuthorityPlan {
  const values = (amounts: number[]) => amounts.map(n => constructNodeValue(r.store, n).cid)
  return {
    operations: [
      { inputs: [{ binding: binding(r, 'parent') }], outputs: values([6, 4]) },
      { inputs: [{ result: { operation: 0, output: 0 } }], outputs: values([2, 4]) }
    ],
    rebindings: [
      { binding: binding(r, 'parent'), result: { operation: 0, output: 1 } },
      { binding: binding(r, 'child'), result: { operation: 1, output: 1 } },
      { binding: binding(r, 'grandchild'), result: { operation: 1, output: 0 } }
    ]
  }
}

test('nested allocations form one checked invocation and publish only their final grants', async () => {
  const f = fixture()
  let r = addRefAt(f.get(), [], 'grandchild', f.type, 6, null, 'grandchild')
  const program = planAuthorityTransfer(r, ['nested'], nestedPlan(r))
  r = addRow(r, [], program, 'Nested allocations', 7, { id: 'nested' }); f.set(r)
  const compiled = compileAuthorityInvocation(r, program, ['nested'])
  expect(JSON.stringify(reachableNodes(r.store, [compiled.cid]))).not.toMatch(/"ref"|"alias"|"grandchild"|"parent"/)
  expect(f.current()).toBe(f.state)
  f.driver.commit = async () => {
    expect(f.amount('parent')).toBe(10)
    expect(resolveBinding(r.store, null, binding(r, 'child'), [], undefined, { checkDependencies: false }).status).not.toBe('ready')
  }
  expect((await evaluateNode(['nested'], f.driver)).status).toBe('committed')
  expect(f.amount('parent')).toBe(4)
  expect(f.amount('child')).toBe(4)
  expect(f.amount('grandchild')).toBe(2)
  const parent = resolveAuthorityReference(f.get(), binding(f.get(), 'parent'))
  const child = resolveAuthorityReference(f.get(), binding(f.get(), 'child'))
  expect(child.grant.cid).toBe(parent.grant.cid)
  expect(child.grant.ref).not.toBe(parent.grant.ref)
  expect(content(r.store, f.current()).data.authorityFrame?.revision).toBe(1)
})

test('aborting a composed invocation publishes neither intermediate nor final grants', async () => {
  const f = fixture()
  let r = addRefAt(f.get(), [], 'grandchild', f.type, 6, null, 'grandchild')
  const program = planAuthorityTransfer(r, ['nested'], nestedPlan(r))
  r = addRow(r, [], program, 'Nested allocations', 7, { id: 'nested' }); f.set(r)
  f.driver.commit = async () => { throw new Error('External failure') }
  expect((await evaluateNode(['nested'], f.driver)).status).toBe('rolled-back')
  expect(f.current()).toBe(f.state)
  expect(f.amount('parent')).toBe(10)
  expect(f.amount('copy')).toBe(10)
  for (const id of ['child', 'grandchild'])
    expect(resolveBinding(f.get().store, null, binding(f.get(), id), [], undefined, { checkDependencies: false }).status).not.toBe('ready')
})

test('planning uses the execution checker for duplicate consumption, missing remainder and consumed outputs', () => {
  const f = fixture(), r = addRefAt(f.get(), [], 'grandchild', f.type, 6, null, 'grandchild'), root = headCid(r)
  const twice = nestedPlan(r)
  twice.operations.push(twice.operations[1]!)
  expect(() => planAuthorityTransfer(r, ['nested'], twice)).toThrow(/exactly once/)
  const missing = nestedPlan(r)
  missing.operations[1]!.outputs.pop()
  missing.rebindings = missing.rebindings.filter(output => output.binding.id !== 'child')
  expect(() => planAuthorityTransfer(r, ['nested'], missing)).toThrow(/remainder/)
  const consumed = nestedPlan(r)
  consumed.rebindings[1]!.result = { operation: 0, output: 0 }
  expect(() => planAuthorityTransfer(r, ['nested'], consumed)).toThrow(/output grant is unavailable/)
  const conflicting = nestedPlan(r)
  conflicting.rebindings[2]!.binding = binding(r, 'child')
  expect(() => planAuthorityTransfer(r, ['nested'], conflicting)).toThrow(/Contradictory/)
  expect(headCid(r)).toBe(root)
})

test('operation inputs require an explicit preceding output and reject cycles or missing paths', () => {
  const f = fixture(), r = addRefAt(f.get(), [], 'grandchild', f.type, 6, null, 'grandchild')
  for (const result of [{ operation: 1, output: 0 }, { operation: 2, output: 0 }, { operation: 0, output: 7 }, { operation: -1, output: 0 }]) {
    const plan = nestedPlan(r)
    plan.operations[1]!.inputs = [{ result }]
    expect(() => planAuthorityTransfer(r, ['nested'], plan)).toThrow(/explicit authority operation output|missing or depends on a later operation/)
  }
})

test('an accessible owner does not make a private grant ref accessible to sibling invocations', () => {
  const f = fixture()
  let r = addTask(f.get(), [], 'Private', 6, 'private')
  const parent = resolveAuthorityReference(r, binding(r, 'parent'))
  const owner = put(r.store, { data: { ref: { id: 'authority' } }, children: [] })
  r = addRefAt(r, ['private'], 'private-grant', f.type, 7, authorityReference(r.store, owner, parent.grant.ref), 'private grant')
  for (const at of [['sibling'], ['private']])
    expect(() => planAuthorityTransfer(r, at, {
      operations: [{ inputs: [{ binding: binding(r, 'private-grant', ['private']) }], outputs: [constructNodeValue(r.store, 10).cid] }],
      rebindings: [{ binding: binding(r, 'child'), result: { operation: 0, output: 0 } }]
    })).toThrow(/accessible scoped authority ref/)
})

test('one owner can compose independent domains without substituting either checking contract', async () => {
  let r = createReplica('owner')
  const type = put(r.store, { data: {}, children: [] })
  const policies: AuthorityChecker[] = [
    { usage: linearAuthorityUsage, transition: (store, operation) =>
      operation.inputs.length === 1 && operation.outputs.length === 1 && readGraphValue(store, operation.inputs[0]!.value) === readGraphValue(store, operation.outputs[0]!.value)
        ? [] : ['Keep the supplied amount.'] },
    { usage: linearAuthorityUsage, transition: (store, operation) =>
      operation.inputs.length === 1 && operation.outputs.length === 1 && readGraphValue(store, operation.inputs[0]!.value) === 'room A' && readGraphValue(store, operation.outputs[0]!.value) === 'room B'
        ? [] : ['Only the authorized move is allowed.'] }
  ]
  const checkers = policies.map((policy, index) => refValueCid(r.store, content(r.store,
    primitiveRef(r.store, { id: `policy-${index}`, type, host: 'owner', native: { authority: policy } })))!)
  const slots = [0, 1].map(slot => put(r.store, { data: { refDeclaration: { slot } }, children: [] }))
  const state = authorityState(r.store, [10, 'room A'].map((value, index) =>
    [slots[index]!, authorityGrant(r.store, checkers[index]!, constructNodeValue(r.store, value).cid)]))
  r = addRefAt(r, [], 'authority', type, 1, state, 'authority')
  const owner = put(r.store, { data: { ref: { id: 'authority' } }, children: [] })
  for (const [index, id] of ['amount', 'location'].entries())
    r = addRefAt(r, [], id, type, 2, authorityReference(r.store, owner, slots[index]!), id)
  const plan: AuthorityPlan = {
    operations: ['amount', 'location'].map((id, index) => ({ inputs: [{ binding: binding(r, id) }], outputs: [constructNodeValue(r.store, [10, 'room B'][index]).cid] })),
    rebindings: ['amount', 'location'].map((id, operation) => ({ binding: binding(r, id), result: { operation, output: 0 } }))
  }
  const program = planAuthorityTransfer(r, ['transfer'], plan)
  r = addRow(r, [], program, 'Transfer', 3, { id: 'transfer' })
  const joined: AuthorityPlan = {
    operations: [{ inputs: ['amount', 'location'].map(id => ({ binding: binding(r, id) })), outputs: [constructNodeValue(r.store, 10).cid] }], rebindings: []
  }
  expect(() => planAuthorityTransfer(r, ['join'], joined)).toThrow(/checking contracts explicitly/)
  expect((await evaluateNode(['transfer'], { get: () => r, save: next => { r = next }, now: () => 10, check: () => [], executors: () => [] })).status).toBe('committed')
  expect(readGraphValue(r.store, resolveAuthorityReference(r, binding(r, 'location')).grant.value)).toBe('room B')
  for (const [index, id] of ['amount', 'location'].entries())
    expect(resolveAuthorityReference(r, binding(r, id)).grant.checker).toBe(checkers[index])
})
