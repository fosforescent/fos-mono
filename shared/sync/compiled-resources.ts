/** Bind editable resource locators before accounting. The checker consumes only this immutable graph. */
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent } from '../types'
import { content, put, rowView, valueContent, type Scope, type TaskView } from './graph'
import { view, type Replica } from './replica'
import { resolveRefIdentity } from './ref-paths'
import { assertCompiledGraph } from './ref-compiler'
import { TEMPLATE_TYPE } from './library-types'
import { resolveBinding } from './bindings'
import { scopedBindingKey, type ScopedBinding } from './scope-bindings'

export type ResourceSelection = { path: Scope; row: TaskView | null }
export type CompiledResources = { cid: string; problems: string[] }
type ResourceDeclaration = ScopedBinding

/** The frame binds declaration CIDs to resource values, retaining distinct declarations with equal values. */
export function compileResources(r: Replica, selected: ResourceSelection[]): CompiledResources {
  const problems: string[] = []
  const bindings: Array<{ location: ResourceDeclaration; ref: string; row: TaskView; allocations: string[] }> = []
  const declarations = new Map<FosStore, Map<string, number>>()
  const lookup = (path: Scope, id: string, replica = r): ResourceDeclaration | undefined => {
    const found = resolveRefIdentity(replica, path.slice(0, -1), id)
    return found.status === 'ready' ? found.locations[0] : undefined
  }
  const key = scopedBindingKey
  const indexOf = (location: ResourceDeclaration) => declarations.get(location.store)?.get(key(location))
  for (const step of selected) {
    if (!step.row?.allocation?.resource) continue
    const location = lookup(step.path, step.row.allocation.resource)
    if (!location?.pattern) { problems.push(`Resource bank for ${step.row.title} is unavailable in this scope.`); continue }
    const claim = step.row.allocation
    const capability = put(r.store, { data: { resource: { type: claim.type, unit: claim.unit } }, children: [] })
    const binding = resolveBinding(r.store, capability, location)
    if (binding.status !== 'ready') { problems.push(...binding.problems); continue }
    const resource = valueContent(r.store, binding.cid!).data.resource
    if (!resource) { problems.push(`Resource bank for ${step.row.title} is unavailable.`); continue }
    const row = rowView(r.store, binding.cid!, [location.pattern, binding.cid!])
    row.resource = { ...resource, allocated: 0, available: resource.capacity ?? null }
    if (indexOf(location) !== undefined) continue
    if (!declarations.has(location.store)) declarations.set(location.store, new Map())
    const slot = bindings.length
    declarations.get(location.store)!.set(key(location), slot)
    bindings.push({ location, ref: put(r.store, { data: { refDeclaration: { slot } }, children: [] }), row, allocations: [] })
  }
  // Enumerate competing allocations at compilation. Their resource pointers resolve lexically, never by global ID.
  let count = 0
  const walk = (replica: Replica, path: Scope, seen = new Set<string>()) => {
    if (path.length > 64 || count > 10000) throw new Error('Too many resource rows to check safely.')
    for (const row of view(replica, path)?.tasks ?? []) {
      const at = [...path, row.id], occurrence = JSON.stringify(at)
      if (seen.has(occurrence)) continue
      seen.add(occurrence); count++
      if (row.type === TEMPLATE_TYPE) continue
      const source = row.allocation?.resource ? lookup(at, row.allocation.resource, replica) : undefined
      const index = source && indexOf(source)
      if (row.allocation && index !== undefined) {
        const binding = bindings[index]!, a = row.allocation
        // Accounting's input is a resource claim; supply receipts and editor metadata have no part in it.
        const allocation: NonNullable<FosDataContent['allocation']> = { resource: binding.ref, type: a.type, unit: a.unit, amount: a.amount,
          ...(a.start !== undefined ? { start: a.start } : {}), ...(a.end !== undefined ? { end: a.end } : {}) }
        binding.allocations.push(put(r.store, { data: { allocation, description: { content: row.title } }, children: [] }))
      }
      if (row.childCount) walk(replica, at, seen)
    }
  }
  if (bindings.length) for (const store of new Set([r.store, ...bindings.map(binding => binding.location.store)])) walk({ ...r, store }, [])
  const cid = put(r.store, { data: {}, children: bindings.map(binding => {
    const bank = binding.row.resource!
    const value = put(r.store, { data: { description: { content: binding.row.title }, resource: { type: bank.type, unit: bank.unit,
      ...(bank.capacity !== undefined ? { capacity: bank.capacity } : {}) } },
      children: binding.allocations.map(allocation => [binding.ref, allocation]) })
    return [binding.ref, value]
  }) })
  assertCompiledGraph(r.store, [cid])
  return { cid, problems }
}

/** Pure resource accounting. No replica, source paths, UUIDs, or ambient lookup is available here. */
export function checkCompiledResources(store: FosStore, cid: string): string[] {
  assertCompiledGraph(store, [cid])
  const errors: string[] = [], declared = new Set<string>()
  for (const [ref, value] of content(store, cid).children) {
    const slot = content(store, ref).data.refDeclaration?.slot
    if (slot === undefined || !Number.isSafeInteger(slot) || slot < 0 || declared.has(ref)) throw new Error('Invalid compiled resource declaration.')
    declared.add(ref)
    const bank = content(store, value), resource = bank.data.resource
    if (!resource) throw new Error('Compiled resource has no bound value.')
    if (resource.capacity !== undefined && (!Number.isFinite(resource.capacity) || resource.capacity < 0)) {
      errors.push(`Invalid resource bank: ${bank.data.description?.content ?? ''}`); continue
    }
    const changes: Array<{ at: number; amount: number }> = []
    for (const [target, claim] of bank.children) {
      const row = content(store, claim), allocation = row.data.allocation
      if (target !== ref || !allocation || allocation.resource !== ref) throw new Error('Compiled allocation refers outside its resource binding.')
      const a = allocation
      if (!Number.isFinite(a.amount) || a.amount < 0 || a.type !== resource.type || a.unit !== resource.unit ||
        a.start !== undefined && !Number.isFinite(a.start) || a.end !== undefined && !Number.isFinite(a.end) ||
        (a.end !== undefined && a.start !== undefined && a.end <= a.start)) {
        errors.push(`Invalid allocation: ${row.data.description?.content ?? ''}`); continue
      }
      changes.push({ at: a.start ?? -Infinity, amount: a.amount }, { at: a.end ?? Infinity, amount: -a.amount })
    }
    let amount = 0
    for (const change of changes.sort((a, b) => a.at - b.at || a.amount - b.amount)) {
      amount += change.amount
      if (resource.capacity !== undefined && amount > resource.capacity + 1e-9) {
        errors.push(`Insufficient ${bank.data.description?.content ?? ''}: overlapping allocations exceed ${resource.capacity} ${resource.unit}.`); break
      }
    }
  }
  return errors
}
