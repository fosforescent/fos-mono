/** Property paths and their parenthesized spelling share one small, serializable grammar. */
import type { FosStore } from '../dag-implementation/store'
import { content, advertisedRows, enclosingScopes, identityCid, isBranchChoice, isRowEdge, isMemberEdge, isGrantEdge, refValueCid, selectedBranchValue, type Scope } from './graph'
import { headCid, type Replica } from './replica'

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
export type RefAccess = { canRead?(store: FosStore, cid: string, path: Scope): boolean }
export type RefLocation = { store: FosStore; cid: string; path: Scope; pattern?: string }
export type RefPathResult = { status: 'ready' | 'missing' | 'ambiguous' | 'denied' | 'cycle'; locations: RefLocation[]; message?: string }

/** Resolve only actual properties, never descendants or peers elsewhere in the graph. */
export function resolveRefExpression(r: Replica, at: Scope, expression: string | RefExpression, access: RefAccess = {}): RefPathResult {
  const parsed = typeof expression === 'string' ? parseRefExpression(expression) : expression
  const scopes = enclosingScopes(r.store, headCid(r), at).slice(parsed.up)
  if (!scopes.length) return { status: 'missing', locations: [], message: 'Ref path climbs beyond the available scope.' }
  let failure: RefPathResult['status'] = 'missing'
  const properties = (location: RefLocation, name: string): RefLocation[] => {
    const { store, path } = location
    let cid = location.cid
    const seen = new Set<string>()
    while (true) {
      if (access.canRead && !access.canRead(store, cid, path)) { failure = 'denied'; return [] }
      if (!store.table.has(cid)) return []
      if (seen.has(cid) || seen.size >= 128) { failure = 'cycle'; return [] }
      seen.add(cid)
      const node = content(store, cid)
      // Remote snapshots never confer permission to follow a peer's private graph.
      if (node.data.ref?.peer || node.data.ref?.owner) return []
      const target = isBranchChoice(store, node) ? selectedBranchValue(store, cid) : refValueCid(store, node)
      const matches = node.children.flatMap(edge => isGrantEdge(store, edge) ? advertisedRows(store, edge[1]) : [edge]).flatMap(edge => {
        if (!store.table.has(edge[1])) return []
        const childCid = identityCid(store, edge), child = content(store, childCid)
        if (!(isRowEdge(store, edge) || isMemberEdge(store, edge) || isGrantEdge(store, edge))) return []
        const rowName = child.data.name?.content ?? content(store, refValueCid(store, child) ?? childCid).data.name?.content
        if (child.data.alias?.id !== name && rowName !== name && child.data.peerId?.content !== name) return []
        const childPath = [...path, child.data.alias?.id ?? name]
        if (access.canRead && !access.canRead(store, childCid, childPath)) { failure = 'denied'; return [] }
        return [{ store, cid: childCid, path: childPath, pattern: edge[0] }]
      })
      if (matches.length) return matches
      if (target) { cid = target; continue }
      return []
    }
  }
  if (!parsed.path.length) {
    const scope = scopes[0]!, location = { store: scope.store, cid: scope.cid, path: scope.path }
    return access.canRead && !access.canRead(location.store, location.cid, location.path) ? { status: 'denied', locations: [] } : { status: 'ready', locations: [location] }
  }
  let locations: RefLocation[] = []
  for (const scope of parsed.lexical ? scopes : scopes.slice(0, 1)) {
    locations = properties(scope, parsed.path[0]!)
    if (locations.length || (failure as string) === 'denied' || (failure as string) === 'cycle') break
  }
  for (const name of parsed.path.slice(1)) locations = locations.flatMap(location => properties(location, name))
  return { status: locations.length === 1 ? 'ready' : locations.length > 1 ? 'ambiguous' : failure, locations }
}

/** UUID links name declarations anywhere in the accessible local tree, unlike property paths. */
export function resolveRefIdentity(r: Replica, at: Scope, id: string, access: RefAccess = {}): RefPathResult {
  const roots = new Map<FosStore, RefLocation>()
  for (const scope of enclosingScopes(r.store, headCid(r), at)) roots.set(scope.store, scope)
  let budget = 20000, denied = false, cycle = false
  for (const root of roots.values()) {
    const locations: RefLocation[] = [], active = new Set<string>()
    const walk = (location: RefLocation, depth = 0): void => {
      const { store, cid, path } = location
      if (--budget < 0 || depth > 128 || active.has(cid)) { cycle = true; return }
      if (access.canRead && !access.canRead(store, cid, path)) { denied = true; return }
      if (!store.table.has(cid)) return
      const node = content(store, cid)
      if (node.data.ref?.owner || node.data.ref?.peer) return
      if (node.data.alias?.id === id) {
        if (!locations.some(found => found.cid === cid && JSON.stringify(found.path) === JSON.stringify(path))) locations.push(location)
        return
      }
      active.add(cid)
      try {
        const target = isBranchChoice(store, node) ? selectedBranchValue(store, cid) : refValueCid(store, node)
        if (target) walk({ ...location, cid: target }, depth + 1)
        for (const edge of node.children.flatMap(edge => isGrantEdge(store, edge) ? advertisedRows(store, edge[1]) : [edge])) {
          if (!store.table.has(edge[1])) continue
          const childCid = identityCid(store, edge), child = content(store, childCid)
          if (!(isRowEdge(store, edge) || isMemberEdge(store, edge) || isGrantEdge(store, edge)) || !child.data.alias) continue
          walk({ store, cid: childCid, path: [...path, child.data.alias.id], pattern: edge[0] }, depth + 1)
        }
      } finally { active.delete(cid) }
    }
    walk(root)
    if (locations.length) return { status: locations.length === 1 ? 'ready' : 'ambiguous', locations }
  }
  return { status: cycle ? 'cycle' : denied ? 'denied' : 'missing', locations: [] }
}

/** Single braces declare inputs; double braces reference existing context. */
export function textRefExpressions(text: string): Array<{ source: string; start: number; end: number; declaration: boolean }> {
  return [...text.matchAll(/(?<![\\{@])\{(\{)?\s*([^{}]+?)\s*\}(\})?/g)].flatMap(match => {
    if (!!match[1] !== !!match[3]) return []
    try { parseRefExpression(match[2]!); return [{ source: match[2]!, start: match.index!, end: match.index! + match[0].length, declaration: !match[1] }] } catch { return [] }
  })
}
