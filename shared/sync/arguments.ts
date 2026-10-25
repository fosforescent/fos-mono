/**
 * Arguments: the one kind of row that asks for or supplies a value. An argument row is `[pattern, ref]`, a
 * declaration whose pattern is a capability refined with what is demanded. Its polarity says which way the value
 * goes: a pattern with a `negative` row asks (a requirement: the ref is a hole until a value satisfying the pattern
 * is bound to it); one without supplies (an allocation: the ref holds the value). Supplying a requirement is binding
 * its ref, the way every ref is bound: a submission that is accepted.
 *
 * A value that pins a checking contract (a grant: a child row whose left is the `allocate` capability) is linear. It
 * is bound only by an invocation of that contract's handler, which consumes it from its owner (a bank: a ref row
 * whose value declares the contract and holds its grants as argument rows) and issues what is bound in its place.
 * The handler is the `allocateNative`: it checks conservation over compiled operands and proposes the owner's next
 * value and the issued grants; the evaluator publishes them together when the evaluation commits.
 */
import { primitive } from './primitives'
import { view as viewRows, headCid as rootCid } from './replica'
import { resolveScope as scopeCid, valueContent as valueAt } from './graph'
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent, FosNodeContent, FosPathElem } from '../types'
import {
  allocationContract, argumentSatisfied, bookkeepingOf, commitRoot, content, enclosingScopes, findEdge, grantEntries, identityCid, isRefNode, isRowEdge,
  isRowOfType, libAt, newId, ownerContract, patternOptions, put, refNodeContent, refValueCid, resolveScope, rowEdgeAt, updateAtScope, valueContent, withInputs, type ResourceType, type Scope
} from './graph'
import { addRow, edit, editNode, headCid, proposeRefAt, type Replica } from './replica'
import { acceptSubmission } from './approvals'
import { contextBindings, resolveBinding, type BindingEnvironment, type BindingResolution } from './bindings'
import { resolveRefExpression, resolveRefIdentity } from './ref-paths'
import { isNegative } from './parameters'
import { isClassifyingRow, isKindRow, tag, tagsOf, valueOfPattern } from './structural'
import { transactionValue } from './transactions'
import { REF_TYPE, RESOURCE_TYPE } from './library-types'
import type { Native } from './native'

export type Allocation = NonNullable<FosDataContent['allocation']>
export type Amount = Pick<Allocation, 'type' | 'amount' | 'unit'> & Partial<Pick<Allocation, 'start' | 'end'>>
/**
 * What a requirement demands, as authored: the capability whose handlers fill it and the refinement of its value (an
 * amount of a resource, the options of a choice), plus named inputs its handler reads (a recipient, a repository).
 */
export type Demand = {
  capability: string
  resource?: ResourceType; amount?: number; unit?: string; start?: number | null; end?: number | null
  options?: string[]
  /** The value is a container holding a row matching this (a done task typed inside the requirement). */
  contains?: FosNodeContent
  inputs?: Record<string, string>
}
export type Grant = { id: string; cid: string; contract: string; allocation: Allocation; ownerPath: Scope; issuer?: string; lineage: string[] }

const empty = (store: FosStore) => put(store, { data: {}, children: [] })
/** The row that ties a value to its checking contract: a tag with the contract's capability node. */
export function contractPin(store: FosStore, contract: string): FosPathElem { return tag(store, contract) }

// ---------------------------------------------------------------------------
// Patterns

/** The quantity-conservation capability of the library in scope: the contract grants pin and banks declare. */
export function allocateCapability(store: FosStore, at: Scope): string { return libAt(store, at).capabilities.allocate! }

/** A capability refined: the capability's node with `data` added and `rows` appended, inverted when `negative`. */
export function refinePattern(store: FosStore, at: Scope, capability: string, data: FosDataContent, rows: FosPathElem[], negative: boolean, container = false): string {
  // the refinement carries its capability as a tag: what the value is a value of, by the node's identity
  const base = content(store, capability)
  const { alias: _alias, ...rest } = base.data
  if (!container) rows = [tag(store, capability), ...rows]
  const polarity: FosPathElem[] = negative ? [[libAt(store, at).field('negative'), empty(store)]] : []
  // a sum of options replaces the capability's own open rows: the options are the alternatives
  // A container pattern (the value is rows the person adds inside the requirement) demands only those rows, none of
  // the capability's kind rows: a container is not a value of the capability, and a bare capability's hole is
  // filled by its handler, never by rows typed inside it.
  const kept = data.refAlternatives ? base.children.filter(edge => isClassifyingRow(store, edge, base) || isKindRow(store, edge)) : container ? [] : base.children
  return put(store, { data: { ...rest, ...data }, children: [...kept, ...rows, ...polarity] })
}

