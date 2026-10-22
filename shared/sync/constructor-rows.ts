/**
 * Rows made by a constructor node: [constructor, right]. The constructor's rows declare refs, [parameters, ref]; the
 * right node assigns them, a ref with the same alias. The rows combine: an assignment on the right fills the
 * constructor's ref (run time), a value on the left's ref is its default (fixed with the constructor, compile time).
 * Parameters such as `negative` (sent) or none (received) say which way each ref goes; see parameters.ts.
 */
import type { FosPathElem } from '../types'
import { commitRoot, content, findEdge, identityCid, isRefNode, put, refNodeContent, refValueCid, resolveScope, updateAtScope, valueContent, withRowTemplate, type Scope } from './graph'
import { headCid, type Replica } from './replica'
import { isNegative, primitiveOf } from './parameters'

export type OpenRef = { alias: string; name: string; left: string; defaultValue: string | null; sent: boolean; received: boolean }

/** The refs a row's left declares in its rows (through a ref on the left, such as a pinned handler, to its value). */
export function openRefs(store: Replica['store'], constructor: string): OpenRef[] {
  if (!store.table.has(constructor)) return []
  const node = valueContent(store, constructor)
  return node.children.flatMap(([left, right]) => {
    const ref = store.table.get(right)
    if (!ref || !isRefNode(store, ref) || !ref.data.alias) return []
    const primitive = primitiveOf(store, left) !== null
    return [{ alias: ref.data.alias.id, name: ref.data.name?.content ?? ref.data.alias.id, left, defaultValue: refValueCid(store, ref), sent: primitive && isNegative(store, left), received: primitive && !isNegative(store, left) }]
  })
}

const rowEdgeOf = (r: Replica, row: Scope) => {
  const parent = resolveScope(r.store, headCid(r), row.slice(0, -1))
  return parent ? findEdge(r.store, valueContent(r.store, parent), `a:${row.at(-1)}`) : undefined
}

/** The constructor on the left of the row at `row`. */
export function rowConstructor(r: Replica, row: Scope): string | null {
  return rowEdgeOf(r, row)?.[0] ?? null
}

/** The value the row gives the constructor's ref `alias`: the right's assignment, else the left's default. */
export function assignedValue(r: Replica, row: Scope, alias: string): string | null {
  const cid = resolveScope(r.store, headCid(r), row)
  const assignment = cid ? findEdge(r.store, valueContent(r.store, cid), `a:${alias}`) : undefined
  if (assignment) return refValueCid(r.store, content(r.store, identityCid(r.store, assignment)))
  const constructor = rowConstructor(r, row)
  return constructor ? openRefs(r.store, constructor).find(ref => ref.alias === alias)?.defaultValue ?? null : null
}

/** Assign `value` (null: an open slot) to the constructor's ref `alias` in the row's right node. */
export function assignRefAt(r: Replica, row: Scope, alias: string, value: string | null, now: number): Replica {
  const constructor = rowConstructor(r, row), declared = constructor && openRefs(r.store, constructor).find(ref => ref.alias === alias)
  if (!declared) throw new Error(`This row's constructor has no ${alias} ref.`)
  const ref = put(r.store, refNodeContent(r.store, { alias: { id: alias }, name: { content: declared.name }, updated: { time: now } }, value))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), row, node => {
    const kept = node.children.filter(edge => content(r.store, identityCid(r.store, edge)).data.alias?.id !== alias)
    return { ...node, children: [...kept, [declared.left, ref] as FosPathElem] }
  }), now)
  return { ...r }
}

/** Make the row at `row` [constructor, right] and assign `values` (text, by ref name) on its right. */
export function constructAt(r: Replica, row: Scope, constructor: string, values: Record<string, string>, now: number): Replica {
  const edge = rowEdgeOf(r, row)
  if (!edge) throw new Error('The row no longer exists.')
  commitRoot(r.store, updateAtScope(r.store, headCid(r), row.slice(0, -1), node => ({
    ...node, children: node.children.map(child => content(r.store, identityCid(r.store, child)).data.alias?.id === row.at(-1) ? withRowTemplate(r.store, child, constructor) : child)
  })), now)
  r = { ...r }
  for (const ref of openRefs(r.store, constructor)) {
    const text = values[ref.name]
    if (text !== undefined) r = assignRefAt(r, row, ref.alias, put(r.store, { data: { description: { content: text } }, children: [] }), now)
  }
  return r
}

/** The text of a string value cid (its description or text scalar). */
export function textOf(r: Replica, cid: string | null): string | null {
  if (!cid) return null
  const node = valueContent(r.store, cid)
  return node.data.scalar?.type === 'text' ? String(node.data.scalar.value) : node.data.description?.content ?? null
}
