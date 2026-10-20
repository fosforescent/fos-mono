/**
 * Standalone embed script (built to `dist/embed.js` by `vite.embed.config.ts`, served next to the web app):
 *
 *   <script src="https://<web app>/embed.js" data-fos-share="<share URL>" async></script>
 *   <div data-fos-share="<share URL>"></div> <script src="https://<web app>/embed.js" async></script>
 *
 * Each `[data-fos-share]` element (a script renders right after itself) gets a shadow root with the published node
 * rendered as a page by the share page's renderer (`site.ts`), fetched from `GET /public/node/read` (no credentials, nothing
 * recorded until the visitor answers: then they join as an anonymous peer through `/public/node/visit|input`).
 * `data-fos-api` overrides the account server the build points at. Markdown is sanitized; math and
 * diagrams stay as source here (the share page renders them).
 */
import { markdownToSafeHtml } from './markdown-core'
import { parseShareAddress, publicReadUrl, renderSitePage, siteAnswers, SITE_CSS, type SiteInteraction } from './site'
import type { SharedNode } from '../../shared/sync/sharing'

const env = import.meta.env as Record<string, string | undefined>
const script = document.currentScript as HTMLScriptElement | null
const scriptOrigin = (() => { try { return script?.src ? new URL(script.src).origin : location.origin } catch { return location.origin } })()
const DEFAULT_API = (script?.dataset.fosApi ?? env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const EMBED_CSS = `
:host { display: block; }
.fos-embed-status { opacity: .7; font-style: italic; }
.fos-embed-footer { margin-top: 1.5em; font-size: .85em; opacity: .7; }
.fos-embed-footer a { color: inherit; }
`

export async function mount(element: HTMLElement): Promise<void> {
  if (element.dataset.fosMounted) return
  element.dataset.fosMounted = 'true'
  const value = element.dataset.fosShare ?? '', address = parseShareAddress(value)
  let host = element
  if (element instanceof HTMLScriptElement) { host = document.createElement('div'); host.className = 'fos-embed'; element.after(host) }
  let root: ShadowRoot
  try { root = host.shadowRoot ?? host.attachShadow({ mode: 'open' }) } catch { const inner = document.createElement('div'); host.append(inner); host = inner; root = inner.attachShadow({ mode: 'open' }) }
  const style = document.createElement('style'); style.textContent = SITE_CSS + EMBED_CSS
  const page = document.createElement('div'), status = document.createElement('p'); status.className = 'fos-embed-status'
  root.replaceChildren(style, page, status)
  if (!address) { status.textContent = 'This Fos embed needs a share link (data-fos-share).'; return }
  const api = (element.dataset.fosApi ?? DEFAULT_API).replace(/\/$/, '')
  const shareLink = /^https?:/.test(value) ? value : `${scriptOrigin}/#share=${encodeURIComponent(JSON.stringify(address))}`
  status.textContent = 'Loading…'
  // A visitor joins (POST /public/node/visit, an anonymous peer of the node) only when they first answer or start;
  // reading records nothing. Their receipt (and a template's private execution) is remembered on this site.
  const key = `fos:embed:${api}:${JSON.stringify(address)}`
  let saved: { visitorToken?: string; entryToken?: string; execution?: typeof address } = {}
  try { saved = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {} } catch { /* storage blocked */ }
  const remember = () => { try { localStorage.setItem(key, JSON.stringify(saved)) } catch { /* storage blocked */ } }
  let at = saved.execution ?? address, node = null as unknown as SharedNode, joined = false
  const call = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { credentials: 'omit', ...init })
    const result = await response.json().catch(() => ({})) as { node?: SharedNode; error?: string; visitorToken?: string; entryToken?: string; address?: typeof address }
    if (!response.ok || !result.node) throw new Error(result.error ?? 'This published node is unavailable.')
    return result as typeof result & { node: SharedNode }
  }
  const post = (action: 'visit' | 'input', body: object) => call(`${api}/public/node/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...at, ...body }) })
  const visit = async () => {
    const token = at === address && saved.entryToken ? saved.entryToken : saved.visitorToken
    const result = await post('visit', token ? { visitorToken: token } : {})
    if (result.entryToken) saved.entryToken = result.entryToken
    if (result.address) { at = result.address; saved.execution = result.address }
    if (result.visitorToken) saved.visitorToken = result.visitorToken
    remember(); node = result.node; joined = true
  }
  try {
    if (saved.visitorToken || saved.execution) await visit()
    else node = (await call(publicReadUrl(api, address))).node
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); return }
  status.textContent = ''
  const footer = document.createElement('p'); footer.className = 'fos-embed-footer'
  const open = document.createElement('a'); open.href = shareLink; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = 'Published with Fosforescent'
  footer.append(open); root.append(footer)
  let trail: string[] = [], answers = siteAnswers(node)
  const fail = (error: unknown) => { status.textContent = error instanceof Error ? error.message : String(error) }
  const interact: SiteInteraction = {
    signedIn: false,
    start: async () => { try { await visit(); answers = siteAnswers(node); trail = []; await show() } catch (error) { fail(error) } },
    submit: async (given, revision) => {
      try {
        if (!joined) { await visit(); revision = node.revision }
        const fields = Object.fromEntries(Object.entries(given.fields).filter(([, entry]) => entry.value !== undefined).map(([k, entry]) => [k, { value: entry.value }]))
        node = (await post('input', { visitorToken: saved.visitorToken, revision, name: given.name, approvals: [...given.approvals], ranking: given.ranking, fields })).node
        answers = siteAnswers(node); await show(); status.textContent = 'Saved. The host reviews what you sent.'
      } catch (error) { fail(error) }
    }
  }
  const show = async () => {
    await renderSitePage(page, node, { markdown: markdownToSafeHtml, trail, answers, interact, navigate: next => { trail = next; void show().then(() => host.scrollIntoView?.({ block: 'start' })) } })
  }
  await show()
}

export function mountAll(scope: ParentNode = document): void {
  for (const element of scope.querySelectorAll<HTMLElement>('[data-fos-share]')) void mount(element)
}

;(window as unknown as { FosEmbed?: unknown }).FosEmbed = { mount, mountAll }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll())
else mountAll()
