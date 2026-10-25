/**
 * Rows in the pattern-row model. A row is `[type, row]`: the type is a node of rows `[field, value | void]`, and the
 * row's value carries one field ref per row of its type, `[field, ref]`, beside its child rows. A field the type leaves
 * open (`void`, or the wildcard `unit`) is a hole: a ref with no submission until it is filled. A field ref's identity comes from the row and the
 * field, so a row's own fields are told apart from child rows with the same left. A plain row is its title: the title
 * field is its type, and its value holds the text.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { hashContent } from '../dag-implementation/cid'
import { content, libraryNode, put, refNodeContent, refValueCid, isRefNode } from './graph'
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
/**
 * The identity of a row's ref for `field`: the field's own. A row's fields are refs in its value, so the field tells
 * them apart there, wherever the row is (copied, projected into another peer's tree); a child row has an id of its own.
 */
export function fieldRefId(field: string): string {
  return hashContent({ data: { name: { content: 'field' } }, children: [[field, field]] })
}
/** The value a ref (or a plain node) stands for. */
function valueOf(store: FosStore, cid: string): string {
  const node = store.table.get(cid)
  return node && isRefNode(store, node) ? refValueCid(store, node) ?? primitive(store, 'void') : cid
}
/** The node a value's leaves are read from: none for a primitive (void, string, …), whose own rows are its name. */
function leafHolder(store: FosStore, cid: string): FosNodeContent | undefined {
  const value = valueOf(store, cid)
  return primitiveName(store, value) === null ? store.table.get(value) : undefined
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
  const node = leafHolder(store, cid)
  for (const [, right] of node?.children ?? []) {
    const value = store.table.get(right)?.data.scalar?.value
    if (typeof value === 'string' || typeof value === 'number') return value
  }
  return null
}
/** The text a value holds in its leaf row (through refs); null when it holds none (a hole, a tag). */
export function leafText(store: FosStore, cid: string): string | null {
  const node = leafHolder(store, cid)
  for (const [, right] of node?.children ?? []) {
    const scalar = store.table.get(right)?.data.scalar
    if (scalar?.type === 'text' && typeof scalar.value === 'string') return scalar.value
  }
  return null
}

/** A text value: a string leaf. */
export function textValue(store: FosStore, text: string): string {
  return put(store, { data: { scalar: { type: 'text', value: text } }, children: [] })
}
/** The text a value is (a string leaf) or holds in its leaf row, through refs; null when it holds none. */
export function textOf(store: FosStore, cid: string): string | null {
  const scalar = leafHolder(store, cid)?.data.scalar
  if (scalar?.type === 'text' && typeof scalar.value === 'string') return scalar.value
  return leafText(store, cid)
}
/** A value's label row: its text as a string leaf under the title field (an answer's receipt, a grant's note). */
export function labelRow(store: FosStore, text: string): FosPathElem {
  return [libraryNode(store, 'title') ?? primitive(store, 'string'), textValue(store, text)]
}
/** The node with its label (its first text leaf row) set to `text`. */
export function withLabel(store: FosStore, node: FosNodeContent, text: string): FosNodeContent {
  const index = node.children.findIndex(([, right]) => store.table.get(right)?.data.scalar?.type === 'text')
  const row = labelRow(store, text)
  return { ...node, children: index < 0 ? [...node.children, row] : node.children.map((edge, i) => i === index ? row : edge) }
}
/** A ref's own title row: what an argument row (a requirement, an allocation) is called, whatever its ref holds. */
function refTitleEdge(store: FosStore, ref: FosNodeContent): FosPathElem | null {
  const title = libraryNode(store, 'title')
  return title ? ref.children.find(edge => edge[0] === title && isFieldRow(store, edge)) ?? null : null
}
/** The title a ref carries itself (an argument row's text), or null. */
export function refTitle(store: FosStore, ref: FosNodeContent): string | null {
  const edge = refTitleEdge(store, ref)
  return edge ? leafText(store, edge[1]) : null
}
/** The ref with its own title row holding `text` (added when it has none). */
export function withRefTitle(store: FosStore, ref: FosNodeContent, text: string): FosNodeContent {
  const title = libraryNode(store, 'title')
  if (!title) throw new Error('A titled ref needs a library title field.')
  const row: FosPathElem = [title, put(store, refNodeContent(store, { alias: { id: fieldRefId(title) } }, fieldText(store, title, text)))]
  const old = refTitleEdge(store, ref)
  return { ...ref, children: old ? ref.children.map(edge => edge === old ? row : edge) : [...ref.children, row] }
}

