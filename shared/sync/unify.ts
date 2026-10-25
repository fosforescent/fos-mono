/**
 * Solving: a placeholder ref on the pattern side is a named hole of the structural match (structural.ts `match`), bound
 * to the value it meets, the same value at every occurrence. `solve` unifies
 * a pattern with the nodes in its scope and submits each solution's values to the placeholders as options
 * (pattern-bindings.ts), so the refs list them; nothing is bound until one is chosen.
 */
import { settingOf } from './graph'
import { isHandlerStateLeft } from './capabilities'
import type { FosStore } from '../dag-implementation/store'
import { isLibraryRef, content, identityCid, isRowEdge, put, resolveScope, valueContent, type Scope } from './graph'
import { headCid, proposeRefAt, type Replica } from './replica'
import { match, type Bindings } from './structural'
import { patternRows } from './pattern-bindings'
import { assertCompiledGraph, compileRefGraph } from './ref-compiler'

/** Compiled placeholder CID → the value CID it is bound to. */
export type Substitution = Bindings

/** The substitution under which `pattern` matches `value` (structural.ts `match`), or null. */
export function unify(store: FosStore, pattern: string, value: string, start: Substitution = new Map()): Substitution | null {
  assertCompiledGraph(store, [pattern, value, ...start.keys(), ...start.values()])
  return match(store, pattern, value, { bindings: start })?.bindings ?? null
}

function hasPlaceholder(store: FosStore, cid: string, depth = 0): boolean {
  const node = store.table.get(cid)
  if (!node || depth > 32) return false
  if (node.data.refHole) return true
  return patternRows(store, node).some(edge => hasPlaceholder(store, edge[1], depth + 1))
}

export type Solution = { source: Scope; bindings: Substitution }

/**
 * Solve the row at `at`: its rows (with their placeholders) are the pattern, and the nodes in its scope are the
 * candidates: under its parent first, then under each ancestor (never the row itself). Each solution is submitted to the
 * placeholders as an option.
 */
export function solveAt(replica: Replica, at: Scope, peerId: string, now: number, limit = 2000): { replica: Replica; solutions: Solution[] } {
  const store = replica.store
  const rowCid = resolveScope(store, headCid(replica), at)
  if (!rowCid || !at.length) throw new Error('The solve row no longer exists.')
  // the row's own supplies (earlier solutions) and system records (`fos:evaluation`, …) are not part of what it asks for
  const rows = patternRows(store, valueContent(store, rowCid)).filter(edge => {
    if (!isRowEdge(store, edge)) return false
    const identity = content(store, identityCid(store, edge))
    return !settingOf(store, identity) && !isHandlerStateLeft(store, edge[0])
  })
  const compiled = compileRefGraph(replica, put(store, { data: {}, children: rows }), at, { selected: true })
  if (compiled.holes.some(hole => hole.reason !== 'unbound')) throw new Error('Resolve the pattern references before solving.')
  const pattern = compiled.cid
  if (!hasPlaceholder(store, pattern)) throw new Error('Add a placeholder (a ref with no value) to solve for.')
  const scope = at.slice(0, -1)
  const solutions: Solution[] = []
  let visited = 0
  const visit = (cid: string, path: Scope, skip?: string): void => {
    for (const edge of valueContent(store, cid).children) {
      if (!isRowEdge(store, edge) || ++visited > limit) continue
      const child = identityCid(store, edge), node = content(store, child), id = node.data.alias?.id
      // the standard library and named system records (settings, evaluation records) are not data to solve over
      if (!id || id === skip || isLibraryRef(store, node) || settingOf(store, node) || isHandlerStateLeft(store, edge[0])) continue
      const candidate = compileRefGraph(replica, child, [...path, id], { selected: true })
      const bindings = candidate.complete ? unify(store, pattern, candidate.cid) : null
      if (bindings?.size) solutions.push({ source: [...path, id], bindings })
    }
  }
  // nearest first, like ref resolution: the parent's rows, then each ancestor's, never the branch already searched
  for (let depth = scope.length; depth >= 0; depth--) {
    const level = scope.slice(0, depth), cid = resolveScope(store, headCid(replica), level)
    if (cid) visit(cid, level, depth === scope.length ? at.at(-1) : scope[depth])
  }
  let next = replica
  for (const solution of solutions) {
    for (const [slot, value] of solution.bindings) {
      // Only the editing adapter sees UUIDs; the solver returns graph CIDs.
      for (const hole of compiled.holes.filter(hole => hole.cid === slot)) {
        if (hole.path.length > at.length && at.every((id, index) => hole.path[index] === id))
          next = proposeRefAt(next, hole.path, value, peerId, now, solution.source.join('/')).replica
      }
    }
  }
  return { replica: next, solutions }
}

