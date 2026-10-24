/** Authority transitions over closed graphs. Editor identities and scope lookup do not belong here. */
import type { FosStore } from '../dag-implementation/store'
import type { FosPathElem } from '../types'
import { content, put } from './graph'
import { assertCompiledGraph } from './ref-compiler'
import { primitiveImplementation } from './primitives'

export type AuthorityGrant = { ref: string; cid: string; checker: string; value: string }
export type AuthorityOperation = { cid: string; inputs: AuthorityGrant[]; outputs: AuthorityGrant[] }
export type AuthorityChecker = {
  /** All uses of one grant in this transaction, including retaining it in the resulting state. */
  usage(store: FosStore, grant: AuthorityGrant, uses: AuthorityOperation[], retained: boolean): string[]
  /** The supplying handler determines valid transfers and splits for its domain. */
  transition(store: FosStore, operation: AuthorityOperation): string[]
}
export type AuthorityCheck = { next?: string; problems: string[] }
type Frame = NonNullable<import('../types').FosDataContent['authorityFrame']>

function frame(store: FosStore, cid: string, role: Frame['role']) {
  const node = content(store, cid)
  if (node.data.authorityFrame?.role !== role) throw new Error(`Expected an authority ${role} graph.`)
  return node
}

function slot(store: FosStore, cid: string): number {
  const node = content(store, cid), value = node.data.refDeclaration?.slot
  if (!Number.isSafeInteger(value) || value! < 0 || node.children.length ||
    cid !== put(store, { data: { refDeclaration: { slot: value! } }, children: [] })) throw new Error('Invalid authority declaration.')
  return value!
}

function grants(store: FosStore, cid: string): Map<string, AuthorityGrant> {
  const result = new Map<string, AuthorityGrant>()
  for (const [ref, value] of frame(store, cid, 'bindings').children) {
    slot(store, ref)
    if (result.has(ref)) throw new Error('An authority frame declares the same grant twice.')
    const edges = frame(store, value, 'grant').children
    if (edges.length !== 1) throw new Error('A grant must bind one checking handler and payload.')
    const [checker, payload] = edges[0]!
    result.set(ref, { ref, cid: value, checker, value: payload })
  }
  return result
}

function state(store: FosStore, cid: string) {
  const node = frame(store, cid, 'state'), { revision, nextSlot } = node.data.authorityFrame!
  if (node.children.length !== 1 || !Number.isSafeInteger(revision) || revision! < 0 || !Number.isSafeInteger(nextSlot) || nextSlot! < 0)
    throw new Error('Invalid authority state.')
  const bindings = grants(store, node.children[0]![1])
  if ([...bindings.keys()].some(ref => slot(store, ref) >= nextSlot!)) throw new Error('Authority state has an undeclared grant slot.')
  return { revision: revision!, nextSlot: nextSlot!, bindings }
}

export function authorityGrant(store: FosStore, checker: string, value: string): string {
  assertCompiledGraph(store, [checker, value])
  return put(store, { data: { authorityFrame: { role: 'grant' } }, children: [[checker, value]] })
}

export function authorityBindings(store: FosStore, bindings: FosPathElem[]): string {
  const cid = put(store, { data: { authorityFrame: { role: 'bindings' } }, children: bindings })
  assertCompiledGraph(store, [cid]); grants(store, cid)
  return cid
}

/** Only an issuer establishes an initial state; transactions cannot mint grants without input authority. */
export function authorityState(store: FosStore, bindings: FosPathElem[], revision = 0, nextSlot = Math.max(-1, ...bindings.map(([ref]) => slot(store, ref))) + 1): string {
  const values = authorityBindings(store, bindings)
  const cid = put(store, { data: { authorityFrame: { role: 'state', revision, nextSlot } }, children: [[
    put(store, { data: {}, children: [] }), values
  ]] })
  state(store, cid)
  return cid
}