/** The pattern a requirement's value must satisfy: the demanded capability, refined. Resources demand authority: a grant of the contract. */
export function demandPattern(store: FosStore, at: Scope, demand: Demand): string {
  // a demand for a resource is a negative allocation: the grant that fills it is a value of the allocation capability
  const capability = libAt(store, at).capabilities[demand.resource ? 'allocation' : demand.capability]!
  const data: FosDataContent = {}, rows: FosPathElem[] = []
  if (demand.resource) {
    data.allocation = { resource: '', type: demand.resource, unit: demand.unit ?? '', ...(demand.amount !== undefined ? { amount: demand.amount } : {}),
      ...(demand.start !== undefined ? { start: demand.start } : {}), ...(demand.end !== undefined ? { end: demand.end } : {}) } as Allocation
    rows.push(contractPin(store, allocateCapability(store, at)))
  }
  if (demand.options) {
    data.refAlternatives = true
    for (const label of demand.options) rows.push([empty(store), put(store, { data: { description: { content: label } }, children: [] })])
  }
  if (demand.contains) rows.push([empty(store), put(store, demand.contains)])
  return refinePattern(store, at, capability, data, rows, true, !!demand.contains)
}

/** The pattern of a supplied allocation: a value of the resource and unit; `linear` ones are grants of the contract. */
export function allocationPattern(store: FosStore, at: Scope, allocation: Pick<Allocation, 'type' | 'unit'>, linear: boolean): string {
  const capability = libAt(store, at).capabilities.allocation!
  return refinePattern(store, at, capability, { allocation: { resource: '', type: allocation.type, unit: allocation.unit } as Allocation },
    linear ? [contractPin(store, allocateCapability(store, at))] : [], false)
}

/** Whether a pattern demands a grant: it pins the allocate contract. */
export function patternIsLinear(store: FosStore, pattern: string, at: Scope): boolean { return allocationContract(store, content(store, pattern), allocateCapability(store, at)) !== null }

// ---------------------------------------------------------------------------
// Rows

/** An argument row: the pattern on the left, a ref (filled with `value`, or a hole) on the right. */
export function argumentRow(store: FosStore, pattern: string, id: string, now: number, value: string | null, data: FosDataContent = {}): FosPathElem {
  return [pattern, put(store, refNodeContent(store, { alias: { id }, updated: { time: now }, ...data }, value))]
}

/** Add a requirement under `at`: an argument row asking for what `demand` says, titled `text`. */
export function addRequirement(r: Replica, at: Scope, text: string, now: number, demand: Demand, id = newId()): Replica {
  const store = r.store, pattern = demand.inputs ? withInputs(store, demandPattern(store, at, demand), demand.inputs) : demandPattern(store, at, demand)
  const row = argumentRow(store, pattern, id, now, null, { description: { content: text } })
  return edit(r, at, now, value => ({ ...value, children: [...value.children, row] }))
}

/**
 * Add a supplied allocation under `at`: an argument row holding `value` (a grant, when it was issued by a bank), or
 * the plain amount typed when there is none (data, not authority: nothing checks it and no requirement for authority
 * accepts it).
 */
export function addAllocation(r: Replica, at: Scope, text: string, now: number, allocation: Allocation, options: { id?: string; value?: string } = {}): Replica {
  const store = r.store
  const linear = !!options.value && allocationContract(store, content(store, options.value), allocateCapability(store, at)) !== null
  const pattern = allocationPattern(store, at, allocation, linear)
  const value = options.value ?? valueOfPattern(store, pattern, { description: { content: text }, allocation }, [], contractsOf(store, pattern))
  const row = argumentRow(store, pattern, options.id ?? newId(), now, value, { description: { content: text } })
  return edit(r, at, now, node => ({ ...node, children: [...node.children, row] }))
}

/** Whether the row `[pattern, cid]` is an argument row asking for a value it does not hold yet. */
export function isOpenRequirement(store: FosStore, edge: FosPathElem): boolean {
  const left = edge[0]
  return isRowEdge(store, edge) && isNegative(store, left) && !argumentSatisfied(store, identityCid(store, edge), left)
}

