/** Compile supply locators before interpreting requirement evidence. */
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent } from '../types'
import { allocationMatches, childRows, content, demandOf, flowOf, isTaskRow, put, typeIdOf, valueContent, type Scope } from './graph'
import { allocationValue } from './destructure'
import { isAllocationType, QUERY_TYPE } from './library-types'
import { nodeOccurrence, resolveRefIdentity, type RefAccess } from './ref-paths'
import { constructNodeValue, readGraphValue } from './node-values'
import { assertCompiledGraph } from './ref-compiler'
import { sameUser, userOf, userPeerId, type UserRecord } from './users'

type Requirement = NonNullable<FosDataContent['requirement']>
type Allocation = NonNullable<FosDataContent['allocation']>
type RequirementMetadata = { request: Requirement | null; user: UserRecord | null; cyclic: boolean; unavailable?: boolean; outputsBlocked?: boolean; outputs: Array<{ allocation?: Allocation }> }
type Evidence = {
  kind: 'allocation' | 'task' | 'search' | 'supply' | 'other'
  allocation?: Allocation
  user: UserRecord | null
  completed?: boolean
  executed?: boolean
  supply?: { capability: string; by: string; choice?: number }
  linked?: boolean
  missing?: boolean
}
const compiling = new WeakMap<FosStore, Set<string>>()

/** Only scalar allocation constraints are evidence; the bank binding belongs to resource accounting. */
function allocationEvidence(value: Allocation | undefined): Allocation | undefined {
  if (!value) return undefined
  const { type, unit, amount, start, end, location } = value
  return { resource: '', type, unit, amount, ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}), ...(location ? { location } : {}) }
}

export function compileRequirement(store: FosStore, cid: string, at = nodeOccurrence(store, cid) ?? undefined, access: RefAccess = {}): string {
  if (access.canRead && !access.canRead(store, cid, at ?? [])) {
    const metadata = constructNodeValue(store, { request: null, user: null, cyclic: false, unavailable: true, outputs: [] }).cid
    return put(store, { data: {}, children: [[metadata, put(store, { data: {}, children: [] })]] })
  }
  const active = compiling.get(store) ?? new Set<string>(); compiling.set(store, active)
  const cyclic = active.has(cid) || active.size >= 100
  if (!cyclic) active.add(cid)
  try {
    const request = demandOf(valueContent(store, cid))
    let outputsBlocked = false
    const outputs = childRows(store, cid).flatMap(row => {
      if (access.canRead && !access.canRead(store, row.cid, [...at ?? [], content(store, row.cid).data.alias?.id ?? row.cid])) { outputsBlocked = true; return [] }
      const node = content(store, row.cid)
      return node.data.ref && node.data.name ? [{ ...(node.data.allocation ? { allocation: allocationEvidence(node.data.allocation) } : {}) }] : []
    })
    const metadata = constructNodeValue(store, { request: request ?? null, user: userOf(store, valueContent(store, cid)), cyclic, outputs, outputsBlocked }).cid
    const declarations = new Map<FosStore, Map<string, string>>()
    let slots = 0
    const declaration = (source: FosStore, path: Scope | undefined, node: string) => {
      if (!declarations.has(source)) declarations.set(source, new Map())
      const key = path ? JSON.stringify([path.slice(0, -1), content(source, node).data.name?.content ?? path.at(-1)]) : node
      const refs = declarations.get(source)!
      if (!refs.has(key)) refs.set(key, put(store, { data: { refDeclaration: { slot: slots++ } }, children: [] }))
      return refs.get(key)!
    }
    const entries: Array<[string, string]> = []
    if (!cyclic) for (const row of childRows(store, cid)) {
      const rowPath = at && [...at, content(store, row.cid).data.alias?.id ?? row.cid]
      if (access.canRead && !access.canRead(store, row.cid, rowPath ?? [])) {
        entries.push([declaration(store, rowPath, row.cid), constructNodeValue(store, { kind: 'other', user: null, missing: true }).cid])
        continue
      }
      // Output declarations are projections of fulfillment, never evidence for their own source.
      if (content(store, row.cid).data.ref && content(store, row.cid).data.name) continue
      const flow = flowOf(row.type, row.value)
      const evidence: Evidence = { kind: 'other', user: userOf(store, row.value) }
      let source = declaration(store, at && [...at, content(store, row.cid).data.alias?.id ?? row.cid], row.cid)
      if (isAllocationType(row.type) && flow.allocation) {
        evidence.kind = 'allocation'; evidence.allocation = allocationEvidence(allocationValue(store, row.cid, access))
      } else if (isTaskRow(store, row.edge)) {
        evidence.kind = 'task'; evidence.completed = !!row.value.data.todo?.completed
      } else if (row.type === QUERY_TYPE) {
        evidence.kind = 'search'; evidence.executed = !!row.value.data.query?.executedAt
      }
      if (isAllocationType(row.type) && flow.supply) {
        const supply = flow.supply
        evidence.supply = { capability: supply.capability, by: supply.by, ...(supply.choice !== undefined ? { choice: supply.choice } : {}) }
        if (evidence.kind === 'other') evidence.kind = 'supply'
        if (supply.ref) {
          const resolved = at && resolveRefIdentity({ store }, at, supply.ref, access)
          const found = resolved && resolved.status === 'ready' ? resolved.locations[0] : undefined
          evidence.linked = !!found
          evidence.missing = !found
          if (found) source = declaration(found.store, found.path, found.cid)
          if (found && supply.capability === 'allocation') {
            const target = valueContent(found.store, found.cid)
            evidence.allocation = found.pattern && isAllocationType(typeIdOf(found.store, found.pattern) ?? '') ? allocationEvidence(allocationValue(found.store, found.cid, access)) : undefined
            evidence.user = userOf(found.store, target)
          }
        }
      }
      entries.push([source, constructNodeValue(store, evidence).cid])
    }
    const graph = put(store, { data: {}, children: [[metadata, put(store, { data: {}, children: entries })]] })
    assertCompiledGraph(store, [graph])
    return graph
  } finally { if (!cyclic) active.delete(cid) }
}

