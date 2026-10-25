/** Shared, read-only resolution for data arguments and callable values. */
import { hostOf, primitive } from './primitives'
import { discoverHandlers, type HandlerEnvironment } from './handlers'
import { rowText } from './fields'
import type { FosStore } from '../dag-implementation/store'
import {
  isBranchChoice, selectedBranchValue, libraryTypeAt, type Capability, childRows, isRequirementRow, argumentSatisfied, content, isChoiceEdge, isRefNode, refValueCid,
  valueContent, importNodes, reachableNodes, type Scope
} from './graph'
import { type Replica } from './replica'
import { sameCapabilityType } from './capabilities'
import { bindingProperties, visibleBindings, bindingTree, bindingAvailable, bindingAssignments, submissionRef, type ScopedBinding } from './scope-bindings'
import { matchesGraph } from './structural'
import { patternIsValuePredicate } from './scoped-refs'
import { parseRefExpression, resolveRefExpression, resolveRefIdentity, nodeOccurrence, textRefExpressions, type RefAccess } from './ref-paths'

export type BindingEnvironment = HandlerEnvironment & RefAccess & {
  scope?: { replica: Replica; path: Scope }
  /** Discovery reads callable values without invoking their bodies. Invocation must check their dependencies. */
  checkDependencies?: boolean
}

type BindingScope = { store: FosStore; path: Scope }
export type BindingCandidate = { cid: string; type: string; name?: string; refIds?: string[]; scope?: BindingScope; binding?: ScopedBinding }
export type BindingResolution = {
  status: 'ready' | 'missing' | 'ambiguous' | 'conflict' | 'cycle'
  cid?: string
  /** The selected declaration survives explicit forwarding; equal literal values do not establish ref identity. */
  binding?: ScopedBinding
  /** References consulted, including both sides of an incompatible equality. */
  sources: string[]
  problems: string[]
}
/** The node's declarations as binding candidates: named ones bind by name, the others only as explicit arguments. */
export function argumentRefs(store: FosStore, cid: string): BindingCandidate[] {
  return bindingProperties({ store, cid, path: nodeOccurrence(store, cid) ?? [] }).bindings.filter(binding => binding.ambient)
    .map(binding => ({ cid: binding.cid, type: binding.pattern, binding, ...(binding.name ? { name: binding.name } : {}) }))
}

/** A presentation of shared scoped declarations, retaining the complete binding for all consumers. */
export function contextBindings(r: Replica, at: Scope, environment: BindingEnvironment = {}): BindingCandidate[] {
  return visibleBindings(r, at, environment).flatMap(binding => bindingTree(binding, environment)).flatMap(binding => {
    if (!bindingAvailable(binding)) return []
    const node = content(binding.store, binding.cid)
    if (!binding.submissions.length && !node.data.ref && !node.data.refExpression) return []
    const named = !!binding.name, name = binding.refPath.join('.')
    const targets = named || !binding.submissions.length ? [binding.cid] : binding.submissions.map(value => submissionRef(binding, value))
    return targets.map(cid => {
      if (binding.store !== r.store) importNodes(r.store, reachableNodes(binding.store, [cid, binding.pattern]))
      return { cid, type: binding.pattern, name, refIds: binding.refIds, scope: binding.scope, binding }
    })
  })
}

