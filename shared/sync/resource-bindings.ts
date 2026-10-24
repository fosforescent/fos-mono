/** Resource syntax adapts to ordinary scoped capability bindings. It has no bank registry or tree search. */
import { contextBindings, type BindingEnvironment } from './bindings'
import { content, rowView, valueContent, type Scope, type TaskView } from './graph'
import type { Replica } from './replica'

export function resourceHandlers(r: Replica, at: Scope, environment: BindingEnvironment = {}) {
  // Discovery enumerates accepted handler values. Their prerequisites are checked when compiling an invocation.
  return contextBindings(r, at, environment).flatMap(candidate => (candidate.binding?.submissions ?? []).flatMap(({ cid: value }) => {
    const resource = valueContent(r.store, value).data.resource
    if (!resource) return []
    const row = rowView(r.store, candidate.cid, [candidate.type, candidate.cid])
    return [{ ...candidate, value, row: { ...row, id: content(r.store, candidate.cid).data.alias?.id ?? candidate.cid,
      resource: { ...resource, allocated: row.resource?.allocated ?? 0, available: row.resource?.available ?? resource.capacity ?? null } } as TaskView & { resource: NonNullable<TaskView['resource']> } }]
  })).filter((handler, index, handlers) => handlers.findIndex(other =>
    other.cid === handler.cid || !!handler.name && !!handler.scope && other.name === handler.name &&
    other.scope?.store === handler.scope.store && JSON.stringify(other.scope.path) === JSON.stringify(handler.scope.path) &&
    other.value === handler.value
  ) === index)
}
