import { createHash } from 'node:crypto'
import { addConstructedRow, addRow, applyProposalAt, createReplica, headCid, view } from './replica'
import { content, put, readProposals, resolveScope, rowTemplate, valueContent } from './graph'
import { formValueAt } from './forms'
import { markdownTitle, proposeVisitorValues, setSharing, sharedProjection, SHARED_BODY_LIMIT, VISITOR_SUBMISSION } from './sharing'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

test('a published note carries its whole markdown body and text presentation, keyed off the row type, not the row kind', () => {
  let r = createReplica('user:host')
  r = addRow(r, [], 'note', '# Hello world\n\nThe **body** of a post.', 1, { id: 'post' })
  r = addRow(r, ['post'], 'note', '## Section\n\n' + 'x'.repeat(9000), 2, { id: 'long' })
  r = addRow(r, ['post'], 'plain', 'A plain row', 3, { id: 'plain' })
  r = addRow(r, ['post', 'plain'], 'note', 'Nested *note*', 4, { id: 'nested' })
  r = addRow(r, ['post'], 'note', 'y'.repeat(SHARED_BODY_LIMIT + 10), 5, { id: 'huge' })
  r = setSharing(r, ['post'], { id: 'public-link-0123456789', audience: 'public', enabled: true }, 6)
  let hashed: any
  const node = sharedProjection(r, ['post'], value => { hashed = value; return digest(value) })
  expect(node).toMatchObject({ title: 'Hello world', type: 'lib:type:note', body: '# Hello world\n\nThe **body** of a post.' })
  expect(node.truncated).toBeUndefined()
  // the notes' body fields are their bodies, not rows of the page
  expect(node.rows.map(row => row.id)).toEqual(['long', 'plain', 'nested', 'huge'])
  const rows = Object.fromEntries(node.rows.map(row => [row.id, row]))
  // bodies are no longer cut at 8000 characters; the short title is the first heading
  expect(rows.long).toMatchObject({ title: 'Section', depth: 0, type: 'lib:type:note' })
  expect(rows.long!.body).toHaveLength('## Section\n\n'.length + 9000)
  expect(rows.plain).toEqual({ id: 'plain', title: 'A plain row', depth: 0, type: 'lib:type:plain' })
  expect(rows.nested).toMatchObject({ title: 'Nested note', depth: 1, body: 'Nested *note*' })
  expect(rows.huge!.body).toHaveLength(SHARED_BODY_LIMIT)
  expect(rows.huge!.truncated).toBe(true)
  expect(node.rows.every(row => !('kind' in row))).toBe(true)
  // the revision is computed from the earlier row shape, so votes cast before bodies were published stay valid
  expect(hashed.rows.find((row: any) => row.id === 'long')).toEqual({ id: 'long', title: ('## Section\n\n' + 'x'.repeat(9000)).slice(0, 8000), kind: 'plain', depth: 0 })
})

test('markdown titles drop heading and inline markup', () => {
  expect(markdownTitle('\n\nIntro line\n# The *real* title')).toBe('The real title')
  expect(markdownTitle('> A [quoted](https://x.example) `line`\nmore')).toBe('A quoted line')
  expect(markdownTitle('')).toBe('')
})

test('empty fields of a published row are inputs of their type; each visitor submits candidates as its own peer', () => {
  let r = createReplica('user:host')
  // a product type over the library's text type: its title field is presented by the row, the other is asked for
  const note = content(r.store, rowTemplate(r.store, 'note'))
  const text = note.children.find(([, cid]) => content(r.store, cid).data.parameter)![0]
  const field = (name: string) => put(r.store, { data: { parameter: { name } }, children: [] })
  const type = put(r.store, { data: { form: { title: ['label'] } }, children: [[text, field('label')], [text, field('email')]] })
  r = addRow(r, [], 'plain', 'Sign up', 1, { id: 'page' })
  r = addConstructedRow(r, ['page'], type, { label: 'Your details' }, 2, 'details')
  r = setSharing(r, ['page'], { id: 'public-link-0123456789', audience: 'public', enabled: true }, 3)
  const node = sharedProjection(r, ['page'], value => JSON.stringify(value).length.toString())
  expect(node.rows).toEqual([
    { id: 'details', title: 'Your details', depth: 0 },
    { id: 'details/field/email', title: 'email', depth: 1, type: 'lib:type:text', body: '' }
  ])
  expect(node.inputs).toEqual([{ key: JSON.stringify(['details', 'details/field/email']), path: ['details', 'details/field/email'], name: 'email', kind: 'text' }])
  // two visitors: two submissions; a resubmission replaces only its own
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
