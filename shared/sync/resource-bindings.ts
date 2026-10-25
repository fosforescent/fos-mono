/** Resource syntax adapts to ordinary scoped capability bindings. It has no bank registry or tree search. */
import { allocationShapeOf } from './allocations'
import { contextBindings, type BindingEnvironment } from './bindings'
import { content, rowView, valueContent, type Scope, type TaskView } from './graph'
import type { Replica } from './replica'

export function resourceHandlers(r: Replica, at: Scope, environment: BindingEnvironment = {}) {
  // Discovery enumerates accepted handler values. Their prerequisites are checked when compiling an invocation.
  return contextBindings(r, at, environment).flatMap(candidate => (candidate.binding?.submissions ?? []).flatMap(({ cid: value }) => {
    const shape = allocationShapeOf(r.store, value)
    if (!shape) return []
    const resource = { type: shape.type, unit: shape.unit, ...(shape.start !== undefined ? { start: shape.start } : {}), ...(shape.end !== undefined ? { end: shape.end } : {}) }
    const row = rowView(r.store, candidate.cid, [candidate.type, candidate.cid])
    return [{ ...candidate, value, row: { ...row, id: content(r.store, candidate.cid).data.alias?.id ?? candidate.cid,
      resource: { ...resource, held: row.resource?.held ?? 0 } } as TaskView & { resource: NonNullable<TaskView['resource']> } }]
  })).filter((handler, index, handlers) => handlers.findIndex(other =>
    other.cid === handler.cid || !!handler.name && !!handler.scope && other.name === handler.name &&
    other.scope?.store === handler.scope.store && JSON.stringify(other.scope.path) === JSON.stringify(handler.scope.path) &&
    other.value === handler.value
  ) === index)
}
