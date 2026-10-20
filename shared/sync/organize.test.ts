import { addRow, addTask, createReplica, ensureHomeContext, headCid, moveNode, view, type Replica } from './replica'
import { findEdge, HOME_ID, libraryTypeAt, resolveScope, valueContent } from './graph'
import { dispatchEvent, parseEvent } from './events'
import { NOTE_TYPE, PLAIN_TYPE } from './published-types'
import { ORGANIZE_REQUEST_PREFIX, applyOrganizePlan, captureOutline, organizePlanChanges, organizeRequestAt, outlineText, parseOrganizePlan, parseOutline, requestOrganize, type OrganizePlan } from './organize'

function project(): Replica {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Garden', 2, { id: 'garden' })
  r = addRow(r, [HOME_ID, 'garden'], PLAIN_TYPE, 'Tomatoes', 3, { id: 'tomatoes' })
  r = addRow(r, [HOME_ID, 'garden', 'tomatoes'], PLAIN_TYPE, 'Stake them', 4, { id: 'stake' })
  r = addRow(r, [HOME_ID], NOTE_TYPE, '# Trip\n\nlong body', 5, { id: 'trip' })
  r = addRow(r, [], PLAIN_TYPE, 'Elsewhere', 6, { id: 'elsewhere' })
  return r
}
const titles = (r: Replica, at: string[]) => (view(r, at)?.tasks ?? []).filter(row => !row.scalar).map(row => row.title.split('\n')[0])
let counter = 0
const ids = () => `new${++counter}`

test('the outline is the target\'s subtree only, breadth first, bounded, one line per row with its id', async () => {
  const r = project()
  const outline = await captureOutline(r, [HOME_ID])
  expect(outline.map(e => [e.id, e.parent, e.title, e.depth])).toEqual([
    ['garden', null, 'Garden', 0], ['trip', null, 'Trip', 0], ['tomatoes', 'garden', 'Tomatoes', 1], ['stake', 'tomatoes', 'Stake them', 2],
  ])
  expect(outline.find(e => e.id === 'stake')!.path).toEqual(['garden', 'tomatoes', 'stake'])
  expect(outlineText(outline)).toBe('- [garden] Garden\n  - [tomatoes] Tomatoes\n    - [stake] Stake them\n- [trip] Trip')
  expect((await captureOutline(r, [HOME_ID], { entries: 2 })).map(e => e.id)).toEqual(['garden', 'trip'])
  expect((await captureOutline(r, [HOME_ID], { depth: 2 })).map(e => e.id)).not.toContain('stake')
  // what a client sends is re-validated: unknown parents and duplicates are not a tree
  expect(parseOutline([{ id: 'a', title: 'A' }, { id: 'b', parent: 'a', title: 'B\nmore' }, { id: 'c', parent: 'zzz' }, { id: 'a' }, 'junk']).map(e => [e.id, e.parent, e.title, e.path])).toEqual([['a', null, 'A', ['a']], ['b', 'a', 'B', ['a', 'b']]])
})

test('plans are validated: unknown parents fall back to the target, refs are unique, nesting and size are bounded', () => {
  const plan = parseOrganizePlan('```json\n' + JSON.stringify({ title: 'Garden thoughts', items: [
    { ref: 'n1', parent: 'tomatoes', text: 'water daily' },
    { ref: 'n2', parent: '', text: 'Compost' },
    { ref: 'n3', parent: 'n2', text: 'buy a bin' },
    { ref: 'n2', parent: 'n3', text: 'duplicate ref' },
    { ref: 'garden', parent: 'outside-node', text: 'unknown parent' },
    { ref: 'n9', parent: 'n10', text: 'forward ref' },
    { ref: 'n5', text: '   ' },
    'junk',
    { ref: 'n6', parent: 'n2', text: 'Line one\nline two' },
    { ref: 'n7', parent: 'n2', type: 'lib:type:task', text: 'a type a plan may not name' },
    { ref: 'n8', parent: 'n2', type: NOTE_TYPE, text: 'named note' },
  ] }) + '\n```', ['garden', 'tomatoes', 'trip'])
  expect(plan.title).toBe('Garden thoughts')
  expect(plan.items).toEqual([
    { ref: 'n1', parent: 'tomatoes', text: 'water daily', type: PLAIN_TYPE },
    { ref: 'n2', parent: null, text: 'Compost', type: PLAIN_TYPE },
    { ref: 'n3', parent: 'n2', text: 'buy a bin', type: PLAIN_TYPE },
    { ref: 'n4', parent: 'n3', text: 'duplicate ref', type: PLAIN_TYPE },
    { ref: 'n5', parent: null, text: 'unknown parent', type: PLAIN_TYPE },
    { ref: 'n9', parent: null, text: 'forward ref', type: PLAIN_TYPE },
    { ref: 'n6', parent: 'n2', text: 'Line one\nline two', type: NOTE_TYPE },
    { ref: 'n7', parent: 'n2', text: 'a type a plan may not name', type: PLAIN_TYPE },
    { ref: 'n8', parent: 'n2', text: 'named note', type: NOTE_TYPE },
  ])
  expect(() => parseOrganizePlan('not json', [])).toThrow(/invalid JSON/)
  expect(parseOrganizePlan({ items: Array.from({ length: 500 }, (_, i) => ({ ref: `r${i}`, parent: i ? `r${i - 1}` : '', text: `t${i}` })) }, []).items.length).toBe(100)
  const deep = parseOrganizePlan({ items: Array.from({ length: 10 }, (_, i) => ({ ref: `r${i}`, parent: i ? `r${i - 1}` : '', text: `t${i}` })) }, [])
  expect(deep.items[6]!.parent).toBeNull() // nesting of new rows inside new rows is bounded
})

