/** Evaluation uses ordinary typed refs for its journal and ordinary tasks for compensation. */
import { mergeNodes } from './merge'
import { isAttempt } from './work'
import { argumentRefs, contextBindings, resolveBinding, resolveText, type BindingEnvironment } from './bindings'
import { childRows, supplyOf, findRowByAlias, commitRoot, content, refValueCid, refTypeCid, newId, put, refNodeContent, resolveScope, updateAtScope, valueContent, identityCid, scopeBranches, selectBranch, importNodes, reachableNodes, type Scope, type TaskView } from './graph'
import { addRefAt, addTask, headCid, setTaskDone, view, loadReplica, serializeReplica, type Replica } from './replica'

export const EVALUATION_ARGUMENT = 'fos:evaluation'
const EVALUATION_BUDGET_MS = 120000
export type EvaluationRecord = {
  id: string; status: 'idle' | 'opening' | 'running' | 'committing' | 'committed' | 'awaiting-review' | 'rolled-back' | 'needs-recovery'
  started: number; error?: string; effects: Array<{ path: Scope; title: string; status: 'attempting' | 'applied' | 'pending-review' | 'reverted' | 'manual' }>
}

/** Runtime state is a typed mutable ref, not a new row kind or a separate database. */
export function readNodeValue<T>(r: Replica, path: Scope, name: string): T | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const arg = cid && argumentRefs(r.store, cid).find(a => a.name === name)
  if (!arg) return null
  try { return JSON.parse(valueContent(r.store, arg.cid).data.description?.content ?? '') as T } catch { return null }
}
export function writeNodeValue(r: Replica, path: Scope, name: string, value: unknown, now: number, handler?: { type: string; peer: string }): Replica {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) throw new Error('The node no longer exists.')
  const arg = argumentRefs(r.store, cid).find(a => a.name === name)
  const type = handler?.type ?? arg?.type ?? r.store.primitive.documentField.getId()
  const previous = arg ? content(r.store, arg.cid) : null
  const peer = handler?.peer ?? (arg ? valueContent(r.store, arg.cid).data.peerId?.content : undefined)
  const target = put(r.store, { data: { description: { content: JSON.stringify(value) }, ...(peer ? { peerId: { content: peer } } : {}) }, children: [] })
  if (!arg) return addRefAt(r, path, `${name}:${path.at(-1) ?? r.meta.peerId}`, type, now, target, name)
  const next = put(r.store, refNodeContent(r.store, previous!.data, target, [[r.store.primitive.previousVersion.getId(), arg.cid]], type))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: node.children.map(edge => identityCid(r.store, edge) === arg.cid ? [type, next] : edge) })), now)
  return { ...r }
}
/** A stored value may reference local or foreign nodes without importing their private context. */
export function writeLinkedNodeValue(r: Replica, path: Scope, name: string, value: unknown, now: number, links: Record<string, { id: string; owner?: string }>): Replica {
  r = writeNodeValue(r, path, name, value, now)
  const cid = resolveScope(r.store, headCid(r), path)!
  const arg = argumentRefs(r.store, cid).find(a => a.name === name)!
  const ref = content(r.store, arg.cid), target = valueContent(r.store, arg.cid)
  const children: typeof target.children = Object.entries(links).map(([key, link]) => [r.store.primitive.linkField.getId(), put(r.store, {
    data: { alias: { id: `${ref.data.alias!.id}:${key}` }, name: { content: key }, ref: link }, children: []
  })])
  const next = put(r.store, refNodeContent(r.store, ref.data, put(r.store, { ...target, children }), [[r.store.primitive.previousVersion.getId(), arg.cid]], arg.type))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), path, node => ({ ...node, children: node.children.map(edge => identityCid(r.store, edge) === arg.cid ? [arg.type, next] : edge) })), now)
  return { ...r }
}

