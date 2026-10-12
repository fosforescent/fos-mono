import type { Request, Response } from 'express'
import { chunkText, createVoiceNoteHandler, summarizeHierarchically, voiceNoteFromAudio, type VoiceDeps } from './voiceNotes'

function deps(overrides: Partial<VoiceDeps> = {}): VoiceDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    chunkWords: 5,
    async transcribe() { return 'one two three four five six seven eight nine ten eleven twelve' },
    async complete(_system, user, json) {
      calls.push(user.split('\n')[0] ?? '')
      if (json) return JSON.stringify({ title: 'Trip planning', summary: 'S', clusters: [{ title: 'Excited', sentiment: 'positive', summary: 'good', points: ['book flights', 'see Ada'] }, { title: 'Worried', sentiment: 'bogus', summary: 'costs', points: [] }, 'junk'] })
      return `sum(${user.split('\n\n')[1]?.split(' ').length ?? 0})`
    },
    ...overrides
  }
}

test('chunking and hierarchical summarization: chunks are summarized, then the summaries', async () => {
  expect(chunkText('a b c d e f g', 3)).toEqual(['a b c', 'd e f', 'g'])
  expect(chunkText('', 3)).toEqual([''])
  const d = deps()
  const { summary, levels } = await summarizeHierarchically(d, 'one two three four five six seven eight nine ten eleven twelve')
  // 12 words / 5 per chunk → 3 partial summaries ("sum(5)", "sum(5)", "sum(2)" = 3 words) → one final pass
  expect(levels).toBe(2)
  expect(d.calls.filter((c) => c.startsWith('Summarize this part'))).toHaveLength(3)
  expect(summary).toMatch(/^sum\(/)
})

test('voice note: transcript, hierarchical summary, validated clusters', async () => {
  const note = await voiceNoteFromAudio(deps(), Buffer.from('audio'), 'audio/webm')
  expect(note.transcript).toMatch(/^one two/)
  expect(note.title).toBe('Trip planning')
  expect(note.summary).toBe('S')
  expect(note.clusters).toEqual([
    { title: 'Excited', sentiment: 'positive', summary: 'good', points: ['book flights', 'see Ada'] },
    { title: 'Worried', sentiment: 'neutral', summary: 'costs', points: [] }
  ])
})

test('handler: rejects empty bodies and reports model failures as 502', async () => {
  const sent: { status: number; body: any } = { status: 200, body: null }
  const res = { status(c: number) { sent.status = c; return res }, json(b: unknown) { sent.body = b; return res } } as unknown as Response
  const reset = () => { sent.status = 200; sent.body = null }
  const handler = createVoiceNoteHandler(deps())
  await handler({ body: undefined, header: () => undefined } as unknown as Request, res)
  expect(sent.status).toBe(400)
  reset()
  await handler({ body: Buffer.from('x'), header: () => 'audio/webm' } as unknown as Request, res)
  expect(sent.status).toBe(200)
  expect(sent.body.clusters).toHaveLength(2)
  const failing = createVoiceNoteHandler(deps({ async transcribe() { throw new Error('no key') } }))
  reset()
  await failing({ body: Buffer.from('x'), header: () => 'audio/webm' } as unknown as Request, res)
  expect(sent.status).toBe(502)
  expect(sent.body.error).toMatch(/no key/)
})
