/**
 * Note blocks: a note row's title is its markdown body. Its child rows act
 * as variables: a plain row "key: value" sets `key`; any other child provides
 * its title as the key and its content (a note's body, or the titles of its
 * sub-rows as a list) as the value; a reference child contributes the row it
 * points at the same way, so blocks can be linked from elsewhere. Frontmatter
 * at the top of the body ("---" fenced key: value lines) is merged with the
 * children, children winning. `{{key}}` and `{key}` in the body are replaced;
 * list values render as markdown bullet lists.
 */

import type { TaskView } from './graph'
import { legacyTextPresentation } from './legacy-row-types'

const isMarkdown = (row: TaskView) => (row.text ?? legacyTextPresentation(row.kind))?.mediaType === 'text/markdown'

export type NoteVar = { value: string | string[]; source: 'child' | 'frontmatter' | 'ref' }
export type NoteContext = { body: string; vars: Record<string, NoteVar>; frontmatter: Record<string, string> }

/** Children of a note as seen by the view, with sub-rows and resolved refs supplied by the caller. */
export type NoteChild = { row: TaskView; subRows: TaskView[]; refTarget?: { row: TaskView; subRows: TaskView[] } | null }

export function splitFrontmatter(body: string): { frontmatter: Record<string, string>; rest: string } {
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { frontmatter: {}, rest: body }
  const frontmatter: Record<string, string> = {}
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_][\w.-]*)\s*:\s*(.*)$/)
    if (kv) frontmatter[kv[1] as string] = (kv[2] ?? '').trim()
  }
  return { frontmatter, rest: body.slice(m[0].length) }
}

export function keyValueOf(title: string): { key: string; value: string } | null {
  const m = title.match(/^\s*([A-Za-z_][\w.-]*)\s*:\s*([\s\S]*)$/)
  return m ? { key: m[1] as string, value: (m[2] ?? '').trim() } : null
}

function valueOfRow(row: TaskView, subRows: TaskView[]): string | string[] {
  if (isMarkdown(row)) return row.title
  if (subRows.length) return subRows.map((r) => r.title)
  const kv = keyValueOf(row.title)
  return kv ? kv.value : row.title
}

export function noteContext(body: string, children: NoteChild[]): NoteContext {
  const { frontmatter, rest } = splitFrontmatter(body)
  const vars: Record<string, NoteVar> = {}
  for (const [k, v] of Object.entries(frontmatter)) vars[k] = { value: v, source: 'frontmatter' }
  for (const child of children) {
    const { row, subRows } = child
    if (row.kind === 'ref') {
      const t = child.refTarget
      if (!t) continue
      const kv = !isMarkdown(t.row) ? keyValueOf(t.row.title) : null
      const key = kv ? kv.key : firstLine(t.row.title)
      if (key) vars[key] = { value: kv ? kv.value : valueOfRow(t.row, t.subRows), source: 'ref' }
      continue
    }
    const kv = !isMarkdown(row) ? keyValueOf(row.title) : null
    if (kv && !subRows.length) { vars[kv.key] = { value: kv.value, source: 'child' }; continue }
    const key = kv ? kv.key : firstLine(row.title)
    if (key) vars[key] = { value: subRows.length ? subRows.map((r) => r.title) : valueOfRow(row, subRows), source: 'child' }
  }
  return { body: rest, vars, frontmatter }
}

function firstLine(text: string): string {
  return (text.split(/\r?\n/)[0] ?? '').replace(/^#+\s*/, '').trim()
}

function render(value: string | string[]): string {
  return Array.isArray(value) ? value.map((v) => `- ${v}`).join('\n') : value
}

/** Body with `{{key}}` / `{key}` replaced by the variables (unknown keys are left as written). */
export function expandNote(ctx: NoteContext, resolve?: (key: string) => string | undefined): string {
  const value = (key: string) => resolve ? resolve(key) : key in ctx.vars ? render(ctx.vars[key]!.value) : undefined
  return ctx.body
    .replace(/\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g, (m, key: string) => (value(key) ?? m))
    .replace(/(^|[^{])\{\s*([A-Za-z_][\w.-]*)\s*\}(?!\})/g, (m, pre: string, key: string) => (value(key) !== undefined ? pre + value(key) : m))
}

/** One cohesive markdown file: merged frontmatter (children override) plus the expanded body. */
export function exportNote(ctx: NoteContext, resolve?: (key: string) => string | undefined): string {
  const merged: Record<string, string> = { ...ctx.frontmatter }
  for (const [k, v] of Object.entries(ctx.vars)) if (v.source !== 'frontmatter' && !Array.isArray(v.value)) merged[k] = v.value
  const fm = Object.keys(merged).length ? `---\n${Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n` : ''
  return fm + expandNote(ctx, resolve).replace(/\s+$/, '') + '\n'
}

export function noteFilename(body: string): string {
  const name = firstLine(body).replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'note'
  return `${name}.md`
}
