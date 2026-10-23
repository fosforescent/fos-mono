import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { handlerResult, addRow, applyProposalAt, createReplica, ensureHomeContext, evaluationRecord, HOME_ID, loadReplica, readNodeValue, serializeReplica, rejectProposalAt, requestOrganize, view, type OrganizedResult, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { asAccountStore } from '../sync/deviceRoot'
import type { AccountStoreDeps } from '../sync/accountStore'
import { createEventService } from '../sync/events'
import { createEvaluationService } from '../sync/evaluation'
import { createHostRuntime } from '../sync/host-runtime'
import { createTextCommandInbound } from '../channels/textCommands'
import { createAccountOrganizer, organizeCapture, organizeHandler } from './organize'
import { createVoiceNoteHandler, mediaTypeOf, type VoiceDeps, type VoiceUsage } from './voiceNotes'
import { PLAIN_TYPE } from '@fosforescent/shared/sync/library-types'

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
function usage(spent = 0, paying = false): VoiceUsage & { records: number[] } {
  const records: number[] = []
  return {
    records, budgetUsd: 0.015,
    async userOf() { return null },
    async userNamed(name) { return name === 'alice' ? { id: 1, paying } : null },
    async spent() { return spent + records.reduce((a, b) => a + b, 0) },
    async record(_id, entry) { records.push(entry.usd) },
  }
}

/** The account `alice` on a host whose runtime has the organize handler: its event route and evaluation. */
function host(initial: Replica, handler = organizeHandler(() => model())) {
  let store = initial.store
  const runtime = createHostRuntime([handler])
  initial = ensureHomeContext(initial, 0, runtime.hostOffers())
  store = initial.store
  const deps: AccountStoreDeps = { async loadStore(username) { return username === 'alice' ? { user: { id: 1, username }, store } : null }, async saveStore(_u, next) { store = next }, now: () => Date.UTC(2026, 9, 20, 9, 30), runtime }
  const evaluation = createEvaluationService(deps, runtime)
  const events = createEventService(deps, evaluation.runNode)
  const send = async (event: unknown, scope: string[] = []) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await events.http({ claims: { username: 'alice' }, body: { scope, event } } as unknown as Request, res)
    return { status, body }
  }
  const complete = async (path: string[]) => send({ kind: 'complete', path, expected: (await send({ kind: 'read', path })).body.valueRevision })
  return { deps, evaluation, send, complete, get: () => createReplica('user:alice', store), set: (r: Replica) => { store = r.store } }
}
const rows = (r: Replica, at: string[]) => view(r, at)!.tasks.filter(t => !t.scalar).map(t => t.title)

function garden(): Replica {
  let r = ensureHomeContext(createReplica('user:alice', asAccountStore(new FosStore())), 1, { server: ['organize'] })
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Project', 2, { id: 'project' })
  r = addRow(r, [HOME_ID, 'project'], PLAIN_TYPE, 'Budget', 3, { id: 'budget' })
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Unrelated', 4, { id: 'unrelated' })
  return r
}

test('the model sees the target, the outline with ids and the capture; its answer is validated against that outline', async () => {
  const fake = model(JSON.stringify({ title: 'Garden', items: [{ ref: 'n1', parent: 'tomatoes', type: 'plain', text: 'water daily' }, { ref: 'n2', parent: 'not-in-outline', text: 'compost' }] }))
  const outline = [{ id: 'garden', parent: null, title: 'Garden', depth: 0, path: ['garden'] }, { id: 'tomatoes', parent: 'garden', title: 'Tomatoes', depth: 1, path: ['garden', 'tomatoes'] }]
  const plan = await organizeCapture(fake, { text: 'water the tomatoes daily, start compost', title: 'Home', outline })
  expect(fake.asked).toHaveLength(1)
  expect(fake.asked[0]!.json).toBe(true)
  expect(fake.asked[0]!.system).toMatch(/Never use an id that is not in the subtree/)
  expect(fake.asked[0]!.system).toMatch(/"note" for a note/) // rows name a standard-library row type
  expect(fake.asked[0]!.user).toBe('Target: Home\n\nSubtree:\n- [garden] Garden\n  - [tomatoes] Tomatoes\n\nCapture:\nwater the tomatoes daily, start compost')
  expect(plan.items).toEqual([{ ref: 'n1', parent: 'tomatoes', text: 'water daily', type: 'plain' }, { ref: 'n2', parent: null, text: 'compost', type: 'plain' }])
})

