import { addConstructedRow, addRow, createReplica, headCid, loadReplica, moveNode, renameTask, serializeReplica, setRowContentAt, view } from './replica'
import { content, formValueAt, isRefNode, put, reachableNodes, importNodes, resolveScope, rowTemplate, valueContent, copyRowContent, commitRoot } from './index'
import { constructForm, formTitle } from './forms'
import { mergeNodes } from './merge'
import { syncWith } from './test-helpers'
import { seedRowTypeContent } from '../dag-implementation/row-templates'
import { argumentRefs, resolveText } from './bindings'
import { addRefAt } from './replica'

test('notes are graph products with a text body, bindings, and ordinary child rows', () => {
  let r = createReplica('a')
  const type = rowTemplate(r.store, 'note')
  const definition = content(r.store, type)
  expect(definition.data.behavior).toBeUndefined()
  expect(definition.data.instanceKind).toBeUndefined()
  expect(definition.data.form).toMatchObject({ title: ['body'], text: { mediaType: 'text/markdown', interpolate: true } })
  r = addRefAt(r, [], 'name', r.store.primitive.documentField.getId(), 1, put(r.store, { data: { description: { content: 'Ada' } }, children: [] }), 'name')
  r = addRow(r, [], 'note', '# Hello {name}', 2, { id: 'document' })
  r = addRow(r, ['document'], 'note', 'Child document', 3, { id: 'child' })
  const node = () => valueContent(r.store, resolveScope(r.store, headCid(r), ['document'])!)
  expect(node().data.description).toBeUndefined()
  expect(formValueAt(r.store, node(), ['body'])?.data.scalar).toEqual({ type: 'text', value: '# Hello {name}' })
  expect(view(r, [])!.tasks.find(row => row.id === 'document')).toMatchObject({ kind: 'plain', text: { mediaType: 'text/markdown' } })
  expect(resolveText(r, ['document'], formTitle(r.store, node())).text).toBe('# Hello Ada')
  const body = node().children[0]!
  r = setRowContentAt(r, [], 'document', 'plain', '  ## Updated {name}\n\n{extra}', {}, 4)
  expect(content(r.store, node().children[0]![1]).data.alias).toEqual(content(r.store, body[1]).data.alias)
  expect(argumentRefs(r.store, resolveScope(r.store, headCid(r), ['document'])!).map(arg => arg.name)).toEqual(['name', 'extra'])
  r = loadReplica(serializeReplica(r))
  expect(formTitle(r.store, node())).toBe('  ## Updated {name}\n\n{extra}')
  expect(view(r, ['document'])!.tasks.some(row => row.id === 'child')).toBe(true)
})

test('legacy notes migrate on edit while preserving bindings and child identities', () => {
  let r = createReplica('a')
  const type = put(r.store, seedRowTypeContent('note', node => put(r.store, node)))
  const old = put(r.store, { data: { alias: { id: 'old-note' }, description: { content: '# Old {name}' } }, children: [] })
  commitRoot(r.store, put(r.store, { ...valueContent(r.store, headCid(r)), children: [...valueContent(r.store, headCid(r)).children, [type, old]] }), 1)
  r = addRefAt(r, ['old-note'], 'old-binding', r.store.primitive.documentField.getId(), 2, put(r.store, { data: { description: { content: 'Grace' } }, children: [] }), 'name')
  r = addRow(r, ['old-note'], 'plain', 'Keep child', 3, { id: 'child' })
  const child = resolveScope(r.store, headCid(r), ['old-note', 'child'])
  r = renameTask(r, [], 'old-note', '# New {name}', 4)
  expect(view(r, [])!.tasks.find(row => row.id === 'old-note')).toMatchObject({ kind: 'plain', title: '# New {name}', text: { mediaType: 'text/markdown' } })
  expect(resolveText(r, ['old-note'], '# New {name}').text).toBe('# New Grace')
  expect(resolveScope(r.store, headCid(r), ['old-note', 'child'])).toBe(child)
})

test('a graph note inherits shared context after node exchange and supports remote editing', () => {
  let a = createReplica('a'), server = createReplica('server'), b = createReplica('b')
  a = addRow(a, [], 'note', '# Hello {name}', 1, { id: 'document' })
  a = addRow(a, [], 'plain', 'name: Ada', 2, { id: 'name' })
  a = syncWith(a, server)
  b = syncWith(b, server)
  const row = () => view(b, [])!.tasks.find(row => row.id === 'document')!
  expect(row()).toMatchObject({ kind: 'plain', title: '# Hello {name}', text: { mediaType: 'text/markdown' } })
  expect(resolveText(b, ['document'], row().title).text).toBe('# Hello Ada')
  b = renameTask(b, [], 'document', '## Welcome {name}', 10)
  b = syncWith(b, server, { now: 11 })
  a = syncWith(a, server, { now: 12 })
  expect(view(a, [])!.tasks.find(row => row.id === 'document')!.title).toBe('## Welcome {name}')
})

