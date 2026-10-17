import type { Request, Response } from 'express'
import { chunkText, createVoiceNoteHandler, prismaVoiceUsage, summarizeHierarchically, voiceNoteFromAudio, type VoiceDeps, type VoiceUsage } from './voiceNotes'

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

test('free budget: non-paying users are cut off at the budget, paying users are not; spend is recorded from the meter', async () => {
  const records: Array<{ userId: number; usd: number }> = []
  let spentSoFar = 0.95
  const usage: VoiceUsage = {
    budgetUsd: 1,
    async userOf(req) { return (req as any).paying === undefined ? null : { id: 7, paying: (req as any).paying } },
    async spent() { return spentSoFar },
    async record(userId, entry) { records.push({ userId, usd: entry.usd }); spentSoFar += entry.usd }
  }
  let metered = 0
  const d = deps({ async transcribe() { metered += 0.08; return 'spoken words here' }, drain() { const out = { usd: metered, tokens: 100 }; metered = 0; return out } })
  const handler = createVoiceNoteHandler(d, usage)
  const sent: { status: number; body: any } = { status: 200, body: null }
  const res = { status(c: number) { sent.status = c; return res }, json(b: unknown) { sent.body = b; return res } } as unknown as Response
  const call = async (paying: boolean | undefined) => { sent.status = 200; await handler({ body: Buffer.from('x'), header: () => 'audio/webm', paying } as unknown as Request, res) }
  await call(undefined); expect(sent.status).toBe(401)
  await call(false); expect(sent.status).toBe(200); expect(sent.body.cost.usd).toBeCloseTo(0.08); expect(records).toEqual([{ userId: 7, usd: 0.08 }])
  await call(false); expect(sent.status).toBe(402); expect(sent.body.error).toMatch(/free budget/); expect(records).toHaveLength(1)
  await call(true); expect(sent.status).toBe(200); expect(records).toHaveLength(2)
})

test('prisma usage: paying detection, spend summed from usage rows, records usage rows (never ledger entries)', async () => {
  const created: any[] = []
  const prisma = {
    userModel: { async findUnique({ where }: any) { return where.user_name === 'free@x' ? { id: 1, subscription_status: '', role: 'user' } : where.user_name === 'pro@x' ? { id: 2, subscription_status: 'active', role: 'user' } : null } },
    voiceUsageModel: {
      async aggregate({ where }: any) { return { _sum: { usd: where.userId === 1 ? 0.75 : null } } },
      async create({ data }: any) { created.push(data) }
    }
  }
  const usage = prismaVoiceUsage(prisma, 1)
  expect(await usage.userOf({ claims: { username: 'free@x' } } as any)).toEqual({ id: 1, paying: false })
  expect(await usage.userOf({ claims: { username: 'pro@x' } } as any)).toEqual({ id: 2, paying: true })
  expect(await usage.userOf({ claims: {} } as any)).toBeNull()
  expect(await usage.spent(1)).toBeCloseTo(0.75)
  await usage.record(1, { usd: 0.01, tokens: 1234, seconds: 3.2, bytes: 8000, clusters: 2 })
  expect(created[0]).toEqual({ userId: 1, usd: 0.01, tokens: 1234, seconds: 3.2, bytes: 8000, clusters: 2 })
})

test('media input uses the same organization pipeline and rejects unsupported or oversized files', async () => {
  const transcribe = jest.fn(async () => 'A diagram of project tasks')
  const handler = createVoiceNoteHandler(deps({ transcribe }))
  const sent: { status: number; body: any } = { status: 200, body: null }
  const res = { status(c: number) { sent.status = c; return res }, json(b: unknown) { sent.body = b; return res } } as unknown as Response
  for (const mime of ['image/png', 'video/mp4']) {
    sent.status = 200
    await handler({ body: Buffer.from('media'), header: () => mime } as unknown as Request, res)
    expect(sent.status).toBe(200)
    expect(transcribe).toHaveBeenLastCalledWith(Buffer.from('media'), mime)
    expect(sent.body.clusters).toHaveLength(2)
  }
  await handler({ body: Buffer.from('file'), header: () => 'text/html' } as unknown as Request, res)
  expect(sent.status).toBe(415)
  await handler({ body: Buffer.alloc(25 * 1024 * 1024 + 1), header: () => 'image/png' } as unknown as Request, res)
  expect(sent.status).toBe(413)
  expect(transcribe).toHaveBeenCalledTimes(2)
})
