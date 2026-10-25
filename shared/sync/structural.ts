/** Patterns are graphs. Required rows are products; choices are sums. */
import { primitive, primitiveName } from './primitives'
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, isBookkeepingEdge, isBranchChoice, isChoiceEdge, isHandle, isRefNode, put, readChoice, refValueCid } from './graph'
import { plainEdge } from './patterns'

/** A named ref constructor is itself a graph value, usable on either side of a row. */
export function namedRefPattern(store: FosStore, title: string): string {
  const empty = put(store, { data: {}, children: [] })
  const titleKey = put(store, { data: { description: { content: 'title' } }, children: [] })
  const titleValue = put(store, { data: { scalar: { type: 'text', value: title } }, children: [] })
  return put(store, { data: {}, children: [[primitive(store, 'alias'), empty], [titleKey, titleValue]] })
}

const incidental = new Set(['alias', 'created', 'updated', 'position', 'presentation', 'parameter', 'capabilityDefinition', 'triggerDefinition'])
function properties(pattern: unknown, value: unknown): boolean {
  if (pattern === null || typeof pattern !== 'object') return Object.is(pattern, value)
  if (!value || typeof value !== 'object' || Array.isArray(pattern) !== Array.isArray(value)) return false
  return Object.entries(pattern).every(([key, expected]) => Object.hasOwn(value, key) && properties(expected, (value as Record<string, unknown>)[key]))
}

/** A constructor's name row: a string for people and the library's field index, never part of what a value must be. */
export function isNameRow(store: FosStore, edge: FosPathElem): boolean { return edge[0] === primitive(store, 'name') }

/**
 * A tag row `[node, unit]`: a node (a capability) on the left and the empty unit on the right. What a value is tagged
 * with is told by the node's identity alone; nothing in it is read as text.
 */
export function isTagRow(store: FosStore, edge: FosPathElem): boolean {
  const left = store.table.get(edge[0]), right = store.table.get(edge[1])
  return !!left?.data.capabilityDefinition && !!right && !Object.keys(right.data).length && !right.children.length
}
export function unit(store: FosStore): string { return put(store, { data: {}, children: [] }) }
export function tag(store: FosStore, node: string): FosPathElem { return [node, unit(store)] }

/**
 * A pattern's classifying rows say which way its value goes (a `negative` parameter) and, on a capability pattern
 * (whose identity its tag carries), what it is called; they are not structure a value has to witness. A form's name
 * row stays a literal of the form. Everything else a pattern's rows say, a value of it carries.
 */
export function isClassifyingRow(store: FosStore, edge: FosPathElem, pattern?: FosNodeContent): boolean {
  return !!store.table.get(edge[0])?.data.parameterDefinition || (!!pattern?.data.capabilityDefinition && isNameRow(store, edge))
}

/** Whether a pattern constrains values at all: data of its own, or rows beyond its classifying ones. A bare capability does not. */
export function patternHasStructure(store: FosStore, pattern: string): boolean {
  const node = store.table.get(pattern)
  if (!node) return false
  if (Object.keys(node.data).some(name => !incidental.has(name) && name !== 'form' && name !== 'name' && name !== 'description')) return true
  return node.children.some(edge => !isBookkeepingEdge(store, edge) && !isClassifyingRow(store, edge, node) && !isKindRow(store, edge))
}
/**
 * A pattern's kind rows: what makes a value one of its kind rather than a constraint on the value's content. Its tags
 * (`[capability, unit]`: which capability it is a value of, which contract checks it), its slots (a named ref on the
 * left: the argument its rows take) and its declared inputs (a ref on the right). A value of the pattern carries them;
 * a refinement (an amount, an option, a row the value must contain) does not count.
 */
