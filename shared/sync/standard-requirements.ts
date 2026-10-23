/** Native satisfaction adapters for the standard library's resource/task/user values.
 * Discovery and custom ref patterns do not depend on this vocabulary.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosDataContent } from '../types'
import { allocationMatches, libAt, childRows, findRowByAlias, flowOf, isTaskRow, requirementProgress, rootTargetCid, valueContent, type ChildRow, type TaskView } from './graph'
import { allocationValue } from './destructure'
import { isAllocationType, MONEY_TYPE, QUERY_TYPE } from './library-types'
import { sameUser, userOf, userPeerId } from './users'

type Requirement = NonNullable<FosDataContent['requirement']>
type Supply = NonNullable<FosDataContent['supply']>
/** Resource syntax adapters request the corresponding handler pattern. */
export function requirementHandlerTypes(store: FosStore, row: TaskView, at: import('./graph').Scope): string[] {
  const req = row.requirement
  if (!req) return []
  const names = [req.capability]
  if (req.capability === 'allocation') {
    if (row.type === MONEY_TYPE) names.push('send-payment')
    if (req.resource === 'points') names.push('points')
    if ((req.resource === 'calendar' || req.resource === 'person') && req.start !== undefined) names.push('calendar')
  }
  return names.map(name => libAt(store, at).capabilities[name]!)
}
export function standardRequirementSatisfied(store: FosStore, cid: string, req: Requirement, root?: string): boolean {
  const rows = childRows(store, cid), named = userOf(store, valueContent(store, cid))
  const allocation = (row: ChildRow) => isAllocationType(row.type) && !!flowOf(row.type, row.value).allocation
  const fills = (value: FosDataContent['allocation'], given: ReturnType<typeof userOf>) =>
    allocationMatches(req, value, { required: named, given }) && (req.amount === undefined || value!.amount >= req.amount)
  const children: Record<string, (row: ChildRow) => boolean> = {
    task: row => isTaskRow(store, row.edge) && !!row.value.data.todo?.completed,
    allocation: row => allocation(row) && fills(allocationValue(store, row.cid), userOf(store, row.value)),
    search: row => row.type === QUERY_TYPE && !!row.value.data.query?.executedAt,
    peer: row => {
      const given = userOf(store, row.value)
      return allocation(row) && row.value.data.allocation?.type === 'person' &&
        (!named || (!!given && sameUser(named, given))) && (!req.peer || (!!given && userPeerId(given) === req.peer))
    }
  }
  const childRule = Object.hasOwn(children, req.capability) ? children[req.capability] : undefined
  if (childRule && rows.some(childRule)) return true
  if (req.capability === 'allocation' && req.amount !== undefined && req.amount > 0) {
    const progress = requirementProgress(store, cid, root)
    if (progress && progress.have >= progress.need) return true
  }
  const supplies: Record<string, (supply: Supply) => boolean> = {
    choice: supply => typeof supply.choice === 'number' && (!req.options || (supply.choice >= 0 && supply.choice < req.options.length)),
    search: supply => !!supply.ref,
    task: supply => !!supply.ref,
    verify: supply => !!supply.by && !!named?.verification,
    peer: supply => !!supply.by && (!req.peer || supply.by === req.peer) && (!named || supply.by === userPeerId(named) || supply.by === named.username),
    allocation: supply => {
      if (!supply.ref) return false
      const found = findRowByAlias(store, root ?? rootTargetCid(store), supply.ref)
      return !found || fills(found.row.allocation, found.row.user ?? null)
    }
  }
  return rows.some(row => {
    const supply = isAllocationType(row.type) ? flowOf(row.type, row.value).supply : undefined
    const rule = Object.hasOwn(supplies, req.capability) ? supplies[req.capability] : undefined
    return !!supply && supply.capability === req.capability && (rule?.(supply) ?? !!supply.by)
  })
}
