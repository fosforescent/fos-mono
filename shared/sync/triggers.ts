/** Triggers are named arguments on nodes, supplied by a device or the Home server peer. */
import { evaluationRecord, readNodeValue, writeNodeValue } from './evaluation'
import { addTask, headCid, instantiateTemplate, view, type Replica } from './replica'
import { capabilityTarget, newId, resolveScope, valueContent, type Scope } from './graph'
export type TriggerKind = 'timer' | 'cron' | 'task-completion' | 'request' | 'response'
/** What a `response` trigger waits for: the evaluation request this peer left on another peer's node. */
export type AwaitedResponse = { request: string; node: Scope; requestedAt: number }
export type NodeTrigger = { kind: TriggerKind; peer: string; enabled: boolean; created: number; due?: number; expression?: string; response?: AwaitedResponse }
export type TriggerState = { occurrence: string; status: 'running' | 'finished' | 'failed'; error?: string; target: Scope; requestTime?: number; requestIds?: string[] }
export const TRIGGER_ARGUMENT = 'fos:trigger'
export const TRIGGER_STATE_ARGUMENT = 'fos:trigger-state'
export function nodeTrigger(r: Replica, path: Scope): NodeTrigger | null {
  const t = readNodeValue<NodeTrigger>(r, path, TRIGGER_ARGUMENT)
  return t && ['timer', 'cron', 'task-completion', 'request', 'response'].includes(t.kind) && typeof t.peer === 'string' && typeof t.created === 'number' ? t : null
}
export const triggerState = (r: Replica, path: Scope) => readNodeValue<TriggerState>(r, path, TRIGGER_STATE_ARGUMENT)

