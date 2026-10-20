/**
 * cid v4 → v5: a row type is told apart by its graph identity alone.
 *
 * Up to v4 types said what they were with markers in their data: the seed types of migrations v3/v4 carry
 * `instanceKind` and `behavior: builtin:<kind>` and no graph identity, the library's types before the row-kind removal
 * carry `behavior: builtin:<kind>` beside their `lib:type:<kind>` alias, template rows carry `instanceKind` (release
 * builds) or `behavior: builtin:task`, and reference-error stand-ins `instanceKind: reference-error`. From v5 a row is
 * the edge `[type, row]` and its type is known by the type's alias only (sync/graph.ts `typeIdOf`). This step:
 *   - gives every type with a marker and no identity the alias `lib:type:<kind>` and drops the markers (the v4 seed's
 *     types thus become the library's types exactly); an unknown kind becomes a version of the plain row type, keeping
 *     its own data and rows;
 *   - replaces the seed's Note and Comment types (which had no constructor) by the library's graph-defined ones;
 *   - drops the markers from template rows and other nodes with an identity of their own (they stay the type of their
 *     instances) and the kind from reference-error stand-ins (they keep the template they wait for);
 *   - pins money (allocation rows of the `account` resource: `-$ 50` requests, `$ 20` payments) to the Money type,
 *     which reads them by sign (negative = a request for payment, positive = a payment), and drops the separate supply
 *     settling a payment used to write beside it (a payment now fills its request alone);
 *   - rebuilds note and comment rows of the seed's types as values of the library's constructors: the Markdown body in
 *     the `body` field, a comment's author in `person`, its votes and scope kept as `legacy` metadata.
 *
 * Outside the frozen v3/v4 steps that wrote them, this is the only code that reads the markers. The construction below
 * follows sync/forms.ts `constructForm`, sync/replica.ts `constructRowValue`/`withTextParameters` and
 * sync/legacy-comment.ts as they were when v5 was introduced (migration-v5.test.ts checks it against them), and the types
 * it pins to are frozen in migration-v5-types.json: migrated content must hash the same on every peer and every build,
 * so it does not call the live versions (which may change) or read the build's library.
 */

import type { FosContextData, FosDataContent, FosNodeContent, FosPathElem } from '../types'
import { hashContentAt } from './cid'
import type { MigrationEnvironment, MigrationTools, NodeUpgrade } from './migrations'
import * as MIGRATION_V5_TYPES from './migration-v5-types.json'

const PLAIN = 'lib:type:plain', NOTE = 'lib:type:note', COMMENT = 'lib:type:comment', ALLOCATION = 'lib:type:allocation', MONEY = 'lib:type:allocation:money'
/** The kinds the v4 seed and library named with markers; v2's requirement and supply rows were allocations. */
const KINDS = ['task', 'plain', 'note', 'comment', 'ref', 'query', 'resource', 'allocation', 'template', 'pattern', 'home', 'device-root', 'document-root']
const KIND_ALIASES: Record<string, string> = { requirement: 'allocation', supply: 'allocation' }

/** The library's Note, Comment and Money types as v5 found them, with the nodes they hold (keys are their v4 cids). */
const FROZEN = MIGRATION_V5_TYPES as unknown as { types: Record<string, string>; nodes: Record<string, FosNodeContent> }

type FormInput = string | number | FormInput[] | { [key: string]: FormInput }

/** A node's legacy marker: the kind its `behavior: builtin:<kind>` or `instanceKind` names. */
function markerOf(data: FosDataContent): string | undefined {
  return data.behavior?.content?.match(/^builtin:(.+)$/)?.[1] ?? data.instanceKind?.kind
}

function withoutMarkers(data: FosDataContent): FosDataContent {
  const { instanceKind: _kind, behavior, missingTemplate, ...rest } = data
  return {
    ...rest,
    ...(behavior && !behavior.content?.startsWith('builtin:') ? { behavior } : {}),
    ...(missingTemplate ? { missingTemplate: { cid: missingTemplate.cid } } : {})
  }
}

/**
 * The library type a node with a legacy marker is a version of: its `lib:type:…` alias, else the kind its marker
 * names (an unknown one: the plain row type). Null when the node has no marker, has an identity of its own (a template
 * row, Home) or is a reference-error stand-in.
 */
