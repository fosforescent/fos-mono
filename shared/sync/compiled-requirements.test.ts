import { addRow, addSupply, addTask, assertCompiledGraph, checkCompiledRequirement, checkCompiledRequirementOutput, compileRefGraph, compileRequirement, content, createReplica, deleteTask, destructureRequirement, headCid, importNodes, reachableNodes, requirementOutputs, resolveScope, nestScope, commitRoot, updateAtScope, ALLOCATION_TYPE } from './index'
import { FosStore } from '../dag-implementation/store'

const build = (prefix: string) => {
  let r = addTask(createReplica('owner'), [], 'Work', 1, prefix + '-work')
  r = addRow(r, [prefix + '-work'], ALLOCATION_TYPE, 'Budget', 2, { id: prefix + '-budget', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
  r = addRow(r, [prefix + '-work'], ALLOCATION_TYPE, 'Funding', 3, { id: prefix + '-funding', allocation: { resource: '', type: 'account', amount: 50, unit: 'USD' } })
  r = addSupply(r, [prefix + '-work'], prefix + '-budget', { capability: 'allocation', by: 'owner', ref: prefix + '-funding' }, 4)
  r = destructureRequirement(r, [prefix + '-work', prefix + '-budget'], 'slice', 20, 5)
  return { r, path: [prefix + '-work', prefix + '-budget'] }
}

test('supply evidence and projected outputs compile independently of editor identities and run in an isolated store', () => {
  const a = build('550e8400-e29b-41d4-a716-446655440000'), b = build('different-editor')
  const source = resolveScope(a.r.store, headCid(a.r), a.path)!
  const cid = compileRequirement(a.r.store, source)
  expect(cid).toBe(compileRequirement(b.r.store, resolveScope(b.r.store, headCid(b.r), b.path)!))
  const nodes = reachableNodes(a.r.store, [cid])
  expect(JSON.stringify(nodes)).not.toContain('550e8400-e29b-41d4-a716-446655440000')
  const isolated = createReplica('isolated').store
  importNodes(isolated, nodes)
  expect(checkCompiledRequirement(isolated, cid)).toEqual({ satisfied: true, progress: { have: 50, need: 50 }, problems: [] })
  const projected = checkCompiledRequirementOutput(isolated, cid, 0)
  expect(projected.error).toBeUndefined()
  assertCompiledGraph(isolated, [projected.cid!])
  expect(content(isolated, projected.cid!).data.allocation?.amount).toBe(20)
  const output = requirementOutputs(a.r.store, source)[0]!
  const compiled = compileRefGraph(a.r, output.cid, [...a.path, output.id])
  expect(compiled.complete).toBe(true)
  expect(compiled.cid).toBe(projected.cid)
  a.r = deleteTask(a.r, [a.path[0]!], '550e8400-e29b-41d4-a716-446655440000-funding', 6)
  expect(checkCompiledRequirement(isolated, cid).satisfied).toBe(true)
  const changed = compileRequirement(a.r.store, resolveScope(a.r.store, headCid(a.r), a.path)!)
  expect(checkCompiledRequirement(a.r.store, changed).satisfied).toBe(false)
})

test('repeated supplies of the same allocation count once while separate equal-valued allocations count separately', () => {
  let r = addRow(createReplica('owner'), [], ALLOCATION_TYPE, 'Budget', 1, { id: 'budget', requirement: { capability: 'allocation', resource: 'account', amount: 100, unit: 'USD' } })
  r = addRow(r, ['budget'], ALLOCATION_TYPE, 'Funding', 2, { id: 'funding', allocation: { resource: '', type: 'account', amount: 50, unit: 'USD' } })
  for (const by of ['one', 'two']) r = addSupply(r, [], 'budget', { capability: 'allocation', by, ref: 'funding' }, 3)
  const check = () => checkCompiledRequirement(r.store, compileRequirement(r.store, resolveScope(r.store, headCid(r), ['budget'])!))
  expect(check()).toEqual({ satisfied: false, progress: { have: 50, need: 100 }, problems: [] })
  r = addRow(r, ['budget'], ALLOCATION_TYPE, 'Funding', 4, { id: 'second', allocation: { resource: '', type: 'account', amount: 50, unit: 'USD' } })
  expect(check()).toEqual({ satisfied: true, progress: { have: 100, need: 100 }, problems: [] })
  for (const id of ['funding', 'second']) commitRoot(r.store, updateAtScope(r.store, headCid(r), ['budget', id], node => ({ ...node, data: { ...node.data, name: { content: 'same ref' } } })), 5)
  expect(check().progress?.have).toBe(50)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['budget', 'second'], node => ({ ...node, data: { ...node.data, allocation: { ...node.data.allocation!, unit: 'EUR' } } })), 6)
  expect(check().problems).toContain('Conflicting supplied allocations for the same reference.')
})

test('a cached sibling supply is unavailable until explicitly declared in scope', () => {
  let r = addTask(createReplica(), [], 'Private', 1, 'private')
  r = addRow(r, ['private'], ALLOCATION_TYPE, 'Funding', 2, { id: 'hidden', allocation: { resource: '', type: 'account', amount: 50, unit: 'USD' } })
  r = addRow(r, [], ALLOCATION_TYPE, 'Budget', 3, { id: 'budget', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
  r = addRow(r, ['budget'], ALLOCATION_TYPE, 'Hidden supply', 4, { supply: { capability: 'allocation', by: 'owner', at: 4, ref: 'hidden' } })
  const checked = checkCompiledRequirement(r.store, compileRequirement(r.store, resolveScope(r.store, headCid(r), ['budget'])!))
  expect(checked.satisfied).toBe(false)
  expect(checked.progress?.have).toBe(0)
  expect(checked.problems).toEqual([expect.stringMatching(/unavailable in this scope/)])
})

test('denied supplies and output dependencies cannot enter compiled evidence', () => {
  const { r, path } = build('editor')
  const source = resolveScope(r.store, headCid(r), path)!
  const access = { canRead: (_store: typeof r.store, _cid: string, at: string[]) => at.at(-1) !== 'editor-funding' }
  const cid = compileRequirement(r.store, source, path, access)
  expect(checkCompiledRequirement(r.store, cid).satisfied).toBe(false)
  expect(checkCompiledRequirement(r.store, cid).progress?.have).toBe(0)
  const output = requirementOutputs(r.store, source)[0]!
  expect(compileRefGraph(r, output.cid, [...path, output.id], access).complete).toBe(false)
  const blocked = compileRequirement(r.store, source, path, { canRead: () => false })
  expect(JSON.stringify(reachableNodes(r.store, [blocked]))).not.toContain('USD')
  expect(checkCompiledRequirement(r.store, blocked).satisfied).toBe(false)
})

test('an output inherited from an enclosing store compiles its evidence in the declaring scope', () => {
  const { r: outer, path } = build('outer')
  const source = resolveScope(outer.store, headCid(outer), path)!
  const output = requirementOutputs(outer.store, source)[0]!
  const inner = createReplica('inner', new FosStore())
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: path.slice(0, -1) })
  importNodes(inner.store, reachableNodes(outer.store, [output.cid]))
  const compiled = compileRefGraph(inner, output.cid, ['consumer'])
  expect(compiled.complete).toBe(true)
  expect(content(inner.store, compiled.cid).data.allocation?.amount).toBe(20)
  assertCompiledGraph(inner.store, [compiled.cid])
})
