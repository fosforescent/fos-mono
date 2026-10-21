/** One view of handler advertisements for bindings, menus, and executors.
 * Native capability markers are read adapters; new advertisements are typed refs.
 */
import type { FosStore } from '../dag-implementation/store'
import { branchEdge, isBranchChoice, readMembers, CAPABILITIES, MARKET_PEER, capabilityTarget, content, identityCid, isMemberEdge, marketMemberOf, memberHandlers, put, refNodeContent, refTypeCid, resolveScope, isRowEdge, isRowOfType, valueContent, withMainBranchPolicy, type Capability, type Scope } from './graph'
import { addMemberAt, setHandlerOffersAt, headCid, type Replica } from './replica'
import { marketGrantsAt } from './market'
import { refProperties } from './refs'

export type HandlerEnvironment = { isPeerActive?: (peerId: string) => boolean }
export type HandlerOffer = { id: string; cid: string; type: string; peerId: string; label: string; capability?: Capability; enabled: boolean; active: boolean; legacy: boolean }

/** Read policy in main, including ancestors; never use a preview branch's grants. */
export function contextMemberRefs(r: Replica, path: Scope): Map<string, string> {
  return withMainBranchPolicy(r.store, () => {
    const peers = new Map<string, string>()
    for (let i = 0; i <= path.length; i++) {
      const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
      if (!cid) continue
      // resolveScope preserves branch constructors at the final path component.
      for (const ref of refProperties(r.store, policyIdentity(r.store, cid), 'members')) if (ref.peer) peers.set(ref.peer, ref.cid)
    }
    return peers
  })
}
function policyIdentity(store: FosStore, cid: string): string {
  const node = content(store, cid)
  const edge = isBranchChoice(store, node) ? branchEdge(store, cid) : null
  return edge ? policyIdentity(store, identityCid(store, edge)) : cid
}

export function discoverHandlers(r: Replica, path: Scope, environment: HandlerEnvironment = {}): HandlerOffer[] {
  const s = r.store, result: HandlerOffer[] = []
  for (const [peerId, memberCid] of contextMemberRefs(r, path)) {
    const member = content(s, memberCid), disabled = member.data.disabledCapabilities?.content ?? []
    for (const edge of member.children) {
      const source = content(s, edge[1]), type = refTypeCid(s, source) ?? edge[1]
      const capability = CAPABILITIES.find(c => capabilityTarget(s, c) === type)
      const incoming = edge[0] === s.primitive.acceptsNode.getId()
      // Compatibility for built-in server/MCP offers historically written as grants.
      const legacyOffer = edge[0] === s.primitive.capabilityNode.getId() && (peerId === 'fos' || (peerId.startsWith('mcp:') && capability === 'tool'))
      if (!incoming && !legacyOffer) continue
      if (legacyOffer && member.children.some(e => e[0] === s.primitive.acceptsNode.getId() && (refTypeCid(s, content(s, e[1])) ?? e[1]) === type)) continue
      if (!refTypeCid(s, source) && !capability) continue
      const cid = refTypeCid(s, source) ? edge[1] : put(s, refNodeContent(s, { alias: { id: `fos:handler:${peerId}:${capability}` } },
        put(s, { data: { peerId: { content: peerId }, description: { content: capability! } }, children: [] }), [], type))
      const id = content(s, cid).data.alias?.id ?? cid
      if (result.some(o => o.peerId === peerId && o.cid === cid)) continue
      result.push({ id, cid, type, peerId, legacy: !refTypeCid(s, source), label: source.data.name?.content ?? valueContent(s, cid).data.description?.content ?? capability ?? 'Capability',
        ...(capability ? { capability } : {}), enabled: !disabled.includes(id) && !(capability && disabled.includes(capability)), active: environment.isPeerActive?.(peerId) ?? true })
    }
  }
  return result
}

/**
 * Publish the selected template version as a normal typed handler on this device's peer; with `market`, also offered
 * to the market peer (its `to` side at `at`, the market made a member there keeping whatever listing it inherits).
 */
