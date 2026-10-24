import { addRefAt, addRow, addTask, createReplica, discoverHandlers, put, resourceHandlers, RESOURCE_TYPE, PLAIN_TYPE, setRowContentAt, setRowType } from './index'

test('banks are ordinary handlers and sibling subtrees do not contribute ambient resources', () => {
  let r = addTask(createReplica('owner'), [], 'Group', 1, 'group')
  r = addTask(r, [], 'Other', 1, 'other')
  r = addRow(r, ['group'], RESOURCE_TYPE, 'Tools', 2, { id: 'tools', resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
  expect(discoverHandlers(r, ['group']).some(offer => offer.id === 'tools')).toBe(true)
  expect(resourceHandlers(r, ['group']).map(handler => handler.row.id)).toEqual(['tools'])
  expect(resourceHandlers(r, ['other'])).toEqual([])
})

test('a nearer binding shadows a same-name bank, including a value of a different type', () => {
  let r = addRow(createReplica('owner'), [], RESOURCE_TYPE, 'Tools', 1, { id: 'outer', resource: { type: 'inventory', unit: 'drill', capacity: 5 } })
  r = addTask(r, [], 'Group', 2, 'group')
  r = addRow(r, ['group'], RESOURCE_TYPE, 'Tools', 3, { id: 'inner', resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
  expect(resourceHandlers(r, ['group']).map(handler => handler.row.resource.capacity)).toEqual([1])
  r = addTask(r, ['group'], 'Nested', 4, 'nested')
  r = addRefAt(r, ['group', 'nested'], 'text', r.store.primitive.documentField.getId(), 5, put(r.store, { data: { description: { content: 'Unavailable here' } }, children: [] }), 'Tools')
  expect(resourceHandlers(r, ['group', 'nested'])).toEqual([])
})

test('distinct same-scope resource handlers remain alternatives rather than choosing the first', () => {
  let r = createReplica('owner')
  for (const id of ['first', 'second']) r = addRow(r, [], RESOURCE_TYPE, id, 1, { id, resource: { type: 'inventory', unit: 'drill', capacity: 1 } })
  expect(resourceHandlers(r, []).map(handler => handler.row.id)).toEqual(['first', 'second'])
})

test('converting an existing row into a bank declares the same scoped handler as creating a bank', () => {
  let r = addRow(createReplica('owner'), [], PLAIN_TYPE, 'Draft', 1, { id: 'bank' })
  r = setRowContentAt(r, [], 'bank', RESOURCE_TYPE, 'Tools', { resource: { type: 'inventory', unit: 'drill', capacity: 2 } }, 2)
  expect(resourceHandlers(r, []).map(handler => [handler.name, handler.row.resource.capacity])).toEqual([['Tools', 2]])
  r = addRow(r, [], PLAIN_TYPE, 'Other', 3, { id: 'other' })
  r = setRowType(r, [], 'other', RESOURCE_TYPE, 4, { resource: { type: 'inventory', unit: 'drill', capacity: 3 } })
  expect(resourceHandlers(r, []).map(handler => handler.row.resource.capacity)).toEqual([2, 3])
})
