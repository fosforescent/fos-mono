/** Shared, read-only resolution for data arguments and callable values. */
import { keyValueOf, splitFrontmatter } from './notes'
import type { FosStore } from '../dag-implementation/store'
import {
  readMembers, type Capability, put, childRows, requirementSatisfied, capabilityOf, acceptsOf, content, identityCid, isChoiceEdge, isMemberEdge, refTypeCid, refValueCid,
  resolveScope, valueContent, type Scope
} from './graph'
import { headCid, type Replica } from './replica'

export type BindingEnvironment = { isPeerActive?: (peerId: string) => boolean }

export type BindingCandidate = { cid: string; type: string; name?: string }
export type BindingResolution = {
  status: 'ready' | 'missing' | 'ambiguous' | 'conflict' | 'cycle'
  cid?: string
  /** References consulted, including both sides of an incompatible equality. */
  sources: string[]
  problems: string[]
}
export function argumentRefs(store: FosStore, cid: string): BindingCandidate[] {
  return valueContent(store, cid).children.flatMap(edge => {
    const id = identityCid(store, edge), ref = content(store, id), type = refTypeCid(store, ref)
    return type && ref.data.alias?.id && edge[0] === type
      ? [{ cid: id, type, name: ref.data.name?.content ?? ref.data.alias?.id }] : []
  })
}

/** Only explicitly passed arguments and advertised peer handlers enter the context. */
export function contextBindings(r: Replica, at: Scope, environment: BindingEnvironment = {}): BindingCandidate[] {
  const named = new Map<string, BindingCandidate[]>(), peers = new Map<string, BindingCandidate[]>()
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
    const frontmatter = splitFrontmatter(valueContent(r.store, cid).data.description?.content ?? '').frontmatter
    for (const [name, text] of Object.entries(frontmatter)) addText(name, text)
    const childNames = new Set<string>()
    for (const child of childRows(r.store, cid, 'plain')) {
      const kv = keyValueOf(child.value.data.description?.content ?? '')
      if (!kv) continue
      if (!childNames.has(kv.key)) { local.delete(`${textType}/${kv.key}`); childNames.add(kv.key) }
      addText(kv.key, kv.value)
    }
    for (const arg of argumentRefs(r.store, cid)) {
      // Unfilled local arguments are consumers, not providers.
      if (refValueCid(r.store, content(r.store, arg.cid))) local.set(`${arg.type}/${arg.name}`, [...(local.get(`${arg.type}/${arg.name}`) ?? []), arg])
    }
    for (const [key, values] of local) named.set(key, values)
    for (const edge of content(r.store, cid).children.filter(edge => isMemberEdge(r.store, edge))) {
      const member = content(r.store, edge[1]), peer = member.data.peerId?.content
      if (!peer) continue
      if (environment.isPeerActive && !environment.isPeerActive(peer)) { peers.set(peer, []); continue }
      const disabled = member.data.disabledCapabilities?.content ?? []
      // Direction/permission filtering is also performed by the invoking transport.
      const offers = member.children.filter(e => e[0] === r.store.primitive.capabilityNode.getId() || e[0] === r.store.primitive.acceptsNode.getId())
      peers.set(peer, offers.flatMap(e => {
        const ref = content(r.store, e[1]), type = refTypeCid(r.store, ref)
        // Legacy capability markers are adapted by their existing executors.
        const capability = capabilityOf(r.store, e) ?? acceptsOf(r.store, e)
        return type && (!capability || !disabled.includes(capability)) ? [{ cid: e[1], type }] : []
      }))
    }
  }
  return [...[...named.values()].flat(), ...[...peers.values()].flat()]
}

