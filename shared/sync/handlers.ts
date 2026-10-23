/** Bindings, menus, and executors must discover handlers through the same scoped declarations. */
import { peerNode } from './graph'
import { TEMPLATE_TYPE, REF_TYPE } from './library-types'
import type { FosStore } from '../dag-implementation/store'
import { handlerOfferId, publishedTemplateId } from './graph'
import { sameCapabilityType } from './capabilities'

import { membershipOf, libAt, branchEdge, isBranchChoice, readMembers, MARKET_PEER, capabilityOfTarget, content, identityCid, isMemberEdge, marketMemberOf, memberHandlers, put, refNodeContent, advertisedRows, memberHandlerRows, resolveScope, isRowEdge, isRowOfType, valueContent, withMainBranchPolicy, type Capability, type Scope } from './graph'

import { addMemberAt, setHandlerOffersAt, headCid, type Replica } from './replica'

import { marketGrantsAt } from './market'

import { refProperties } from './refs'

import { enclosingScopes, importNodes, reachableNodes } from './graph'

import { inspectRef, scopedRefs, type ScopedRef } from './scoped-refs'
import { transferRefGraph } from './ref-transfer'

export type HandlerEnvironment = { isPeerActive?: (peerId: string) => boolean }
export type HandlerOffer = { id: string; cid: string; type: string; peerId: string; label: string; refPath?: string[]; refIds?: string[]; capability?: Capability; enabled: boolean; active: boolean }

/** Read policy in main, including ancestors; never use a preview branch's grants. */
function contextMemberLayers(r: Replica, path: Scope): Array<{ peer: string; cid: string; depth: number }> {
  return withMainBranchPolicy(r.store, () => {
    const peers: Array<{ peer: string; cid: string; depth: number }> = []
    for (const [depth, { store, cid }] of [...enclosingScopes(r.store, headCid(r), path).entries()].reverse()) {
      // resolveScope preserves branch constructors at the final path component.
      for (const ref of withMainBranchPolicy(store, () => refProperties(store, policyIdentity(store, cid), 'members'))) if (ref.peer) {
        if (store !== r.store) importNodes(r.store, reachableNodes(store, [ref.cid]))
        peers.push({ peer: ref.peer, cid: ref.cid, depth })
      }
    }
    return peers
  })
}
export function contextMemberRefs(r: Replica, path: Scope): Map<string, string> {
  return new Map(contextMemberLayers(r, path).map(ref => [ref.peer, ref.cid]))
}
function policyIdentity(store: FosStore, cid: string): string {
  const node = content(store, cid)
  const edge = isBranchChoice(store, node) ? branchEdge(store, cid) : null
  return edge ? policyIdentity(store, identityCid(store, edge)) : cid
}

