import type { Request, Response } from 'express'
import { addRow, applyOrganizePlan, captureOutline, createReplica, ensureHomeContext, HOME_ID, view } from '@fosforescent/shared/sync/index'
import { accountOrganizer, createOrganizeHandler, organizeCapture, organizeInputOf } from './organize'
import { createVoiceNoteHandler, mediaTypeOf, type VoiceDeps, type VoiceUsage } from './voiceNotes'

/** A fake model: records what it was asked, answers with the queued replies. */
function model(...replies: string[]): VoiceDeps & { asked: Array<{ system: string; user: string; json?: boolean }> } {
  const asked: Array<{ system: string; user: string; json?: boolean }> = []
  return {
    asked,
    async transcribe() { return 'spoken words' },
    async complete(system, user, json) { asked.push({ system, user, json }); const next = replies.shift(); if (next === undefined) throw new Error('no reply queued'); return next },
    drain() { return { usd: asked.length * 0.01, tokens: asked.length * 100 } },
  }
}
function response() {
  const sent: { status: number; body: any } = { status: 200, body: null }
  const res = { status(c: number) { sent.status = c; return res }, json(b: unknown) { sent.body = b; return res } } as unknown as Response
  return { sent, res }
}
const outline = [{ id: 'garden', title: 'Garden' }, { id: 'tomatoes', parent: 'garden', title: 'Tomatoes' }]

test('the model sees the target, the outline with ids and the capture; its answer is validated against that outline', async () => {
  const fake = model(JSON.stringify({ title: 'Garden', items: [{ ref: 'n1', parent: 'tomatoes', type: 'lib:type:plain', text: 'water daily' }, { ref: 'n2', parent: 'not-in-outline', text: 'compost' }] }))
  const input = organizeInputOf({ text: 'water the tomatoes daily, start compost', title: 'Home', outline })
  if ('error' in input) throw new Error(input.error)
  const plan = await organizeCapture(fake, input)
  expect(fake.asked).toHaveLength(1)
  expect(fake.asked[0]!.json).toBe(true)
  expect(fake.asked[0]!.system).toMatch(/Never use an id that is not in the subtree/)
  expect(fake.asked[0]!.system).toMatch(/"lib:type:note" for a note/) // rows name a standard-library row type
  expect(fake.asked[0]!.user).toBe('Target: Home\n\nSubtree:\n- [garden] Garden\n  - [tomatoes] Tomatoes\n\nCapture:\nwater the tomatoes daily, start compost')
  expect(plan.items).toEqual([{ ref: 'n1', parent: 'tomatoes', text: 'water daily', type: 'lib:type:plain' }, { ref: 'n2', parent: null, text: 'compost', type: 'lib:type:plain' }])
})

test('an answer that is not JSON is asked for once more, then fails', async () => {
  const retried = model('Sure! Here it is', JSON.stringify({ items: [{ ref: 'n1', parent: '', text: 'ok' }] }))
  expect((await organizeCapture(retried, { text: 'x', title: '', outline: [] })).items).toHaveLength(1)
  expect(retried.asked[1]!.user).toMatch(/JSON object only/)
  await expect(organizeCapture(model('nope', 'still nope'), { text: 'x', title: '', outline: [] })).rejects.toThrow(/invalid JSON/)
})

test('a plan from the fake model applied to a replica lands inside the target subtree only, with the capture kept', async () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addRow(r, [HOME_ID], 'plain', 'Project', 2, { id: 'project' })
  r = addRow(r, [HOME_ID, 'project'], 'plain', 'Budget', 3, { id: 'budget' })
  r = addRow(r, [HOME_ID], 'plain', 'Unrelated', 4, { id: 'unrelated' })
  const target = [HOME_ID, 'project']
  const fake = model(JSON.stringify({ title: 'Kickoff', items: [
    { ref: 'n1', parent: 'budget', text: 'cap at $5k' },
    { ref: 'n2', parent: '', text: 'Hiring' },
    { ref: 'n3', parent: 'n2', text: 'one designer' },
    { ref: 'n4', parent: 'unrelated', text: 'must stay inside' },
  ] }))
  const sentOutline = await captureOutline(r, target)
  expect(sentOutline.map(e => e.id)).toEqual(['budget'])
  const plan = await organizeCapture(fake, { text: 'kickoff transcript', title: 'Project', outline: sentOutline })
  r = (await applyOrganizePlan(r, target, plan, { label: 'Voice note', stamp: 'now', text: 'kickoff transcript' }, 5)).replica
  const rows = (at: string[]) => view(r, at)!.tasks.filter(t => !t.scalar).map(t => t.title)
  expect(rows([HOME_ID, 'project', 'budget'])).toEqual(['cap at $5k'])
  const hiring = view(r, target)!.tasks.find(t => t.title === 'Hiring')!
  expect(rows([...target, hiring.id])).toEqual(['one designer'])
  expect(rows([HOME_ID, 'unrelated'])).toEqual([])
  expect(rows(target)).toEqual(['Budget', 'Hiring', 'must stay inside', '## Voice note: Kickoff\n\n_now_\n\nkickoff transcript'])
})