/** Select an explicit grant declaration, never an equal-valued or matching grant. */
export function authorityStateGrant(store: FosStore, stateCid: string, ref: string): AuthorityGrant | undefined {
  return state(store, stateCid).bindings.get(ref)
}

export function authorityNextSlot(store: FosStore, stateCid: string): number {
  return state(store, stateCid).nextSlot
}

/** An editable reference uses a scoped owner expression; compilation substitutes a local owner binder. */
export function authorityReference(store: FosStore, owner: string, declaration: string): string {
  slot(store, declaration)
  return put(store, { data: { authorityFrame: { role: 'reference' } }, children: [[owner, declaration]] })
}

export function authorityReferenceParts(store: FosStore, cid: string): FosPathElem {
  const edges = frame(store, cid, 'reference').children
  if (edges.length !== 1) throw new Error('A grant reference must identify its owner and declaration.')
  slot(store, edges[0]![1])
  return edges[0]!
}

/** Rebinding destinations are explicit graph operands, never inferred from matching values. */
export function authorityInvocation(store: FosStore, owner: string, transaction: string, outputs: FosPathElem[]): string {
  const rebindings = put(store, { data: { authorityFrame: { role: 'rebindings' } }, children: outputs })
  return put(store, { data: { authorityFrame: { role: 'invocation' } }, children: [
    [owner, transaction], [rebindings, put(store, { data: {}, children: [] })]
  ] })
}

export function authorityInvocationParts(store: FosStore, cid: string) {
  const edges = frame(store, cid, 'invocation').children
  if (edges.length !== 2) throw new Error('An authority invocation must select an owner, transaction, and rebindings.')
  return { owner: edges[0]![0], transaction: edges[0]![1], outputs: frame(store, edges[1]![0], 'rebindings').children }
}

/** Pure invocation checking. Every write addresses a binder in the compiled invocation frame. */
export function checkAuthorityInvocation(store: FosStore, cid: string, current: string): AuthorityCheck & { writes?: FosPathElem[] } {
  assertCompiledGraph(store, [cid, current])
  const invocation = authorityInvocationParts(store, cid)
  slot(store, invocation.owner)
  const result = applyAuthorityTransaction(store, current, invocation.transaction)
  if (!result.next) return result
  const writes = new Map<string, string>([[invocation.owner, result.next]])
  for (const [destination, declaration] of invocation.outputs) {
    slot(store, destination)
    if (!authorityStateGrant(store, result.next, declaration)) return { problems: ['The selected output grant is unavailable in the resulting authority state.'] }
    const reference = authorityReference(store, invocation.owner, declaration)
    if (writes.has(destination) && writes.get(destination) !== reference) return { problems: ['Contradictory authority ref rebindings.'] }
    writes.set(destination, reference)
  }
  return { ...result, writes: [...writes] }
}

export function authorityOperation(store: FosStore, inputs: FosPathElem[], outputs: FosPathElem[]): string {
  return put(store, { data: { authorityFrame: { role: 'operation' } }, children: [[authorityBindings(store, inputs), authorityBindings(store, outputs)]] })
}

/** Ordering is explicit: a later operation may consume earlier outputs, never the reverse. */
export function authorityTransaction(store: FosStore, before: string, operations: string[]): string {
  state(store, before)
  const list = put(store, { data: { authorityFrame: { role: 'operations' } }, children: operations.map((operation, index) => [
    put(store, { data: { refDeclaration: { slot: index } }, children: [] }), operation
  ]) })
  const transaction = put(store, { data: { authorityFrame: { role: 'transaction' } }, children: [[before, list]] })
  assertCompiledGraph(store, [transaction])
  return transaction
}

function transactionParts(store: FosStore, transaction: string): FosPathElem {
  const edges = frame(store, transaction, 'transaction').children
  if (edges.length !== 1) throw new Error('A transaction must have one expected state and operation graph.')
  return edges[0]!
}