/** Numeric five-field UTC cron; lists, ranges and steps. Day-of-month/day-of-week use cron's OR rule. */
export function cronMatches(expression: string, now: number): boolean {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error('Use five UTC cron fields: minute hour day month weekday.')
  const date = new Date(now), values = [date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay()]
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]]
  const matches = fields.map((field, i) => {
    const [min, max] = ranges[i]!
    const accepted = new Set<number>()
    for (const part of field.split(',')) {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part)
      if (!match) throw new Error('Cron supports numeric values, *, ranges, lists and steps.')
      const range = match[1]!, step = Number(match[2] ?? 1)
      const [start, end] = range === '*' ? [min!, max!] : range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
      if (!Number.isInteger(step) || step < 1 || step > max! + 1 || start! < min! || end! > max! || start! > end!) throw new Error(`Invalid cron field: ${field}`)
      for (let n = start!; n <= end!; n += step) accepted.add(n)
    }
    return accepted.has(values[i]!)
  })
  const day = fields[2] !== '*' && fields[4] !== '*' ? matches[2] || matches[4] : matches[2] && matches[4]
  return !!(matches[0] && matches[1] && matches[3] && day)
}
export function setNodeTrigger(r: Replica, path: Scope, trigger: NodeTrigger, now: number): Replica {
  // A continuation waits on the node that made the request; every other trigger instantiates a template.
  if (trigger.kind !== 'response' && (!path.length || view(r, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1))?.kind !== 'template')) throw new Error('Triggers require a template.')
  if (trigger.kind === 'response' && (!trigger.response || typeof trigger.response.request !== 'string' || !Array.isArray(trigger.response.node))) throw new Error('A response trigger names the request it waits for.')
  if (trigger.kind === 'cron') cronMatches(trigger.expression ?? '', now)
  if (trigger.kind === 'timer' && (!Number.isFinite(trigger.due) || trigger.due! < now)) throw new Error('Choose a future time.')
  return writeNodeValue(r, path, TRIGGER_ARGUMENT, trigger, now, { type: capabilityTarget(r.store, trigger.kind), peer: trigger.peer })
}
export function triggerOccurrence(r: Replica, path: Scope, t: NodeTrigger, now: number): string | null {
  if (!t.enabled) return null
  if (t.kind === 'timer') return t.due !== undefined && now >= t.due ? `timer:${t.created}:${t.due}` : null
  if (t.kind === 'cron') return cronMatches(t.expression ?? '', now) ? `cron:${t.created}:${Math.floor(now / 60000)}` : null
  if (t.kind === 'response') {
    // Peer A asked peer B to evaluate `node`; the answer is B's committed evaluation there (or B's rejection of the request).
    const awaited = t.response!, record = evaluationRecord(r, awaited.node)
    if (record?.status === 'committed' && record.started >= awaited.requestedAt) return `response:${awaited.request}:${record.id}`
    // The request was recorded (by name) on the attachment the requester used, at or above the node: look up the chain.
    for (let i = awaited.node.length; i >= 0; i--) if (view(r, awaited.node.slice(0, i))?.proposals.some(p => p.name === awaited.request && p.status === 'rejected' && p.timestamp >= awaited.requestedAt)) return `response:${awaited.request}:rejected`
    return null
  }
  if (t.kind === 'request') {
    const previous = triggerState(r, path)
    const next = view(r, path)?.proposals.filter(p => p.status === 'open' && p.timestamp >= t.created &&
      (p.timestamp > (previous?.requestTime ?? -Infinity) || (p.timestamp === previous?.requestTime && !previous.requestIds?.includes(p.id))))
      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))[0]
    return next ? `request:${next.id}` : null
  }
  const parent = path.slice(0, -1), cid = resolveScope(r.store, headCid(r), parent)
  const evaluated = evaluationRecord(r, parent)
  if (evaluated?.status === 'committed' && evaluated.started >= t.created) return `evaluation:${evaluated.id}`
  const data = cid ? valueContent(r.store, cid).data : null
  return data?.todo?.completed && (data.updated?.time ?? 0) >= t.created ? `completion:${data.updated?.time}` : null
}
export function configuredTriggers(r: Replica): Array<{ path: Scope; trigger: NodeTrigger }> {
  const result: Array<{ path: Scope; trigger: NodeTrigger }> = [], seen = new Set<string>()
  const walk = (path: Scope) => {
    if (path.length > 64 || seen.size > 5000) return
    const trigger = nodeTrigger(r, path)
    if (trigger) result.push({ path, trigger })
    for (const row of view(r, path)?.tasks ?? []) {
      if (seen.has(row.id) || row.kind === 'ref') continue
      seen.add(row.id)
      // Only the template itself can trigger; its internal declarations are inactive until applied.
      if (row.kind === 'template' && row.id !== 'fos:home') {
        const nested = nodeTrigger(r, [...path, row.id]); if (nested) result.push({ path: [...path, row.id], trigger: nested })
      } else walk([...path, row.id])
    }
  }
  walk([]); return result
}
export async function runNodeTriggers(driver: {
  get(): Replica; save(r: Replica): void | Promise<void>; now(): number
  available(peer: string, kind: TriggerKind, path: Scope): boolean
  evaluate(path: Scope): Promise<void>
}): Promise<void> {
  for (const { path, trigger } of configuredTriggers(driver.get())) {
    if (!driver.available(trigger.peer, trigger.kind, path) || view(driver.get(), path)?.choices.length) continue
    const event = triggerOccurrence(driver.get(), path, trigger, driver.now())
    const prior = triggerState(driver.get(), path)
    if (trigger.kind === 'task-completion' && prior?.status === 'finished' && prior.occurrence) {
      if (event && (!event.startsWith('evaluation:') || event === prior.occurrence)) continue // already consumed this completed state; edits to the parent are not another completion
      await driver.save(writeNodeValue(driver.get(), path, TRIGGER_STATE_ARGUMENT, { ...prior, occurrence: '' }, driver.now()))
    }
    if (!event || prior?.occurrence === event || prior?.status === 'running' || prior?.status === 'failed') continue
    let r = driver.get(), target = path
    const row = path.length ? view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
    if (row?.kind === 'template' && row.id !== 'fos:home') {
      const id = newId(), parent = path.slice(0, -1)
      r = addTask(r, parent, row.title, driver.now(), id)
      r = instantiateTemplate(r, parent, id, row.id, driver.now()); target = [...parent, id]
    }
    // Claim before evaluating. Failed/interrupted runs require explicit review, not an automatic retry.
    const request = trigger.kind === 'request' ? view(r, path)?.proposals.find(p => `request:${p.id}` === event) : undefined
    let state: TriggerState = { occurrence: event, status: 'running', target, ...(request ? { requestTime: request.timestamp, requestIds: [...(prior?.requestTime === request.timestamp ? prior.requestIds ?? [] : []), request.id] } : {}) }
    await driver.save(writeNodeValue(r, path, TRIGGER_STATE_ARGUMENT, state, driver.now()))
    try { await driver.evaluate(target); state = { ...state, status: 'finished' } }
    catch (error) { state = { ...state, status: 'failed', error: error instanceof Error ? error.message : String(error) } }
    await driver.save(writeNodeValue(driver.get(), path, TRIGGER_STATE_ARGUMENT, state, driver.now()))
  }
}

/**
 * Peer A sent an evaluation request to peer B (`complete` answered `requested`): set up the continuation on A's node
 * automatically, so A's own evaluation runs when B's answer arrives. The trigger belongs to this device and runs
 * while its app is open, like the other device triggers.
 */
export function requestContinuation(r: Replica, at: Scope, awaited: AwaitedResponse, now: number): Replica {
  return setNodeTrigger(r, at, { kind: 'response', peer: r.meta.peerId, enabled: true, created: now, response: awaited }, now)
}
