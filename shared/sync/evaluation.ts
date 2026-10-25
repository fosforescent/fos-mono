/** Evaluation uses ordinary typed refs for its journal and ordinary tasks for compensation. */
import { primitive } from './primitives'
import { compileOperands, type Native } from './native'
import { isOutputPattern } from './parameters'
import type { BindingLocation } from './scope-bindings'
import { proposeTransactionWrite } from './transactions'
import { copyOuterScope } from './graph'
import { commitTransactionWrites, discardTransactionWrites } from './transactions'
import { mergeNodes } from './merge'
import { hashContent } from '../dag-implementation/cid'
import { settingOf } from './graph'
import { constructNodeValue, isNodeValueType, readGraphValue } from './node-values'
import { isAttempt } from './work'
import { argumentRefs, contextBindings, resolveBinding, resolveText, type BindingEnvironment } from './bindings'
import { formText } from './forms'
import { TEMPLATE_TYPE } from './library-types'
import { compileInstructions } from './ref-compiler'
import { instructionPrimitives } from './primitives'
import { readRowValue, rowWithLeft, writeRowValue } from './row-values'
import { executeLeft, isExecuteLeft, isTriggerLeft } from './capabilities'
import { commitRoot, content, findEdge, isRequirementRow, refBindingBaseCid, refValueCid, newId, put, refNodeContent, resolveScope, updateAtScope, valueContent, identityCid, scopeBranches, selectBranch, importNodes, reachableNodes, type Scope, type TaskView } from './graph'
import { addRefAt, addTask, headCid, setTaskDone, view, loadReplica, serializeReplica, type Replica } from './replica'

const EVALUATION_BUDGET_MS = 120000
export type EvaluationRecord = {
  id: string; status: 'idle' | 'opening' | 'running' | 'committing' | 'committed' | 'awaiting-review' | 'rolled-back' | 'needs-recovery'
  /** `task`: the row asking someone to roll the effect back by hand, once there is one. */
  started: number; error?: string; effects: Array<{ path: Scope; title: string; status: 'attempting' | 'applied' | 'pending-review' | 'reverted' | 'manual'; task?: string }>
}


/** Runtime state is a typed mutable ref, not a new row kind or a separate database. */
/** The value named `name` at `path`; with `holder`, the one that peer holds there (a device's setting, `settingOf`). */
export function readNodeValue<T>(r: Replica, path: Scope, name: string, holder?: string): T | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const arg = cid && namedValue(r, cid, name, holder)
  if (!arg) return null
  return (readGraphValue(r.store, arg.cid) as T | undefined) ?? null
}
/**
 * Write the value named `name` at `path`. `handler.peer` is who holds it (a device's setting: found by its name and
 * holder, `settingOf`), `handler.type` its constructor when not a native value.
 */
