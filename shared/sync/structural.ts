/** Patterns are graphs. Required rows are products; choices are sums. */
import { primitive, primitiveName } from './primitives'
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, isBookkeepingEdge, isBranchChoice, isChoiceEdge, isHandle, isRefNode, libraryNode, put, readChoice, refValueCid, typeIdOf } from './graph'

const incidental = new Set(['alias', 'created', 'updated', 'position', 'presentation'])
function properties(pattern: unknown, value: unknown): boolean {
  if (pattern === null || typeof pattern !== 'object') return Object.is(pattern, value)
  if (!value || typeof value !== 'object' || Array.isArray(pattern) !== Array.isArray(value)) return false
  return Object.entries(pattern).every(([key, expected]) => Object.hasOwn(value, key) && properties(expected, (value as Record<string, unknown>)[key]))
}

/** A constructor's name row: a string for people and the library's field index, never part of what a value must be. */
export function isNameRow(store: FosStore, edge: FosPathElem): boolean { return edge[0] === primitive(store, 'name') }

const isUnit = (node: FosNodeContent | undefined): boolean => !!node && !Object.keys(node.data).length && !node.children.length
/** The name a tag node carries (`tag<"mail">`: the field constructor named tag with its alias filled), or null. */
export function tagName(store: FosStore, cid: string): string | null {
  const rows = store.table.get(cid)?.children ?? []
  if (!rows.some(([left, right]) => left === primitive(store, 'name') && store.table.get(right)?.data.scalar?.value === 'tag')) return null
  for (const [left, right] of rows) {
    const scalar = store.table.get(right)?.data.scalar
    if (left !== primitive(store, 'name') && isRefNode(store, content(store, left)) && scalar?.type === 'text' && typeof scalar.value === 'string') return scalar.value
  }
  return null
}
/** A tag of `name`: the library's tag constructor with its alias filled; the same node the library's tagged types carry. */
export function tagNode(store: FosStore, name: string): string {
  const constructor = libraryNode(store, 'tag')
  if (!constructor) throw new Error('The library in this scope has no tag constructor.')
  const text = put(store, { data: { scalar: { type: 'text', value: name } }, children: [] })
  return put(store, { data: {}, children: content(store, constructor).children.map(([left, right]): FosPathElem => right === primitive(store, 'string') ? [left, text] : [left, right]) })
}
/**
 * The capability a pattern is (or refines): the name of the tag it carries. The library's own types are tagged too
 * (Home, a query): those are row types, not capabilities.
 */
export function capabilityName(store: FosStore, cid: string): string | null {
  const type = typeIdOf(store, cid)
  if (type && !type.startsWith('capabilities.')) return null
  for (const [left, right] of store.table.get(cid)?.children ?? []) {
    if (!isUnit(store.table.get(right))) continue
    const name = tagName(store, left)
    if (name) return name
  }
  return null
}

/**
 * A pin `[capability, unit]`: a capability on the left of a value's row, the empty unit on the right. It ties a value
 * to the capability whose handler checks it (a grant to its allocate contract); told by the node's identity alone.
 */
export function isTagRow(store: FosStore, edge: FosPathElem): boolean {
  return isUnit(store.table.get(edge[1])) && capabilityName(store, edge[0]) !== null
}
/** Whether a declaration `[pattern, ref]` is the row's to fill (an output) rather than an operand it needs first: a capability pattern, which its handler fills. */
export function isOutputDeclaration(store: FosStore, pattern: string): boolean { return capabilityName(store, pattern) !== null }
export function unit(store: FosStore): string { return put(store, { data: {}, children: [] }) }
export function tag(store: FosStore, node: string): FosPathElem { return [node, unit(store)] }
/** The capabilities a value is pinned to, by node. */
export function tagsOf(store: FosStore, node: FosNodeContent): string[] { return node.children.filter(edge => isTagRow(store, edge)).map(([left]) => left) }
/**
 * A value of `pattern`: it carries the pattern's rows (its tag, inputs and refinements) besides its own, except the pins
 * in `contracts`, which only the contract's handler puts on a value.
 */
export function valueOfPattern(store: FosStore, pattern: string, data: FosNodeContent['data'], rows: FosPathElem[] = [], contracts: string[] = []): string {
  const carried = (store.table.get(pattern)?.children ?? []).filter(edge => !isBookkeepingEdge(store, edge) && !(isTagRow(store, edge) && contracts.includes(edge[0])))
  return put(store, { data, children: [...carried, ...rows] })
}

/** What a match bound: each named hole (a compiled placeholder) to the value it met. */
export type Bindings = ReadonlyMap<string, string>
/** A match: what its named holes bound, and what its anonymous holes (unit) met, in order. */
export type Match = { bindings: Bindings; fillers: string[] }
type MatchOptions = { side?: 'left' | 'right'; allowHoles?: boolean; bindings?: Bindings }

/** Whether `cid` is void or holds it somewhere in its rows or ref values: an open hole, not yet a value. */
const openCache = new WeakMap<FosStore, Map<string, boolean>>()
export function hasOpenHole(store: FosStore, cid: string): boolean {
  let cache = openCache.get(store)
  if (!cache) openCache.set(store, cache = new Map())
  const never = primitive(store, 'void')
  const visit = (at: string, seen: Set<string>): boolean => {
    if (at === never) return true
    const known = cache!.get(at)
    if (known !== undefined) return known
    if (seen.has(at)) return false
    seen.add(at)
    const node = store.table.get(at)
    const open = !!node && node.children.some(edge => !isBookkeepingEdge(store, edge) && edge[0] !== primitive(store, 'instruction') && visit(edge[1], seen))
    cache!.set(at, open)
    return open
  }
  return visit(cid, new Set())
}

