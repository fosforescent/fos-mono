/** Names are a standard-library/wire adapter. Ref resolution uses pattern identities. */
import type { FosDataContent } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { matchesGraph } from './structural'
import { libAt, typeIdOf, valueContent, type Scope } from './graph'
export { libAt } from './graph'

export { capabilityDeclarations } from './capability-catalog'

export function capabilityName(store: FosStore, cid: string): string | null {
  const node = store.table.get(cid)
  return node?.data.capabilityDefinition?.name ?? null
}

/**
 * The evaluator is the `execute` capability's handler: a node's execute row (a row whose left is that capability)
 * holds its journal as the row's value. This is the one place the evaluator names what it implements.
 */
export function executeLeft(store: FosStore, at: Scope): string { return libAt(store, at).capabilities.execute! }
export function isExecuteLeft(store: FosStore, left: string | null | undefined): boolean { return typeIdOf(store, left) === 'capabilities.execute' }

/**
 * The trigger definition a row's left carries: a trigger capability's pattern (`timer`, `ref-change`, …), or one
 * observer's offer of it (a trigger pinned to that declaration; the offer's value keeps the definition).
 */
export function triggerDefinitionOf(store: FosStore, left: string | null | undefined): NonNullable<FosDataContent['triggerDefinition']> | undefined {
  if (!left || !store.table.has(left)) return undefined
  return valueContent(store, left).data.triggerDefinition
}
/** A trigger row: its left is a trigger capability. */
export function isTriggerLeft(store: FosStore, left: string | null | undefined): boolean { return !!triggerDefinitionOf(store, left) }

/**
 * A row holding a primitive handler's own state for its node: the evaluator's execute row (its journal), a trigger row
 * (its configuration and state). Such a row is no binding in scope, no argument, no step, no task context and no
 * data to solve over: it is how the handler keeps track of this node.
 */
export function isHandlerStateLeft(store: FosStore, left: string | null | undefined): boolean { return isExecuteLeft(store, left) || isTriggerLeft(store, left) }

/** Capability compatibility must be established by their graph patterns in both directions. */
export function sameCapabilityType(store: FosStore, a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return matchesGraph(store, a, b, { side: 'left' }) && matchesGraph(store, b, a, { side: 'left' })
}

export type CapabilitySyntax = Pick<NonNullable<FosDataContent['capabilityDefinition']>, 'name' | 'syntax'>
/** Parsing is syntax for a declared ref; extensions can supply their own declarations. */
export function parseCapabilityName(text: string, declarations: CapabilitySyntax[] = []): { capability: string; rest: string } | null {
  for (const declaration of declarations) for (const token of declaration.syntax ?? [declaration.name]) {
    if (!text.toLowerCase().startsWith(token.toLowerCase())) continue
    const tail = text.slice(token.length)
    if (token !== '?' && tail && !/^[\s:]/.test(tail)) continue
    return { capability: declaration.name, rest: tail.replace(/^\s*:?\s*/, '') }
  }
  return null
}