// ---------------------------------------------------------------------------
// Binding

/**
 * Bind the argument row at `path` to `value`, as `by`: a submission accepted by this replica's owner. A grant is
 * refused here: authority moves only through an allocate invocation (`consumeAllocation`), which binds it at commit.
 */
export function bindArgument(r: Replica, path: Scope, value: string, by: string, now: number): Replica {
  const store = r.store, cid = resolveScope(store, headCid(r), path)
  if (!cid || !isRefNode(store, content(store, cid))) throw new Error('Bind an argument row.')
  if (!store.table.has(value)) throw new Error('The bound value is unavailable.')
  if (allocationContract(store, content(store, value), allocateCapability(store, path.slice(0, -1)))) throw new Error('Authority is bound through an allocate invocation, not by hand.')
  return bindAccepted(r, path, value, by, now)
}
function bindAccepted(r: Replica, path: Scope, value: string, by: string, now: number): Replica {
  // An open requirement's container (rows written inside it before it was supplied) is not an alternative value: it
  // is replaced, not branched against. A value that does satisfy the pattern stays choosable.
  const store = r.store, cid = resolveScope(store, headCid(r), path)!, parent = resolveScope(store, headCid(r), path.slice(0, -1))
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${path.at(-1)}`) : undefined
  const current = refValueCid(store, content(store, cid))
  if (edge && current && !argumentSatisfied(store, cid, edge[0])) r = editNode(r, path, now, node => refNodeContent(store, node.data, null, bookkeepingOf(store, node)))
  const proposed = proposeRefAt(r, path, value, by, now, 'supply')
  return acceptSubmission(proposed.replica, path, proposed.proposalCid, r.meta.peerId, now).replica
}
/**
 * Bind a grant a host minted outside the graph (a payment the provider confirmed, points moved on the server's
 * ledger). This is the one place authority enters without an allocate invocation; it is for legacy effects until
 * those are natives whose bank is a row.
 */
export function bindIssuedAuthority(r: Replica, path: Scope, grant: string, by: string, now: number): Replica {
  if (!grantOf(r.store, grant, allocateCapability(r.store, path.slice(0, -1)))) throw new Error('Bind a grant.')
  return bindAccepted(r, path, grant, by, now)
}

/**
 * Supply the requirement at `at`/`id`: bind its ref. `ref` names a row visible from the requirement that fulfils it
 * (a done task, an allocation), `choice` picks one of its options, otherwise the supplier's answer is a value of the
 * demanded capability carrying `receipt`. Whether the value satisfies the pattern is what makes it satisfied.
 */
export function supplyRequirement(r: Replica, at: Scope, id: string, supply: { by: string; ref?: string; receipt?: string; choice?: number }, now: number): Replica {
  const store = r.store, path = [...at, id], parent = resolveScope(store, headCid(r), at)
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${id}`) : undefined
  if (!edge || !isRowEdge(store, edge) || !isNegative(store, edge[0])) throw new Error('Supply a requirement row.')
  const pattern = edge[0]
  let value: string
  if (supply.ref !== undefined) {
    const found = resolveRefIdentity(r, path, supply.ref)
    if (found.status !== 'ready') throw new Error('The supplied reference is not visible from the requirement.')
    value = put(store, { data: { ref: { id: supply.ref }, peerId: { content: supply.by } }, children: [] })
  } else if (supply.choice !== undefined) {
    const label = patternOptions(store, pattern)[supply.choice]
    if (label === undefined) throw new Error('Choose one of the declared options.')
    value = valueOfPattern(store, pattern, { description: { content: label } }, [], contractsOf(store, pattern))
  } else value = supplyValue(store, pattern, supply.by, supply.receipt)
  // what was written inside the open requirement (a handler's result, hit rows, an answer the supply refers to) stays in its value
  const cid = resolveScope(store, headCid(r), path), current = cid ? refValueCid(store, content(store, cid)) : null
  const carried = current && !grantOf(store, current, allocateCapability(store, at)) ? content(store, current).children.filter(edge => isRowEdge(store, edge) && !!content(store, identityCid(store, edge)).data.alias) : []
  if (carried.length) { const node = content(store, value); value = put(store, { ...node, children: [...node.children, ...carried] }) }
  return bindArgument(r, path, value, supply.by, now)
}

