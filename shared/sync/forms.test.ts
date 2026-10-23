import { addConstructedRow, addRow, createReplica, headCid, loadReplica, moveNode, renameTask, serializeReplica, setRowContentAt, view } from './replica'
import { content, formValueAt, isRefNode, put, reachableNodes, importNodes, resolveScope, rowTypeAt, valueContent, copyRowContent, commitRoot, constructorPattern, matchesGraph, formRecord } from './index'
import { constructForm, formText, formTitle } from './forms'
import { mergeNodes } from './merge'
import { syncWith } from './test-helpers'
import { argumentRefs, resolveText } from './bindings'
import { addRefAt } from './replica'
import { PLAIN_TYPE, NOTE_TYPE, COMMENT_TYPE, MARKDOWN_TYPE } from './library-types'
import type { FosNodeContent } from '../types'

/** A row type of the kind older builds wrote: no graph identity, only the retired markers. */
const retiredType = (name: string, kind: string): FosNodeContent => ({ data: { description: { content: name }, instanceKind: { kind }, behavior: { content: `builtin:${kind}` } }, children: [] })
const fields = (store: Parameters<typeof content>[0], node: FosNodeContent) => node.children.filter(([, right]) => !!content(store, right).data.alias)

test('construction preserves literal graph constraints alongside product and repeated parameters', () => {
  const { store } = createReplica()
  const named = content(store, constructorPattern(store, 'custom'))
  const text = rowTypeAt(store, 'text')
  const parameter = put(store, { data: { parameter: { name: 'value' } }, children: [] })
  for (const repeat of [false, true]) {
    const definition = put(store, { data: { form: repeat ? { repeat: true } : {} }, children: [...named.children, [text, parameter]] })
    const input = repeat ? ['hello'] : { value: 'hello' }
    const built = constructForm(store, definition, 'custom-instance', input, 1)
    expect(built.children[0]).toEqual(named.children[0])
    expect(formRecord(store, definition, built)).toEqual(input)
    expect(matchesGraph(store, definition, put(store, built))).toBe(true)
    const missingLiteral = put(store, { ...built, children: built.children.slice(1) })
    expect(matchesGraph(store, definition, missingLiteral)).toBe(false)
    let next = 0
    const copied = content(store, copyRowContent(store, put(store, built), 2, () => `copy-${next++}`))
    expect(copied.children[0]).toEqual(named.children[0])
    expect(matchesGraph(store, definition, put(store, copied))).toBe(true)
  }
  const open = put(store, { ...named, data: { form: { open: true } } })
  const dynamic = constructForm(store, open, 'dynamic', { field: 'value' }, 1)
  expect(formRecord(store, open, dynamic)).toEqual({ field: 'value' })
  expect(matchesGraph(store, open, put(store, dynamic))).toBe(true)
})

