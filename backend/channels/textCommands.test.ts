import { addTask, createReplica, dispatchEvent, ensureHomeContext, HOME_ID, view, type FosEvent, type Principal } from '@fosforescent/shared/sync/index'
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

test('unlinked senders get one hint and nothing is written', async () => {
  const s = setup()
  const before = JSON.stringify(view(s.get(), [HOME_ID]))
  await s.inbound(s.msg('[ ] sneak in', '+15550000000'))
  expect(s.replies).toEqual(['fos: this sender is not linked to an account. Link it from the app (root › Phone).'])
  expect(JSON.stringify(view(s.get(), [HOME_ID]))).toBe(before)
})
