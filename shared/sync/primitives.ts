import { matchesGraph, tag } from './structural'
/** Host-language implementations are opaque execute-only values, constructed as graph refs. */
import type { FosStore } from '../dag-implementation/store'
import { content, put, refNodeContent, isRefNode, resolveScope } from './graph'
import { libAt, sameCapabilityType } from './capabilities'
import { addRow, headCid, type Replica } from './replica'
import type { EvaluationStep } from './evaluation'
import { refSubmissions } from './scoped-refs'

export type Primitive = { implementation: string; host: string; access: 'execute' }

export function primitiveConstructor(store: FosStore): string {
  return put(store, { data: { name: { content: 'fos:constructor:primitive' }, description: { content: 'Host primitive' } }, children: [] })
}

/** The constructor carries an implementation identity, never executable source or host credentials. */
export function primitiveRef(store: FosStore, input: { id: string; implementation?: string; type: string; host: string; label?: string; native?: unknown }): string {
  const primitive = put(store, { data: { primitive: { implementation: input.implementation ?? input.id, host: input.host, access: 'execute' } }, children: [] })
  if (input.native) store.getNodeByAddress(primitive)!.nativeImplementation = { value: input.native, type: input.type }
  const { alias: _alias, capabilityDefinition: _capability, ...properties } = content(store, input.type).data
  if (_capability || properties.form) { delete properties.name; delete properties.description }
  // a handler is a value of its capability: it carries the capability's tag, and the primitive that gives it meaning here
  const value = put(store, { data: { ...properties, peerId: { content: input.host }, description: properties.description ?? { content: input.label ?? input.id } }, children: [...content(store, input.type).children, tag(store, input.type), [primitiveConstructor(store), primitive]] })
  return put(store, refNodeContent(store, { alias: { id: input.id }, name: { content: input.label ?? input.id } }, value, []))
}

/** The local meaning lives on the runtime graph node, not in a handler-name lookup table. */
export function primitiveImplementation<T>(store: FosStore, value: string): { value: T; type: string } | undefined {
  const edge = store.table.get(value)?.children.find(([type]) => type === primitiveConstructor(store))
  return edge ? store.getNodeByAddress(edge[1])?.nativeImplementation as { value: T; type: string } | undefined : undefined
}

export function primitiveValue(store: FosStore, cid: string): Primitive | null {
  const node = store.table.get(cid)
  const edge = node?.children.find(([type]) => type === primitiveConstructor(store))
  const primitive = edge && store.table.get(edge[1])?.data.primitive
  return primitive?.access === 'execute' && !!primitive.implementation && !!primitive.host ? primitive : null
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
