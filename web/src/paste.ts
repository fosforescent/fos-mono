import { parseDocument } from 'yaml'
import { parseRowInput, type ParsedInput } from './rows'
import { NOTE_TYPE } from '../../shared/sync/library-types'
/** Characters from which unstructured text is offered for organizing instead of being split into one row per line. */
export const LONG_PASTE = 1000
/**
 * A long block of prose: no Markdown headings, lists or fences, not YAML. Such a paste is better organized into the
 * node by the model (App.organizeText) than split per line; structured pastes keep their structure.
 */
export function isLongProse(text: string): boolean {
  const raw = text.replace(/\r\n?/g, '\n').trim()
  if (raw.length < LONG_PASTE) return false
  if (/^\s*(?:[-*+] |\d+[.)] |#{1,6} |```|\[[ xX]?\] )/m.test(raw)) return false
  return !/^[\w"'][^\n]{0,80}:\s*\n/.test(raw) // a leading `key:` line block reads as YAML
}

/** Clipboard text is data: bounded traversal, no YAML aliases or executable constructors. */
export function parsePastedRows(text: string): ParsedInput[] {
  if (text.length > 1_000_000) throw new Error('Paste at most 1 MB at a time.')
  const raw = text.replace(/\r\n?/g, '\n').trim()
  let count = 0
  const row = (text: string, children?: ParsedInput[]): ParsedInput => {
    if (++count > 5000) throw new Error('Paste at most 5,000 rows at a time.')
    return { ...parseRowInput(text), ...(children?.length ? { children } : {}) }
  }
  const yaml = raw.replace(/^```ya?ml\s*\n([\s\S]*?)\n```$/i, '$1')
  if (/^```ya?ml\b/i.test(raw) || /^[\w"'][^\n]*:\s*(?:\n|\S)/.test(raw)) {
    const doc = parseDocument(yaml, { uniqueKeys: true })
    if (doc.errors.length) throw new Error(doc.errors[0]!.message)
    const value = doc.toJS({ maxAliasCount: 0 })
    const walk = (value: unknown, depth = 0): ParsedInput[] => {
      if (depth > 64) throw new Error('Paste nesting must be at most 64 levels.')
      if (Array.isArray(value)) return value.flatMap(v => typeof v === 'object' && v !== null ? [row('Item', walk(v, depth + 1))] : [row(String(v ?? ''))])
      if (value && typeof value === 'object') return Object.entries(value).map(([key, v]) => typeof v === 'object' && v !== null ? row(key, walk(v, depth + 1)) : row(`${key}: ${String(v ?? '')}`))
      return [row(String(value ?? ''))]
    }
    if (value && typeof value === 'object') return walk(value)
  }
  const roots: ParsedInput[] = [], stack: Array<{ level: number; row: ParsedInput }> = []
  let heading = 0, fence: string[] | null = null
  const append = (item: ParsedInput, level: number) => {
    while (stack.length && stack.at(-1)!.level >= level) stack.pop()
    if (stack.length) (stack.at(-1)!.row.children ??= []).push(item); else roots.push(item)
    stack.push({ level, row: item })
  }
  for (const line of raw.split('\n')) {
    if (/^\s*```/.test(line)) { if (fence) { append(row('> ' + fence.join('\n') + '\n' + line), heading * 100 + 1); fence = null } else fence = [line]; continue }
    if (fence) { fence.push(line); continue }
    if (!line.trim()) continue
    const title = line.match(/^(#{1,6})\s+(.+)$/)
    if (title) { heading = title[1]!.length; append(row(title[2]!), heading * 100); continue }
    const indent = line.match(/^\s*/)?.[0].replace(/\t/g, '  ').length ?? 0
    if (stack.at(-1)?.row.type === NOTE_TYPE && !/^\s*(?:[-*+] |\d+[.)] )/.test(line)) { stack.at(-1)!.row.text += '\n' + line.trimStart(); continue }
    const body = line.trim().replace(/^(?:[-*+] |\d+[.)] )/, '')
    append(row(body), heading * 100 + indent + 1)
  }
  if (fence) append(row('> ' + fence.join('\n')), heading * 100 + 1)
  return roots
}
