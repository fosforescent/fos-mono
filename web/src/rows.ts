/**
 * Row kinds in the tree (see shared/sync/graph.ts: a row is [node, KIND]).
 * Typing into a row makes it a plain row unless the text starts with a marker
 * (the full list is in SYNTAX_HELP, shown by Ctrl+H):
 *
 *   [ ] / [x]   task (open / done); "[ ] `name`" executes the template `name`
 *   >           note block (markdown)
 *   //          comment
 *   -<kind>     requirement: the task needs a child row of that kind before it can be done
 *               -[ ] subtask · -$ 50 expense · -@calendar 1h · -@inventory 2 widgets
 *               -? search · -market · -mail · -@peer (assignment) · -choice: a | b · - confirmation
 *   $ amount    allocation, taken from the parent context (the bank above it, or the bank
 *               matching the requirement it fills)
 *   ?           query (semantic search)
 *   @calendar | @account | @inventory name [capacity]   resource bank
 *   `name       template: its requirement rows are copied under every task that executes it
 *
 * Links in plain rows and comments are rendered as anchors; image and YouTube links as embeds.
 */

import type { ResourceType, RowExtras, RowKind } from '../../shared/sync/index'

export type ParsedInput = {
  kind: RowKind
  text: string
  done: boolean
  extras?: Omit<RowExtras, 'store'>
  /** "[ ] `name` …": the task executes the template called `name`. */
  templateName?: string
}

const RESOURCE_TYPES: ResourceType[] = ['calendar', 'account', 'inventory']

/** "1h", "90m", "2d", "50 USD", "3 widgets" → amount + unit (calendar units normalized to hours). */
export function parseAmount(text: string, resource?: ResourceType): { amount: number; unit: string; rest: string } | null {
  const m = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z€$£]*)\s*(.*)$/s)
  if (!m) return null
  let amount = Number((m[1] ?? '0').replace(',', '.'))
  let unit = (m[2] ?? '').trim()
  if (resource === 'calendar' || /^(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)$/i.test(unit)) {
    const u = unit.toLowerCase()
    if (/^(m|min|mins|minute|minutes)$/.test(u)) amount = amount / 60
    if (/^(d|day|days)$/.test(u)) amount = amount * 24
    unit = 'h'
  }
  if (!unit) unit = resource === 'account' ? 'USD' : 'unit'
  return { amount, unit, rest: (m[3] ?? '').trim() }
}

