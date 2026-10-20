/**
 * A published node as a small website, the one renderer of the share page (`sharing.ts`) and the embed script
 * (`embed.ts`); it imports no app code. The node is the page; leaf children are sections of it; a child with rows of
 * its own (other than its fields) is a sub-page linked from it. Each row renders by its type, the library row type
 * its edge is made from (`row.type`): a note as markdown, a scalar field as its value or, when the visitor is asked
 * for it, an input of that field's type; anything else as text. Declared inputs render inline at the row they belong
 * to; poll options, rankings and the submit button follow the page.
 */
import type { Participation, SharedAddress as ShareAddress, SharedInput, SharedNode } from '../../shared/sync/sharing'
import { FIELD_TYPES, NOTE_TYPE, NUMBER_TYPE, TIME_TYPE } from '../../shared/sync/published-types'

export type SitePage = { id: string; path: string[]; title: string; type?: string; body?: string; truncated?: true; children: SitePage[] }
/** What the visitor has entered so far; the caller keeps it across sub-page navigation. */
export type SiteAnswers = { name: string; approvals: Set<string>; ranking: string[]; fields: Record<string, { value?: unknown; source?: string }> }
export type SiteInteraction = {
  signedIn: boolean
  submit: (answers: SiteAnswers, revision: string) => Promise<void>
  /** A template endpoint: start this visitor's private execution. */
  start?: () => Promise<void>
  /** An extra control below a field (the share page links a value from the visitor's own context). */
  fieldExtras?: (field: SharedInput, answers: SiteAnswers) => HTMLElement | null
}
export type SiteOptions = {
  /** Markdown to sanitized HTML. */
  markdown: (md: string) => string | Promise<string>
  /** Optional pass over the rendered page (diagrams). */
  hydrate?: (container: HTMLElement) => void | Promise<void>
  /** Row ids from the published node down to the page shown; [] is the node itself. */
  trail: string[]
  navigate: (trail: string[]) => void
  /** Absent: the page is only read. */
  interact?: SiteInteraction
  answers?: SiteAnswers
}

/** The address in a `#share=` hash (or a whole share URL, or the address as JSON); null when malformed. */
export function parseShareAddress(value: string): ShareAddress | null {
  const hash = value.trim().startsWith('{') ? `#share=${encodeURIComponent(value.trim())}` : value.slice(Math.max(0, value.indexOf('#')))
  if (!hash.startsWith('#share=') || hash.length > 24000) return null
  try {
    const at = JSON.parse(decodeURIComponent(hash.slice(7))) as ShareAddress
    return typeof at.owner === 'string' && !!at.owner && at.owner.length <= 128 && typeof at.share === 'string' && /^[\w-]{16,128}$/.test(at.share) && Array.isArray(at.path) && at.path.length <= 32 && at.path.every(id => typeof id === 'string' && !!id && id.length <= 256) ? { owner: at.owner, path: at.path, share: at.share } : null
  } catch { return null }
}
/** The public, read-only projection of a published node (no visitor is recorded). */
export function publicReadUrl(api: string, at: ShareAddress): string {
  return `${api.replace(/\/$/, '')}/public/node/read?${new URLSearchParams({ owner: at.owner, share: at.share, path: JSON.stringify(at.path) })}`
}

const isField = (page: SitePage) => !!page.type && FIELD_TYPES.includes(page.type)
const isSubPage = (page: SitePage) => page.children.some(child => !isField(child))

/** Rows arrive in depth-first order with their depth; rebuild the tree. */
export function siteTree(node: SharedNode): SitePage {
  const page = (id: string, path: string[], row: { title: string; type?: string; body?: string; truncated?: true }): SitePage =>
    ({ id, path, title: row.title, ...(row.type ? { type: row.type } : {}), ...(row.body !== undefined ? { body: row.body } : {}), ...(row.truncated ? { truncated: true as const } : {}), children: [] })
  const root = page('', [], node)
  const stack: SitePage[] = [root]
  for (const row of node.rows) {
    stack.length = Math.min(stack.length, row.depth + 1)
    const parent = stack[stack.length - 1] ?? root, next = page(row.id, [...parent.path, row.id], row)
    parent.children.push(next)
    stack.push(next)
  }
  return root
}

/** The pages along `trail`, starting with the root; stops at the first id that is not a sub-page. */
export function pagesAlong(root: SitePage, trail: string[]): SitePage[] {
  const pages = [root]
  for (const id of trail) {
    const next = pages[pages.length - 1]!.children.find(child => child.id === id && isSubPage(child))
    if (!next) break
    pages.push(next)
  }
  return pages
}

