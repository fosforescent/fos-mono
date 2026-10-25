/** Patterns are graphs. Required rows are products; choices are sums. */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, isBookkeepingEdge, isBranchChoice, isChoiceEdge, isHandle, isRefNode, put, readChoice, refValueCid } from './graph'
import { plainEdge } from './patterns'
import { primitiveOf } from './parameters'

/** A named ref constructor is itself a graph value, usable on either side of a row. */
export function namedRefPattern(store: FosStore, title: string): string {
  const empty = put(store, { data: {}, children: [] })
  const titleKey = put(store, { data: { description: { content: 'title' } }, children: [] })
  const titleValue = put(store, { data: { scalar: { type: 'text', value: title } }, children: [] })
  return put(store, { data: {}, children: [[store.primitive.aliasConstructor.getId(), empty], [titleKey, titleValue]] })
}

const incidental = new Set(['alias', 'created', 'updated', 'position', 'presentation', 'parameter', 'capabilityDefinition', 'triggerDefinition'])
function properties(pattern: unknown, value: unknown): boolean {
  if (pattern === null || typeof pattern !== 'object') return Object.is(pattern, value)
  if (!value || typeof value !== 'object' || Array.isArray(pattern) !== Array.isArray(value)) return false
  return Object.entries(pattern).every(([key, expected]) => Object.hasOwn(value, key) && properties(expected, (value as Record<string, unknown>)[key]))
}

/** A constructor's name row: a string for people and the library's field index, never part of what a value must be. */
export function isNameRow(store: FosStore, edge: FosPathElem): boolean { return edge[0] === store.primitive.nameField.getId() }

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

export function matchesGraph(store: FosStore, pattern: string, value: string, options: { allowHoles?: boolean; side?: 'left' | 'right' } = {}): boolean {
  const active = new Set<string>(), memo = new Map<string, boolean>()
  let remaining = 20000
  const rows = (node: FosNodeContent, classified = false) => node.children.filter(edge => !isBookkeepingEdge(store, edge) &&
    edge[0] !== store.primitive.targetPointerConstructor.getId() && edge[0] !== store.primitive.instructionPointerConstructor.getId() &&
    !(classified && isClassifyingRow(store, edge, node)))
  const alternatives = (edge: FosPathElem): FosPathElem[] => {
    edge = plainEdge(store, edge)
    return isChoiceEdge(store, edge) && isBranchChoice(store, content(store, edge[1]))
      ? readChoice(store, edge[1]).options.flatMap(option => option.edge ? alternatives(option.edge) : []) : [edge]
  }
  const edgeMatches = (expected: FosPathElem, actual: FosPathElem, depth: number): boolean => {
    const choices = alternatives(expected), candidates = alternatives(actual)
    return !!candidates.length && candidates.every(candidate => choices.some(option =>
      match(option[0], candidate[0], true, depth + 1) && match(option[1], candidate[1], false, depth + 1)))
  }
  const branchValue = (edge: FosPathElem, node: FosNodeContent): string => {
    const right = content(store, edge[1])
    return isRefNode(store, right) && !refValueCid(store, right) && right.data.alias?.id === node.data.alias?.id ? edge[0] : edge[1]
  }
  const match = (expected: string, actual: string, key: boolean, depth: number): boolean => {
    if (--remaining < 0 || depth > 128) return false
    const p = store.table.get(expected), v = store.table.get(actual)
    if (!p || !v || isHandle(v)) return false
    const cacheKey = `${expected}/${actual}/${key}`
    if (memo.has(cacheKey)) return memo.get(cacheKey)!
    if (active.has(cacheKey)) return false
    active.add(cacheKey)
    const evaluate = (): boolean => {
      // Dereference before distributing sums: each actual alternative may use
      // a different branch of the expected pattern.
      if (!key) {
        const target = refValueCid(store, v)
        if (target) return match(expected, target, false, depth + 1)
        const patternTarget = refValueCid(store, p)
        if (patternTarget) return match(patternTarget, actual, false, depth + 1)
        // Partial assignments can retain UUID holes on the right. This is
        // compatibility, not proof of a complete executable input.
        if (options.allowHoles && v.data.alias && isRefNode(store, v) && rows(v).every(edge => edge[0] === store.primitive.aliasConstructor.getId())) return true
      }
      if (isBranchChoice(store, v)) {
        const options = readChoice(store, actual).options
        return !!options.length && options.every(option => !!option.edge && match(expected, branchValue(option.edge, v), key, depth + 1))
      }
      if (isBranchChoice(store, p)) return readChoice(store, expected).options.some(option => !!option.edge && match(branchValue(option.edge, p), actual, key, depth + 1))
      if (v.data.refAlternatives) return v.children.length > 0 && v.children.every(([, value]) => match(expected, value, key, depth + 1))
      // the alternatives of a sum are its option rows; its kind rows (its tag) are not options
      if (p.data.refAlternatives) return rows(p, !key).filter(edge => !isKindRow(store, edge)).some(([, value]) => match(value, actual, key, depth + 1))
      if (key && p.data.form?.primitive && p.data.form.primitive !== v.data.form?.primitive) return false
      if (!key) {
        // A capability is identified by its node: a value of it carries the tag [capability, unit]. A bare capability
        // pattern (one without tags of its own) therefore requires that tag; a refinement carries the tag as a row.
        const bare = p.data.capabilityDefinition && !tagsOf(store, p).length && !p.children.some(edge => store.table.get(edge[0])?.data.parameterDefinition)
        if (bare && expected !== actual && !tagsOf(store, v).includes(expected)) return false
        if (isRefNode(store, p) && rows(p).every(edge => edge[0] === store.primitive.aliasConstructor.getId())) return true
        if (p.data.parameter) return true
        // A template is graph content to instantiate; it imposes no leaf predicate.
        if (expected === store.primitive.templateField.getId()) return true
        // A node with a `primitive` parameter row holds that native value; its other parameters (negative, …) say
        // which way it goes, not what it is.
        const primitive = primitiveOf(store, expected)
        if (primitive) return match(primitive, actual, false, depth + 1)
        // Native scalar constructors check the leaf value, never a declared type.
        const scalar = p.data.form?.primitive
        const text = [store.primitive.documentField.getId(), store.primitive.labelField.getId()].includes(expected)
        if (scalar || text) {
          const leaf = v.data.scalar ? v.data.scalar.value : v.data.description?.content
          return scalar === 'null' ? leaf === null : typeof leaf === (scalar === 'number' || scalar === 'time' ? 'number' : scalar === 'boolean' ? 'boolean' : 'string')
        }
      }
      const required = Object.fromEntries(Object.entries(p.data).filter(([name]) => !incidental.has(name) && name !== 'form' && !((p.data.capabilityDefinition || p.data.form) && ['name', 'description'].includes(name))))
      if (!properties(required, v.data)) return false
      // On the value side the pattern's classifying rows (its name, its polarity) are not structure the value needs.
      const wanted = rows(p, !key), available = rows(v), used = new Set<number>()
      // Each required row needs a witness in one product. Alternatives never
      // contribute separate pieces to a synthetic combined value.
      const assign = (index: number): boolean => index === wanted.length || available.some((row, i) => {
        if (used.has(i) || !edgeMatches(wanted[index]!, row, depth)) return false
        used.add(i); const ok = assign(index + 1); used.delete(i); return ok
      })
      return assign(0)
    }
    try { const result = evaluate(); memo.set(cacheKey, result); return result } finally { active.delete(cacheKey) }
  }
  return match(pattern, value, options.side === 'left', 0)
}
