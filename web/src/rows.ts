/**
 * Row kinds in the tree (see shared/sync/graph.ts: a row is [node, KIND]).
 * Typing in the add bar creates a plain row unless the text starts with a
 * marker: "[]"/"[ ]" task, "[x]" done task, "-" note block, "//" comment.
 * Links in plain rows and comments are rendered as anchors; image and
 * YouTube links as embeds.
 */

import type { RowKind } from '../../shared/sync/index'

export type ParsedInput = { kind: RowKind; text: string; done: boolean }

export function parseRowInput(raw: string): ParsedInput {
  const text = raw.replace(/\s+$/, '')
  let m: RegExpMatchArray | null
  if ((m = text.match(/^\[(x|X)\]\s*(.*)$/s))) return { kind: 'task', text: m[2] ?? '', done: true }
  if ((m = text.match(/^\[\s?\]\s*(.*)$/s))) return { kind: 'task', text: m[1] ?? '', done: false }
  if ((m = text.match(/^-\s?(.*)$/s))) return { kind: 'note', text: m[1] ?? '', done: false }
  if ((m = text.match(/^\/\/\s*(.*)$/s))) return { kind: 'comment', text: m[1] ?? '', done: false }
  return { kind: 'plain', text: text.trim(), done: false }
}

export const ROW_KIND_LABEL: Record<RowKind, string> = { task: 'Task', plain: 'Row', note: 'Note', comment: 'Comment', ref: 'Reference' }

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