/** A handler's answer as a value of the demanded capability: it carries the capability's own rows and who supplied it. */
export function supplyValue(store: FosStore, pattern: string, by: string, receipt?: string): string {
  return valueOfPattern(store, pattern, { description: { content: receipt ? `${by}: ${receipt}` : `by ${by}` }, peerId: { content: by } }, [], contractsOf(store, pattern))
}
/** The contract tags of a pattern: every tag but the capability it refines (the first). */
function contractsOf(store: FosStore, pattern: string): string[] { return tagsOf(store, content(store, pattern)).slice(1) }

/** Who supplied the argument at `path`: the peer its value names, else the author or supplier of the row it refers to; null when unbound. */
export function argumentSupplier(r: Replica, path: Scope): string | null {
  const store = r.store, cid = resolveScope(store, headCid(r), path)
  const value = cid ? refValueCid(store, content(store, cid)) : null
  if (!value) return null
  const node = content(store, value)
  if (node.data.peerId) return node.data.peerId.content
  if (node.data.allocation?.by) return node.data.allocation.by
  if (!node.data.ref?.id) return null
  const found = resolveRefIdentity(r, path, node.data.ref.id)
  const target = found.status === 'ready' ? found.locations[0] : undefined
  if (!target) return null
  const held = valueContent(target.store, target.cid)
  return held.data.peerId?.content ?? held.data.allocation?.by ?? held.data.comment?.authorID ?? null
}

// ---------------------------------------------------------------------------
// Banks and grants

/**
 * An issued grant: a value of the allocation pattern `pattern` holding the amount, pinned to the contract, with who
 * issued it and the grants it came from.
 */
export function grantValue(store: FosStore, pattern: string, contract: string, allocation: Allocation, data: FosDataContent, lineage: string[] = []): string {
  // a grant is content: nothing the compiler strips (an alias, an edit time) may be part of it, or compiled and stored grants would differ
  const { alias: _alias, updated: _updated, ref: _ref, refExpression: _expression, refRole: _role, ...kept } = data
  return valueOfPattern(store, pattern, { ...kept, allocation, nonce: { value: newId() } },
    [contractPin(store, contract), ...lineage.map(cid => [primitive(store, 'previous'), cid] as FosPathElem)], [contract])
}

/** The grant a value is, or null for any other value. */
export function grantOf(store: FosStore, value: string, contract: string): { contract: string; allocation: Allocation } | null {
  if (!store.table.has(value)) return null
  const node = content(store, value)
  if (!allocationContract(store, node, contract)) return null
  return contract && node.data.allocation ? { contract, allocation: node.data.allocation } : null
}

/** A bank: a resource row whose value declares the contract its grants are checked by. */
export function addBank(r: Replica, at: Scope, text: string, now: number, resource: NonNullable<FosDataContent['resource']>, id = newId()): Replica {
  const store = r.store
  r = addRow(r, at, RESOURCE_TYPE, text, now, { id, resource })
  const contract = allocateCapability(store, at)
  return edit(r, [...at, id], now, value => ownerContract(store, value) ? value : { ...value, children: [...value.children, contractPin(store, contract)] })
}

function grantRows(store: FosStore, state: string, ownerPath: Scope): Grant[] {
  return grantEntries(store, state).map(entry => {
    const value = content(store, entry.cid)
    return { id: entry.id, cid: entry.cid, contract: entry.contract, allocation: entry.allocation, ownerPath,
      ...(value.data.peerId ? { issuer: value.data.peerId.content } : {}),
      lineage: value.children.filter(edge => edge[0] === primitive(store, 'previous')).map(edge => edge[1]) }
  })
}

/** The grants an owner holds: in the evaluation's view when one is running, else as accepted. */
export function ownerGrants(r: Replica, ownerPath: Scope, evaluationId?: string): Grant[] {
  const cid = resolveScope(r.store, headCid(r), ownerPath)
  if (!cid || !isRefNode(r.store, content(r.store, cid))) return []
  const state = evaluationId ? transactionValue(r, ownerPath, evaluationId) : refValueCid(r.store, content(r.store, cid))
  return state ? grantRows(r.store, state, ownerPath) : []
}

