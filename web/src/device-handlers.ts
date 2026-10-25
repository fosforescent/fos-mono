import { libAt, registerPrimitives, restorePrimitives, stepExecutors, primitiveDefaultsApplied, markPrimitiveDefaultsApplied, allocatePrimitive, content, isRefNode, instructionPrimitives, type PrimitiveDefinition, type Replica, type Scope, type EvaluationStep, type PrimitiveFunction } from '../../shared/sync/index'
import { AGENT_TOOL } from '../../shared/sync/project-workflow'
import { supplyValue } from '../../shared/sync/arguments'
import { deviceTriggerDefinitions } from '../../shared/sync/trigger-primitives'


/** The text a compiled operand holds: a description, or a text scalar. */
function operandText(store: import('../../shared/dag-implementation/store').FosStore, cid: string | undefined): string | null {
  if (!cid || !store.table.has(cid)) return null
  const data = content(store, cid).data
  return data.description?.content ?? (data.scalar?.type === 'text' ? String(data.scalar.value) : null)
}

export function createDeviceHandlers(effects: {
  peerId(): string
  /** Sync with the account now; throws when it fails. */
  pull(): Promise<void>
  /** Queue the coding agent for the step at `path`; the result arrives through the workflow. */
  agent(path: Scope, evaluation: string): Promise<void>
  /** One request from this device: the response body, or a thrown error. */
  fetch(url: string, method: string): Promise<{ status: number; body: string }>
}) {
  const declarations: PrimitiveDefinition[] = [...deviceTriggerDefinitions]
  // These services have device implementations (node exchange and the trigger runner).
  for (const capability of ['provideNode', 'sync']) declarations.push({
    id: `device:${capability}`, label: capability, capability: (store, at) => libAt(store, at).capabilities[capability]!
  })
  // A requirement's own hole is its operand `self`: these primitives answer it with a value of its pattern.
  const answering = (by: string, receipt: string): PrimitiveFunction => async (operands, context) => {
    const self = operands.outputs.self
    if (!self) throw new Error('This handler fills a requirement row.')
    return { outputs: { self: supplyValue(context.store, self.pattern, by, receipt) } }
  }
  declarations.push({ id: 'device:pull', label: 'Pull', capability: (store, at) => libAt(store, at).capabilities.tool!,
    handles: step => step.row?.requirement?.tool === 'fos.pull', run: async (operands, context) => { await effects.pull(); return answering(effects.peerId(), 'pulled')(operands, context) } })
  declarations.push({ id: 'device:agent', label: 'Coding agent', capability: (store, at) => libAt(store, at).capabilities.tool!,
    handles: step => step.row?.requirement?.tool === AGENT_TOOL, run: async (_operands, context) => { await effects.agent(context.step, context.evaluation); return { pending: true } } })
  // A network request: [fetch, right], the url and method its compiled inputs, the body bound to its `response` output.
  const fetchPrimitive: PrimitiveFunction = async (operands, context) => {
    const url = operandText(context.store, operands.inputs.url), method = operandText(context.store, operands.inputs.method) ?? 'GET'
    if (!url) throw new Error('Give the address to fetch.')
    const answer = await effects.fetch(url, method)
    if (answer.status >= 400) throw new Error(`${url} answered ${answer.status}.`)
    return { outputs: { response: context.put({ data: { description: { content: answer.body } }, children: [] }) } }
  }
  declarations.push({ id: 'device:fetch', label: 'Fetch', capability: (store, at) => libAt(store, at).capabilities.fetch!, run: fetchPrimitive })
  // solve (unification over the rows in scope) is not a run: it needs the scope, which a primitive does not see. It returns when the scope is an operand.
  // Moving resource authority: the shared quantity-conservation check, proposing the owner's next state for the evaluation to commit.
  declarations.push({ id: 'device:allocate', label: 'Allocate', capability: (store, at) => libAt(store, at).capabilities.allocate!, run: allocatePrimitive })
  return {
    restore(replica: Replica, host: string) { restorePrimitives(replica, [], host, declarations) },
    publish(replica: Replica, at: Scope, host: string, now: number, ids?: string[], label = host) {
      const seeded = !ids && primitiveDefaultsApplied(replica, at, `device:${host}`)
      const chosen = declarations.filter(value => !ids || ids.includes(value.id))
      if (!seeded) replica = registerPrimitives(replica, at, host, chosen, now, label)
      else restorePrimitives(replica, at, host, chosen)
      if (ids) return replica
      replica = markPrimitiveDefaultsApplied(replica, at, `device:${host}`, now)
      // Primitives added after a device was first seeded are published once each, under their own mark.
      for (const added of ['device:allocate']) {
        const declaration = declarations.find(value => value.id === added)!
        if (seeded && !primitiveDefaultsApplied(replica, at, `device:${host}:${added}`)) replica = registerPrimitives(replica, at, host, [declaration], now, label)
        replica = markPrimitiveDefaultsApplied(replica, at, `device:${host}:${added}`, now)
      }
      return replica
    },
    executors(replica: Replica, step: EvaluationStep, host: string) {
      // Refresh/load adapters may replace the store. Restore local meanings without publishing any refs.
      restorePrimitives(replica, step.path, host, declarations)
      // A row of a bare pattern (a fetch row's url input: a string with no data of its own) is an operand the primitive
      // compiles, not a step of its own; every other row matches by its left as usual.
      const left = step.row?.typeCid ?? step.row?.type, node = left && replica.store.table.has(left) ? content(replica.store, left) : null
      if (node && !Object.keys(node.data).length && !isRefNode(replica.store, node) && !instructionPrimitives(replica, step).length) return []
      return stepExecutors(replica, step, host)
    }
  }
}
