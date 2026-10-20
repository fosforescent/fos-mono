/**
 * Texted commands are one adapter of the event grammar: a message from a linked phone (or any other chat channel
 * once its sender is linked to an account) is translated into ordinary events and dispatched for that account's
 * owner. The handlers never know the text came from SMS.
 *
 *   "done <words>"         search, then submit the first matching open task as completed
 *   "list" | "ls" | "todo" read Home and reply with its open tasks
 *   "[ ] text"             submit a new task in Home
 *   anything else          organized into Home's subtree when the host can organize: an `organize` requirement in
 *                          Home run through the same `organize` handler devices use (voice/organize.ts), the
 *                          message itself kept as a note in Home; otherwise (or when organizing fails) a plain row
 */
import { HOME_ID, type FosEvent, type OrganizedResult, type Principal } from '@fosforescent/shared/sync/index'
import type { InboundMessage } from './types'

export type TextCommandDeps = {
  /** The account a sender belongs to, or null when the sender is not linked. */
  userFor(message: InboundMessage): Promise<{ username: string; peerId: string } | null>
  /** Dispatch one event for the owner of that account (backend/sync/events.ts `handle`). */
  handle(principal: Principal & { username: string }, event: FosEvent): Promise<unknown>
  reply(message: InboundMessage, text: string): Promise<void>
  /**
   * Organize the text into the account's Home through the host's `organize` handler (voice/organize.ts
   * `createAccountOrganizer`); null when it was not organized (over budget, the model failed).
   */
  organize?(username: string, text: string, label: string): Promise<OrganizedResult | null>
  now?(): number
}

type Row = { id: string; title: string; done: boolean; kind: string; path: string[]; childCount: number; isLink?: boolean; refOwner?: string; refPeer?: string }

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
    if (!task && deps.organize && text) {
      try {
        const done = await deps.organize(account.username, text, `Text message (${message.source})`)
        if (done) {
          const { rows: added, under } = done
          await reply(`fos: organized into Home: ${added} row${added === 1 ? '' : 's'}${under.length ? ` (under ${under.slice(0, 3).map(t => `“${t}”`).join(', ')}${under.length > 3 ? ', …' : ''})` : ''}, and kept the message as a note`)
          return
        }
      } catch (error) {
        console.error('organizing a texted message failed:', error instanceof Error ? error.message : error)
      }
    }
    const title = (task ? (task[1] as string) : text).trim().slice(0, 500)
    await send({ kind: 'submit', path: [], expected: (await home()).revision, changes: [{ path: [], operation: task ? 'add_task' : 'add_plain', text: title }] })
    await reply(`fos: added “${title}”`)
  }
}