test('an answer that is not JSON is asked for once more, then fails', async () => {
  const retried = model('Sure! Here it is', JSON.stringify({ items: [{ ref: 'n1', parent: '', text: 'ok' }] }))
  expect((await organizeCapture(retried, { text: 'x', title: '', outline: [] })).items).toHaveLength(1)
  expect(retried.asked[1]!.user).toMatch(/JSON object only/)
  await expect(organizeCapture(model('nope', 'still nope'), { text: 'x', title: '', outline: [] })).rejects.toThrow(/invalid JSON/)
})

test('the organize handler fills a requirement in the target with ONE fos submission there: main unchanged until it is accepted, supply recorded', async () => {
  const fake = model(JSON.stringify({ title: 'Kickoff', items: [
    { ref: 'n1', parent: 'budget', text: 'cap at $5k' },
    { ref: 'n2', parent: '', text: 'Hiring' },
    { ref: 'n3', parent: 'n2', text: 'one designer' },
    { ref: 'n4', parent: 'unrelated', text: 'must stay inside' },
  ] }))
  const meter = usage()
  const target = [HOME_ID, 'project']
  const asked = requestOrganize(garden(), target, 'kickoff transcript', 'Voice note', 5)
  const h = host(asked.replica, organizeHandler(() => fake, meter))
  const done = await h.complete(asked.path)
  if (!done.body.evaluation) throw new Error(`organize failed: ${JSON.stringify(done.body)}`)
  expect(done.body.evaluation.status).toBe('committed')
  // the server built the outline itself: the target's subtree only, without the requirement
  expect(fake.asked[0]!.user).toBe('Target: Project\n\nSubtree:\n- [budget] Budget\n\nCapture:\nkickoff transcript')
  const r = h.get()
  // main is unchanged: the result is ONE submission by fos on the target, not rows
  expect(rows(r, [HOME_ID, 'project', 'budget'])).toEqual([])
  expect(rows(r, target)).toEqual(['Budget', 'Voice note'])
  expect(rows(r, [HOME_ID, 'unrelated'])).toEqual([])
  const submissions = view(r, target)!.proposals
  expect(submissions).toHaveLength(1)
  expect(submissions[0]).toMatchObject({ peerId: 'fos', name: 'Voice note: Kickoff', status: 'open' })
  const request = view(r, target)!.tasks.find(t => t.id === asked.path.at(-1))!
  expect(request.requirement).toMatchObject({ capability: 'organize', satisfied: true })
  expect(view(r, asked.path)!.tasks.find(t => t.supply)!.supply).toMatchObject({ capability: 'organize', by: 'fos' })
  const result = handlerResult<OrganizedResult>(r, asked.path)!
  expect(result).toMatchObject({ rows: 4, title: 'Kickoff', under: ['Budget'], proposal: submissions[0]!.id, name: 'Voice note: Kickoff' })
  // what it adds, by node: three rows and the capture under the target, one under Budget (the Hiring group's row is inside it)
  expect(result.additions.map(a => [a.path, a.ids.length])).toEqual([[[], 3], [['budget'], 1]])
  expect(meter.records).toEqual([0.01])

  // accepting it is one edit that brings everything; rejecting leaves main as it was
  const copy = loadReplica(serializeReplica(r)) // replicas share their store: decide on separate copies
  const accepted = applyProposalAt(r, target, submissions[0]!.id, 'user:alice', 99)
  expect(rows(accepted, [HOME_ID, 'project', 'budget'])).toEqual(['cap at $5k'])
  const hiring = view(accepted, target)!.tasks.find(t => t.title === 'Hiring')!
  expect(rows(accepted, [...target, hiring.id])).toEqual(['one designer'])
  expect(rows(accepted, target)).toContain('must stay inside')
  // the capture is a note: its label is the title line, the stamp and transcript its body row
  expect(rows(accepted, target)).toContain('Voice note: Kickoff')
  const capture = view(accepted, target)!.tasks.find(t => t.title === 'Voice note: Kickoff')!
  expect(view(accepted, [...target, capture.id])!.tasks.find(t => t.scalar)!.title).toBe('## Voice note: Kickoff\n\n_2026-10-20 09:30 UTC_\n\nkickoff transcript')
  expect(rows(accepted, [HOME_ID, 'unrelated'])).toEqual([])
  expect(view(accepted, target)!.proposals).toEqual([])
  const rejected = rejectProposalAt(copy, target, submissions[0]!.id, 99)
  expect(rows(rejected, target)).toEqual(['Budget', 'Voice note'])
  expect(rows(rejected, [HOME_ID, 'project', 'budget'])).toEqual([])
  expect(view(rejected, target)!.proposals[0]!.status).toBe('rejected')
})

