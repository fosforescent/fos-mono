import { createHash } from 'node:crypto'
import { addMemberAt, ensureHomeContext, setMemberCapabilitiesAt, addConstructedRow, addRow, applyProposalAt, createReplica, headCid, view } from './replica'
import { content, put, readProposals, resolveScope, rowTypeAt, valueContent } from './graph'
import { formValueAt } from './forms'
import { markdownTitle, proposeVisitorValues, publish, publication, publishedUrl, writePageBase, unpublish, sharedProjection, SHARED_BODY_LIMIT, VISITOR_SUBMISSION } from './sharing'
import { HOME_ID, memberEntryId, SERVER_MEMBER } from './graph'
import { MARKDOWN_TYPE, PLAIN_TYPE, NOTE_TYPE, TEXT_TYPE } from './library-types'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

test('a published note is its title line and its whole markdown body row, keyed off the row types', () => {
  let r = createReplica('user:host')
  r = addRow(r, [], NOTE_TYPE, '# Hello world\n\nThe **body** of a post, with $e^{i\\pi} + 1 = 0$.', 1, { id: 'post' })
  r = addRow(r, ['post'], NOTE_TYPE, '## Section\n\n' + 'x'.repeat(9000), 2, { id: 'long' })
  r = addRow(r, ['post'], PLAIN_TYPE, 'A plain row', 3, { id: 'plain' })
  r = addRow(r, ['post', 'plain'], NOTE_TYPE, 'Nested note', 4, { id: 'nested' })
  r = addRow(r, ['post'], NOTE_TYPE, 'Huge\n' + 'y'.repeat(SHARED_BODY_LIMIT + 10), 5, { id: 'huge' })
  r = publish(r, ['post'], 'public', 6)
  let hashed: any
  const node = sharedProjection(r, ['post'], value => { hashed = value; return digest(value) })
  expect(node).toMatchObject({ title: 'Hello world', type: NOTE_TYPE })
  expect(node.body).toBeUndefined()
  // each note's body is a Markdown row of its own; an empty body is left out
  expect(node.rows.map(row => row.id)).toEqual(['post/field/body', 'long', 'long/field/body', 'plain', 'nested', 'huge', 'huge/field/body'])
  const rows = Object.fromEntries(node.rows.map(row => [row.id, row]))
  expect(rows['post/field/body']).toEqual({ id: 'post/field/body', depth: 0, title: '', type: MARKDOWN_TYPE, body: '# Hello world\n\nThe **body** of a post, with $e^{i\\pi} + 1 = 0$.' })
  // bodies are not cut at 8000 characters
  expect(rows.long).toEqual({ id: 'long', title: 'Section', depth: 0, type: NOTE_TYPE })
  expect(rows['long/field/body']!.body).toHaveLength('## Section\n\n'.length + 9000)
  expect(rows.plain).toEqual({ id: 'plain', title: 'A plain row', depth: 0, type: 'plain' })
  expect(rows.nested).toMatchObject({ title: 'Nested note', depth: 1 })
  expect(rows['huge/field/body']!.body).toHaveLength(SHARED_BODY_LIMIT)
  expect(rows['huge/field/body']!.truncated).toBe(true)
  expect(node.rows.every(row => !('kind' in row))).toBe(true)
  // the revision is computed from the earlier row shape, so votes cast before bodies were published stay valid
  expect(hashed.rows.find((row: any) => row.id === 'long')).toEqual({ id: 'long', title: 'Section', type: NOTE_TYPE, depth: 0 })
})


test('markdown titles drop heading and inline markup', () => {
  expect(markdownTitle('\n\nIntro line\n# The *real* title')).toBe('The real title')
  expect(markdownTitle('> A [quoted](https://x.example) `line`\nmore')).toBe('A quoted line')
  expect(markdownTitle('')).toBe('')
})

