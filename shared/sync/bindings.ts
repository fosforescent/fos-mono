/** Shared, read-only resolution for data arguments and callable values. */
import { discoverHandlers, type HandlerEnvironment } from './handlers'
import { resolveRequirementOutput } from './destructure'
import { formText } from './forms'
import type { FosStore } from '../dag-implementation/store'
import {
  isBranchChoice, selectedBranchValue, libraryTypeAt, type Capability, childRows, flowOf, requirementSatisfied, content, isChoiceEdge, isRefNode, refValueCid,
  valueContent, importNodes, reachableNodes, enclosingScopes, lookupInScope, type EnclosingScope, type Scope
} from './graph'
import { isAllocationType } from './library-types'
import { headCid, type Replica } from './replica'
import { refProperties } from './refs'
import { sameCapabilityType } from './capabilities'
import { declares } from './scoped-refs'
import { matchesGraph } from './structural'
import { parseRefExpression, resolveRefExpression, resolveRefIdentity, nodeOccurrence, textRefExpressions, type RefAccess } from './ref-paths'

export type BindingEnvironment = HandlerEnvironment & RefAccess & { scope?: { replica: Replica; path: Scope } }

type BindingScope = { store: FosStore; path: Scope }
export type BindingCandidate = { cid: string; type: string; name?: string; alternativeOf?: string; refIds?: string[]; scope?: BindingScope }
export type BindingResolution = {
  status: 'ready' | 'missing' | 'ambiguous' | 'conflict' | 'cycle'
  cid?: string
  /** References consulted, including both sides of an incompatible equality. */
  sources: string[]
  problems: string[]
}
/** The node's declarations as binding candidates: named ones bind by name, the others only as explicit arguments. */
export function argumentRefs(store: FosStore, cid: string): BindingCandidate[] {
  return refProperties(store, cid, 'arguments').filter(ref => !!ref.type && declares(store, ref.type, ref.cid))
    .map(ref => ({ cid: ref.cid, type: ref.type!, ...(content(store, ref.cid).data.name || valueContent(store, ref.cid).data.name ? { name: ref.name } : {}) }))
}

/**
 * The bindings visible at `at`. Each name binds to its nearest declaration (`lookupInScope`), whatever its type; a
 * nearer name hides an outer one. Only declarations that provide a value count: an unfilled one is a hole, bound from
 * further out. Unnamed rows are explicit arguments of their own parent, never ambient names. Handler offers join as
 * typed alternatives, attached to the named declaration they stand in for.
 */
export function contextBindings(r: Replica, at: Scope, environment: BindingEnvironment = {}): BindingCandidate[] {
  const scopes = enclosingScopes(r.store, headCid(r), at), provided = new Map<EnclosingScope, BindingCandidate[]>()
  const providers = (scope: EnclosingScope): BindingCandidate[] => {
    if (!provided.has(scope)) provided.set(scope, argumentRefs(scope.store, scope.cid).filter(arg => {
      const node = content(scope.store, arg.cid)
      return !!arg.name && (!!refValueCid(scope.store, node) || !!node.data.ref)
    }).map(arg => ({ ...arg, scope: { store: scope.store, path: scope.path } })))
    return provided.get(scope)!
  }
  const names = new Set(scopes.flatMap(scope => providers(scope).map(arg => arg.name!)))
  const namedValues = [...names].flatMap(name => {
    const found = lookupInScope(scopes, scope => providers(scope).filter(arg => arg.name === name))
    if (found.status !== 'ready' && found.status !== 'ambiguous') return []
    const values = found.status === 'ready' ? [found.value] : found.values
    if (found.scope.store !== r.store) importNodes(r.store, reachableNodes(found.scope.store, values.flatMap(value => [value.cid, value.type])))
    return values
  })
  const candidates: BindingCandidate[] = [...namedValues, ...discoverHandlers(r, at, environment).filter(o => o.enabled && o.active && !namedValues.some(value => value.cid === o.cid)).map(({ id, cid, type, refPath, refIds, scope }) => {
    const name = refPath?.join('.') ?? content(r.store, cid).data.name?.content
    const declaration = namedValues.find(value => content(r.store, value.cid).data.alias?.id === id)
    return { cid, type, ...(name ? { name } : {}), ...(refIds ? { refIds } : {}), ...(scope ? { scope } : {}), ...(declaration ? { alternativeOf: declaration.cid } : {}) }
  })]
  const visible = new Set<BindingCandidate>(candidates.filter(candidate => !candidate.name))
  for (const name of new Set(candidates.flatMap(candidate => candidate.name ? [candidate.name] : []))) {
    const found = lookupInScope(scopes, scope => candidates.filter(candidate => candidate.name === name &&
      candidate.scope?.store === scope.store && JSON.stringify(candidate.scope.path) === JSON.stringify(scope.path)))
    if (found.status === 'ready') visible.add(found.value)
    else if (found.status === 'ambiguous') found.values.forEach(value => visible.add(value))
  }
  return candidates.filter(candidate => visible.has(candidate))
}

