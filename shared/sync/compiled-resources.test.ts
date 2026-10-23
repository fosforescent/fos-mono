import { addRow, addTask, addMemberAt, checkCompiledResources, compileResources, content, createReplica, evaluationSteps, headCid, importNodes, reachableNodes, commitRoot, updateAtScope, put, refNodeContent, setHandlerOffersAt, setHandlerEnabledAt, resourceHandlers } from './index'
import { ALLOCATION_TYPE, RESOURCE_TYPE } from './library-types'
import { FosStore } from '../dag-implementation/store'
import { nestScope } from './graph'

const example = (prefix: string) => {
  let r = createReplica('owner')
  for (const suffix of ['one', 'two']) {
    const group = prefix + '-' + suffix
    r = addTask(r, [], 'Group', 1, group)
    r = addRow(r, [group], RESOURCE_TYPE, 'Drill', 2, { id: prefix + '-bank', resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
    r = addRow(r, [group], ALLOCATION_TYPE, 'Reservation', 3, { id: prefix + '-claim', allocation: { resource: prefix + '-bank', type: 'inventory', unit: 'drill', amount: 1 } })
  }
  return r
}

test('resource compilation removes editor identities and preserves distinct equal-valued declarations', () => {
  const a = example('550e8400-e29b-41d4-a716-446655440000'), b = example('ab078f34-6048-42cb-bf33-8b1c49e823da')
  const compiled = compileResources(a, evaluationSteps(a, []))
  expect(compiled.problems).toEqual([])
  expect(compiled.cid).toBe(compileResources(b, evaluationSteps(b, [])).cid)
  expect(content(a.store, compiled.cid).children).toHaveLength(2)
  expect(new Set(content(a.store, compiled.cid).children.map(([ref]) => ref)).size).toBe(2)
  const nodes = reachableNodes(a.store, [compiled.cid])
  expect(JSON.stringify(nodes)).not.toContain('550e8400-e29b-41d4-a716-446655440000')
  const isolated = createReplica('isolated').store
  importNodes(isolated, nodes)
  expect(checkCompiledResources(isolated, compiled.cid)).toEqual([])
})

test('accounting snapshots remain pinned, while recompilation includes changed capacity and competing claims', () => {
  let r = example('editor')
  const selected = evaluationSteps(r, ['editor-one']), before = compileResources(r, selected)
  const bankPath = ['editor-one', 'editor-bank']
  commitRoot(r.store, updateAtScope(r.store, headCid(r), bankPath, value => ({ ...value, data: { ...value.data, resource: { ...value.data.resource!, capacity: 0 } } })), 4)
  expect(checkCompiledResources(r.store, before.cid)).toEqual([])
  expect(checkCompiledResources(r.store, compileResources(r, selected).cid)).toEqual([expect.stringMatching(/Insufficient Drill/)])
  r = addRow(r, ['editor-two'], ALLOCATION_TYPE, 'Another reservation', 5, { allocation: { resource: 'editor-bank', type: 'inventory', unit: 'drill', amount: 1 } })
  expect(checkCompiledResources(r.store, compileResources(r, evaluationSteps(r, ['editor-two'])).cid)).toEqual([expect.stringMatching(/Insufficient Drill/)])
})

test('an unresolved bank stops compilation instead of becoming a funded allocation', () => {
  const r = addRow(createReplica(), [], ALLOCATION_TYPE, 'Unbound claim', 1, { id: 'claim', allocation: { resource: 'missing', type: 'inventory', unit: 'drill', amount: 1 } })
  expect(compileResources(r, evaluationSteps(r, ['claim'])).problems).toEqual([expect.stringMatching(/unavailable in this scope/)])
})

test('same-name handlers in one scope bind the same resource ref; contradictory values require resolution', () => {
  let r = createReplica('owner')
  for (const id of ['one', 'two']) {
    r = addRow(r, [], RESOURCE_TYPE, 'Tools', 1, { id, resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
    r = addRow(r, [], ALLOCATION_TYPE, 'Reserve', 2, { allocation: { resource: id, type: 'inventory', unit: 'drill', amount: 1 } })
  }
  const compiled = compileResources(r, evaluationSteps(r, []))
  expect(compiled.problems).toEqual([])
  expect(content(r.store, compiled.cid).children).toHaveLength(1)
  expect(checkCompiledResources(r.store, compiled.cid)).toEqual([expect.stringMatching(/Insufficient Tools/)])
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['two'], value => ({ ...value, data: { ...value.data, resource: { ...value.data.resource!, capacity: 2 } } })), 3)
  expect(compileResources(r, evaluationSteps(r, [])).problems).toEqual(expect.arrayContaining([expect.stringMatching(/Incompatible bindings/)]))
})

test('a resource handler inherited from an enclosing store includes that store\'s competing allocations', () => {
  let outer = addRow(createReplica('outer'), [], RESOURCE_TYPE, 'Tools', 1, { id: 'bank', resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
  outer = addRow(outer, [], ALLOCATION_TYPE, 'Already reserved', 2, { allocation: { resource: 'bank', type: 'inventory', unit: 'drill', amount: 1 } })
  let inner = createReplica('inner', new FosStore())
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: [] })
  inner = addRow(inner, [], ALLOCATION_TYPE, 'Another claim', 3, { allocation: { resource: 'bank', type: 'inventory', unit: 'drill', amount: 1 } })
  const compiled = compileResources(inner, evaluationSteps(inner, []))
  expect(compiled.problems).toEqual([])
  expect(checkCompiledResources(inner.store, compiled.cid)).toEqual([expect.stringMatching(/Insufficient Tools/)])
})

test('peer-offered banks bind in the declaring group and share accounting across child scopes', () => {
  let r = addTask(createReplica('owner'), [], 'Group', 1, 'group')
  r = addMemberAt(r, ['group'], 'remote', 'Remote', [], 2)
  const type = put(r.store, { data: { resource: { type: 'inventory', unit: 'drill' } }, children: [] })
  const value = put(r.store, { data: { resource: { type: 'inventory', unit: 'drill', capacity: 1 }, description: { content: 'Tools' } }, children: [] })
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'bank' }, name: { content: 'Tools' } }, value, []))
  r = setHandlerOffersAt(r, ['group'], 'remote', type, [handler], 3)
  for (const id of ['one', 'two']) {
    r = addTask(r, ['group'], id, 4, id)
    r = addRow(r, ['group', id], ALLOCATION_TYPE, 'Claim', 5, { allocation: { resource: 'bank', type: 'inventory', unit: 'drill', amount: 1 } })
  }
  expect(resourceHandlers(r, ['group', 'one']).map(handler => handler.row.id)).toEqual(['bank'])
  const compiled = compileResources(r, evaluationSteps(r, ['group']))
  expect(compiled.problems).toEqual([])
  expect(content(r.store, compiled.cid).children).toHaveLength(1)
  expect(checkCompiledResources(r.store, compiled.cid)).toEqual([expect.stringMatching(/Insufficient Tools/)])
  r = addRow(r, ['group', 'one'], RESOURCE_TYPE, 'Tools', 6, { id: 'local-bank', resource: { type: 'inventory', unit: 'drill', capacity: 3 } })
  expect(resourceHandlers(r, ['group', 'one']).map(handler => handler.row.id)).toEqual(['local-bank'])
  // The inherited editor locator binds the nearest declaration of that ref's name.
  const overridden = compileResources(r, evaluationSteps(r, ['group']))
  expect(overridden.problems).toEqual([])
  expect(content(r.store, overridden.cid).children).toHaveLength(2)
  expect(checkCompiledResources(r.store, overridden.cid)).toEqual([])
  r = setHandlerEnabledAt(r, ['group'], 'remote', 'bank', false, 6)
  expect(compileResources(r, evaluationSteps(r, ['group'])).problems).toEqual([
    expect.stringMatching(/unavailable in this scope/), expect.stringMatching(/unavailable in this scope/)
  ])
})