/** The page or row an input belongs to: the deepest one on its path (the node itself when none matches). */
function placeOf(root: SitePage, field: SharedInput): SitePage {
  let at = root
  for (const id of field.path ?? [field.key]) {
    const next = at.children.find(child => child.id === id)
    if (!next) break
    at = next
  }
  return at
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node
}

/** The visitor's answers, starting from what they submitted for this revision. */
export function siteAnswers(node: SharedNode): SiteAnswers {
  const mine: Participation | null | undefined = node.mine, current = mine?.revision === node.revision
  const rankOptions = node.poll?.mode === 'rank' ? node.options : node.proposals
  const fields: SiteAnswers['fields'] = Object.create(null)
  for (const field of node.inputs) {
    const previous = mine?.fields[field.key]
    if (previous === undefined || field.kind === 'confirmation' || field.kind === 'choice') continue
    fields[field.key] = { value: field.kind === 'text' ? previous : { amount: typeof previous === 'object' ? previous.amount : Number(previous), type: field.type, unit: field.unit, start: field.start, end: field.end } }
  }
  for (const [key, source] of Object.entries(node.sources ?? {})) fields[key] = { source }
  return { name: mine?.name ?? '', approvals: new Set(current ? mine!.approvals : []), ranking: current && mine!.ranking.length ? [...mine!.ranking] : rankOptions.map(o => o.id), fields }
}

/** An input of the field's type; text inputs of a number or time field take that type. */
function fieldControl(doc: Document, field: SharedInput, row: SitePage | null, answers: SiteAnswers, interact: SiteInteraction): HTMLElement {
  const box = el(doc, 'fieldset', 'fos-site-input'); box.append(el(doc, 'legend', '', field.direction === 'consume' ? `Use ${field.name}` : field.name))
  const label = (text: string, input: HTMLElement) => { const l = el(doc, 'label', '', text); l.append(input); return l }
  if (field.kind === 'confirmation') {
    const input = el(doc, 'input'); input.type = 'checkbox'; input.checked = answers.fields[field.key]?.value === true
    input.onchange = () => { if (input.checked) answers.fields[field.key] = { value: true }; else delete answers.fields[field.key] }
    box.append(label('Confirm ', input)); return box
  }
  if (field.kind === 'choice') {
    const input = el(doc, 'select'); input.append(new Option('Choose an option', '')); for (const [i, option] of (field.options ?? []).entries()) input.append(new Option(option, String(i)))
    const chosen = answers.fields[field.key]?.value; if (typeof chosen === 'number') input.value = String(chosen)
    input.onchange = () => { if (input.value) answers.fields[field.key] = { value: Number(input.value) }; else delete answers.fields[field.key] }
    box.append(input); return box
  }
  const input = el(doc, 'input'), type = row?.type
  input.type = field.kind !== 'text' || type === NUMBER_TYPE ? 'number' : type === TIME_TYPE ? 'datetime-local' : 'text'
  if (input.type === 'number') { input.step = 'any'; if (field.kind !== 'text') input.min = '0'; if (field.direction === 'consume' && field.amount !== undefined) input.max = String(field.amount) }
  const previous = answers.fields[field.key]?.value
  input.value = typeof previous === 'string' ? (type === TIME_TYPE && /^\d+$/.test(previous) ? new Date(Number(previous)).toISOString().slice(0, 16) : previous) : previous && typeof previous === 'object' ? String((previous as { amount: number }).amount) : ''
  // a time field stores milliseconds; the browser's control speaks local date-times
  input.oninput = () => {
    const text = type === TIME_TYPE && field.kind === 'text' ? (input.value ? String(new Date(input.value).getTime()) : '') : input.value
    answers.fields[field.key] = { value: field.kind === 'text' ? text : { amount: Number(input.value), type: field.type, unit: field.unit, start: field.start, end: field.end } }
  }
  box.append(label(field.kind === 'text' ? (input.type === 'text' ? 'Text ' : 'Value ') : `Amount (${field.unit}) `, input))
  const extra = interact.fieldExtras?.(field, answers); if (extra) box.append(extra)
  return box
}

async function body(doc: Document, page: SitePage, options: SiteOptions, heading: 'h1' | 'p'): Promise<HTMLElement | null> {
  if (page.type === NOTE_TYPE && page.body !== undefined) {
    const html = el(doc, 'div', 'fos-site-markdown'); html.innerHTML = await options.markdown(page.body)
    if (page.truncated) html.append(el(doc, 'p', 'fos-site-note', 'This text is longer than a published page shows.'))
    return html
  }
  if (isField(page)) {
    if (!page.body) return null
    const line = el(doc, 'p', 'fos-site-field'); line.append(el(doc, 'strong', '', page.title ? `${page.title}: ` : ''), doc.createTextNode(page.body)); return line
  }
  if (!page.title) return null
  return el(doc, heading, heading === 'h1' ? 'fos-site-title' : 'fos-site-text', page.title)
}