export function writeNodeValue(r: Replica, path: Scope, name: string, value: unknown, now: number, handler?: { type?: string; peer: string }): Replica {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const arg = namedValue(r, cid, name, handler?.peer)
  const previous = arg ? content(r.store, arg.cid) : null
  const peer = handler?.peer ?? (arg ? valueContent(r.store, arg.cid).data.peerId?.content : undefined)
  const alias = previous?.data.alias?.id ?? hashContent({ data: { name: { content: name }, ...(peer ? { peerId: { content: peer } } : {}) }, children: [] })
  const built = constructNodeValue(r.store, value, alias, arg?.cid)
  const type = handler?.type ?? (arg && arg.type !== primitive(r.store, 'string') && !isNodeValueType(r.store, arg.type) ? arg.type : built.type)
  const target = peer ? put(r.store, { ...content(r.store, built.cid), data: { ...content(r.store, built.cid).data, peerId: { content: peer } } }) : built.cid
  if (!arg) return addRefAt(r, path, alias, type, now, target, name)
  const declarations = previous!.children.filter(([key]) => key !== primitive(r.store, 'target') && key !== primitive(r.store, 'instruction') && key !== primitive(r.store, 'previous'))
  const next = put(r.store, refNodeContent(r.store, previous!.data, target, [...declarations, [primitive(r.store, 'previous'), arg.cid]]))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: node.children.map(edge => identityCid(r.store, edge) === arg.cid ? [type, next] : edge) })), now)
  return { ...r }
}
/** The ref named `name` among the node `cid`'s declarations; with `holder`, the one that peer holds. */
function namedValue(r: Replica, cid: string, name: string, holder?: string) {
  return argumentRefs(r.store, cid).find(a => a.name === name && (!holder || settingOf(r.store, content(r.store, a.cid))?.peer === holder))
}
/** A stored value may reference local or foreign nodes without importing their private context. */
export function writeLinkedNodeValue(r: Replica, path: Scope, name: string, value: unknown, now: number, links: Record<string, { id: string; owner?: string }>): Replica {
  r = writeNodeValue(r, path, name, value, now)
  const cid = resolveScope(r.store, headCid(r), path)!
  const arg = argumentRefs(r.store, cid).find(a => a.name === name)!
  const ref = content(r.store, arg.cid), target = valueContent(r.store, arg.cid)
  const children: typeof target.children = Object.entries(links).map(([key, link]) => [primitive(r.store, 'link'), put(r.store, {
    data: { alias: { id: `${ref.data.alias!.id}:${key}` }, name: { content: key }, ref: link }, children: []
  })])
  const declarations = ref.children.filter(([key]) => key !== primitive(r.store, 'target') && key !== primitive(r.store, 'instruction') && key !== primitive(r.store, 'previous'))
  const next = put(r.store, refNodeContent(r.store, ref.data, put(r.store, { ...target, children: [...target.children.filter(([key]) => key !== primitive(r.store, 'link')), ...children] }), [...declarations, [primitive(r.store, 'previous'), arg.cid]]))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: node.children.map(edge => identityCid(r.store, edge) === arg.cid ? [arg.type, next] : edge) })), now)
  return { ...r }
}

/**
 * What running a row left on it, in its execute row: the evaluator's `journal` when the row was evaluated, and the
 * `result` its handler recorded when it ran as a step (a payment it opened, what an organizer placed, a title).
 */
export type ExecutionTime = Array<{ start: number; end?: number; notes: string }>
type ExecutionState = { journal?: EvaluationRecord; result?: unknown; time?: ExecutionTime; origin?: unknown; request?: unknown; claims?: unknown }
function executionState(r: Replica, path: Scope): ExecutionState {
  const state = readRowValue<ExecutionState>(r, path, isExecuteLeft)
  return state && typeof state === 'object' ? state : {}
}
function writeExecutionState(r: Replica, path: Scope, change: ExecutionState, now: number): Replica {
  return writeRowValue(r, path, executeLeft(r.store, path), { ...executionState(r, path), ...change }, now)
}
/** Write the journal into the node's execute row (made when the node has none). */
export function writeEvaluationRecord(r: Replica, path: Scope, record: EvaluationRecord, now: number): Replica {
  return writeExecutionState(r, path, { journal: record }, now)
}
/** What the step's handler recorded on the row it ran on. */
export function handlerResult<T>(r: Replica, path: Scope): T | null {
  return (executionState(r, path).result as T | undefined) ?? null
}
export function writeHandlerResult(r: Replica, path: Scope, result: unknown, now: number): Replica {
  return writeExecutionState(r, path, { result }, now)
}
/** What a run of a published template was started for (the visitor, the endpoint, its audience): kept with the run, past its visitor's revocation. */
export function executionOrigin<T>(r: Replica, path: Scope): T | null {
  return (executionState(r, path).origin as T | undefined) ?? null
}
export function writeExecutionOrigin(r: Replica, path: Scope, origin: unknown, now: number): Replica {
  return writeExecutionState(r, path, { origin }, now)
}
/** What the row asks its handler to do (an agent's prompt and options, a verification's commit): the step's request. */
export function executionRequest<T>(r: Replica, path: Scope): T | null {
  return (executionState(r, path).request as T | undefined) ?? null
}
export function writeExecutionRequest(r: Replica, path: Scope, request: unknown, now: number): Replica {
  return writeExecutionState(r, path, { request }, now)
}
/** Leases on work below the node: who is running which part of it now (host-coordinated). */
export function executionClaims<T>(r: Replica, path: Scope): T | null {
  return (executionState(r, path).claims as T | undefined) ?? null
}
export function writeExecutionClaims(r: Replica, path: Scope, claims: unknown, now: number): Replica {
  return writeExecutionState(r, path, { claims }, now)
}
/** Time a person spent running the node by hand (start/stop entries with notes). */
export function executionTime(r: Replica, path: Scope): ExecutionTime {
  const time = executionState(r, path).time
  return Array.isArray(time) ? time : []
}
export function writeExecutionTime(r: Replica, path: Scope, time: ExecutionTime, now: number): Replica {
  return writeExecutionState(r, path, { time }, now)
}
export function evaluationRecord(r: Replica, path: Scope): EvaluationRecord | null {
  const record = executionState(r, path).journal ?? null
  return record && typeof record.id === 'string' && Array.isArray(record.effects) && typeof record.status === 'string' ? record : null
}

