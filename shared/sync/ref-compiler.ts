/** Resolve editor references into immutable graph edges. Editor locations belong only to diagnostics. */
import { settingOf } from './graph'
import { isHandlerStateLeft } from './capabilities'
import type { FosPathElem } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { importNodes, reachableNodes, content, findAliasEdge, identityCid, isBranchChoice, isMemberEdge, isProposalEdge, isRowEdge, put, putBranches, readChoice, isRefNode, refValueCid, resolveScope, selectedBranchValue, valueContent, type Scope } from './graph'
import { addRefAt, headCid, type Replica } from './replica'
import { argumentRefs } from './bindings'
import { isTagRow, matchesGraph } from './structural'
import { isOutputPattern } from './parameters'
import { resolveRefExpression, resolveRefIdentity, type RefAccess, type RefLocation } from './ref-paths'
import { bindingAssignments, type ScopedBinding } from './scope-bindings'

export type RefHole = { cid: string; id: string; type?: string; path: Scope; reason: 'unbound' | 'unavailable' | 'denied' | 'cycle' | 'ambiguous' | 'type'; role: 'input' | 'output' }
export type CompiledRef = { cid: string; holes: RefHole[]; complete: boolean; sources: string[]; locations: Array<{ source: string; path: Scope; cid: string }> }
export type CompileRefOptions = RefAccess & { outputs?: string[]; bindings?: RefLocation[]; selected?: boolean; openOutputs?: boolean }

/**
 * Evaluation may traverse only content-addressed operands, never consult the editor's alias namespace. Constructors
 * (the left of an edge) are kept by identity: a definition's parameter rows carry their names as aliases, and a type
 * that was renamed by compiling would no longer be the type its readers name.
 */
export function assertCompiledGraph(store: FosStore, roots: string[]): void {
  const seen = new Set<string>(), pending = [...roots]
  while (pending.length) {
    const cid = pending.pop()!
    if (seen.has(cid)) continue
    if (seen.size >= 20000) throw new Error('Compiled graph exceeds its traversal limit.')
    seen.add(cid)
    const node = store.table.get(cid)
    if (!node) throw new Error('Compiled graph content is unavailable.')
    if (node.data.alias || node.data.ref || node.data.refExpression) throw new Error('Compile editor references before evaluation.')
    for (const edge of node.children) pending.push(edge[1])
  }
}

/** Does any node reachable from `cid` refer to another (a ref or a ref expression; a bare alias is only a name)? Memoized per store. */
const editorRefs = new WeakMap<FosStore, Map<string, boolean>>()
function containsRef(store: FosStore, cid: string): boolean {
  let memo = editorRefs.get(store)
  if (!memo) { memo = new Map(); editorRefs.set(store, memo) }
  const seen = new Set<string>(), pending = [cid]
  while (pending.length) {
    const current = pending.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    const known = memo.get(current)
    if (known === true) { memo.set(cid, true); return true }
    if (known === false) continue
    const node = store.table.get(current)
    if (!node) continue
    if (node.data.ref || node.data.refExpression) { memo.set(cid, true); return true }
    for (const edge of node.children) pending.push(...edge)
  }
  for (const c of seen) memo.set(c, false)
  return false
}

