import { FosStore } from '../dag-implementation/store'
import {
  content, createReplica, commitRoot, headCid, libAt, libraryBindingAt,
  isNegative, matchesGraph, openRefs, primitiveOf, put, receivedRef,
  refNodeContent, updateAtScope
} from './index'

test('parameter semantics travel with the graph without any installed library or familiar names', () => {
  const store = new FosStore()
  const key = put(store, { data: { parameterDefinition: { kind: 'primitive' } }, children: [] })
  const negative = put(store, { data: { parameterDefinition: { kind: 'negative' } }, children: [] })
  const predicate = put(store, { data: { form: { primitive: 'number' } }, children: [] })
  const empty = put(store, { data: {}, children: [] })
  const input = put(store, { data: {}, children: [[key, predicate], [negative, empty]] })
  const output = put(store, { data: {}, children: [[key, predicate]] })
  const constructor = put(store, { data: {}, children: [
    [input, put(store, refNodeContent(store, { alias: { id: 'in' } }, null))],
    [output, put(store, refNodeContent(store, { alias: { id: 'out' } }, null))]
  ] })
  expect(primitiveOf(store, input)).toBe(predicate)
  expect(isNegative(store, input)).toBe(true)
  expect(openRefs(store, constructor).map(ref => [ref.sent, ref.received])).toEqual([[true, false], [false, true]])
  expect(receivedRef(store, constructor, 'in')).toBe(false)
  expect(receivedRef(store, constructor, 'out')).toBe(true)
  expect(matchesGraph(store, input, put(store, { data: { scalar: { type: 'number', value: 3 } }, children: [] }))).toBe(true)
  expect(matchesGraph(store, input, put(store, { data: { scalar: { type: 'text', value: '3' } }, children: [] }))).toBe(false)
})

test('library field names cannot confer parameter behavior on an otherwise ordinary node', () => {
  const r = createReplica(), store = r.store, binding = libraryBindingAt(store)!
  const ordinary = put(store, { data: { description: { content: 'An ordinary key' } }, children: [] })
  const library = content(store, binding.library)
  const renamed = put(store, { ...library, children: library.children.map(edge => {
    const node = content(store, edge[1])
    return node.data.name?.content === 'primitive'
      ? [edge[0], put(store, refNodeContent(store, node.data, ordinary))] : edge
  }) })
  commitRoot(store, updateAtScope(store, headCid(r), [], node => ({ ...node, children: node.children.map(([left, right]) => [right === binding.cid ? renamed : left, right]) })), 1)
  expect(libAt(store).field('primitive')).toBe(ordinary)
  const pattern = put(store, { data: {}, children: [[ordinary, libAt(store).field('string')]] })
  expect(primitiveOf(store, pattern)).toBeNull()
  expect(matchesGraph(store, pattern, put(store, { data: { description: { content: 'text' } }, children: [] }))).toBe(false)
})

test('conflicting parameter declarations fail instead of selecting the first', () => {
  const store = new FosStore()
  const key = put(store, { data: { parameterDefinition: { kind: 'primitive' } }, children: [] })
  const text = put(store, { data: { form: { primitive: 'text' } }, children: [] })
  const number = put(store, { data: { form: { primitive: 'number' } }, children: [] })
  const conflicting = put(store, { data: {}, children: [[key, text], [key, number]] })
  expect(() => primitiveOf(store, conflicting)).toThrow('Ambiguous primitive parameter')
  expect(() => matchesGraph(store, conflicting, text)).toThrow('Ambiguous primitive parameter')
})