/** No editor identities, replica, lexical lookup, or mutable reference resolution is available to this checker. */
export function checkCompiledRequirement(store: FosStore, cid: string): { satisfied: boolean; progress: { have: number; need: number } | null; problems: string[] } {
  assertCompiledGraph(store, [cid])
  const frame = content(store, cid).children
  if (frame.length !== 1) throw new Error('Invalid compiled requirement frame.')
  const [metadata, entries] = frame[0]!
  const { request: req, user: named, cyclic, unavailable } = readGraphValue(store, metadata) as unknown as RequirementMetadata
  if (unavailable) return { satisfied: false, progress: null, problems: ['The requirement is unavailable in this scope.'] }
  if (!req) return { satisfied: true, progress: null, problems: [] }
  const problems: string[] = cyclic ? ['Cyclic requirement dependency.'] : []
  let satisfied = false, have = 0
  const counted = new Map<string, string>()
  for (const [source, value] of content(store, entries).children) {
    const slot = content(store, source).data.refDeclaration?.slot
    if (slot === undefined || !Number.isSafeInteger(slot) || slot < 0) throw new Error('Invalid compiled evidence declaration.')
    const evidence = readGraphValue(store, value) as unknown as Evidence
    if (evidence.missing) problems.push('The supplied reference is unavailable in this scope for validation.')
    const matches = allocationMatches(req, evidence.allocation, { required: named, given: evidence.user })
    const fills = matches && (req.amount === undefined || evidence.allocation!.amount >= req.amount)
    if (req.capability === 'allocation' && (evidence.kind === 'allocation' || evidence.supply?.capability === 'allocation' && evidence.linked)) {
      if (evidence.allocation) {
        const value = constructNodeValue(store, { allocation: evidence.allocation, user: evidence.user }).cid
        if (!counted.has(source)) { counted.set(source, value); if (matches) have += evidence.allocation.amount }
        else if (counted.get(source) !== value) problems.push('Conflicting supplied allocations for the same reference.')
      }
      if (fills) satisfied = true
    }
    if (req.capability === 'task' && evidence.kind === 'task' && evidence.completed ||
      req.capability === 'search' && evidence.kind === 'search' && evidence.executed) satisfied = true
    if (req.capability === 'peer' && evidence.kind === 'allocation' && evidence.allocation?.type === 'person' &&
      (!named || !!evidence.user && sameUser(named, evidence.user)) && (!req.peer || !!evidence.user && userPeerId(evidence.user) === req.peer)) satisfied = true
    const supply = evidence.supply
    if (!supply || supply.capability !== req.capability) continue
    switch (req.capability) {
      case 'allocation': break
      case 'task': case 'search': satisfied ||= !!evidence.linked; break
      case 'choice': satisfied ||= typeof supply.choice === 'number' && (!req.options || supply.choice >= 0 && supply.choice < req.options.length); break
      case 'verify': satisfied ||= !!supply.by && !!named?.verification; break
      case 'peer': satisfied ||= !!supply.by && (!req.peer || supply.by === req.peer) && (!named || supply.by === userPeerId(named) || supply.by === named.username); break
      default: satisfied ||= !!supply.by
    }
  }
  const progress = req.capability === 'allocation' && req.amount !== undefined ? { have, need: req.amount } : null
  if (progress && progress.need > 0 && progress.have >= progress.need) satisfied = true
  return { satisfied: satisfied && !problems.length, progress, problems }
}

