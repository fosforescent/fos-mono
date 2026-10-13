/**
 * Row kinds in the tree (see shared/sync/graph.ts: a row is [node, KIND]).
 * Typing into a row makes it a plain row unless the text starts with a marker
 * (the full list is in SYNTAX_HELP, shown by Ctrl+H):
 *
 *   [ ] / [x]   task (open / done); "[ ] `name`" executes the template `name`
 *   >           note block (markdown)
 *   //          comment
 *   -<kind>     requirement: the task needs a child row of that kind before it can be done
 *               -[ ] subtask · -$ 50 money · -: 1h time · -# 2 widgets things · -@bob a person
 *               -? search · -market · -mail · -choice: a | b · - confirmation
 *   $ : # @     allocation of money / time / things / a person, taken from the parent context
 *               (the bank above it, the bank the requirement names, or the default pool of that
 *               type: the first bank of that type at the top level). An optional window follows the
 *               amount: "2026-10-13", "2026-10-13T09:00..2026-10-13T11:00", "..2026-12-31";
 *               start is now and end is forever when absent. Each resource has its own calendar.
 *   ?           query (semantic search)
 *   @calendar | @money | @inventory | @person <name> … [capacity]   resource bank
 *   `name       template: its requirement rows are copied under every task that executes it
 *
 * `rawRowText` rebuilds the marker form of a row so editing shows exactly what was typed.
 * Links in plain rows and comments are rendered as anchors; image and YouTube links as embeds.
 */

import type { ResourceType, RowExtras, RowKind, TaskView } from '../../shared/sync/index'

export type ParsedInput = {
  kind: RowKind
  text: string
  done: boolean
  extras?: Omit<RowExtras, 'store'>
  /** "[ ] `name` …": the task executes the template called `name`. */
  templateName?: string
}

/** Words after "@" that open a resource bank rather than allocate a person. */
const BANK_WORDS: Record<string, ResourceType> = { calendar: 'calendar', account: 'account', money: 'account', inventory: 'inventory', person: 'person', points: 'points', ff: 'points' }
/** The marker of each resource type: allocations ("$ 50", ": 1h", "# 2 widgets", "@bob 2h", "ff 20") and their requirements ("-$ 50" …). */
export const RESOURCE_MARKER: Record<ResourceType, string> = { account: '$', calendar: ':', inventory: '#', person: '@', points: 'ff' }
export const RESOURCE_ICON: Record<ResourceType, string> = { account: '💲', calendar: '🕒', inventory: '📦', person: '👤', points: '✦' }
export const RESOURCE_NAME: Record<ResourceType, string> = { account: 'money', calendar: 'time', inventory: 'things', person: 'person', points: 'fos points' }
const DEFAULT_UNIT: Record<ResourceType, string> = { account: 'USD', calendar: 'h', inventory: 'unit', person: 'h', points: 'ff' }

const TIME_UNIT = /^(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)$/i
const MONEY_UNIT = /^([A-Z]{3}|[€$£]|usd|eur|gbp)$/i
/**
 * "1h", "90m", "2d", "50 USD", "3 widgets" → amount + unit (time units normalized to hours; bare numbers take the
 * resource's unit). A word after the number counts as the unit only when it fits the resource: time units for
 * time and people, a currency for money, any word for things; otherwise it is the start of the text ("$ 50 lunch").
 */
export function parseAmount(text: string, resource?: ResourceType): { amount: number; unit: string; rest: string } | null {
  const m = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z€$£]*)\s*(.*)$/s)
  if (!m) return null
  let amount = Number((m[1] ?? '0').replace(',', '.'))
  let unit = (m[2] ?? '').trim()
  let rest = (m[3] ?? '').trim()
  const timeLike = resource === 'calendar' || resource === 'person'
  const fits = !unit || (timeLike ? TIME_UNIT.test(unit) : resource === 'account' ? MONEY_UNIT.test(unit) : resource === 'points' ? /^(ff|points?)$/i.test(unit) : resource === 'inventory' ? true : TIME_UNIT.test(unit) || MONEY_UNIT.test(unit) || true)
  if (resource === 'points' && unit && fits) unit = 'ff'
  if (!fits) { rest = `${unit} ${rest}`.trim(); unit = '' }
  if (TIME_UNIT.test(unit)) {
    const u = unit.toLowerCase()
    if (/^(m|min|mins|minute|minutes)$/.test(u)) amount = amount / 60
    if (/^(d|day|days)$/.test(u)) amount = amount * 24
    unit = 'h'
  } else if (MONEY_UNIT.test(unit)) {
    unit = unit === '$' ? 'USD' : unit === '€' ? 'EUR' : unit === '£' ? 'GBP' : unit.toUpperCase()
  }
  if (!unit) unit = resource ? DEFAULT_UNIT[resource] : 'unit'
  return { amount, unit, rest }
}

