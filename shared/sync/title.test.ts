import { markdownTitle, truncateTitle } from './title'
import { requestTitle, titleRequestAt } from './title-request'
import { addRow, createReplica, view } from './replica'
import { NOTE_TYPE } from './library-types'

test('the truncation handler: first heading or line, markup off, cut at a word with an ellipsis', () => {
  expect(truncateTitle('Short line\nmore')).toBe('Short line')
  expect(truncateTitle('intro\n## The *real* title\nbody')).toBe('The real title')
  expect(truncateTitle('---\ntags: x\n---\nAfter frontmatter')).toBe('After frontmatter')
  const long = truncateTitle('This sentence is far too long to be a title for anything that someone would like to read quickly')
  expect(long.endsWith('…')).toBe(true)
  expect(long.length).toBeLessThanOrEqual(60)
  expect(long).toBe('This sentence is far too long to be a title for anything…')
  expect(markdownTitle('')).toBe('')
})

test('a note made from one line is titled as typed; from more lines, its whole text is the body and the handler titles it', () => {
  let r = createReplica('a')
  r = addRow(r, [], NOTE_TYPE, 'Just a title', 1, { id: 'one' })
  r = addRow(r, [], NOTE_TYPE, '# Euler\n\n$$e^{i\pi} + 1 = 0$$', 2, { id: 'two' })
  expect(view(r, [])!.tasks.find(t => t.id === 'one')!.title).toBe('Just a title')
  expect(view(r, [])!.tasks.find(t => t.id === 'one')!.body).toBe('')
  expect(view(r, [])!.tasks.find(t => t.id === 'two')!.title).toBe('Euler')
  expect(view(r, [])!.tasks.find(t => t.id === 'two')!.body).toBe('# Euler\n\n$$e^{i\pi} + 1 = 0$$')
  // asking a peer's title handler: a `title` requirement in the note, which reads the note's text
  const asked = requestTitle(r, ['two'], 3, () => 'x')
  expect(asked.path).toEqual(['two', 'x'])
  expect(titleRequestAt(asked.replica, asked.path)).toEqual({ text: '# Euler\n\n$$e^{i\pi} + 1 = 0$$' })
})
