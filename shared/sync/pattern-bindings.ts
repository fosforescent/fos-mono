/**
 * Patterns: a pattern is an ordinary node whose rows have mutable refs (placeholders) on the right. Using it with a
 * right node — the row [pattern, node] — submits the node's values to the pattern's refs in the corresponding
 * positions. Each submission is an option on that ref in that scope (the use site's left node), never an assignment:
 * choosing one binds it, the others stay options. See docs/sync.md, "Patterns".
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import {
  aliasIdOf, bookkeepingOf, commitRoot, typeIdOf, content, findEdge, identityCid, isBookkeepingEdge, isRefNode, proposalContent, put, readProposal,
  readProposals, refBindingBaseCid, refNodeContent, refValueCid, removeProposalByCid, resolveScope, updateAtScope, valueContent,
  withPrev, withProposal, withRowTemplate, type Scope
} from './graph'
import { headCid, type Replica } from './replica'
import { isValueSubmission } from './graph'
import { refValueCompatible } from './scoped-refs'
import { PATTERN_TYPE } from './library-types'

/** Submissions to a right ref are `binding` proposals; a `binding:<source>` name keeps one option per source. */

/**
 * The rows a pattern position counts: everything but bookkeeping, the ref constructor's own pointers and placement
 * rules (a template's `lib:type:pattern` rows say what it accepts as children; they are not positions).
 */
export function patternRows(store: FosStore, node: FosNodeContent): FosPathElem[] {
  const own = [store.primitive.targetPointerConstructor.getId(), store.primitive.instructionPointerConstructor.getId(), store.primitive.aliasConstructor.getId()]
  return node.children.filter(edge => !isBookkeepingEdge(store, edge) && !own.includes(edge[0]) && typeIdOf(store, edge[0]) !== PATTERN_TYPE)
}

/** A ref with no value yet: a hole the pattern leaves open. */
export function isPlaceholder(store: FosStore, node: FosNodeContent): boolean {
  return isRefNode(store, node) && !!node.data.alias && !refValueCid(store, node)
}

/** `ref` with `value` submitted by `peerId` from `source` (replacing that source's earlier submission). */
export function submitToRef(store: FosStore, ref: FosNodeContent, value: string, peerId: string, source: string, now: number): FosNodeContent {
  const name = source
  const proposal = put(store, proposalContent(store, peerId, name, value, refBindingBaseCid(store, ref), now))
  return withProposal(store, ref, peerId, proposal, name)
}

export type PatternUse = { pattern: string; submitted: number; skipped: number }

/**
 * Submit `value`'s rows to `pattern`'s refs position by position: the i-th row of the value goes to the ref on the
 * right of the pattern's i-th row (checked against that row's left), and a nested pattern takes the nested rows.
 */
export function submitPositional(store: FosStore, pattern: string, value: string, peerId: string, source: string, now: number): PatternUse {
  const result: PatternUse = { pattern, submitted: 0, skipped: 0 }
  const walk = (patternCid: string, valueCid: string): string => {
    const node = content(store, patternCid), actual = patternRows(store, valueContent(store, valueCid))
    const wanted = patternRows(store, node)
    if (!wanted.length) return patternCid
    const children = node.children.map(edge => {
      const index = wanted.indexOf(edge), row = actual[index]
      if (index < 0 || !row) return edge
      const [left, right] = edge, ref = content(store, right)
      if (isRefNode(store, ref)) {
        if (!ref.data.alias || !refValueCompatible(store, left, row[1])) { result.skipped++; return edge }
        result.submitted++
        return [left, put(store, submitToRef(store, ref, row[1], peerId, source, now))] as FosPathElem
      }
      return [left, walk(right, row[1])] as FosPathElem
    })
    return put(store, { ...node, children })
  }
  result.pattern = walk(pattern, value)
  return result
}

/**
 * Use `pattern` with the row `rowId` under `at`: the row becomes [pattern', node], where pattern' carries the node's
 * values as submissions to its refs. Using it again (or after the node changed) replaces this row's submissions.
 */
