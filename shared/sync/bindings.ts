/** Shared, read-only resolution for data arguments and callable values. */
import { discoverHandlers, type HandlerEnvironment } from './handlers'
import { resolveRequirementOutput } from './destructure'
import { keyValueOf, splitFrontmatter } from './notes'
import { formText, formTitle } from './forms'
import type { FosStore } from '../dag-implementation/store'
import {
  isBranchChoice, selectedBranchValue, capabilityTarget, type Capability, put, childRows, flowOf, requirementSatisfied, content, identityCid, isChoiceEdge, isRefNode, refValueCid,
  resolveScope, valueContent, importNodes, reachableNodes, typeIdOf, isLibraryRef, type Scope
} from './graph'
import { PLAIN_TYPE, isAllocationType } from './library-types'
import { headCid, type Replica } from './replica'
import { refProperties } from './refs'
import { sameCapabilityType, isHandlerStateLeft } from './capabilities'
import { matchesGraph } from './structural'
import { parseRefExpression, resolveRefExpression, textRefExpressions, type RefAccess } from './ref-paths'

export type BindingEnvironment = HandlerEnvironment & RefAccess & { scope?: { replica: Replica; path: Scope } }

export type BindingCandidate = { cid: string; type: string; name?: string; alternativeOf?: string; refIds?: string[] }
export type BindingResolution = {
  status: 'ready' | 'missing' | 'ambiguous' | 'conflict' | 'cycle'
  cid?: string
  /** References consulted, including both sides of an incompatible equality. */
  sources: string[]
  problems: string[]
}
export function argumentRefs(store: FosStore, cid: string): BindingCandidate[] {
  // Named properties and explicit ref declarations are lexical bindings. Other
  // rows still have a right-hand argument, but do not declare an implicit name.
  return refProperties(store, cid, 'arguments').filter(ref => {
    const node = content(store, ref.cid)
    if (isLibraryRef(node)) return false
    // an execute row holds the evaluator's journal of this node: its state, never an argument
    if (isHandlerStateLeft(store, ref.type)) return false
    const pattern = ref.type && content(store, ref.type)
    return node.data.name || valueContent(store, ref.cid).data.name || isRefNode(store, node) &&
      (!typeIdOf(store, ref.type) || !!pattern && (pattern.data.capabilityDefinition || pattern.data.form?.primitive))
  }).map(ref => ({ cid: ref.cid, type: ref.type!, ...(content(store, ref.cid).data.name || valueContent(store, ref.cid).data.name ? { name: ref.name } : {}) }))
}

/** Only explicitly passed arguments and advertised peer handlers enter the context. */
export function contextBindings(r: Replica, at: Scope, environment: BindingEnvironment = {}): BindingCandidate[] {
  const named = new Map<string, BindingCandidate[]>()
  for (let i = 0; i <= at.length; i++) {
    const cid = resolveScope(r.store, headCid(r), at.slice(0, i))
    if (!cid) continue
    const local = new Map<string, BindingCandidate[]>()
    // Legacy note variables are adapters into the same typed candidate set.
    const textType = r.store.primitive.documentField.getId()
    const addText = (name: string, text: string) => {
      const key = `${textType}/${name}`
      const value = put(r.store, { data: { description: { content: text } }, children: [] })
      local.set(key, [...(local.get(key) ?? []), { cid: value, type: textType, name }])
    }
    const frontmatter = splitFrontmatter(formText(r.store, valueContent(r.store, cid))).frontmatter
    for (const [name, text] of Object.entries(frontmatter)) addText(name, text)
    const childNames = new Set<string>()
    for (const child of childRows(r.store, cid).filter(c => c.type === PLAIN_TYPE)) {
      // Product fields are values, not legacy "key: value" declarations.
      if (child.value.data.scalar || child.value.data.presentation) continue
      const kv = keyValueOf(formTitle(r.store, child.value))
      if (!kv) continue
      if (!childNames.has(kv.key)) { local.delete(`${textType}/${kv.key}`); childNames.add(kv.key) }
      addText(kv.key, kv.value)
    }
    for (const arg of argumentRefs(r.store, cid)) {
      // Unnamed rows are explicit arguments of their own parent, not ambient
      // name bindings in every descendant (e.g. the linked Home document).
      if (!arg.name) continue
      // Unfilled local arguments are consumers, not providers.
      if (refValueCid(r.store, content(r.store, arg.cid)) || content(r.store, arg.cid).data.ref) local.set(`${arg.type}/${arg.name}`, [...(local.get(`${arg.type}/${arg.name}`) ?? []), arg])
    }
    for (const [key, values] of local) named.set(key, values)
  }
  const namedValues = [...named.values()].flat()
  return [...namedValues, ...discoverHandlers(r, at, environment).filter(o => o.enabled && o.active && !namedValues.some(value => value.cid === o.cid)).map(({ id, cid, type, refPath, refIds }) => {
    const name = refPath?.join('.') ?? content(r.store, cid).data.name?.content
    const declaration = namedValues.find(value => content(r.store, value.cid).data.alias?.id === id) ??
      (name ? namedValues.find(value => value.name === name && sameCapabilityType(r.store, value.type, type)) : undefined)
    return { cid, type, ...(name ? { name } : {}), ...(refIds ? { refIds } : {}), ...(declaration ? { alternativeOf: declaration.cid } : {}) }
  })]
}