/** Explicit targets win. A caller may supply a value pattern; a row instruction is not implicitly a result predicate. */
export function resolveBinding(store: FosStore, type: string | null, target: string | ScopedBinding | null, candidates: BindingCandidate[] = [], name?: string, environment: BindingEnvironment = {}): BindingResolution {
  const sources = new Set<string>(), active = new Set<string>()
  const fail = (status: BindingResolution['status'], message: string): BindingResolution => ({ status, sources: [...sources], problems: [message] })
  // a candidate is selected by its value: a handler is a value of the capability it fills; a hole is no value to select
  const compatible = (_declared: string, wanted: string | null, cid: string): boolean => wanted !== null && matchesGraph(store, wanted, cid)
  const choose = (wanted: string | null, label?: string, excluded?: string, anonymous = false): BindingResolution => {
    const matches = [...new Set(candidates.filter(c => c.cid !== excluded && (!label || c.binding?.nameVisible !== false) &&
      // a declaration inside another ref is reached by its path, never selected by its type
      (label && c.name === label || compatible(c.type, wanted, c.cid) && (c.binding?.refPath.length ?? 1) <= 1 && (!label || anonymous && (!c.name || !!c.refIds)))).map(c => c.cid))]
    if (!matches.length) return fail('missing', `Missing binding${label ? `: ${label}` : ''}`)
    if (matches.length > 1) {
      matches.forEach(cid => sources.add(cid))
      if (label && matches.every(cid => candidates.some(c => c.cid === cid && c.name === label && !c.binding?.capability))) {
        const resolved = matches.map(cid => {
          const binding = candidates.find(candidate => candidate.cid === cid)?.binding
          return binding ? followDeclaration(binding, wanted) : follow(cid, wanted)
        })
        const blocked = resolved.find(value => value.status !== 'ready')
        if (blocked) return { ...blocked, sources: [...sources] }
        if (new Set(resolved.map(value => value.cid)).size === 1) return { ...resolved[0]!, sources: [...sources] }
        return fail('conflict', `Incompatible bindings for ${label}`)
      }
      return fail('ambiguous', `Choose a binding${label ? ` for ${label}` : ''}`)
    }
    const binding = candidates.find(candidate => candidate.cid === matches[0])?.binding
    return binding ? followDeclaration(binding, wanted) : follow(matches[0]!, wanted)
  }
  const followDeclaration = (binding: ScopedBinding, wanted: string | null): BindingResolution => {
    if (!bindingAvailable(binding)) return fail('missing', 'The reference is unavailable in this scope')
    const assignments = bindingAssignments(binding)
    if (!assignments.length) return fail('missing', 'The explicitly referenced declaration has no supplied value')
    const values = assignments.map(location => {
      if (location.store !== store) importNodes(store, reachableNodes(location.store, [location.cid]))
      return follow(location.cid, wanted, { store: location.store, path: location.path.slice(0, -1) }, true)
    })
    const blocked = values.find(value => value.status !== 'ready')
    if (blocked) return { ...blocked, sources: [...sources] }
    if (new Set(values.map(value => value.cid)).size !== 1) return fail('conflict', 'Incompatible bindings for the same reference')
    return { ...values[0]!, binding: values[0]!.binding ?? binding, sources: [...sources] }
  }
  const follow = (cid: string, wanted: string | null, inherited = candidates.find(candidate => candidate.cid === cid)?.scope ?? (environment.scope ? { store: environment.scope.replica.store, path: environment.scope.path } : undefined), explicit = false): BindingResolution => {
    // A row's instruction is not its value's predicate: a reference row's type (a library row type) imposes nothing on what it refers to.
    if (wanted && !patternIsValuePredicate(store, wanted)) wanted = null
    const declaration = !explicit && candidates.find(candidate => candidate.cid === cid)?.binding
    if (declaration && bindingAssignments(declaration).length) return followDeclaration(declaration, wanted)
    const occurrence = nodeOccurrence(store, cid)
    const scope: BindingScope | undefined = inherited ?? (occurrence ? { store, path: occurrence.slice(0, -1) } : undefined)
    if (environment.canRead && !environment.canRead(store, cid, scope?.path ?? [])) return fail('missing', 'The bound value is not accessible')
    sources.add(cid)
    if (!store.table.has(cid)) return fail('missing', 'The bound value is unavailable')
    if (active.has(cid) || active.size >= 100) return fail('cycle', 'Unresolved dependency cycle')
    active.add(cid)
    try {
      const node = content(store, cid)
      if (node.data.refExpression) {
        if (!scope) return fail('missing', 'Ref expression needs its lexical scope')
        const found = resolveRefExpression({ store: scope.store }, scope.path, node.data.refExpression, environment)
        if (found.status !== 'ready') return fail(found.status === 'denied' ? 'missing' : found.status, `Unresolved ref property: ${node.data.name?.content ?? node.data.alias?.id}`)
        const location = found.locations[0]!
        if ('assignments' in location) return followDeclaration(location as ScopedBinding, wanted)
        if (location.store !== store) importNodes(store, reachableNodes(location.store, [location.cid]))
        return follow(location.cid, wanted, { store: location.store, path: location.path.slice(0, -1) })
      }
      if (isBranchChoice(store, node)) { const selected = selectedBranchValue(store, cid); return selected ? follow(selected, wanted, scope) : fail('ambiguous', 'Choose one of the alternatives') }
      if (node.children.some(e => isChoiceEdge(store, e))) return fail('conflict', 'Resolve conflicting values first')
      if (node.data.ref) {
        if (node.data.ref.peer || node.data.ref.owner) return fail('missing', 'The remote reference needs a handler in this scope')
        if (!scope) return fail('missing', 'The reference needs its lexical scope')
        const found = resolveRefIdentity({ store: scope.store }, scope.path, node.data.ref.id, environment)
        if (found.status !== 'ready') return fail(found.status === 'ambiguous' ? 'ambiguous' : 'missing', 'The reference is unavailable in this scope')
        const location = found.locations[0]!
        // The reference row's pattern describes a reference, not the referenced value's constructor (as in compileRefGraph).
        return followDeclaration(location, null)
      }
      if (isRefNode(store, node)) {
        const targets = [...new Set(node.children.filter(e => e[0] === primitive(store, 'target')).map(e => e[1]))]
        if (!targets.length) return explicit ? fail('missing', 'The explicitly referenced declaration has no supplied value') : choose(wanted, node.data.name?.content, cid, true)
        // a ref row's value sees the declarations inside that row (an answer written inside a requirement), so it resolves from the row's own path
        const inner: BindingScope | undefined = occurrence ? { store, path: occurrence } : scope
        const values = targets.map(t => follow(t, wanted, inner))
        const blocked = values.find(v => v.status !== 'ready')
        if (blocked) return { ...blocked, sources: [...sources] }
        if (new Set(values.map(v => v.cid)).size > 1) return fail('conflict', 'Incompatible bindings for the same reference')
        return { ...values[0]!, sources: [...sources] }
      }
      if (wanted && !matchesGraph(store, wanted, cid)) return fail('conflict', 'The value does not match the row pattern')
      // a handler whose primitive runs at a peer needs that peer; a value that only names who supplied it does not
      const peer = hostOf(store, cid) ?? undefined
      if (peer && environment.isPeerActive && !environment.isPeerActive(peer)) return fail('missing', `Peer ${peer} is not active`)
      if (environment.checkDependencies === false) return { status: 'ready', cid, sources: [...sources], problems: [] }
      for (const child of childRows(store, cid).filter(c => isRequirementRow(store, c.edge))) {
        if (!argumentSatisfied(store, child.cid, child.edge[0])) { sources.add(child.cid); return fail('missing', 'A required resource or confirmation is unresolved') }
      }
      for (const arg of argumentRefs(store, cid)) {
        if (content(store, arg.cid).data.refRole === 'output') continue
        const result = arg.binding && bindingAssignments(arg.binding).length ? followDeclaration(arg.binding, arg.type) : follow(arg.cid, arg.type, scope)
        if (result.status !== 'ready') return { ...result, sources: [...sources] }
      }
      return { status: 'ready', cid, sources: [...sources], problems: [] }
    } finally { active.delete(cid) }
  }
  return target ? typeof target === 'string' ? follow(target, type) : followDeclaration(target, type) : choose(type, name)
}

