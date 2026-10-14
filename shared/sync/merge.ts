/**
 * Three-way merge of FosStore nodes.
 *
 * `mergeNodes(store, base, ours, theirs)` produces a new node (inserted into the
 * store) that combines both sides relative to the last state they agreed on.
 * Children are matched by identity (alias id, see graph.ts); changes made on one
 * side only are taken, edits to different fields of the same task are combined,
 * and incompatible edits become a CHOICE edge holding every version so the user
 * can decide later. Nothing is dropped silently.
 *
 * Child order is part of a node's identity (cid v2), so the merge keeps order:
 * ours' order is the backbone and children added by theirs are inserted after
 * the neighbour they follow on their side. When both sides reorder the same
 * children, ours' order wins (no choice is raised for pure reorders).
 */

import { FosStore } from '../dag-implementation/store'
import type { FosDataContent, FosNodeContent, FosPathElem } from '../types'
import {
  isBranchChoice, readChoice, putBranches, bookkeepingOf,
  content,
  edgeKey,
  identityCid,
  isChoiceEdge,
  isHandle,
  isLegacyInlineLink,
  isPrevEdge,
  isRefNode,
  makeLink,
  put,
  putChoice,
  readProposal,
  refNodeContent,
  refTypeCid,
  refValueCid,
  sameShape,
  stripLink,
  withIdentity,
  type ChoiceOption
} from './graph'

export type MergeLabels = { ours: string; theirs: string }

export type MergeResult = { cid: string; newChoiceCids: string[] }

type NodeOutcome = { kind: 'node'; cid: string } | { kind: 'conflict' }

const EMPTY: FosNodeContent = { data: {}, children: [] }

export function mergeNodes(
  store: FosStore,
  baseCid: string | null,
  oursCid: string,
  theirsCid: string,
  labels: MergeLabels
): MergeResult {
  const newChoiceCids: string[] = []
  const outcome = mergeNode(store, baseCid, oursCid, theirsCid, labels, newChoiceCids, true)
  if (outcome.kind !== 'node') throw new Error('conflicting typed refs must be merged through their owning node to resolve the choice')
  return { cid: outcome.cid, newChoiceCids }
}

