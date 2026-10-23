/**
 * What a row's type accepts as its children, and type errors.
 *
 * A type (a row type in the library, a template row, a store root's type) has pattern rows
 * (made from the library's Pattern type, `lib.pattern`). A pattern names a row type (`pattern.type`, e.g. `lib.home`) and
 * optionally pinned versions of it (`pattern.versions`); `pattern.any` is the wildcard. Without the wildcard a
 * type accepts the children its patterns match; with it, every child except those. A child is matched by its row type
 * (the graph identity of its edge's left node) and its version (the template its edge is pinned to).
 *
 * A row holding children its type does not accept is a type error: its edge is replaced by `[TYPE_ERROR, error]`,
 * the error node keeping the row's edge exactly ([INSTRUCTIONPOINTER, template] [TARGETPOINTER, row]) and naming the
 * rejected children (`data.typeError.rejected`). Reading through it (identityCid, rowTypeOf, …) sees the row as it
 * was, so the row and its children look the same, only marked. A store root in error keeps its content behind an
 * error node as the root alias's target. Type errors are kept canonical: every commit re-derives them
 * (`canonicalTypeErrors`), so a row turns back into its plain edge as soon as nothing rejected is left. Local edits
 * that would introduce one are refused instead (`assertNoNewTypeErrors`).
 */

import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { matchesGraph } from './structural'
import { DOCUMENT_ROOT_TYPE, PATTERN_TYPE } from './library-types'
import { shippedRef, content, valueContent, isHandle, isRefNode, refValueCid, put, isRowEdge, isRowOfType, rowTypeIdOf, typeIdOf, aliasIdOf, isChoiceEdge, missingTemplateOf } from './graph'

export function isTypeErrorEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.typeErrorConstructor.getId()
}

/** The row edge a type error stands for. */
export function typeErrorInner(store: FosStore, edge: FosPathElem): FosPathElem {
  const node = content(store, edge[1])
  const ip = node.children.find(([i]) => i === store.primitive.instructionPointerConstructor.getId())?.[1]
  const tp = node.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())?.[1]
  if (!ip || !tp) throw new Error('Malformed type error node.')
  return [ip, tp]
}

/** The edge itself, or the row edge a type error stands for. */
export function plainEdge(store: FosStore, edge: FosPathElem): FosPathElem {
  return isTypeErrorEdge(store, edge) ? typeErrorInner(store, edge) : edge
}

/** The rejected children a row edge's type error names (none for a plain edge). */
export function typeErrorOf(store: FosStore, edge: FosPathElem): string[] | null {
  return isTypeErrorEdge(store, edge) ? content(store, edge[1]).data.typeError?.rejected ?? [] : null
}

/** A store root's type: its root alias's instruction; a bare root (no alias yet) is the document root its first commit makes it. */
export function rootTypeOf(store: FosStore): string {
  const root = content(store, store.rootNodeId)
  const isAlias = root.children.some(([i]) => i === store.primitive.targetPointerConstructor.getId())
  const type = isAlias ? root.children.find(([i]) => i === store.primitive.instructionPointerConstructor.getId())?.[1] : undefined
  return type ?? shippedRef(store, DOCUMENT_ROOT_TYPE)!
}

/** The root's content when it is in error (its rejected children), else null. */
export function rootTypeError(store: FosStore, target: string): string[] | null {
  return content(store, target).data.typeError?.rejected ?? null
}

/** The content a root alias's target stands for: through a root type error. */
export function unwrapRootTarget(store: FosStore, target: string): string {
  const node = content(store, target)
  if (!node.data.typeError) return target
  return node.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())?.[1] ?? target
}

type Pattern = { any: true } | { any: false; type: string; versions?: string[] }

/** A type's patterns: its pattern rows. */
function patternsOf(store: FosStore, typeCid: string): Pattern[] {
  return content(store, typeCid).children.flatMap((edge): Pattern[] => {
    if (!isRowOfType(store, edge, PATTERN_TYPE)) return []
    const p = valueContent(store, edge[1]).data.pattern
    if (p?.any) return [{ any: true }]
    return p?.type ? [{ any: false, type: p.type, ...(p.versions?.length ? { versions: p.versions } : {}) }] : []
  })
}