export function publishTemplate(r: Replica, at: Scope, templatePath: Scope, label: string, now: number, market = false): Replica {
  const cid = resolveScope(r.store, headCid(r), templatePath)
  if (!cid || !templatePath.length) throw new Error('Select a template to publish.')
  const parent = resolveScope(r.store, headCid(r), templatePath.slice(0, -1))
  if (!parent || !valueContent(r.store, parent).children.some(e => identityCid(r.store, e) === cid && isRowOfType(r.store, e, 'lib:type:template'))) throw new Error('Only template rows can be published.')
  const type = r.store.primitive.templateField.getId(), peerId = r.meta.peerId
  if (!contextMemberRefs(r, at).has(peerId)) r = addMemberAt(r, at, peerId, peerId, [], now)
  const id = `fos:published:${templatePath.at(-1)}`
  const handler = put(r.store, refNodeContent(r.store, { alias: { id }, name: { content: label.trim() || valueContent(r.store, cid).data.description?.content || 'Template' } }, cid, [], type))
  const existing = discoverHandlers(r, at).filter(o => o.peerId === peerId && o.type === type && o.id !== id).map(o => o.cid)
  r = setHandlerOffersAt(r, at, peerId, type, [...existing, handler], now)
  if (!market) return r
  if (!marketMemberOf(r.store, resolveScope(r.store, headCid(r), at)!)) r = addMemberAt(r, at, MARKET_PEER, 'Fos market', marketGrantsAt(r.store, headCid(r), at), now)
  const node = content(r.store, policyIdentity(r.store, resolveScope(r.store, headCid(r), at)!))
  const published = memberHandlers(r.store, node, MARKET_PEER, r.store.primitive.capabilityNode.getId()).filter(h => refTypeCid(r.store, content(r.store, h)) === type && content(r.store, h).data.alias?.id !== id)
  return setHandlerOffersAt(r, at, MARKET_PEER, type, [...published, handler], now, 'to')
}

export function contextMembers(r: Replica, path: Scope) {
  return [...contextMemberRefs(r, path).values()].flatMap(cid => readMembers(r.store, { data: {}, children: [[r.store.primitive.memberField.getId(), cid]] }))
}

/** Handlers offered to the market (typed refs on the market member's `to` side, switched on), read from main policy. */
export function marketplaceOffers(r: Replica): Array<HandlerOffer & { path: Scope }> {
  return withMainBranchPolicy(r.store, () => {
    const result = new Map<string, HandlerOffer & { path: Scope }>(), visited = new Set<string>(), s = r.store
    const walk = (path: Scope) => {
      const cid = resolveScope(s, headCid(r), path)
      if (!cid || visited.has(cid)) return
      if (visited.size >= 5000 || path.length > 64) throw new Error('Marketplace context exceeds traversal limit.')
      visited.add(cid)
      const node = content(s, policyIdentity(s, cid))
      const member = node.children.find(e => isMemberEdge(s, e) && content(s, e[1]).data.peerId?.content === MARKET_PEER)
      const disabled = member ? content(s, member[1]).data.disabledCapabilities?.content ?? [] : []
      for (const h of member ? memberHandlers(s, node, MARKET_PEER, s.primitive.capabilityNode.getId()) : []) {
        const offer = content(s, h), id = offer.data.alias?.id ?? h
        if (!disabled.includes(id)) result.set(id, { id, cid: h, type: refTypeCid(s, offer)!, peerId: MARKET_PEER, legacy: false, label: offer.data.name?.content ?? valueContent(s, h).data.description?.content ?? 'Capability', enabled: true, active: true, path })
      }
      for (const edge of valueContent(s, cid).children) if (isRowEdge(s, edge) && !isRowOfType(s, edge, 'lib:type:ref')) { const id = content(s, identityCid(s, edge)).data.alias?.id; if (id) walk([...path, id]) }
    }
    walk([])
    return [...result.values()]
  })
}
