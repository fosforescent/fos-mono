/** Property paths and their parenthesized spelling share one small, serializable grammar. */
import type { FosStore } from '../dag-implementation/store'
import { content, advertisedRows, enclosingScopes, lookupInScope, identityCid, rowTypeOf, isBranchChoice, isLibraryInstance, isHandle, isLibraryRef, rootTargetCid, valueContent, isRowEdge, isMemberEdge, memberPeerOf, isGrantEdge, refValueCid, selectedBranchValue, type Scope } from './graph'
import { fieldNode } from '../library-names'
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
export type RefLocation = { store: FosStore; cid: string; path: Scope; pattern?: string; libraryField?: true }
export type RefPathResult = { status: 'ready' | 'missing' | 'ambiguous' | 'denied' | 'cycle'; locations: RefLocation[]; message?: string }

/** Resolve only actual properties, never descendants or peers elsewhere in the graph. */
export function resolveRefExpression(r: Pick<Replica, 'store'>, at: Scope, expression: string | RefExpression, access: RefAccess = {}): RefPathResult {
  return resolvePath(r, at, typeof expression === 'string' ? parseRefExpression(expression) : expression, access)
}

function resolvePath(r: Pick<Replica, 'store'>, at: Scope, parsed: RefExpression, access: RefAccess, identity = false): RefPathResult {
  const scopes = enclosingScopes(r.store, headCid(r), at).slice(parsed.up)
  if (!scopes.length) return { status: 'missing', locations: [], message: 'Ref path climbs beyond the available scope.' }
  let failure: RefPathResult['status'] = 'missing'
  const properties = (location: RefLocation, name: string): RefLocation[] => {
    const { store, path } = location
    const instance = store.table.get(location.cid)
    const libraryField = location.libraryField || !!instance && isLibraryInstance(store, instance)
    let cid = instance && isLibraryInstance(store, instance) && location.pattern ? location.pattern : location.cid
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
        if (identity ? child.data.alias?.id !== name : child.data.alias?.id !== name && rowName !== name && (isMemberEdge(store, edge) ? memberPeerOf(store, edge) : child.data.peerId?.content) !== name) return []
        const childPath = [...path, child.data.alias?.id ?? name]
        if (access.canRead && !access.canRead(store, childCid, childPath)) { failure = 'denied'; return [] }
        const field = libraryField
          ? fieldNode(id => store.table.get(id), edge, store.primitive.targetPointerConstructor.getId(), store.primitive.aliasConstructor.getId()) : null
        return [{ store, cid: field?.node ?? childCid, path: childPath, pattern: rowTypeOf(store, edge) ?? edge[0], ...(libraryField ? { libraryField: true as const } : {}) }]
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
  // the first name is a lexical lookup (or a property of the scope `up` names): the shared scope rule decides it
  const first = lookupInScope<RefLocation>(parsed.lexical ? scopes : scopes.slice(0, 1), scope => {
    const found = properties(scope, parsed.path[0]!)
    return failure === 'denied' || failure === 'cycle' ? null : found
  })
  if (first.status === 'ambiguous') return { status: 'ambiguous', locations: first.values }
  let locations: RefLocation[] = first.status === 'ready' ? [first.value] : []
  for (const name of parsed.path.slice(1)) {
    locations = locations.flatMap(location => properties(location, name))
    const failed = failure as RefPathResult['status']
    if (failed === 'denied' || failed === 'cycle') return { status: failed, locations: [] }
    if (locations.length > 1) return { status: 'ambiguous', locations }
  }
  return { status: locations.length === 1 ? 'ready' : locations.length > 1 ? 'ambiguous' : failure, locations }
}

/** Identity and name lookup have the same lexical boundary. A cached sibling is not a declaration here. */
export function resolveRefIdentity(r: Pick<Replica, 'store'>, at: Scope, id: string, access: RefAccess = {}): RefPathResult {
  return resolvePath(r, at, { up: 0, path: [id], lexical: true }, access, true)
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
