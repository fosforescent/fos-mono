/**
 * Markdown → sanitized HTML without the lazily loaded extras (KaTeX, Mermaid), so a standalone bundle such as the
 * embed script can use it. `markdown.ts` adds math and diagrams on top for the app.
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

const SANITIZE = { USE_PROFILES: { html: true }, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'img', 'picture', 'source', 'video', 'audio', 'input'], FORBID_ATTR: ['style', 'srcset', 'poster'] }

/** Sanitized HTML for `md`; links open in a new tab, anchors without a target are unwrapped. */
export function markdownToSafeHtml(md: string): string {
  const html = DOMPurify.sanitize(marked.parse(md, { async: false }) as string, SANITIZE) as string
  const template = document.createElement('template'); template.innerHTML = html
  for (const link of template.content.querySelectorAll('a')) {
    if (!link.hasAttribute('href')) link.replaceWith(...link.childNodes)
    else { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer') }
  }
  return template.innerHTML
}