test('empty fields of a published row are inputs of their type; each visitor submits candidates as its own peer', () => {
  let r = createReplica('user:host')
  // a product type over the library's text type: its title field is presented by the row, the other is asked for
  const text = rowTypeAt(r.store, TEXT_TYPE)
  const field = (name: string) => put(r.store, { data: { parameter: { name } }, children: [] })
  const type = put(r.store, { data: { form: { title: ['label'] } }, children: [[text, field('label')], [text, field('email')]] })
  r = addRow(r, [], PLAIN_TYPE, 'Sign up', 1, { id: 'page' })
  r = addConstructedRow(r, ['page'], type, { label: 'Your details' }, 2, 'details')
  r = publish(r, ['page'], 'public', 3)
  const node = sharedProjection(r, ['page'], value => JSON.stringify(value).length.toString())
  expect(node.rows).toEqual([
    { id: 'details', title: 'Your details', depth: 0 },
    { id: 'details/field/email', title: 'email', depth: 1, type: 'text', body: '' }
  ])
  expect(node.inputs).toEqual([{ key: JSON.stringify(['details', 'details/field/email']), path: ['details', 'details/field/email'], name: 'email', kind: 'text' }])
  // two visitors (a visit admits each as a member that may run the node): two submissions; a resubmission replaces only its own
  r = addMemberAt(r, ['page'], 'visitor:a', 'A', ['execute'], 4)
  r = addMemberAt(r, ['page'], 'visitor:b', 'B', ['execute'], 4)
  r = proposeVisitorValues(r, ['page'], 'visitor:a', [{ path: ['details', 'details/field/email'], value: 'a@example.test' }], 4)
  r = proposeVisitorValues(r, ['page'], 'visitor:b', [{ path: ['details', 'details/field/email'], value: 'b@example.test' }], 5)
  r = proposeVisitorValues(r, ['page'], 'visitor:a', [{ path: ['details', 'details/field/email'], value: 'a2@example.test' }], 6)
  const identity = () => content(r.store, resolveScope(r.store, headCid(r), ['page'])!)
  const open = readProposals(r.store, identity()).filter(p => p.name === VISITOR_SUBMISSION)
  expect(open.map(p => p.peerId).sort()).toEqual(['visitor:a', 'visitor:b'])
  expect(sharedProjection(r, ['page'], v => String(v)).proposals).toEqual([])
  // accepting a's submission fills the field in the owner's node
  r = applyProposalAt(r, ['page'], open.find(p => p.peerId === 'visitor:a')!.cid, 'user:host', 7)
  const details = valueContent(r.store, resolveScope(r.store, headCid(r), ['page', 'details'])!)
  expect(formValueAt(r.store, details, ['email'])!.data.scalar!.value).toBe('a2@example.test')
  expect(view(r, ['page'])).toBeTruthy()
})

test('publishing is membership: the audience peer may run the node (execute only), and unpublishing removes it', () => {
  let r = createReplica('user:host')
  r = addRow(r, [], PLAIN_TYPE, 'Page', 1, { id: 'page' })
  expect(publication(r, ['page'])).toBeNull()
  r = publish(r, ['page'], 'public', 2)
  expect(view(r, ['page'])!.members.find(m => m.peerId === 'audience:public')!.capabilities).toEqual(['execute'])
  expect(publication(r, ['page'])).toEqual({ audience: 'public', template: false })
  // the served page is the execute view: peer rows are not on it
  r = addRow(r, ['page'], PLAIN_TYPE, 'Shown', 3, { id: 'shown' })
  expect(sharedProjection(r, ['page'], value => JSON.stringify(value).length.toString()).rows.map(row => row.id)).toEqual(['shown'])
  r = unpublish(r, ['page'], 'public', 4)
  expect(publication(r, ['page'])).toBeNull()
  expect(() => sharedProjection(r, ['page'], () => 'x')).toThrow()
})

test('a published node\'s link is made from the page base the url handler records on the server\'s member entry', () => {
  let r = ensureHomeContext(createReplica('user:host'), 1)
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Page', 2, { id: 'page' })
  const entry = [memberEntryId(SERVER_MEMBER)]
  r = writePageBase(r, entry, { base: 'https://app.example', owner: 'host' }, 3)
  expect(writePageBase(r, entry, { base: 'https://app.example', owner: 'host' }, 4)).toBe(r)
  expect(publishedUrl(r, [HOME_ID, 'page'])).toBeNull()
  r = publish(r, [HOME_ID, 'page'], 'public', 5)
  const url = publishedUrl(r, [HOME_ID, 'page'])!
  expect(url.startsWith('https://app.example/#share=')).toBe(true)
  expect(JSON.parse(decodeURIComponent(url.slice(url.indexOf('#share=') + 7)))).toEqual({ owner: 'host', path: [HOME_ID, 'page'] })
  r = unpublish(r, [HOME_ID, 'page'], 'public', 6)
  expect(publishedUrl(r, [HOME_ID, 'page'])).toBeNull()
})

test('a capability this build does not know is kept, as one with no handler here yet', () => {
  let r = ensureHomeContext(createReplica('user:host'), 1)
  r = setMemberCapabilitiesAt(r, [], 'fos', [], [], 2, ['search', 'teleport' as never])
  expect(view(r, [])!.members.find(m => m.peerId === 'fos')!.accepts).toEqual(expect.arrayContaining(['search', 'teleport']))
})
