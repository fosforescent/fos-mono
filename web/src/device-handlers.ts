import { capabilityTarget, nativeRef, publishNativeRef, primitiveExecutors, nativeDefaultsApplied, markNativeDefaultsApplied, type PrimitiveDefinition, type Replica, type Scope, type EvaluationStep } from '../../shared/sync/index'
import { AGENT_TOOL } from '../../shared/sync/project-workflow'
import { deviceTriggerDefinitions } from '../../shared/sync/trigger-primitives'

export type DeviceEffect = { step: EvaluationStep; operation: string }
export function createDeviceHandlers(effects: {
  pull(context: DeviceEffect): Promise<void>
  agent(context: DeviceEffect): Promise<'pending'>
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
  return {
    restore(replica: Replica, host: string) { for (const declaration of declarations) nativeRef(replica.store, host, declaration) },
    publish(replica: Replica, at: Scope, host: string, now: number, ids?: string[], label = host) {
      const seeded = !ids && nativeDefaultsApplied(replica, at, `device:${host}`)
      const observersSeeded = nativeDefaultsApplied(replica, at, `device-observers:${host}`)
      for (const declaration of declarations.filter(value => !ids || ids.includes(value.id))) {
        const ref = nativeRef(replica.store, host, declaration)
        // Upgrade existing devices with the newly declared continuation observer once.
        if (!seeded || !ids && !observersSeeded && declaration.id === 'device:response') replica = publishNativeRef(replica, at, host, ref, now, label)
      }
      return ids ? replica : markNativeDefaultsApplied(markNativeDefaultsApplied(replica, at, `device:${host}`, now), at, `device-observers:${host}`, now)
    },
    executors(replica: Replica, step: EvaluationStep, host: string) {
      // Refresh/load adapters may replace the store. Restore local meanings without publishing any refs.
      for (const declaration of declarations) nativeRef(replica.store, host, declaration)
      return primitiveExecutors<DeviceEffect>(replica, step, host).map(value => value.native)
    }
  }
}