export function compileRefGraph(r: Replica, cid: string, at: Scope = [], options: CompileRefOptions = {}): CompiledRef {
  const holes: RefHole[] = [], sources = new Set<string>(), active = new Map<FosStore, Set<string>>()
  const locations: CompiledRef['locations'] = []
  const slots = new Map<string, number>()
  let budget = 20000
  const hole = (id: string, type: string | null, path: Scope, reason: RefHole['reason'], role: RefHole['role']): string => {
    // Number binders by traversal, not by spelling of an editor UUID. Repeated uses of a declaration share its CID.
    const key = JSON.stringify([path.slice(0, -1), id])
    if (!slots.has(key)) slots.set(key, slots.size)
    const cid = put(r.store, { data: { refHole: { slot: slots.get(key)!, role } }, children: [] })
    if (!holes.some(h => h.id === id && h.reason === reason && JSON.stringify(h.path) === JSON.stringify(path))) holes.push({ cid, id, ...(type ? { type } : {}), path, reason, role })
    return cid
  }
  const visit = (store: FosStore, current: string, path: Scope, role: RefHole['role'] = 'input', depth = 0, type: string | null = null): string => {
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
      // a sum of options on a refined capability (a choice pattern) is a pattern, not a ref with alternative handlers
      if (node.data.refAlternatives && options.selected && !node.data.capabilityDefinition) {
        const values = [...new Set(node.children.map(([, value]) => value))]
        return values.length === 1 ? walk(store, values[0]!, path, role, depth + 1, type) : hole(id, type, path, values.length ? 'ambiguous' : 'unbound', role)
      }
      if (role === 'output' && options.openOutputs) return hole(id, type, path, 'unbound', role)
      if (node.data.refHole) {
        holes.push({ cid: current, id: current, ...(type ? { type } : {}), path, reason: 'unbound', role: node.data.refHole.role })
        return put(r.store, node)
      }
      if (node.data.ref?.peer || node.data.ref?.owner) return hole(node.data.ref.id || id, type, path, 'unavailable', role)
      if (node.data.refExpression) {
        const context = { ...r, store }
        const resolved = resolveRefExpression(context, path.slice(0, -1), node.data.refExpression, options)
        if (resolved.status !== 'ready') return hole(id, type, path, resolved.status === 'missing' ? 'unbound' : resolved.status, role)
        const target = resolved.locations[0]!
        return compileBinding(target, role, depth + 1, type)
      }
      if (node.data.ref?.id) {
        const resolved = resolveRefIdentity({ ...r, store }, path.slice(0, -1), node.data.ref.id, options)
        if (resolved.status !== 'ready') return hole(node.data.ref.id, type, path, resolved.status === 'missing' ? 'unavailable' : resolved.status, role)
        const target = resolved.locations[0]!
        // The link row's instruction describes a reference, not the referenced value's constructor.
        return compileBinding(target, role, depth + 1)
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
        const choice = content(r.store, putBranches(r.store, '', null, alternatives))
        const { alias: _alias, ...data } = choice.data
        return put(r.store, { data, children: choice.children })
      }
      if (isRefNode(store, node) && node.data.alias && path.length > at.length && at.every((id, index) => path[index] === id)) {
        const candidates = (options.bindings ?? []).filter(candidate => candidate.cid !== current &&
          (!!node.data.name && content(candidate.store, candidate.cid).data.name?.content === node.data.name.content || content(candidate.store, candidate.cid).data.alias?.id === id))
        if (candidates.length > 1) return hole(id, type, path, 'ambiguous', role)
        if (candidates.length === 1) {
          const candidate = candidates[0]!
          const value = walk(candidate.store, candidate.cid, candidate.path, role, depth + 1)
          if (holes.length === previousHoleCount && type && !matchesGraph(r.store, type, value)) return hole(id, type, path, 'type', role)
          return value
        }
      }
      const target = refValueCid(store, node)
      if (target) {
        const result = walk(store, target, path, role, depth + 1, type)
        if (holes.length === previousHoleCount && type && !matchesGraph(r.store, type, result)) return hole(id, type, path, 'type', role)
        return result
      }
      if (isRefNode(store, node) && node.data.alias && !target) {
        return hole(id, type, path, 'unbound', role)
      }
      const children: FosPathElem[] = []
      for (const edge of node.children) {
        if (edge[0] === store.primitive.previousVersion.getId() || isProposalEdge(store, edge) || isMemberEdge(store, edge)) continue
        // a tag names a capability by identity; the capability's own declarations are not this node's to fill
        if (isTagRow(store, edge)) { children.push(edge); continue }
        const child = store.table.get(edge[1])
        if (child && settingOf(store, child)) continue
        if (isRowEdge(store, edge) && isHandlerStateLeft(store, edge[0])) continue
        const childPath = isRowEdge(store, edge) ? [...path, child?.data.alias?.id ?? edge[1]] : path
        // A constructor is kept by identity (a form's field types stay the types its definition names) unless it contains refs of its own to compile.
        const instruction = containsRef(store, edge[0]) ? walk(store, edge[0], childPath, role, depth + 1) : edge[0]
        if (instruction === edge[0]) locations.push({ source: edge[0], path: childPath, cid: instruction })
        const childRole = isOutputPattern(store, edge[0]) ? 'output' : role
        children.push([instruction, walk(store, edge[1], childPath, childRole, depth + 1, isRowEdge(store, edge) ? edge[0] : type)])
      }
      const { alias: _alias, updated: _updated, ref: _ref, refExpression: _expression, refRole: _role, ...data } = node.data
      return put(r.store, { data, children })
    } finally { visiting.delete(current) }
  }
  const walk = (store: FosStore, current: string, path: Scope, role: RefHole['role'] = 'input', depth = 0, type: string | null = null): string => {
    const cid = visit(store, current, path, role, depth, type)
    locations.push({ source: current, path, cid })
    return cid
  }
  const compileBinding = (binding: RefLocation, role: RefHole['role'], depth: number, type: string | null = null): string => {
    const assignments = 'assignments' in binding ? bindingAssignments(binding as ScopedBinding) : [binding]
    if (!assignments.length) return hole(binding.path.at(-1) ?? binding.cid, type, binding.path, 'unbound', role)
    const values = assignments.map(source => walk(source.store, source.cid, source.path, role, depth, type))
    if (new Set(values).size !== 1) return hole(binding.path.at(-1) ?? binding.cid, type, binding.path, 'ambiguous', role)
    return values[0]!
  }
  const result = walk(r.store, cid, at)
  return { cid: result, holes, complete: holes.length === 0, sources: [...sources], locations }
}