export type EvaluationStep = { path: Scope; row: TaskView | null }
/**
 * What runs a step: a native, the one shape every host implementation has (sync/native.ts). It sees compiled operands
 * and answers values, which the evaluator submits as the evaluation's pending writes; discarding them reverts it.
 */
export type StepExecutor = { native: Native }
/** The one executor that runs a step, or why there is none to run. Every host selects through this. */
export function selectExecutor<E>(executors: E[]): { executor: E } | { executor: null; problem: string | null } {
  if (executors.length === 1) return { executor: executors[0]! }
  return { executor: null, problem: executors.length ? `${executors.length} handlers can run this step. Choose one in its context.` : null }
}
export type EvaluationDriver = BindingEnvironment & {
  get(): Replica
  save(replica: Replica): void | Promise<void>
  now(): number
  /** Recheck live authority/availability; return why a handler cannot run. */
  check(step: EvaluationStep): string[]
  /**
   * Every available executor this host has for the step, unselected. The evaluator runs a step only through exactly
   * one; several are a choice the owner makes in the graph, never an ordering this host picks from.
   */
  executors(step: EvaluationStep): StepExecutor[]
  open?(step: EvaluationStep, transaction: string): Promise<void>
  commit?(step: EvaluationStep, transaction: string): Promise<void>
  abort?(step: EvaluationStep, transaction: string): Promise<void>
}

export function evaluationSteps(r: Replica, path: Scope): EvaluationStep[] {
  const steps: EvaluationStep[] = []
  const walk = (at: Scope, depth: number) => {
    if (depth > 64 || steps.length >= 1000) throw new Error('Narrow the evaluation to fewer than 1,000 rows and 64 levels.')
    const row = at.length ? view(r, at.slice(0, -1))?.tasks.find(t => t.id === at.at(-1)) ?? null : null
    // a template's rows are a definition; references are not steps
    if (row?.type === TEMPLATE_TYPE) return
    if (row && row.refId !== undefined) return
    const cid = resolveScope(r.store, headCid(r), at)
    if (depth > 0 && cid && settingOf(r.store, content(r.store, cid))) return
    // the execute row is the evaluator's own: its journal, not a step
    if (depth > 0 && row?.typeCid && isExecuteLeft(r.store, row.typeCid)) return
    // A handler's attempt records (pinned prompts, return slots) are bookkeeping, never steps.
    if (depth > 0 && cid && isAttempt(r, cid)) return
    // a node with a trigger runs when it fires, not as a step of another evaluation; its trigger row is no step either
    if (depth > 0 && cid && rowWithLeft(r.store, cid, isTriggerLeft)) return
    if (depth > 0 && row?.typeCid && isTriggerLeft(r.store, row.typeCid)) return
    const node = view(r, at)
    if (!node) throw new Error('The evaluated node no longer exists.')
    if (node.choices.length) throw new Error('Resolve conflicting choices before evaluation.')
    // Data/argument rows still belong to the graph. Only executable left sides
    // become evaluation steps; the requested root remains the transaction boundary.
    if (depth === 0 || row?.checkable || row?.requirement || instructionPrimitives(r, { path: at, row }).length) steps.push({ path: at, row })
    // a satisfied requirement's rows are its bound value, not steps; an open one may hold the tasks that fill it
    if (depth > 0 && row?.requirement?.satisfied) return
    for (const child of node.tasks) walk([...at, child.id], depth + 1)
  }
  walk(path, 0)
  return steps
}