function libraryTypeIdOf(node: FosNodeContent | undefined): string | null {
  const marker = node && markerOf(node.data)
  if (!node || !marker) return null
  const alias = node.data.alias?.id
  if (alias) return alias.startsWith('lib:type:') ? alias : null
  if (marker === 'reference-error') return null
  const kind = KIND_ALIASES[marker] ?? marker
  return KINDS.includes(kind) ? `lib:type:${kind}` : PLAIN
}

const isMoney = (data: FosDataContent): boolean => data.allocation?.type === 'account' || data.requirement?.resource === 'account'

/** The payment a supply written by the old payment settlement stands for (its `ref`), if it is one. */
function settledPayment(data: FosDataContent): string | undefined {
  if (data.supply?.capability === 'allocation') return data.supply.ref
  const a = data.allocation
  return a?.capability === 'allocation' && a.amount > 0 ? a.ref : undefined
}

function inputAt(input: FormInput | undefined, path: string[]): FormInput | undefined {
  let value = input
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
  }
  return value
}

const TEXT_PARAMETER = /(?<![\\{@])\{([A-Za-z_][\w.-]*)\}(?!\})/g

export function planLibraryIdentities(context: FosContextData, environment: MigrationEnvironment, tools: MigrationTools): NodeUpgrade {
  const input = context.nodes
  const read = (cid: string): FosNodeContent | undefined => input[cid] ?? tools.read(cid)
  const id = (name: string): string => {
    const node = environment.primitive[name]
    if (!node) throw new Error(`unknown primitive ${name}`)
    return node.getId()
  }
  // a primitive as it is in the loading store (the target format), emitted so new edges can point at it
  const emittedPrimitives = new Map<string, string>()
  const primitive = (cid: string): string => {
    const known = emittedPrimitives.get(cid)
    if (known) return known
    const node = environment.table.get(cid)
    if (!node) throw new Error(`primitive ${cid} missing from the loading store`)
    const out = tools.emit({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [primitive(a), primitive(b)]) })
    emittedPrimitives.set(cid, out)
    return out
  }
  // a primitive's cids in the input's formats
  const memo = new Map<string, string>()
  const old = (cid: string, version: number): string => {
    const key = `${version}:${cid}`, known = memo.get(key)
    if (known) return known
    const node = environment.table.get(cid)!
    const out = hashContentAt({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [old(a, version), old(b, version)]) }, version)
    memo.set(key, out)
    return out
  }
  // the loading store is in the target format: its own cids are the target-format ones
  const versions = (cid: string): Set<string> => new Set([...[0, 1, 2, 3, 4].map((v) => old(cid, v)), cid])
  const primitives = new Set([...environment.table.keys()].flatMap((cid) => [...versions(cid)]))
  const IP = versions(id('instructionPointerConstructor')), TP = versions(id('targetPointerConstructor')), FIELD = versions(id('documentField'))
  const ip = primitive(id('instructionPointerConstructor')), tp = primitive(id('targetPointerConstructor')), field = primitive(id('documentField'))

  // the frozen library types, emitted on first use
  const frozen = new Map<string, string>()
  const frozenNode = (key: string): string => {
    const known = frozen.get(key)
    if (known) return known
    const node = FROZEN.nodes[key]
    if (!node) throw new Error(`frozen type node ${key} missing`)
    const out = tools.emit({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [frozenNode(a), frozenNode(b)]) })
    frozen.set(key, out)
    return out
  }
  const libraryType = (typeId: string): string => frozenNode(FROZEN.types[typeId]!)

  /** A node's own content in v5: a type gets its identity (or the library's constructor), markers go. */
  const upgradeNode = (node: FosNodeContent): FosNodeContent => {
    if (!markerOf(node.data)) return node
    const typeId = libraryTypeIdOf(node)
    if ((typeId === NOTE || typeId === COMMENT) && !node.data.form) return tools.read(libraryType(typeId))!
    const data = withoutMarkers(node.data)
    return { ...node, data: typeId && !node.data.alias ? { alias: { id: typeId }, ...data } : data }
  }

  // nodes earlier steps of this run emitted (the v3/v4 seed types, Row types rows) are upgraded here, where edges point at them
  const fixed = new Map<string, string>()
  const fixEmitted = (cid: string): string => {
    if (input[cid]) return cid
    const known = fixed.get(cid)
    if (known) return known
    const node = tools.read(cid)
    let out = cid
    if (node) {
      const next = upgradeNode(node)
      const children = next.children.map(([a, b]): FosPathElem => [fixEmitted(a), fixEmitted(b)])
      out = next === node && children.every((edge, i) => edge[0] === node.children[i]![0] && edge[1] === node.children[i]![1]) ? cid : tools.emit({ ...next, children })
    }
    fixed.set(cid, out)
    return out
  }

  /** Construct a value of the graph constructor `type` (an emitted cid), as sync/forms.ts `constructForm` does. */
  const construct = (type: string, valueId: string, value: FormInput | undefined, time: number, depth = 0): FosNodeContent => {
    if (depth > 64) throw new Error('Constructor nesting exceeds 64 levels.')
    const definition = tools.read(type)!
    const form = definition.data.form!
    const data: FosDataContent = { alias: { id: valueId }, created: { time }, updated: { time } }
    if (form.primitive) {
      const numeric = form.primitive === 'number' || form.primitive === 'time'
      const scalar = value ?? (numeric ? 0 : '')
      data.scalar = { type: form.primitive, value: typeof scalar === (numeric ? 'number' : 'string') ? scalar as string | number : String(scalar) }
      return { data, children: [] }
    }
    data.presentation = { ...(form.title ? { title: form.title } : {}), ...(form.text ? { text: form.text } : {}), ...(form.attribution ? { attribution: form.attribution } : {}), ...(form.repeat ? { sequence: true } : {}) }
    const fields = definition.children.flatMap(([fieldType, cid]) => {
      const p = read(cid)?.data.parameter
      return p ? [{ type: fieldType, name: p.name, from: p.from ?? [p.name] }] : []
    })
    const children: FosPathElem[] = []
    const add = (fieldType: string, name: string, fieldValue: FormInput | undefined, position?: number) => {
      const fieldId = `${valueId}/field/${encodeURIComponent(name)}`
      const target = construct(fieldType, fieldId, fieldValue, time, depth + 1)
      target.data.name = { content: name }
      if (position !== undefined) target.data.position = { value: position }
      children.push([fieldType, tools.emit({ data: { alias: { id: fieldId }, name: { content: name } }, children: [[tp, tools.emit(target)]] })])
    }
    if (form.repeat) (Array.isArray(value) ? value : []).forEach((v, index) => add(fields[0]!.type, String(index), v, index))
    else for (const f of fields) add(f.type, f.name, inputAt(value, f.from))
    return { data, children }
  }

  /** A comment's old votes and scope, kept as ordinary graph data (sync/legacy-comment.ts). */
  const legacyCommentMetadata = (row: FosNodeContent, rowId: string, time: number): FosPathElem[] => {
    const comment = row.data.comment
    if (!comment) return []
    const values: Record<string, string> = Object.fromEntries(Object.entries(comment.votes ?? {}).map(([peer, vote]) => [`vote:${peer}`, String(vote)]))
    if (comment.scope) values.scope = comment.scope
    if (!Object.keys(values).length) return []
    const text = tools.emit({ data: { form: { primitive: 'text' } }, children: [] })
    const type = tools.emit({ data: { form: {} }, children: Object.keys(values).sort().map((name): FosPathElem => [text, tools.emit({ data: { alias: { id: `legacy:parameter:${name}` }, parameter: { name } }, children: [] })]) })
    const alias = `${rowId}/legacy`
    const value = construct(type, alias, values, time)
    value.data.name = { content: 'legacy' }
    value.data.description = { content: 'Previous comment metadata' }
    return [[type, tools.emit({ data: { alias: { id: alias }, name: { content: 'legacy' } }, children: [[tp, tools.emit(value)]] })]]
  }

  /** Does `edge` already bind the text parameter `name` (a named ref typed by the document field)? */
  const bindsParameter = (edge: FosPathElem, name: string): boolean => {
    const child = read(edge[1])
    return child?.data.name?.content === name && child.children.some(([i, t]) => (IP.has(i) || i === ip) && (FIELD.has(t) || t === field))
  }

  /**
   * A note or comment row of the seed's types as a value of the library's constructor `typeId` (sync/replica.ts
   * `constructRowValue` with the old row as `previous`): its text in the body field, a comment's author in `person`,
   * the old row's other data and rows kept, then its single-brace text parameters bound (`withTextParameters`). The
   * time is the row's own, so every peer builds the same node.
   */
  const constructedRow = (typeId: string, row: FosNodeContent): FosNodeContent => {
    const legacy = row.data.comment
    const rowId = row.data.alias?.id ?? ''
    const text = row.data.description?.content ?? legacy?.content ?? ''
    const time = row.data.updated?.time ?? legacy?.time ?? row.data.created?.time ?? 0
    const author = legacy ? { id: legacy.authorID ?? '', name: legacy.authorName ?? '' } : { id: '', name: '' }
    const node = construct(libraryType(typeId), rowId, { text, author }, time)
    const { description: _description, comment: _comment, todo: _todo, presentation: _presentation, scalar: _scalar, ...data } = row.data
    node.data = { ...data, ...node.data, created: { time: legacy?.time ?? row.data.created?.time ?? time } }
    const children = [...node.children, ...row.children, ...legacyCommentMetadata(row, rowId, time)]
    const body = node.data.presentation?.text?.interpolate ? text : ''
    for (const name of new Set(Array.from(body.matchAll(TEXT_PARAMETER), (m) => m[1]!))) {
      if (children.some((edge) => bindsParameter(edge, name))) continue
      children.push([field, tools.emit({ data: { alias: { id: `${rowId}:param:${name}` }, name: { content: name } }, children: [[ip, field]] })])
    }
    return { ...node, children }
  }

  /** What the row `[type, row]` becomes: its type (Money for money) and row node (a constructed note or comment). */
  const constructed = new Map<string, string>()
  const upgradeRow = (type: string, row: string): FosPathElem => {
    const typeId = libraryTypeIdOf(read(type)), value = read(row)
    if (!typeId || !value) return [type, row]
    if (typeId === ALLOCATION && isMoney(value.data)) return [libraryType(MONEY), row]
    if ((typeId === NOTE || typeId === COMMENT) && !value.data.presentation && !value.data.scalar) {
      const key = `${typeId}|${row}`
      let out = constructed.get(key)
      if (!out) { const next = constructedRow(typeId, value); out = tools.derive({ ...next, children: upgradeRows(next) }); constructed.set(key, out) }
      return [type, out]
    }
    return [type, row]
  }

  /** A node's rows in v5 (`upgradeRow`), less the supplies the old payment settlement wrote; emitted endpoints upgraded. */
  const upgradeRows = (node: FosNodeContent): FosPathElem[] => {
    // the payments money rows here hold, and the supplies the old settlement wrote for them
    const moneyIds = new Set(node.children.flatMap(([type, row]) => {
      const value = read(row)
      return libraryTypeIdOf(read(type)) === ALLOCATION && value && isMoney(value.data) && value.data.alias ? [value.data.alias.id] : []
    }))
    const settled = (row: string): boolean => {
      const ref = moneyIds.size ? settledPayment(read(row)?.data ?? {}) : undefined
      return !!ref && moneyIds.has(ref)
    }
    let children = node.children.flatMap(([type, row]): FosPathElem[] => libraryTypeIdOf(read(type)) === ALLOCATION && settled(row) ? [] : [upgradeRow(type, row)])
    // a pointer to a row (a choice's alternative, a branch, a merge base): its instruction is the type, its target the row
    const pointerType = children.findIndex(([i]) => IP.has(i)), pointerRow = children.findIndex(([i]) => TP.has(i))
    if (pointerType >= 0 && pointerRow >= 0) {
      const [type, row] = upgradeRow(children[pointerType]![1], children[pointerRow]![1])
      children = children.map((edge, i): FosPathElem => i === pointerType ? [edge[0], type] : i === pointerRow ? [edge[0], row] : edge)
    }
    return children.map(([a, b]): FosPathElem => [fixEmitted(a), fixEmitted(b)])
  }

  return (content, cid) => {
    if (primitives.has(cid)) return content
    const node = upgradeNode(content)
    const children = upgradeRows(node)
    const same = node === content && children.length === content.children.length && children.every((edge, i) => edge[0] === content.children[i]![0] && edge[1] === content.children[i]![1])
    return same ? content : { ...node, children }
  }
}