test('over the free budget the requirement is refused before anything runs; a failing model leaves it unfilled', async () => {
  const asked = requestOrganize(garden(), [HOME_ID], 'milk', 'Pasted text', 5)
  const broke = host(asked.replica, organizeHandler(() => model('{"items":[]}'), usage(5)))
  expect(String((await broke.complete(asked.path)).body.error)).toMatch(/free budget/)
  expect(evaluationRecord(broke.get(), asked.path)).toBeNull()
  const paying = host(asked.replica, organizeHandler(() => model('{"items":[]}'), usage(5, true)))
  expect((await paying.complete(asked.path)).body.evaluation.status).toBe('committed')
  const failing = host(requestOrganize(garden(), [HOME_ID], 'milk', 'Pasted text', 5).replica)
  const path = view(failing.get(), [HOME_ID])!.tasks.find(t => t.requirement?.capability === 'organize')!.id
  expect(String((await failing.complete([HOME_ID, path])).body.error)).toMatch(/no reply queued/)
  expect(view(failing.get(), [HOME_ID])!.tasks.find(t => t.id === path)!.requirement!.satisfied).toBe(false)
})

test('texted messages go through the same handler: a pending fos submission in Home, the requirement removed, Home unchanged until accepted', async () => {
  let r = ensureHomeContext(createReplica('user:alice', asAccountStore(new FosStore())), 1, { server: ['organize'] })
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Groceries', 2, { id: 'groceries' })
  r = addRow(r, [HOME_ID, 'groceries'], PLAIN_TYPE, 'milk', 3, { id: 'milk' })
  const fake = model(JSON.stringify({ title: 'Errands', items: [{ ref: 'n1', parent: 'groceries', type: 'plain', text: 'eggs' }, { ref: 'n2', parent: null, type: 'plain', text: 'Hardware store' }, { ref: 'n3', parent: 'n2', type: 'plain', text: 'hinges' }] }))
  const h = host(r, organizeHandler(() => fake))
  const replies: string[] = []
  const inbound = createTextCommandInbound({
    userFor: async () => ({ username: 'alice', peerId: 'user:alice' }),
    handle: async (principal, event) => (await h.send(event, principal.scope)).body,
    reply: async (_message, text) => { replies.push(text) },
    organize: createAccountOrganizer(h.deps, h.evaluation.runNode),
  })
  await inbound({ source: 'sms', id: 'm', from: '+1', replyTo: '+1', text: 'need eggs, and hinges from the hardware store', timestamp: 't' })
  expect(fake.asked[0]!.user).toMatch(/^Target: Home\n\nSubtree:\n- \[groceries\] Groceries\n  - \[milk\] milk\n/)
  const after = h.get()
  // Home is unchanged: the message waits there as one pending submission by fos
  expect(rows(after, [HOME_ID, 'groceries'])).toEqual(['milk'])
  expect(rows(after, [HOME_ID]).some(t => t.includes('need eggs'))).toBe(false)
  expect(view(after, [HOME_ID])!.tasks.some(t => t.requirement?.capability === 'organize')).toBe(false)
  const [pending] = view(after, [HOME_ID])!.proposals
  expect(pending).toMatchObject({ peerId: 'fos', name: 'Text message (sms): Errands', status: 'open' })
  expect(replies.at(-1)).toBe('fos: organized for Home, waiting for you to accept it there: 3 rows (under “Groceries”), and the message kept as a note')
  const accepted = applyProposalAt(after, [HOME_ID], pending!.id, 'user:alice', 99)
  expect(rows(accepted, [HOME_ID, 'groceries'])).toEqual(['milk', 'eggs'])
  const hardware = view(accepted, [HOME_ID])!.tasks.find(t => t.title === 'Hardware store')!
  expect(rows(accepted, [HOME_ID, hardware.id])).toEqual(['hinges'])
  expect(rows(accepted, [HOME_ID]).at(-1)).toBe('Text message (sms): Errands')
  const message = view(accepted, [HOME_ID])!.tasks.at(-1)!
  expect(view(accepted, [HOME_ID, message.id])!.tasks.find(t => t.scalar)!.title).toBe('## Text message (sms): Errands\n\n_2026-10-20 09:30 UTC_\n\nneed eggs, and hinges from the hardware store')
  // the model failing: the requirement goes again and the text lands in Home as a plain row
  await inbound({ source: 'sms', id: 'm2', from: '+1', replyTo: '+1', text: 'fail please', timestamp: 't' })
  expect(rows(h.get(), [HOME_ID])).toContain('fail please')
  expect(view(h.get(), [HOME_ID])!.tasks.some(t => t.requirement?.capability === 'organize')).toBe(false)
  expect(replies.at(-1)).toBe('fos: added “fail please”')
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
