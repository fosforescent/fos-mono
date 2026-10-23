import {
  addRefAt,
  createReplica,
  writeNodeValue,
  readNodeValue,
  writeLinkedNodeValue,
  headCid,
  resolveScope,
  resolveRefExpression,
  content,
  refValueCid,
  argumentRefs,
  serializeReplica,
  loadReplica,
  put,
  refNodeContent,
  formRecord,
  formElements,
  setFormTitle,
  mergeNodes,
  moveNode,
  view,
  isRowEdge,
  setRowContentAt,
  inspectRef,
  PLAIN_TYPE
} from './index'
import { constructNodeValue, readGraphValue, nodeValueType } from './node-values'
import { assertCompiledGraph, compileRefGraph } from './ref-compiler'

test('native records and sequences have the same meaning after compilation without editor identities', () => {
  const r = createReplica('device'), input = { nested: { count: 3 }, list: [null, 'hello', false] }
  const editable = constructNodeValue(r.store, input, 'editor-uuid')
  const compiled = compileRefGraph(r, editable.cid)
  const immutable = constructNodeValue(r.store, input)
  expect(compiled.complete).toBe(true)
  expect(compiled.cid).toBe(immutable.cid)
  expect(() => assertCompiledGraph(r.store, [immutable.cid])).not.toThrow()
  expect(readGraphValue(r.store, compiled.cid)).toEqual(input)
  expect(readGraphValue(r.store, immutable.cid)).toEqual(input)
})

test('records and lists are addressable typed refs with scalar leaves and generic form projections', () => {
  const input = { nested: { count: 3, yes: true }, list: [null, 'hello', false] }
  const r = writeNodeValue(createReplica('device'), [], 'settings', input, 1)
  const arg = argumentRefs(r.store, headCid(r)).find((a) => a.name === 'settings')!
  const value = content(r.store, refValueCid(r.store, content(r.store, arg.cid))!)
  expect(value.data.description).toBeUndefined()
  expect(value.children).toHaveLength(2)
  expect(value.children.every(edge => isRowEdge(r.store, edge))).toBe(true)
  const id = content(r.store, arg.cid).data.alias!.id
  expect(view(r, [id])!.tasks.map(row => row.id)).toEqual(value.children.map(([, cid]) => content(r.store, cid).data.alias!.id))
  expect(inspectRef(r.store, arg.cid, arg.type).values[0]!.refs.map(ref => ref.name)).toEqual(['list', 'nested'])
  expect(readNodeValue(r, [], 'settings')).toEqual(input)
  const leaf = resolveRefExpression(r, [], '.settings.nested.count')
  expect(leaf.status).toBe('ready')
  expect(readGraphValue(r.store, leaf.locations[0]!.cid)).toBe(3)
  expect(formRecord(r.store, arg.type, value)).toEqual(input)
  expect(
    formElements(r.store, arg.type, value)
      .fields.find((f) => f.label === 'nested')!
      .fields.map((f) => f.label)
  ).toEqual(['count', 'yes'])
  expect(readNodeValue(loadReplica(serializeReplica(r)), [], 'settings')).toEqual(input)
  const nested = value.children.find(([, cid]) => content(r.store, cid).data.name?.content === 'nested')![1]
  const nestedId = content(r.store, nested).data.alias!.id
  const countId = content(r.store, leaf.locations[0]!.cid).data.alias!.id
  const edited = setRowContentAt(r, [id, nestedId], countId, PLAIN_TYPE, '9', {}, 2)
  expect(readNodeValue(edited, [], 'settings')).toEqual({ ...input, nested: { count: 9, yes: true } })
})

test('independent property updates retain identities and merge as a product', () => {
  const r = createReplica('device'),
    s = r.store
  const base = constructNodeValue(s, { left: 1, right: 2 }, 'settings')
  const ours = constructNodeValue(s, { left: 3, right: 2 }, 'settings', base.cid)
  const theirs = constructNodeValue(s, { left: 1, right: 4 }, 'settings', base.cid)
  expect(content(s, ours.cid).children[1]).toEqual(content(s, base.cid).children[1])
  const merged = mergeNodes(s, base.cid, ours.cid, theirs.cid, { ours: 'a', theirs: 'b' })
  expect(merged.newChoiceCids).toEqual([])
  expect(readGraphValue(s, merged.cid)).toEqual({ left: 3, right: 4 })
})

test('list ordering follows ordinary row moves, including after reload', () => {
  let r = writeNodeValue(createReplica('device'), [], 'items', ['one', 'two'], 1)
  const arg = argumentRefs(r.store, headCid(r)).find((a) => a.name === 'items')!
  const id = content(r.store, arg.cid).data.alias!.id
  r = moveNode(r, [id], id + '/field/1', [id], { relativeTo: id + '/field/0', position: 'above' }, 2)
  expect(readNodeValue(r, [], 'items')).toEqual(['two', 'one'])
  expect(readNodeValue(loadReplica(serializeReplica(r)), [], 'items')).toEqual(['two', 'one'])
})

test('JSON-looking text is not a record; linked records preserve fields and graph links', () => {
  let r = createReplica('device')
  const legacy = put(r.store, { data: { description: { content: '{"count":1}' } }, children: [] })
  r = addRefAt(r, [], 'settings', r.store.primitive.documentField.getId(), 1, legacy, 'settings')
  expect(readNodeValue(r, [], 'settings')).toBeNull()
  r = writeLinkedNodeValue(r, [], 'settings', { count: 2 }, 2, { source: { id: 'external', owner: 'peer' } })
  expect(readNodeValue(r, [], 'settings')).toEqual({ count: 2 })
  const ref = content(r.store, resolveScope(r.store, headCid(r), ['settings'])!)
  const target = content(r.store, refValueCid(r.store, ref)!)
  expect(target.data.description).toBeUndefined()
  expect(target.children.some(([type]) => type === r.store.primitive.linkField.getId())).toBe(true)
})

test('malformed scalar types, cycles and nonfinite numbers are rejected; sparse lists and long field names are valid', () => {
  const { store } = createReplica('device')
  expect(() => constructNodeValue(store, { n: NaN }, 'bad')).toThrow(/finite/)
  const cyclic: any = {}
  cyclic.self = cyclic
  expect(() => constructNodeValue(store, cyclic, 'bad')).toThrow(/Cyclic/)
  const sequence = constructNodeValue(store, Array(2), 'list')
  expect(readGraphValue(store, sequence.cid)).toEqual([null, null])
  const deep = Array.from({ length: 40 }).reduce<unknown>((value) => ({ child: value }), 'leaf')
  expect(readGraphValue(store, constructNodeValue(store, deep, 'deep').cid)).toEqual(deep)
  const long = constructNodeValue(store, { ['x'.repeat(300)]: 1 }, 'long')
  expect(content(store, content(store, long.cid).children[0]![1]).data.alias!.id.length).toBeLessThan(256)
  const number = nodeValueType(store, 'number'),
    text = constructNodeValue(store, 'not a number', 'text')
  const malformed = put(store, {
    data: { presentation: {} },
    children: [[number, put(store, refNodeContent(store, { alias: { id: 'n' }, name: { content: 'n' } }, text.cid, []))]]
  })
  expect(readGraphValue(store, malformed)).toBeUndefined()
  const bool = constructNodeValue(store, false, 'bool')
  expect(setFormTitle(store, content(store, bool.cid), 'true', 1).data.scalar?.value).toBe(true)
  expect(() => setFormTitle(store, content(store, bool.cid), 'yes', 1)).toThrow(/boolean/)
})
