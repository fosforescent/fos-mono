/**
 * An allocation is rows: what resource (`resourceType`, `unit`), how much (`amount`), when (`start`, `end`), from whom
 * (`by`, `at`), where (`place`, `lat`, `lng`) and from which bank. A pattern carries the rows it constrains (a demand
 * for 50 USD: type, unit, amount); a value of it carries those and its own (a grant: its amount, its nonce).
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { libraryNode, put, refValueCid, isRefNode, type ResourceType } from './graph'
import { fieldText, leafValue } from './fields'

export type Allocation = {
  resource: string; type: ResourceType; amount: number; unit: string
  /** Null means no lower/upper time bound, including money and other non-calendar resources. */
  start?: number | null; end?: number | null
  by?: string; at?: number
  /** Location allocations ("at Paris"): the place, by name and/or coordinates (a device's position). */
  location?: { name?: string; lat?: number; lng?: number }
}
/** What a bank holds: a resource and its unit, over an optional time window. */
export type BankResource = { type: ResourceType; unit: string; start?: number | null; end?: number | null }
/** What a pattern says of an allocation: its resource and unit, and what else it constrains. */
export type AllocationShape = Omit<Allocation, 'amount' | 'resource'> & { amount?: number; resource?: string }

/** The rows of an allocation, by field. Absent and unbounded values have no row. */
export function allocationRows(store: FosStore, allocation: Partial<Allocation>): FosPathElem[] {
  const rows: FosPathElem[] = []
  const row = (name: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return
    const field = libraryNode(store, name)
    if (!field) throw new Error(`The library in this scope has no ${name} field.`)
    rows.push([field, fieldText(store, field, value)])
  }
  row('resourceType', allocation.type); row('unit', allocation.unit); row('amount', allocation.amount)
  row('start', allocation.start); row('end', allocation.end); row('by', allocation.by); row('at', allocation.at); row('bank', allocation.resource)
  row('place', allocation.location?.name); row('lat', allocation.location?.lat); row('lng', allocation.location?.lng)
  return rows
}
/** A grant's nonce row: what tells two grants of equal amount apart. Authority is a value, so each issue is a new one. */
export function nonceRow(store: FosStore, nonce: string): FosPathElem {
  const field = libraryNode(store, 'nonce')
  if (!field) throw new Error('The library in this scope has no nonce field.')
  return [field, fieldText(store, field, nonce)]
}

/** The node an allocation is read from: a ref's value, else the node itself. */
function holder(store: FosStore, cid: string): FosNodeContent | undefined {
  const node = store.table.get(cid)
  if (!node || !isRefNode(store, node)) return node
  const value = refValueCid(store, node)
  return value ? store.table.get(value) : undefined
}
/** What the rows of `cid` (through a ref) say of an allocation, or null when they name no resource. */
export function allocationShapeOf(store: FosStore, cid: string): AllocationShape | null {
  const node = holder(store, cid)
  if (!node) return null
  const read = (name: string): string | number | null => {
    const field = libraryNode(store, name)
    const edge = field ? node.children.find(([left]) => left === field) : undefined
    return edge ? leafValue(store, edge[1]) : null
  }
  const type = read('resourceType'), unit = read('unit')
  if (typeof type !== 'string' || typeof unit !== 'string') return null
  const number = (name: string) => { const value = read(name); return typeof value === 'number' ? value : undefined }
  const text = (name: string) => { const value = read(name); return typeof value === 'string' ? value : undefined }
  const place = text('place'), lat = number('lat'), lng = number('lng')
  const shape: AllocationShape = { type: type as ResourceType, unit }
  const amount = number('amount'), start = number('start'), end = number('end'), by = text('by'), at = number('at'), bank = text('bank')
  if (amount !== undefined) shape.amount = amount
  if (start !== undefined) shape.start = start
  if (end !== undefined) shape.end = end
  if (by !== undefined) shape.by = by
  if (at !== undefined) shape.at = at
  if (bank !== undefined) shape.resource = bank
  if (place !== undefined || lat !== undefined || lng !== undefined) shape.location = { ...(place !== undefined ? { name: place } : {}), ...(lat !== undefined ? { lat } : {}), ...(lng !== undefined ? { lng } : {}) }
  return shape
}
/** The allocation the rows of `cid` hold (an amount of a resource), or null. */
export function allocationOf(store: FosStore, cid: string): Allocation | null {
  const shape = allocationShapeOf(store, cid)
  return shape && shape.amount !== undefined ? { ...shape, amount: shape.amount, resource: shape.resource ?? '' } : null
}
/** A node with its allocation rows replaced by those of `allocation`. */
export function withAllocation(store: FosStore, node: FosNodeContent, allocation: Partial<Allocation>): FosNodeContent {
  const fields = new Set(['resourceType', 'unit', 'amount', 'start', 'end', 'by', 'at', 'bank', 'place', 'lat', 'lng'].map(name => libraryNode(store, name)).filter(Boolean))
  return { ...node, children: [...node.children.filter(([left]) => !fields.has(left)), ...allocationRows(store, allocation)] }
}
/** The cid of `node` with `allocation`'s rows. */
export function putWithAllocation(store: FosStore, node: FosNodeContent, allocation: Partial<Allocation>): string {
  return put(store, withAllocation(store, node, allocation))
}
