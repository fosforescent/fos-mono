/**
 * Asking a peer's `title` handler (the fos server's model) for a headline row's title: a `title` requirement inside
 * the row, whose handler reads the row's text (`titleRequestAt`), records the title as its result on the requirement
 * (`handlerResult`) and supplies it. The asker sets the row's title from it and removes the request.
 */
import { formText } from './forms'
import { newId, resolveScope, valueContent, type Scope } from './graph'
import { ALLOCATION_TYPE } from './library-types'
import { addRow, headCid, view, type Replica } from './replica'


export function requestTitle(replica: Replica, at: Scope, now: number, makeId: () => string = newId): { replica: Replica; path: Scope } {
  if (!at.length || !view(replica, at)) throw new Error('The row to title was removed.')
  const id = makeId()
  return { replica: addRow(replica, at, ALLOCATION_TYPE, 'Title', now, { id, requirement: { capability: 'title' } }), path: [...at, id] }
}

/** The text a `title` requirement at `path` asks a title for: the whole text of the row it is in, or null. */
export function titleRequestAt(replica: Replica, path: Scope): { text: string } | null {
  const row = view(replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
  const owner = resolveScope(replica.store, headCid(replica), path.slice(0, -1))
  if (!row || !owner || row.requirement?.capability !== 'title') return null
  const text = formText(replica.store, valueContent(replica.store, owner)).trim()
  return text ? { text } : null
}