test('handler: validates the body, meters spend under the voice budget, reports model failures', async () => {
  const records: number[] = []
  let spent = 0
  const usage: VoiceUsage = {
    budgetUsd: 0.015,
    async userOf(req) { return (req as any).user ?? null },
    async spent() { return spent },
    async record(_id, entry) { records.push(entry.usd); spent += entry.usd },
  }
  const handler = createOrganizeHandler(model(JSON.stringify({ title: 'T', items: [{ ref: 'n1', parent: 'garden', text: 'weed' }] }), 'broken', 'still broken'), usage)
  const call = async (body: unknown, user: unknown = { id: 1, paying: false }) => { const { sent, res } = response(); await handler({ body, user } as unknown as Request, res); return sent }
  expect((await call({})).status).toBe(400)
  expect((await call({ text: 'x'.repeat(100_001) })).status).toBe(413)
  expect((await call({ text: 'weed the garden', outline }, null)).status).toBe(401)
  const ok = await call({ text: 'weed the garden', title: 'Home', outline })
  expect(ok.status).toBe(200)
  expect(ok.body.plan.items).toEqual([{ ref: 'n1', parent: 'garden', text: 'weed', type: 'lib:type:plain' }])
  expect(records).toEqual([0.01])
  const failed = await call({ text: 'again', outline })
  expect(failed.status).toBe(502)
  expect(failed.body.error).toMatch(/invalid JSON/)
  expect((await call({ text: 'over budget', outline })).status).toBe(402)
  expect((await call({ text: 'paying', outline }, { id: 1, paying: true })).status).toBe(502) // no replies left: not refused by the budget
})

test('organizing for an account without a request (texts) honours the budget and records spend', async () => {
  const records: number[] = []
  const usage: VoiceUsage = {
    budgetUsd: 1,
    async userOf() { return null },
    async userNamed(name) { return name === 'alice' ? { id: 1, paying: false } : name === 'broke' ? { id: 2, paying: false } : null },
    async spent(id) { return id === 2 ? 5 : 0 },
    async record(_id, entry) { records.push(entry.usd) },
  }
  const organize = accountOrganizer(model(JSON.stringify({ items: [{ ref: 'n1', parent: '', text: 'milk' }] })), usage)
  expect((await organize('alice', { text: 'milk', title: 'Home', outline: [] }))!.items).toHaveLength(1)
  expect(records).toEqual([0.01])
  expect(await organize('broke', { text: 'milk', title: 'Home', outline: [] })).toBeNull()
  expect(await organize('nobody', { text: 'milk', title: 'Home', outline: [] })).toBeNull()
})

test('voice notes: ?transcript=only returns the transcript without summarizing; iOS audio types are accepted', async () => {
  const transcribe = jest.fn(async () => ' the words ')
  const fake = { ...model(), transcribe }
  const handler = createVoiceNoteHandler(fake)
  for (const type of ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/x-m4a', 'audio/aac', 'audio/webm;codecs=opus']) {
    const { sent, res } = response()
    await handler({ body: Buffer.from('audio'), header: () => type, query: { transcript: 'only' } } as unknown as Request, res)
    expect(sent.status).toBe(200)
    expect(sent.body.transcript).toBe('the words')
    expect(sent.body.clusters).toBeUndefined()
  }
  expect(fake.asked).toHaveLength(0) // no summary or clustering calls
  expect(transcribe.mock.calls.map(c => (c as unknown[])[1])).toEqual(['audio/mp4', 'audio/mp4', 'audio/mp4', 'audio/aac', 'audio/webm'])
  expect(mediaTypeOf(undefined)).toBe('audio/webm')
  expect(mediaTypeOf('Audio/WAVE')).toBe('audio/wav')
})
