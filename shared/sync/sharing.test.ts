import { createHash } from 'node:crypto'
import { addRow, createReplica } from './replica'
import { markdownTitle, setSharing, sharedProjection, SHARED_BODY_LIMIT } from './sharing'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

test('a published note carries its whole markdown body and text presentation, keyed off the graph, not the row kind', () => {
  let r = createReplica('user:host')
  r = addRow(r, [], 'note', '# Hello world\n\nThe **body** of a post.', 1, { id: 'post' })
  r = addRow(r, ['post'], 'note', '## Section\n\n' + 'x'.repeat(9000), 2, { id: 'long' })
  r = addRow(r, ['post'], 'plain', 'A plain row', 3, { id: 'plain' })
  r = addRow(r, ['post', 'plain'], 'note', 'Nested *note*', 4, { id: 'nested' })
  r = addRow(r, ['post'], 'note', 'y'.repeat(SHARED_BODY_LIMIT + 10), 5, { id: 'huge' })
  r = setSharing(r, ['post'], { id: 'public-link-0123456789', audience: 'public', enabled: true }, 6)
  let hashed: any
  const node = sharedProjection(r, ['post'], value => { hashed = value; return digest(value) })
  expect(node).toMatchObject({ title: 'Hello world', text: { mediaType: 'text/markdown' }, body: '# Hello world\n\nThe **body** of a post.' })
  expect(node.truncated).toBeUndefined()
  // the notes' body fields are their bodies, not rows of the page
  expect(node.rows.map(row => row.id)).toEqual(['long', 'plain', 'nested', 'huge'])
  const rows = Object.fromEntries(node.rows.map(row => [row.id, row]))
  // bodies are no longer cut at 8000 characters; the short title is the first heading
  expect(rows.long).toMatchObject({ title: 'Section', depth: 0, text: { mediaType: 'text/markdown' } })
  expect(rows.long!.body).toHaveLength('## Section\n\n'.length + 9000)
  expect(rows.plain).toEqual({ id: 'plain', title: 'A plain row', depth: 0 })
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
