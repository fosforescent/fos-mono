import { addRow, addTask, createReplica, ensureHomeContext, view, type Replica } from './replica'
import { HOME_ID, libraryNode } from './graph'
import { fieldRefId } from './fields'
import { dispatchEvent, parseEvent } from './events'
import { NOTE_TYPE, PLAIN_TYPE } from './published-types'
import { captureOutline, organizeRequestAt, outlineText, parseOrganizePlan, parseOutline, requestOrganize } from './organize'

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

test('the outline is the target\'s subtree only, breadth first, bounded, one line per row with its id', async () => {
  const r = project()
  const outline = await captureOutline(r, [HOME_ID])
  // the note's fields (its title, its body) are rows of it like any other
  const title = fieldRefId(libraryNode(r.store, 'title')!), body = fieldRefId(libraryNode(r.store, 'body')!)
  expect(outline.map(e => [e.id, e.parent, e.title, e.depth])).toEqual([
    ['garden', null, 'Garden', 0], ['trip', null, 'Trip', 0], ['tomatoes', 'garden', 'Tomatoes', 1], [title, 'trip', 'Trip', 1], [body, 'trip', 'Trip', 1], ['stake', 'tomatoes', 'Stake them', 2],
  ])
  expect(outline.find(e => e.id === 'stake')!.path).toEqual(['garden', 'tomatoes', 'stake'])
  expect(outlineText(outline)).toBe(`- [garden] Garden\n  - [tomatoes] Tomatoes\n    - [stake] Stake them\n- [trip] Trip\n  - [${title}] Trip\n  - [${body}] Trip`)
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
    { ref: 'n7', parent: 'n2', type: 'task', text: 'a type a plan may not name' },
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

test('rows added through the grammar without ids behave as before', () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addTask(r, [HOME_ID], 'milk', 2, 'milk')
  const principal = { peerId: 'user:alice', owner: true, scope: [HOME_ID] }
  const read = dispatchEvent(r, { kind: 'read', path: [] }, principal, 3).result as { revision: string }
  r = dispatchEvent(r, parseEvent({ kind: 'submit', expected: read.revision, changes: [{ path: [], operation: 'add_plain', text: 'bread' }, { path: ['milk'], operation: 'add_plain', text: 'oat' }] }), principal, 4).replica
  expect(titles(r, [HOME_ID])).toEqual(['milk', 'bread'])
  expect(titles(r, [HOME_ID, 'milk'])).toEqual(['milk', '', 'oat'])
})

test('an organize request is a requirement in the target holding the capture as its note, outside the outline', async () => {
  const r = project()
  const asked = requestOrganize(r, [HOME_ID, 'garden'], '  water the tomatoes  ', 'Voice note', 9, () => 'x1')
  expect(asked.path).toEqual([HOME_ID, 'garden', 'x1'])
  const row = view(asked.replica, [HOME_ID, 'garden'])!.tasks.find(t => t.id === asked.path.at(-1))!
  expect(row.title).toBe('Voice note')
  expect(row.requirement).toMatchObject({ capability: 'organize', satisfied: false })
  // the capture is the request's input: part of what it asks, read by its handler as an operand
  expect(row.requirement!.inputs).toEqual({ capture: 'water the tomatoes' })
  expect(view(asked.replica, asked.path)!.tasks.map(t => [t.type, t.title])).toEqual([['title', 'Voice note']])
  expect(organizeRequestAt(asked.replica, asked.path)).toEqual({ label: 'Voice note', text: 'water the tomatoes' })
  expect(organizeRequestAt(asked.replica, [HOME_ID, 'garden', 'tomatoes'])).toBeNull()
  // the organizer never files into its own request
  expect((await captureOutline(asked.replica, [HOME_ID, 'garden'])).map(e => e.id)).toEqual(['tomatoes', 'stake'])
  expect(() => requestOrganize(r, [HOME_ID, 'garden'], '   ', 'x', 9)).toThrow(/Nothing to organize/)
  expect(() => requestOrganize(r, [HOME_ID, 'gone'], 'text', 'x', 9)).toThrow(/removed/)
})
