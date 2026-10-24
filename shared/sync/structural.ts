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

export function matchesGraph(store: FosStore, pattern: string, value: string, options: { allowHoles?: boolean; side?: 'left' | 'right' } = {}): boolean {
  const active = new Set<string>(), memo = new Map<string, boolean>()
  let remaining = 20000
  const rows = (node: FosNodeContent) => node.children.filter(edge => !isBookkeepingEdge(store, edge) &&
    edge[0] !== store.primitive.targetPointerConstructor.getId() && edge[0] !== store.primitive.instructionPointerConstructor.getId())
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
      if (p.data.refAlternatives) return p.children.some(([, value]) => match(value, actual, key, depth + 1))
      if (key && p.data.form?.primitive && p.data.form.primitive !== v.data.form?.primitive) return false
      if (!key) {
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
      const wanted = rows(p), available = rows(v), used = new Set<number>()
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