export function discoverHandlers(r: Replica, path: Scope, environment: HandlerEnvironment = {}): HandlerOffer[] {
  const s = r.store, result: HandlerOffer[] = []
  const members = contextMemberRefs(r, path)
  const add = (ref: ScopedRef, peerId: string, disabled: string[] = [], inheritedEnabled = true, inheritedActive = true, ancestors: string[] = [], ancestorIds: string[] = []) => {
    const refPath = [...ancestors, ref.name ?? ref.id]
    const refIds = [...ancestorIds, ref.id]
    const capability = capabilityOfTarget(s, ref.type)
    for (const value of ref.values) {
      const peer = content(s, value.cid).data.peerId?.content ?? ref.peerId ?? peerId
      const member = members.get(peer), off = [...disabled, ...(member ? content(s, member).data.disabledCapabilities?.content ?? [] : [])]
      const enabled = inheritedEnabled && !off.includes(ref.id) && !(capability && off.includes(capability))
      const active = inheritedActive && (environment.isPeerActive?.(peer) ?? true)
      const cid = ref.values.length === 1 ? ref.cid : put(s, refNodeContent(s, content(s, ref.cid).data, value.cid, []))
      if (!result.some(o => o.peerId === peer && o.cid === cid)) result.push({ id: ref.id, cid, type: ref.type, peerId: peer, refPath, refIds,
        label: ref.name ?? content(s, value.cid).data.description?.content ?? capability ?? ref.id,
        ...(capability ? { capability } : {}), enabled: !!enabled, active })
      for (const child of value.refs) add(child, peer, disabled, !!enabled, active, refPath, refIds)
    }
  }
  const declarations = new Map<string, Array<{ ref: ScopedRef; peer: string; depth: number }>>()
  const declare = (ref: ScopedRef, peer: string, depth: number) => {
    const previous = declarations.get(ref.id)
    if (!previous || depth < previous[0]!.depth) declarations.set(ref.id, [{ ref, peer, depth }])
    else if (depth === previous[0]!.depth) previous.push({ ref, peer, depth })
  }
  for (const ref of scopedRefs(r, path)) declare(ref, r.meta.peerId, ref.depth!)
  for (const { peer: peerId, cid: memberCid, depth } of contextMemberLayers(r, path)) {
    const member = content(s, memberCid)
    for (const edge of member.children) {
      const incoming = edge[0] === s.primitive.acceptsNode.getId()
      if (incoming) for (const [type, cid] of advertisedRows(s, edge[1])) declare(inspectRef(s, cid, type, path, peerId), peerId, depth)
    }
  }
  for (const alternatives of declarations.values()) for (const { ref, peer } of alternatives) add(ref, peer)
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
  if (!parent || !valueContent(r.store, parent).children.some(e => identityCid(r.store, e) === cid && isRowOfType(r.store, e, TEMPLATE_TYPE))) throw new Error('Only template rows can be published.')
  const type = r.store.primitive.templateField.getId(), peerId = r.meta.peerId
  const id = publishedTemplateId(peerId, templatePath.at(-1)!)
  const publishedValue = transferRefGraph(r, cid, templatePath, [...at, id], true)
  if (!contextMemberRefs(r, at).has(peerId)) r = addMemberAt(r, at, peerId, peerId, [], now)
  const handler = put(r.store, refNodeContent(r.store, { alias: { id }, name: { content: label.trim() || valueContent(r.store, cid).data.description?.content || 'Template' } }, publishedValue, []))
  const existing = discoverHandlers(r, at).filter(o => o.peerId === peerId && o.type === type && o.id !== id).map(o => o.cid)
  r = setHandlerOffersAt(r, at, peerId, type, [...existing, handler], now)
  if (!market) return r
  if (!marketMemberOf(r.store, resolveScope(r.store, headCid(r), at)!)) r = addMemberAt(r, at, MARKET_PEER, 'Fos market', marketGrantsAt(r.store, headCid(r), at), now)
  const node = content(r.store, policyIdentity(r.store, resolveScope(r.store, headCid(r), at)!))
  const published = memberHandlerRows(r.store, node, MARKET_PEER, r.store.primitive.capabilityNode.getId()).filter(([pattern, h]) => sameCapabilityType(r.store, pattern, type) && content(r.store, h).data.alias?.id !== id).map(([, h]) => h)
  return setHandlerOffersAt(r, at, MARKET_PEER, type, [...published, handler], now, 'to')
}

export function contextMembers(r: Replica, path: Scope) {
  return [...contextMemberRefs(r, path)].flatMap(([peer, cid]) => readMembers(r.store, { data: {}, children: [[peerNode(r.store, peer), cid]] }))
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
      const member = membershipOf(s, node, MARKET_PEER)
      const disabled = member ? content(s, member[1]).data.disabledCapabilities?.content ?? [] : []
      for (const [type, h] of member ? memberHandlerRows(s, node, MARKET_PEER, s.primitive.capabilityNode.getId()) : []) {
        const offer = content(s, h), id = offer.data.alias?.id ?? h
        if (!disabled.includes(id)) result.set(id, { id, cid: h, type, peerId: MARKET_PEER, label: offer.data.name?.content ?? valueContent(s, h).data.description?.content ?? 'Capability', enabled: true, active: true, path })
      }
      for (const edge of valueContent(s, cid).children) if (isRowEdge(s, edge) && !isRowOfType(s, edge, REF_TYPE)) { const id = content(s, identityCid(s, edge)).data.alias?.id; if (id) walk([...path, id]) }
    }
    walk([])
    return [...result.values()]
  })
}
