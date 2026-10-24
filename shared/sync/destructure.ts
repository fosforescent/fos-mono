import { compileRequirement, checkCompiledRequirementOutput } from './compiled-requirements'
/** Requirement outputs are named typed refs pointing at their source's stable identity. */
import type { FosStore } from '../dag-implementation/store'
import { newId, importNodes, reachableNodes, commitRoot, content, demandOf, identityCid, put, refNodeContent, isRefNode, rowTypeOf, refValueCid, resolveScope, updateAtScope, valueContent, type Scope } from './graph'
import { headCid, type Replica } from './replica'
import { nodeOccurrence, resolveRefIdentity, type RefAccess } from './ref-paths'
import { bindingProperties, type ScopedBinding } from './scope-bindings'
import type { FosDataContent } from '../types'

export function requirementOutputs(store: FosStore, cid: string) {
  return valueContent(store, cid).children.flatMap(edge => {
    const ref = content(store, identityCid(store, edge)), type = rowTypeOf(store, edge)
    return type && edge[0] === type && ref.data.ref && ref.data.name ? [{ cid: identityCid(store, edge), id: ref.data.alias!.id, name: ref.data.name.content, amount: ref.data.allocation?.amount, type }] : []
  })
}

export function destructureRequirement(r: Replica, path: Scope, name: string, amount: number | undefined, now: number): Replica {
  if (!name.trim()) throw new Error('Name the placeholder.')
  const cid = resolveScope(r.store, headCid(r), path)
  const source = cid && valueContent(r.store, cid), req = source && demandOf(source)
  if (!cid || !req || !['allocation', 'choice'].includes(req.capability)) throw new Error('Choose an amount or choice requirement.')
  const outputs = requirementOutputs(r.store, cid)
  if (outputs.some(o => o.name === name.trim())) throw new Error('That placeholder name is already used.')
  if (req.capability === 'allocation' && (amount === undefined || !Number.isFinite(amount) || amount <= 0 || req.amount === undefined || outputs.reduce((sum, o) => sum + (o.amount ?? 0), 0) + amount > req.amount + 1e-9)) throw new Error('The pieces must be positive and cannot exceed the required amount.')
  const type = req.capability === 'allocation' ? r.store.primitive.allocationField.getId() : r.store.primitive.documentField.getId()
  const ref = put(r.store, refNodeContent(r.store, { alias: { id: newId() }, name: { content: name.trim() }, ref: { id: path.at(-1)! }, ...(req.capability === 'allocation' ? { allocation: { type: req.resource ?? 'account', resource: path.at(-1)!, amount: amount!, unit: req.unit ?? 'USD' } } : {}) }, null, []))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: [...node.children, [type, ref]] })), now)
  return { ...r }
}

/** Bind the editable output and compile its evidence. Source mappings must stay outside the returned value graph. */
export function resolveRequirementOutput(store: FosStore, cid: string, at?: Scope, access: RefAccess = {}): { cid?: string; error?: string; source?: ScopedBinding; binding?: ScopedBinding } | null {
  const ref = content(store, cid)
  if (!isRefNode(store, ref) || !ref.data.ref || !ref.data.name) return null
  if (ref.data.ref.owner || ref.data.ref.peer) return { error: 'The source requirement needs an accessible handler in this scope.' }
  const scope = at ?? nodeOccurrence(store, cid)?.slice(0, -1)
  if (!scope) return { error: 'The placeholder is no longer part of an unambiguous scope.' }
  const resolved = resolveRefIdentity({ store }, scope, ref.data.ref.id, access)
  const source = resolved.status === 'ready' ? resolved.locations[0] : undefined
  if (!source) return { error: 'The source requirement is unavailable in this scope.' }
  const sourceCid = source.cid
  const outputs = requirementOutputs(source.store, sourceCid)
  const index = outputs.findIndex(output => output.id === ref.data.alias?.id)
  if (index < 0) return { error: 'The placeholder is no longer part of the source requirement.' }
  const result = checkCompiledRequirementOutput(source.store, compileRequirement(source.store, sourceCid, source.path, access), index)
  if (result.cid && source.store !== store) importNodes(store, reachableNodes(source.store, [result.cid]))
  const binding = bindingProperties(source, access).bindings.find(binding => binding.cid === outputs[index]!.cid)
  return { ...result, source, binding }
}