const DATE = String.raw`\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?`
/**
 * A window at the start of the text: "2026-10-13" (from then on), "2026-10-13T09:00..2026-10-13T11:00",
 * "..2026-12-31" (until then). Absent start = now, absent end = forever; both stay undefined in the data.
 */
export function parseWindow(text: string): { start?: number; end?: number; rest: string } {
  const m = text.match(new RegExp(String.raw`^\s*(?:(${DATE})(?:\.\.(${DATE})?)?|\.\.(${DATE}))\s*(.*)$`, 's'))
  if (!m) return { rest: text.trim() }
  const start = m[1] ? localTime(m[1]) : undefined
  const endText = m[2] ?? m[3]
  const end = endText ? localTime(endText) : undefined
  return { ...(start !== undefined && !Number.isNaN(start) ? { start } : {}), ...(end !== undefined && !Number.isNaN(end) ? { end } : {}), rest: (m[4] ?? '').trim() }
}

/** "2026-10-13" or "2026-10-13T09:00" as local time (a bare date is local midnight, not UTC). */
function localTime(text: string): number {
  const [date, time] = text.split('T')
  const [y, mo, d] = (date ?? '').split('-').map(Number)
  const [h, mi] = (time ?? '0:0').split(':').map(Number)
  return new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0).getTime()
}

function isoLocal(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return d.getHours() === 0 && d.getMinutes() === 0 ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The window as typed: "2026-10-13..2026-10-20", "2026-10-13", "..2026-12-31", or "" when the allocation has none. */
export function formatWindow(a: { start?: number; end?: number }): string {
  if (a.start === undefined && a.end === undefined) return ''
  return `${a.start !== undefined ? isoLocal(a.start) : ''}${a.end !== undefined ? '..' + isoLocal(a.end) : a.start !== undefined ? '' : '..'}`
}

/** "<amount> [window] text" for a resource type → allocation data (the bank is resolved by App.addRowAt) and the remaining text. */
function parseAllocation(type: ResourceType, body: string, person?: string): { allocation: NonNullable<RowExtras['allocation']>; text: string } {
  const amt = parseAmount(body, type)
  const win = parseWindow(amt ? amt.rest : body.trim())
  const allocation: NonNullable<RowExtras['allocation']> = { resource: '', type, amount: amt?.amount ?? (type === 'person' ? 1 : 0), unit: amt?.unit ?? DEFAULT_UNIT[type], ...(win.start !== undefined ? { start: win.start } : {}), ...(win.end !== undefined ? { end: win.end } : {}), ...(person ? { person } : {}) }
  return { allocation, text: win.rest }
}

/** "`name` rest" or "`name rest" → the template name and the remaining text. */
function parseTemplateRef(text: string): { templateName: string; rest: string } | null {
  // "`name` rest" (closing backtick, name may hold spaces) or "`name rest" (name is the first word)
  const m = text.match(/^`([^`]+)`\s*(.*)$/s) ?? text.match(/^`(\S+)\s*(.*)$/s)
  if (!m) return null
  const templateName = (m[1] ?? '').trim()
  return templateName ? { templateName, rest: (m[2] ?? '').trim() } : null
}

/** The resource marker at the start of `text` ("$", ":", "#", or "ff" before a space or digit) with its length, or null. */
function markerType(text: string): { type: ResourceType; length: number } | null {
  const ch = text.charAt(0)
  if (ch === '$') return { type: 'account', length: 1 }
  if (ch === ':') return { type: 'calendar', length: 1 }
  if (ch === '#') return { type: 'inventory', length: 1 }
  if (/^ff(?=\s|\d|$)/i.test(text)) return { type: 'points', length: 2 }
  return null
}