/**
 * A child row's type (the graph identity of its edge's left node, '' for a type without one) and version (the template
 * it is pinned to). Null for what is not a row, and for a row whose template has not arrived (a reference error).
 */
function childType(store: FosStore, edge: FosPathElem): { type: string; version: string } | null {
  if (missingTemplateOf(store, edge) || !isRowEdge(store, edge)) return null
  return { type: rowTypeIdOf(store, edge) ?? '', version: edge[0] }
}

/** Does a node of type `typeCid` accept the row `child` (a plain row edge) among its children? */
export function acceptsChild(store: FosStore, typeCid: string, child: FosPathElem): boolean {
  if (!store.table.has(typeCid)) return true // a missing type is a reference error, not a type error
  const definition = content(store, typeCid)
  // A callable ref supplies instructions; its right-side call arguments remain
  // ordinary rows, governed by the function's input patterns during binding.
  if (isRefNode(store, definition)) return true
  // An unconstrained ref pattern imposes no product-field restrictions on call inputs or outputs.
  if (definition.data.capabilityDefinition && !definition.data.form && !patternsOf(store, typeCid).length) return true
  if (definition.data.form) {
    if (!isRowEdge(store, child)) return true
    if (definition.children.some(([pattern]) => pattern === child[0] || matchesGraph(store, pattern, child[0]))) return true
    if (!definition.data.form.open) return false
  }
  const type = childType(store, child)
  if (!type) return true // not a row: bookkeeping, arguments, choices
  const patterns = patternsOf(store, typeCid)
  // Placement policies constrain the editor only when explicitly declared.
  // Structural value patterns (including sums) are checked by matchesGraph.
  if (!patterns.length) return true
  const matches = patterns.some(p => !p.any && p.type === type.type && (!p.versions || p.versions.includes(type.version)))
  return patterns.some(p => p.any) ? !matches : matches
}

/** Alias ids of the rows among `value`'s children a node of type `typeCid` does not accept. */
export function rejectedChildren(store: FosStore, typeCid: string, value: FosNodeContent): string[] {
  const rejected: string[] = []
  for (const edge of value.children) {
    if (isChoiceEdge(store, edge)) continue
    const row = plainEdge(store, edge)
    if (!isRowEdge(store, row) || acceptsChild(store, typeCid, row)) continue
    rejected.push(aliasIdOf(content(store, row[1])) ?? row[1])
  }
  return rejected
}

function typeErrorEdge(store: FosStore, row: FosPathElem, rejected: string[]): FosPathElem {
  const alias = content(store, row[1]).data.alias
  const node = put(store, { data: { ...(alias ? { alias } : {}), typeError: { rejected } }, children: [[store.primitive.instructionPointerConstructor.getId(), row[0]], [store.primitive.targetPointerConstructor.getId(), row[1]]] })
  return [store.primitive.typeErrorConstructor.getId(), node]
}

/** A node with `edgeFn` applied to its children (through a ref node to its value), memoized per store in `memos`. */
function mapChildren(store: FosStore, cid: string, memos: WeakMap<FosStore, Map<string, string>>, edgeFn: (edge: FosPathElem) => FosPathElem): string {
  let memo = memos.get(store)
  if (!memo) { memo = new Map(); memos.set(store, memo) }
  const known = memo.get(cid)
  if (known) return known
  const node = content(store, cid)
  let result = cid
  if (!isHandle(node)) {
    const ref = isRefNode(store, node)
    const valueCid = ref ? refValueCid(store, node) : cid
    if (valueCid && store.table.has(valueCid)) {
      const value = content(store, valueCid)
      let changed = false
      const children = value.children.map((edge): FosPathElem => {
        const next = edgeFn(edge)
        if (next[0] !== edge[0] || next[1] !== edge[1]) changed = true
        return next
      })
      if (changed) {
        const nextValue = put(store, { ...value, children })
        result = ref ? put(store, { ...node, children: node.children.map(([i, t]): FosPathElem => i === store.primitive.targetPointerConstructor.getId() && t === valueCid ? [i, nextValue] : [i, t]) }) : nextValue
      }
    }
  }
  memo.set(cid, result)
  memo.set(result, result)
  return result
}

