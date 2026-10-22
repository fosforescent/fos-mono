/**
 * Parameter rows. A node's rows are its parameters, keyed by constructor nodes from the library: the left of the
 * fetch url's row is { [primitive, string], [negative, ·] }, a string the row sends; { [primitive, string] } is one it
 * receives. Nothing here is a type annotation: these are ordinary nodes, matched structurally (structural.ts reads the
 * `primitive` row to check leaf values; other parameters such as `negative` say which way a value goes).
 */
import * as library from './library.generated.json'
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent } from '../types'

/** Names of library refs (refs in the library graph; the nodes they point at carry no name). */
export const PRIMITIVE_ID = 'lib:primitive'
export const NEGATIVE_ID = 'lib:negative'
export const STRING_ID = 'lib:string'

const nodes = library.nodes as unknown as Record<string, FosNodeContent>
const refs = library.refs as Record<string, string>

/** The node the build's library ref `name` names, installed into `store` (library content, not a code primitive). */
export function libraryNode(store: FosStore, name: string): string {
  const cid = refs[name]
  if (!cid) throw new Error(`The standard library has no ${name}.`)
  const install = (key: string): void => {
    if (store.table.has(key)) return
    const node = nodes[key]!
    for (const [left, right] of node.children) { install(left); install(right) }
    store.create(node)
  }
  install(cid)
  return cid
}

/** The right of `node`'s row keyed by the library constructor `constructorId`, or null. */
export function parameter(store: FosStore, node: string, constructorId: string): string | null {
  const key = libraryNode(store, constructorId)
  return store.table.get(node)?.children.find(([left]) => left === key)?.[1] ?? null
}

/** The name of the primitive a node's `primitive` row holds (the library ref naming it, e.g. lib:string), or null. */
export function primitiveOf(store: FosStore, node: string): string | null {
  const value = parameter(store, node, PRIMITIVE_ID)
  if (!value) return null
  return Object.keys(refs).find(name => refs[name] === value) ?? value
}

/** Whether the node has a `negative` row: a value the row sends or asks for, the inverse of one it receives. */
export function isNegative(store: FosStore, node: string): boolean {
  return parameter(store, node, NEGATIVE_ID) !== null
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
