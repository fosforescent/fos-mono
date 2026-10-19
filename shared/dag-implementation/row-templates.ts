/**
 * The seed of the standard library's Row types.
 *
 * Every row in a node's children is the edge [template, rowNode]: the template is the instruction (what the row is,
 * its behavior) and the row node the target (its own state). A template is any node whose data carries
 * `instanceKind`. Row types live in the standard library's "Row types" group, which members change by vote; new rows
 * are made from the nearest library above them (`rowTemplate` in sync/graph.ts).
 *
 * A type says which rows it accepts as children with pattern rows of its own (patterns as types,
 * docs/language-design.md §2.1), made from the Pattern type: a pattern names a row type (`pattern.type`, a library
 * type id such as `lib:type:home`) and optionally the versions of it that match (`pattern.versions`, pinned cids; none
 * = any version); `pattern.any` is the wildcard. Without the wildcard a type accepts what its patterns match; with it,
 * everything except what they match. A row whose parent does not accept it makes the parent a type error
 * (sync/patterns.ts). Being rows, patterns sync, copy and change by vote like any other row.
 *
 * Store roots are typed too: a store root's type is its root alias's instruction. Only a device root (`device-root`,
 * a device's own root or an account's store on the server) accepts Home; nothing accepts a device root or a document
 * root (`document-root`: the root of a project, a document or a draft).
 *
 * This is what the library starts with, what a new device root ships, and what cid migration v4 pins existing rows
 * to. Never edit it: a changed row type is a new library version, not a new seed. (The seed v3 pinned to, before
 * types had patterns, lives in migration-v3.ts.)
 *
 * Kinds whose behavior still lives in code name it (`behavior: builtin:<kind>`). Requirement and supply rows are
 * allocation rows read by the sign of their amount, so they share the allocation type.
 */

import type { FosNodeContent, FosPathElem } from '../types'

/** Kinds of row a row type can make, and the two kinds of store root. A reference error is not one: it stands in for a template a peer lacks. */
export type RowTypeKind = 'task' | 'plain' | 'note' | 'comment' | 'ref' | 'query' | 'resource' | 'allocation' | 'template' | 'pattern' | 'home' | 'device-root' | 'document-root'

/** What a type accepts: the row types its patterns name, and whether the wildcard is among them (then they are exclusions). */
export type RowTypeAccepts = { any: boolean; types: RowTypeKind[] }
export type RowTypeSeed = { kind: RowTypeKind; name: string; behavior?: string; accepts: RowTypeAccepts }

/** Any row but Home and the store roots. */
export const ORDINARY: RowTypeAccepts = { any: true, types: ['home', 'device-root', 'document-root'] }

export const ROW_TYPE_SEED: RowTypeSeed[] = ([
  { kind: 'task', name: 'Task', accepts: ORDINARY }, { kind: 'plain', name: 'Row', accepts: ORDINARY }, { kind: 'note', name: 'Note', accepts: ORDINARY },
  { kind: 'comment', name: 'Comment', accepts: ORDINARY }, { kind: 'ref', name: 'Reference', accepts: ORDINARY }, { kind: 'query', name: 'Query', accepts: ORDINARY },
  { kind: 'resource', name: 'Resource', accepts: ORDINARY }, { kind: 'allocation', name: 'Allocation', accepts: ORDINARY },
  { kind: 'template', name: 'Template', accepts: ORDINARY },
  // a pattern describes a type; it holds nothing
  { kind: 'pattern', name: 'Pattern', accepts: { any: false, types: [] } },
  { kind: 'home', name: 'Home', accepts: ORDINARY },
  { kind: 'device-root', name: 'Device root', accepts: { any: true, types: ['device-root', 'document-root'] } },
  { kind: 'document-root', name: 'Document', accepts: ORDINARY }
] as RowTypeSeed[]).map((type) => ({ ...type, behavior: `builtin:${type.kind}` }))

export const rowTypeId = (kind: RowTypeKind | string): string => `lib:type:${kind}`

/**
 * A pattern row's node: the wildcard, or a row type (any version unless `versions` pins some). Its alias id is the
 * owning type's (`owner`) plus the pattern, so every type's pattern rows are rows of their own.
 */
export function patternRowContent(owner: string, pattern: { any: true } | { type: string; versions?: string[] }): FosNodeContent {
  if ('any' in pattern) return { data: { alias: { id: `${owner}:accepts:any` }, description: { content: 'Any row' }, pattern: { any: true } }, children: [] }
  const versions = pattern.versions?.length ? [...pattern.versions] : undefined
  return { data: { alias: { id: `${owner}:accepts:${pattern.type}${versions ? `@${versions.join(',')}` : ''}` }, description: { content: pattern.type }, pattern: { type: pattern.type, ...(versions ? { versions } : {}) } }, children: [] }
}

/** The pattern rows of type `owner` for `accepts`, made from the Pattern type `patternType`. */
export function patternRows(owner: string, accepts: RowTypeAccepts, patternType: string, put: (content: FosNodeContent) => string): FosPathElem[] {
  return [
    ...(accepts.any ? [[patternType, put(patternRowContent(owner, { any: true }))] as FosPathElem] : []),
    ...accepts.types.map((kind): FosPathElem => [patternType, put(patternRowContent(owner, { type: rowTypeId(kind) }))])
  ]
}

/**
 * A row type's template content: its name, the kind of its instances, the code behavior it names, and its pattern
 * rows (made from the Pattern type `patternType`). `put` stores the pattern rows (in a store, or a node map that
 * travels with the types).
 */
export function rowTypeContent(type: RowTypeSeed, patternType: string, put: (content: FosNodeContent) => string): FosNodeContent {
  return {
    data: { description: { content: type.name }, instanceKind: { kind: type.kind }, ...(type.behavior ? { behavior: { content: type.behavior } } : {}) },
    children: patternRows(rowTypeId(type.kind), type.accepts, patternType, put)
  }
}

/** The seed's Pattern type, which every pattern row is made from (it accepts nothing, so it has no pattern rows). */
export function seedPatternType(put: (content: FosNodeContent) => string): string {
  return put(rowTypeContent(ROW_TYPE_SEED.find((type) => type.kind === 'pattern')!, '', put))
}

/** The seed version of the row type for `kind`, its pattern rows stored with `put`. */
export function seedRowTypeContent(kind: RowTypeKind, put: (content: FosNodeContent) => string): FosNodeContent {
  return rowTypeContent(ROW_TYPE_SEED.find((type) => type.kind === kind)!, seedPatternType(put), put)
}

/** The seed's types, their pattern rows stored with `put`. */
export function seedRowTypes(put: (content: FosNodeContent) => string): FosNodeContent[] {
  const patternType = seedPatternType(put)
  return ROW_TYPE_SEED.map((type) => rowTypeContent(type, patternType, put))
}

/**
 * Stand-in template for a row pinned to template `cid` that this peer has not received: the row node is kept as is
 * and the row reads as a reference error until the template arrives and replaces this instruction. Not knowing the
 * template, it accepts any child (the wildcard alone).
 */
export function referenceErrorTemplateContent(cid: string, kind: string, put: (content: FosNodeContent) => string): FosNodeContent {
  return { data: { description: { content: 'Reference error' }, instanceKind: { kind: 'reference-error' }, missingTemplate: { cid, kind } }, children: patternRows(`reference-error:${cid}`, { any: true, types: [] }, seedPatternType(put), put) }
}