/** The leaf values the value primitives accept. */
const leaves: Record<string, (scalar: NonNullable<FosNodeContent['data']['scalar']> | undefined) => boolean> = {
  string: scalar => typeof scalar?.value === 'string',
  number: scalar => typeof scalar?.value === 'number',
  boolean: scalar => typeof scalar?.value === 'boolean'
}

/**
 * Match `value` against `pattern`. Every row of the pattern needs its own witness row in the value (extra rows are fine):
 * the lefts match as fields (recursively, so a parameterized field matches its constructor) and the rights as values.
 * The empty node (unit) is the wildcard: it matches anything and yields what it met. A compiled placeholder (a ref in
 * the pattern) is a named hole, bound once. Void is uninhabited: as a pattern it requires something supplied (any value
 * but void); as a value it is an open hole (a ref whose value is still void), which only the wildcard accepts unless
 * `allowHoles` (a partial check). A ref is read as its current value (fields on the left are compared as they are).
 * A choice is a sum: a pattern choice matches when one of its options does, a value choice when every option does.
 * A primitive checks the leaf value; a filled leaf must be the same. Null when the value does not match.
 */
export function match(store: FosStore, pattern: string, value: string, options: MatchOptions = {}): Match | null {
  let remaining = 20000
  const active = new Set<string>()
  const bookkeeping = (edge: FosPathElem) => isBookkeepingEdge(store, edge) || edge[0] === primitive(store, 'target') || edge[0] === primitive(store, 'instruction')
  const rows = (node: FosNodeContent) => node.children.filter(edge => !bookkeeping(edge))
  const alternatives = (edge: FosPathElem): FosPathElem[] => {
    edge = edge
    return isChoiceEdge(store, edge) && isBranchChoice(store, content(store, edge[1]))
      ? readChoice(store, edge[1]).options.flatMap(option => option.edge ? alternatives(option.edge) : []) : [edge]
  }
  const options_ = (cid: string) => readChoice(store, cid).options.flatMap(option => option.edge ? [option.edge[1]] : [])
  const go = (p: string, v: string, key: boolean, depth: number, state: Match): Match | null => {
    if (--remaining < 0 || depth > 128) return null
    const never = primitive(store, 'void')
    if (p === v && (options.allowHoles || !hasOpenHole(store, v))) return state
    const P = store.table.get(p), V = store.table.get(v)
    if (!P || !V || isHandle(V)) return null
    if (!Object.keys(P.data).length && !P.children.length) return { bindings: state.bindings, fillers: [...state.fillers, v] }
    if (P.data.refHole) {
      const bound = state.bindings.get(p)
      if (bound) return bound === v || (go(bound, v, key, depth + 1, state) && go(v, bound, key, depth + 1, state)) ? state : null
      return { bindings: new Map(state.bindings).set(p, v), fillers: state.fillers }
    }
    if (V.data.refHole) return null
    const visit = `${p}/${v}/${key}`
    if (active.has(visit)) return null
    active.add(visit)
    try {
      if (!key && isRefNode(store, V)) {
        const target = refValueCid(store, V)
        if (target) return go(p, target, key, depth + 1, state)
        if (options.allowHoles) return state
      }
      if (!key && isRefNode(store, P)) {
        const target = refValueCid(store, P)
        if (target) return go(target, v, key, depth + 1, state)
      }
      if (v === never) return options.allowHoles ? state : null
      if (p === never) return state
      if (isBranchChoice(store, V)) {
        const all = options_(v)
        let current: Match | null = all.length ? state : null
        for (const option of all) if (current) current = go(p, option, key, depth + 1, current)
        return current
      }
      if (isBranchChoice(store, P)) {
        for (const option of options_(p)) { const found = go(option, v, key, depth + 1, state); if (found) return found }
        return null
      }
      const leaf = primitiveName(store, p)
      if (leaf && leaves[leaf]) return leaves[leaf](V.data.scalar) ? state : null
      if (P.data.scalar && !(V.data.scalar && V.data.scalar.type === P.data.scalar.type && Object.is(V.data.scalar.value, P.data.scalar.value))) return null
      const required = Object.fromEntries(Object.entries(P.data).filter(([name]) => name !== 'scalar' && !incidental.has(name)))
      if (!properties(required, V.data)) return null
      const wanted = rows(P), available = rows(V), used = new Set<number>()
      const assign = (index: number, current: Match): Match | null => {
        if (index === wanted.length) return current
        for (const option of alternatives(wanted[index]!)) {
          for (let i = 0; i < available.length; i++) {
            if (used.has(i)) continue
            for (const candidate of alternatives(available[i]!)) {
              const left = go(option[0], candidate[0], true, depth + 1, current)
              const right = left && go(option[1], candidate[1], false, depth + 1, left)
              if (!right) continue
              used.add(i)
              const done = assign(index + 1, right)
              used.delete(i)
              if (done) return done
            }
          }
        }
        return null
      }
      return assign(0, state)
    } finally { active.delete(visit) }
  }
  return go(pattern, value, options.side === 'left', 0, { bindings: options.bindings ?? new Map(), fillers: [] })
}

export function matchesGraph(store: FosStore, pattern: string, value: string, options: MatchOptions = {}): boolean {
  return match(store, pattern, value, options) !== null
}

/** A query: the nodes among `candidates` (every node in the store by default) that `pattern` matches. */
export function query(store: FosStore, pattern: string, candidates: Iterable<string> = store.table.keys()): string[] {
  return [...candidates].filter(cid => cid !== pattern && match(store, pattern, cid) !== null)
}