/** Project a declared output from compiled evidence. The source binding is local to the returned graph. */
export function checkCompiledRequirementOutput(store: FosStore, cid: string, index: number): { cid?: string; error?: string } {
  const checked = checkCompiledRequirement(store, cid)
  const [metadata, entries] = content(store, cid).children[0]!
  const { request: req, outputs, outputsBlocked } = readGraphValue(store, metadata) as unknown as RequirementMetadata
  if (outputsBlocked) return { error: 'The source requirement outputs are not accessible.' }
  if (!req || !['allocation', 'choice'].includes(req.capability)) return { error: 'The source is no longer an amount or choice requirement.' }
  if (!Number.isSafeInteger(index) || index < 0 || !outputs[index]) return { error: 'The placeholder is no longer part of the source requirement.' }
  if (!checked.satisfied) return { error: 'The source requirement must be fulfilled first.' }
  if (req.capability === 'allocation') {
    const slice = outputs[index]!.allocation
    const total = outputs.reduce((sum, output) => sum + (output.allocation?.amount ?? 0), 0)
    if (!slice || !Number.isFinite(slice.amount) || slice.amount <= 0 || req.amount === undefined || total > req.amount + 1e-9 ||
      slice.amount > req.amount || slice.type !== (req.resource ?? 'account') || slice.unit !== (req.unit ?? 'USD')) return { error: 'The pieces no longer fit the source requirement.' }
    const source = put(store, { data: { refDeclaration: { slot: 0 } }, children: [] })
    return { cid: put(store, { data: { allocation: { ...slice, resource: source }, description: { content: `${slice.amount} ${slice.unit}` } }, children: [[source, cid]] }) }
  }
  const choices = [...new Set(content(store, entries).children.flatMap(([, value]) => {
    const evidence = readGraphValue(store, value) as unknown as Evidence
    return evidence.supply?.capability === 'choice' && evidence.supply.choice !== undefined ? [evidence.supply.choice] : []
  }))]
  if (choices.length !== 1 || !req.options?.[choices[0]!]) return { error: 'Choose exactly one constructor for the source requirement.' }
  return { cid: put(store, { data: { description: { content: req.options[choices[0]!]! } }, children: [] }) }
}