export function checkAuthorityTransaction(store: FosStore, transaction: string): AuthorityCheck {
  assertCompiledGraph(store, [transaction])
  const [before, list] = transactionParts(store, transaction), initial = state(store, before)
  const declared = new Map(initial.bindings), available = new Map(initial.bindings)
  const uses = new Map<string, AuthorityOperation[]>(), operations: AuthorityOperation[] = [], problems: string[] = []
  let nextSlot = initial.nextSlot
  for (const [index, [, cid]] of frame(store, list, 'operations').children.entries()) {
    const entry = content(store, list).children[index]!
    if (slot(store, entry[0]) !== index) throw new Error('Invalid authority operation order.')
    const edges = frame(store, cid, 'operation').children
    if (edges.length !== 1) throw new Error('An operation must have one input and output frame.')
    const operation: AuthorityOperation = { cid, inputs: [...grants(store, edges[0]![0]).values()], outputs: [...grants(store, edges[0]![1]).values()] }
    if (!operation.inputs.length) { problems.push('A transition cannot create authority without an input grant.'); continue }
    operations.push(operation)
    for (const input of operation.inputs) {
      if (declared.get(input.ref)?.cid !== input.cid) problems.push('An input grant is unavailable, changed, or depends on a later operation.')
      const previous = uses.get(input.ref) ?? []
      previous.push(operation); uses.set(input.ref, previous); available.delete(input.ref)
    }
    for (const output of operation.outputs) {
      const ordinal = slot(store, output.ref)
      if (declared.has(output.ref) || ordinal < initial.nextSlot) { problems.push('An output must declare fresh authority, not reuse an existing or consumed grant slot.'); continue }
      // A permissive co-input must not launder a restricted input. Composing different
      // contracts requires an explicit composite handler, not selecting one of them.
      if (!operation.inputs.every(input => input.checker === output.checker)) problems.push('An output changes the checking contract of its supplying authority.')
      nextSlot = Math.max(nextSlot, ordinal + 1)
      declared.set(output.ref, output); available.set(output.ref, output)
    }
  }
  if (problems.length) return { problems }
  const checkers = new Map<string, AuthorityChecker>()
  for (const grant of declared.values()) {
    const checker = primitiveImplementation<{ authority?: AuthorityChecker }>(store, grant.checker)?.value.authority
    if (!checker) { problems.push('The declared authority checking handler is unavailable.'); continue }
    checkers.set(grant.checker, checker)
    problems.push(...checker.usage(store, grant, uses.get(grant.ref) ?? [], available.has(grant.ref)))
  }
  if (problems.length) return { problems }
  for (const operation of operations) for (const checker of new Set(operation.inputs.map(input => input.checker)))
    problems.push(...checkers.get(checker)!.transition(store, operation))
  if (problems.length) return { problems }
  if (!Number.isSafeInteger(initial.revision + 1) || !Number.isSafeInteger(nextSlot)) throw new Error('Authority state exceeds its counter limit.')
  return { next: authorityState(store, [...available.values()].map(grant => [grant.ref, grant.cid]), initial.revision + 1, nextSlot), problems }
}

/** A native usage rule, composed with a domain's transition rule by its checking handler. */
export function linearAuthorityUsage(_store: FosStore, _grant: AuthorityGrant, uses: AuthorityOperation[], retained: boolean): string[] {
  return uses.length + Number(retained) === 1 ? [] : ['Linear authority must be transferred or consumed exactly once.']
}

export function unrestrictedAuthorityUsage(): string[] { return [] }

/** This returns a proposed state. Its owner must compare-and-publish it atomically under its normal execution lock. */
export function applyAuthorityTransaction(store: FosStore, current: string, transaction: string): AuthorityCheck {
  assertCompiledGraph(store, [current, transaction])
  if (transactionParts(store, transaction)[0] !== current) return { problems: ['Authority changed before commit; recompile the transaction.'] }
  return checkAuthorityTransaction(store, transaction)
}
