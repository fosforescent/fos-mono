/**
 * Primitives: the only nodes host code reads, and the only way host code reaches the graph. A primitive is
 * `{ ["primitive", "<name>"] }`, a row whose left is the string "primitive" and whose right names what host code means
 * by it; everything else is matched structurally in the graph. A host registers what it implements as definitions:
 * each is published as a handler ref under the host's member entry in a scope, through the same declaration every
 * handler goes through, and its local meaning is attached to the primitive its value names.
 */
import { labelRow } from './fields'
import { matchesGraph, tag, capabilityName } from './structural'
import { hashContent } from '../dag-implementation/cid'
import type { FosPathElem } from '../types'
import { putNode, type FosStore } from '../dag-implementation/store'
import { content, enclosingScopes, handlerOfferId, libAt, put, refNodeContent, isRefNode, valueCidOf, type Scope } from './graph'
import { addMemberAt, addRow, headCid, setHandlerOffersAt, type Replica } from './replica'
import { contextMemberRefs, discoverHandlers } from './handlers'
import { sameCapabilityType } from './capabilities'
import type { EvaluationStep, StepExecutor } from './evaluation'
import type { NodeProvider } from './node-provider'
import type { PrimitiveFunction } from './operands'
import type { TriggerObserver } from './triggers'
import { refSubmissions, refValueCompatible } from './scoped-refs'

const text = (store: FosStore, value: string) => putNode(store, { data: { scalar: { type: 'text', value } }, children: [] })
const cached = new WeakMap<FosStore, Map<string, string>>()
export function primitive(store: FosStore, name: string): string {
  let names = cached.get(store)
  if (!names) cached.set(store, names = new Map())
  const known = names.get(name)
  if (known && store.table.has(known)) return known
  const cid = putNode(store, { data: {}, children: [[text(store, 'primitive'), text(store, name)]] })
  names.set(name, cid)
  return cid
}
/** The name of a primitive node, or null when the node is not one. */
export function primitiveName(store: FosStore, cid: string): string | null {
  const node = store.table.get(cid)
  if (!node || node.children.length !== 1 || Object.keys(node.data).length) return null
  const [left, right] = node.children[0]!
  const marker = store.table.get(left)?.data.scalar, name = store.table.get(right)?.data.scalar
  return marker?.value === 'primitive' && name?.type === 'text' && typeof name.value === 'string' ? name.value : null
}

/**
 * How node exchange reaches a peer from this device (a connection: the account session, a direct link, another store on
 * this machine, ...). `attachment`: the part of an address on that peer this device is attached at (a request's scope);
 * `available`: whether the connection can carry a request now.
 */
export type NodeTransport = Omit<NodeProvider, 'id'> & { attachment(address: Scope): Scope; available(): boolean }
/** What host code means by a primitive in this store. */
export type PrimitiveImplementation = {
  /** Compiled operands in, values out (sync/operands.ts). */
  run?: PrimitiveFunction
  trigger?: TriggerObserver
  /** Narrows which rows of the capability it runs, while the library's patterns are not refined enough to say. */
  handles?(step: EvaluationStep, replica: Replica): boolean
  /** A peer's node transport: the local meaning of its `provideNode` offer (`nodeTransportAt`). */
  provideNode?: NodeTransport
}
export type PrimitiveDefinition = PrimitiveImplementation & {
  /** The host's name for it (`device:fetch`, `fos:search`): the primitive its handler value names. */
  id: string
  label?: string
  /** The library capability it implements, by field name, or the capability node itself for a scope. */
  capability: string | ((store: FosStore, at: Scope) => string)
}
/** The capability node a definition implements, in the scope of `at`. */
export const definitionCapability = (definition: Pick<PrimitiveDefinition, 'capability'>, store: FosStore, at: Scope): string =>
  typeof definition.capability === 'function' ? definition.capability(store, at) : libAt(store, at).capabilities[definition.capability]!

/**
 * A handler: a value of its capability holding its primitive as a member, as a node holds a peer: the row
 * `[primitive, entry]`, whose entry says where it runs (its host) and is where what it may see is granted.
 */
export type Primitive = { implementation: string; host: string }
/** The member row a handler value holds for its primitive `named`, running at `host`. */
export function primitiveMemberRow(store: FosStore, named: string, host: string): FosPathElem {
  const entry = put(store, { data: { alias: { id: hashContent({ data: { peerId: { content: host } }, children: [[named, named]] }) }, peerId: { content: host } }, children: [] })
  return [named, entry]
}
/** The primitive a handler value holds as a member and the host it runs at, or null when it holds none. */
export function hostedPrimitive(store: FosStore, value: string): { primitive: string; host: string } | null {
  for (const [left, right] of store.table.get(value)?.children ?? []) {
    const host = primitiveName(store, left) !== null ? store.table.get(right)?.data.peerId?.content : undefined
    if (host) return { primitive: left, host }
  }
  return null
}
/** Where the handler value's primitive runs: the host its member entry names, or null. */
export const hostOf = (store: FosStore, value: string): string | null => hostedPrimitive(store, value)?.host ?? null

