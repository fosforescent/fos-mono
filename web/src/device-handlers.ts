import { libAt, nativeRef, restoreNativeRef, publishNativeRef, primitiveExecutors, nativeDefaultsApplied, markNativeDefaultsApplied, type PrimitiveDefinition, type Replica, type Scope, type EvaluationStep } from '../../shared/sync/index'
import { AGENT_TOOL } from '../../shared/sync/project-workflow'
import { deviceTriggerDefinitions } from '../../shared/sync/trigger-primitives'

export type DeviceEffect = { step: EvaluationStep; operation: string }
export function createDeviceHandlers(effects: {
  pull(context: DeviceEffect): Promise<void>
  agent(context: DeviceEffect): Promise<'pending'>
  fetch(context: DeviceEffect): Promise<void>
  solve(context: DeviceEffect): Promise<void>
}) {
  const declarations: PrimitiveDefinition<DeviceEffect>[] = [...deviceTriggerDefinitions]
  // These services have device implementations (node exchange and the trigger runner).
  for (const capability of ['provideNode', 'sync']) declarations.push({
    id: `device:${capability}`, label: capability, type: (store, at) => libAt(store, at).capabilities[capability]!
  })
  declarations.push({ id: 'device:pull', label: 'Pull', type: (store, at) => libAt(store, at).capabilities.tool!,
    handles: step => step.row?.requirement?.tool === 'fos.pull', effect: effects.pull })
  declarations.push({ id: 'device:agent', label: 'Coding agent', type: (store, at) => libAt(store, at).capabilities.tool!,
    handles: step => step.row?.requirement?.tool === AGENT_TOOL, effect: effects.agent })
  // Primitive constructors this device runs: network requests, and unification over the rows in scope.
  // Their rows are [fetch, right] and [solve, right]: they run where the row's left matches their declaration.
  declarations.push({ id: 'device:fetch', label: 'Fetch', type: (store, at) => libAt(store, at).capabilities.fetch!, effect: effects.fetch, opensRefs: true })
  declarations.push({ id: 'device:solve', label: 'Solve', type: (store, at) => libAt(store, at).capabilities.solve!, effect: effects.solve, opensRefs: true })
  return {
    restore(replica: Replica, host: string) { for (const declaration of declarations) restoreNativeRef(replica, [], host, declaration) },
    publish(replica: Replica, at: Scope, host: string, now: number, ids?: string[], label = host) {
      const seeded = !ids && nativeDefaultsApplied(replica, at, `device:${host}`)
      for (const declaration of declarations.filter(value => !ids || ids.includes(value.id))) {
        const ref = nativeRef(replica.store, host, declaration, declaration, at)
        if (!seeded) replica = publishNativeRef(replica, at, host, ref, now, label)
      }
      if (ids) return replica
      replica = markNativeDefaultsApplied(replica, at, `device:${host}`, now)
      return replica
    },
    executors(replica: Replica, step: EvaluationStep, host: string) {
      // Refresh/load adapters may replace the store. Restore local meanings without publishing any refs.
      for (const declaration of declarations) restoreNativeRef(replica, step.path, host, declaration)
      return primitiveExecutors<DeviceEffect>(replica, step, host).map(value => value.native)
    }
  }
}
