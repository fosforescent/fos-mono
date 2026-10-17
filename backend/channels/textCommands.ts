/**
 * Texted commands are one adapter of the event grammar: a message from a linked phone (or any other chat channel
 * once its sender is linked to an account) is translated into ordinary events and dispatched for that account's
 * owner. The handlers never know the text came from SMS.
 *
 *   "done <words>"         search, then submit the first matching open task as completed
 *   "list" | "ls" | "todo" read Home and reply with its open tasks
 *   anything else          submit a new row in Home ("[ ] text" makes a task, otherwise a plain row)
 */
import { HOME_ID, type FosEvent, type Principal } from '@fosforescent/shared/sync/index'
import type { InboundMessage } from './types'

export type TextCommandDeps = {
  /** The account a sender belongs to, or null when the sender is not linked. */
  userFor(message: InboundMessage): Promise<{ username: string; peerId: string } | null>
  /** Dispatch one event for the owner of that account (backend/sync/events.ts `handle`). */
  handle(principal: Principal & { username: string }, event: FosEvent): Promise<unknown>
  reply(message: InboundMessage, text: string): Promise<void>
}

type Row = { id: string; title: string; done: boolean; kind: string; path: string[] }

export function createTextCommandInbound(deps: TextCommandDeps) {
  return async (message: InboundMessage): Promise<void> => {
    const account = await deps.userFor(message)
    const reply = (text: string) => deps.reply(message, text)
    if (!account) { await reply('fos: this sender is not linked to an account. Link it from the app (root › Phone).'); return }
    const principal: Principal & { username: string } = { username: account.username, peerId: account.peerId, owner: true, scope: [HOME_ID] }
    const send = (event: FosEvent) => deps.handle(principal, event)
    const text = message.text.trim()
    const home = async () => await send({ kind: 'read', path: [] }) as { revision: string; children: Row[] }
    const done = text.match(/^(?:done|did|finished|✓)\s+(.+)$/i)
    if (done) {
      const wanted = (done[1] as string).trim().toLowerCase()
      const found = await send({ kind: 'search', path: [], query: wanted }) as { matches: Array<{ path: string[]; title: string | null; done: boolean }> }
      const hit = found.matches.find(m => !m.done && m.path.length)
      if (!hit) { await reply(`fos: no open task matches “${done[1]}”`); return }
      try {
        await send({ kind: 'submit', path: [], expected: (await home()).revision, changes: [{ path: hit.path, operation: 'complete', done: true }] })
        await reply(`✓ done: ${hit.title}`)
      } catch (error) { await reply(`fos: ${error instanceof Error ? error.message : 'could not complete that task'}`) }
      return
    }
    if (/^(list|ls|todo|tasks)$/i.test(text)) {
      const open = (await home()).children.filter(row => row.kind === 'task' && !row.done).slice(0, 8)
      await reply(open.length ? open.map((t, i) => `${i + 1}. ${t.title}`).join('\n') : 'fos: nothing open')
      return
    }
    const task = text.match(/^(?:\[\s?\]|todo|task)\s*:?\s+(.+)$/is)
    const title = (task ? (task[1] as string) : text).trim().slice(0, 500)
    await send({ kind: 'submit', path: [], expected: (await home()).revision, changes: [{ path: [], operation: task ? 'add_task' : 'add_plain', text: title }] })
    await reply(`fos: added “${title}”`)
  }
}
