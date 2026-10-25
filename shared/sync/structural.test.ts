import { createReplica, put, namedRefPattern, matchesGraph, putBranches, refNodeContent, addRefAt, proposeRefAt, applyProposalAt, resolveScope, headCid, content, compileRow, compileRefGraph, refValueCompatible, addRow, instantiateTemplateValue, templateValuePattern, addRequirement } from './index'

const setup = () => {
  const r = createReplica(), s = r.store
  const empty = put(s, { data: {}, children: [] })
  const key = (name: string) => namedRefPattern(s, name)
  const text = (value: string) => put(s, { data: { scalar: { type: 'text', value } }, children: [] })
  const product = (...rows: [string, string][]) => put(s, { data: {}, children: rows })
  const sum = (...values: string[]) => putBranches(s, 'alternatives', null, values.map((value, i) => ({ peerId: String(i), edge: [empty, value] })))
  return { r, s, empty, key, text, product, sum }
}

test('a named ref on the left and an empty right match an actual property, not an annotation', () => {
  const { s, empty, key, text, product } = setup()
  const pattern = product([key('complete'), empty])
  expect(matchesGraph(s, pattern, product([key('complete'), text('anything')]))).toBe(true)
  expect(matchesGraph(s, pattern, product([key('other'), text('anything')]))).toBe(false)
  expect(matchesGraph(s, pattern, empty)).toBe(false)
  const impostor = put(s, { data: {}, children: [[s.primitive.instructionPointerConstructor.getId(), pattern]] })
  expect(matchesGraph(s, pattern, impostor)).toBe(false)
})

test('row choices are sums, required rows are products, and matching recurses on both sides', () => {
  const { s, empty, key, text, product, sum } = setup()
  const a = product([key('a'), empty]), b = product([key('b'), empty]), c = product([key('c'), text('yes')])
  const alternatives = putBranches(s, 'row-choice', null, [{ peerId: 'a', edge: [key('a'), empty] }, { peerId: 'b', edge: [key('b'), empty] }])
  const pattern = product([s.primitive.choiceTarget.getId(), alternatives], [key('c'), text('yes')])
  expect(matchesGraph(s, pattern, product([key('a'), empty], [key('c'), text('yes')]))).toBe(true)
  expect(matchesGraph(s, pattern, product([key('b'), empty], [key('c'), text('yes')]))).toBe(true)
  expect(matchesGraph(s, pattern, a)).toBe(false)
  expect(matchesGraph(s, pattern, sum(a, c))).toBe(false)
  expect(matchesGraph(s, sum(a, b), a)).toBe(true)
  expect(matchesGraph(s, sum(a, b), sum(a, b))).toBe(true)
  expect(matchesGraph(s, sum(a, b), c)).toBe(false)
  expect(matchesGraph(s, product([key('nested'), a]), product([key('nested'), b]))).toBe(false)
})

test('identities do not establish types; one node can satisfy different enclosing patterns', () => {
  const { s, empty, key, text, product } = setup()
  const a = product([key('a'), empty]), b = product([key('b'), empty])
  const value = product([key('a'), text('first')], [key('b'), text('second')])
  const renamed = put(s, { ...content(s, value), data: { alias: { id: 'another identity' } } })
  expect(matchesGraph(s, a, renamed)).toBe(true)
  expect(matchesGraph(s, b, renamed)).toBe(true)
  expect(matchesGraph(s, value, renamed)).toBe(true)
})

test('immutable property rows are addressable only under their actual parent', () => {
  const { s, key, text, product } = setup()
  const field = text('value'), parent = product([key('property'), field])
  expect(resolveScope(s, parent, [field])).toBe(field)
  expect(resolveScope(s, product(), [field])).toBeNull()
  expect(resolveScope(s, parent, [key('property')])).toBeNull()
})

test('a template input matches its constructed product without requiring editor policy rows', () => {
  let r = createReplica()
  r = addRow(r, [], 'template', 'Workflow definition', 1, { id: 'definition' })
  r = addRequirement(r, ['definition'], 'Review it', 2, { capability: 'confirmation' }, 'review')
  const definition = resolveScope(r.store, headCid(r), ['definition'])!
  const pattern = templateValuePattern(r.store, definition)
  r = addRow(r, [], 'task', 'My instance', 3, { id: 'instance' })
  r = instantiateTemplateValue(r, [], 'instance', definition, 4)
  expect(matchesGraph(r.store, pattern, resolveScope(r.store, headCid(r), ['instance'])!)).toBe(true)
  expect(matchesGraph(r.store, pattern, put(r.store, { data: {}, children: [] }))).toBe(false)
})

test('submissions validate the enclosing row and refs carry no independent type', () => {
  const { r, s, empty, key, text, product } = setup()
  const pattern = product([key('complete'), empty])
  let replica = addRefAt(r, [], 'result', pattern, 1)
  const ref = content(s, resolveScope(s, headCid(replica), ['result'])!)
  expect(ref.children.some(([left]) => left === s.primitive.instructionPointerConstructor.getId())).toBe(false)
  const bad = proposeRefAt(replica, ['result'], product([key('other'), text('no')]), 'owner', 2)
  expect(() => applyProposalAt(bad.replica, ['result'], bad.proposalCid, 'owner', 3)).toThrow(/incompatible/)
  const good = proposeRefAt(replica, ['result'], product([key('complete'), text('yes')]), 'owner', 4)
  replica = applyProposalAt(good.replica, ['result'], good.proposalCid, 'owner', 5)
  expect(compileRow(replica, ['result']).right.complete).toBe(true)
})

test('partial assignments retain holes without proving an executable input', () => {
  const { r, s, empty, key, text, product } = setup()
  const pattern = product([key('complete'), text('yes')])
  const hole = put(s, refNodeContent(s, { alias: { id: 'pending' } }, null))
  expect(refValueCompatible(s, pattern, hole)).toBe(true)
  expect(matchesGraph(s, pattern, hole)).toBe(false)
  expect(compileRefGraph(r, hole).holes).toContainEqual(expect.objectContaining({ id: 'pending', reason: 'unbound' }))
  expect(refValueCompatible(s, pattern, product([key('other'), empty]))).toBe(false)
})

test('native scalar constructors check values and remain distinct on the left', () => {
  const { s, empty, text, product } = setup()
  const number = put(s, { data: { form: { primitive: 'number' } }, children: [] })
  const string = put(s, { data: { form: { primitive: 'text' } }, children: [] })
  const nil = put(s, { data: { form: { primitive: 'null' } }, children: [] })
  expect(matchesGraph(s, number, text('1'))).toBe(false)
  expect(matchesGraph(s, number, put(s, { data: { scalar: { type: 'number', value: 1 } }, children: [] }))).toBe(true)
  expect(matchesGraph(s, nil, put(s, { data: { scalar: { type: 'null', value: null } }, children: [] }))).toBe(true)
  expect(matchesGraph(s, product([number, empty]), product([string, text('1')]))).toBe(false)
})