test('applying places rows under existing rows and new groups, never outside the target, and keeps the capture', async () => {
  let r = project()
  const plan: OrganizePlan = parseOrganizePlan({ title: 'Garden', items: [
    { ref: 'n1', parent: 'tomatoes', text: 'water daily' },
    { ref: 'n2', parent: '', text: 'Compost' },
    { ref: 'n3', parent: 'n2', text: 'buy a bin' },
    { ref: 'n4', parent: 'elsewhere', text: 'not outside' },
    { ref: 'n5', parent: 'trip', text: 'We should leave early.\n\nAnd pack light.', type: NOTE_TYPE },
  ] }, (await captureOutline(r, [HOME_ID])).map(e => e.id))
  const applied = await applyOrganizePlan(r, [HOME_ID], plan, { label: 'Voice note', stamp: 'today', text: 'raw transcript words' }, 10, ids)
  r = applied.replica
  expect(titles(r, [HOME_ID, 'garden', 'tomatoes'])).toEqual(['Stake them', 'water daily'])
  const compost = view(r, [HOME_ID])!.tasks.find(t => t.title === 'Compost')!
  expect(titles(r, [HOME_ID, compost.id])).toEqual(['buy a bin'])
  expect(titles(r, [HOME_ID, 'trip'])).toEqual(['We should leave early.'])
  expect(view(r, [HOME_ID, 'trip'])!.tasks.find(row => !row.scalar)!.text?.mediaType).toBe('text/markdown')
  // a row is [type, row]: the left node is the library row type the plan named
  const edgeOf = (at: string[], id: string) => findEdge(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), at)!), 'a:' + id)!
  const note = view(r, [HOME_ID, 'trip'])!.tasks.find(row => !row.scalar)!
  expect(edgeOf([HOME_ID, 'trip'], note.id)[0]).toBe(libraryTypeAt(r.store, NOTE_TYPE, [HOME_ID, 'trip']))
  expect(edgeOf([HOME_ID], compost.id)[0]).toBe(libraryTypeAt(r.store, PLAIN_TYPE, [HOME_ID]))
  expect(edgeOf([HOME_ID], applied.captureId)[0]).toBe(libraryTypeAt(r.store, NOTE_TYPE, [HOME_ID]))
  expect(titles(r, ['elsewhere'])).toEqual([]) // a parent outside the target is the target
  expect(titles(r, [HOME_ID])).toContain('not outside')
  const capture = view(r, [HOME_ID])!.tasks.find(t => t.id === applied.captureId)!
  expect(capture.title).toBe('## Voice note: Garden\n\n_today_\n\nraw transcript words')
  // an empty plan still keeps the capture
  const empty = await applyOrganizePlan(r, [HOME_ID, 'garden'], { title: '', items: [] }, { label: 'Pasted text', stamp: 's', text: 'kept' }, 11, ids)
  expect(view(empty.replica, [HOME_ID, 'garden'])!.tasks.map(t => t.title)).toContain('## Pasted text\n\n_s_\n\nkept')
})

test('a row that moved out of the target while the model worked takes nothing outside', async () => {
  let r = project()
  const outline = await captureOutline(r, [HOME_ID])
  r = moveNode(r, [HOME_ID, 'garden'], 'tomatoes', [], { relativeTo: 'elsewhere', position: 'below' }, 7)
  expect(titles(r, [])).toContain('Tomatoes')
  const plan = parseOrganizePlan({ items: [{ ref: 'n1', parent: 'tomatoes', text: 'water daily' }] }, outline.map(e => e.id))
  r = (await applyOrganizePlan(r, [HOME_ID], plan, { label: 'Voice note', stamp: 's', text: 'water daily' }, 10, ids)).replica
  expect(titles(r, ['tomatoes'])).toEqual(['Stake them'])
  expect(titles(r, [HOME_ID])).toContain('water daily')
})

