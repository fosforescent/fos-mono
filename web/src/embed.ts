/**
 * Standalone embed script (built to `dist/embed.js` by `vite.embed.config.ts`, served next to the web app):
 *
 *   <script src="https://<web app>/embed.js" data-fos-share="<share URL>" async></script>
 *   <div data-fos-share="<share URL>"></div> <script src="https://<web app>/embed.js" async></script>
 *
 * Each `[data-fos-share]` element (a script renders right after itself) gets a shadow root with the published node
 * rendered as a page, fetched from the public read endpoint (`GET /public/node/read`, no credentials, nothing
 * recorded). `data-fos-api` overrides the account server the build points at. Markdown is sanitized; math and
 * diagrams stay as source here (the share page renders them).
 */
import { markdownToSafeHtml } from './markdown-core'
import { parseShareAddress, publicReadUrl, renderSitePage, SITE_CSS } from './site'
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
  let node: SharedNode
  try {
    const response = await fetch(publicReadUrl(api, address), { credentials: 'omit' })
    const result = await response.json().catch(() => ({})) as { node?: SharedNode; error?: string }
    if (!response.ok || !result.node) throw new Error(result.error ?? 'This published node is unavailable.')
    node = result.node
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); return }
  status.remove()
  const footer = document.createElement('p'); footer.className = 'fos-embed-footer'
  const open = document.createElement('a'); open.href = shareLink; open.target = '_blank'; open.rel = 'noopener noreferrer'
  open.textContent = node.poll || node.inputs.length || node.proposals.length ? 'Respond on Fosforescent' : 'Published with Fosforescent'
  footer.append(open); root.append(footer)
  const show = async (trail: string[]) => {
    await renderSitePage(page, node, { markdown: markdownToSafeHtml, trail, navigate: next => { void show(next).then(() => host.scrollIntoView?.({ block: 'start' })) } })
  }
  await show([])
}

export function mountAll(scope: ParentNode = document): void {
  for (const element of scope.querySelectorAll<HTMLElement>('[data-fos-share]')) void mount(element)
}

;(window as unknown as { FosEmbed?: unknown }).FosEmbed = { mount, mountAll }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll())
else mountAll()
