/** Native values at the API boundary; records and sequences are ordinary typed ref rows in the graph. */
import type { FosStore } from '../dag-implementation/store'
import { hashContent } from '../dag-implementation/cid'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, put, refNodeContent, refValueCid, valueContent, isRowEdge, isBranchChoice, selectedBranchValue } from './graph'

export type NodeValue = null | boolean | number | string | NodeValue[] | { [key: string]: NodeValue }
type ValueShape = 'text' | 'number' | 'boolean' | 'null' | 'record' | 'sequence'

export function nodeValueType(store: FosStore, shape: ValueShape): string {
  return put(store, {
    data: {
      name: { content: `fos:value:${shape}` },
      form: shape === 'record' ? { open: true } : shape === 'sequence' ? { open: true, repeat: true } : { primitive: shape }
    },
    children: []
  })
}

const VALUE_SHAPES: ValueShape[] = ['text', 'number', 'boolean', 'null', 'record', 'sequence']
/** Whether `cid` is one of the native value types (`nodeValueType`): told by identity. */
export function isNodeValueType(store: FosStore, cid: string): boolean {
  return VALUE_SHAPES.some(shape => nodeValueType(store, shape) === cid)
}

/** Stable field refs preserve identity across edits; unchanged fields keep their exact CID. */
export function constructNodeValue(
  store: FosStore,
  input: unknown,
  id: string,
  previous?: string,
  depth = 0,
  active = new Set<object>()
): { type: string; cid: string } {
  if (depth > 64) throw new Error('Node value nesting exceeds 64 levels.')
  if (input === undefined) throw new Error('A node value must be defined.')
  const scalar: ValueShape =
    input === null
      ? 'null'
      : Array.isArray(input)
        ? 'sequence'
        : typeof input === 'object'
          ? 'record'
          : typeof input === 'string'
            ? 'text'
            : (typeof input as ValueShape)
  if (!['text', 'number', 'boolean', 'null', 'record', 'sequence'].includes(scalar))
    throw new Error('Expected graph fields or a scalar value.')
  if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('Graph numbers must be finite.')
  const type = nodeValueType(store, scalar as ValueShape)
  if (scalar !== 'record' && scalar !== 'sequence')
    return {
      type,
      cid: put(store, {
        data: { scalar: { type: scalar as 'text' | 'number' | 'boolean' | 'null', value: input as string | number | boolean | null } },
        children: []
      })
    }
  if (active.has(input as object)) throw new Error('Cyclic node values must use explicit refs.')
  if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    throw new Error('Expected a plain record.')
  active.add(input as object)
  try {
    const old = previous && store.table.has(previous) ? valueContent(store, previous) : null
    const entries = Array.isArray(input)
      ? Array.from(input, (value, index) => [String(index), value ?? null] as const)
      : Object.entries(input as object)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    if (entries.length > 10000) throw new Error('Node value has too many fields.')
    const children: FosPathElem[] = entries.map(([name, value]) => {
      const prior = old?.children.find(([, cid]) => (content(store, cid).data.name?.content ?? valueContent(store, cid).data.name?.content) === name)?.[1]
      if (name.length > 1024) throw new Error('A field name exceeds 1,024 characters.')
      const pathId = `${id}/field/${encodeURIComponent(name)}`
      const fieldId =
        (prior && content(store, prior).data.alias?.id) ||
        (pathId.length <= 240
          ? pathId
          : `field:${hashContent({ data: { name: { content: id }, description: { content: name } }, children: [] })}`)
      const next = constructNodeValue(store, value, fieldId, prior, depth + 1, active)
      const data: FosNodeContent['data'] = { alias: { id: fieldId }, name: { content: name } }
      // Match form constructors: the row's left edge supplies its type; the right ref owns its value.
      const target = content(store, next.cid)
      const cid = put(store, { ...target, data: { ...target.data, name: { content: name }, ...(Array.isArray(input) ? { position: { value: Number(name) } } : {}) } })
      return [next.type, put(store, refNodeContent(store, data, cid))]
    })
    return { type, cid: put(store, { data: { presentation: scalar === 'sequence' ? { sequence: true } : {} }, children }) }
  } finally {
    active.delete(input as object)
  }
}

/** Reads only graph structure and scalar leaves. Old JSON-text records are a read-only migration boundary. */
export function readGraphValue(store: FosStore, cid: string, depth = 0, active = new Set<string>()): NodeValue | undefined {
  if (depth > 64 || active.size > 256 || active.has(cid) || !store.table.has(cid)) return undefined
  active.add(cid)
  try {
    const node = content(store, cid),
      target = refValueCid(store, node)
    if (isBranchChoice(store, node)) {
      const selected = selectedBranchValue(store, cid)
      return selected ? readGraphValue(store, selected, depth, active) : undefined
    }
    if (target) return readGraphValue(store, target, depth, active)
    if (node.data.scalar) {
      const { type, value } = node.data.scalar
      if (
        ((type === 'text' || type === 'peer') && typeof value === 'string') ||
        ((type === 'number' || type === 'time') && typeof value === 'number' && Number.isFinite(value)) ||
        (type === 'boolean' && typeof value === 'boolean') ||
        (type === 'null' && value === null)
      )
        return value
      return undefined
    }
    if (node.data.presentation) {
      const entries: Array<[string, NodeValue, number]> = [],
        names = new Set<string>()
      for (const [type, child] of node.children) {
        // Literal constraints and links are not mutable record fields.
        if (type === store.primitive.linkField.getId() || !isRowEdge(store, [type, child])) continue
        const field = content(store, child),
          name = field.data.name?.content ?? valueContent(store, child).data.name?.content
        if (name === undefined || !field.data.alias || !isRowEdge(store, [type, child])) return undefined
        if (names.has(name)) return undefined
        names.add(name)
        const value = readGraphValue(store, child, depth + 1, active)
        if (value === undefined) return undefined
        const primitive = content(store, type).data.form?.primitive
        if (
          primitive &&
          (primitive === 'null'
            ? value !== null
            : typeof value !== (primitive === 'number' || primitive === 'time' ? 'number' : primitive === 'boolean' ? 'boolean' : 'string'))
        )
          return undefined
        entries.push([name, value, valueContent(store, child).data.position?.value ?? field.data.position?.value ?? Number(name)])
      }
      return node.data.presentation.sequence
        ? entries.sort((a, b) => a[2] - b[2]).map(([, value]) => value)
        : Object.fromEntries(entries.map(([name, value]) => [name, value]))
    }
    if (node.data.description && !node.data.scalar) {
      try {
        return JSON.parse(node.data.description.content) as NodeValue
      } catch {
        return undefined
      }
    }
    return undefined
  } finally {
    active.delete(cid)
  }
}