test('notes are a title line plus a Markdown body row, bindings, and ordinary child rows', () => {
  let r = createReplica('a')
  const type = rowTypeAt(r.store, NOTE_TYPE)
  const definition = content(r.store, type)
  expect(definition.data.behavior).toBeUndefined()
  expect(definition.data.instanceKind).toBeUndefined()
  expect(definition.data.form).toEqual({ open: true, headline: ['body'] })
  // the body field's type is the library's Markdown text
  expect(content(r.store, rowTypeAt(r.store, MARKDOWN_TYPE)).data.form).toEqual({ primitive: 'text', text: { mediaType: 'text/markdown', interpolate: true } })
  r = addRefAt(r, [], 'name', r.store.primitive.documentField.getId(), 1, put(r.store, { data: { description: { content: 'Ada' } }, children: [] }), 'name')
  r = addRow(r, [], NOTE_TYPE, '# Hello {name}\n\nDear {name}, $x^2$.', 2, { id: 'document' })
  r = addRow(r, ['document'], NOTE_TYPE, 'Child document', 3, { id: 'child' })
  const node = () => valueContent(r.store, resolveScope(r.store, headCid(r), ['document'])!)
  expect(node().data.description).toEqual({ content: 'Hello {name}' })
  // more than one line: the whole text is the body, the title is the truncation handler's (title.ts)
  expect(formValueAt(r.store, node(), ['body'])?.data.scalar).toEqual({ type: 'text', value: '# Hello {name}\n\nDear {name}, $x^2$.' })
  expect(view(r, [])!.tasks.find(row => row.id === 'document')).toMatchObject({ type: NOTE_TYPE, title: 'Hello {name}', headline: ['body'] })
  expect(view(r, [])!.tasks.find(row => row.id === 'document')!.text).toBeUndefined()
  expect(view(r, ['document'])!.tasks.find(row => row.id === 'document/field/body')).toMatchObject({ type: MARKDOWN_TYPE, scalar: 'text', title: '# Hello {name}\n\nDear {name}, $x^2$.', text: { mediaType: 'text/markdown' } })
  expect(resolveText(r, ['document'], formText(r.store, node())).text).toBe('# Hello Ada\n\nDear Ada, $x^2$.')
  const body = node().children[0]!
  // one line renames the note; more lines replace its body, the body row keeping its identity
  r = setRowContentAt(r, [], 'document', NOTE_TYPE, 'Renamed {name}', {}, 4)
  expect(node().data.description).toEqual({ content: 'Renamed {name}' })
  expect(formText(r.store, node())).toBe('# Hello {name}\n\nDear {name}, $x^2$.')
  r = setRowContentAt(r, [], 'document', NOTE_TYPE, '  ## Updated {name}\n\n{extra}', {}, 5)
  expect(content(r.store, node().children[0]![1]).data.alias).toEqual(content(r.store, body[1]).data.alias)
  expect(argumentRefs(r.store, resolveScope(r.store, headCid(r), ['document'])!).map(arg => arg.name)).toEqual(['body', 'name', 'extra'])
  r = loadReplica(serializeReplica(r))
  expect(node().data.description).toEqual({ content: 'Updated {name}' })
  expect(formText(r.store, node())).toBe('  ## Updated {name}\n\n{extra}')
  expect(view(r, ['document'])!.tasks.some(row => row.id === 'child')).toBe(true)
})

test('a note pinned to a retired type with no graph identity reads as a plain row; edits keep its bindings and children', () => {
  let r = createReplica('a')
  const type = put(r.store, retiredType('Note', 'note'))
  const old = put(r.store, { data: { alias: { id: 'old-note' }, description: { content: '# Old {name}' } }, children: [] })
  commitRoot(r.store, put(r.store, { ...valueContent(r.store, headCid(r)), children: [...valueContent(r.store, headCid(r)).children, [type, old]] }), 1)
  r = addRefAt(r, ['old-note'], 'old-binding', r.store.primitive.documentField.getId(), 2, put(r.store, { data: { description: { content: 'Grace' } }, children: [] }), 'name')
  r = addRow(r, ['old-note'], PLAIN_TYPE, 'Keep child', 3, { id: 'child' })
  const child = resolveScope(r.store, headCid(r), ['old-note', 'child'])
  r = renameTask(r, [], 'old-note', '# New {name}', 4)
  expect(view(r, [])!.tasks.find(row => row.id === 'old-note')).toMatchObject({ type: '', title: '# New {name}', checkable: false })
  expect(view(r, [])!.tasks.find(row => row.id === 'old-note')!.text).toBeUndefined()
  expect(resolveText(r, ['old-note'], '# New {name}').text).toBe('# New Grace')
  expect(resolveScope(r.store, headCid(r), ['old-note', 'child'])).toBe(child)
})

test('a graph note inherits shared context after node exchange and supports remote editing', () => {
  let a = createReplica('a'), server = createReplica('server'), b = createReplica('b')
  a = addRow(a, [], NOTE_TYPE, '# Hello {name}', 1, { id: 'document' })
  a = addRow(a, [], PLAIN_TYPE, 'name: Ada', 2, { id: 'name' })
  a = syncWith(a, server)
  b = syncWith(b, server)
  const row = () => view(b, [])!.tasks.find(row => row.id === 'document')!
  expect(row()).toMatchObject({ type: NOTE_TYPE, title: '# Hello {name}', headline: ['body'] })
  expect(resolveText(b, ['document'], row().title).text).toBe('# Hello Ada')
  b = renameTask(b, [], 'document', '## Welcome {name}', 10)
  b = syncWith(b, server, { now: 11 })
  a = syncWith(a, server, { now: 12 })
  expect(view(a, [])!.tasks.find(row => row.id === 'document')!.title).toBe('## Welcome {name}')
})