/**
 * The content of a new row `id` of `type`: a field ref per type row, holding what `values` supplies for that field,
 * nothing for a field left open (a hole), or the type's own value where the type fills it. Child rows come after.
 */
export function constructRow(store: FosStore, type: string, id: string, values: ReadonlyMap<string, string>, now: number, children: FosPathElem[] = []): FosNodeContent {
  const never = primitive(store, 'void'), unit = put(store, { data: {}, children: [] })
  const rows = typeRows(store, type).map(([field, value]): FosPathElem => {
    const open = value === never || value === unit
    const held = values.get(field) ?? (open ? null : value)
    return [field, put(store, refNodeContent(store, { alias: { id: fieldRefId(field) } }, held))]
  })
  return { data: { alias: { id }, created: { time: now }, updated: { time: now } }, children: [...rows, ...children] }
}
/** The content of a new plain row: its title field filled with `text`, as a ref (its identity `id`) whose value holds its child rows. */
export function constructPlainRow(store: FosStore, title: string, id: string, text: string, now: number): FosNodeContent {
  return refNodeContent(store, { alias: { id }, created: { time: now }, updated: { time: now } }, fieldText(store, title, text))
}

/** A row of `type` holding `text`: a plain row of a text field, else a row whose title field holds it (left open when empty). */
export function constructTextRow(store: FosStore, type: string, id: string, text: string, now: number, values = new Map<string, string>()): FosNodeContent {
  if (isTextField(store, type)) return constructPlainRow(store, type, id, text, now)
  const title = titleField(store, type)
  if (title && text) values.set(title, fieldText(store, title, text))
  return constructRow(store, type, id, values, now)
}

