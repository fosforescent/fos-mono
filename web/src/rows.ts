/**
 * Row kinds in the tree (see shared/sync/graph.ts: a row is [node, KIND]).
 * Typing in the add bar creates a plain row unless the text starts with a
 * marker: "[]"/"[ ]" task, "[x]" done task, "-" note block, "//" comment.
 * Links in plain rows and comments are rendered as anchors; image and
 * YouTube links as embeds.
 */

import type { ResourceType, RowExtras, RowKind } from '../../shared/sync/index'

export type ParsedInput = { kind: RowKind; text: string; done: boolean; extras?: Omit<RowExtras, 'store'> }

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

/** "! confirmation", "! choice: a | b", "! search: text", "! calendar 1h", "! account 50 USD", "! inventory 2 widgets". */
export function parseRequirement(text: string): Omit<RowExtras, 'store'> & { label: string } {
  const t = text.trim()
  let m: RegExpMatchArray | null
  if ((m = t.match(/^choice\s*:?\s*(.*)$/i))) {
    const options = (m[1] ?? '').split('|').map((o) => o.trim()).filter(Boolean)
    return { requirement: { capability: 'choice', options }, label: `choice: ${options.join(' | ')}` }
  }
  if ((m = t.match(/^search\s*:?\s*(.*)$/i))) return { requirement: { capability: 'search' }, label: `search: ${m[1] ?? ''}`.trim() }
  if ((m = t.match(/^(calendar|account|inventory)\s*:?\s*(.*)$/i))) {
    const resource = (m[1] as string).toLowerCase() as ResourceType
    const amt = parseAmount(m[2] ?? '', resource)
    const note = amt ? amt.rest : (m[2] ?? '').trim()
    return { requirement: { capability: 'allocation', resource, ...(amt ? { amount: amt.amount, unit: amt.unit } : {}) }, label: `${resource} ${amt ? `${amt.amount} ${amt.unit}` : ''} ${note}`.replace(/\s+/g, ' ').trim() }
  }
  return { requirement: { capability: 'confirmation' }, label: t.replace(/^confirmation\s*:?\s*/i, '') || 'confirmation' }
}

/**
 * Prefixes: "[ ]"/"[x]" task, "-" note, "//" comment, "!" requirement, "?" query,
 * "@calendar|@account|@inventory name [capacity]" resource bank, "+amount [when] [note]" allocation
 * (the bank comes from the row it is added under; see App.addRowAt).
 */
export function parseRowInput(raw: string): ParsedInput {
  const text = raw.replace(/\s+$/, '')
  let m: RegExpMatchArray | null
  if ((m = text.match(/^\[(x|X)\]\s*(.*)$/s))) return { kind: 'task', text: m[2] ?? '', done: true }
  if ((m = text.match(/^\[\s?\]\s*(.*)$/s))) return { kind: 'task', text: m[1] ?? '', done: false }
  if ((m = text.match(/^-\s?(.*)$/s))) return { kind: 'note', text: m[1] ?? '', done: false }
  if ((m = text.match(/^\/\/\s*(.*)$/s))) return { kind: 'comment', text: m[1] ?? '', done: false }
  if ((m = text.match(/^!\s*(.*)$/s))) { const { label, ...extras } = parseRequirement(m[1] ?? ''); return { kind: 'requirement', text: label, done: false, extras } }
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
  if ((m = text.match(/^\+\s*(.*)$/s))) {
    const amt = parseAmount(m[1] ?? '')
    return { kind: 'allocation', text: amt?.rest ?? '', done: false, extras: { allocation: { resource: '', type: 'inventory', amount: amt?.amount ?? 0, unit: amt?.unit ?? 'unit' } } }
  }
  return { kind: 'plain', text: text.trim(), done: false }
}

export const ROW_KIND_LABEL: Record<RowKind, string> = { task: 'Task', plain: 'Row', note: 'Note', comment: 'Comment', ref: 'Reference', requirement: 'Requirement', supply: 'Supply', query: 'Query', resource: 'Resource bank', allocation: 'Allocation' }

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
