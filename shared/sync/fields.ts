/**
 * Rows in the pattern-row model. A row is `[type, row]`: the type is a node of rows `[field, value | void]`, and the
 * row's value carries one field ref per row of its type, `[field, ref]`, beside its child rows. A field the type leaves
 * open (`void`) is a hole: a ref holding void until it is filled. A field ref's identity comes from the row and the
 * field, so a row's own fields are told apart from child rows with the same left. A plain row is its title: the title
 * field is its type, and its value holds the text.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { hashContent } from '../dag-implementation/cid'
import { content, put, refNodeContent, refValueCid, isRefNode } from './graph'
import { primitive, primitiveName } from './primitives'

const leafPrimitives = new Set(['string', 'number', 'boolean'])
/** Whether `cid` is a value primitive (string, number, boolean): a leaf hole in a field. */
export function isLeafType(store: FosStore, cid: string): boolean {
  const name = primitiveName(store, cid)
  return !!name && leafPrimitives.has(name)
}
/** The rows a type declares: its fields with what each holds (`void`: required, `unit`: anything). */
export function typeRows(store: FosStore, type: string): FosPathElem[] {
  return store.table.get(type)?.children ?? []
}
/** The identity of row `id`'s ref for `field`. */
export function fieldRefId(id: string, field: string): string {
  return hashContent({ data: { alias: { id } }, children: [[field, field]] })
}
/** The value a ref (or a plain node) stands for. */
function valueOf(store: FosStore, cid: string): string {
  const node = store.table.get(cid)
  return node && isRefNode(store, node) ? refValueCid(store, node) ?? primitive(store, 'void') : cid
}

/**
 * A value for a field: the field's rows with its leaf hole filled by `leaf` (text or a number). A field with no leaf
 * hole (a tag) takes none.
 */
export function fieldText(store: FosStore, field: string, leaf: string | number): string {
  const rows = typeRows(store, field)
  const index = rows.findIndex(([, right]) => isLeafType(store, right))
  if (index < 0) throw new Error('This field holds no value.')
  const value = put(store, { data: { scalar: typeof leaf === 'number' ? { type: 'number', value: leaf } : { type: 'text', value: leaf } }, children: [] })
  return put(store, { data: {}, children: rows.map((row, i): FosPathElem => i === index ? [row[0], value] : row) })
}
/** The leaf a value holds (text or a number, through refs); null when it holds none. */
export function leafValue(store: FosStore, cid: string): string | number | null {
  const node = store.table.get(valueOf(store, cid))
  for (const [, right] of node?.children ?? []) {
    const value = store.table.get(right)?.data.scalar?.value
    if (typeof value === 'string' || typeof value === 'number') return value
  }
  return null
}
/** The text a value holds in its leaf row (through refs); null when it holds none (a hole, a tag). */
export function leafText(store: FosStore, cid: string): string | null {
  const node = store.table.get(valueOf(store, cid))
  for (const [, right] of node?.children ?? []) {
    const scalar = store.table.get(right)?.data.scalar
    if (scalar?.type === 'text' && typeof scalar.value === 'string') return scalar.value
  }
  return null
}

/**
 * The content of a new row `id` of `type`: a field ref per type row, holding what `values` supplies for that field,
 * void for a field left open, or the type's own value where the type fills it. Child rows come after.
 */
export function constructRow(store: FosStore, type: string, id: string, values: ReadonlyMap<string, string>, now: number, children: FosPathElem[] = []): FosNodeContent {
  const never = primitive(store, 'void'), unit = put(store, { data: {}, children: [] })
  const rows = typeRows(store, type).map(([field, value]): FosPathElem => {
    const open = value === never || value === unit
    const held = values.get(field) ?? (open ? never : value)
    return [field, put(store, refNodeContent(store, { alias: { id: fieldRefId(id, field) } }, held))]
  })
  return { data: { alias: { id }, created: { time: now }, updated: { time: now } }, children: [...rows, ...children] }
}
/** The content of a new plain row: its title field filled with `text`, as a ref (its identity `id`) whose value holds its child rows. */
export function constructPlainRow(store: FosStore, title: string, id: string, text: string, now: number): FosNodeContent {
  return refNodeContent(store, { alias: { id }, created: { time: now }, updated: { time: now } }, fieldText(store, title, text))
}