/** Explicit targets win. Multiple candidates remain choices; no first-provider wins. */
export function resolveBinding(store: FosStore, type: string, target: string | null, candidates: BindingCandidate[] = [], name?: string, environment: BindingEnvironment = {}): BindingResolution {
  const sources = new Set<string>(), active = new Set<string>()
  const fail = (status: BindingResolution['status'], message: string): BindingResolution => ({ status, sources: [...sources], problems: [message] })
  const compatible = (_actual: string, wanted: string, cid: string): boolean => matchesGraph(store, wanted, cid)
  const choose = (wanted: string, label?: string, excluded?: string, anonymous = false): BindingResolution => {
    const matches = [...new Set(candidates.filter(c => c.cid !== excluded && !(label && c.alternativeOf) &&
      (label && c.name === label || compatible(c.type, wanted, c.cid) && (!label || anonymous && (!c.name || !!c.refIds)))).map(c => c.cid))]
    if (!matches.length) return fail('missing', `Missing binding${label ? `: ${label}` : ''}`)
    if (matches.length > 1) {
      matches.forEach(cid => sources.add(cid))
      if (label && matches.every(cid => candidates.some(c => c.cid === cid && c.name === label))) {
        const resolved = matches.map(cid => follow(cid, wanted))
        const blocked = resolved.find(value => value.status !== 'ready')
        if (blocked) return { ...blocked, sources: [...sources] }
        if (new Set(resolved.map(value => value.cid)).size === 1) return { ...resolved[0]!, sources: [...sources] }
        return fail('conflict', `Incompatible bindings for ${label}`)
      }
      return fail('ambiguous', `Choose a binding${label ? ` for ${label}` : ''}`)
    }
    return follow(matches[0]!, wanted)
  }
  const follow = (cid: string, wanted: string, inherited = candidates.find(candidate => candidate.cid === cid)?.scope ?? (environment.scope ? { store: environment.scope.replica.store, path: environment.scope.path } : undefined)): BindingResolution => {
    const occurrence = nodeOccurrence(store, cid)
    const scope: BindingScope | undefined = occurrence ? { store, path: occurrence.slice(0, -1) } : inherited
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
        if (location.store !== store) importNodes(store, reachableNodes(location.store, [location.cid]))
        return follow(location.cid, wanted, { store: location.store, path: location.path.slice(0, -1) })
      }
      if (isBranchChoice(store, node)) { const selected = selectedBranchValue(store, cid); return selected ? follow(selected, wanted, scope) : fail('missing', 'Choose a supplied value branch') }
      if (node.children.some(e => isChoiceEdge(store, e))) return fail('conflict', 'Resolve conflicting values first')
      const output = resolveRequirementOutput(store, cid, scope?.path)
      if (output) return output.cid ? { status: 'ready', cid: output.cid, sources: [...sources], problems: [] } : fail('missing', output.error ?? 'Unfilled requirement')
      if (node.data.ref) {
        if (node.data.ref.peer || node.data.ref.owner) return fail('missing', 'The remote reference needs a handler in this scope')
        if (!scope) return fail('missing', 'The reference needs its lexical scope')
        const found = resolveRefIdentity({ store: scope.store }, scope.path, node.data.ref.id, environment)
        if (found.status !== 'ready') return fail(found.status === 'ambiguous' ? 'ambiguous' : found.status === 'cycle' ? 'cycle' : 'missing', 'The reference is unavailable in this scope')
        const location = found.locations[0]!
        if (location.store !== store) importNodes(store, reachableNodes(location.store, [location.cid]))
        return follow(location.cid, wanted, { store: location.store, path: location.path.slice(0, -1) })
      }
      if (isRefNode(store, node)) {
        const targets = [...new Set(node.children.filter(e => e[0] === store.primitive.targetPointerConstructor.getId()).map(e => e[1]))]
        if (!targets.length) return choose(wanted, node.data.name?.content, cid, true)
        const values = targets.map(t => follow(t, wanted, scope))
        const blocked = values.find(v => v.status !== 'ready')
        if (blocked) return { ...blocked, sources: [...sources] }
        if (new Set(values.map(v => v.cid)).size > 1) return fail('conflict', 'Incompatible bindings for the same reference')
        return { ...values[0]!, sources: [...sources] }
      }
      if (!matchesGraph(store, wanted, cid)) return fail('conflict', 'The value does not match the row pattern')
      const peer = node.data.peerId?.content
      if (peer && environment.isPeerActive && !environment.isPeerActive(peer)) return fail('missing', `Peer ${peer} is not active`)
      for (const child of childRows(store, cid).filter(c => isAllocationType(c.type) && flowOf(c.type, c.value).requirement)) {
        if (!requirementSatisfied(store, child.cid)) { sources.add(child.cid); return fail('missing', 'A required resource or confirmation is unresolved') }
      }
      for (const arg of argumentRefs(store, cid)) {
        if (content(store, arg.cid).data.refRole === 'output') continue
        const result = follow(arg.cid, arg.type, scope)
        if (result.status !== 'ready') return { ...result, sources: [...sources] }
      }
      return { status: 'ready', cid, sources: [...sources], problems: [] }
    } finally { active.delete(cid) }
  }
  return target ? follow(target, type) : choose(type, name)
}

