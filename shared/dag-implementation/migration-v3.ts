/**
 * cid v2 → v3: rows carry their template as the instruction.
 *
 * v2 rows were [rowNode, KIND], KIND a row primitive on the target side (COMPLETION, DESCRIPTION, DOCUMENT, COMMENT,
 * LINK, REQUIREMENT, SUPPLY, QUERY, RESOURCE, ALLOCATION, TEMPLATE), plus legacy [LIST, node] plain rows. A task made
 * from a template recorded it as data.template = {id, name}. In v3 every row is [template, rowNode]:
 *   - the KIND primitive becomes the seed version of the matching row type (row-templates.ts: the standard library's
 *     first Row types, which every device root ships); COMPLETION without data.todo is a
 *     plain row, REQUIREMENT/SUPPLY/ALLOCATION are allocation rows;
 *   - a row with data.template is pinned to that template row's content: the version in the current tree (v2 did not
 *     record which version a task was made from), else the latest one in history, never an ancestor of the row; or to a
 *     stand-in template with its id and name when this graph does not hold it. data.template is dropped;
 *   - template nodes (and the values in their history) get data.instanceKind = task;
 *   - choice pointers ([INSTRUCTIONPOINTER, rowNode] [TARGETPOINTER, KIND]) are flipped the same way.
 * This is the only code that knows the v2 shape.
 */

import type { FosContextData, FosNodeContent, FosPathElem } from '../types'
import { hashContentAt, type CidVersion } from './cid'
import type { MigrationEnvironment, MigrationTools, NodeUpgrade } from './migrations'
/** The kinds v3's seed had (before Home and the store roots were types). */
type RowTypeKind = 'task' | 'plain' | 'note' | 'comment' | 'ref' | 'query' | 'resource' | 'allocation' | 'template'
const V3_SEED_NAMES: Record<RowTypeKind, string> = { task: 'Task', plain: 'Row', note: 'Note', comment: 'Comment', ref: 'Reference', query: 'Query', resource: 'Resource', allocation: 'Allocation', template: 'Template' }

/**
 * The seed row type v3 pins a `kind` row to: the Row types the library started with before types had patterns.
 * Frozen here (migration v4 re-pins these to the seed in row-templates.ts).
 */
export function v3SeedRowTypeContent(kind: RowTypeKind): FosNodeContent {
  return { data: { description: { content: V3_SEED_NAMES[kind] }, instanceKind: { kind }, behavior: { content: `builtin:${kind}` } }, children: [] }
}

/** v2 data: a task made from a template named it here. */
type V2Data = FosNodeContent['data'] & { template?: { id: string; name: string } }
type Role = 'completion' | Exclude<RowTypeKind, 'task'>

const KIND_PRIMITIVES: Record<string, Role> = {
  completeField: 'completion', descriptionField: 'plain', documentField: 'note', commentField: 'comment', linkField: 'ref',
  requirementField: 'allocation', supplyField: 'allocation', allocationField: 'allocation',
  queryField: 'query', resourceField: 'resource', templateField: 'template'
}
const OLD_VERSIONS: CidVersion[] = [0, 1, 2]

