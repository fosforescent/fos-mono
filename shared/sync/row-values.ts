/**
 * The value a row holds. State a handler keeps (the evaluator's journal, a trigger's state, a payment's record) is the
 * value of the row it belongs to: the row whose left node is that handler's constructor. Nothing finds such a row by
 * name: it is the row of its node with that left (`rowWithLeft`), and its identity is the left itself, so two peers
 * that make it make the same row.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosPathElem } from '../types'
import { commitRoot, content, identityCid, isRowEdge, put, resolveScope, updateAtScope, valueContent, type Scope } from './graph'
import { headCid, type Replica } from './replica'
import { constructNodeValue, readGraphValue } from './node-values'
import { plainEdge } from './patterns'

export type LeftMatch = string | ((store: FosStore, left: string) => boolean)
const matches = (store: FosStore, match: LeftMatch, left: string) => typeof match === 'string' ? left === match : match(store, left)

/** The row of the node `cid` whose left node is (or matches) `left`. */
export function rowWithLeft(store: FosStore, cid: string, left: LeftMatch): { edge: FosPathElem; ref: string; alias: string } | null {
  for (const raw of valueContent(store, cid).children) {
    const edge = plainEdge(store, raw)
    if (!isRowEdge(store, edge) || !matches(store, left, edge[0])) continue
    const ref = identityCid(store, edge), alias = content(store, ref).data.alias?.id
    if (alias) return { edge, ref, alias }
  }
  return null
}

/** Every row of the node `cid` whose left matches. */
export function rowsWithLeft(store: FosStore, cid: string, left: LeftMatch): Array<{ edge: FosPathElem; ref: string; alias: string }> {
  return valueContent(store, cid).children.flatMap(raw => {
    const edge = plainEdge(store, raw)
    if (!isRowEdge(store, edge) || !matches(store, left, edge[0])) return []
    const ref = identityCid(store, edge), alias = content(store, ref).data.alias?.id
    return alias ? [{ edge, ref, alias }] : []
  })
}

/** The value the row with `left` at `path` holds, read as a native value. */
export function readRowValue<T>(r: Replica, path: Scope, left: LeftMatch): T | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const row = cid ? rowWithLeft(r.store, cid, left) : null
  return row ? (readGraphValue(r.store, row.ref) as T | undefined) ?? null : null
}

/**
 * Set the value of the row with left `left` at `path`, made when the node has none. The row is a constructor row:
 * its right is a node holding the value (as a fetch row's right holds its url and method), not a ref, since a ref on
 * the right of a capability declares a handler. Its identity is the left. `peer`: who holds the value.
 */
export function writeRowValue(r: Replica, path: Scope, left: string, value: unknown, now: number, peer?: string): Replica {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const store = r.store, row = rowWithLeft(store, cid, left)
  const alias = row?.alias ?? left
  const built = content(store, constructNodeValue(store, value, alias, row?.ref).cid)
  const holder = peer ?? (row ? content(store, row.ref).data.peerId?.content : undefined)
  const right = put(store, { ...built, data: { ...built.data, alias: { id: alias }, updated: { time: now }, ...(holder ? { peerId: { content: holder } } : {}) } })
  commitRoot(store, updateAtScope(store, headCid(r), path, node => ({
    ...node,
    children: row ? node.children.map(edge => identityCid(store, edge) === row.ref ? [left, right] : edge) : [...node.children, [left, right]]
  })), now)
  return { ...r }
}
