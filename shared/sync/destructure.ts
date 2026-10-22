/** Requirement outputs are named typed refs pointing at their source's stable identity. */
import type { FosStore } from '../dag-implementation/store'
import { newId, childRows, commitRoot, content, demandOf, findRowByAlias, flowOf, identityCid, put, refNodeContent, isRefNode, rowTypeOf, refValueCid, requirementSatisfied, resolveScope, rootTargetCid, updateAtScope, valueContent, type Scope } from './graph'
import { isAllocationType } from './library-types'
import { headCid, type Replica } from './replica'

export function requirementOutputs(store: FosStore, cid: string) {
  return valueContent(store, cid).children.flatMap(edge => {
    const ref = content(store, identityCid(store, edge)), type = rowTypeOf(store, edge)
    return type && edge[0] === type && ref.data.ref ? [{ cid: identityCid(store, edge), id: ref.data.alias!.id, name: ref.data.name?.content ?? 'Value', amount: ref.data.allocation?.amount, type }] : []
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

/** Resolve at use time; no funds or selected values are fabricated while a requirement is unfilled. */
export function resolveRequirementOutput(store: FosStore, cid: string): { cid?: string; error?: string } | null {
  const ref = content(store, cid)
  if (!isRefNode(store, ref) || !ref.data.ref) return null
  if (ref.data.ref.owner) return { error: 'The source requirement is outside this workspace.' }
  const source = findRowByAlias(store, rootTargetCid(store), ref.data.ref.id)
  if (!source) return { error: 'The source requirement is unavailable.' }
  const sourceCid = resolveScope(store, rootTargetCid(store), [...source.path, source.row.id])!
  const currentOutput = requirementOutputs(store, sourceCid).find(output => output.id === ref.data.alias?.id)
  if (!currentOutput) return { error: 'The placeholder is no longer part of the source requirement.' }
  const req = demandOf(valueContent(store, sourceCid))
  if (!req || !['allocation', 'choice'].includes(req.capability)) return { error: 'The source is no longer an amount or choice requirement.' }
  if (!requirementSatisfied(store, sourceCid)) return { error: 'The source requirement must be fulfilled first.' }
  if (req.capability === 'allocation') {
    const slice = content(store, currentOutput.cid).data.allocation
    const total = requirementOutputs(store, sourceCid).reduce((sum, o) => sum + (o.amount ?? 0), 0)
    if (!slice || !Number.isFinite(slice.amount) || slice.amount <= 0 || req.amount === undefined || total > req.amount + 1e-9 || slice.amount > req.amount || slice.type !== (req.resource ?? 'account') || slice.unit !== (req.unit ?? 'USD')) return { error: 'The pieces no longer fit the source requirement.' }
    return { cid: put(store, { data: { allocation: slice, description: { content: `${slice.amount} ${slice.unit}` } }, children: [] }) }
  }
  const choices = [...new Set(childRows(store, sourceCid).map(row => isAllocationType(row.type) ? flowOf(row.type, row.value).supply?.choice : undefined).filter((n): n is number => n !== undefined))]
  if (choices.length !== 1 || !req.options?.[choices[0]!]) return { error: 'Choose exactly one constructor for the source requirement.' }
  return { cid: put(store, { data: { description: { content: req.options[choices[0]!]! } }, children: [] }) }
}

/** Bind an output as a typed property; the constructor may keep this as a record field. */
export function linkRequirementOutput(r: Replica, path: Scope, outputCid: string, now: number): Replica {
  const output = r.store.table.get(outputCid)
  const source = output?.data.ref && findRowByAlias(r.store, headCid(r), output.data.ref.id)
  const sourceCid = source && resolveScope(r.store, headCid(r), [...source.path, source.row.id])
  const type = sourceCid && requirementOutputs(r.store, sourceCid).find(row => row.cid === outputCid)?.type
  if (!output?.data.ref || !type) throw new Error('Drop a requirement placeholder.')
  if (path.includes(output.data.ref.id)) throw new Error('A requirement cannot be supplied by its own output.')
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
/** An allocation's amount argument is resolved live, using the same output ref as record properties. */
export function allocationValue(store: FosStore, cid: string) {
  const value = valueContent(store, cid), original = value.data.allocation
  if (!original) return undefined
  const argument = value.children.find(edge => edge[0] === store.primitive.allocationField.getId() && content(store, edge[1]).data.name?.content === 'amount')
  if (!argument) return original
  const active = resolvingAllocations.get(store) ?? new Set<string>(); resolvingAllocations.set(store, active)
  if (active.has(cid)) return undefined
  active.add(cid)
  try {
    let current: string | null = argument[1]
    const seen = new Set<string>()
    while (current && !seen.has(current) && seen.size < 100) {
      seen.add(current)
      const output = resolveRequirementOutput(store, current)
      if (output) return output.cid ? { ...original, ...content(store, output.cid).data.allocation } : undefined
      current = refValueCid(store, content(store, current))
    }
    return undefined
  } finally { active.delete(cid) }
}