/**
 * The part after "-": the kind of child row the requirement needs.
 *   "[ ] text" task · "$ 50" / ": 1h" / "# 2 widgets" an allocation of money / time / things (window allowed)
 *   "@calendar 1h", "@money 50", "@inventory 2" the same by bank word · "@name text" the person `name` (they allocate themself)
 *   "? text" or "search: text" search · "market text" · "mail text" · "choice: a | b" · anything else is a confirmation
 */
export function parseRequirement(text: string): Omit<RowExtras, 'store'> & { label: string; templateName?: string } {
  const t = text.trim()
  let m: RegExpMatchArray | null
  if ((m = t.match(/^\[\s?[xX]?\]\s*(.*)$/s))) {
    const rest = (m[1] ?? '').trim()
    const tpl = parseTemplateRef(rest)
    return { requirement: { capability: 'task' }, label: tpl ? (tpl.rest || tpl.templateName) : rest, ...(tpl ? { templateName: tpl.templateName } : {}) }
  }
  // "-$ 50 lunch": money, 50 of it; "-$ lunch": money, any amount (one allocation of the type fills it)
  const allocationRequirement = (resource: ResourceType, body: string) => {
    const hasAmount = parseAmount(body, resource) !== null
    const { allocation, text: label } = parseAllocation(resource, body)
    return { requirement: { capability: 'allocation' as const, resource, ...(hasAmount ? { amount: allocation.amount, unit: allocation.unit } : {}), ...(allocation.start !== undefined ? { start: allocation.start } : {}), ...(allocation.end !== undefined ? { end: allocation.end } : {}) }, label }
  }
  const typed = markerType(t)
  if (typed) return allocationRequirement(typed.type, t.slice(typed.length))
  if ((m = t.match(/^@(calendar|account|money|inventory|points|ff)\b\s*:?\s*(.*)$/is))) return allocationRequirement(BANK_WORDS[(m[1] as string).toLowerCase()] as ResourceType, m[2] ?? '')
  if ((m = t.match(/^@(?:person\s+)?([^\s@]+)\s*:?\s*(.*)$/s))) return { requirement: { capability: 'peer', peer: m[1] as string }, label: (m[2] ?? '').trim() }
  if ((m = t.match(/^(?:\?|search\s*:?)\s*(.*)$/is))) return { requirement: { capability: 'search' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^market\b\s*:?\s*(.*)$/is))) return { requirement: { capability: 'market' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^mail\b\s*:?\s*(.*)$/is))) return { requirement: { capability: 'mail' }, label: (m[1] ?? '').trim() }
  // "-llm what should I cook" asks the language model; "-repo owner/name fix the login bug" opens an issue there
  if ((m = t.match(/^(?:llm|ai|ask)\b\s*:?\s*(.*)$/is))) return { requirement: { capability: 'llm' }, label: (m[1] ?? '').trim() }
  if ((m = t.match(/^repo\b\s*:?\s*(?:([\w.-]+\/[\w.-]+)\s*)?(.*)$/is))) return { requirement: { capability: 'repo', ...(m[1] ? { repo: m[1] } : {}) }, label: (m[2] ?? '').trim() }
  // "-tool weather Paris": an MCP peer attached above runs its `weather` tool with the rest as input
  if ((m = t.match(/^(?:tool|mcp)\b\s*:?\s*(?:([\w.-]+)\s*)?(.*)$/is))) return { requirement: { capability: 'tool', ...(m[1] ? { tool: m[1] } : {}) }, label: (m[2] ?? '').trim() }
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
  if ((m = text.match(/^@(calendar|account|money|inventory|person|points|ff)\b\s*:?\s*(.*)$/is))) {
    const type = BANK_WORDS[(m[1] as string).toLowerCase()] as ResourceType
    const rest = (m[2] ?? '').trim()
    // optional trailing capacity: "@money Travel 500", "@calendar Week 40h", "@person bob 40h"
    const cap = rest.match(/^(.*?)\s+(\d+(?:[.,]\d+)?\s*[A-Za-z€$£]*)$/)
    const amt = cap ? parseAmount(cap[2] ?? '', type) : null
    const unit = amt?.unit ?? DEFAULT_UNIT[type]
    return { kind: 'resource', text: (cap ? cap[1] : rest) || `${RESOURCE_NAME[type]} bank`, done: false, extras: { resource: { type, unit, ...(amt ? { capacity: amt.amount } : {}) } } }
  }
  const typed = markerType(text)
  if (typed) { const { allocation, text: label } = parseAllocation(typed.type, text.slice(typed.length)); return { kind: 'allocation', text: label, done: false, extras: { allocation } } }
  if ((m = text.match(/^@([^\s@]+)\s*(.*)$/s))) { const { allocation, text: label } = parseAllocation('person', m[2] ?? '', m[1] as string); return { kind: 'allocation', text: label, done: false, extras: { allocation } } }
  if ((m = text.match(/^`\s*([^`]*)`?\s*$/s))) return { kind: 'template', text: (m[1] ?? '').trim(), done: false }
  return { kind: 'plain', text: text.trim(), done: false }
}

/** An amount with its window as it is typed: "50 USD 2026-10-13..2026-10-20". */
function amountAndWindow(amount: number | undefined, unit: string | undefined, win: { start?: number; end?: number }): string {
  const parts: string[] = []
  if (amount !== undefined) parts.push(formatAmount(amount, unit ?? 'unit'))
  const w = formatWindow(win)
  if (w) parts.push(w)
  return parts.join(' ')
}

/** The marker form of a row, so editing shows exactly what was typed ("-$ 50 lunch", "[x] done", "> note", "@bob 2h …"). */
export function rawRowText(task: TaskView): string {
  const join = (...parts: string[]) => parts.filter((p) => p !== '').join(' ')
  switch (task.kind) {
    case 'task': return join(task.done ? '[x]' : '[ ]', task.template ? `\`${task.template.name}\`` : '', task.title)
    case 'note': return `> ${task.title}`
    case 'comment': return `// ${task.title}`
    case 'query': return `? ${task.title}`
    case 'template': return `\`${task.title}`
    case 'resource': {
      const r = task.resource
      if (!r) return `@inventory ${task.title}`
      const word = r.type === 'account' ? 'money' : r.type === 'points' ? 'points' : r.type
      return join(`@${word}`, task.title, r.capacity !== undefined ? formatAmount(r.capacity, r.unit) : '')
    }
    case 'allocation': {
      const a = task.allocation
      if (!a) return `$ ${task.title}`
      const marker = a.type === 'person' ? `@${a.person ?? 'someone'}` : RESOURCE_MARKER[a.type]
      return join(marker, amountAndWindow(a.amount, a.unit, a), task.title)
    }
    case 'requirement': {
      const r = task.requirement
      if (!r) return `- ${task.title}`
      switch (r.capability) {
        case 'task': return join('-[ ]', task.title)
        case 'allocation': return join(`-${RESOURCE_MARKER[r.resource ?? 'inventory']}`, amountAndWindow(r.amount, r.unit, r), task.title)
        case 'peer': return join(`-@${r.peer ?? ''}`, task.title)
        case 'search': return join('-?', task.title)
        case 'market': return join('-market', task.title)
        case 'mail': return join('-mail', task.title)
        case 'llm': return join('-llm', task.title)
        case 'repo': return join('-repo', r.repo ?? '', task.title)
        case 'tool': return join('-tool', r.tool ?? '', task.title)
        case 'choice': return `-choice: ${(r.options ?? []).join(' | ')}`
        case 'confirmation': return join('-', task.title === 'confirmation' ? '' : task.title)
      }
      return `- ${task.title}`
    }
    default: return task.title
  }
}

