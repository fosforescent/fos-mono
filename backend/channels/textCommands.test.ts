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

test('other texts are organized into Home by the host organizer; when it cannot, the text lands in Home as a row', async () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addTask(r, [HOME_ID], 'Groceries', 2, 'groceries')
  const replies: string[] = []
  const asked: unknown[] = []
  const inbound = createTextCommandInbound({
    userFor: async () => ({ username: 'alice', peerId: 'user:alice' }),
    handle: async (principal: Principal, event: FosEvent) => { const d = dispatchEvent(r, event, principal, 10); r = d.replica; return d.result },
    reply: async (_message, text) => { replies.push(text) },
    // the organize requirement and its evaluation are the host's (voice/organize.ts createAccountOrganizer)
    organize: async (username, text, label) => {
      asked.push([username, text, label])
      if (text === 'fail please') throw new Error('model down')
      if (text === 'over budget') return null
      return { rows: 3, under: ['Groceries'], captureId: 'c', title: 'Errands' }
    },
  })
  const msg = (text: string): InboundMessage => ({ source: 'sms', id: 'm', from: '+1', replyTo: '+1', text, timestamp: 't' })
  await inbound(msg('need eggs, and hinges from the hardware store'))
  expect(asked[0]).toEqual(['alice', 'need eggs, and hinges from the hardware store', 'Text message (sms)'])
  expect(replies.at(-1)).toBe('fos: organized into Home: 3 rows (under “Groceries”), and kept the message as a note')
  const rows = (at: string[]) => view(r, at)!.tasks.filter(t => !t.scalar).map(t => t.title)
  // when organizing fails or is refused the text still lands in Home, as before
  await inbound(msg('fail please'))
  await inbound(msg('over budget'))
  expect(rows([HOME_ID])).toEqual(expect.arrayContaining(['fail please', 'over budget']))
  expect(replies.at(-1)).toBe('fos: added “over budget”')
  // explicit tasks are not organized
  await inbound(msg('[ ] call the plumber'))
  expect(asked).toHaveLength(3)
  expect(rows([HOME_ID])).toContain('call the plumber')
})

test('unlinked senders get one hint and nothing is written', async () => {
  const s = setup()
  const before = JSON.stringify(view(s.get(), [HOME_ID]))
  await s.inbound(s.msg('[ ] sneak in', '+15550000000'))
  expect(s.replies).toEqual(['fos: this sender is not linked to an account. Link it from the app (root › Phone).'])
  expect(JSON.stringify(view(s.get(), [HOME_ID]))).toBe(before)
})