export function isKindRow(store: FosStore, edge: FosPathElem): boolean {
  if (isTagRow(store, edge)) return true
  const left = store.table.get(edge[0]), right = store.table.get(edge[1])
  return (!!left && isRefNode(store, left)) || (!!right && isRefNode(store, right))
}
/** The capabilities a pattern or value is tagged with, by node. */
export function tagsOf(store: FosStore, node: FosNodeContent): string[] { return node.children.filter(edge => isTagRow(store, edge)).map(([left]) => left) }
/**
 * A value of `pattern`: it carries the pattern's kind rows besides its own content, except contract tags (`contracts`),
 * which only the contract's handler puts on a value.
 */
export function valueOfPattern(store: FosStore, pattern: string, data: FosNodeContent['data'], rows: FosPathElem[] = [], contracts: string[] = []): string {
  const node = store.table.get(pattern)
  const kind = node?.children.filter(edge => isKindRow(store, edge) && !isClassifyingRow(store, edge, node) && !(isTagRow(store, edge) && contracts.includes(edge[0]))) ?? []
  // a bare capability carries no tag of its own; its values are tagged with it
  const own: FosPathElem[] = node?.data.capabilityDefinition && !tagsOf(store, node).length ? [tag(store, pattern)] : []
  return put(store, { data, children: [...own, ...kind, ...rows] })
}

/** What a match bound: each named hole (a compiled placeholder) to the value it met. */
export type Bindings = ReadonlyMap<string, string>
/** A match: what its named holes bound, and what its anonymous holes (unit) met, in order. */
export type Match = { bindings: Bindings; fillers: string[] }
type MatchOptions = { side?: 'left' | 'right'; allowHoles?: boolean; bindings?: Bindings }

/** The leaf values the value primitives accept. */
const leaves: Record<string, (scalar: NonNullable<FosNodeContent['data']['scalar']> | undefined) => boolean> = {
  string: scalar => typeof scalar?.value === 'string',
  number: scalar => typeof scalar?.value === 'number',
  boolean: scalar => typeof scalar?.value === 'boolean'
}

/**
 * Match `value` against `pattern`. Every row of the pattern needs its own witness row in the value (extra rows are fine):
 * the lefts match as fields (recursively, so a parameterized field matches its constructor) and the rights as values.
 * The empty node (unit) is a hole: it matches anything and yields what it met. A compiled placeholder is a named hole,
 * bound once. Void matches nothing. A ref is read as its current value (fields on the left are compared as they are).
 * A choice is a sum: a pattern choice matches when one of its options does, a value choice when every option does.
 * A primitive checks the leaf value; a filled leaf must be the same. Null when the value does not match.
 */
export function match(store: FosStore, pattern: string, value: string, options: MatchOptions = {}): Match | null {
  let remaining = 20000
  const active = new Set<string>()
  const bookkeeping = (edge: FosPathElem) => isBookkeepingEdge(store, edge) || edge[0] === primitive(store, 'target') || edge[0] === primitive(store, 'instruction')
  const rows = (node: FosNodeContent) => node.children.filter(edge => !bookkeeping(edge))
  const alternatives = (edge: FosPathElem): FosPathElem[] => {
    edge = plainEdge(store, edge)
    return isChoiceEdge(store, edge) && isBranchChoice(store, content(store, edge[1]))
      ? readChoice(store, edge[1]).options.flatMap(option => option.edge ? alternatives(option.edge) : []) : [edge]
  }
  const options_ = (cid: string) => readChoice(store, cid).options.flatMap(option => option.edge ? [option.edge[1]] : [])
  const go = (p: string, v: string, key: boolean, depth: number, state: Match): Match | null => {
    if (--remaining < 0 || depth > 128) return null
    if (p === v) return state
    const P = store.table.get(p), V = store.table.get(v)
    if (!P || !V || isHandle(V)) return null
    if (p === primitive(store, 'void')) return null
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
      const required = Object.fromEntries(Object.entries(P.data).filter(([name]) => name !== 'scalar' && !incidental.has(name) && name !== 'form' && !((P.data.capabilityDefinition || P.data.form) && ['name', 'description'].includes(name))))
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