export function planTemplateInstructionRows(context: FosContextData, environment: MigrationEnvironment, tools: MigrationTools): NodeUpgrade {
  const input = context.nodes
  // Primitives are fixed content: their cid in each older format follows from the loading store's own copies.
  const memo = new Map<string, string>()
  const rehash = (cid: string, version: CidVersion): string => {
    const key = `${version}:${cid}`
    const cached = memo.get(key)
    if (cached) return cached
    const node = environment.table.get(cid)
    if (!node) throw new Error(`primitive ${cid} missing from the loading store`)
    const result = hashContentAt({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [rehash(a, version), rehash(b, version)]) }, version)
    memo.set(key, result)
    return result
  }
  const old = (name: string): Set<string> => {
    const node = environment.primitive[name]
    if (!node) throw new Error(`unknown primitive ${name}`)
    return new Set(OLD_VERSIONS.map((v) => rehash(node.getId(), v)))
  }
  const primitives = new Set([...environment.table.keys()].flatMap((cid) => OLD_VERSIONS.map((v) => rehash(cid, v))))
  const roles = new Map<string, Role>()
  for (const [name, role] of Object.entries(KIND_PRIMITIVES)) for (const cid of old(name)) roles.set(cid, role)
  const LIST = old('listField'), TP = old('targetPointerConstructor'), IP = old('instructionPointerConstructor')
  const PREV = old('previousVersion'), NOT_SELECTED = old('optionNotSelectedConstructor'), MERGE_SOURCE = old('mergeSourceNode')

  // What the current tree holds: reachable from the root without following history (PREV, MERGESOURCE).
  const live = new Set<string>()
  for (const stack = [context.rootNodeId]; stack.length;) {
    const cid = stack.pop()!
    if (live.has(cid) || !input[cid]) continue
    live.add(cid)
    for (const [a, b] of input[cid]!.children) if (!PREV.has(a) && !MERGE_SOURCE.has(a)) stack.push(a, b)
  }

  const rowTypes = new Map<string, string>()
  const rowType = (kind: RowTypeKind): string => {
    let cid = rowTypes.get(kind)
    if (!cid) { cid = tools.emit(v3SeedRowTypeContent(kind)); rowTypes.set(kind, cid) }
    return cid
  }

  const pointerTarget = (node: FosNodeContent): string | undefined => node.children.find((e) => TP.has(e[0]))?.[1]
  const pointerInstruction = (node: FosNodeContent): string | undefined => node.children.find((e) => IP.has(e[0]))?.[1]
  const isRef = (node: FosNodeContent): boolean => !node.data.ref && !!pointerTarget(node)
  const isBranchChoice = (node: FosNodeContent): boolean => !!node.data.option && !node.data.conflict && node.children.some((e) => NOT_SELECTED.has(e[0]))
  /** The contents a row identity can stand for: itself, its ref value, or each alternative of a branched value. */
  const values = (cid: string): FosNodeContent[] => {
    const node = input[cid]
    if (!node) return []
    if (!isRef(node)) return [node]
    const target = input[pointerTarget(node)!]
    if (!target) return [node]
    if (!isBranchChoice(target)) return [target]
    return target.children.filter((e) => NOT_SELECTED.has(e[0])).flatMap((e) => {
      const option = input[e[1]]
      const value = option && pointerInstruction(option)
      return value && input[value] ? [input[value]!] : []
    })
  }

  // Template rows: identities of [x, TEMPLATE] edges and of choice options pointing at TEMPLATE.
  const templates = new Set<string>()
  for (const [cid, node] of Object.entries(input)) {
    if (primitives.has(cid)) continue
    for (const [a, b] of node.children) if (roles.get(b) === 'template' && !TP.has(a) && !IP.has(a) && !primitives.has(a)) templates.add(a)
    const instruction = pointerInstruction(node), target = pointerTarget(node)
    if (instruction && target && roles.get(target) === 'template') templates.add(instruction)
  }
  const byAlias = new Map<string, string[]>()
  const marked = new Set<string>()
  for (const cid of templates) {
    const node = input[cid]
    const id = node?.data.alias?.id
    if (!node || !id) continue
    byAlias.set(id, [...(byAlias.get(id) ?? []), cid])
    if (!isRef(node)) { marked.add(cid); continue }
    // a link-row template: mark the value of every version in its history
    const seen = new Set<string>()
    for (let at: string | undefined = cid; at && input[at] && !seen.has(at); at = input[at]!.children.find((e) => PREV.has(e[0]))?.[1]) {
      seen.add(at)
      const value = pointerTarget(input[at]!)
      if (value && input[value]) marked.add(value)
    }
  }
  const updated = (cid: string): number => Math.max(0, ...values(cid).map((v) => v.data.updated?.time ?? 0))
  const stubs = new Map<string, string>()
  const userTemplate = (template: { id: string; name: string }): string => {
    const pinned = (cid: string): string => (isRef(input[cid]!) ? pointerTarget(input[cid]!)! : cid)
    const candidates = (byAlias.get(template.id) ?? []).filter((cid) => !tools.pending(cid) && !tools.pending(pinned(cid)))
    // the version in the current tree first (a template's own timestamp does not move when rows are added under it),
    // then the most recently updated one from history
    candidates.sort((a, b) => Number(live.has(b)) - Number(live.has(a)) || updated(b) - updated(a) || (a < b ? -1 : a > b ? 1 : 0))
    // pinned to the template's content (a link-row template's current value), not its ref node and history
    if (candidates[0]) return pinned(candidates[0])
    let stub = stubs.get(template.id)
    if (!stub) {
      stub = tools.emit({ data: { alias: { id: template.id }, description: { content: template.name }, instanceKind: { kind: 'task' } }, children: [] })
      stubs.set(template.id, stub)
    }
    return stub
  }
  const instructionFor = (row: string, role: Role): string => {
    const contents = values(row)
    const template = contents.map((v) => (v.data as V2Data).template).find((t) => !!t)
    if (template && (role === 'completion' || role === 'plain')) return userTemplate(template)
    if (role === 'completion') return rowType(contents.some((v) => v.data.todo) ? 'task' : 'plain')
    return rowType(role)
  }

  return (content, cid) => {
    if (primitives.has(cid)) return content
    let data = content.data as V2Data
    if (data.template) { const { template: _template, ...rest } = data; data = rest }
    if (marked.has(cid)) data = { ...data, instanceKind: { kind: 'task' } }
    const instruction = content.children.find((e) => IP.has(e[0]))
    const target = content.children.find((e) => TP.has(e[0]))
    const pointerRole = instruction && target && !primitives.has(instruction[1]) ? roles.get(target[1]) : undefined
    const children = content.children.map((edge): FosPathElem => {
      const [a, b] = edge
      if (pointerRole && edge === instruction) return [a, instructionFor(instruction[1], pointerRole)]
      if (pointerRole && edge === target) return [a, instruction![1]]
      if (IP.has(a) || TP.has(a)) return edge
      if (LIST.has(a) && !primitives.has(b)) return [instructionFor(b, 'plain'), b]
      const role = roles.get(b)
      if (role && !primitives.has(a)) return [instructionFor(a, role), a]
      return edge
    })
    return { data, children }
  }
}