/** Whether `edge` in row `id`'s value is one of that row's own fields (not a child row with the same left). */
export function isFieldRow(store: FosStore, id: string, edge: FosPathElem): boolean {
  return store.table.get(edge[1])?.data.alias?.id === fieldRefId(id, edge[0])
}
/** Row `id`'s ref for `field` among the rows of `value`, or null. */
export function fieldEdge(store: FosStore, id: string, value: FosNodeContent, field: string): FosPathElem | null {
  return value.children.find(edge => edge[0] === field && isFieldRow(store, id, edge)) ?? null
}
/** What row `id` holds for `field` (through its ref): void for an open hole, null when the row has no such field. */
export function fieldValue(store: FosStore, id: string, value: FosNodeContent, field: string): string | null {
  const edge = fieldEdge(store, id, value, field)
  return edge ? valueOf(store, edge[1]) : null
}
/** Row `id`'s value with `field`'s ref now holding `held` (a new value of the same ref). */
export function withFieldValue(store: FosStore, id: string, value: FosNodeContent, field: string, held: string, now: number): FosNodeContent {
  const edge = fieldEdge(store, id, value, field)
  if (!edge) throw new Error('This row has no such field.')
  const ref = content(store, edge[1])
  const next = put(store, refNodeContent(store, { ...ref.data, updated: { time: now } }, held))
  return { ...value, data: { ...value.data, updated: { time: now } }, children: value.children.map(e => e === edge ? [field, next] : e) }
}

/** The field a row of `type` shows as its title: the first of the type's fields that holds text, or none. */
export function titleField(store: FosStore, type: string): string | null {
  for (const [field] of typeRows(store, type)) if (typeRows(store, field).some(([, right]) => isLeafType(store, right))) return field
  return null
}
/** Whether `type` is itself a text field (a plain row's type: its value is the text). */
export function isTextField(store: FosStore, type: string): boolean {
  return typeRows(store, type).some(([, right]) => isLeafType(store, right))
}

/**
 * Row `id`'s value with its text set: its title field's ref holds `text` (a typed row), or its own leaf is `text` (a
 * plain row). Null when the row holds no text.
 */
export function withRowText(store: FosStore, id: string, value: FosNodeContent, text: string, now: number): FosNodeContent | null {
  const field = value.children.find(edge => isFieldRow(store, id, edge) && isTextField(store, edge[0]))?.[0]
  if (field) return withFieldValue(store, id, value, field, fieldText(store, field, text), now)
  const index = value.children.findIndex(([, right]) => store.table.get(right)?.data.scalar?.type === 'text')
  if (index < 0) return null
  const leaf = put(store, { data: { scalar: { type: 'text', value: text } }, children: [] })
  return { ...value, data: { ...value.data, updated: { time: now } }, children: value.children.map((edge, i): FosPathElem => i === index ? [edge[0], leaf] : edge) }
}
/** The name a text field goes by: its alias (the parameter of its stringAlias). */
export function fieldKey(store: FosStore, field: string): string | null {
  for (const [left] of typeRows(store, field)) {
    for (const [param, value] of typeRows(store, left)) {
      if (store.table.get(param)?.data.name?.content !== 'alias') continue
      const scalar = store.table.get(value)?.data.scalar
      if (typeof scalar?.value === 'string') return scalar.value
    }
  }
  return null
}
/** Values for a type's fields, by the fields' names (`{ path, sha256 }`): what a caller supplies a new row with. */
export function fieldValues(store: FosStore, type: string, input: Readonly<Record<string, string | number>>): Map<string, string> {
  const values = new Map<string, string>()
  for (const [field] of typeRows(store, type)) {
    const key = fieldKey(store, field)
    if (key !== null && input[key] !== undefined && isTextField(store, field)) values.set(field, fieldText(store, field, input[key]!))
  }
  return values
}
/** What row `id` (of `type`) holds in its fields, by the fields' names; open holes are left out. */
export function rowRecord(store: FosStore, type: string, id: string, value: FosNodeContent): Record<string, string | number> {
  const record: Record<string, string | number> = {}
  for (const [field] of typeRows(store, type)) {
    const key = fieldKey(store, field), held = fieldValue(store, id, value, field)
    const leaf = held ? leafValue(store, held) : null
    if (key !== null && leaf !== null) record[key] = leaf
  }
  return record
}
/** Row `id`'s value with the named fields of `type` holding `input` (fields left out keep what they hold). */
export function withFieldValues(store: FosStore, type: string, id: string, value: FosNodeContent, input: Readonly<Record<string, string | number>>, now: number): FosNodeContent {
  let next = value
  for (const [field, held] of fieldValues(store, type, input)) next = withFieldValue(store, id, next, field, held, now)
  return next
}
/**
 * Row `id` (value `previous`) as a row of `type`: the fields `type` shares with its old type keep their refs, the others
 * are new (holes, or what `values` supplies); its child rows and identity stay.
 */
export function rebuildRow(store: FosStore, type: string, id: string, previous: FosNodeContent, values: ReadonlyMap<string, string>, now: number): FosNodeContent {
  const own = previous.children.filter(edge => isFieldRow(store, id, edge))
  const children = previous.children.filter(edge => !isFieldRow(store, id, edge) && !(store.table.get(edge[1])?.data.scalar))
  const built = constructRow(store, type, id, values, now, children)
  const rows = built.children.map((edge): FosPathElem => values.has(edge[0]) ? edge : own.find(([field]) => field === edge[0]) ?? edge)
  return { data: { ...previous.data, alias: { id }, updated: { time: now } }, children: rows }
}