/** The little tag an allocation shows on the row it sits under: icon, amount, window and who. */
export function allocationTag(a: NonNullable<TaskView['allocation']>): string {
  const w = formatWindow(a)
  return `${RESOURCE_ICON[a.type]} ${a.type === 'person' ? `${a.person ?? ''} ` : ''}${formatAmount(a.amount, a.unit)}${w ? ' ' + w : ''}`.replace(/\s+/g, ' ').trim()
}

/**
 * What a typed line is recognized as, shown next to the editor while typing: "task", "requirement · money 50 USD",
 * "allocation · time 1 h", "bank · fos points", "template", … Empty for plain text.
 */
export function describeParsed(p: ParsedInput): string {
  const amt = (a: { amount?: number; unit?: string } | undefined) => (a && a.amount !== undefined ? ' ' + formatAmount(a.amount, a.unit ?? '') : '')
  switch (p.kind) {
    case 'task': return p.templateName ? `task · executes \`${p.templateName}\`${p.done ? ' · done' : ''}` : `task${p.done ? ' · done' : ''}`
    case 'note': return 'note'
    case 'comment': return 'comment'
    case 'query': return 'query'
    case 'template': return 'template'
    case 'resource': return `bank · ${RESOURCE_NAME[p.extras?.resource?.type ?? 'inventory']}${p.extras?.resource?.capacity !== undefined ? ' · ' + formatAmount(p.extras.resource.capacity, p.extras.resource.unit) : ''}`
    case 'allocation': { const a = p.extras?.allocation; return `allocation · ${a ? RESOURCE_NAME[a.type] : ''}${a?.person ? ' @' + a.person : ''}${amt(a)}${a && formatWindow(a) ? ' · ' + formatWindow(a) : ''}` }
    case 'requirement': {
      const r = p.extras?.requirement
      if (!r) return 'requirement'
      switch (r.capability) {
        case 'allocation': return `requirement · ${RESOURCE_NAME[r.resource ?? 'inventory']}${r.amount !== undefined ? amt(r) : ' (any amount)'}`
        case 'task': return `requirement · a task${p.templateName ? ` executing \`${p.templateName}\`` : ''}`
        case 'peer': return `requirement · @${r.peer ?? 'someone'}`
        case 'choice': return `requirement · choice (${(r.options ?? []).join(' | ')})`
        default: return `requirement · ${r.capability}`
      }
    }
    default: return ''
  }
}

/** The marker that recreates a row of `kind` when its text is edited from the start (shown in the help). */
export const ROW_KIND_LABEL: Record<RowKind, string> = { task: 'Task', plain: 'Row', note: 'Note', comment: 'Comment', ref: 'Reference', requirement: 'Requirement', supply: 'Supply', query: 'Query', resource: 'Resource bank', allocation: 'Allocation', template: 'Template' }

/** Row syntax, for the Ctrl+H help: [what you type, what it makes]. */
export const SYNTAX_HELP: Array<[string, string]> = [
  ['[ ] text', 'a task; [x] a done task'],
  ['[ ] `name` text', 'a task that executes the template `name`: its requirements appear underneath, to be filled'],
  ['> text', 'a note (markdown; child rows become variables)'],
  ['// text', 'a comment'],
  ['`name', 'a template: the nested rows and arguments under it are copied into every task that executes it'],
  ['- text', 'a requirement: a confirmation by a signed-in person'],
  ['-[ ] text', 'a requirement for a task: done when a task row inside it is checked'],
  ['-$ 50 text', 'a requirement for money; -: 1h for time; -# 2 widgets for things. Filled by allocations inside it, several may add up'],
  ['-@bob text', 'a requirement for the person bob: filled when bob allocates themself ("@bob 2h") or confirms'],
  ['-? text', 'a requirement for a search: filled when a query inside it has run (fos can run it)'],
  ['-market text', 'a requirement handled by a peer with the market capability (list it, collect proposals)'],
  ['-mail text', 'a requirement handled by a peer with the mail capability'],
  ['-llm question', 'a requirement answered by the language model (fos): preview context, then review and accept its proposed answer'],
  ['-repo owner/name title', 'a requirement handled by GitHub: an issue is opened in that repository'],
  ['-tool name input', 'a requirement run by an MCP peer attached to this node or above (its `name` tool, the text as input)'],
  ['-choice: a | b', 'a requirement for a decision between options'],
  ['$ 50 text', 'an allocation of money, taken from the parent context: the bank above, the bank the requirement needs, or the default pool of that type'],
  [': 1h text', 'an allocation of time; # 2 widgets things; @bob 2h the person bob'],
  ['ff 20 text', 'an allocation of fos points (your account balance is the default pool; -ff 20 requires them)'],
  ['$ 50 2026-10-13..2026-10-20 text', 'an allocation held for a window (start is now, end is forever, when absent): every resource has its own calendar'],
  ['? text', 'a query: semantic search over your rows (Search runs it, results appear inside)'],
  ['@money Travel 500', 'a resource bank (money); @calendar Week 40h (time), @inventory Shelf 12 (things), @person bob 40h (their calendar). The first bank of a type at the top level is its default pool']
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
