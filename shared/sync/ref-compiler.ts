/** Compile accessible ref values to immutable graph data, retaining unresolved identities. */
import type { FosPathElem } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { content, findAliasEdge, identityCid, isBranchChoice, isMemberEdge, isProposalEdge, isRowEdge, put, putBranches, readChoice, isRefNode, refValueCid, resolveScope, selectedBranchValue, valueContent, type Scope } from './graph'
import { addRefAt, headCid, type Replica } from './replica'
import { argumentRefs } from './bindings'
import { matchesGraph } from './structural'
import { resolveRefExpression, resolveRefIdentity, type RefAccess, type RefLocation } from './ref-paths'

export type RefHole = { id: string; type?: string; path: Scope; reason: 'unbound' | 'unavailable' | 'denied' | 'cycle' | 'ambiguous' | 'type'; role: 'input' | 'output' }
export type CompiledRef = { cid: string; holes: RefHole[]; complete: boolean; sources: string[] }
export type CompileRefOptions = RefAccess & { outputs?: string[]; bindings?: RefLocation[]; selected?: boolean }

export function compileRefGraph(r: Replica, cid: string, at: Scope = [], options: CompileRefOptions = {}): CompiledRef {
  const holes: RefHole[] = [], sources = new Set<string>(), active = new Map<FosStore, Set<string>>()
  let budget = 20000
  const hole = (id: string, type: string | null, path: Scope, reason: RefHole['reason'], role: RefHole['role']): string => {
    if (!holes.some(h => h.id === id && h.reason === reason && JSON.stringify(h.path) === JSON.stringify(path))) holes.push({ id, ...(type ? { type } : {}), path, reason, role })
    return put(r.store, { data: { refHole: { id } }, children: [] })
  }
  const walk = (store: FosStore, current: string, path: Scope, role: RefHole['role'] = 'input', depth = 0, type: string | null = null): string => {
    if (--budget < 0 || depth > 128) throw new Error('Ref compilation exceeds its traversal limit.')
    // Do not inspect inaccessible content, even if a cached copy is in the store.
    if (options.canRead && !options.canRead(store, current, path)) return hole(path.at(-1) ?? current, null, path, 'denied', role)
    if (!store.table.has(current)) return hole(path.at(-1) ?? current, null, path, 'unavailable', role)
    const node = content(store, current), id = node.data.alias?.id ?? current
    role = node.data.refRole ?? (options.outputs?.includes(id) ? 'output' : role)
    sources.add(current)
    if (!active.has(store)) active.set(store, new Set())
    const visiting = active.get(store)!
    if (visiting.has(current)) return hole(id, type, path, 'cycle', role)
    visiting.add(current)
    try {
      const previousHoleCount = holes.length
      if (node.data.refHole) return hole(node.data.refHole.id, type, path, 'unbound', role)
      if (node.data.ref?.peer || node.data.ref?.owner) return hole(node.data.ref.id || id, type, path, 'unavailable', role)
      if (node.data.refExpression) {
        const context = { ...r, store }
        const resolved = resolveRefExpression(context, path.slice(0, -1), node.data.refExpression, options)
        if (resolved.status !== 'ready') return hole(id, type, path, resolved.status === 'missing' ? 'unbound' : resolved.status, role)
        const target = resolved.locations[0]!
        return walk(target.store, target.cid, target.path, role, depth + 1, type)
      }
      if (node.data.ref?.id) {
        const resolved = resolveRefIdentity({ ...r, store }, path.slice(0, -1), node.data.ref.id, options)
        if (resolved.status !== 'ready') return hole(node.data.ref.id, type, path, resolved.status === 'missing' ? 'unavailable' : resolved.status, role)
        const target = resolved.locations[0]!
        return walk(target.store, target.cid, target.path, role, depth + 1, type)
      }
      if (isBranchChoice(store, node)) {
        if (options.selected) {
          const selected = selectedBranchValue(store, current)
          return selected ? walk(store, selected, path, role, depth + 1, type) : hole(id, type, path, 'unbound', role)
        }
        const alternatives = readChoice(store, current).options.flatMap(option => {
          if (!option.edge) return []
          const right = content(store, option.edge[1])
          const target = isRefNode(store, right) && !refValueCid(store, right) && right.data.alias?.id === node.data.alias?.id ? option.edge[0] : identityCid(store, option.edge)
          return [{ peerId: option.peerId, edge: [put(r.store, { data: {}, children: [] }), walk(store, target, path, role, depth + 1, type)] as FosPathElem }]
        })
        return putBranches(r.store, 'fos:compiled:sum', null, alternatives)
      }
      const target = refValueCid(store, node)
      if (target) {
        const result = walk(store, target, path, role, depth + 1, type)
        if (holes.length === previousHoleCount && type && !matchesGraph(r.store, type, result)) return hole(id, type, path, 'type', role)
        return result
      }
      if (isRefNode(store, node) && node.data.alias && !target) {
        const candidates = (options.bindings ?? []).filter(candidate => candidate.cid !== current &&
          (!options.canRead || options.canRead(candidate.store, candidate.cid, candidate.path)) &&
          (!!node.data.name && content(candidate.store, candidate.cid).data.name?.content === node.data.name.content || content(candidate.store, candidate.cid).data.alias?.id === id) &&
          (!type || matchesGraph(candidate.store, type, candidate.cid)))
        if (candidates.length === 1) return walk(candidates[0]!.store, candidates[0]!.cid, candidates[0]!.path, role, depth + 1, type)
        return hole(id, type, path, candidates.length > 1 ? 'ambiguous' : 'unbound', role)
      }
      const children: FosPathElem[] = []
      for (const edge of node.children) {
        if (edge[0] === store.primitive.previousVersion.getId() || isProposalEdge(store, edge) || isMemberEdge(store, edge)) continue
        const child = store.table.get(edge[1])
        if (child?.data.name?.content.startsWith('fos:') && isRefNode(store, child)) continue
        const childPath = isRowEdge(store, edge) ? [...path, child?.data.alias?.id ?? edge[1]] : path
        // Constructor identities are immutable graph nodes too, and may contain refs.
        const instruction = walk(store, edge[0], path, role, depth + 1)
        children.push([instruction, walk(store, edge[1], childPath, role, depth + 1, isRowEdge(store, edge) ? edge[0] : type)])
      }
      const { alias: _alias, updated: _updated, ref: _ref, refExpression: _expression, refRole: _role, ...data } = node.data
      return put(r.store, { data, children })
    } finally { visiting.delete(current) }
  }
  const result = walk(r.store, cid, at)
  return { cid: result, holes, complete: holes.length === 0, sources: [...sources] }
}

