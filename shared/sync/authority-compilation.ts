/** Bind authority operands through ordinary declarations before interpreting a closed transaction. */
import { contextBindings, resolveBinding, type BindingEnvironment } from './bindings'
import { authorityGrant, authorityReferenceParts, authorityStateGrant, authorityNextSlot,
  authorityInvocation, authorityInvocationParts, checkAuthorityInvocation, authorityOperation, authorityTransaction, type AuthorityGrant } from './authority'
import { compileRefGraph } from './ref-compiler'
import { content, importNodes, reachableNodes, put, type Scope } from './graph'
import type { Replica } from './replica'
import { bindingAvailable, scopedBindingKey, type ScopedBinding } from './scope-bindings'
import { resolveRefExpression, resolveRefIdentity } from './ref-paths'

export type CompiledAuthority = { cid?: string; problems: string[]; binding?: ScopedBinding }

/** Locations are an editor/host publication map, never operands available to the checker. */
export type AuthorityCompilation = {
  cid: string; current: string; owner: ScopedBinding
  locations: Array<{ ref: string; binding: ScopedBinding }>
}

const sameBinding = (a: ScopedBinding, b: ScopedBinding) => a.store === b.store && scopedBindingKey(a) === scopedBindingKey(b)

function declaration(r: Replica, operand: string, parent: Scope, environment: BindingEnvironment): ScopedBinding {
  const node = content(r.store, operand)
  const result = node.data.refExpression ? resolveRefExpression(r, parent, node.data.refExpression, environment)
    : node.data.ref && !node.data.ref.peer && !node.data.ref.owner ? resolveRefIdentity(r, parent, node.data.ref.id, environment) : null
  const location = result?.locations[0]
  if (result?.status !== 'ready' || !location || !('assignments' in location)) throw new Error('Select an accessible scoped authority ref explicitly.')
  const binding = location as ScopedBinding
  if (!bindingAvailable(binding)) throw new Error('The authority ref is unavailable.')
  return binding
}

/** Read a handle through its original declaration's scope. Copies retain the same owner and grant slot. */
export function resolveAuthorityReference(r: Replica, source: ScopedBinding, environment: BindingEnvironment = {}) {
  const selected = resolveBinding(r.store, null, source, [], undefined, { ...environment, checkDependencies: false })
  if (selected.status !== 'ready') throw new Error(selected.problems.join('\n'))
  const origin = selected.binding ?? source, context = { ...r, store: origin.store }
  const [ownerExpression, ref] = authorityReferenceParts(r.store, selected.cid!)
  const ownerSelection = declaration(context, ownerExpression, origin.scope.path, environment)
  const ownerValue = resolveBinding(r.store, null, ownerSelection, [], undefined, { ...environment, checkDependencies: false })
  if (ownerValue.status !== 'ready') throw new Error(ownerValue.problems.join('\n'))
  const grant = authorityStateGrant(r.store, ownerValue.cid!, ref)
  if (!grant) throw new Error('The authority grant has already been consumed or is unavailable.')
  return { owner: ownerValue.binding ?? ownerSelection, state: ownerValue.cid!, grant }
}

/** Editor coordinates select a particular operation output; compilation replaces them with grant declaration edges. */
export type AuthorityResult = { operation: number; output: number }
export type AuthorityPlan = {
  operations: Array<{
    inputs: Array<{ binding: ScopedBinding } | { result: AuthorityResult }>
    outputs: string[]
  }>
  rebindings: Array<{ binding: ScopedBinding; result: AuthorityResult }>
}

/** Plan the entire invocation without publishing intermediate grants. All splits, remainders,
 * dependencies and final destinations are explicit; domain handlers check their validity.
 */