export function usePatternAt(replica: Replica, at: Scope, rowId: string, pattern: string, peerId: string, now: number): { replica: Replica } & PatternUse {
  const store = replica.store
  if (!store.table.has(pattern)) throw new Error('The pattern is unavailable.')
  const parent = resolveScope(store, headCid(replica), at)
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${rowId}`) : undefined
  if (!edge) throw new Error('The row no longer exists.')
  const use = submitPositional(store, pattern, identityCid(store, edge), peerId, rowId, now)
  const isRow = (child: FosPathElem) => aliasIdOf(content(store, identityCid(store, child))) === rowId
  commitRoot(store, updateAtScope(store, headCid(replica), at, node => ({
    ...node, children: node.children.map(child => isRow(child) ? withRowTemplate(store, child, use.pattern) : child)
  })), now)
  return { replica: { ...replica }, ...use }
}

export type PatternOption = { proposal: string; value: string; source: string; peerId: string }
export type PatternBinding = { alias: string; name: string; value: string | null; options: PatternOption[] }

/** The pattern's refs, each with its bound value and the values submitted to it as options. */
export function patternBindings(store: FosStore, pattern: string): PatternBinding[] {
  const out: PatternBinding[] = [], seen = new Set<string>()
  const walk = (cid: string, depth: number): void => {
    if (depth > 32 || seen.has(cid)) return
    seen.add(cid)
    for (const [, right] of patternRows(store, content(store, cid))) {
      const ref = content(store, right)
      if (isRefNode(store, ref) && ref.data.alias) {
        const options = readProposals(store, ref).filter(p => p.status === 'open' && isValueSubmission(store, p))
          .map(p => ({ proposal: p.cid, value: p.contentCid, source: p.name || p.peerId, peerId: p.peerId }))
        out.push({ alias: ref.data.alias.id, name: ref.data.name?.content ?? ref.data.alias.id, value: refValueCid(store, ref), options })
      } else walk(right, depth + 1)
    }
  }
  walk(pattern, 0)
  return out
}

/** Bind the ref `alias` in the row's pattern to one of its options; the other options stay submitted. */
export function choosePatternBindingAt(replica: Replica, at: Scope, rowId: string, alias: string, proposal: string, now: number): Replica {
  const store = replica.store
  const record = readProposal(store, proposal)
  if (!record) throw new Error('That option is gone.')
  const parent = resolveScope(store, headCid(replica), at)
  const edge = parent ? findEdge(store, valueContent(store, parent), `a:${rowId}`) : undefined
  if (!edge) throw new Error('The row no longer exists.')
  let found = false
  const walk = (cid: string): string => {
    const node = content(store, cid)
    const children = node.children.map(child => {
      if (isBookkeepingEdge(store, child)) return child
      const ref = content(store, child[1])
      if (isRefNode(store, ref) && ref.data.alias?.id === alias) {
        found = true
        if (!readProposals(store, ref).some(p => p.cid === proposal && p.status === 'open')) throw new Error('That option is gone.')
        if (!refValueCompatible(store, child[0], record.contentCid)) throw new Error('That value does not fit this ref.')
        const bound = refNodeContent(store, { ...ref.data, updated: { time: now } }, record.contentCid, bookkeepingOf(store, ref))
        return [child[0], put(store, removeProposalByCid(store, withPrev(store, bound, child[1]), proposal))] as FosPathElem
      }
      return isRefNode(store, ref) ? child : [child[0], walk(child[1])] as FosPathElem
    })
    return put(store, { ...node, children })
  }
  const next = walk(edge[0])
  if (!found) throw new Error('The pattern has no such ref.')
  const isRow = (child: FosPathElem) => aliasIdOf(content(store, identityCid(store, child))) === rowId
  commitRoot(store, updateAtScope(store, headCid(replica), at, node => ({
    ...node, children: node.children.map(child => isRow(child) ? withRowTemplate(store, child, next) : child)
  })), now)
  return { ...replica }
}
