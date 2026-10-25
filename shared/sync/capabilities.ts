/** Names are a standard-library/wire adapter. Ref resolution uses pattern identities. */
import { capabilityDeclarations } from './capability-catalog'
import { primitiveName } from './primitives'
import { textOf, refTitle } from './fields'
import type { FosStore } from '../dag-implementation/store'
import { matchesGraph, tagName, capabilityName } from './structural'
import { libAt, libraryNode, valueContent, type Scope, valueCidOf } from './graph'
export { libAt } from './graph'

export { capabilityDeclarations } from './capability-catalog'

export { capabilityName } from './structural'

/**
 * The evaluator is the `execute` capability's handler: a node's execute row (a row whose left is that capability)
 * holds its journal as the row's value. This is the one place the evaluator names what it implements.
 */
export function executeLeft(store: FosStore, at: Scope): string { return libAt(store, at).capabilities.execute! }
export function isExecuteLeft(store: FosStore, left: string | null | undefined): boolean { return !!left && left === libraryNode(store, 'capabilities.execute') }

/** How a trigger is shown and what it starts: a new instance of its template, or (`resume`) the evaluation waiting on it. */
export type TriggerDefinition = { label: string; icon: string; mode: 'instantiate' | 'resume'; hidden?: boolean; schedule?: { field: string; input: 'datetime-local' | 'text'; label: string } }
/**
 * The trigger a row's left is: a trigger capability's pattern (`timer`, `ref-change`, …) or one observer's offer of it
 * (a value carrying the pattern's rows). The ref the capability is assigned to says it is a trigger and how it is
 * shown; its schedule is the pattern's own input (a cron expression, a time).
 */
export function triggerDefinitionOf(store: FosStore, left: string | null | undefined): TriggerDefinition | undefined {
  if (!left || !store.table.has(left)) return undefined
  // an offer (a handler ref) is read through to its value, which carries the capability's rows
  left = valueCidOf(store, left)
  const name = capabilityName(store, left)
  const declaration = name ? capabilityDeclarations(store).find(d => d.name === name) : undefined
  // the ref the capability is assigned to says how it is shown; one nothing assigns says it itself
  const holder = store.table.get(declaration ? declaration.ref : left)
  if (!holder || !name) return undefined
  const tagged = (tag: string) => holder.children.some(([key, right]) => tagName(store, key) === tag && !store.table.get(right)?.children.length)
  if (!tagged('trigger')) return undefined
  const icon = holder.children.find(([key]) => key === libraryNode(store, 'icon'))
  const input = valueContent(store, declaration?.cid ?? left).children.find(([type, hole]) => primitiveName(store, type) !== null && !!store.table.get(hole)?.data.name)
  const field = input && store.table.get(input[1])!.data.name!.content
  return { label: declaration?.label ?? refTitle(store, holder) ?? name, icon: (icon && textOf(store, icon[1])) ?? 'trigger', mode: tagged('resume') ? 'resume' : 'instantiate', ...(tagged('hidden') ? { hidden: true } : {}),
    ...(input && field ? { schedule: { field, input: primitiveName(store, input[0]) === 'number' ? 'datetime-local' as const : 'text' as const, label: field } } : {}) }
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

export type CapabilitySyntax = { name: string; syntax?: string[] }
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
