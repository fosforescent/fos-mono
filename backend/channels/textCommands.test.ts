import { addRow, addTask, createReplica, dispatchEvent, ensureHomeContext, HOME_ID, view, type FosEvent, type Principal } from '@fosforescent/shared/sync/index'
import { createTextCommandInbound } from './textCommands'
import type { InboundMessage } from './types'

function setup() {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addTask(r, [HOME_ID], 'buy milk', 2, 'milk')
  r = addTask(r, [HOME_ID], 'call bob', 3, 'bob')
  const replies: string[] = []
  const inbound = createTextCommandInbound({
    userFor: async message => message.from === '+15551234567' ? { username: 'alice', peerId: 'user:alice' } : null,
    handle: async (principal: Principal, event: FosEvent) => { const d = dispatchEvent(r, event, principal, 10); r = d.replica; return d.result },
    reply: async (_message, text) => { replies.push(text) },
  })
  const msg = (text: string, from = '+15551234567'): InboundMessage => ({ source: 'sms', id: 'm', from, replyTo: from, text, timestamp: 't' })
  return { inbound, msg, replies, get: () => r }
}

test('texted commands are translated into grammar events for the account owner', async () => {
  const s = setup()
  await s.inbound(s.msg('[ ] water the plants'))
  expect(s.replies.at(-1)).toBe('fos: added “water the plants”')
  expect(view(s.get(), [HOME_ID])!.tasks.map(t => [t.kind, t.title])).toContainEqual(['task', 'water the plants'])
  await s.inbound(s.msg('remember the receipt'))
  expect(view(s.get(), [HOME_ID])!.tasks.find(t => t.title === 'remember the receipt')!.kind).toBe('plain')
  await s.inbound(s.msg('list'))
  expect(s.replies.at(-1)).toBe('1. buy milk\n2. call bob\n3. water the plants')
  await s.inbound(s.msg('done milk'))
  expect(s.replies.at(-1)).toBe('✓ done: buy milk')
  expect(view(s.get(), [HOME_ID])!.tasks.find(t => t.id === 'milk')!.done).toBe(true)
  await s.inbound(s.msg('done nothing like this'))
  expect(s.replies.at(-1)).toMatch(/no open task/)
})

test('texted notes are organized into Home\'s subtree in one submission, and the message is kept as a note', async () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addTask(r, [HOME_ID], 'Groceries', 2, 'groceries')
  r = addRow(r, [HOME_ID, 'groceries'], 'plain', 'milk', 3, { id: 'milk' })
  const replies: string[] = []
  const asked: unknown[] = []
  const inbound = createTextCommandInbound({
    userFor: async () => ({ username: 'alice', peerId: 'user:alice' }),
    handle: async (principal: Principal, event: FosEvent) => { const d = dispatchEvent(r, event, principal, 10); r = d.replica; return d.result },
    reply: async (_message, text) => { replies.push(text) },
    now: () => Date.UTC(2026, 9, 20, 9, 30),
    organize: async (username, input) => {
      asked.push({ username, ...input })
      if (input.text === 'fail please') throw new Error('model down')
      return { title: 'Errands', items: [{ ref: 'n1', parent: 'groceries', type: 'lib:type:plain', text: 'eggs' }, { ref: 'n2', parent: null, type: 'lib:type:plain', text: 'Hardware store' }, { ref: 'n3', parent: 'n2', type: 'lib:type:plain', text: 'hinges' }] }
    },
  })
  const msg = (text: string): InboundMessage => ({ source: 'sms', id: 'm', from: '+1', replyTo: '+1', text, timestamp: 't' })
  await inbound(msg('need eggs, and hinges from the hardware store'))
  expect(asked[0]).toMatchObject({ username: 'alice', title: 'Home', text: 'need eggs, and hinges from the hardware store' })
  expect((asked[0] as any).outline.map((e: any) => [e.id, e.parent])).toEqual([['groceries', null], ['milk', 'groceries']])
  const rows = (at: string[]) => view(r, at)!.tasks.filter(t => !t.scalar).map(t => t.title)
  expect(rows([HOME_ID, 'groceries'])).toEqual(['milk', 'eggs'])
  const hardware = view(r, [HOME_ID])!.tasks.find(t => t.title === 'Hardware store')!
  expect(rows([HOME_ID, hardware.id])).toEqual(['hinges'])
  expect(rows([HOME_ID]).at(-1)).toBe('## Text message (sms): Errands\n\n_2026-10-20 09:30 UTC_\n\nneed eggs, and hinges from the hardware store')
  expect(replies.at(-1)).toBe('fos: organized into Home: 3 rows (under “Groceries”), and kept the message as a note')
  // when organizing fails the text still lands in Home, as before
  await inbound(msg('fail please'))
  expect(rows([HOME_ID])).toContain('fail please')
  expect(replies.at(-1)).toBe('fos: added “fail please”')
  // explicit tasks are not organized
  await inbound(msg('[ ] call the plumber'))
  expect(asked).toHaveLength(2)
  expect(view(r, [HOME_ID])!.tasks.find(t => t.title === 'call the plumber')!.kind).toBe('task')
})

test('unlinked senders get one hint and nothing is written', async () => {
  const s = setup()
  const before = JSON.stringify(view(s.get(), [HOME_ID]))
  await s.inbound(s.msg('[ ] sneak in', '+15550000000'))
  expect(s.replies).toEqual(['fos: this sender is not linked to an account. Link it from the app (root › Phone).'])
  expect(JSON.stringify(view(s.get(), [HOME_ID]))).toBe(before)
})