test('the same plan as one submission of the event grammar: added rows take ids so later changes nest inside them', async () => {
  let r = project()
  const outline = await captureOutline(r, [HOME_ID])
  const plan = parseOrganizePlan({ items: [{ ref: 'n1', parent: '', text: 'Compost' }, { ref: 'n2', parent: 'n1', text: 'buy a bin' }, { ref: 'n3', parent: 'tomatoes', text: 'water daily' }] }, outline.map(e => e.id))
  const { changes } = organizePlanChanges(plan, outline, [], { label: 'Text message', stamp: 's', text: 'raw' }, ids)
  const principal = { peerId: 'user:alice', owner: true, scope: [HOME_ID] }
  const read = dispatchEvent(r, { kind: 'read', path: [] }, principal, 8).result as { revision: string }
  const event = parseEvent({ kind: 'submit', path: [], expected: read.revision, changes })
  r = dispatchEvent(r, event, principal, 9).replica
  const compost = view(r, [HOME_ID])!.tasks.find(t => t.title === 'Compost')!
  expect(titles(r, [HOME_ID, compost.id])).toEqual(['buy a bin'])
  expect(titles(r, [HOME_ID, 'garden', 'tomatoes'])).toEqual(['Stake them', 'water daily'])
  expect(titles(r, [HOME_ID]).some(t => t.startsWith('## Text message'))).toBe(true)
  // ids are only for added rows, and only further rows go inside rows added by the same submission
  expect(() => parseEvent({ kind: 'submit', expected: 'x', changes: [{ path: ['a'], operation: 'rename', text: 't', id: 'x' }] })).toThrow(/Only added rows/)
  expect(() => parseEvent({ kind: 'submit', expected: 'x', changes: [{ path: [], operation: 'add_row', text: 't' }] })).toThrow(/row type/)
  expect(() => parseEvent({ kind: 'submit', expected: 'x', changes: [{ path: [], operation: 'add_plain', type: NOTE_TYPE, text: 't' }] })).toThrow(/row type/)
  expect(() => dispatchEvent(r, parseEvent({ kind: 'submit', expected: (dispatchEvent(r, { kind: 'read', path: [] }, principal, 10).result as { revision: string }).revision, changes: [{ path: [], operation: 'add_row', type: 'lib:type:nonexistent', text: 't' }] }), principal, 11)).toThrow(/No standard library/)
  const again = dispatchEvent(r, { kind: 'read', path: [] }, principal, 10).result as { revision: string }
  expect(() => dispatchEvent(r, parseEvent({ kind: 'submit', expected: again.revision, changes: [{ path: [], operation: 'add_plain', text: 'a', id: 'garden' }] }), principal, 11)).toThrow(/already exists/)
  expect(() => dispatchEvent(r, parseEvent({ kind: 'submit', expected: again.revision, changes: [{ path: [], operation: 'add_plain', text: 'a', id: 'q1' }, { path: ['q1'], operation: 'rename', text: 'b' }] }), principal, 11)).toThrow(/only take further rows/)
})

test('rows added through the grammar without ids behave as before', () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addTask(r, [HOME_ID], 'milk', 2, 'milk')
  const principal = { peerId: 'user:alice', owner: true, scope: [HOME_ID] }
  const read = dispatchEvent(r, { kind: 'read', path: [] }, principal, 3).result as { revision: string }
  r = dispatchEvent(r, parseEvent({ kind: 'submit', expected: read.revision, changes: [{ path: [], operation: 'add_plain', text: 'bread' }, { path: ['milk'], operation: 'add_plain', text: 'oat' }] }), principal, 4).replica
  expect(titles(r, [HOME_ID])).toEqual(['milk', 'bread'])
  expect(titles(r, [HOME_ID, 'milk'])).toEqual(['oat'])
})

test('an organize request is a requirement in the target holding the capture as its note, outside the outline', async () => {
  const r = project()
  const asked = requestOrganize(r, [HOME_ID, 'garden'], '  water the tomatoes  ', 'Voice note', 9, () => 'x1')
  expect(asked.path).toEqual([HOME_ID, 'garden', `${ORGANIZE_REQUEST_PREFIX}x1`])
  const row = view(asked.replica, [HOME_ID, 'garden'])!.tasks.find(t => t.id === asked.path.at(-1))!
  expect(row.title).toBe('Voice note')
  expect(row.requirement).toMatchObject({ capability: 'organize', satisfied: false })
  // the capture is the requirement's row made from the note type (the edge's left node)
  const note = view(asked.replica, asked.path)!.tasks[0]!
  const edge = findEdge(asked.replica.store, valueContent(asked.replica.store, resolveScope(asked.replica.store, headCid(asked.replica), asked.path)!), 'a:' + note.id)!
  expect(edge[0]).toBe(libraryTypeAt(asked.replica.store, NOTE_TYPE, asked.path))
  expect(organizeRequestAt(asked.replica, asked.path)).toEqual({ label: 'Voice note', text: 'water the tomatoes' })
  expect(organizeRequestAt(asked.replica, [HOME_ID, 'garden', 'tomatoes'])).toBeNull()
  // the organizer never files into its own request
  expect((await captureOutline(asked.replica, [HOME_ID, 'garden'])).map(e => e.id)).toEqual(['tomatoes', 'stake'])
  expect(() => requestOrganize(r, [HOME_ID, 'garden'], '   ', 'x', 9)).toThrow(/Nothing to organize/)
  expect(() => requestOrganize(r, [HOME_ID, 'gone'], 'text', 'x', 9)).toThrow(/removed/)
})