/** The grant the argument row at `path` holds, while an owner enclosing it still holds that grant; null once consumed. */
export function handleAt(r: Replica, path: Scope, evaluationId?: string, seen = new Set<string>()): Grant | null {
  const store = r.store, cid = resolveScope(store, headCid(r), path)
  if (!cid || seen.has(cid)) return null
  seen.add(cid)
  const node = content(store, cid)
  const reference = node.data.refExpression
    ? resolveRefExpression(r, path.slice(0, -1), node.data.refExpression)
    : node.data.ref?.id ? resolveRefIdentity(r, path.slice(0, -1), node.data.ref.id) : null
  if (reference) {
    const target = reference.status === 'ready' ? reference.locations[0] : null
    return target?.store === store ? handleAt(r, target.path, evaluationId, seen) : null
  }
  if (!isRefNode(store, node)) return null
  const value = evaluationId ? transactionValue(r, path, evaluationId) : refValueCid(store, content(store, cid))
  const grant = value ? grantOf(store, value, allocateCapability(store, path.slice(0, -1))) : null
  if (!value || !grant || !(grant.allocation.amount > 0)) return null
  for (const scope of enclosingScopes(store, headCid(r), path.slice(0, -1))) {
    if (scope.store !== store) break
    for (const edge of valueContent(store, scope.cid).children) {
      if (!isRowEdge(store, edge) || !isRowOfType(store, edge, RESOURCE_TYPE)) continue
      const ownerPath = [...scope.path, content(store, identityCid(store, edge)).data.alias?.id ?? '']
      const held = ownerGrants(r, ownerPath, evaluationId).find(entry => entry.cid === value)
      if (held) return held
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Invocations of the allocate handler

/** The handler for the allocate capability visible from `at`, through the same lookup as every other argument. */
export function resolveAllocateHandler(r: Replica, at: Scope, environment: BindingEnvironment = {}): BindingResolution {
  const type = allocateCapability(r.store, at)
  return resolveBinding(r.store, type, null, contextBindings(r, at, environment), undefined, { ...environment, scope: { replica: r, path: at }, checkDependencies: false })
}

/** Authority consumed: a handle row in the tree (visible from the invocation's scope), or a grant held by the bank itself. */
export type AllocationInput = Scope | { grant: string }
export type AllocationPlan = {
  /** The bank the authority moves within. */
  owner: Scope
  /** The authority consumed. None: a credit or debit of the bank itself. */
  inputs: AllocationInput[]
  /** The grants issued in their place, conserving the amount. One bound `to` a row rebinds that row to the grant. */
  outputs: Array<Amount & { title?: string; id?: string; to?: Scope }>
}

/** Author an allocation invocation under `at`. Nothing moves until it is evaluated and the evaluation commits. */
export function planAllocation(r: Replica, at: Scope, plan: AllocationPlan, now: number, id = newId()): Replica {
  const store = r.store
  if (!plan.outputs.length) throw new Error('Name the grants the transfer issues, including any remainder.')
  const handler = resolveAllocateHandler(r, at)
  if (handler.status !== 'ready' || !handler.binding) throw new Error(`No allocation checking handler is available here: ${handler.problems.join('; ')}`)
  const left = handler.binding.cid
  // A row is referred to as the resolver sees it from `at`: by its id when a declaration in an enclosing scope, else as a
  // property path from the nearest such declaration (a grant inside a bank: `bank.grant`).
  const visible = (target: Scope, what: string): FosDataContent => {
    for (let depth = target.length - 1; depth >= 0; depth--) {
      const alias = target[depth]!
      if (resolveRefIdentity(r, at, alias).status !== 'ready') continue
      const path = target.slice(depth)
      if (path.length === 1) return { ref: { id: alias } }
      if (resolveRefExpression(r, at, { up: 0, path, lexical: true }).status === 'ready') return { ref: { id: target.at(-1)! }, refExpression: { up: 0, path, lexical: true } }
    }
    throw new Error(`The ${what} is not visible from the invocation's scope.`)
  }
  const reference = (name: string, target: FosDataContent): FosPathElem =>
    rowEdgeAt(store, REF_TYPE, put(store, { data: { alias: { id: `${id}:${name}` }, name: { content: name }, ...target }, children: [] }), at)
  const invocation: FosNodeContent = { data: { alias: { id }, description: { content: plan.outputs.map(output => `${output.amount} ${output.unit}`).join(' + ') }, updated: { time: now } }, children: [] }
  invocation.children.push(reference('owner', visible(plan.owner, 'bank')))
  for (const [index, input] of plan.inputs.entries()) {
    if (Array.isArray(input)) {
      if (!handleAt(r, input)) throw new Error('An input must be a row holding authority.')
      invocation.children.push(reference(`in${index}`, visible(input, 'input handle')))
      continue
    }
    // a grant the bank holds is named by holding it: the in row is itself a handle to that value
    const grant = grantOf(store, input.grant, allocateCapability(store, at))
    if (!grant || !ownerGrants(r, plan.owner).some(entry => entry.cid === input.grant)) throw new Error('The allocation grant is unavailable: consumed, withdrawn, or not issued to this bank.')
    invocation.children.push(argumentRow(store, allocationPattern(store, at, grant.allocation, true), `${id}:in${index}`, now, input.grant, { name: { content: `in${index}` } }))
  }
  for (const [index, output] of plan.outputs.entries()) {
    if (!Number.isFinite(output.amount) || output.amount === 0 || (plan.inputs.length && output.amount < 0)) throw new Error('Every issued grant needs a positive amount.')
    const pattern = allocationPattern(store, at, output, true)
    const allocation: Allocation = { resource: '', type: output.type, amount: output.amount, unit: output.unit, ...(output.start !== undefined ? { start: output.start } : {}), ...(output.end !== undefined ? { end: output.end } : {}) }
    const data: FosDataContent = { alias: { id: output.id ?? newId() }, name: { content: `out${index}` }, refRole: 'output', updated: { time: now }, description: { content: output.title ?? `${output.amount} ${output.unit}` }, allocation,
      ...(output.to ? visible(output.to, 'output destination') : {}) }
    invocation.children.push([pattern, put(store, refNodeContent(store, data, null))])
  }
  commitRoot(store, updateAtScope(store, headCid(r), at, value => ({ ...value, children: [...value.children, [left, put(store, invocation)]] })), now)
  return { ...r }
}

/** Issue authority to the bank at `ownerPath`: an invocation with no inputs, evaluated from the bank's scope. */
export function issueGrant(r: Replica, ownerPath: Scope, amount: Amount, now: number, title = `${amount.amount} ${amount.unit}`, id = newId()): Replica {
  if (!(amount.amount > 0) || !Number.isFinite(amount.amount)) throw new Error('Issue a positive amount.')
  return planAllocation(r, ownerPath.slice(0, -1), { owner: ownerPath, inputs: [], outputs: [{ ...amount, title }] }, now, id)
}
/** Retire authority from the bank: a negative grant, checked and recorded like a credit; the bank holds the net. */
export function debitGrant(r: Replica, ownerPath: Scope, amount: Amount, now: number, title = `Debit ${amount.amount} ${amount.unit}`, id = newId()): Replica {
  if (!(amount.amount > 0) || !Number.isFinite(amount.amount)) throw new Error('Debit a positive amount.')
  return planAllocation(r, ownerPath.slice(0, -1), { owner: ownerPath, inputs: [], outputs: [{ ...amount, amount: -amount.amount, title }] }, now, id)
}

/**
 * Consume `amount` of the grant the row at `handle` holds: an invocation under `at` issuing the amount used (bound
 * `to` a requirement when given, else its own row under the invocation) and the explicit remainder, rebound to the handle.
 */
export function consumeAllocation(r: Replica, at: Scope, handle: Scope | { owner: Scope; grant: string }, amount: number, now: number, options: { to?: Scope; id?: string } = {}): Replica {
  const grant = Array.isArray(handle) ? handleAt(r, handle) : ownerGrants(r, handle.owner).find(entry => entry.cid === handle.grant)
  if (!grant) throw new Error('Choose an allocation to use.')
  if (!(amount > 0) || amount > grant.allocation.amount + 1e-9) throw new Error(`Use between 0 and ${grant.allocation.amount} ${grant.allocation.unit}.`)
  const remainder = grant.allocation.amount - amount, { type, unit } = grant.allocation
  const outputs: AllocationPlan['outputs'] = [{ type, unit, amount, title: `Used ${amount} ${unit}`, ...(options.to ? { to: options.to } : {}) }]
  // the remainder rebinds the handle it came from; a bank's own grant leaves its remainder with the bank
  if (remainder > 1e-9) outputs.push({ type, unit, amount: remainder, title: `${remainder} ${unit} remaining`, ...(Array.isArray(handle) ? { to: handle } : {}) })
  return planAllocation(r, at, { owner: grant.ownerPath, inputs: [Array.isArray(handle) ? handle : { grant: handle.grant }], outputs }, now, options.id)
}

/**
 * The allocate handler: check the invocation over its compiled operands and propose the owner's next state and the
 * issued grants. Inputs are consumed exactly once from one owner; outputs conserve the amount; every grant keeps the
 * contract the owner declares. Without inputs the invocation credits or debits the owner itself.
 */
export const allocateNative: Native = async (operands, context) => {
  const store = context.store
  const state = operands.inputs.owner
  if (!state) throw new Error('An allocation invocation names the bank it moves authority within.')
  const owner = content(store, state), contract = ownerContract(store, owner)
  if (!contract) throw new Error('The bank declares no checking contract.')
  const held = new Map(grantEntries(store, state).map(entry => [entry.cid, entry]))
  const inputs = Object.entries(operands.inputs).filter(([name]) => name.startsWith('in')).map(([, cid]) => cid)
  const outputs = Object.entries(operands.outputs).filter(([name]) => name.startsWith('out'))
  if (!outputs.length) throw new Error('A transition must issue its outputs explicitly, including any remainder.')
  if (new Set(inputs).size !== inputs.length) throw new Error('An allocation invocation names the same grant twice.')
  const consumed = inputs.map(cid => {
    const grant = grantOf(store, cid, contract)
    if (!grant) throw new Error('An input holds no authority.')
    if (!(grant.allocation.amount > 0)) throw new Error('A debit is not spendable authority.')
    if (grant.contract !== contract) throw new Error('An input grant is checked by a different capability than this bank.')
    if (!held.has(cid)) throw new Error('The allocation grant is unavailable: consumed, withdrawn, or not issued to this bank.')
    return grant.allocation
  })
  const issued = outputs.map(([name, output]) => {
    const allocation = output.data.allocation
    if (!allocation || !Number.isFinite(allocation.amount) || allocation.amount === 0) throw new Error('Every issued grant needs an amount.')
    if (inputs.length && !(allocation.amount > 0)) throw new Error('Every issued grant needs a positive amount.')
    if (!allocationContract(store, content(store, output.pattern), contract)) throw new Error('An output changes the checking contract of its supplying authority.')
    return { name, pattern: output.pattern, allocation, title: output.data.description?.content ?? '' }
  })
  const unit = (consumed[0] ?? issued[0]!.allocation).unit, kind = (consumed[0] ?? issued[0]!.allocation).type
  for (const allocation of [...consumed, ...issued.map(output => output.allocation)]) if (allocation.unit !== unit || allocation.type !== kind) throw new Error('Compose grants of one resource and unit; convert explicitly first.')
  if (inputs.length) {
    const sumIn = consumed.reduce((sum, allocation) => sum + allocation.amount, 0), sumOut = issued.reduce((sum, output) => sum + output.allocation.amount, 0)
    if (Math.abs(sumIn - sumOut) > 1e-9) throw new Error(`The transfer must conserve the supplied amount: ${sumIn} ${unit} in, ${sumOut} ${unit} out.`)
  }
  const result: { outputs: Record<string, string>; proposals: Record<string, string> } = { outputs: {}, proposals: {} }
  // the bank holds its grants as elements of its value: [pattern, grant], content the compiler leaves as it is
  const rows: FosPathElem[] = []
  for (const output of issued) {
    const grant = grantValue(store, output.pattern, contract, { ...output.allocation, resource: '' }, { description: { content: output.title } }, inputs)
    result.outputs[output.name] = grant
    rows.push([output.pattern, grant])
  }
  // a consumed handle holds nothing afterwards, unless an output rebinds it (outputs take precedence)
  for (const [name, cid] of Object.entries(operands.inputs)) if (name.startsWith('in')) {
    const grant = grantOf(store, cid, contract)!
    result.proposals[name] = grantValue(store, allocationPattern(store, context.step, grant.allocation, true), contract, { ...grant.allocation, amount: 0 }, { description: { content: 'consumed' } }, [cid])
  }
  const remaining = new Set(inputs)
  result.proposals.owner = context.put({ ...owner, children: [...owner.children.filter(edge => !(isRowEdge(store, edge) && remaining.has(identityCid(store, edge)))), ...rows] })
  return result
}

/** The text of the answer a filled requirement at `path` holds (its value's description); null while it is open or gone. */
export function requirementAnswer(r: Replica, path: Scope): string | null {
  const row = viewRows(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)), cid = scopeCid(r.store, rootCid(r), path)
  if (!row?.requirement?.satisfied || !cid) return null
  return valueAt(r.store, cid).data.description?.content ?? ''
}