test('comments instantiate graph fields; editing the body preserves person, list and ref identity', () => {
  let r = createReplica('alice')
  const type = rowTypeAt(r.store, COMMENT_TYPE)
  expect(content(r.store, type).data.behavior).toBeUndefined()
  r = addConstructedRow(r, [], type, { text: 'Hello', author: { id: 'alice', name: 'Alice' }, texts: ['one', 'one'] }, 1, 'message')
  const node = () => valueContent(r.store, resolveScope(r.store, headCid(r), ['message'])!)
  expect(node().data.comment).toBeUndefined()
  expect(node().data.description).toBeUndefined()
  expect(fields(r.store, node()).every(e => isRefNode(r.store, content(r.store, e[1])))).toBe(true)
  expect(view(r, [])!.tasks.find(t => t.id === 'message')).toMatchObject({ title: 'Hello', author: { id: 'alice', name: 'Alice', time: 1 } })
  const person = node().children[1]!, list = node().children[2]!, body = node().children[0]!
  const items = fields(r.store, valueContent(r.store, list[1]))
  expect(items).toHaveLength(2)
  expect(items[0]![1]).not.toBe(items[1]![1])
  expect(items.map(e => valueContent(r.store, e[1]).data.position?.value)).toEqual([0, 1])
  r = setRowContentAt(r, [], 'message', COMMENT_TYPE, 'Edited', {}, 2)
  expect(fields(r.store, node()).slice(1)).toEqual([person, list])
  expect(content(r.store, node().children[0]![1]).data.alias).toEqual(content(r.store, body[1]).data.alias)
  expect(view(r, [])!.tasks.find(t => t.id === 'message')).toMatchObject({ title: 'Edited', author: { name: 'Alice', time: 1 } })
  r = loadReplica(serializeReplica(r))
  expect(formTitle(r.store, node())).toBe('Edited')
})

test('an unfamiliar constructor travels as graph data and works on a second client', () => {
  const a = createReplica('a'), b = createReplica('b')
  const text = put(a.store, { data: { form: { primitive: 'text' } }, children: [] })
  const number = put(a.store, { data: { form: { primitive: 'number' } }, children: [] })
  const field = (name: string) => put(a.store, { data: { parameter: { name } }, children: [] })
  const type = put(a.store, { data: { description: { content: 'Unfamiliar thing' }, form: { title: ['label'] } }, children: [[text, field('label')], [number, field('quantity')]] })
  importNodes(b.store, reachableNodes(a.store, [type]))
  let r = addConstructedRow(b, [], type, { label: 'Sample', quantity: 7 }, 1, 'sample')
  expect(view(r, [])!.tasks.find(t => t.id === 'sample')!.title).toBe('Sample')
  r = setRowContentAt(r, [], 'sample', PLAIN_TYPE, 'Revised', {}, 2)
  const node = valueContent(r.store, resolveScope(r.store, headCid(r), ['sample'])!)
  expect(formTitle(r.store, node)).toBe('Revised')
  expect(formValueAt(r.store, node, ['quantity'])!.data.scalar!.value).toBe(7)
  expect(() => constructForm(r.store, type, 'invalid', { quantity: 'seven' }, 3)).toThrow('Expected number')
})

test('list entries can be added, edited and reordered through ordinary row operations', () => {
  let r = addRow(createReplica('a'), [], COMMENT_TYPE, 'List owner', 1, { id: 'message' })
  const path = ['message', 'message/field/texts']
  r = addRow(r, path, PLAIN_TYPE, 'First', 2, { id: 'one' })
  r = addRow(r, path, PLAIN_TYPE, 'Second', 3, { id: 'two' })
  r = setRowContentAt(r, path, 'one', PLAIN_TYPE, '// literal text', {}, 4)
  r = moveNode(r, path, 'two', path, { relativeTo: 'one', position: 'above' }, 5)
  expect(view(r, path)!.tasks.map(t => t.title)).toEqual(['Second', '// literal text'])
  const list = valueContent(r.store, resolveScope(r.store, headCid(r), path)!)
  expect(fields(r.store, list).map(e => valueContent(r.store, e[1]).data.position?.value)).toEqual([0, 1])
  expect(fields(r.store, list).every(e => isRefNode(r.store, content(r.store, e[1])))).toBe(true)
  const name = list.children.find(([left]) => left === r.store.primitive.nameField.getId())!
  expect(content(r.store, name[1]).data.position).toBeUndefined()
})