/** A row is a product edge: instructions on the left, user/process state on the right. */
export function compileInstructions(r: Replica, path: Scope, options: CompileRefOptions = {}) {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const parent = path.length ? resolveScope(r.store, headCid(r), path.slice(0, -1)) : null
  const edge = parent ? findAliasEdge(r.store, valueContent(r.store, parent), path.at(-1)!)?.edge : null
  const type = edge?.[0]
  const bindings = argumentRefs(r.store, cid).map(arg => ({ store: r.store, cid: arg.cid, path: [...path, content(r.store, arg.cid).data.alias!.id] }))
  const empty = put(r.store, { data: {}, children: [] })
  const compiled = compileRefGraph(r, type ?? empty, path, { openOutputs: true, ...options, bindings, selected: true })
  const blocking = compiled.holes.filter(hole => hole.role !== 'output' || hole.reason !== 'unbound')
  return { ...compiled, blocking, canRun: blocking.length === 0 }
}
export function compileRow(r: Replica, path: Scope, options: CompileRefOptions = {}) {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const left = compileInstructions(r, path, options)
  const right = compileRefGraph(r, cid, path, { ...options, selected: true })
  return { left, right, canRun: left.canRun }
}

/** Persist the residual and its reachable immutable graph together, not just an orphan CID. */
export function saveRefCompilation(r: Replica, path: Scope, id: string, compiled: CompiledRef, now: number): Replica {
  const type = put(r.store, { data: { description: { content: 'Compiled ref' } }, children: [] })
  const envelope = put(r.store, { data: { refCompilation: { cid: compiled.cid } }, children: [[r.store.primitive.targetPointerConstructor.getId(), compiled.cid]] })
  return addRefAt(r, path, id, type, now, envelope)
}