function mergeNode(
  store: FosStore,
  baseCid: string | null,
  oursCid: string,
  theirsCid: string,
  labels: MergeLabels,
  newChoiceCids: string[],
  isTop: boolean
): NodeOutcome {
  if (oursCid === theirsCid) return { kind: 'node', cid: oursCid }
  if (baseCid === oursCid) return { kind: 'node', cid: theirsCid }
  if (baseCid === theirsCid) return { kind: 'node', cid: oursCid }

  const base = baseCid ? content(store, baseCid) : EMPTY
  const ours = content(store, oursCid)
  const theirs = content(store, theirsCid)

  if (isBranchChoice(store, ours) && isBranchChoice(store, theirs)) {
    const o = readChoice(store, oursCid), t = readChoice(store, theirsCid)
    const b = baseCid && isBranchChoice(store, base) ? readChoice(store, baseCid) : null
    const options: ChoiceOption[] = []
    for (const name of new Set([...o.options, ...t.options].map(option => option.peerId))) {
      const oo = o.options.find(x => x.peerId === name), tt = t.options.find(x => x.peerId === name)
      const oe = oo?.edge, te = tt?.edge
      const be = b?.options.find(x => x.peerId === name)?.edge
      if (!oe || !te) { const edge = oe ?? te; if (edge) options.push({ ...(oo ?? tt), peerId: name, edge }); continue }
      if (!sameShape(store, oe, te)) return { kind: 'conflict' }
      const merged = mergeNode(store, be ? identityCid(store, be) : null, identityCid(store, oe), identityCid(store, te), labels, newChoiceCids, false)
      if (merged.kind === 'conflict') return merged
      options.push({ ...oo, peerId: name, edge: withIdentity(store, oe, merged.cid) })
    }
    return { kind: 'node', cid: putBranches(store, o.id, b?.base ?? o.base, options, b?.defaultName ?? o.defaultName) }
  }

  // Mutable references merge by value; members/proposals/peers are unioned; history keeps both parents.
  const asRef = (value: FosNodeContent): boolean => (isRefNode(store, value) && !isHandle(value)) || isLegacyInlineLink(store, value)
  if (asRef(ours) || asRef(theirs)) {
    const refOf = (cid: string | null, value: FosNodeContent): { cid: string; node: FosNodeContent } | null => {
      if (!cid) return null
      if (isRefNode(store, value) && !isHandle(value)) return { cid, node: value }
      const node = makeLink(store, value, 0)
      return { cid: put(store, node), node }
    }
    const o = refOf(oursCid, ours) as { cid: string; node: FosNodeContent }
    const t = refOf(theirsCid, theirs) as { cid: string; node: FosNodeContent }
    const b = baseCid ? refOf(baseCid, base) : null
    const valueOf = (r: { node: FosNodeContent } | null): string | null => (r ? refValueCid(store, r.node) : null)
    const oursValue = valueOf(o) ?? put(store, stripLink(store, ours))
    const theirsValue = valueOf(t) ?? put(store, stripLink(store, theirs))
    const typed = refTypeCid(store, o.node) || refTypeCid(store, t.node)
    if (typed && refTypeCid(store, o.node) !== refTypeCid(store, t.node)) return { kind: 'conflict' }
    let mergedValue: string | null
    if (typed) {
      const ov = valueOf(o), tv = valueOf(t), bv = valueOf(b)
      if (ov === tv || tv === bv) mergedValue = ov
      else if (ov === bv) mergedValue = tv
      else return { kind: 'conflict' }
    } else {
      const merged = mergeNode(store, valueOf(b), oursValue, theirsValue, labels, newChoiceCids, true)
      mergedValue = merged.kind === 'node' ? merged.cid : oursValue
    }
    const book = (r: { node: FosNodeContent } | null): FosNodeContent => ({ data: {}, children: r ? bookkeepingOf(store, r.node).filter((e) => !isPrevEdge(store, e)) : [] })
    const bookkeeping = mergeChildren(store, book(b), book(o), book(t), labels, newChoiceCids)
    // History: a merge that changed the value is a new version with both parents; a merge of
    // bookkeeping only (members, peers, proposals) is not a version, so the existing PREV edges
    // are kept as they are (unioned, like any other bookkeeping).
    const valueChanged = mergedValue !== oursValue || mergedValue !== theirsValue
    const prevEdge = (cid: string): FosPathElem => [store.primitive.previousVersion.getId(), cid]
    const existingPrev = (r: { node: FosNodeContent } | null): FosPathElem[] => (r ? r.node.children.filter((e) => isPrevEdge(store, e)) : [])
    const prev: FosPathElem[] = valueChanged
      ? (o.cid === t.cid ? [prevEdge(o.cid)] : [prevEdge(o.cid), prevEdge(t.cid)])
      : [...existingPrev(o), ...existingPrev(t).filter((e) => !existingPrev(o).some((x) => x[1] === e[1]))]
    const data = mergeData(b?.node.data ?? {}, o.node.data, t.node.data, true) ?? o.node.data
    return { kind: 'node', cid: put(store, refNodeContent(store, data, mergedValue, [...bookkeeping, ...prev], refTypeCid(store, o.node) ?? refTypeCid(store, t.node))) }
  }

  const data = mergeData(base.data, ours.data, theirs.data, isTop)
  if (!data) return { kind: 'conflict' }

  const children = mergeChildren(store, base, ours, theirs, labels, newChoiceCids)
  return { kind: 'node', cid: put(store, { data, children }) }
}

/**
 * Field-level merge of `data`. Returns null on an irreconcilable conflict unless
 * `theirsWins` (containers and the top node), where the other side's value is kept.
 */
function mergeData(base: FosDataContent, ours: FosDataContent, theirs: FosDataContent, theirsWins: boolean): FosDataContent | null {
  const out: Record<string, unknown> = {}
  const keys = new Set<string>([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])
  const b = base as Record<string, unknown>
  const o = ours as Record<string, unknown>
  const t = theirs as Record<string, unknown>

  for (const key of keys) {
    if (key === 'versionControl') continue
    if (key === 'updated') {
      const time = Math.max(timeOf(o[key]), timeOf(t[key]), timeOf(b[key]))
      if (time > 0) out[key] = { time }
      continue
    }
    const bv = b[key], ov = o[key], tv = t[key]
    if (same(ov, tv)) { if (ov !== undefined) out[key] = ov; continue }
    if (same(bv, ov)) { if (tv !== undefined) out[key] = tv; continue }
    if (same(bv, tv)) { if (ov !== undefined) out[key] = ov; continue }
    if (!theirsWins) return null
    if (tv !== undefined) out[key] = tv
  }
  return out as FosDataContent
}

function timeOf(value: unknown): number {
  return value && typeof value === 'object' && typeof (value as { time?: unknown }).time === 'number'
    ? (value as { time: number }).time
    : 0
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) out[k] = sortKeys(src[k])
    return out
  }
  return value
}