/** Render the page at `options.trail` into `target` (replacing its children); returns the pages along the trail. */
export async function renderSitePage(target: HTMLElement, node: SharedNode, options: SiteOptions): Promise<SitePage[]> {
  const doc = target.ownerDocument, tree = siteTree(node), pages = pagesAlong(tree, options.trail), page = pages[pages.length - 1]!
  const interact = options.interact, answers = options.answers ?? siteAnswers(node)
  // inputs by the page or row they belong to
  const placed = new Map<SitePage, SharedInput[]>()
  if (interact && (!node.template || node.execution)) for (const field of node.inputs) { const at = placeOf(tree, field); placed.set(at, [...(placed.get(at) ?? []), field]) }
  const inputsOf = (at: SitePage) => (placed.get(at) ?? []).map(field => fieldControl(doc, field, at, answers, interact!))
  const article = el(doc, 'article', 'fos-site')
  const link = (label: string, trail: string[]) => {
    const a = el(doc, 'a', '', label || 'Untitled'); a.href = '#'
    a.onclick = event => { event.preventDefault(); options.navigate(trail) }
    return a
  }
  if (pages.length > 1) {
    const crumbs = el(doc, 'nav', 'fos-site-crumbs'); crumbs.setAttribute('aria-label', 'Pages')
    pages.slice(0, -1).forEach((p, i) => { crumbs.append(link(p.title, pages.slice(1, i + 1).map(x => x.id)), doc.createTextNode(' › ')) })
    crumbs.append(el(doc, 'span', '', page.title)); article.append(crumbs)
  }
  const header = await body(doc, page, options, 'h1')
  if (header) article.append(header)
  article.append(...inputsOf(page))
  const here = pages.slice(1).map(p => p.id)
  let list: HTMLUListElement | null = null
  const section = async (row: SitePage): Promise<HTMLElement | null> => {
    const parts = [await body(doc, row, options, 'p'), ...inputsOf(row)]
    // a row's own fields read as part of its section
    for (const child of row.children) parts.push(await body(doc, child, options, 'p'), ...inputsOf(child))
    const present = parts.filter((p): p is HTMLElement => !!p)
    if (!present.length) return null
    const wrap = el(doc, 'section', 'fos-site-section'); wrap.append(...present); return wrap
  }
  for (const child of page.children) {
    if (isSubPage(child)) {
      // a row with rows of its own is a sub-page: consecutive ones form one list of links
      if (!list) { list = el(doc, 'ul', 'fos-site-pages'); const nav = el(doc, 'nav'); nav.append(list); article.append(nav) }
      const item = el(doc, 'li'); item.append(link(child.title, [...here, child.id])); list.append(item)
      continue
    }
    list = null
    const part = await section(child)
    if (part) article.append(part)
  }
  if (!interact) { target.replaceChildren(article); await options.hydrate?.(article); return pages }
  const form = el(doc, 'form', 'fos-site-form'); form.append(article)
  form.append(...answerControls(doc, node, answers, interact, form))
  target.replaceChildren(form)
  await options.hydrate?.(article)
  return pages
}