/**
 * The handler ref for a definition, as graph content only: a value of its capability naming the definition's primitive.
 * It carries an implementation identity, never executable source or host credentials. `name`: what the offer is called
 * when one implementation backs several offers (an MCP server's tools); the definition's id by default.
 */
export function handlerRef(store: FosStore, host: string, definition: Pick<PrimitiveDefinition, 'id' | 'label' | 'capability'>, at: Scope = [], name = definition.id): string {
  const type = definitionCapability(definition, store, at), label = definition.label ?? definition.id
  const named = primitive(store, definition.id)
  const { alias: _alias, name: _name, ...properties } = content(store, type).data
  // a handler is a value of its capability: it carries the capability's tag, and holds the primitive that gives it meaning
  // here as a member, as a node holds a peer
  const value = put(store, { data: properties, children: [...content(store, type).children, tag(store, type), primitiveMemberRow(store, named, host), labelRow(store, label)] })
  return put(store, refNodeContent(store, { alias: { id: handlerOfferId(host, type, name) }, name: { content: label } }, value, []))
}
/** The handler ref a host publishes for a definition, with what it means here (`implementation`, the definition by default). */
export function primitiveRef(store: FosStore, host: string, definition: PrimitiveDefinition, implementation: unknown = definition, at: Scope = []): string {
  const ref = handlerRef(store, host, definition, at)
  store.implementations.set(primitive(store, definition.id), { value: implementation, type: definitionCapability(definition, store, at) })
  return ref
}

/** The primitive a handler value holds. */
export function implementationOf(store: FosStore, value: string): string | null {
  return hostedPrimitive(store, value)?.primitive ?? null
}
/** What host code means by the handler value's implementation in this store, when this host has one. */
export function primitiveImplementation<T>(store: FosStore, value: string): { value: T; type: string } | undefined {
  const implementation = implementationOf(store, value)
  return implementation ? store.implementations.get(implementation) as { value: T; type: string } | undefined : undefined
}
export function primitiveValue(store: FosStore, cid: string): Primitive | null {
  const hosted = hostedPrimitive(store, cid), name = hosted && primitiveName(store, hosted.primitive)
  return name && hosted ? { implementation: name, host: hosted.host } : null
}

/** Explicit graph mutation: publish a ref under its host. Merely constructing a primitive advertises nothing. */
export function publishPrimitive(replica: Replica, at: Scope, host: string, ref: string, now: number, label = host): Replica {
  const node = content(replica.store, ref), type = refSubmissions(replica.store, ref).map(cid => primitiveImplementation(replica.store, cid)?.type).find(Boolean)
  if (!node.data.alias || !type) throw new Error('Expected a typed ref declaration.')
  if (!contextMemberRefs(replica, at).has(host)) replica = addMemberAt(replica, at, host, label, [], now)
  const offers = discoverHandlers(replica, at).filter(offer => offer.peerId === host && sameCapabilityType(replica.store, offer.type, type))
  if (offers.some(offer => offer.cid === ref)) return replica
  return setHandlerOffersAt(replica, at, host, type, [...offers.filter(offer => offer.id !== node.data.alias!.id).map(offer => offer.cid), ref], now)
}
/** Publish a host's definition in `at` (once) and give it its local meaning. */
export function registerPrimitive(r: Replica, at: Scope, host: string, definition: PrimitiveDefinition, now: number, label = host, implementation: unknown = definition): Replica {
  return publishPrimitive(r, at, host, primitiveRef(r.store, host, definition, implementation, at), now, label)
}
export function registerPrimitives(r: Replica, at: Scope, host: string, definitions: PrimitiveDefinition[], now: number, label = host): Replica {
  for (const definition of definitions) r = registerPrimitive(r, at, host, definition, now, label)
  return r
}
/** After a reload or a store swap: published refs keep their pinned capability; only the local meaning is restored. */
export function restorePrimitive(replica: Replica, at: Scope, host: string, definition: PrimitiveDefinition, implementation: unknown = definition): void {
  const store = replica.store
  for (const offer of discoverHandlers(replica, at).filter(offer => offer.peerId === host)) {
    for (const value of refSubmissions(store, offer.cid)) {
      const published = primitiveValue(store, value)
      if (published?.host !== host || published.implementation !== definition.id) continue
      store.implementations.set(implementationOf(store, value)!, { value: implementation, type: offer.type })
    }
  }
}
export function restorePrimitives(r: Replica, at: Scope, host: string, definitions: PrimitiveDefinition[]): void {
  for (const definition of definitions) restorePrimitive(r, at, host, definition)
}

