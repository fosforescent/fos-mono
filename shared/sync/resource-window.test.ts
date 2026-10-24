import { randomUUID } from 'node:crypto'
import { resourceWindow, resourceWindowContains, resourceWindowSatisfies } from './resource-window'
import { allocationMatches, resolveScope, valueContent } from './graph'
import { addRow, createReplica, headCid, view } from './replica'
import { ALLOCATION_TYPE, RESOURCE_TYPE } from './library-types'
import { compileRequirement, checkCompiledRequirement } from './compiled-requirements'
import { executionInput, consumption } from './execution-access'
import { executionInputs } from './sharing'

// jsdom's Crypto omits this browser API; use the real host implementation for authoring.
beforeAll(() => Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID }))

test('null independently opens either time bound; zero remains a real timestamp', () => {
  expect(resourceWindow({})).toEqual({ start: null, end: null })
  expect(resourceWindow({ start: 0 })).toEqual({ start: 0, end: null })
  expect(resourceWindowContains({ start: null, end: 10 }, { start: -100, end: 10 })).toBe(true)
  expect(resourceWindowContains({ start: 0, end: null }, { start: 10, end: 100 })).toBe(true)
  expect(resourceWindowContains({ start: null, end: null }, { start: null, end: null })).toBe(true)
  expect(resourceWindowContains({ start: 0, end: null }, { start: null, end: 100 })).toBe(false)
  expect(resourceWindowContains({ start: null, end: 10 }, { start: 0, end: null })).toBe(false)
})

test('invalid and inverted bounds cannot authorize a resource use', () => {
  for (const window of [{ start: NaN }, { end: Infinity }, { start: 2, end: 1 }, { start: '0' as unknown as number }]) {
    expect(() => resourceWindow(window)).toThrow(/time bounds/)
    expect(resourceWindowContains({}, window)).toBe(false)
    expect(resourceWindowContains(window, {})).toBe(false)
    expect(resourceWindowSatisfies(window, {})).toBe(false)
  }
})

test('unconstrained demand may accept a bounded supply without widening that supply', () => {
  expect(resourceWindowSatisfies({ start: 10, end: 20 }, { start: null, end: null })).toBe(true)
  expect(resourceWindowSatisfies({ start: null, end: null }, { start: 10, end: 20 })).toBe(true)
  expect(resourceWindowSatisfies({ start: 10, end: 20 }, { start: 5, end: null })).toBe(false)
  expect(resourceWindowSatisfies({ start: 10, end: 20 }, { start: null, end: 25 })).toBe(false)
  expect(resourceWindowSatisfies({ start: 10, end: 20 }, { start: 25, end: null })).toBe(false)
  expect(resourceWindowSatisfies({ start: 10, end: 20 }, { start: null, end: 5 })).toBe(false)
})

test('execution input retains supplied bounds, and consumption cannot widen them', () => {
  let r = createReplica('owner')
  r = addRow(r, [], ALLOCATION_TYPE, 'Payment', 1, { id: 'demand', requirement: { capability: 'allocation', resource: 'account', amount: 6, unit: 'USD' } })
  const field = executionInputs(r, ['demand'])[0]!
  r = executionInput(r, ['demand'], { revision: headCid(r), key: field.key, value: { amount: 6, type: 'account', unit: 'USD', start: 10, end: 20 } }, 'owner', 2)
  expect(view(r, ['demand'])!.tasks.find(row => row.allocation)!.allocation).toMatchObject({ start: 10, end: 20 })
  r = addRow(r, [], ALLOCATION_TYPE, 'Available', 3, { id: 'available', allocation: { resource: '', type: 'inventory', amount: 6, unit: 'unit', start: 10, end: 20 } })
  const output = executionInputs(r, ['available']).find(field => field.direction === 'consume')!
  const request = (start: number | null, end: number | null) => ({ revision: headCid(r), key: output.key, value: { amount: 2, type: 'inventory', unit: 'unit', start, end } })
  expect(() => executionInput(r, ['available'], request(null, 20), 'owner', 4)).toThrow(/bounds/)
  expect(() => executionInput(r, ['available'], request(10, null), 'owner', 4)).toThrow(/bounds/)
  r = executionInput(r, ['available'], request(12, 18), 'owner', 4)
  expect(consumption(r, ['available'])!.value).toMatchObject({ start: 12, end: 18 })
})

test.each(['calendar', 'account', 'inventory', 'person', 'points', 'location'] as const)('%s banks and compiled requirements retain the same nullable bounds', type => {
  let r = createReplica('owner')
  r = addRow(r, [], RESOURCE_TYPE, 'Source', 1, { id: 'source', resource: { type, unit: 'unit', capacity: 10, start: null, end: 20 } })
  expect(view(r, [])!.tasks.find(row => row.id === 'source')!.resource).toMatchObject({ start: null, end: 20 })
  r = addRow(r, [], ALLOCATION_TYPE, 'Demand', 2, { id: 'demand', requirement: { capability: 'allocation', resource: type, amount: 6, unit: 'unit', start: 5, end: 10 } })
  r = addRow(r, ['demand'], ALLOCATION_TYPE, 'Supply', 3, { id: 'supply', allocation: { resource: '', type, amount: 6, unit: 'unit', start: null, end: 20 } })
  const demand = resolveScope(r.store, headCid(r), ['demand'])!
  expect(checkCompiledRequirement(r.store, compileRequirement(r.store, demand, ['demand'])).satisfied).toBe(true)
  const supply = view(r, ['demand'])!.tasks[0]!
  expect(valueContent(r.store, resolveScope(r.store, headCid(r), ['demand', 'supply'])!).data.allocation).toMatchObject({ start: null, end: 20 })
  expect(allocationMatches({ capability: 'allocation', resource: type, start: 5, end: 25 }, supply.allocation)).toBe(false)
})
