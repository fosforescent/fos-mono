import { primitive } from './primitives'
import { createReplica, put, putBranches, refNodeContent, match, matchesGraph, query } from './index'

const setup = () => {
  const r = createReplica(), s = r.store
  const unit = put(s, { data: {}, children: [] })
  const text = (value: string) => put(s, { data: { scalar: { type: 'text', value } }, children: [] })
  const number = (value: number) => put(s, { data: { scalar: { type: 'number', value } }, children: [] })
  const node = (...rows: [string, string][]) => put(s, { data: {}, children: rows })
  /** a field: a node told apart by its name row */
  const field = (name: string) => node([primitive(s, 'name'), text(name)])
  const sum = (...values: string[]) => putBranches(s, 'sum', null, values.map((value, i) => ({ peerId: String(i), edge: [unit, value] })))
  return { s, unit, text, number, node, field, sum, string: primitive(s, 'string'), num: primitive(s, 'number'), bool: primitive(s, 'boolean'), never: primitive(s, 'void') }
}

test('unit is a hole: it matches anything and yields what it met; void matches nothing; a node matches itself', () => {
  const { s, unit, text, node, field, never } = setup()
  const comment = field('comment'), title = field('title')
  const pattern = node([title, unit], [comment, unit])
  const value = node([comment, text('looks good')], [title, text('Venue')])
  expect(match(s, pattern, value)?.fillers).toEqual([text('Venue'), text('looks good')])
  expect(match(s, unit, value)?.fillers).toEqual([value])
  expect(matchesGraph(s, never, value)).toBe(false)
  expect(matchesGraph(s, never, never)).toBe(true)
  expect(match(s, value, value)?.fillers).toEqual([])
})

test('every pattern row needs its own witness row; extra rows are fine', () => {
  const { s, unit, text, node, field } = setup()
  const title = field('title'), done = field('done')
  const pattern = node([title, unit], [done, unit])
  expect(matchesGraph(s, pattern, node([title, text('a')], [done, unit], [field('subtask'), text('x')]))).toBe(true)
  expect(matchesGraph(s, pattern, node([title, text('a')]))).toBe(false)
  // two pattern rows cannot share one witness
  expect(matchesGraph(s, node([title, unit], [title, unit]), node([title, text('a')]))).toBe(false)
  expect(matchesGraph(s, node([title, unit], [title, unit]), node([title, text('a')], [title, text('b')]))).toBe(true)
})

test('lefts match as fields, recursively: a parameterized field matches its constructor, different parameters differ', () => {
  const { s, unit, text, node, field, string } = setup()
  const name = primitive(s, 'name'), alias = field('alias')
  const stringAlias = node([name, text('stringAlias')], [alias, string])
  const titleField = node([name, text('stringAlias')], [alias, text('title')])
  const bodyField = node([name, text('stringAlias')], [alias, text('body')])
  expect(matchesGraph(s, node([stringAlias, string]), node([titleField, text('Buy milk')]))).toBe(true)
  expect(matchesGraph(s, node([titleField, unit]), node([titleField, text('Buy milk')]))).toBe(true)
  expect(matchesGraph(s, node([titleField, unit]), node([bodyField, text('Buy milk')]))).toBe(false)
})

test('primitives check leaf values, and a filled leaf must be the same value', () => {
  const { s, text, number, node, field, string, num, bool } = setup()
  const amount = field('amount')
  expect(matchesGraph(s, node([amount, num]), node([amount, number(30)]))).toBe(true)
  expect(matchesGraph(s, node([amount, num]), node([amount, text('30')]))).toBe(false)
  expect(matchesGraph(s, node([amount, string]), node([amount, text('30')]))).toBe(true)
  expect(matchesGraph(s, bool, put(s, { data: { scalar: { type: 'boolean', value: true } }, children: [] }))).toBe(true)
  expect(matchesGraph(s, node([amount, number(30)]), node([amount, number(30)]))).toBe(true)
  expect(matchesGraph(s, node([amount, number(30)]), node([amount, number(31)]))).toBe(false)
})

test('a ref is read as its current value; an unfilled ref is a hole only when holes are allowed', () => {
  const { s, unit, text, node, field } = setup()
  const title = field('title')
  const filled = put(s, refNodeContent(s, { alias: { id: 'r1' } }, text('Venue')))
  const open = put(s, refNodeContent(s, { alias: { id: 'r2' } }, null))
  expect(matchesGraph(s, node([title, text('Venue')]), node([title, filled]))).toBe(true)
  expect(matchesGraph(s, node([title, text('Other')]), node([title, filled]))).toBe(false)
  expect(matchesGraph(s, node([title, text('Venue')]), node([title, open]))).toBe(false)
  expect(matchesGraph(s, node([title, text('Venue')]), node([title, open]), { allowHoles: true })).toBe(true)
  expect(matchesGraph(s, node([title, unit]), node([title, open]))).toBe(true)
})

test('a sum is a choice: a pattern sum matches one of its options, a value sum matches only if every option does', () => {
  const { s, text, node, field, sum, string, num } = setup()
  const emoji = field('emoji'), icon = field('icon')
  const either = sum(node([emoji, string]), node([icon, string]))
  expect(matchesGraph(s, either, node([emoji, text('🌱')]))).toBe(true)
  expect(matchesGraph(s, either, node([icon, text('calendar')]))).toBe(true)
  expect(matchesGraph(s, either, node([field('other'), text('x')]))).toBe(false)
  expect(matchesGraph(s, node([emoji, string]), sum(node([emoji, text('a')]), node([emoji, text('b')])))).toBe(true)
  expect(matchesGraph(s, node([emoji, string]), sum(node([emoji, text('a')]), node([icon, text('b')])))).toBe(false)
  expect(matchesGraph(s, node([emoji, num]), sum())).toBe(false)
})

test('a named hole binds once: every occurrence must meet the same value', () => {
  const { s, text, node, field } = setup()
  const hole = put(s, { data: { refHole: { slot: 0, role: 'input' } }, children: [] })
  const from = field('from'), to = field('to')
  const pattern = node([from, hole], [to, hole])
  const result = match(s, pattern, node([from, text('a')], [to, text('a')]))
  expect(result?.bindings.get(hole)).toBe(text('a'))
  expect(match(s, pattern, node([from, text('a')], [to, text('b')]))).toBeNull()
  expect(match(s, node([from, hole]), node([from, text('c')]), { bindings: new Map([[hole, text('a')]]) })).toBeNull()
})

test('a query returns the nodes a pattern matches', () => {
  const { s, unit, text, node, field } = setup()
  const title = field('title'), done = field('done')
  const a = node([title, text('a')], [done, unit]), b = node([title, text('b')]), c = node([done, unit])
  expect(query(s, node([title, unit], [done, unit]), [a, b, c])).toEqual([a])
  expect(query(s, node([title, unit]), [a, b, c])).toEqual([a, b])
})

test('matching terminates on cycles through refs', () => {
  const { s, node, field } = setup()
  const loop = put(s, refNodeContent(s, { alias: { id: 'loop' } }, null))
  expect(matchesGraph(s, node([field('x'), loop]), node([field('x'), loop]))).toBe(true)
  expect(matchesGraph(s, node([field('x'), field('y')]), node([field('x'), loop]))).toBe(false)
})