/** Explicit targets win. Multiple candidates remain choices; no first-provider wins. */
export function resolveBinding(store: FosStore, type: string, target: string | null, candidates: BindingCandidate[] = [], name?: string, environment: BindingEnvironment = {}): BindingResolution {
  const sources = new Set<string>(), active = new Set<string>()
  const fail = (status: BindingResolution['status'], message: string): BindingResolution => ({ status, sources: [...sources], problems: [message] })
  const compatible = (_actual: string, wanted: string, cid: string): boolean => matchesGraph(store, wanted, cid)
  const choose = (wanted: string, label?: string, excluded?: string, anonymous = false): BindingResolution => {
    const matches = [...new Set(candidates.filter(c => c.cid !== excluded && !(label && c.alternativeOf) && compatible(c.type, wanted, c.cid) && (!label || c.name === label || (anonymous && (!c.name || !!c.refIds)))).map(c => c.cid))]
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
  const follow = (cid: string, wanted: string): BindingResolution => {
    if (environment.canRead && !environment.canRead(store, cid, environment.scope?.path ?? [])) return fail('missing', 'The bound value is not accessible')
    sources.add(cid)
    if (!store.table.has(cid)) return fail('missing', 'The bound value is unavailable')
    if (active.has(cid) || active.size >= 100) return fail('cycle', 'Unresolved dependency cycle')
    active.add(cid)
    try {
      const node = content(store, cid)
      if (node.data.refExpression) {
        if (!environment.scope) return fail('missing', 'Ref expression needs its lexical scope')
        const found = resolveRefExpression(environment.scope.replica, environment.scope.path, node.data.refExpression, environment)
        if (found.status !== 'ready') return fail(found.status === 'denied' ? 'missing' : found.status, `Unresolved ref property: ${node.data.name?.content ?? node.data.alias?.id}`)
        const location = found.locations[0]!
        if (location.store !== store) importNodes(store, reachableNodes(location.store, [location.cid]))
        return follow(location.cid, wanted)
      }
      if (isBranchChoice(store, node)) { const selected = selectedBranchValue(store, cid); return selected ? follow(selected, wanted) : fail('missing', 'Choose a supplied value branch') }
      if (node.children.some(e => isChoiceEdge(store, e))) return fail('conflict', 'Resolve conflicting values first')
      const output = resolveRequirementOutput(store, cid)
      if (output) return output.cid ? { status: 'ready', cid: output.cid, sources: [...sources], problems: [] } : fail('missing', output.error ?? 'Unfilled requirement')
      if (isRefNode(store, node)) {
        const targets = [...new Set(node.children.filter(e => e[0] === store.primitive.targetPointerConstructor.getId()).map(e => e[1]))]
        if (!targets.length) return choose(wanted, node.data.name?.content, cid, true)
        const values = targets.map(t => follow(t, wanted))
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
        const result = follow(arg.cid, arg.type)
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
  const type = capabilityTarget(r.store, capability)
  return [...new Set(discoverHandlers(r, path).filter(o => o.enabled && sameCapabilityType(r.store, o.type, type)).map(o => o.peerId))]
}
