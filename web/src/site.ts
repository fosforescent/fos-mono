/**
 * A published node as a small website: the node is the page (its markdown body, or its title as a heading), leaf
 * children are sections of that page, and children with rows of their own are sub-pages linked from it.
 * What is markdown comes from each row's text presentation (`text.mediaType`), never from a row kind.
 * Shared by the share page (`sharing.ts`) and the standalone embed script (`embed.ts`), so it imports no app code.
 */
import type { SharedAddress as ShareAddress, SharedNode, SharedRow } from '../../shared/sync/sharing'

export type SitePage = { id: string; title: string; text?: SharedRow['text']; body?: string; truncated?: true; children: SitePage[] }
export type SiteOptions = {
  /** Markdown to sanitized HTML. */
  markdown: (md: string) => string | Promise<string>
  /** Optional pass over the rendered page (diagrams). */
  hydrate?: (container: HTMLElement) => void | Promise<void>
  /** Row ids from the published node down to the page shown; [] is the node itself. */
  trail: string[]
  navigate: (trail: string[]) => void
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

/** Rows arrive in depth-first order with their depth; rebuild the tree. */
export function siteTree(node: SharedNode): SitePage {
  const root: SitePage = { id: '', title: node.title, ...(node.text ? { text: node.text } : {}), ...(node.body !== undefined ? { body: node.body } : {}), ...(node.truncated ? { truncated: true as const } : {}), children: [] }
  const stack: SitePage[] = [root]
  for (const row of node.rows) {
    const page: SitePage = { id: row.id, title: row.title, ...(row.text ? { text: row.text } : {}), ...(row.body !== undefined ? { body: row.body } : {}), ...(row.truncated ? { truncated: true as const } : {}), children: [] }
    stack.length = Math.min(stack.length, row.depth + 1)
    ;(stack[stack.length - 1] ?? root).children.push(page)
    stack.push(page)
  }
  return root
}

/** The pages along `trail`, starting with the root; stops at the first id that is not a sub-page. */
export function pagesAlong(root: SitePage, trail: string[]): SitePage[] {
  const pages = [root]
  for (const id of trail) {
    const next = pages[pages.length - 1]!.children.find(child => child.id === id && child.children.length)
    if (!next) break
    pages.push(next)
  }
  return pages
}

const isMarkdown = (page: SitePage) => page.text?.mediaType === 'text/markdown' && page.body !== undefined

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node
}

async function content(doc: Document, page: SitePage, options: SiteOptions, heading: 'h1' | 'h2'): Promise<HTMLElement | null> {
  if (isMarkdown(page)) {
    const body = el(doc, 'div', 'fos-site-markdown'); body.innerHTML = await options.markdown(page.body!)
    if (page.truncated) body.append(el(doc, 'p', 'fos-site-note', 'This text is longer than a published page shows.'))
    return body
  }
  if (!page.title) return null
  return heading === 'h1' ? el(doc, 'h1', 'fos-site-title', page.title) : el(doc, 'p', 'fos-site-text', page.title)
}

/** Render the page at `options.trail` into `target` (replacing its children). */
export async function renderSitePage(target: HTMLElement, node: SharedNode, options: SiteOptions): Promise<SitePage[]> {
  const doc = target.ownerDocument, pages = pagesAlong(siteTree(node), options.trail), page = pages[pages.length - 1]!
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
  const header = await content(doc, page, options, 'h1')
  if (header) article.append(header)
  const here = pages.slice(1).map(p => p.id)
  let list: HTMLUListElement | null = null
  for (const child of page.children) {
    if (child.children.length) {
      // a row with rows of its own is a sub-page: consecutive ones form one list of links
      if (!list) { list = el(doc, 'ul', 'fos-site-pages'); const nav = el(doc, 'nav'); nav.append(list); article.append(nav) }
      const item = el(doc, 'li'); item.append(link(child.title, [...here, child.id])); list.append(item)
      continue
    }
    list = null
    const section = await content(doc, child, options, 'h2')
    if (!section) continue
    const wrap = el(doc, 'section', 'fos-site-section'); wrap.append(section); article.append(wrap)
  }
  target.replaceChildren(article)
  await options.hydrate?.(article)
  return pages
}

/** Styles for the site; colors and fonts are inherited, so it follows the host page (or the app's theme). */
export const SITE_CSS = `
.fos-site { line-height: 1.6; overflow-wrap: anywhere; max-width: 72ch; margin: 0 auto; }
.fos-site h1, .fos-site h2, .fos-site h3 { line-height: 1.25; margin: 1.2em 0 .5em; }
.fos-site > :first-child, .fos-site-markdown > :first-child { margin-top: 0; }
.fos-site-section { margin: 1.5em 0; padding-top: 1em; border-top: 1px solid rgba(127, 127, 127, .25); }
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