/** The local meanings of the primitives published in scope, with their hosts and refs. */
export function primitiveValues<T = PrimitiveImplementation>(replica: Replica, at: Scope, host?: string): Array<{ implementation: T; host: string; ref: string }> {
  const result: Array<{ implementation: T; host: string; ref: string }> = []
  const stores = [...new Set(enclosingScopes(replica.store, headCid(replica), at).map(scope => scope.store))]
  for (const offer of discoverHandlers(replica, at).filter(offer => offer.enabled && offer.active && (!host || offer.peerId === host))) {
    for (const cid of refSubmissions(replica.store, offer.cid)) {
      const published = primitiveValue(replica.store, cid)
      if (!published || published.host !== offer.peerId) continue
      const bound = stores.map(store => primitiveImplementation<T>(store, cid)).find(value => !!value)
      if (!bound || !refValueCompatible(replica.store, offer.type, cid)) continue
      result.push({ implementation: bound.value, host: published.host, ref: offer.cid })
    }
  }
  return result
}
/** The primitives (as their local meanings) that can run a step, with their hosts. */
export function primitiveExecutors<T extends Pick<PrimitiveImplementation, 'handles'> & { run?: unknown } = PrimitiveImplementation>(replica: Replica, step: EvaluationStep, host?: string): Array<{ implementation: T; host: string; ref: string }> {
  const parent = step.path.slice(0, -1), offers = discoverHandlers(replica, parent)
  return primitiveValues<T>(replica, parent, host).filter(value => {
    if (!value.implementation.run) return false
    const offer = offers.find(offer => offer.cid === value.ref && offer.peerId === value.host)!
    return instructionPrimitives(replica, step).length ? matchesInstructionRef(replica, step, offer) : value.implementation.handles ? value.implementation.handles(step, replica) : matchesInstructionRef(replica, step, offer)
  }).filter((value, index, values) => values.findIndex(other => other.implementation === value.implementation && other.host === value.host) === index)
}
/** The executors a host offers a step, as the evaluator takes them. */
export function stepExecutors(r: Replica, step: EvaluationStep, host?: string): StepExecutor[] {
  return primitiveExecutors(r, step, host).flatMap(value => value.implementation.run ? [{ run: value.implementation.run, primitive: primitiveValue(r.store, valueCidOf(r.store, value.ref))?.implementation ?? value.host }] : [])
}

/**
 * Offer `peer`'s node transport in the chosen scope: a primitive of the `provideNode` capability, published once; later
 * calls only give it its local meaning again.
 */
export function offerNodeTransport(replica: Replica, peer: string, transport: NodeTransport, now: number, at: Scope = []): Replica {
  return registerPrimitive(replica, at, peer, { id: 'transport', label: peer, capability: 'provideNode' }, now, peer, { provideNode: transport })
}
/** What reaches `peer` from the node at `at`: the transport of its enabled `provideNode` offer in scope, when it can carry a request now. */
export function nodeTransportAt(replica: Replica, at: Scope, peer: string): (NodeProvider & Pick<NodeTransport, 'attachment'>) | null {
  const type = libAt(replica.store, at).capabilities.provideNode!
  const offers = new Set(discoverHandlers(replica, at).filter(offer => offer.peerId === peer && sameCapabilityType(replica.store, offer.type, type)).map(offer => offer.cid))
  const candidates = primitiveValues(replica, at, peer).filter(value => offers.has(value.ref) && value.implementation.provideNode?.available())
  const transports = [...new Set(candidates.map(value => value.implementation.provideNode!))]
  if (transports.length > 1) throw new Error('Choose a node transport handler in this scope.')
  return transports.length ? { id: peer, ...transports[0]! } : null
}

/** A row's instruction is its left node: a handler ref, or the capability a requirement asks for. */
export function instructionRefType(replica: Replica, step: EvaluationStep): string | null {
  const left = step.row?.typeCid ?? step.row?.type
  return left && replica.store.table.has(left) ? left : null
}
export function instructionPrimitives(replica: Replica, step: EvaluationStep): Primitive[] {
  const left = step.row?.typeCid ?? step.row?.type
  if (!left || !replica.store.table.has(left)) return []
  return refSubmissions(replica.store, left).flatMap(cid => { const value = primitiveValue(replica.store, cid); return value ? [value] : [] })
}
export function matchesInstructionRef(replica: Replica, step: EvaluationStep, offered: { type: string; cid?: string }): boolean {
  const wanted = instructionRefType(replica, step)
  if (!wanted) return false
  const pinned = instructionPrimitives(replica, step)
  if (pinned.length) {
    if (!offered.cid) return false
    const expected = refSubmissions(replica.store, (step.row?.typeCid ?? step.row?.type)!)
    // One implementation can back several tools; its accepted value identifies the selected tool.
    if (!refSubmissions(replica.store, offered.cid).some(cid => expected.includes(cid))) return false
  }
  // the offer's capability generalizes the row's left: a refined pattern (a requirement for 50 USD) is still a row of its capability
  const refined = capabilityName(replica.store, wanted) !== null
  return !!offered.cid && ((refined && matchesGraph(replica.store, offered.type, wanted, { side: 'left' })) || matchesGraph(replica.store, wanted, offered.cid))
}

/** Put the selected ref on the instruction side, leaving the right side for inputs and outputs. */
export function addRefCall(replica: Replica, at: string[], handler: string, now: number, id?: string): Replica {
  const ref = replica.store.table.get(handler)
  if (!ref?.data.alias || !isRefNode(replica.store, ref)) throw new Error('Select a declared handler ref.')
  return addRow(replica, at, handler, ref.data.name?.content ?? ref.data.alias.id, now, { id })
}
