/**
 * Asking a peer's `title` handler (the fos server's model) for a headline row's title: a `title` requirement inside
 * the row (`fos:title:<id>`), whose handler reads the row's text (`titleRequestAt`), writes the title as the
 * requirement's `TITLED_VALUE` and supplies it. The asker sets the row's title from it and removes the request.
 */
import { formText } from './forms'
import { newId, resolveScope, valueContent, type Scope } from './graph'
import { ALLOCATION_TYPE } from './library-types'
import { addRow, headCid, view, type Replica } from './replica'

export const TITLE_REQUEST_PREFIX = 'fos:title:'
export const TITLED_VALUE = 'fos:titled'

export function requestTitle(replica: Replica, at: Scope, now: number, makeId: () => string = newId): { replica: Replica; path: Scope } {
  if (!at.length || !view(replica, at)) throw new Error('The row to title was removed.')
  const id = `${TITLE_REQUEST_PREFIX}${makeId()}`
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