/**
 * Execution order: children before parents and later rows first, except that a step whose rows refer to another
 * step's row (by identity or as the head of a property path) runs after it, so it can use what that step produced.
 */
export function executionOrder(r: Replica, steps: EvaluationStep[]): EvaluationStep[] {
  const byId = new Map(steps.flatMap((step, index) => step.path.length ? [[step.path.at(-1)!, index] as [string, number]] : []))
  const dependencies = steps.map(step => {
    const cid = resolveScope(r.store, headCid(r), step.path)
    const referenced = new Set<number>()
    for (const edge of cid ? valueContent(r.store, cid).children : []) {
      const node = content(r.store, identityCid(r.store, edge)), value = valueContent(r.store, identityCid(r.store, edge))
      for (const id of [node.data.ref?.id, node.data.refExpression?.path[0], value.data.ref?.id, value.data.refExpression?.path[0]]) {
        const index = id === undefined ? undefined : byId.get(id)
        if (index !== undefined && steps[index] !== step) referenced.add(index)
      }
    }
    return referenced
  })
  const order: EvaluationStep[] = [], placed = new Set<number>(), visiting = new Set<number>()
  const place = (index: number) => {
    if (placed.has(index) || visiting.has(index)) return
    visiting.add(index)
    for (const dependency of dependencies[index]!) place(dependency)
    visiting.delete(index); placed.add(index); order.push(steps[index]!)
  }
  for (let index = steps.length - 1; index >= 0; index--) place(index)
  return order
}