export function planAuthorityTransfer(r: Replica, at: Scope, plan: AuthorityPlan, environment: BindingEnvironment = {}): string {
  const expression = (binding: ScopedBinding) => {
    const ref = put(r.store, { data: { ref: { id: binding.id } }, children: [] })
    if (!sameBinding(declaration(r, ref, at.slice(0, -1), environment), binding)) throw new Error('Pass the selected authority ref into the invocation scope explicitly.')
    return ref
  }
  const sources = plan.operations.flatMap(operation => operation.inputs.flatMap(input => {
    if ('result' in input) return []
    expression(input.binding)
    return [resolveAuthorityReference(r, input.binding, environment)]
  }))
  if (!sources.length) throw new Error('A transfer needs input authority.')
  const first = sources[0]!
  if (sources.some(source => !sameBinding(source.owner, first.owner) || source.state !== first.state))
    throw new Error('Compose transfers within each explicit authority owner; unrelated owners cannot commit atomically.')
  // Resolve every live input through the same binding path, once. Later inputs may instead
  // select exact outputs already declared in this graph, never a matching value or name.
  let sourceIndex = 0, nextSlot = authorityNextSlot(r.store, first.state)
  const results: AuthorityGrant[][] = []
  const result = (selected: AuthorityResult): AuthorityGrant => {
    if (!Number.isSafeInteger(selected.operation) || !Number.isSafeInteger(selected.output) || selected.operation < 0 || selected.output < 0)
      throw new Error('Select an explicit authority operation output.')
    const grant = results[selected.operation]?.[selected.output]
    if (!grant) throw new Error('The selected authority output is missing or depends on a later operation.')
    return grant
  }
  const operations = plan.operations.map(operation => {
    const inputs = operation.inputs.map(input => {
      if ('result' in input) return result(input.result)
      const source = sources[sourceIndex++]!
      // Authoring an invocation cannot capture an inaccessible live grant's owner.
      expression(source.owner)
      return source.grant
    })
    if (!inputs.length) throw new Error('A transfer needs input authority.')
    const checker = inputs[0]!.checker
    if (inputs.some(input => input.checker !== checker)) throw new Error('Compose the checking contracts explicitly before joining different authorities.')
    const outputs = operation.outputs.map(payload => {
      const value = compileRefGraph(r, payload, at, { ...environment, selected: true })
      if (!value.complete) throw new Error('Compile every authority output value before planning the transfer.')
      if (!Number.isSafeInteger(nextSlot + 1)) throw new Error('Authority state exceeds its counter limit.')
      return { ref: put(r.store, { data: { refDeclaration: { slot: nextSlot++ } }, children: [] }),
        cid: authorityGrant(r.store, checker, value.cid), checker, value: value.cid }
    })
    results.push(outputs)
    return authorityOperation(r.store, inputs.map(grant => [grant.ref, grant.cid]), outputs.map(grant => [grant.ref, grant.cid]))
  })
  const transaction = authorityTransaction(r.store, first.state, operations)
  const invocation = authorityInvocation(r.store, expression(first.owner), transaction,
    plan.rebindings.map(output => [expression(output.binding), result(output.result).ref]))
  // Use the execution compiler's checks, including consumed output selection and contradictory
  // destination assignments. A planner must not have a weaker, parallel validation path.
  compileAuthorityInvocation(r, invocation, at, environment)
  return invocation
}

export function compileAuthorityInvocation(r: Replica, cid: string, at: Scope, environment: BindingEnvironment = {}): AuthorityCompilation {
  const invocation = authorityInvocationParts(r.store, cid), parent = at.slice(0, -1)
  const selected = declaration(r, invocation.owner, parent, environment)
  const bound = resolveBinding(r.store, null, selected, [], undefined, { ...environment, checkDependencies: false })
  if (bound.status !== 'ready') throw new Error(bound.problems.join('\n'))
  const owner = bound.binding ?? selected
  const locations: AuthorityCompilation['locations'] = []
  const binder = (binding: ScopedBinding) => {
    const prior = locations.find(location => sameBinding(location.binding, binding))
    if (prior) return prior.ref
    const ref = put(r.store, { data: { refDeclaration: { slot: locations.length } }, children: [] })
    locations.push({ ref, binding }); return ref
  }
  const ownerRef = binder(owner)
  const compiled = compileRefGraph(r, invocation.transaction, at, { ...environment, selected: true })
  if (!compiled.complete) throw new Error('Unresolved authority transaction operands.')
  const outputs = invocation.outputs.map(([target, grant]) => [binder(declaration(r, target, parent, environment)), grant] as [string, string])
  const result = authorityInvocation(r.store, ownerRef, compiled.cid, outputs)
  const checked = checkAuthorityInvocation(r.store, result, bound.cid!)
  if (!checked.next) throw new Error(checked.problems.join('\n'))
  return { cid: result, current: bound.cid!, owner, locations }
}

/** Issuance chooses its checking capability from the parent, exactly like any other argument.
 * Existing grants are never re-issued by this function: their pinned contract is retained on transfer.
 */
export function compileAuthorityGrant(r: Replica, at: Scope, payload: string,
  capability: { type: string; target?: ScopedBinding; name?: string }, environment: BindingEnvironment = {}): CompiledAuthority {
  const parent = at.slice(0, -1)
  const resolved = resolveBinding(r.store, capability.type, capability.target ?? null, contextBindings(r, parent, environment), capability.name,
    { ...environment, scope: { replica: r, path: parent } })
  if (resolved.status !== 'ready') return { problems: resolved.problems }
  const origin = resolved.binding
  const source = origin ? { ...r, store: origin.store } : r
  const checker = compileRefGraph(source, resolved.cid!, origin?.path ?? at, { ...environment, selected: true })
  const value = compileRefGraph(r, payload, at, { ...environment, selected: true })
  const holes = [...checker.holes, ...value.holes]
  if (holes.length) return { problems: holes.map(hole => `Unresolved authority operand: ${hole.reason}.`) }
  if (source.store !== r.store) importNodes(r.store, reachableNodes(source.store, [checker.cid]))
  return { cid: authorityGrant(r.store, checker.cid, value.cid), problems: [], binding: origin }
}
