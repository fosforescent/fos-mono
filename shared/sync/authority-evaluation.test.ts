import { addRefAt, addRow, addTask, createReplica, headCid, renameTask, type Replica } from './replica'
import { content, put, refValueCid, resolveScope, reachableNodes } from './graph'
import { primitiveRef } from './primitives'
import { constructNodeValue, readGraphValue } from './node-values'
import { resolveRefIdentity } from './ref-paths'
import { resolveBinding } from './bindings'
import { planAuthorityTransfer, resolveAuthorityReference, compileAuthorityInvocation } from './authority-compilation'
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
  const program = planAuthorityTransfer(r, ['split'], [binding(r, 'parent')], [
    { binding: binding(r, 'child'), value: constructNodeValue(r.store, 6).cid },
    { binding: binding(r, 'parent'), value: constructNodeValue(r.store, 4).cid }
  ])
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
  expect(() => planAuthorityTransfer(r, ['bad'], [binding(r, 'parent'), binding(r, 'copy')], [
    { binding: binding(r, 'child'), value: constructNodeValue(r.store, 20).cid }
  ])).toThrow(/same grant twice/)
  await evaluateNode(['split'], f.driver)
  expect(() => planAuthorityTransfer(f.get(), ['bad'], [binding(f.get(), 'copy')], [])).toThrow(/consumed/)
})

test('a subsequent split consumes the parent remainder through the same owner', async () => {
  const f = fixture()
  await evaluateNode(['split'], f.driver)
  let r = addRefAt(f.get(), [], 'second-child', f.type, 30, null, 'second-child')
  const program = planAuthorityTransfer(r, ['split-again'], [binding(r, 'parent')], [
    { binding: binding(r, 'second-child'), value: constructNodeValue(r.store, 3).cid },
    { binding: binding(r, 'parent'), value: constructNodeValue(r.store, 1).cid }
  ])
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
  expect(() => planAuthorityTransfer(f.get(), ['join'], [binding(f.get(), 'parent'), binding(f.get(), 'independent')], []))
    .toThrow(/unrelated owners cannot commit atomically/)
})

test('an inherited handle retains its owner despite a nearer owner with the same name', async () => {
  const f = fixture()
  let r = addTask(f.get(), [], 'Group', 6, 'group')
  r = addRefAt(r, ['group'], 'local-authority', f.type, 7, f.state, 'authority')
  const program = planAuthorityTransfer(r, ['group', 'nested-split'], [binding(r, 'parent', ['group'])], [
    { binding: binding(r, 'parent'), value: constructNodeValue(r.store, 4).cid },
    { binding: binding(r, 'child'), value: constructNodeValue(r.store, 6).cid }
  ])
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
