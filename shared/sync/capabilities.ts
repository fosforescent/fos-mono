/** Names are a standard-library/wire adapter. Ref resolution uses pattern identities. */
import * as library from './library.generated.json'
import type { FosDataContent, FosNodeContent } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { matchesGraph, namedRefPattern } from './structural'

export { STANDARD_CAPABILITY_PATTERNS } from './capability-catalog'
import { STANDARD_CAPABILITY_PATTERNS } from './capability-catalog'
const byName = new Map(STANDARD_CAPABILITY_PATTERNS.map(pattern => [pattern.name, pattern]))
const byCid = new Map(STANDARD_CAPABILITY_PATTERNS.flatMap(pattern => [[pattern.cid, pattern], ...(pattern.legacy ? [[pattern.legacy, pattern] as const] : [])] as const))
const namedPatterns = new WeakMap<FosStore, Map<string, string>>()

export function capabilityPattern(store: FosStore, name: string): string {
  if (store.table.has(name)) return name
  const definition = byName.get(name)
  const cached = namedPatterns.get(store)?.get(name)
  if (cached && store.table.has(cached)) return cached
  if (definition) {
    const nodes = library.nodes as unknown as Record<string, FosNodeContent>
    const install = (cid: string): void => {
      if (store.table.has(cid)) return
      const node = nodes[cid]!
      for (const [left, right] of node.children) { install(left); install(right) }
      store.create(node)
    }
    install(definition.cid)
    return definition.cid
  }
  const empty = store.create({ data: {}, children: [] }).getId()
  const data = { capabilityDefinition: { name, label: name } }
  const cid = store.create({ data, children: [[namedRefPattern(store, name), empty]] }).getId()
  {
    if (!namedPatterns.has(store)) namedPatterns.set(store, new Map())
    namedPatterns.get(store)!.set(name, cid)
  }
  return cid
}

export function capabilityName(store: FosStore, cid: string): string | null {
  const node = store.table.get(cid)
  const definition = node?.data.capabilityDefinition ?? byCid.get(cid)
  if (definition) return definition.name
  const name = node?.data.name?.content
  return name?.startsWith('fos:capability:') ? name.slice('fos:capability:'.length) : null
}

/**
 * The evaluator is the `execute` capability's handler: a node's execute row (a row whose left is that capability)
 * holds its journal as the row's value. This is the one place the evaluator names what it implements.
 */
export function executeLeft(store: FosStore): string { return capabilityPattern(store, 'execute') }
export function isExecuteLeft(store: FosStore, left: string | null | undefined): boolean { return sameCapabilityType(store, left, executeLeft(store)) }

/**
 * The trigger definition a row's left carries: a trigger capability's pattern (`timer`, `ref-change`, …), or one
 * observer's offer of it (a trigger pinned to that declaration; the offer's value keeps the definition).
 */
export function triggerDefinitionOf(store: FosStore, left: string | null | undefined): NonNullable<FosDataContent['triggerDefinition']> | undefined {
  if (!left || !store.table.has(left)) return undefined
  const node = store.table.get(left)!
  const target = node.children.find(([key]) => key === store.primitive.targetPointerConstructor.getId())?.[1]
  const name = capabilityName(store, left)
  return node.data.triggerDefinition ?? (target ? store.table.get(target)?.data.triggerDefinition : undefined) ?? STANDARD_CAPABILITY_PATTERNS.find(p => p.name === name)?.node.data.triggerDefinition
}
/** A trigger row: its left is a trigger capability. */
export function isTriggerLeft(store: FosStore, left: string | null | undefined): boolean { return !!triggerDefinitionOf(store, left) }

/**
 * A row holding a native handler's own state for its node: the evaluator's execute row (its journal), a trigger row
 * (its configuration and state). Such a row is no binding in scope, no argument, no step, no task context and no
 * data to solve over: it is how the handler keeps track of this node.
 */
export function isHandlerStateLeft(store: FosStore, left: string | null | undefined): boolean { return isExecuteLeft(store, left) || isTriggerLeft(store, left) }

/** Old primitive markers and their library pattern are the same type at the wire boundary. */
export function sameCapabilityType(store: FosStore, a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return matchesGraph(store, a, b) && matchesGraph(store, b, a)
}

export type CapabilitySyntax = Pick<NonNullable<FosDataContent['capabilityDefinition']>, 'name' | 'syntax'>
/** Parsing is syntax for a declared ref; extensions can supply their own declarations. */
export function parseCapabilityName(text: string, declarations: CapabilitySyntax[] = STANDARD_CAPABILITY_PATTERNS): { capability: string; rest: string } | null {
  for (const declaration of declarations) for (const token of declaration.syntax ?? [declaration.name]) {
    if (!text.toLowerCase().startsWith(token.toLowerCase())) continue
    const tail = text.slice(token.length)
    if (token !== '?' && tail && !/^[\s:]/.test(tail)) continue
    return { capability: declaration.name, rest: tail.replace(/^\s*:?\s*/, '') }
  }
  return null
}
