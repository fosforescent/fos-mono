/** Ref declarations register handlers. Native constructors only give graph values their local meaning. */
import type { FosStore } from '../dag-implementation/store'
import { content, enclosingScopes, put, refNodeContent, type Scope } from './graph'
import { addMemberAt, headCid, setHandlerOffersAt, type Replica } from './replica'
import { contextMemberRefs, discoverHandlers } from './handlers'
import { sameCapabilityType } from './capabilities'
import type { EvaluationStep } from './evaluation'
import { refSubmissions, refValueCompatible } from './scoped-refs'
import { primitiveRef, primitiveValue, primitiveImplementation, matchesInstructionRef, instructionPrimitives } from './primitives'

export type NativeImplementation<Context> = {
  trigger?: import('./triggers').TriggerObserver
  handles?(step: EvaluationStep, replica: Replica): boolean
  effect?(context: Context): Promise<void | 'pending'>
}
export type PrimitiveDefinition<Context> = NativeImplementation<Context> & {
  id: string
  type(store: FosStore): string
  label?: string
}

export function nativeRef<Context>(store: FosStore, host: string, definition: PrimitiveDefinition<Context>, native: NativeImplementation<Context> = definition): string {
  return primitiveRef(store, { id: definition.id, type: definition.type(store), host, label: definition.label, native })
}

/** Explicit graph mutation: publish a ref under its host. Merely constructing a primitive advertises nothing. */
export function publishNativeRef(replica: Replica, at: Scope, host: string, ref: string, now: number, label = host): Replica {
  const node = content(replica.store, ref), type = refSubmissions(replica.store, ref).map(cid => primitiveImplementation(replica.store, cid)?.type).find(Boolean)
  if (!node.data.alias || !type) throw new Error('Expected a typed ref declaration.')
  if (!contextMemberRefs(replica, at).has(host)) replica = addMemberAt(replica, at, host, label, [], now)
  const offers = discoverHandlers(replica, at).filter(offer => offer.peerId === host && sameCapabilityType(replica.store, offer.type, type))
  if (offers.some(offer => offer.cid === ref)) return replica
  return setHandlerOffersAt(replica, at, host, type, [...offers.filter(offer => !offer.legacy && offer.id !== node.data.alias!.id).map(offer => offer.cid), ref], now)
}

/** Walk the registered refs, then execute the local meaning of their accepted primitive values. */
export function primitiveExecutors<Context, Native extends NativeImplementation<Context> = NativeImplementation<Context>>(replica: Replica, step: EvaluationStep, host?: string): Array<{ native: Native; host: string; ref: string }> {
  const offers = discoverHandlers(replica, step.path)
  return nativeRefValues<Context, Native>(replica, step.path, host).filter(value => {
    if (!value.native.effect) return false
    const offer = offers.find(offer => offer.cid === value.ref && offer.peerId === value.host)!
    return instructionPrimitives(replica, step).length ? matchesInstructionRef(replica, step, offer) : value.native.handles ? value.native.handles(step, replica) : matchesInstructionRef(replica, step, offer)
  }).filter((value, index, values) => values.findIndex(other => other.native === value.native && other.host === value.host) === index)
}

export function nativeRefValues<Context, Native extends NativeImplementation<Context> = NativeImplementation<Context>>(replica: Replica, at: Scope, host?: string): Array<{ native: Native; host: string; ref: string }> {
  const result: Array<{ native: Native; host: string; ref: string }> = []
  const stores = [...new Set(enclosingScopes(replica.store, headCid(replica), at).map(scope => scope.store))]
  for (const offer of discoverHandlers(replica, at).filter(offer => offer.enabled && offer.active && (!host || offer.peerId === host))) {
    for (const cid of refSubmissions(replica.store, offer.cid)) {
      const primitive = primitiveValue(replica.store, cid)
      if (!primitive || primitive.host !== offer.peerId) continue
      const bound = stores.map(store => primitiveImplementation<Native>(store, cid)).find(value => !!value)
      if (!bound) continue
      if (!refValueCompatible(replica.store, offer.type, cid)) continue
      result.push({ native: bound.value, host: primitive.host, ref: offer.cid })
    }
  }
  return result
}