function mergeChildren(
  store: FosStore,
  base: FosNodeContent,
  ours: FosNodeContent,
  theirs: FosNodeContent,
  labels: MergeLabels,
  newChoiceCids: string[]
): FosPathElem[] {
  const index = (value: FosNodeContent) => {
    const map = new Map<string, FosPathElem>()
    for (const edge of value.children) map.set(edgeKey(store, edge), edge)
    return map
  }
  const bMap = index(base)
  const oMap = index(ours)
  const tMap = index(theirs)
  const keys = orderedKeys([...oMap.keys()], [...tMap.keys()], [...bMap.keys()])

  const out: FosPathElem[] = []
  for (const key of keys) {
    const b = bMap.get(key) ?? null
    const o = oMap.get(key) ?? null
    const t = tMap.get(key) ?? null

    if (sameEdge(o, t)) { if (o) out.push(o); continue }
    if (sameEdge(b, o)) { if (t) out.push(t); continue }
    if (sameEdge(b, t)) { if (o) out.push(o); continue }

    // Both sides changed this child differently.
    if (key.startsWith('p:') && o && t) {
      // Two versions of one peer's proposal: the newer one wins (ours on a tie).
      const ot = readProposal(store, o[1])?.timestamp ?? 0
      const tt = readProposal(store, t[1])?.timestamp ?? 0
      out.push(tt > ot ? t : o)
      continue
    }
    if (o && t && sameShape(store, o, t) && (!isChoiceEdge(store, o) || isBranchChoice(store, content(store, o[1])))) {
      // A base that is a choice (or has another shape) is no use as a merge base.
      const baseIdentity = b && sameShape(store, b, o) && (!isChoiceEdge(store, b) || isBranchChoice(store, content(store, b[1]))) ? identityCid(store, b) : null
      const merged = mergeNode(store, baseIdentity, identityCid(store, o), identityCid(store, t), labels, newChoiceCids, false)
      if (merged.kind === 'node') {
        out.push(withIdentity(store, o, merged.cid))
        continue
      }
    }

    const id = key.startsWith('a:') ? key.slice(2) : key
    const options: ChoiceOption[] = [
      { peerId: labels.ours, edge: o },
      { peerId: labels.theirs, edge: t }
    ]
    const choiceCid = putChoice(store, id, b && (!isChoiceEdge(store, b) || isBranchChoice(store, content(store, b[1]))) ? b : null, options)
    newChoiceCids.push(choiceCid)
    out.push([store.primitive.choiceTarget.getId(), choiceCid])
  }
  return out
}

/**
 * Union of keys in a stable order: ours first (in ours' order); keys only in
 * theirs are placed right after the key that precedes them on theirs' side
 * (or at the front); keys only in base go last (they will be dropped or raised
 * as choices, position is irrelevant).
 */
function orderedKeys(ours: string[], theirs: string[], base: string[]): string[] {
  const out = [...ours]
  const present = new Set(out)
  theirs.forEach((key, i) => {
    if (present.has(key)) return
    let at = -1
    for (let j = i - 1; j >= 0 && at < 0; j--) {
      const idx = out.indexOf(theirs[j] as string)
      if (idx >= 0) at = idx + 1
    }
    for (let j = i + 1; j < theirs.length && at < 0; j++) {
      const idx = out.indexOf(theirs[j] as string)
      if (idx >= 0) at = idx
    }
    if (at < 0) at = out.length // nothing in common around it: append
    out.splice(at, 0, key)
    present.add(key)
  })
  for (const key of base) if (!present.has(key)) { out.push(key); present.add(key) }
  return out
}

function sameEdge(a: FosPathElem | null, b: FosPathElem | null): boolean {
  if (!a || !b) return a === b
  return a[0] === b[0] && a[1] === b[1]
}

/**
 * Resolve a choice edge inside `nodeCid`: replace it with the picked option's edge
 * (or remove it when the pick is a deletion). Returns the new node cid.
 */
export function resolveChoiceIn(store: FosStore, value: FosNodeContent, choiceId: string, pick: number | null, now: number): FosNodeContent {
  const key = `a:${choiceId}`
  const edge = value.children.find((e) => edgeKey(store, e) === key)
  if (!edge || !isChoiceEdge(store, edge)) return value

  const children: FosPathElem[] = []
  for (const existing of value.children) {
    if (existing !== edge) { children.push(existing); continue }
    if (pick === null) continue
    const choice = content(store, edge[1])
    const alternatives = choice.children.filter(([i]) => i === store.primitive.optionNotSelectedConstructor.getId())
    const alt = alternatives[pick]
    if (!alt) throw new Error(`choice ${choiceId} has no option ${pick}`)
    const pointer = content(store, alt[1])
    let instr: string | null = null
    let target: string | null = null
    for (const [i, t] of pointer.children) {
      if (i === store.primitive.instructionPointerConstructor.getId()) instr = t
      if (i === store.primitive.targetPointerConstructor.getId()) target = t
    }
    if (!instr || !target) continue // the picked option was "deleted"
    const picked: FosPathElem = [instr, target]
    const idCid = identityCid(store, picked)
    const touched = put(store, { ...content(store, idCid), data: { ...content(store, idCid).data, updated: { time: now } } })
    children.push(withIdentity(store, picked, touched))
  }
  return { ...value, children }
}
