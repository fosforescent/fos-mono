/** Host-language observer primitives. Availability comes only from scoped ref declarations. */
import { libAt, resolveScope, valueContent } from './graph'
import { headCid, view } from './replica'
import { evaluationRecord } from './evaluation'
import { watchedRefValue, type TriggerObserver } from './triggers'
import type { PrimitiveDefinition } from './primitives'

/** Numeric five-field UTC cron; lists, ranges and steps. Day-of-month/day-of-week use cron's OR rule. */
export function cronMatches(expression: string, now: number): boolean {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error('Use five UTC cron fields: minute hour day month weekday.')
  const date = new Date(now),
    values = [date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay()]
  const ranges = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6]
  ]
  const matches = fields.map((field, i) => {
    const [min, max] = ranges[i]!
    const accepted = new Set<number>()
    for (const part of field.split(',')) {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part)
      if (!match) throw new Error('Cron supports numeric values, *, ranges, lists and steps.')
      const range = match[1]!,
        step = Number(match[2] ?? 1)
      const [start, end] =
        range === '*' ? [min!, max!] : range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
      if (!Number.isInteger(step) || step < 1 || step > max! + 1 || start! < min! || end! > max! || start! > end!)
        throw new Error(`Invalid cron field: ${field}`)
      for (let n = start!; n <= end!; n += step) accepted.add(n)
    }
    return accepted.has(values[i]!)
  })
  const day = fields[2] !== '*' && fields[4] !== '*' ? matches[2] || matches[4] : matches[2] && matches[4]
  return !!(matches[0] && matches[1] && matches[3] && day)
}

export const timerObserver: TriggerObserver = {
  validate: ({ config, now }) => {
    if (config.due !== undefined && (!Number.isFinite(config.due) || (config.enabled && config.due < now)))
      throw new Error('Choose a future time.')
  },
  observe: ({ config, now }) =>
    typeof config.due === 'number' && now >= config.due ? { id: 'timer:' + config.created + ':' + config.due } : null
}
export const cronObserver: TriggerObserver = {
  validate: ({ config, now }) => {
    if (config.expression) cronMatches(config.expression, now)
  },
  observe: ({ config, now }) =>
    config.expression && cronMatches(config.expression, now) ? { id: 'cron:' + config.created + ':' + Math.floor(now / 60000) } : null
}
export const responseObserver: TriggerObserver = {
  validate: ({ config }) => {
    if (!config.response || typeof config.response.request !== 'string' || !Array.isArray(config.response.node))
      throw new Error('A response observer needs a request and node ref.')
  },
  observe: ({ replica: r, config: t }) => {
    const awaited = t.response
    if (!awaited) return null
    const record = evaluationRecord(r, awaited.node)
    if (record?.status === 'committed' && record.started >= awaited.requestedAt)
      return { id: 'response:' + awaited.request + ':' + record.id }
    for (let i = awaited.node.length; i >= 0; i--)
      if (
        view(r, awaited.node.slice(0, i))?.proposals.some(
          (p) => p.name === awaited.request && p.status === 'rejected' && p.timestamp >= awaited.requestedAt
        )
      )
        return { id: 'response:' + awaited.request + ':rejected' }
    return null
  }
}
export const requestObserver: TriggerObserver = {
  observe: ({ replica: r, path, config: t, previous }) => {
    const next = view(r, path)
      ?.proposals.filter(
        (p) =>
          p.status === 'open' &&
          p.timestamp >= t.created &&
          (p.timestamp > (previous?.requestTime ?? -Infinity) ||
            (p.timestamp === previous?.requestTime && !previous.requestIds?.includes(p.id)))
      )
      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))[0]
    return next
      ? {
          id: 'request:' + next.id,
          state: {
            requestTime: next.timestamp,
            requestIds: [...(previous?.requestTime === next.timestamp ? (previous.requestIds ?? []) : []), next.id]
          }
        }
      : null
  }
}
export const completionObserver: TriggerObserver = {
  observe: ({ replica: r, path, config: t, previous }) => {
    const parent = path.slice(0, -1),
      cid = resolveScope(r.store, headCid(r), parent),
      evaluated = evaluationRecord(r, parent)
    if (evaluated?.status === 'committed' && evaluated.started >= t.created) return { id: 'evaluation:' + evaluated.id }
    const data = cid ? valueContent(r.store, cid).data : null
    if (data?.todo?.completed && (data.updated?.time ?? 0) >= t.created)
      return previous?.status === 'finished' && previous.occurrence ? null : { id: 'completion:' + data.updated?.time }
    return previous?.status === 'finished' && previous.occurrence ? { id: '', reset: true } : null
  }
}
export const refChangeObserver: TriggerObserver = {
  validate: ({ replica: r, path, config: t }) => {
    const w = t.watch
    if (!w || !Array.isArray(w.path) || !w.path.every((id) => typeof id === 'string') || !w.path.length || !w.branch || !w.baseline)
      throw new Error('Choose a reference and branch to watch.')
    const parent = path.slice(0, -1)
    if (w.path.length <= parent.length && w.path.every((id, i) => parent[i] === id))
      throw new Error('Place the trigger outside the watched node.')
    if (!watchedRefValue(r, w.path, w.branch, w.merges)) throw new Error('The watched node is unavailable.')
  },
  observe: ({ replica: r, config: t, previous }) => {
    if (!t.watch) return null
    const value = watchedRefValue(r, t.watch.path, t.watch.branch, t.watch.merges)
    return value && (value !== t.watch.baseline || previous?.occurrence.startsWith('ref-change:' + t.created + ':'))
      ? { id: 'ref-change:' + t.created + ':' + value }
      : null
  }
}
const deviceObservers: Array<[string, TriggerObserver]> = [
  ['timer', timerObserver],
  ['task-completion', completionObserver],
  ['request', requestObserver],
  ['response', responseObserver],
  ['ref-change', refChangeObserver]
]
export const deviceTriggerDefinitions: PrimitiveDefinition[] = deviceObservers.map(([name, observer]) => ({
  id: 'device:' + name,
  label: name,
  capability: name,
  trigger: observer
}))