test('independent fields merge, and copies own fresh field refs', () => {
  let base = addRow(createReplica('a'), [], COMMENT_TYPE, 'Before', 1, { id: 'message', author: { id: 'a', name: 'Alice' } })
  const original = resolveScope(base.store, headCid(base), ['message'])!
  let ours = loadReplica(serializeReplica(base)), theirs = loadReplica(serializeReplica(base))
  ours = renameTask(ours, [], 'message', 'After', 2)
  theirs = renameTask(theirs, ['message', 'message/field/person'], 'message/field/person/field/name', 'Alicia', 3)
  importNodes(base.store, reachableNodes(ours.store, [headCid(ours)]))
  importNodes(base.store, reachableNodes(theirs.store, [headCid(theirs)]))
  const merged = mergeNodes(base.store, original, resolveScope(ours.store, headCid(ours), ['message'])!, resolveScope(theirs.store, headCid(theirs), ['message'])!, { ours: 'a', theirs: 'b' })
  const node = valueContent(base.store, merged.cid)
  expect(formTitle(base.store, node)).toBe('After')
  expect(formValueAt(base.store, node, ['person', 'name'])!.data.scalar!.value).toBe('Alicia')
  let index = 0
  const copy = valueContent(base.store, copyRowContent(base.store, merged.cid, 4, () => `copy-${index++}`))
  expect(copy.children.map(e => content(base.store, e[1]).data.alias?.id)).not.toEqual(node.children.map(e => content(base.store, e[1]).data.alias?.id))
  expect(fields(base.store, copy).every(e => isRefNode(base.store, content(base.store, e[1])))).toBe(true)
  expect(fields(base.store, formValueAt(base.store, copy, ['person'])!).every(e => isRefNode(base.store, content(base.store, e[1])))).toBe(true)
  expect(formTitle(base.store, copy)).toBe('After')
})

test('node-by-node exchange transports fields and their constructor definitions', () => {
  let a = createReplica('a'), server = createReplica('server'), b = createReplica('b')
  a = addRow(a, [], COMMENT_TYPE, 'Across peers', 1, { id: 'message', author: { id: 'a', name: 'Alice' } })
  a = syncWith(a, server)
  b = syncWith(b, server)
  expect(view(b, [])!.tasks.find(t => t.id === 'message')).toMatchObject({ title: 'Across peers', author: { name: 'Alice' } })
  b = setRowContentAt(b, [], 'message', COMMENT_TYPE, 'Reply edit', {}, 11)
  b = syncWith(b, server, { now: 12 })
  a = syncWith(a, server, { now: 13 })
  expect(view(a, [])!.tasks.find(t => t.id === 'message')!.title).toBe('Reply edit')
})

test('legacy comments remain readable and migrate on edit without losing replies or authorship', () => {
  let r = createReplica('a')
  const oldType = put(r.store, retiredType('Comment', 'comment'))
  const old = put(r.store, { data: { alias: { id: 'old' }, description: { content: 'Legacy' }, comment: { content: 'Legacy', authorID: 'alice', authorName: 'Alice', time: 1, votes: { bob: 'up' }, scope: 'private' } }, children: [] })
  const root = valueContent(r.store, headCid(r))
  commitRoot(r.store, put(r.store, { ...root, children: [...root.children, [oldType, old]] }), 1)
  r = addRow(r, ['old'], PLAIN_TYPE, 'Existing child', 2, { id: 'reply' })
  r = setRowContentAt(r, [], 'old', COMMENT_TYPE, 'Migrated', {}, 3)
  const node = valueContent(r.store, resolveScope(r.store, headCid(r), ['old'])!)
  expect(node.data.comment).toBeUndefined()
  expect(formValueAt(r.store, node, ['legacy', 'vote:bob'])!.data.scalar!.value).toBe('up')
  expect(formValueAt(r.store, node, ['legacy', 'scope'])!.data.scalar!.value).toBe('private')
  expect(view(r, [])!.tasks.find(t => t.id === 'old')).toMatchObject({ title: 'Migrated', author: { name: 'Alice', time: 1 } })
  expect(view(r, ['old'])!.tasks.some(t => t.id === 'reply')).toBe(true)
})
