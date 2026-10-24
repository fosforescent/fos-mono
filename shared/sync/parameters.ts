/**
 * Parameter rows. A node's rows are its parameters, keyed by constructor nodes from the library: the left of the
 * fetch url's row is { [primitive, string], [negative, ·] }, a string the row sends; { [primitive, string] } is one it
 * receives. Nothing here is a type annotation: these are ordinary nodes, matched structurally (structural.ts reads the
 * `primitive` row to check leaf values; other parameters such as `negative` say which way a value goes).
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent } from '../types'

type ParameterKind = NonNullable<FosDataContent['parameterDefinition']>['kind']

/** Interpret the parameter key's own definition, independent of library names and other scopes. */
export function parameter(store: FosStore, node: string, kind: ParameterKind): string | null {
  const rows = store.table.get(node)?.children.filter(([left]) => store.table.get(left)?.data.parameterDefinition?.kind === kind) ?? []
  if (rows.length > 1) throw new Error(`Ambiguous ${kind} parameter.`)
  return rows[0]?.[1] ?? null
}

/** The pinned value predicate held by the primitive parameter, or null. Never turn it into a field name. */
export function primitiveOf(store: FosStore, node: string): string | null {
  return parameter(store, node, 'primitive')
}

/** Whether the node has a `negative` row: a value the row sends or asks for, the inverse of one it receives. */
export function isNegative(store: FosStore, node: string): boolean {
  return parameter(store, node, 'negative') !== null
}

/** Flip a node's direction using the existing negative parameter, preserving its definition. */
export function invertPolarity(store: FosStore, node: string, negativeKey: string): string {
  const definition = store.table.get(node)
  if (!definition) throw new Error('The capability has not loaded yet.')
  if (store.table.get(negativeKey)?.data.parameterDefinition?.kind !== 'negative') throw new Error('The negative parameter is unavailable in this scope.')
  const negative = isNegative(store, node)
  const children = definition.children.filter(([left]) => store.table.get(left)?.data.parameterDefinition?.kind !== 'negative')
  if (!negative) children.push([negativeKey, store.create({ data: {}, children: [] }).getId()])
  return store.create({ ...definition, children }).getId()
}

/**
 * Whether the ref `alias` in `node`'s rows is one the row receives: its row's left has a primitive and no negative
 * parameter. Received refs are filled at run time (a handler submits to them); sent ones must be assigned first.
 */
export function receivedRef(store: FosStore, node: string, alias: string, depth = 0): boolean {
  const value = store.table.get(node)
  if (!value || depth > 16) return false
  return value.children.some(([left, right]) => {
    const ref = store.table.get(right)
    if (ref?.data.alias?.id === alias) return primitiveOf(store, left) !== null && !isNegative(store, left)
    return receivedRef(store, right, alias, depth + 1)
  })
}
