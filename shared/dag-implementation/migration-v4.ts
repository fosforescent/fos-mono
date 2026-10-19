/**
 * cid v3 → v4: types say what they accept, Home and store roots are types.
 *
 * In v3 a row type was `{description, instanceKind, behavior}` with no children, Home was a plain row with alias
 * `fos:home`, and a store root's alias had the primitive ROOT as its instruction. In v4 (row-templates.ts):
 *   - every type (a node with `instanceKind`: the library's row types, template rows, a library version changed by
 *     vote) without pattern rows gets the ordinary ones: the wildcard minus Home and the store roots. The v3 seed thus
 *     becomes the v4 seed exactly. A reference-error stand-in gets the wildcard alone;
 *   - every Row types group (`lib:types`) gets the types it lacks of the seed: Pattern, Home, Device root, Document;
 *   - a `fos:home` row is made from the Home type;
 *   - every root alias is typed: a device root when its content holds the library or Home, else a document root;
 *   - `approve` is no capability of its own any more (deciding proposals is how `edit` is exercised on a node with
 *     several peers): a member's approve grant or offer becomes edit, and a switched-off approve is dropped.
 * This is the only code that knows the v3 shape.
 */

import type { FosContextData, FosNodeContent, FosPathElem } from '../types'
import { hashContentAt } from './cid'
import type { MigrationEnvironment, MigrationTools, NodeUpgrade } from './migrations'
import { ORDINARY, ROW_TYPE_SEED, patternRows, rowTypeContent, rowTypeId, seedPatternType, type RowTypeAccepts, type RowTypeKind } from './row-templates'

const NEW_TYPES: RowTypeKind[] = ['pattern', 'home', 'device-root', 'document-root']

