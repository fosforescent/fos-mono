/** Handler-pattern adapters for the standard library's resource/task/user syntax.
 * Discovery and custom ref patterns do not depend on this vocabulary.
 */
import type { FosStore } from '../dag-implementation/store'
import { libAt, type TaskView } from './graph'
import { MONEY_TYPE } from './library-types'

/** Resource syntax adapters request the corresponding handler pattern. */
export function requirementHandlerTypes(store: FosStore, row: TaskView, at: import('./graph').Scope): string[] {
  const req = row.requirement
  if (!req) return []
  const names = [req.capability]
  if (req.capability === 'allocation') {
    if (row.type === MONEY_TYPE) names.push('send-payment')
    if (req.resource === 'points') names.push('points')
    if ((req.resource === 'calendar' || req.resource === 'person') && req.start != null && req.end != null) names.push('calendar')
  }
  return names.map(name => libAt(store, at).capabilities[name]!)
}