/** "`name` rest" or "`name rest" → the template name and the remaining text. */
function parseTemplateRef(text: string): { templateName: string; rest: string } | null {
  const m = text.match(/^`([^`]+?)`?\s*(.*)$/s)
  if (!m) return null
  const templateName = (m[1] ?? '').trim()
  return templateName ? { templateName, rest: (m[2] ?? '').trim() } : null
}

/**
 * The part after "-": the kind of child row the requirement needs.
 *   "[ ] text" task · "$ 50 text" account allocation · "@calendar 1h" / "@account 50" / "@inventory 2 widgets" allocation
 *   "@name text" assignment to the peer `name` · "? text" or "search: text" search · "market text" · "mail text"
 *   "choice: a | b" · anything else is a confirmation
 */
export function parseRequirement(text: string): Omit<RowExtras, 'store'> & { label: string; templateName?: string } {
  const t = text.trim()
  let m: RegExpMatchArray | null
  if ((m = t.match(/^\[\s?[xX]?\]\s*(.*)$/s))) {
    const rest = (m[1] ?? '').trim()
    const tpl = parseTemplateRef(rest)
    return { requirement: { capability: 'task' }, label: tpl ? (tpl.rest || tpl.templateName) : rest, ...(tpl ? { templateName: tpl.templateName } : {}) }
  }
  if ((m = t.match(/^\$\s*(.*)$/s))) {
    const amt = parseAmount(m[1] ?? '', 'account')
    const note = amt ? amt.rest : (m[1] ?? '').trim()
    return { requirement: { capability: 'allocation', resource: 'account', ...(amt ? { amount: amt.amount, unit: amt.unit } : {}) }, label: note }
  }
  if ((m = t.match(/^@(calendar|account|inventory)\s*:?\s*(.*)$/is))) {
    const resource = (m[1] as string).toLowerCase() as ResourceType
    const amt = parseAmount(m[2] ?? '', resource)
    const note = amt ? amt.rest : (m[2] ?? '').trim()
    return { requirement: { capability: 'allocation', resource, ...(amt ? { amount: amt.amount, unit: amt.unit } : {}) }, label: note }
  }
  if ((m = t.match(/^@([^\s@]+)\s*:?\s*(.*)$/s))) return { requirement: { capability: 'peer', peer: m[1] as string }, label: (m[2] ?? '').trim() }
  if ((m = t.match(/^(?:\?|search\s*:?)\s*(.*)$/is))) return { requirement: { capability: 'search' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^market\b\s*:?\s*(.*)$/is))) return { requirement: { capability: 'market' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^mail\b\s*:?\s*(.*)$/is))) return { requirement: { capability: 'mail' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^choice\s*:?\s*(.*)$/i))) {
    const options = (m[1] ?? '').split('|').map((o) => o.trim()).filter(Boolean)
    return { requirement: { capability: 'choice', options }, label: `choice: ${options.join(' | ')}` }
  }
  return { requirement: { capability: 'confirmation' }, label: t.replace(/^confirm(?:ation)?\s*:?\s*/i, '') || 'confirmation' }
}

/** A typed row: the marker decides the kind (see the file comment); anything else is a plain row. */
export function parseRowInput(raw: string): ParsedInput {
  const text = raw.replace(/\s+$/, '')
  let m: RegExpMatchArray | null
  if ((m = text.match(/^\[\s?([xX]?)\]\s*(.*)$/s))) {
    const done = !!m[1]
    const rest = m[2] ?? ''
    const tpl = parseTemplateRef(rest)
    if (tpl) return { kind: 'task', text: tpl.rest || tpl.templateName, done, templateName: tpl.templateName }
    return { kind: 'task', text: rest, done }
  }
  if ((m = text.match(/^>\s?(.*)$/s))) return { kind: 'note', text: m[1] ?? '', done: false }
  if ((m = text.match(/^\/\/\s*(.*)$/s))) return { kind: 'comment', text: m[1] ?? '', done: false }
  if ((m = text.match(/^-\s*(.*)$/s))) { const { label, templateName, ...extras } = parseRequirement(m[1] ?? ''); return { kind: 'requirement', text: label, done: false, extras, ...(templateName ? { templateName } : {}) } }
  if ((m = text.match(/^\?\s*(.*)$/s))) return { kind: 'query', text: (m[1] ?? '').trim(), done: false, extras: { query: {} } }
  if ((m = text.match(/^@(calendar|account|inventory)\s*:?\s*(.*)$/is))) {
    const type = (m[1] as string).toLowerCase() as ResourceType
    const rest = (m[2] ?? '').trim()
    // optional trailing capacity: "@account Travel 500 USD", "@calendar Week 40h"
    const cap = rest.match(/^(.*?)\s+(\d+(?:[.,]\d+)?\s*[A-Za-z€$£]*)$/)
    const amt = cap ? parseAmount(cap[2] ?? '', type) : null
    const unit = amt?.unit ?? (type === 'calendar' ? 'h' : type === 'account' ? 'USD' : 'unit')
    return { kind: 'resource', text: (cap ? cap[1] : rest) || `${type} bank`, done: false, extras: { resource: { type, unit, ...(amt ? { capacity: amt.amount } : {}) } } }
  }
  if ((m = text.match(/^\$\s*(.*)$/s))) {
    // the bank (and so the resource type) comes from the parent context; see App.addRowAt
    const amt = parseAmount(m[1] ?? '')
    return { kind: 'allocation', text: amt?.rest ?? (m[1] ?? '').trim(), done: false, extras: { allocation: { resource: '', type: 'inventory', amount: amt?.amount ?? 0, unit: amt?.unit ?? 'unit' } } }
  }
  if ((m = text.match(/^`\s*([^`]*)`?\s*$/s))) return { kind: 'template', text: (m[1] ?? '').trim(), done: false }
  return { kind: 'plain', text: text.trim(), done: false }
}