export function planTypePatterns(context: FosContextData, environment: MigrationEnvironment, tools: MigrationTools): NodeUpgrade {
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
  // a primitive's cids in the input's formats (a run from an older format still holds those in its edges)
  const memo = new Map<string, string>()
  const old = (cid: string, version: number): string => {
    const key = `${version}:${cid}`, known = memo.get(key)
    if (known) return known
    const node = environment.table.get(cid)!
    const out = hashContentAt({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [old(a, version), old(b, version)]) }, version)
    memo.set(key, out)
    return out
  }
  const versions = (cid: string): Set<string> => new Set([0, 1, 2, 3].map((v) => old(cid, v)))
  const primitives = new Set([...environment.table.keys()].flatMap((cid) => [...versions(cid)]))
  const IP = new Set([...versions(id('instructionPointerConstructor')), primitive(id('instructionPointerConstructor'))])
  const TP = new Set([...versions(id('targetPointerConstructor')), primitive(id('targetPointerConstructor'))])
  const ROOT = versions(id('rootInstructionNode'))
  const GRANT = new Set([...versions(id('capabilityNode')), ...versions(id('acceptsNode'))])
  const APPROVE = versions(id('approveAction')), EDIT = versions(id('proposeAction'))
  // the edit constructor in the same format as the approve edge it replaces (a run from an older format holds that one)
  const editFor = new Map([0, 1, 2, 3].map((v) => [old(id('approveAction'), v), old(id('proposeAction'), v)]))

  const patternType = (): string => seedPatternType(tools.emit)
  const seed = new Map<RowTypeKind, string>()
  const seedType = (kind: RowTypeKind): string => {
    let cid = seed.get(kind)
    if (!cid) { cid = tools.emit(rowTypeContent(ROW_TYPE_SEED.find((type) => type.kind === kind)!, patternType(), tools.emit)); seed.set(kind, cid) }
    return cid
  }
  const accepts = (kind: string): RowTypeAccepts => kind === 'reference-error' ? { any: true, types: [] } : kind === 'pattern' ? { any: false, types: [] } : ORDINARY
  const kindOf = (cid: string): string | undefined => read(cid)?.data.instanceKind?.kind
  const hasPatterns = (node: FosNodeContent): boolean => node.children.some(([i]) => kindOf(i) === 'pattern')
  // nodes an earlier step of this run emitted (v3's seed types) are not upgraded themselves: they are upgraded here
  const upgraded = new Map<string, string>()
  const upgradedEmitted = (cid: string): string => {
    if (input[cid]) return cid
    const known = upgraded.get(cid)
    if (known) return known
    const node = tools.read(cid), kind = node?.data.instanceKind?.kind
    const out = node && kind && kind !== 'pattern' && !hasPatterns(node) ? tools.emit({ ...node, children: [...node.children, ...patternRows(ownerOf(node, cid), accepts(kind), patternType(), tools.emit)] }) : cid
    upgraded.set(cid, out)
    return out
  }
  // whose pattern rows they are: a seed type's kind (the seed's own ids), else the template row's alias or its cid
  const SEED = new Set(ROW_TYPE_SEED.map((type) => `${type.name}|${type.kind}|${type.behavior}`))
  const ownerOf = (node: FosNodeContent, cid: string): string => {
    const kind = node.data.instanceKind!.kind
    if (SEED.has(`${node.data.description?.content}|${kind}|${node.data.behavior?.content}`)) return rowTypeId(kind)
    return kind === 'reference-error' && node.data.missingTemplate ? `reference-error:${node.data.missingTemplate.cid}` : node.data.alias?.id ?? cid
  }
  const pointer = (node: FosNodeContent, kinds: Set<string>): string | undefined => node.children.find(([i]) => kinds.has(i))?.[1]
  const aliasOf = (cid: string): string | undefined => read(cid)?.data.alias?.id
  /** The content a node stands for: its ref value, or itself. */
  const valueOf = (cid: string): FosNodeContent | undefined => {
    const node = read(cid)
    const target = node && !node.data.ref ? pointer(node, TP) : undefined
    return target ? read(target) ?? node : node
  }
  const holds = (cid: string, alias: string): boolean => (valueOf(cid)?.children ?? []).some(([, t]) => aliasOf(t) === alias)

  return (content, cid) => {
    if (primitives.has(cid)) return content
    let children = content.children.map(([a, b]): FosPathElem => [upgradedEmitted(a), upgradedEmitted(b)])
    // a type without pattern rows accepts what the seed's ordinary types do (a reference error: anything)
    const kind = content.data.instanceKind?.kind
    if (kind && kind !== 'pattern' && !hasPatterns(content)) children = [...children, ...patternRows(ownerOf(content, cid), accepts(kind), patternType(), tools.emit)]
    // a Row types group gets the seed's new types (rows of its own Template type)
    if (content.data.alias?.id === 'lib:types') {
      const have = new Set(children.map(([, t]) => aliasOf(t)))
      const templateType = children[0]?.[0]
      if (templateType) for (const type of NEW_TYPES) {
        if (have.has(rowTypeId(type))) continue
        children = [...children, [templateType, tools.emit({ data: { alias: { id: rowTypeId(type) } }, children: [[primitive(id('targetPointerConstructor')), seedType(type)]] })]]
      }
    }
    // a member's approve becomes edit (once per direction)
    if (children.some(([i, t]) => GRANT.has(i) && APPROVE.has(t))) {
      const seen = new Set<string>()
      children = children.flatMap((edge): FosPathElem[] => {
        if (!GRANT.has(edge[0]) || (!APPROVE.has(edge[1]) && !EDIT.has(edge[1]))) return [edge]
        const key = `${edge[0]}`
        if (seen.has(key)) return []
        seen.add(key)
        return [APPROVE.has(edge[1]) ? [edge[0], editFor.get(edge[1])!] : edge]
      })
    }
    let data = content.data
    const disabled = data.disabledCapabilities?.content
    if (Array.isArray(disabled) && disabled.includes('approve')) data = { ...data, disabledCapabilities: { content: disabled.filter((c) => c !== 'approve') } }
    // Home is made from the Home type
    children = children.map((edge): FosPathElem => aliasOf(edge[1]) === 'fos:home' && kindOf(edge[0]) === 'plain' ? [seedType('home'), edge[1]] : edge)
    // a root alias is typed: a device root holds the library or Home
    const root = children.find(([i, t]) => IP.has(i) && ROOT.has(t))
    const target = pointer(content, TP)
    if (root && target) {
      const type = holds(target, 'fos:library') || holds(target, 'fos:home') ? 'device-root' : 'document-root'
      children = children.map((edge): FosPathElem => edge === root ? [edge[0], seedType(type)] : edge)
    }
    return data === content.data && children.every((edge, i) => edge === content.children[i]) && children.length === content.children.length ? content : { ...content, data, children }
  }
}