/** Whether `edge` in a row's value is one of that row's own fields (not a child row with the same left). */
export function isFieldRow(store: FosStore, edge: FosPathElem): boolean {
  return store.table.get(edge[1])?.data.alias?.id === fieldRefId(edge[0])
}
/** Row `id`'s ref for `field` among the rows of `value`, or null. */
export function fieldEdge(store: FosStore, value: FosNodeContent, field: string): FosPathElem | null {
  return value.children.find(edge => edge[0] === field && isFieldRow(store, edge)) ?? null
}
/** What row `id` holds for `field` (through its ref): void for an open hole, null when the row has no such field. */
export function fieldValue(store: FosStore, value: FosNodeContent, field: string): string | null {
  const edge = fieldEdge(store, value, field)
  return edge ? valueOf(store, edge[1]) : null
}
/** Row `id`'s value with `field`'s ref now holding `held` (a new value of the same ref). */
export function withFieldValue(store: FosStore, value: FosNodeContent, field: string, held: string, now: number): FosNodeContent {
  const edge = fieldEdge(store, value, field)
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
export function withRowText(store: FosStore, value: FosNodeContent, text: string, now: number): FosNodeContent | null {
  const field = value.children.find(edge => isFieldRow(store, edge) && isTextField(store, edge[0]))?.[0]
  if (field) return withFieldValue(store, value, field, fieldText(store, field, text), now)
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
export function rowRecord(store: FosStore, type: string, value: FosNodeContent): Record<string, string | number> {
  const record: Record<string, string | number> = {}
  for (const [field] of typeRows(store, type)) {
    const key = fieldKey(store, field), held = fieldValue(store, value, field)
    const leaf = held ? leafValue(store, held) : null
    if (key !== null && leaf !== null) record[key] = leaf
  }
  return record
}
/** Row `id`'s value with the named fields of `type` holding `input` (fields left out keep what they hold). */
export function withFieldValues(store: FosStore, type: string, value: FosNodeContent, input: Readonly<Record<string, string | number>>, now: number): FosNodeContent {
  let next = value
  for (const [field, held] of fieldValues(store, type, input)) next = withFieldValue(store, next, field, held, now)
  return next
}
/**
 * Row `id` (value `previous`) as a row of `type`: the fields `type` shares with its old type keep their refs, the others
 * are new (holes, or what `values` supplies); its child rows and identity stay.
 */
export function rebuildRow(store: FosStore, type: string, id: string, previous: FosNodeContent, values: ReadonlyMap<string, string>, now: number): FosNodeContent {
  const own = previous.children.filter(edge => isFieldRow(store, edge))
  const children = previous.children.filter(edge => !isFieldRow(store, edge) && !(store.table.get(edge[1])?.data.scalar))
  const built = constructRow(store, type, id, values, now, children)
  const rows = built.children.map((edge): FosPathElem => values.has(edge[0]) ? edge : own.find(([field]) => field === edge[0]) ?? edge)
  return { data: { ...previous.data, alias: { id }, updated: { time: now } }, children: rows }
}

/** The text fields of a type, in order. */
function textFields(store: FosStore, type: string): string[] {
  return typeRows(store, type).map(([field]) => field).filter(field => isTextField(store, field))
}
/**
 * A row's whole text: a plain row's own text; else its last text field holding text (a note's body), its title when
 * that is the only one. Empty when it holds none.
 */
export function rowText(store: FosStore, nodeCid: string, type: string | null): string {
  if (type && isTextField(store, type)) return leafText(store, nodeCid) ?? ''
  const value = content(store, valueOf(store, nodeCid))
  const fields = type ? textFields(store, type) : value.children.filter(edge => isFieldRow(store, edge) && isTextField(store, edge[0])).map(([field]) => field)
  for (const field of [...fields].reverse()) {
    const held = fieldValue(store, value, field), text = held ? leafText(store, held) : null
    if (text) return text
  }
  return type ? '' : leafText(store, nodeCid) ?? ''
}
/** The body of a row: its last text field when the type has a title field before it (a note's body), else null. */
export function rowBody(store: FosStore, nodeCid: string, type: string): string | null {
  const fields = textFields(store, type)
  if (fields.length < 2) return null
  const value = content(store, valueOf(store, nodeCid))
  const held = fieldValue(store, value, fields.at(-1)!)
  return held ? leafText(store, held) ?? '' : ''
}
/** The value a single-value row holds in its first text field (a message's addressee, an acknowledged message id). */
export function rowLeaf(store: FosStore, edge: FosPathElem): string | number | null {
  const field = textFields(store, edge[0])[0]
  if (!field) return null
  const value = content(store, valueOf(store, edge[1]))
  const held = fieldValue(store, value, field)
  return held ? leafValue(store, held) : null
}
/** The fields of row `id` (of `type`) as a view shows them: name, value, and whether it is still open. */
export type FieldView = { id: string; field: string; key: string | null; value: string | number | null; open: boolean }
export function fieldViews(store: FosStore, type: string, value: FosNodeContent): FieldView[] {
  const never = primitive(store, 'void')
  return typeRows(store, type).flatMap(([field]): FieldView[] => {
    const edge = fieldEdge(store, value, field)
    if (!edge) return []
    const held = valueOf(store, edge[1])
    return [{ id: fieldRefId(field), field, key: fieldKey(store, field), value: held === never ? null : leafValue(store, held), open: held === never }]
  })
}