/** A row is a product edge: instructions on the left, user/process state on the right. */
export function compileInstructions(r: Replica, path: Scope, options: CompileRefOptions = {}): CompiledRef {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const parent = path.length ? resolveScope(r.store, headCid(r), path.slice(0, -1)) : null
  const edge = parent ? findAliasEdge(r.store, valueContent(r.store, parent), path.at(-1)!)?.edge : null
  const type = edge?.[0]
  const bindings = argumentRefs(r.store, cid).map(arg => ({ store: r.store, cid: arg.cid, path: [...path, content(r.store, arg.cid).data.alias!.id] }))
  const empty = put(r.store, { data: {}, children: [] })
  return compileRefGraph(r, type ?? empty, path, { ...options, bindings, selected: true })
}
export function compileRow(r: Replica, path: Scope, options: CompileRefOptions = {}) {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const left = compileInstructions(r, path, options)
  const right = compileRefGraph(r, cid, path, { ...options, selected: true })
  return { left, right, canRun: left.complete }
}

/** Persist the residual and its reachable immutable graph together, not just an orphan CID. */
export function saveRefCompilation(r: Replica, path: Scope, id: string, compiled: CompiledRef, now: number): Replica {
  const type = put(r.store, { data: { name: { content: 'fos:compiled-ref' } }, children: [] })
  const envelope = put(r.store, { data: { refCompilation: { cid: compiled.cid, holes: compiled.holes } }, children: [[r.store.primitive.targetPointerConstructor.getId(), compiled.cid]] })
  return addRefAt(r, path, id, type, now, envelope, `fos:compiled:${id}`)
}