/** The answer area after the page: name, approvals, ranking and submit, or Start for a template endpoint. */
function answerControls(doc: Document, node: SharedNode, answers: SiteAnswers, interact: SiteInteraction, form: HTMLFormElement): HTMLElement[] {
  const parts: HTMLElement[] = []
  const button = (text: string, type: 'button' | 'submit') => { const b = el(doc, 'button', '', text); b.type = type; return b }
  if (node.template && !node.execution) {
    if (!interact.start) return parts
    const start = button('Start', 'button'); start.onclick = () => { start.disabled = true; void interact.start!().finally(() => { start.disabled = false }) }
    return [start]
  }
  const choices = [...(node.poll?.mode === 'approval' ? node.options : []), ...node.proposals]
  const rankOptions = node.poll?.mode === 'rank' ? node.options : node.proposals
  const ranks = rankOptions.length && node.capabilities?.includes('rank')
  if (!node.execution && !node.inputs.length && !choices.length && !ranks) return parts
  const label = (text: string, input: HTMLElement) => { const l = el(doc, 'label', '', text); l.append(input); return l }
  const name = el(doc, 'input'); name.maxLength = 80; name.setAttribute('autocomplete', 'nickname'); name.value = answers.name; name.required = !interact.signedIn && !!node.poll
  name.oninput = () => { answers.name = name.value }
  if (!interact.signedIn) parts.push(label(node.poll ? 'Your display name (visible to the host) ' : 'Display name (optional) ', name))
  for (const option of choices) {
    const check = el(doc, 'input'); check.type = 'checkbox'; check.checked = answers.approvals.has(option.id); check.disabled = !!node.capabilities && !node.capabilities.includes('edit')
    check.onchange = () => { if (check.checked) answers.approvals.add(option.id); else answers.approvals.delete(option.id) }
    parts.push(label(`${option.label} · ${node.counts[option.id] ?? 0} approval${node.counts[option.id] === 1 ? '' : 's'} `, check))
  }
  if (ranks) {
    const box = el(doc, 'fieldset'); box.append(el(doc, 'legend', '', 'Rank · first is preferred'))
    const list = el(doc, 'div'); box.append(list)
    const draw = () => {
      list.replaceChildren()
      answers.ranking.forEach((id, i) => {
        const row = el(doc, 'div', '', `${i + 1}. ${rankOptions.find(o => o.id === id)?.label ?? id} · ${node.rankings[id] ?? 0} points `)
        const move = (d: number) => { [answers.ranking[i], answers.ranking[i + d]] = [answers.ranking[i + d]!, answers.ranking[i]!]; draw() }
        const up = button('↑', 'button'); up.setAttribute('aria-label', `Rank ${i + 1} higher`); up.disabled = i === 0; up.onclick = () => move(-1)
        const down = button('↓', 'button'); down.setAttribute('aria-label', `Rank ${i + 1} lower`); down.disabled = i === answers.ranking.length - 1; down.onclick = () => move(1)
        row.append(up, down); list.append(row)
      })
    }
    draw(); parts.push(box)
  }
  const submit = button(node.execution ? 'Complete' : 'Save input', 'submit'); submit.disabled = !!node.execution && !['idle', 'rolled-back'].includes(node.execution.status)
  parts.push(submit)
  form.onsubmit = event => {
    event.preventDefault(); submit.disabled = true; answers.name = name.value
    void interact.submit({ ...answers, ranking: ranks ? answers.ranking : [] }, node.revision).finally(() => { submit.disabled = false })
  }
  parts.push(el(doc, 'p', 'fos-site-note', `${node.participants} response${node.participants === 1 ? '' : 's'}. Responses are tallied; the owner applies the result to the choice and reviews submitted values.`))
  return parts
}

/** Styles for the site; colors and fonts are inherited, so it follows the host page (or the app's theme). */
export const SITE_CSS = `
.fos-site { line-height: 1.6; overflow-wrap: anywhere; max-width: 72ch; margin: 0 auto; }
.fos-site-form { max-width: 72ch; margin: 0 auto; }
.fos-site-form > :not(.fos-site) { margin: .6em 0; }
.fos-site-form label { display: block; }
.fos-site h1, .fos-site h2, .fos-site h3 { line-height: 1.25; margin: 1.2em 0 .5em; }
.fos-site > :first-child, .fos-site-markdown > :first-child { margin-top: 0; }
.fos-site-section { margin: 1.5em 0; padding-top: 1em; border-top: 1px solid rgba(127, 127, 127, .25); }
.fos-site-input { margin: .8em 0; padding: .5em .8em; border: 1px solid rgba(127, 127, 127, .35); border-radius: 8px; min-width: 0; }
.fos-site-input input:not([type="checkbox"]), .fos-site-input select { display: block; width: 100%; max-width: 32em; box-sizing: border-box; font: inherit; padding: .35em .5em; }
.fos-site pre { overflow-x: auto; padding: .75em; border-radius: 6px; background: rgba(127, 127, 127, .12); }
.fos-site code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92em; }
.fos-site :not(pre) > code { padding: .1em .3em; border-radius: 4px; background: rgba(127, 127, 127, .12); }
.fos-site blockquote { margin: 0 0 1em; padding-left: 1em; border-left: 3px solid rgba(127, 127, 127, .4); opacity: .85; }
.fos-site table { border-collapse: collapse; display: block; overflow-x: auto; }
.fos-site td, .fos-site th { border: 1px solid rgba(127, 127, 127, .35); padding: .25em .5em; }
.fos-site a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.fos-site-crumbs { font-size: .9em; opacity: .8; margin-bottom: 1em; }
.fos-site-pages { padding-left: 1.2em; }
.fos-site-pages li { margin: .3em 0; }
.fos-site-note { font-size: .9em; opacity: .7; font-style: italic; }
.fos-site .diagram svg { max-width: 100%; height: auto; }
.fos-site .katex-display { overflow-x: auto; }
`
