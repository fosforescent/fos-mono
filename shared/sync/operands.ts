/**
 * How a primitive is called: the one shape every host implementation has. It receives the step's operands as compiled
 * content (CIDs the ref compiler produced: no aliases, no refs, no scopes) and answers only values: what it binds the
 * step's outputs to and what it proposes for the refs it was passed. It never writes the tree; the evaluator submits
 * its answers as the evaluation's pending writes and publishes them when the evaluation commits.
 */
import { allocationIn, type Allocation } from './allocations'
import { isOutputDeclaration } from './structural'
import { refTitle } from './fields'
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent, FosNodeContent } from '../types'
import { content, resolveScope, type Scope, put } from './graph'
import { headCid, type Replica } from './replica'
import type { BindingEnvironment } from './bindings'
import { bindingProperties, type BindingLocation } from './scope-bindings'
import { resolveRefExpression, resolveRefIdentity } from './ref-paths'
import { assertCompiledGraph, compileInstructions, compileRefGraph } from './ref-compiler'

/** An output the step declares: the pattern its value must satisfy and what the declaration itself says (an amount, a title). */
export type CompiledOutput = { pattern: string; data: FosDataContent; title?: string; allocation?: Allocation }
/** The step's operands by name: inputs as the compiled values their declarations resolved to, outputs still to fill (`self`: the step's own requirement). */
export type Compiled = { inputs: Record<string, string>; outputs: Record<string, CompiledOutput>; left: string }
export type PrimitiveContext = {
  evaluation: string
  step: Scope
  now: number
  /** The store compiled content is read from; a primitive puts the values it answers with here. */
  store: FosStore
  put(node: FosNodeContent): string
}
/** `outputs`: values for the step's declared outputs; `proposals`: next values for inputs it was passed (refs). */
export type PrimitiveResult = { outputs?: Record<string, string>; proposals?: Record<string, string>; pending?: true }
export type PrimitiveFunction = (operands: Compiled, context: PrimitiveContext) => Promise<PrimitiveResult>

/** Each operand's declaration: where the evaluator submits the primitive's answer for it. */
export type OperandSources = Record<string, BindingLocation>

/**
 * Compile the operands of the step at `path`: every declaration the row makes. Inputs compile to content through
 * the ref compiler; outputs (declared outputs, and the row's negative arguments) are left for the primitive to fill.
 * An output that is itself a reference to another declaration names that declaration as its destination.
 */
export function compileOperands(r: Replica, path: Scope, environment: BindingEnvironment = {}): { compiled: Compiled; sources: OperandSources } {
  const store = r.store, cid = resolveScope(store, headCid(r), path)
  if (!cid) throw new Error('The evaluated row no longer exists.')
  // an output declaration's own rows: its title, and the amount it issues
  const titled = (ref: FosNodeContent) => { const title = refTitle(store, ref), allocation = allocationIn(store, ref); return { ...(title !== null ? { title } : {}), ...(allocation ? { allocation } : {}) } }
  const inputs: Record<string, string> = {}, outputs: Record<string, CompiledOutput> = {}, sources: OperandSources = {}
  // A requirement step's own hole is its output `self`: the primitive fills the requirement by answering it.
  const parent = path.length ? resolveScope(store, headCid(r), path.slice(0, -1)) : null
  const own = parent ? bindingProperties({ store, cid: parent, path: path.slice(0, -1) }, environment).bindings.find(binding => binding.id === path.at(-1)) : undefined
  if (own && isOutputDeclaration(store, own.pattern, own.cid)) {
    const { alias: _alias, ref: _ref, refExpression: _expression, refRole: _role, updated: _updated, ...data } = content(store, own.cid).data
    outputs.self = { pattern: own.pattern, data, ...titled(content(store, own.cid)) }
    sources.self = own
  }
  for (const binding of bindingProperties({ store, cid, path }, environment).bindings) {
    if (!binding.ambient) continue
    const node = content(store, binding.cid), name = binding.name ?? binding.id
    // A reference row stands for another declaration: what the primitive answers for it is written there.
    let source: BindingLocation = binding
    const visited = new Map<FosStore, Set<string>>()
    for (let depth = 0; ; depth++) {
      const seen = visited.get(source.store) ?? new Set<string>()
      if (depth >= 128 || seen.has(source.cid)) throw new Error(`The operand ${name} contains a reference cycle.`)
      seen.add(source.cid); visited.set(source.store, seen)
      const value = content(source.store, source.cid), at = source.path.slice(0, -1)
      const found = value.data.refExpression
        ? resolveRefExpression({ store: source.store }, at, value.data.refExpression, environment)
        : value.data.ref?.id && !value.data.ref.peer && !value.data.ref.owner
          ? resolveRefIdentity({ store: source.store }, at, value.data.ref.id, environment) : null
      if (!found) break
      if (found.status !== 'ready' || !found.locations[0]) throw new Error(`The operand ${name} refers to a declaration that is unavailable in this scope.`)
      source = found.locations[0]
    }
    sources[name] = source
    if (node.data.refRole === 'output' || isOutputDeclaration(store, binding.pattern, binding.cid)) {
      const { alias: _alias, ref: _ref, refExpression: _expression, refRole: _role, updated: _updated, ...data } = node.data
      outputs[name] = { pattern: binding.pattern, data, ...titled(node) }
      continue
    }
    const compiled = compileRefGraph(r, binding.cid, [...path, binding.id], environment)
    if (!compiled.complete) throw new Error(`Unresolved operand ${name}: ${compiled.holes.map(hole => `${hole.id} (${hole.reason})`).join(', ')}`)
    inputs[name] = compiled.cid
  }
  assertCompiledGraph(store, Object.values(inputs))
  return { compiled: { inputs, outputs, left: rowLeft(r, path, environment) }, sources }
}

function rowLeft(r: Replica, path: Scope, environment: BindingEnvironment): string {
  const compiled = compileInstructions(r, path, environment)
  if (!compiled.canRun) throw new Error('The instruction has unresolved operands.')
  return compiled.cid
}
