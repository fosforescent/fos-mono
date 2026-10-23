/** Property paths and their parenthesized spelling share one small, serializable grammar. */
import type { FosStore } from '../dag-implementation/store'
import { content, enclosingScopes, identityCid, isBranchChoice, isHandle, isLibraryRef, rootTargetCid, valueContent, isRowEdge, isMemberEdge, refValueCid, type Scope } from './graph'
import { headCid, type Replica } from './replica'
import { bindingLayers, bindingProperties, selectBinding, type BindingAccess, type BindingLocation, type ScopedBinding } from './scope-bindings'

export type RefExpression = { up: number; path: string[]; lexical: boolean }
export function parseRefExpression(source: string): RefExpression {
  const tokens = source.trim().match(/\(|\)|[^\s()]+/g) ?? []
  let index = 0
  const atom = (text: string): RefExpression => {
    const match = /^(\.*)([A-Za-z_][\w:-]*(?:\.[A-Za-z_][\w:-]*)*)?$/.exec(text)
    if (!match || !text) throw new Error('Invalid ref expression.')
    return { up: Math.max(0, match[1]!.length - 1), path: match[2]?.split('.') ?? [], lexical: !match[1] }
  }
  const read = (depth: number): RefExpression => {
    if (depth > 64) throw new Error('Ref expression is too deep.')
    const token = tokens[index++]
    if (!token || token === ')') throw new Error('Expected a ref expression.')
    if (token !== '(') return atom(token)
    const operation = tokens[index++]
    if (!operation || operation === '(' || operation === ')') throw new Error('Expected a ref property.')
    const base = read(depth + 1)
    if (tokens[index++] !== ')') throw new Error('Expected a closing parenthesis.')
    if (operation === '..') {
      if (base.path.length) base.path.pop(); else base.up++
      return { ...base, lexical: false }
    }
    const property = atom(operation)
    if (property.up || !property.path.length) throw new Error('Expected a ref property.')
    return { ...base, path: [...base.path, ...property.path] }
  }
  const result = read(0)
  if (index !== tokens.length) throw new Error('Unexpected text after ref expression.')
  return result
}
export const formatRefExpression = (expression: RefExpression) => `${'.'.repeat(expression.up + 1)}${expression.path.join('.')}`
export type RefAccess = BindingAccess
export type RefLocation = BindingLocation
export type RefPathResult = { status: 'ready' | 'missing' | 'ambiguous' | 'denied' | 'cycle'; locations: RefLocation[]; message?: string }

/** Resolve only actual properties, never descendants or peers elsewhere in the graph. */
export function resolveRefExpression(r: Pick<Replica, 'store'>, at: Scope, expression: string | RefExpression, access: RefAccess = {}): RefPathResult {
  return resolvePath(r, at, typeof expression === 'string' ? parseRefExpression(expression) : expression, access)
}

function resolvePath(r: Pick<Replica, 'store'>, at: Scope, parsed: RefExpression, access: RefAccess): RefPathResult {
  const scopes = enclosingScopes(r.store, headCid(r), at).slice(parsed.up)
  if (!scopes.length) return { status: 'missing', locations: [], message: 'Ref path climbs beyond the available scope.' }
  if (!parsed.path.length) {
    const scope = scopes[0]!, location = { store: scope.store, cid: scope.cid, path: scope.path }
    return access.canRead && !access.canRead(location.store, location.cid, location.path) ? { status: 'denied', locations: [] } : { status: 'ready', locations: [location] }
  }
  const layers = bindingLayers(r, at, access).slice(parsed.up)
  let result = selectBinding(parsed.lexical ? layers : layers.slice(0, 1), parsed.path[0]!)
  for (const name of parsed.path.slice(1)) {
    if (result.status !== 'ready') return result
    result = selectBinding([bindingProperties(result.locations[0]!, access)], name)
  }
  return result
}

/** Identity and name lookup have the same lexical boundary. A cached sibling is not a declaration here. */
export function resolveRefIdentity(r: Pick<Replica, 'store'>, at: Scope, id: string, access: RefAccess = {}): { status: 'ready' | 'missing' | 'ambiguous' | 'denied'; locations: ScopedBinding[] } {
  return selectBinding(bindingLayers(r, at, access), id, true)
}

const occurrences = new WeakMap<FosStore, { root: string; paths: Map<string, Scope[]> }>()
/** Recover a unique evaluation occurrence by graph containment, never by a referenced UUID. */
export function nodeOccurrence(store: FosStore, cid: string): Scope | null {
  const root = rootTargetCid(store)
  let index = occurrences.get(store)
  if (index?.root !== root) {
    index = { root, paths: new Map() }
    const active = new Set<string>()
    let branches = false
    let budget = 20000
    const visit = (current: string, path: Scope) => {
      if (--budget < 0 || active.size > 128) throw new Error('Graph containment exceeds its traversal limit.')
      if (!store.table.has(current) || active.has(current)) return
      const paths = index!.paths.get(current) ?? []
      paths.push(path); index!.paths.set(current, paths)
      const node = content(store, current)
      const target = refValueCid(store, node)
      if (isBranchChoice(store, node) || target && store.table.has(target) && isBranchChoice(store, content(store, target))) branches = true
      if (isHandle(node) || isLibraryRef(store, node)) return
      active.add(current)
      for (const edge of valueContent(store, current).children) {
        if (!isRowEdge(store, edge) && !isMemberEdge(store, edge)) continue
        const child = identityCid(store, edge), id = store.table.get(child)?.data.alias?.id
        if (id) visit(child, [...path, id])
      }
      active.delete(current)
    }
    visit(root, [])
    // Branch selection can change without changing the immutable root.
    if (!branches) occurrences.set(store, index)
  }
  const paths = index.paths.get(cid)
  return paths?.length === 1 ? paths[0]! : null
}

/** Single braces declare inputs; double braces reference existing context. */
export function textRefExpressions(text: string): Array<{ source: string; start: number; end: number; declaration: boolean }> {
  return [...text.matchAll(/(?<![\\{@])\{(\{)?\s*([^{}]+?)\s*\}(\})?/g)].flatMap(match => {
    if (!!match[1] !== !!match[3]) return []
    try { parseRefExpression(match[2]!); return [{ source: match[2]!, start: match.index!, end: match.index! + match[0].length, declaration: !match[1] }] } catch { return [] }
  })
}