/** Bind an output as a typed property; the constructor may keep this as a record field. */
export function linkRequirementOutput(r: Replica, path: Scope, outputCid: string, now: number): Replica {
  const output = r.store.table.get(outputCid)
  const resolved = output?.data.ref && resolveRefIdentity(r, path.slice(0, -1), output.data.ref.id)
  const sourceCid = resolved && resolved.status === 'ready' && resolved.locations[0]?.cid
  const type = sourceCid && requirementOutputs(r.store, sourceCid).find(row => row.cid === outputCid)?.type
  if (!output?.data.ref || !type) throw new Error('Drop a requirement placeholder.')
  const sourcePath = resolved && resolved.status === 'ready' ? resolved.locations[0]!.path : []
  if (path.length === sourcePath.length && path.every((id, index) => id === sourcePath[index])) throw new Error('A requirement cannot be supplied by its own output.')
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('Destination no longer exists.')
  const allocation = valueContent(r.store, cid).data.allocation
  if (allocation && type !== r.store.primitive.allocationField.getId()) throw new Error('An allocation needs an amount placeholder.')
  const name = allocation ? 'amount' : output.data.name?.content ?? 'value'
  const target = put(r.store, refNodeContent(r.store, { alias: { id: newId() }, name: { content: name } }, outputCid, []))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, value => ({ ...value, children: [...value.children.filter(edge => !(edge[0] === type && content(r.store, identityCid(r.store, edge)).data.name?.content === name)), [type, target]] })), now)
  return { ...r }
}

const resolvingAllocations = new WeakMap<FosStore, Set<string>>()
/** Project a compiled output back into an editable allocation; retain the source locator only in this UI/compiler projection. */
export function resolveAllocationValue(store: FosStore, cid: string, access: RefAccess = {}): { value?: NonNullable<FosDataContent['allocation']>; debit?: { cid: string; binding: ScopedBinding }; error?: string } {
  const value = valueContent(store, cid), original = value.data.allocation
  if (!original) return {}
  const argument = value.children.find(edge => edge[0] === store.primitive.allocationField.getId() && content(store, edge[1]).data.name?.content === 'amount')
  if (!argument) return { value: original }
  const active = resolvingAllocations.get(store) ?? new Set<string>(); resolvingAllocations.set(store, active)
  if (active.has(cid)) return { error: 'Cyclic allocation dependency.' }
  active.add(cid)
  try {
    let current: string | null = argument[1]
    const seen = new Set<string>()
    while (current && !seen.has(current) && seen.size < 100) {
      seen.add(current)
      const scope = nodeOccurrence(store, cid)?.slice(0, -1)
      if (!scope) return { error: 'The allocation needs its declaring scope.' }
      const output = resolveRequirementOutput(store, current, scope, access)
      if (output) return output.cid && output.source && output.binding
        ? { value: { ...original, ...content(store, output.cid).data.allocation, resource: output.source.path.at(-1)! }, debit: { cid: output.cid, binding: output.binding } }
        : { error: output.error ?? 'The allocation output is unavailable.' }
      current = refValueCid(store, content(store, current))
    }
    return { error: 'The allocation output is unavailable.' }
  } finally { active.delete(cid) }
}

/** Editor projection only. Accounting must retain the debit graph returned by resolveAllocationValue. */
export function allocationValue(store: FosStore, cid: string, access: RefAccess = {}) {
  return resolveAllocationValue(store, cid, access).value
}
