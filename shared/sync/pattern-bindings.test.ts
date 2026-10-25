import { textValue, textOf } from './index'
import { primitive } from './primitives'
import {
  addRefAt, addRow, addTask, applyProposalAt, choosePatternBindingAt, content, createReplica, findEdge, headCid, identityCid, loadReplica,
  patternBindings, PLAIN_TYPE, put, readProposals, refNodeContent, refValueCid, resolveScope, serializeReplica, solveAt, unify,
  usePatternAt, valueContent, compileRefGraph, type Replica
} from './index'

const cid = (r: Replica, path: string[]) => resolveScope(r.store, headCid(r), path)!
const leftOf = (r: Replica, at: string[], id: string) => findEdge(r.store, valueContent(r.store, cid(r, at)), `a:${id}`)![0]
const leaf = (r: Replica, text: string) => textValue(r.store, text)

/** A person row with a city row under it. */
function person(r: Replica, at: string[], id: string, city: string): Replica {
  r = addTask(r, at, id, 1, id)
  return addRow(r, [...at, id], PLAIN_TYPE, city, 2, { id: `${id}-city` })
}

test('using a pattern with a node submits its values to the pattern refs by position, as options in that scope', () => {
  let r = addTask(createReplica('device'), [], 'Trip', 1, 'trip')
  r = person(r, ['trip'], 'alice', 'Paris')
  const plain = primitive(r.store, 'string')
  const hole = put(r.store, refNodeContent(r.store, { alias: { id: 'where' }, name: { content: 'where' } }, null))
  const pattern = put(r.store, { data: {}, children: [[plain, hole]] })
  const used = usePatternAt(r, ['trip'], 'alice', pattern, 'device', 3)
  r = used.replica
  expect(used.submitted).toBe(1)
  const left = leftOf(r, ['trip'], 'alice')
  expect(left).not.toBe(pattern) // the use site's pattern carries the submissions; the shared pattern is unchanged
  expect(patternBindings(r.store, pattern)[0]!.options).toEqual([])
  const [binding] = patternBindings(r.store, left)
  expect(binding).toMatchObject({ alias: 'where', name: 'where', value: null })
  expect(binding!.options).toHaveLength(1)
  expect(textOf(r.store, binding!.options[0]!.value)).toBe('Paris')
  // using it again replaces this row's own submission instead of adding another
  r = usePatternAt(r, ['trip'], 'alice', leftOf(r, ['trip'], 'alice'), 'device', 4).replica
  const again = patternBindings(r.store, leftOf(r, ['trip'], 'alice'))[0]!
  expect(again.options).toHaveLength(1)
  expect(() => choosePatternBindingAt(r, ['trip'], 'alice', 'where', binding!.options[0]!.proposal, 5)).toThrow(/gone/)
  // choosing an option binds the ref; the pattern row keeps working after a reload
  r = choosePatternBindingAt(r, ['trip'], 'alice', 'where', again.options[0]!.proposal, 5)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  const bound = patternBindings(r.store, leftOf(r, ['trip'], 'alice'))[0]!
  expect(textOf(r.store, bound.value!)).toBe('Paris')
  expect(bound.options).toEqual([])
})

test('a value that does not fit the ref is not submitted', () => {
  let r = addTask(createReplica('device'), [], 'Trip', 1, 'trip')
  r = person(r, ['trip'], 'alice', 'Paris')
  const number = put(r.store, { data: { form: { primitive: 'number' } }, children: [] })
  const hole = put(r.store, refNodeContent(r.store, { alias: { id: 'count' } }, null))
  const used = usePatternAt(r, ['trip'], 'alice', put(r.store, { data: {}, children: [[number, hole]] }), 'device', 3)
  expect(used).toMatchObject({ submitted: 0, skipped: 1 })
  expect(patternBindings(used.replica.store, leftOf(used.replica, ['trip'], 'alice'))[0]!.options).toEqual([])
})

test('unify binds placeholders and requires the same placeholder to meet the same value', () => {
  const r = createReplica('device')
  const text = primitive(r.store, 'string'), key = leaf(r, 'key')
  const x = put(r.store, refNodeContent(r.store, { alias: { id: 'x' } }, null))
  const twice = put(r.store, { data: {}, children: [[key, x], [text, x]] })
  const same = put(r.store, { data: {}, children: [[key, leaf(r, 'a')], [text, leaf(r, 'a')]] })
  const different = put(r.store, { data: {}, children: [[key, leaf(r, 'a')], [text, leaf(r, 'b')]] })
  const compiled = compileRefGraph(r, twice)
  expect(unify(r.store, compiled.cid, same)?.get(compiled.holes[0]!.cid)).toBe(leaf(r, 'a'))
  expect(unify(r.store, compiled.cid, different)).toBeNull()
  expect(unify(r.store, compileRefGraph(r, put(r.store, { data: {}, children: [[key, x]] })).cid, put(r.store, { data: {}, children: [] }))).toBeNull()
  expect(() => unify(r.store, twice, same)).toThrow(/Compile editor references/)
})

test('solve submits every solution in scope, ancestors included, to the placeholders as options; binding one keeps the others', () => {
  let r = addTask(createReplica('device'), [], 'Trip', 1, 'trip')
  r = person(r, [], 'carol', 'Oslo')
  r = person(r, ['trip'], 'alice', 'Paris')
  r = person(r, ['trip'], 'bob', 'Rome')
  r = addTask(r, ['trip'], 'Nobody', 1, 'nobody')
  const plain = primitive(r.store, 'string')
  r = addTask(r, ['trip'], 'Where can we go?', 3, 'solve')
  r = addRefAt(r, ['trip', 'solve'], 'city', plain, 4, null, 'city')
  const solved = solveAt(r, ['trip', 'solve'], 'device', 5)
  r = solved.replica
  expect(solved.solutions.map(s => s.source.join('/'))).toEqual(['trip/alice', 'trip/bob', 'carol'])
  const ref = content(r.store, identityCid(r.store, findEdge(r.store, valueContent(r.store, cid(r, ['trip', 'solve'])), 'a:city')!))
  const options = readProposals(r.store, ref).filter(p => p.status === 'open')
  expect(options.map(p => textOf(r.store, p.contentCid)).sort()).toEqual(['Oslo', 'Paris', 'Rome'])
  const paris = options.find(p => textOf(r.store, p.contentCid) === 'Paris')!
  r = applyProposalAt(r, ['trip', 'solve', 'city'], paris.cid, 'device', 6)
  const city = () => content(r.store, identityCid(r.store, findEdge(r.store, valueContent(r.store, cid(r, ['trip', 'solve'])), 'a:city')!))
  expect(content(r.store, refValueCid(r.store, city())!).data.description?.content).toBe('Paris')
  const rome = readProposals(r.store, city()).find(p => p.status === 'open' && textOf(r.store, p.contentCid) === 'Rome')!
  r = applyProposalAt(r, ['trip', 'solve', 'city'], rome.cid, 'device', 7)
  expect(readProposals(r.store, city()).filter(p => p.status === 'open')).toHaveLength(1)
  // bound, the ref is no longer a hole: there is nothing left to solve
  expect(() => solveAt(r, ['trip', 'solve'], 'device', 8)).toThrow(/placeholder/)
})

test('solve needs a placeholder', () => {
  let r = addTask(createReplica('device'), [], 'Trip', 1, 'trip')
  r = addTask(r, ['trip'], 'Solve', 2, 'solve')
  expect(() => solveAt(r, ['trip', 'solve'], 'device', 3)).toThrow(/placeholder/)
})