/** Explicit targets win. Multiple candidates remain choices; no first-provider wins. */
export function resolveBinding(store: FosStore, type: string, target: string | null, candidates: BindingCandidate[] = [], name?: string, environment: BindingEnvironment = {}): BindingResolution {
  const sources = new Set<string>(), active = new Set<string>()
  const fail = (status: BindingResolution['status'], message: string): BindingResolution => ({ status, sources: [...sources], problems: [message] })
  const choose = (wanted: string, label?: string, excluded?: string, anonymous = false): BindingResolution => {
    const matches = [...new Set(candidates.filter(c => c.cid !== excluded && c.type === wanted && (!label || c.name === label || (anonymous && !c.name))).map(c => c.cid))]
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
    sources.add(cid)
    if (!store.table.has(cid)) return fail('missing', 'The bound value is unavailable')
    if (active.has(cid) || active.size >= 100) return fail('cycle', 'Unresolved dependency cycle')
    active.add(cid)
    try {
      const node = content(store, cid), actual = refTypeCid(store, node)
      if (actual && actual !== wanted) return fail('conflict', 'The bound value has an incompatible type')
      if (node.children.some(e => isChoiceEdge(store, e))) return fail('conflict', 'Resolve conflicting values first')
      if (actual || refValueCid(store, node)) {
        const targets = [...new Set(node.children.filter(e => e[0] === store.primitive.targetPointerConstructor.getId()).map(e => e[1]))]
        if (!targets.length) return choose(wanted, node.data.name?.content, cid, true)
        const values = targets.map(t => follow(t, wanted))
        const blocked = values.find(v => v.status !== 'ready')
        if (blocked) return { ...blocked, sources: [...sources] }
        if (new Set(values.map(v => v.cid)).size > 1) return fail('conflict', 'Incompatible bindings for the same reference')
        return { ...values[0]!, sources: [...sources] }
      }
      const peer = node.data.peerId?.content
      if (peer && environment.isPeerActive && !environment.isPeerActive(peer)) return fail('missing', `Peer ${peer} is not active`)
      for (const child of childRows(store, cid, 'requirement')) {
        if (!requirementSatisfied(store, child.cid)) { sources.add(child.cid); return fail('missing', 'A required resource or confirmation is unresolved') }
      }
      for (const arg of argumentRefs(store, cid)) {
        const result = follow(arg.cid, arg.type)
        if (result.status !== 'ready') return { ...result, sources: [...sources] }
      }
      return { status: 'ready', cid, sources: [...sources], problems: [] }
    } finally { active.delete(cid) }
  }
  return target ? follow(target, type) : choose(type, name)
}

/** Substitution uses the same argument resolution as a handler invocation. */
export function resolveText(r: Replica, at: Scope, text: string, defaults: BindingCandidate[] = []): { text: string; bindings: BindingResolution[] } {
  const candidates = contextBindings(r, at), bindings: BindingResolution[] = []
  for (const candidate of defaults) if (!candidates.some(c => c.type === candidate.type && c.name === candidate.name)) candidates.push(candidate)
  const type = r.store.primitive.documentField.getId()
  return { text: text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (placeholder, name: string) => {
    const result = resolveBinding(r.store, type, null, candidates, name)
    bindings.push(result)
    return result.status === 'ready' ? valueContent(r.store, result.cid!).data.description?.content ?? '' : placeholder
  }), bindings }
}

/** Nearest bindings shadow ancestors. Offers are distinct from permissions granted to a peer. */
export function capabilityPeers(r: Replica, path: Scope, capability: Capability): string[] {
  const members = new Map<string, ReturnType<typeof readMembers>[number]>()
  for (let i = 0; i <= path.length; i++) {
    const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
    if (cid) for (const member of readMembers(r.store, content(r.store, cid))) members.set(member.peerId, member)
  }
  return [...members.values()].filter(m => !m.disabled?.includes(capability) &&
    (m.accepts?.includes(capability) || ((m.peerId === 'fos' || (m.peerId.startsWith('mcp:') && capability === 'tool')) && m.capabilities.includes(capability)))).map(m => m.peerId)
}
