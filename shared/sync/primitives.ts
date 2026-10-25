import { matchesGraph, tag } from './structural'
import { putNode, type FosStore } from '../dag-implementation/store'
import { content, put, refNodeContent, isRefNode } from './graph'
import { addRow, type Replica } from './replica'
import type { EvaluationStep } from './evaluation'
import { refSubmissions } from './scoped-refs'

/**
 * Primitives are the only nodes host code reads: `{ ["primitive", "<name>"] }`, a row whose left is the string
 * "primitive" and whose right names what host code means by it. Everything else is matched structurally in the graph.
 */
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

/** A handler: a value of its capability whose `implementation` row names the primitive host code runs for it. */
export type Primitive = { implementation: string; host: string }

/** The handler ref; it carries an implementation identity, never executable source or host credentials. */
export function primitiveRef(store: FosStore, input: { id: string; implementation?: string; type: string; host: string; label?: string; implement?: unknown }): string {
  const implementation = primitive(store, input.implementation ?? input.id)
  if (input.implement) store.implementations.set(implementation, { value: input.implement, type: input.type })
  const { alias: _alias, capabilityDefinition: _capability, ...properties } = content(store, input.type).data
  if (_capability || properties.form) { delete properties.name; delete properties.description }
  // a handler is a value of its capability: it carries the capability's tag, and the primitive that gives it meaning here
  const value = put(store, { data: { ...properties, peerId: { content: input.host }, description: properties.description ?? { content: input.label ?? input.id } }, children: [...content(store, input.type).children, tag(store, input.type), [primitive(store, 'implementation'), implementation]] })
  return put(store, refNodeContent(store, { alias: { id: input.id }, name: { content: input.label ?? input.id } }, value, []))
}

/** The primitive a handler value names in its `implementation` row. */
export function implementationOf(store: FosStore, value: string): string | null {
  return store.table.get(value)?.children.find(([left]) => left === primitive(store, 'implementation'))?.[1] ?? null
}

/** What host code means by the handler value's implementation in this store, when this host has one. */
export function primitiveImplementation<T>(store: FosStore, value: string): { value: T; type: string } | undefined {
  const implementation = implementationOf(store, value)
  return implementation ? store.implementations.get(implementation) as { value: T; type: string } | undefined : undefined
}

export function primitiveValue(store: FosStore, cid: string): Primitive | null {
  const implementation = implementationOf(store, cid), name = implementation && primitiveName(store, implementation)
  const host = store.table.get(cid)?.data.peerId?.content
  return name && host ? { implementation: name, host } : null
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
    // One native implementation can back several tools; its accepted value identifies the selected tool.
    if (!refSubmissions(replica.store, offered.cid).some(cid => expected.includes(cid))) return false
  }
  // the offer's capability generalizes the row's left: a refined pattern (a requirement for 50 USD) is still a row of its capability
  const refined = !!replica.store.table.get(wanted)?.data.capabilityDefinition
  return !!offered.cid && ((refined && matchesGraph(replica.store, offered.type, wanted, { side: 'left' })) || matchesGraph(replica.store, wanted, offered.cid))
}

/** Put the selected ref on the instruction side, leaving the right side for inputs and outputs. */
export function addRefCall(replica: Replica, at: string[], handler: string, now: number, id?: string): Replica {
  const ref = replica.store.table.get(handler)
  if (!ref?.data.alias || !isRefNode(replica.store, ref)) throw new Error('Select a declared handler ref.')
  return addRow(replica, at, handler, ref.data.name?.content ?? ref.data.alias.id, now, { id })
}
