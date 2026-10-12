/**
 * Minimal TOML reader for fos.config.toml, shared by the CLI and the web app
 * running inside the desktop shell. Supports comments, [tables], [a.b], and
 * key = string | number | bool | array of those; that is all the config needs.
 */

export type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue }

export const CONFIG_FILE = 'fos.config.toml'
export const STATE_DIR = '.fos'

/** Shape of fos.config.toml. */
export type FosProjectConfig = {
  attach?: { server?: string; token?: string; name?: string }
  serve?: { port?: number; host?: string }
}

/** File-system-safe name for a branch (.fos/replicas/<name>.json). */
export function branchFileName(branch: string): string {
  return branch.replace(/[^A-Za-z0-9._-]+/g, '__')
}

/** Minimal TOML: comments, [tables], [a.b], key = string | number | bool | array of those. */
export function parseToml(text: string): { [key: string]: TomlValue } {
  const root: { [key: string]: TomlValue } = {}
  let table = root
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = stripComment(raw).trim()
    if (!line) return
    const header = /^\[([^\]]+)\]$/.exec(line)
    if (header) {
      table = root
      for (const part of (header[1] as string).split('.').map((p) => p.trim().replace(/^"(.*)"$/, '$1'))) {
        const next = table[part]
        if (next && typeof next === 'object' && !Array.isArray(next)) table = next as { [key: string]: TomlValue }
        else { const created: { [key: string]: TomlValue } = {}; table[part] = created; table = created }
      }
      return
    }
    const eq = line.indexOf('=')
    if (eq < 0) throw new Error(`${CONFIG_FILE}:${index + 1}: expected key = value`)
    const key = line.slice(0, eq).trim().replace(/^"(.*)"$/, '$1')
    table[key] = parseValue(line.slice(eq + 1).trim(), index + 1)
  })
  return root
}

function stripComment(line: string): string {
  let inString: string | null = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inString) { if (c === inString) inString = null; continue }
    if (c === '"' || c === "'") inString = c
    else if (c === '#') return line.slice(0, i)
  }
  return line
}

function parseValue(raw: string, lineNo: number): TomlValue {
  if (raw.startsWith('"') && raw.endsWith('"')) return JSON.parse(raw) as string
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1)
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^[-+]?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim()
    if (!inner) return []
    return splitTopLevel(inner).map((item) => parseValue(item.trim(), lineNo))
  }
  throw new Error(`${CONFIG_FILE}:${lineNo}: unsupported value ${raw}`)
}

function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let inString: string | null = null
  let current = ''
  for (const c of text) {
    if (inString) { current += c; if (c === inString) inString = null; continue }
    if (c === '"' || c === "'") { inString = c; current += c; continue }
    if (c === '[') depth++
    if (c === ']') depth--
    if (c === ',' && depth === 0) { out.push(current); current = ''; continue }
    current += c
  }
  if (current.trim()) out.push(current)
  return out
}
