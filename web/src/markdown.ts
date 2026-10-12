/**
 * Markdown rendering for note blocks: marked + DOMPurify, with LaTeX (KaTeX)
 * and Mermaid diagrams loaded on first use so the main bundle stays small.
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

type Katex = { renderToString(tex: string, opts: { displayMode: boolean; throwOnError: boolean; output: 'html' }): string }
let katexPromise: Promise<Katex> | null = null
async function loadKatex(): Promise<Katex> {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => (m.default ?? m) as unknown as Katex)
  }
  return katexPromise
}

type Mermaid = { initialize(cfg: Record<string, unknown>): void; render(id: string, text: string): Promise<{ svg: string }> }
let mermaidPromise: Promise<Mermaid> | null = null
async function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = (m.default ?? m) as unknown as Mermaid
      const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
      return mermaid
    })
  }
  return mermaidPromise
}

const cache = new Map<string, string>()

/** Pull `$$…$$` and `$…$` (outside code) out of the text so markdown does not mangle them. */
function extractMath(md: string): { text: string; math: Array<{ tex: string; display: boolean }> } {
  const math: Array<{ tex: string; display: boolean }> = []
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/)
  const text = parts
    .map((part, i) => {
      if (i % 2 === 1) return part // code
      return part
        .replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => { math.push({ tex: tex.trim(), display: true }); return `@@MATH${math.length - 1}@@` })
        .replace(/(^|[^\\$])\$([^$\n]+?)\$(?!\$)/g, (_m, pre: string, tex: string) => { math.push({ tex: tex.trim(), display: false }); return `${pre}@@MATH${math.length - 1}@@` })
    })
    .join('')
  return { text, math }
}

export function hasMath(md: string): boolean { return /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(md) }

/** Markdown → sanitized HTML. Math is rendered when KaTeX is already loaded; otherwise it is kept as source and a reload is requested. */
export async function renderMarkdown(md: string): Promise<string> {
  const cached = cache.get(md)
  if (cached) return cached
  const { text, math } = extractMath(md)
  let html = DOMPurify.sanitize(await marked.parse(text), { ADD_ATTR: ['target'], FORBID_TAGS: ['style'] })
  if (math.length) {
    const katex = await loadKatex()
    html = html.replace(/@@MATH(\d+)@@/g, (_m, i: string) => {
      const item = math[Number(i)]
      if (!item) return ''
      try { return katex.renderToString(item.tex, { displayMode: item.display, throwOnError: false, output: 'html' }) } catch { return `<code>${item.tex}</code>` }
    })
  }
  // links open in a new tab
  html = html.replace(/<a href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
  cache.set(md, html)
  return html
}

/** Replace ```mermaid fences (rendered by marked as <pre><code class="language-mermaid">) with diagrams. */
export async function hydrateDiagrams(container: HTMLElement): Promise<void> {
  const blocks = [...container.querySelectorAll<HTMLElement>('pre > code.language-mermaid')]
  if (!blocks.length) return
  const mermaid = await loadMermaid()
  for (const code of blocks) {
    const pre = code.parentElement as HTMLElement
    const source = code.textContent ?? ''
    try {
      const { svg } = await mermaid.render(`m${Math.random().toString(36).slice(2, 10)}`, source)
      const holder = document.createElement('div')
      holder.className = 'diagram'
      holder.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } })
      pre.replaceWith(holder)
    } catch (error) {
      pre.classList.add('diagram-error')
      pre.title = error instanceof Error ? error.message : String(error)
    }
  }
}