/** Substitution uses the same argument resolution as a handler invocation. */
export function resolveText(r: Replica, at: Scope, text: string, defaults: BindingCandidate[] = [], environment: BindingEnvironment = {}): { text: string; bindings: BindingResolution[] } {
  const candidates = contextBindings(r, at, environment), bindings: BindingResolution[] = []
  for (const candidate of defaults) if (!candidates.some(c => c.type === candidate.type && c.name === candidate.name)) candidates.push(candidate)
  const type = primitive(r.store, 'string')
  let rendered = '', previous = 0
  for (const expression of textRefExpressions(text)) {
    const name = expression.source, parsed = parseRefExpression(name)
    let result: BindingResolution
    if (!parsed.lexical || parsed.path.length > 1) {
      const found = resolveRefExpression(r, at, parsed, environment)
      const location = found.locations[0]
      if (found.status === 'ready' && location) {
        if (location.store !== r.store) importNodes(r.store, reachableNodes(location.store, [location.cid]))
        result = resolveBinding(r.store, type, 'assignments' in location ? location as ScopedBinding : location.cid, candidates, undefined, { ...environment, scope: { replica: r, path: location.path.slice(0, -1) } })
      } else result = { status: found.status === 'denied' ? 'missing' : found.status === 'ready' ? 'missing' : found.status, sources: [], problems: [`Unresolved ref property: ${name}`] }
    } else result = resolveBinding(r.store, type, null, candidates, name, { ...environment, scope: { replica: r, path: at } })
    bindings.push(result)
    rendered += text.slice(previous, expression.start) + (result.status === 'ready' ? rowText(r.store, result.cid!, null) : text.slice(expression.start, expression.end))
    previous = expression.end
  }
  return { text: rendered + text.slice(previous), bindings }
}

/** Nearest bindings shadow ancestors. Offers are distinct from permissions granted to a peer. */
export function capabilityPeers(r: Replica, path: Scope, capability: Capability): string[] {
  const type = libraryTypeAt(r.store, `capabilities.${capability}`, path)
  if (!type) return []
  return [...new Set(discoverHandlers(r, path).filter(o => o.enabled && sameCapabilityType(r.store, o.type, type)).map(o => o.peerId))]
}
