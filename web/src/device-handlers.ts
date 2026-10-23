import { capabilityTarget, nativeRef, publishNativeRef, primitiveExecutors, nativeDefaultsApplied, markNativeDefaultsApplied, type PrimitiveDefinition, type Replica, type Scope, type EvaluationStep } from '../../shared/sync/index'
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
    id: `device:${capability}`, label: capability, type: store => capabilityTarget(store, capability)
  })
  declarations.push({ id: 'device:pull', label: 'Pull', type: store => capabilityTarget(store, 'tool'),
    handles: step => step.row?.requirement?.tool === 'fos.pull', effect: effects.pull })
  declarations.push({ id: 'device:agent', label: 'Coding agent', type: store => capabilityTarget(store, 'tool'),
    handles: step => step.row?.requirement?.tool === AGENT_TOOL, effect: effects.agent })
  // Primitive constructors this device runs: network requests, and unification over the rows in scope.
  const primitives = ['device:fetch', 'device:solve']
  // Their rows are [fetch, right] and [solve, right]: they run where the row's left matches their declaration.
  declarations.push({ id: 'device:fetch', label: 'Fetch', type: store => capabilityTarget(store, 'fetch'), effect: effects.fetch, opensRefs: true })
  declarations.push({ id: 'device:solve', label: 'Solve', type: store => capabilityTarget(store, 'solve'), effect: effects.solve, opensRefs: true })
  return {
    restore(replica: Replica, host: string) { for (const declaration of declarations) nativeRef(replica.store, host, declaration) },
    publish(replica: Replica, at: Scope, host: string, now: number, ids?: string[], label = host) {
      const seeded = !ids && nativeDefaultsApplied(replica, at, `device:${host}`)
      const observersSeeded = nativeDefaultsApplied(replica, at, `device-observers:${host}`)
      const primitivesSeeded = nativeDefaultsApplied(replica, at, `device-primitives:${host}`)
      for (const declaration of declarations.filter(value => !ids || ids.includes(value.id))) {
        const ref = nativeRef(replica.store, host, declaration)
        // Upgrade existing devices with newly declared refs once (removing one afterwards keeps it removed).
        const upgrade = !ids && (!observersSeeded && declaration.id === 'device:response' || !primitivesSeeded && primitives.includes(declaration.id))
        if (!seeded || upgrade) replica = publishNativeRef(replica, at, host, ref, now, label)
      }
      if (ids) return replica
      for (const marker of ['device', 'device-observers', 'device-primitives']) replica = markNativeDefaultsApplied(replica, at, `${marker}:${host}`, now)
      return replica
    },
    executors(replica: Replica, step: EvaluationStep, host: string) {
      // Refresh/load adapters may replace the store. Restore local meanings without publishing any refs.
      for (const declaration of declarations) nativeRef(replica.store, host, declaration)
      return primitiveExecutors<DeviceEffect>(replica, step, host).map(value => value.native)
    }
  }
}