const canonical = new WeakMap<FosStore, Map<string, string>>()
const stripped = new WeakMap<FosStore, Map<string, string>>()

/** A node with its children's type errors derived from their types (memoized: content-addressed, so only new nodes are visited). */
function canonicalNode(store: FosStore, cid: string): string {
  return mapChildren(store, cid, canonical, edge => canonicalEdge(store, edge))
}

/**
 * The same subtree with no type errors (every row as its plain edge): what a merge compares, since type errors are
 * derived from the rows and their types and are derived again when the result is committed.
 */
export function withoutTypeErrors(store: FosStore, cid: string): string {
  return mapChildren(store, unwrapRootTarget(store, cid), stripped, edge => {
    if (isChoiceEdge(store, edge)) return edge
    const row = plainEdge(store, edge)
    return isRowEdge(store, row) ? [row[0], withoutTypeErrors(store, row[1])] : edge
  })
}

/** A child edge in canonical form: its subtree canonical, and a type error when its type rejects any of its children. */
function canonicalEdge(store: FosStore, edge: FosPathElem): FosPathElem {
  if (isChoiceEdge(store, edge)) return edge
  const row = plainEdge(store, edge)
  if (!isRowEdge(store, row)) return edge
  const next: FosPathElem = [row[0], canonicalNode(store, row[1])]
  const rejected = rejectedChildren(store, next[0], valueContent(store, next[1]))
  return rejected.length ? typeErrorEdge(store, next, rejected) : next
}

/** A root target in canonical form for root type `rootType`: through and back into a root type error as needed. */
export function canonicalTypeErrors(store: FosStore, target: string, rootType: string = rootTypeOf(store)): string {
  const inner = canonicalNode(store, unwrapRootTarget(store, target))
  const rejected = rejectedChildren(store, rootType, valueContent(store, inner))
  if (!rejected.length) return inner
  return put(store, { data: { typeError: { rejected } }, children: [[store.primitive.targetPointerConstructor.getId(), inner]] })
}

const NONE: ReadonlySet<string> = new Set()
const below = new WeakMap<FosStore, Map<string, ReadonlySet<string>>>()

/** Type errors in a node's subtree, as `parent alias › child alias` (memoized per cid; most subtrees share NONE). */
function errorsBelow(store: FosStore, cid: string): ReadonlySet<string> {
  let memo = below.get(store)
  if (!memo) { memo = new Map(); below.set(store, memo) }
  const known = memo.get(cid)
  if (known) return known
  memo.set(cid, NONE) // a cycle (there should be none) reads as clean
  let out: Set<string> | null = null
  const add = (entries: Iterable<string>) => { for (const e of entries) (out ??= new Set()).add(e) }
  if (!isHandle(content(store, cid))) for (const edge of valueContent(store, cid).children) {
    if (isChoiceEdge(store, edge)) continue
    const row = plainEdge(store, edge)
    if (!isRowEdge(store, row)) continue
    const parent = aliasOfCid(store, row[1])
    add((typeErrorOf(store, edge) ?? []).map(id => `${parent} › ${id}`))
    add(errorsBelow(store, row[1]))
  }
  const result: ReadonlySet<string> = out ?? NONE
  memo.set(cid, result)
  return result
}
const aliasOfCid = (store: FosStore, cid: string): string => aliasIdOf(content(store, cid)) ?? cid

/** Every type error below a root target (and at it), as `parent alias › child alias`. */
export function typeErrorsIn(store: FosStore, target: string): ReadonlySet<string> {
  const inner = errorsBelow(store, unwrapRootTarget(store, target))
  const rootRejected = rootTypeError(store, target)
  return rootRejected?.length ? new Set([...rootRejected.map(id => `(root) › ${id}`), ...inner]) : inner
}

/** A local edit from `before` to `after` (canonical root targets) must not introduce a type error: refuse it. */
export function assertNoNewTypeErrors(store: FosStore, before: string, after: string): void {
  const had = typeErrorsIn(store, before)
  const added = [...typeErrorsIn(store, after)].filter(e => !had.has(e))
  if (added.length) throw new Error(`That row cannot go there: its new parent does not accept it (${added.join(', ')}).`)
}