export function evaluationRecord(r: Replica, path: Scope): EvaluationRecord | null {
  const record = readNodeValue<EvaluationRecord>(r, path, EVALUATION_ARGUMENT)
  return record && typeof record.id === 'string' && Array.isArray(record.effects) && typeof record.status === 'string' ? record : null
}

export type EvaluationStep = { path: Scope; row: TaskView | null }
export type EvaluationDriver = BindingEnvironment & {
  get(): Replica
  save(replica: Replica): void | Promise<void>
  now(): number
  /** Recheck live authority/availability; return why a handler cannot run. */
  check(step: EvaluationStep): string[]
  handles(step: EvaluationStep): boolean
  /** Explicit return slots may be unfilled before execution and written by the effect. */
  outputs?(step: EvaluationStep): string[]
  open?(step: EvaluationStep, transaction: string): Promise<void>
  /** `'pending'`: the result awaits human review (a proposal); the evaluation pauses as `awaiting-review` instead of committing. */
  effect?(step: EvaluationStep, operation: string): Promise<void | 'pending'>
  commit?(step: EvaluationStep, transaction: string): Promise<void>
  abort?(step: EvaluationStep, transaction: string): Promise<void>
  rollback?(step: EvaluationStep, operation: string): Promise<void>
}

export function evaluationSteps(r: Replica, path: Scope): EvaluationStep[] {
  const steps: EvaluationStep[] = []
  const walk = (at: Scope, depth: number) => {
    if (depth > 64 || steps.length >= 1000) throw new Error('Narrow the evaluation to fewer than 1,000 rows and 64 levels.')
    const row = at.length ? view(r, at.slice(0, -1))?.tasks.find(t => t.id === at.at(-1)) ?? null : null
    if (row?.kind === 'template') return
    if (row && ['ref', 'supply'].includes(row.kind)) return
    const cid = resolveScope(r.store, headCid(r), at)
    // A handler's attempt records (pinned prompts, return slots) are bookkeeping, never steps.
    if (depth > 0 && cid && isAttempt(r, cid)) return
    if (depth > 0 && cid && argumentRefs(r.store, cid).some(a => a.name === 'fos:trigger')) return
    const node = view(r, at)
    if (!node) throw new Error('The evaluated node no longer exists.')
    if (node.choices.length) throw new Error('Resolve conflicting choices before evaluation.')
    steps.push({ path: at, row })
    for (const child of node.tasks) walk([...at, child.id], depth + 1)
  }
  walk(path, 0)
  return steps
}

function problems(r: Replica, step: EvaluationStep, driver: EvaluationDriver): string[] {
  const cid = resolveScope(r.store, headCid(r), step.path)
  if (!cid) return ['The node no longer exists.']
  const issues = [...driver.check(step)]
  const candidates = contextBindings(r, step.path, driver)
  const outputs = new Set(driver.outputs?.(step) ?? [])
  for (const arg of argumentRefs(r.store, cid).filter(a => !a.name?.startsWith('fos:') && !outputs.has(content(r.store, a.cid).data.alias?.id ?? ''))) {
    issues.push(...resolveBinding(r.store, arg.type, arg.cid, candidates, undefined, driver).problems)
  }
  issues.push(...resolveText(r, step.path, valueContent(r.store, cid).data.description?.content ?? '').bindings.flatMap(b => b.problems))
  const req = step.row?.requirement
  if (req?.capability === 'allocation') for (const child of childRows(r.store, cid, 'supply')) {
    const supplied = supplyOf(child.value)
    if (supplied?.ref && !findRowByAlias(r.store, headCid(r), supplied.ref)) issues.push('The supplied allocation is unavailable for validation.')
  }
  if (req && !req.satisfied && !driver.handles(step)) {
    const childTasks = view(r, step.path)?.tasks.filter(t => t.kind === 'task') ?? []
    if (req.capability !== 'task' || !childTasks.length) issues.push(`Unfulfilled ${req.capability}: ${step.row!.title}`)
  }
  return issues
}
// Refuse changed instructions and bound arguments across an await; effect results are handled separately.
const instruction = (r: Replica, path: Scope, outputs: string[] = []) => {
  const cid = resolveScope(r.store, headCid(r), path)
  if (!cid) return null
  const { updated: _updated, ...data } = valueContent(r.store, cid).data
  return JSON.stringify({ data, arguments: argumentRefs(r.store, cid).filter(a => !a.name?.startsWith('fos:') && !outputs.includes(content(r.store, a.cid).data.alias?.id ?? '')), context: contextBindings(r, path).filter(a => !a.name?.startsWith('fos:') && !outputs.includes(content(r.store, a.cid).data.alias?.id ?? '')) })
}