function problems(r: Replica, step: EvaluationStep, driver: EvaluationDriver): string[] {
  const cid = resolveScope(r.store, headCid(r), step.path)
  if (!cid) return ['The node no longer exists.']
  const issues = [...driver.check(step)]
  const executors = driver.executors(step), selected = selectExecutor(executors)
  if (selected.executor === null && selected.problem) issues.push(selected.problem)
  if (instructionPrimitives(r, step).length && !executors.length) issues.push('The instruction primitive has no available executor on this host.')
  // a received ref (a primitive without `negative`) is filled at run time, so it does not hold the step back
  issues.push(...compileInstructions(r, step.path, { canRead: driver.canRead }).blocking.map(hole => `Unfilled instruction ref: ${hole.id} (${hole.reason})`))
  const candidates = contextBindings(r, step.path, driver)
  // a negative argument (a requirement) is the step's own to fill: an output, never an input it needs first
  for (const arg of argumentRefs(r.store, cid).filter(a => !settingOf(r.store, content(r.store, a.cid)) && content(r.store, a.cid).data.refRole !== 'output' && !isOutputPattern(r.store, a.type))) {
    issues.push(...resolveBinding(r.store, arg.type, arg.cid, candidates, undefined, { ...driver, scope: { replica: r, path: step.path } }).problems)
  }
  issues.push(...resolveText(r, step.path, formText(r.store, valueContent(r.store, cid)), [], driver).bindings.flatMap(b => b.problems))
  const req = step.row?.requirement
  if (req && !req.satisfied && !executors.length) {
    // a requirement with steps of its own (a task inside it) is fulfilled by running them; one with neither is unmet
    const childTasks = view(r, step.path)?.tasks.filter(t => t.checkable) ?? []
    if (!childTasks.length) issues.push(`Unfulfilled ${req.capability}: ${step.row!.title}`)
  }
  return issues
}
// Refuse changed instructions and bound arguments across an await; effect results are handled separately.
const instruction = (r: Replica, path: Scope) => {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return null
  // A requirement step's instruction is its declaration (the pattern, its own text): the value bound to it is the step's result.
  const parentCid = path.length ? resolveScope(r.store, headCid(r), path.slice(0, -1)) : null
  const edge = parentCid ? findEdge(r.store, valueContent(r.store, parentCid), `a:${path.at(-1)}`) : undefined
  if (edge && isRequirementRow(r.store, edge)) {
    const { updated: _updated, ...own } = content(r.store, cid).data
    return JSON.stringify({ data: own, pattern: edge[0] })
  }
  const { updated: _updated, ...data } = valueContent(r.store, cid).data
  const args = argumentRefs(r.store, cid)
  // Output properties are supplied by the effect too. Track their enclosing declaration identities.
  // a declared output (a requirement's result, a handler's return) is the effect's to fill, not part of the instruction
  const input = (a: { cid: string; type: string; name?: string; refIds?: string[] }) => !settingOf(r.store, content(r.store, a.cid)) &&
    content(r.store, a.cid).data.refRole !== 'output' && !isOutputPattern(r.store, a.type)
  const candidates = contextBindings(r, path)
  const resolved = args.filter(input).map(arg => {
    const value = resolveBinding(r.store, arg.type, arg.cid, candidates, undefined, { scope: { replica: r, path } })
    // Declaration provenance is compiler/UI state, never part of the persisted execution signature; pending
    // submissions on a declaration are not its instruction either.
    return { cid: refBindingBaseCid(r.store, content(r.store, arg.cid)), type: arg.type, name: arg.name, status: value.status, value: value.cid }
  })
  const text = resolveText(r, path, formText(r.store, valueContent(r.store, cid)))
  return JSON.stringify({ data, instruction: compileInstructions(r, path, { openOutputs: true }).cid, arguments: resolved,
    text: text.text, bindings: text.bindings.map(binding => ({ status: binding.status, cid: binding.cid })) })
}

/**
 * Run a native: compile the step's operands, hand them over, and submit what it answers as this evaluation's pending
 * writes, each to the declaration the compiler named and checked against that declaration's pattern. Outputs win
 * over proposals for one destination (a remainder rebinding the handle it came from).
 */
async function runNative(native: Native, step: EvaluationStep, evaluation: string, driver: EvaluationDriver): Promise<void | 'pending'> {
  const before = driver.get()
  // the compiler sees only the binding environment; the driver's other fields (its `outputs(step)`) are not compile options
  const { compiled, sources } = compileOperands(before, step.path, { ...(driver.canRead ? { canRead: driver.canRead } : {}), ...(driver.isPeerActive ? { isPeerActive: driver.isPeerActive } : {}) })
  const result = await native(compiled, { evaluation, step: step.path, now: driver.now(), store: before.store, put: node => put(before.store, node) })
  const writes = new Map<string, { binding: BindingLocation; value: string }>()
  for (const [name, value] of Object.entries(result.proposals ?? {})) {
    const binding = sources[name]
    if (!binding) throw new Error(`The handler proposed a value for ${name}, which is not an operand of this step.`)
    writes.set(binding.cid, { binding, value })
  }
  for (const [name, value] of Object.entries(result.outputs ?? {})) {
    const binding = sources[name]
    if (!binding || !(name in compiled.outputs)) throw new Error(`The handler answered ${name}, which is not an output of this step.`)
    writes.set(binding.cid, { binding, value })
  }
  let r = driver.get()
  for (const { binding, value } of writes.values()) r = proposeTransactionWrite(r, binding, value, evaluation, driver.now())
  await driver.save(r)
  return result.pending ? 'pending' : undefined
}

