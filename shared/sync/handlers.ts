/** Bindings, menus, and executors must discover handlers through the same scoped declarations. */
import { primitive } from './primitives'
import { peerNode } from './graph'
import { TEMPLATE_TYPE, REF_TYPE } from './library-types'
import type { FosStore } from '../dag-implementation/store'
import { handlerOfferId, publishedTemplateId } from './graph'
import { sameCapabilityType } from './capabilities'

import { membershipOf, libAt, readMembers, MARKET_PEER, capabilityOfTarget, content, identityCid, isMemberEdge, marketMemberOf, memberHandlers, put, refNodeContent, advertisedRows, memberHandlerRows, resolveScope, isRowEdge, isRowOfType, valueContent, withMainBranchPolicy, type Capability, type Scope } from './graph'

import { addMemberAt, setHandlerOffersAt, headCid, type Replica } from './replica'

import { marketGrantsAt } from './market'

import { contextMemberRefs, policyIdentity, visibleBindings, bindingTree, submissionRef, type ScopedBinding, type BindingAccess } from './scope-bindings'
export { contextMemberRefs } from './scope-bindings'

import { importNodes, reachableNodes } from './graph'

import { transferRefGraph } from './ref-transfer'
import { resolveBinding } from './bindings'

export type HandlerEnvironment = BindingAccess
export type HandlerOffer = { id: string; cid: string; type: string; peerId: string; label: string; refPath?: string[]; refIds?: string[]; scope?: { store: FosStore; path: Scope }; capability?: Capability; enabled: boolean; active: boolean; binding?: ScopedBinding }

/** Presentation adapter: scope and submissions are supplied by the shared resolver. */
export function discoverHandlers(r: Replica, path: Scope, environment: HandlerEnvironment = {}): HandlerOffer[] {
  const result: HandlerOffer[] = []
  for (const binding of visibleBindings(r, path, environment).flatMap(binding => bindingTree(binding, environment))) {
    const capability = capabilityOfTarget(binding.store, binding.pattern)
    for (const value of binding.submissions) {
      const cid = submissionRef(binding, value)
      if (binding.store !== r.store) importNodes(r.store, reachableNodes(binding.store, [cid, binding.pattern]))
      const resolved = resolveBinding(r.store, null, cid === binding.cid || binding.assignments.length > 1 ? binding : cid, [], undefined,
        { ...environment, checkDependencies: false, scope: { replica: { ...r, store: binding.store }, path: binding.scope.path } })
      if (!result.some(offer => offer.peerId === value.peerId && offer.cid === cid)) result.push({ id: binding.id, cid, type: binding.pattern,
        binding, peerId: value.peerId, refPath: binding.refPath, refIds: binding.refIds, scope: binding.scope,
        label: binding.name ?? content(binding.store, value.cid).data.description?.content ?? capability ?? binding.id,
        ...(capability ? { capability } : {}), enabled: value.enabled && resolved.status === 'ready', active: value.active })
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
  if (!parent || !valueContent(r.store, parent).children.some(e => identityCid(r.store, e) === cid && isRowOfType(r.store, e, TEMPLATE_TYPE))) throw new Error('Only template rows can be published.')
  const type = primitive(r.store, 'template'), peerId = r.meta.peerId
  const id = publishedTemplateId(peerId, templatePath.at(-1)!)
  const publishedValue = transferRefGraph(r, cid, templatePath, [...at, id], true)
  if (!contextMemberRefs(r, at).has(peerId)) r = addMemberAt(r, at, peerId, peerId, [], now)
  const handler = put(r.store, refNodeContent(r.store, { alias: { id }, name: { content: label.trim() || valueContent(r.store, cid).data.description?.content || 'Template' } }, publishedValue, []))
  const existing = discoverHandlers(r, at).filter(o => o.peerId === peerId && o.type === type && o.id !== id).map(o => o.cid)
  r = setHandlerOffersAt(r, at, peerId, type, [...existing, handler], now)
  if (!market) return r
  if (!marketMemberOf(r.store, resolveScope(r.store, headCid(r), at)!)) r = addMemberAt(r, at, MARKET_PEER, 'Fos market', marketGrantsAt(r.store, headCid(r), at), now)
  const node = content(r.store, policyIdentity(r.store, resolveScope(r.store, headCid(r), at)!))
  const published = memberHandlerRows(r.store, node, MARKET_PEER, primitive(r.store, 'grants')).filter(([pattern, h]) => sameCapabilityType(r.store, pattern, type) && content(r.store, h).data.alias?.id !== id).map(([, h]) => h)
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
      for (const [type, h] of member ? memberHandlerRows(s, node, MARKET_PEER, primitive(s, 'grants')) : []) {
        const offer = content(s, h), id = offer.data.alias?.id ?? h
        if (!disabled.includes(id)) result.set(id, { id, cid: h, type, peerId: MARKET_PEER, label: offer.data.name?.content ?? valueContent(s, h).data.description?.content ?? 'Capability', enabled: true, active: true, path })
      }
      for (const edge of valueContent(s, cid).children) if (isRowEdge(s, edge) && !isRowOfType(s, edge, REF_TYPE)) { const id = content(s, identityCid(s, edge)).data.alias?.id; if (id) walk([...path, id]) }
    }
    walk([])
    return [...result.values()]
  })
}