/** The marker that recreates a row of `kind` when its text is edited from the start (shown in the help). */
export const ROW_KIND_LABEL: Record<RowKind, string> = { task: 'Task', plain: 'Row', note: 'Note', comment: 'Comment', ref: 'Reference', requirement: 'Requirement', supply: 'Supply', query: 'Query', resource: 'Resource bank', allocation: 'Allocation', template: 'Template' }

/** Row syntax, for the Ctrl+H help: [what you type, what it makes]. */
export const SYNTAX_HELP: Array<[string, string]> = [
  ['[ ] text', 'a task; [x] a done task'],
  ['[ ] `name` text', 'a task that executes the template `name`: its requirements appear underneath, to be filled'],
  ['> text', 'a note (markdown; child rows become variables)'],
  ['// text', 'a comment'],
  ['`name', 'a template: the requirement rows under it are copied into every task that executes it'],
  ['- text', 'a requirement: a confirmation by a signed-in person'],
  ['-[ ] text', 'a requirement for a task: done when a task row inside it is checked'],
  ['-$ 50 text', 'a requirement for money: filled by a "$ 50" allocation inside it'],
  ['-@calendar 1h text', 'a requirement for calendar time; also -@account 50, -@inventory 2 widgets'],
  ['-? text', 'a requirement for a search: filled when a query inside it has run (fos can run it)'],
  ['-market text', 'a requirement handled by a peer with the market capability (list it, collect proposals)'],
  ['-mail text', 'a requirement handled by a peer with the mail capability'],
  ['-@name text', 'assigns the task to the peer `name`: they confirm it under your row in their context'],
  ['-choice: a | b', 'a requirement for a decision between options'],
  ['$ 50 text', 'an allocation of 50 taken from the parent context: the bank above, or the bank the requirement needs'],
  ['? text', 'a query: semantic search over your rows (Search runs it, results appear inside)'],
  ['@account Travel 500', 'a resource bank (money); @calendar Week 40h (time), @inventory Shelf 12 (things)']
]

export function formatAmount(amount: number, unit: string): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, '')
  return unit === 'h' ? `${n} h` : `${n} ${unit}`
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v')
  } catch { /* not a url */ }
  return null
}

/** Text with URLs turned into links; images and YouTube videos embedded below the text. */
export function renderInlineText(text: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  const embeds: HTMLElement[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0]
    const start = m.index ?? 0
    if (start > last) frag.append(document.createTextNode(text.slice(last, start)))
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    a.addEventListener('click', (e) => e.stopPropagation())
    frag.append(a)
    last = start + url.length
    if (IMAGE_RE.test(url.split('#')[0] ?? '')) {
      const img = document.createElement('img')
      img.src = url
      img.alt = ''
      img.loading = 'lazy'
      img.className = 'embed'
      embeds.push(img)
    } else {
      const yt = youtubeId(url)
      if (yt) {
        const iframe = document.createElement('iframe')
        iframe.className = 'embed video'
        iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`
        iframe.allow = 'accelerometer; encrypted-media; picture-in-picture'
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'
        iframe.setAttribute('allowfullscreen', '')
        iframe.loading = 'lazy'
        embeds.push(iframe)
      }
    }
  }
  if (last < text.length) frag.append(document.createTextNode(text.slice(last)))
  if (embeds.length) {
    const box = document.createElement('div')
    box.className = 'embeds'
    box.append(...embeds)
    frag.append(box)
  }
  return frag
}

/** Download `text` as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'text/markdown'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