export async function evaluateNode(path: Scope, driver: EvaluationDriver): Promise<EvaluationRecord> {
  const prior = evaluationRecord(driver.get(), path)
  if (prior && !['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(prior.status)) throw new Error('This evaluation needs recovery. Review its effects before running again.')
  const steps = evaluationSteps(driver.get(), path)
  if (!steps.length) throw new Error('Apply the template before evaluating it.')
  const initial = driver.get()
  if (path.some((id, i) => view(initial, path.slice(0, i))?.tasks.some(t => t.id === id && t.type === TEMPLATE_TYPE))) throw new Error('Apply the template before evaluating it.')
  const issues = steps.flatMap(step => problems(driver.get(), step, driver))
  if (issues.length) throw new Error([...new Set(issues)].join('\n'))
  const versions = new Map(steps.map(step => [JSON.stringify(step.path), instruction(driver.get(), step.path)]))
  const executionShape = (step: EvaluationStep) => {
    const descendants = evaluationSteps(driver.get(), step.path).slice(1)
    return JSON.stringify(descendants.filter(child => !descendants.some(parent => parent.path.length < child.path.length && parent.path.every((id, i) => child.path[i] === id))).map(child => [child.path, child.row?.typeCid]))
  }
  const children = new Map(steps.map(step => [JSON.stringify(step.path), executionShape(step)]))
  const applied = new Set<string>()
  const record: EvaluationRecord = { id: newId(), status: 'opening', started: driver.now(), effects: [] }
  const save = () => driver.save(writeEvaluationRecord(driver.get(), path, record, driver.now()))
  const fresh = (step: EvaluationStep): EvaluationStep => ({ path: step.path, row: step.path.length ? view(driver.get(), step.path.slice(0, -1))?.tasks.find(t => t.id === step.path.at(-1)) ?? null : null })
  const check = (step: EvaluationStep) => {
    if (driver.now() - record.started > EVALUATION_BUDGET_MS) throw new Error('Evaluation exceeded two minutes. Review its effects before retrying.')
    const current = evaluationRecord(driver.get(), path)
    if (!current || current.id !== record.id || !['opening', 'running', 'committing'].includes(current.status)) throw new Error('The evaluation claim changed. Review recovery before retrying.')
    if (instruction(driver.get(), step.path) !== versions.get(JSON.stringify(step.path))) throw new Error('Instructions changed during evaluation. Review and run again.')
    if (!applied.has(JSON.stringify(step.path)) && executionShape(step) !== children.get(JSON.stringify(step.path))) throw new Error('The child rows changed during evaluation. Review and run again.')
    const errors = problems(driver.get(), fresh(step), driver)
    if (errors.length) throw new Error(errors.join('\n'))
  }
  await save()
  const opened: EvaluationStep[] = []
  let published: { before: string; after: string } | null = null, awaiting = false
  try {
    for (const step of steps) { check(step); opened.push(step); await driver.open?.(fresh(step), record.id) }
    record.status = 'running'; await save()
    for (const step of executionOrder(driver.get(), steps)) {
      check(step)
      const current = fresh(step)
      const executor = current.row?.requirement?.satisfied ? null : selectExecutor(driver.executors(current)).executor
      if (!executor) continue
      for (const planned of steps) check(planned)
      const effect = { path: step.path, title: current.row?.title ?? 'Ref', status: 'attempting' as EvaluationRecord['effects'][number]['status'] }
      record.effects.push(effect); await save() // persist before sending, including an uncertain failed response
      applied.add(JSON.stringify(step.path))
      // a native's answers are this evaluation's pending writes: checked against their declarations now, live at commit
      const outcome = await runNative(executor.native, step, record.id, driver)
      if (outcome === 'pending') { effect.status = 'pending-review'; awaiting = true; await save(); continue }
      effect.status = 'applied'; await save()
    }
    // A result left for review stops here: the owner accepts it (which supplies the requirement) and completes again.
    if (awaiting) { record.status = 'awaiting-review'; await save(); return record }
    record.status = 'committing'; await save()
    for (const step of [...steps].reverse()) {
      check(step)
      await driver.commit?.(fresh(step), record.id)
    }
    // Completion and the steps' proposed writes are published together, only after every commit succeeds.
    const live = driver.get()
    let r = loadReplica(serializeReplica(live))
    copyOuterScope(live.store, r.store)
    r = commitTransactionWrites(r, record.id, driver.now())
    for (const step of steps) for (const [id, name] of Object.entries(scopeBranches(live.store, headCid(live), step.path))) selectBranch(r.store, id, name)
    for (const step of [...steps].reverse()) if (step.row?.checkable) {
      r = setTaskDone(r, step.path.slice(0, -1), step.path.at(-1)!, true, driver.now())
      if (!view(r, step.path.slice(0, -1))?.tasks.find(t => t.id === step.path.at(-1))?.done) throw new Error('A task still has unfulfilled requirements.')
    }
    record.status = 'committed'
    r = writeEvaluationRecord(r, path, record, driver.now())
    published = { before: headCid(live), after: headCid(r) }
    importNodes(live.store, reachableNodes(r.store, [headCid(r)]))
    commitRoot(live.store, headCid(r), driver.now())
    await driver.save({ ...live })
  } catch (error) {
    if (published) {
      const current = driver.get()
      const restored = mergeNodes(current.store, published.after, headCid(current), published.before, { ours: 'Current edits', theirs: 'Uncommitted completion' })
      commitRoot(current.store, restored.cid, driver.now())
    }
    record.error = error instanceof Error ? error.message : String(error)
    try { await driver.save(discardTransactionWrites(driver.get(), record.id, driver.now())) } catch { /* the pending writes stay visible as open submissions */ }
    // every native's writes were pending submissions, discarded above; what a native did outside the graph is its own to compensate
    for (const effect of [...record.effects].reverse()) effect.status = 'reverted'
    for (const step of [...opened].reverse()) {
      try { await driver.abort?.(fresh(step), record.id) }
      catch {
        const task = newId()
        record.effects.push({ path: step.path, title: `Release transaction for ${step.row?.title ?? 'node'}`, status: 'manual', task })
        await driver.save(addTask(driver.get(), path, `Manually release transaction for ${step.row?.title ?? 'node'} (${record.id})`, driver.now(), task))
      }
    }
    record.status = record.effects.some(e => e.status === 'manual') ? 'needs-recovery' : 'rolled-back'
    await save()
  }
  return record
}

/** Run under the same executor lock as evaluation, after confirming the old execution has stopped. */
export function recoverEvaluation(r: Replica, path: Scope, now: number): Replica {
  const record = evaluationRecord(r, path)
  if (!record || ['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(record.status)) return r
  if (['opening', 'running', 'committing'].includes(record.status) && now - record.started < EVALUATION_BUDGET_MS + 60000) throw new Error('This evaluation may still be running. Wait three minutes from its start before recovering an interrupted run.')
  for (const effect of record.effects) {
    if (effect.status === 'reverted') continue
    if (!effect.task || !view(r, path)?.tasks.some(t => t.id === effect.task)) { effect.task = effect.task ?? newId(); r = addTask(r, path, `Manually roll back or verify: ${effect.title} (evaluation ${record.id})`, now, effect.task) }
    effect.status = 'manual'
  }
  const pending = record.effects.some(effect => effect.status === 'manual' && !view(r, path)?.tasks.find(t => t.id === effect.task)?.done)
  return writeEvaluationRecord(r, path, { ...record, status: pending ? 'needs-recovery' : 'rolled-back' }, now)
}