export async function evaluateNode(path: Scope, driver: EvaluationDriver): Promise<EvaluationRecord> {
  const prior = evaluationRecord(driver.get(), path)
  if (prior && !['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(prior.status)) throw new Error('This evaluation needs recovery. Review its effects before running again.')
  const steps = evaluationSteps(driver.get(), path)
  if (!steps.length) throw new Error('Apply the template before evaluating it.')
  const initial = driver.get()
  if (path.some((id, i) => view(initial, path.slice(0, i))?.tasks.some(t => t.id === id && t.kind === 'template'))) throw new Error('Apply the template before evaluating it.')
  const issues = [...allocationProblems(initial, steps), ...steps.flatMap(step => problems(driver.get(), step, driver))]
  if (issues.length) throw new Error([...new Set(issues)].join('\n'))
  const versions = new Map(steps.map(step => [JSON.stringify(step.path), instruction(driver.get(), step.path, driver.outputs?.(step))]))
  const children = new Map(steps.map(step => [JSON.stringify(step.path), JSON.stringify(view(driver.get(), step.path)?.tasks.map(t => [t.id, t.kind]))]))
  const applied = new Set<string>()
  const record: EvaluationRecord = { id: newId(), status: 'opening', started: driver.now(), effects: [] }
  const save = () => driver.save(writeNodeValue(driver.get(), path, EVALUATION_ARGUMENT, record, driver.now()))
  const fresh = (step: EvaluationStep): EvaluationStep => ({ path: step.path, row: step.path.length ? view(driver.get(), step.path.slice(0, -1))?.tasks.find(t => t.id === step.path.at(-1)) ?? null : null })
  const check = (step: EvaluationStep) => {
    if (driver.now() - record.started > EVALUATION_BUDGET_MS) throw new Error('Evaluation exceeded two minutes. Review its effects before retrying.')
    const current = evaluationRecord(driver.get(), path)
    if (!current || current.id !== record.id || !['opening', 'running', 'committing'].includes(current.status)) throw new Error('The evaluation claim changed. Review recovery before retrying.')
    if (instruction(driver.get(), step.path, driver.outputs?.(step)) !== versions.get(JSON.stringify(step.path))) throw new Error('Instructions changed during evaluation. Review and run again.')
    if (!applied.has(JSON.stringify(step.path)) && JSON.stringify(view(driver.get(), step.path)?.tasks.map(t => [t.id, t.kind])) !== children.get(JSON.stringify(step.path))) throw new Error('The child rows changed during evaluation. Review and run again.')
    const errors = problems(driver.get(), fresh(step), driver)
    if (errors.length) throw new Error(errors.join('\n'))
  }
  await save()
  const opened: EvaluationStep[] = []
  let published: { before: string; after: string } | null = null, awaiting = false
  try {
    for (const step of steps) { check(step); opened.push(step); await driver.open?.(fresh(step), record.id) }
    record.status = 'running'; await save()
    for (const step of [...steps].reverse()) {
      check(step)
      const current = fresh(step)
      if (!current.row?.requirement || current.row.requirement.satisfied || !driver.handles(current)) continue
      for (const planned of steps) check(planned)
      const resourceErrors = allocationProblems(driver.get(), steps)
      if (resourceErrors.length) throw new Error(resourceErrors.join('\n'))
      if (!driver.effect) throw new Error('No executor is configured for this handler.')
      const effect = { path: step.path, title: current.row.title, status: 'attempting' as EvaluationRecord['effects'][number]['status'] }
      record.effects.push(effect); await save() // persist before sending, including an uncertain failed response
      applied.add(JSON.stringify(step.path))
      const beforeCid = resolveScope(driver.get().store, headCid(driver.get()), step.path)!
      const outputs = new Set(driver.outputs?.(step) ?? [])
      const expectedOutputs = argumentRefs(driver.get().store, beforeCid).filter(a => outputs.has(content(driver.get().store, a.cid).data.alias?.id ?? '')).map(a => ({ id: content(driver.get().store, a.cid).data.alias!.id, type: a.type }))
      const outcome = await driver.effect(current, `${record.id}:${JSON.stringify(step.path)}`)
      if (outcome === 'pending') { effect.status = 'pending-review'; awaiting = true; await save(); continue }
      for (const output of expectedOutputs) {
        const r = driver.get(), cid = resolveScope(r.store, headCid(r), [...step.path, output.id])
        if (!cid || refTypeCid(r.store, content(r.store, cid)) !== output.type || !refValueCid(r.store, content(r.store, cid)) || resolveBinding(r.store, output.type, cid, contextBindings(r, step.path, driver), undefined, driver).status !== 'ready') throw new Error('The handler did not supply a valid return value. Review its result before continuing.')
      }
      effect.status = 'applied'; await save()
      if (!fresh(step).row?.requirement?.satisfied) throw new Error('The handler has not fulfilled its requirement. Review its result before continuing.')
    }
    // A result left for review stops here: the owner accepts it (which supplies the requirement) and completes again.
    if (awaiting) { record.status = 'awaiting-review'; await save(); return record }
    record.status = 'committing'; await save()
    for (const step of [...steps].reverse()) {
      check(step)
      await driver.commit?.(fresh(step), record.id)
    }
    // Completion is published together only after every commit succeeds.
    const live = driver.get()
    const allocationErrors = allocationProblems(live, steps)
    if (allocationErrors.length) throw new Error(allocationErrors.join('\n'))
    let r = loadReplica(serializeReplica(live))
    for (const step of steps) for (const [id, name] of Object.entries(scopeBranches(live.store, headCid(live), step.path))) selectBranch(r.store, id, name)
    for (const step of [...steps].reverse()) if (step.row?.kind === 'task') {
      r = setTaskDone(r, step.path.slice(0, -1), step.path.at(-1)!, true, driver.now())
      if (!view(r, step.path.slice(0, -1))?.tasks.find(t => t.id === step.path.at(-1))?.done) throw new Error('A task still has unfulfilled requirements.')
    }
    record.status = 'committed'
    r = writeNodeValue(r, path, EVALUATION_ARGUMENT, record, driver.now())
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
    for (const effect of [...record.effects].reverse()) {
      try {
        if (!driver.rollback) throw new Error('Handler has no rollback operation')
        await driver.rollback(fresh({ path: effect.path, row: null }), `${record.id}:${JSON.stringify(effect.path)}`)
        effect.status = 'reverted'
      } catch {
        effect.status = 'manual'
        await driver.save(addTask(driver.get(), path, `Manually roll back or verify: ${effect.title} (evaluation ${record.id})`, driver.now(), `rollback:${record.id}:${record.effects.indexOf(effect)}`))
      }
    }
    for (const step of [...opened].reverse()) {
      try { await driver.abort?.(fresh(step), record.id) }
      catch {
        record.effects.push({ path: step.path, title: `Release transaction for ${step.row?.title ?? 'node'}`, status: 'manual' })
        await driver.save(addTask(driver.get(), path, `Manually release transaction for ${step.row?.title ?? 'node'} (${record.id})`, driver.now(), `rollback:${record.id}:${record.effects.length - 1}`))
      }
    }
    record.status = record.effects.some(e => e.status === 'manual') ? 'needs-recovery' : 'rolled-back'
    await save()
  }
  return record
}

/** Check only resources used by this evaluation, counting competing allocations elsewhere. */
export function allocationProblems(r: Replica, steps: EvaluationStep[]): string[] {
  const required = new Set(steps.flatMap(s => s.row?.allocation?.resource ? [s.row.allocation.resource] : []))
  if (!required.size) return []
  const banks = new Map<string, TaskView>(), allocations: TaskView[] = [], seen = new Set<string>()
  const walk = (path: Scope) => {
    if (path.length > 64 || seen.size > 10000) throw new Error('Too many resource rows to check safely.')
    for (const row of view(r, path)?.tasks ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      if (row.kind === 'template') continue
      if (row.resource) banks.set(row.id, row)
      if (row.requirement?.capability === 'allocation' && row.requirement.satisfied && row.requirement.amount !== undefined) banks.set(row.id, { ...row, resource: { type: row.requirement.resource ?? 'account', unit: row.requirement.unit ?? 'USD', capacity: row.requirement.amount, allocated: 0, available: row.requirement.amount } })
      if (row.allocation && required.has(row.allocation.resource)) allocations.push(row)
      if (row.childCount) walk([...path, row.id])
    }
  }
  walk([])
  const errors: string[] = []
  for (const id of required) {
    const bank = banks.get(id)
    if (!bank?.resource) { errors.push(`Resource bank ${id} is unavailable.`); continue }
    const changes: Array<{ at: number; amount: number }> = []
    for (const row of allocations.filter(a => a.allocation!.resource === id)) {
      const a = row.allocation!
      if (!Number.isFinite(a.amount) || a.amount < 0 || a.type !== bank.resource.type || a.unit !== bank.resource.unit || (a.end !== undefined && a.start !== undefined && a.end <= a.start)) {
        errors.push(`Invalid allocation: ${row.title}`); continue
      }
      changes.push({ at: a.start ?? -Infinity, amount: a.amount }, { at: a.end ?? Infinity, amount: -a.amount })
    }
    let amount = 0
    for (const change of changes.sort((a, b) => a.at - b.at || a.amount - b.amount)) {
      amount += change.amount
      if (bank.resource.capacity !== undefined && amount > bank.resource.capacity + 1e-9) { errors.push(`Insufficient ${bank.title}: overlapping allocations exceed ${bank.resource.capacity} ${bank.resource.unit}.`); break }
    }
  }
  return errors
}

/** Run under the same executor lock as evaluation, after confirming the old execution has stopped. */
export function recoverEvaluation(r: Replica, path: Scope, now: number): Replica {
  const record = evaluationRecord(r, path)
  if (!record || ['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(record.status)) return r
  if (['opening', 'running', 'committing'].includes(record.status) && now - record.started < EVALUATION_BUDGET_MS + 60000) throw new Error('This evaluation may still be running. Wait three minutes from its start before recovering an interrupted run.')
  for (const [index, effect] of record.effects.entries()) {
    if (effect.status === 'reverted') continue
    const id = `rollback:${record.id}:${index}`
    if (!view(r, path)?.tasks.some(t => t.id === id)) r = addTask(r, path, `Manually roll back or verify: ${effect.title} (evaluation ${record.id})`, now, id)
    effect.status = 'manual'
  }
  const pending = record.effects.some((effect, index) => effect.status === 'manual' && !view(r, path)?.tasks.find(t => t.id === `rollback:${record.id}:${index}`)?.done)
  return writeNodeValue(r, path, EVALUATION_ARGUMENT, { ...record, status: pending ? 'needs-recovery' : 'rolled-back' }, now)
}