/** Substitution uses the same argument resolution as a handler invocation. */
export function resolveText(r: Replica, at: Scope, text: string, defaults: BindingCandidate[] = [], environment: BindingEnvironment = {}): { text: string; bindings: BindingResolution[] } {
  const candidates = contextBindings(r, at), bindings: BindingResolution[] = []
  for (const candidate of defaults) if (!candidates.some(c => c.type === candidate.type && c.name === candidate.name)) candidates.push(candidate)
  const type = r.store.primitive.documentField.getId()
  let rendered = '', previous = 0
  for (const expression of textRefExpressions(text)) {
    const name = expression.source, parsed = parseRefExpression(name)
    let result: BindingResolution
    if (!parsed.lexical || parsed.path.length > 1) {
      const found = resolveRefExpression(r, at, parsed, environment)
      const location = found.locations[0]
      if (found.status === 'ready' && location) {
        if (location.store !== r.store) importNodes(r.store, reachableNodes(location.store, [location.cid]))
        result = resolveBinding(r.store, type, location.cid, candidates, undefined, { ...environment, scope: { replica: r, path: location.path.slice(0, -1) } })
      } else result = { status: found.status === 'denied' ? 'missing' : found.status === 'ready' ? 'missing' : found.status, sources: [], problems: [`Unresolved ref property: ${name}`] }
    } else result = resolveBinding(r.store, type, null, candidates, name, { ...environment, scope: { replica: r, path: at } })
    bindings.push(result)
    rendered += text.slice(previous, expression.start) + (result.status === 'ready' ? formText(r.store, valueContent(r.store, result.cid!)) : text.slice(expression.start, expression.end))
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
