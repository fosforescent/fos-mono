/** Generic graph-template construction and field projections. No domain type names live here.
 * A product is a template's parameter rows. A repeated parameter expands into
 * positioned mutable refs. Only scalar leaves require native implementations.
 * Instances use ordinary row/ref edges so node exchange, history and merge work unchanged.
 */
import type { FosNodeContent, FosPathElem } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { content, identityCid, isPeerReference, put, refNodeContent, valueContent, withChildValue } from './graph'

export type FormInput = string | number | FormInput[] | { [key: string]: FormInput }

function inputAt(input: FormInput | undefined, path: string[]): FormInput | undefined {
  let value = input
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
  }
  return value
}

export function formFields(store: FosStore, template: string): Array<{ type: string; name: string; label: string; from: string[] }> {
  return content(store, template).children.flatMap(([type, cid]) => {
    const p = content(store, cid).data.parameter
    return p ? [{ type, name: p.name, label: content(store, cid).data.description?.content ?? p.name, from: p.from ?? [p.name] }] : []
  })
}

/** Expand a graph definition; caller inputs are values, never executable JS. */
export function constructForm(store: FosStore, template: string, id: string, input: FormInput | undefined, now: number, depth = 0): FosNodeContent {
  if (depth > 64) throw new Error('Constructor nesting exceeds 64 levels.')
  const form = content(store, template).data.form
  if (!form) throw new Error('This template has no graph constructor.')
  const data: FosNodeContent['data'] = { alias: { id }, created: { time: now }, updated: { time: now } }
  if (form.primitive) {
    const numeric = form.primitive === 'number' || form.primitive === 'time'
    const value = input ?? (numeric ? 0 : '')
    if (typeof value !== (numeric ? 'number' : 'string') || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Expected ${form.primitive}.`)
    data.scalar = { type: form.primitive, value: value as string | number }
    return { data, children: [] }
  }
  data.presentation = { ...(form.title ? { title: form.title } : {}), ...(form.text ? { text: form.text } : {}), ...(form.attribution ? { attribution: form.attribution } : {}), ...(form.repeat ? { sequence: true } : {}) }
  const fields = formFields(store, template)
  if (new Set(fields.map(field => field.name)).size !== fields.length) throw new Error('Constructor parameter names must be unique.')
  if (form.repeat && fields.length !== 1) throw new Error('A repeated template needs one parameter row.')
  if (input !== undefined && (form.repeat ? !Array.isArray(input) : !input || typeof input !== 'object' || Array.isArray(input))) throw new Error(form.repeat ? 'Expected a sequence.' : 'Expected named constructor inputs.')
  const children: FosPathElem[] = []
  const add = (type: string, name: string, value: FormInput | undefined, position?: number) => {
    const fieldId = `${id}/field/${encodeURIComponent(name)}`
    const target = constructForm(store, type, fieldId, value, now, depth + 1)
    target.data.name = { content: name }
    if (position !== undefined) target.data.position = { value: position }
    const ref = refNodeContent(store, { alias: { id: fieldId }, name: { content: name } }, put(store, target))
    children.push([type, put(store, ref)])
  }
  if (form.repeat) (input as FormInput[] | undefined ?? []).forEach((value, index) => add(fields[0]!.type, String(index), value, index))
  else for (const field of fields) add(field.type, field.name, inputAt(input, field.from))
  return { data, children }
}

/** Read fields by their stored names; no dependency on physical row ordering. */
export function formValueAt(store: FosStore, node: FosNodeContent, path: string[]): FosNodeContent | null {
  let value = node
  for (const name of path) {
    const edge = value.children.find(e => {
      const identity = content(store, identityCid(store, e))
      return !isPeerReference(identity) && valueContent(store, identityCid(store, e)).data.name?.content === name
    })
    if (!edge) return null
    value = valueContent(store, identityCid(store, edge))
  }
  return value
}

/**
 * A constructed node's fields as plain values, read through the definition's parameter rows (nested products
 * recurse; repeated fields become arrays). Missing or unloaded fields are left out.
 */
export function formRecord(store: FosStore, template: string, node: FosNodeContent, depth = 0): FormInput | undefined {
  const form = content(store, template).data.form
  if (!form || depth > 64) return undefined
  if (form.primitive) return node.data.scalar?.value
  const fields = formFields(store, template)
  const valueOf = (edge: FosPathElem) => isPeerReference(content(store, identityCid(store, edge))) ? null : valueContent(store, identityCid(store, edge))
  if (form.repeat) {
    const field = fields[0]
    if (!field) return []
    return node.children.filter(([type]) => type === field.type).flatMap(edge => { const v = valueOf(edge); const r = v ? formRecord(store, field.type, v, depth + 1) : undefined; return r === undefined ? [] : [r] })
  }
  const out: { [key: string]: FormInput } = {}
  for (const field of fields) {
    const edge = node.children.find(e => e[0] === field.type && valueContent(store, identityCid(store, e)).data.name?.content === field.name)
    const value = edge ? valueOf(edge) : null
    const record = value ? formRecord(store, field.type, value, depth + 1) : undefined
    if (record !== undefined) out[field.name] = record
  }
  return out
}

export function formTitle(store: FosStore, node: FosNodeContent, definition?: FosNodeContent): string {
  const title = definition?.data.form?.title ?? node.data.presentation?.title
  const scalar = title ? formValueAt(store, node, title)?.data.scalar : node.data.scalar
  return scalar ? String(scalar.value) : node.data.description?.content ?? node.data.name?.content ?? node.data.parameter?.name ?? ''
}

/** Record UI order in list entries so ordering is explicit graph data. */
export function positionFormRows(store: FosStore, node: FosNodeContent, now: number): FosNodeContent {
  if (!node.data.presentation?.sequence) return node
  return { ...node, children: node.children.map((edge, index) => {
    const value = valueContent(store, identityCid(store, edge))
    return value.data.position?.value === index ? edge : withChildValue(store, edge, { ...value, data: { ...value.data, position: { value: index } } }, now)
  }) }
}

/** Rewrite just the projected leaf, preserving all other refs and their identities. */
export function setFormTitle(store: FosStore, node: FosNodeContent, text: string, now: number): FosNodeContent {
  const path = node.data.presentation?.title ?? []
  const rewrite = (value: FosNodeContent, names: string[]): FosNodeContent => {
    if (!names.length) {
      if (!value.data.scalar) throw new Error('This constructor has no editable scalar title.')
      const type = value.data.scalar.type
      const scalar = type === 'number' || type === 'time' ? Number(text) : text
      if (typeof scalar === 'number' && (!text.trim() || !Number.isFinite(scalar))) throw new Error(`Expected ${type}.`)
      return { ...value, data: { ...value.data, scalar: { type, value: scalar }, updated: { time: now } } }
    }
    const edge = value.children.find(e => valueContent(store, identityCid(store, e)).data.name?.content === names[0])
    if (!edge || isPeerReference(content(store, identityCid(store, edge)))) throw new Error('Load this field before editing it.')
    const next = withChildValue(store, edge, rewrite(valueContent(store, identityCid(store, edge)), names.slice(1)), now)
    return { ...value, data: { ...value.data, updated: { time: now } }, children: value.children.map(e => e === edge ? next : e) }
  }
  return rewrite(node, path)
}

export function formAttribution(store: FosStore, node: FosNodeContent, definition?: FosNodeContent): { id: string; name: string; time: number } | undefined {
  const paths = definition?.data.form?.attribution ?? node.data.presentation?.attribution
  if (!paths) return undefined
  const id = formValueAt(store, node, paths.id)?.data.scalar?.value
  const name = formValueAt(store, node, paths.name)?.data.scalar?.value
  return { id: String(id ?? ''), name: String(name ?? ''), time: node.data.created?.time ?? node.data.updated?.time ?? 0 }
}

/** UI structure comes from the pinned definition's parameter rows, including nested products. */
export type FormElement = {
  label: string; path: string[]; primitive?: NonNullable<FosNodeContent['data']['scalar']>['type'];
  value?: string | number; repeat?: boolean; fields: FormElement[]; available: boolean
}

export function formElements(store: FosStore, template: string, node: FosNodeContent, path: string[] = [], label = '', depth = 0): FormElement {
  const form = content(store, template).data.form
  const result: FormElement = { label, path, fields: [], available: true }
  if (!form || depth > 64) return { ...result, available: false }
  if (form.primitive) return { ...result, primitive: form.primitive, value: node.data.scalar?.value }
  result.repeat = !!form.repeat
  const fields = formFields(store, template)
  const append = (type: string, edge: FosPathElem | undefined, fieldLabel: string) => {
    if (!edge) { result.fields.push({ label: fieldLabel, path, fields: [], available: false }); return }
    const identity = content(store, identityCid(store, edge))
    const fieldPath = [...path, identity.data.alias?.id ?? edge[1]]
    if (isPeerReference(identity)) { result.fields.push({ label: fieldLabel, path: fieldPath, fields: [], available: false }); return }
    result.fields.push(formElements(store, type, valueContent(store, identityCid(store, edge)), fieldPath, fieldLabel, depth + 1))
  }
  if (form.repeat && fields[0]) node.children.filter(([type]) => type === fields[0]!.type).forEach((edge, index) => append(fields[0]!.type, edge, `${fields[0]!.label} ${index + 1}`))
  else for (const field of fields) append(field.type, node.children.find(edge => valueContent(store, identityCid(store, edge)).data.name?.content === field.name), field.label)
  return result
}