test('comments instantiate graph fields; editing the body preserves person, list and ref identity', () => {
  let r = createReplica('alice')
  const type = rowTemplate(r.store, 'comment')
  expect(content(r.store, type).data.behavior).toBeUndefined()
  r = addConstructedRow(r, [], type, { text: 'Hello', author: { id: 'alice', name: 'Alice' }, texts: ['one', 'one'] }, 1, 'message')
  const node = () => valueContent(r.store, resolveScope(r.store, headCid(r), ['message'])!)
  expect(node().data.comment).toBeUndefined()
  expect(node().data.description).toBeUndefined()
  expect(node().children.every(e => isRefNode(r.store, content(r.store, e[1])))).toBe(true)
  expect(view(r, [])!.tasks.find(t => t.id === 'message')).toMatchObject({ title: 'Hello', author: { id: 'alice', name: 'Alice', time: 1 } })
  const person = node().children[1]!, list = node().children[2]!, body = node().children[0]!
  const items = valueContent(r.store, list[1]).children
  expect(items).toHaveLength(2)
  expect(items[0]![1]).not.toBe(items[1]![1])
  expect(items.map(e => valueContent(r.store, e[1]).data.position?.value)).toEqual([0, 1])
  r = setRowContentAt(r, [], 'message', 'comment', 'Edited', {}, 2)
  expect(node().children.slice(1)).toEqual([person, list])
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
  r = setRowContentAt(r, [], 'sample', 'plain', 'Revised', {}, 2)
  const node = valueContent(r.store, resolveScope(r.store, headCid(r), ['sample'])!)
  expect(formTitle(r.store, node)).toBe('Revised')
  expect(formValueAt(r.store, node, ['quantity'])!.data.scalar!.value).toBe(7)
  expect(() => constructForm(r.store, type, 'invalid', { quantity: 'seven' }, 3)).toThrow('Expected number')
})

test('list entries can be added, edited and reordered through ordinary row operations', () => {
  let r = addRow(createReplica('a'), [], 'comment', 'List owner', 1, { id: 'message' })
  const path = ['message', 'message/field/texts']
  r = addRow(r, path, 'plain', 'First', 2, { id: 'one' })
  r = addRow(r, path, 'plain', 'Second', 3, { id: 'two' })
  r = setRowContentAt(r, path, 'one', 'plain', '// literal text', {}, 4)
  r = moveNode(r, path, 'two', path, { relativeTo: 'one', position: 'above' }, 5)
  expect(view(r, path)!.tasks.map(t => t.title)).toEqual(['Second', '// literal text'])
  const list = valueContent(r.store, resolveScope(r.store, headCid(r), path)!)
  expect(list.children.map(e => valueContent(r.store, e[1]).data.position?.value)).toEqual([0, 1])
  expect(list.children.every(e => isRefNode(r.store, content(r.store, e[1])))).toBe(true)
})

test('independent fields merge, and copies own fresh field refs', () => {
  let base = addRow(createReplica('a'), [], 'comment', 'Before', 1, { id: 'message', author: { id: 'a', name: 'Alice' } })
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
  expect(copy.children.every(e => isRefNode(base.store, content(base.store, e[1])))).toBe(true)
  expect(formValueAt(base.store, copy, ['person'])!.children.every(e => isRefNode(base.store, content(base.store, e[1])))).toBe(true)
  expect(formTitle(base.store, copy)).toBe('After')
})

test('node-by-node exchange transports fields and their constructor definitions', () => {
  let a = createReplica('a'), server = createReplica('server'), b = createReplica('b')
  a = addRow(a, [], 'comment', 'Across peers', 1, { id: 'message', author: { id: 'a', name: 'Alice' } })
  a = syncWith(a, server)
  b = syncWith(b, server)
  expect(view(b, [])!.tasks.find(t => t.id === 'message')).toMatchObject({ title: 'Across peers', author: { name: 'Alice' } })
  b = setRowContentAt(b, [], 'message', 'comment', 'Reply edit', {}, 11)
  b = syncWith(b, server, { now: 12 })
  a = syncWith(a, server, { now: 13 })
  expect(view(a, [])!.tasks.find(t => t.id === 'message')!.title).toBe('Reply edit')
})

test('legacy comments remain readable and migrate on edit without losing replies or authorship', () => {
  let r = createReplica('a')
  const oldType = put(r.store, seedRowTypeContent('comment', c => put(r.store, c)))
  const old = put(r.store, { data: { alias: { id: 'old' }, description: { content: 'Legacy' }, comment: { content: 'Legacy', authorID: 'alice', authorName: 'Alice', time: 1, votes: { bob: 'up' }, scope: 'private' } }, children: [] })
  const root = valueContent(r.store, headCid(r))
  commitRoot(r.store, put(r.store, { ...root, children: [...root.children, [oldType, old]] }), 1)
  r = addRow(r, ['old'], 'plain', 'Existing child', 2, { id: 'reply' })
  r = setRowContentAt(r, [], 'old', 'comment', 'Migrated', {}, 3)
  const node = valueContent(r.store, resolveScope(r.store, headCid(r), ['old'])!)
  expect(node.data.comment).toBeUndefined()
  expect(formValueAt(r.store, node, ['legacy', 'vote:bob'])!.data.scalar!.value).toBe('up')
  expect(formValueAt(r.store, node, ['legacy', 'scope'])!.data.scalar!.value).toBe('private')
  expect(view(r, [])!.tasks.find(t => t.id === 'old')).toMatchObject({ title: 'Migrated', author: { name: 'Alice', time: 1 } })
  expect(view(r, ['old'])!.tasks.some(t => t.id === 'reply')).toBe(true)
})
