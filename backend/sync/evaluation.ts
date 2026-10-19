/** Owner-initiated and scheduled evaluation share the same graph evaluator, user-store lock and handler registry. */
import { INTEGRATION_PEERS, evaluationRecord, recoverEvaluation, capabilityPeers, createReplica, evaluateNode, evaluationSteps, headCid, put, resolveScope, runNodeTriggers, selectBranch, valueContent, type EvaluationStep, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type AccountStoreDeps } from './accountStore'
import type { HandlerRegistry, HostHandler } from './registry'

const peerLabel = (peerId: string) => peerId === 'fos' ? 'Fos' : INTEGRATION_PEERS.find(p => `integration:${p.id}` === peerId)?.name ?? (peerId.startsWith('mcp:') ? 'An attached MCP server' : peerId)

export function createEvaluationService(deps: AccountStoreDeps, registry: HandlerRegistry) {
  async function run(username: string, request?: { path: Scope; branches: Record<string, string>; expected: string; action?: 'recover' | 'continue' }) {
    return withUserLock(`user:${username}`, async () => {
      const loaded = await deps.loadStore(username)
      if (!loaded) throw new Error('Account unavailable.')
      const { user } = loaded
      let r = createReplica(`user:${username}`, loaded.store)
      const now = () => deps.now?.() ?? Date.now()
      if (request) for (const [id, name] of Object.entries(request.branches)) selectBranch(r.store, id, name)
      const save = async (next: typeof r) => { r = next; await deps.saveStore(user, r.store); deps.notify?.(user.id, { type: 'sync_changed', by: 'fos:evaluation' }) }
      /** The peers that provide an executor's capability in this step's context. */
      const providers = (step: EvaluationStep, h: HostHandler) => capabilityPeers(r, step.path, h.capability).filter(p => registry.provides(h, p))
      const evaluate = async (path: Scope) => {
        // Live availability of every provider that could execute something below `path`, checked once per run.
        const active = new Map<string, boolean>()
        for (const step of evaluationSteps(r, path)) for (const h of registry.executors(step, r)) for (const p of providers(step, h)) if (!active.has(p)) active.set(p, await registry.active(p, user.id))
        const executorFor = (step: EvaluationStep): HostHandler | null => registry.executors(step, r).find(h => providers(step, h).some(p => active.get(p))) ?? null
        // An interrupted run is reviewed before anything new is bound or called (the evaluator checks this too).
        const prior = evaluationRecord(r, path)
        if (prior && !['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(prior.status)) throw new Error('This evaluation needs recovery. Review its effects before running again.')
        // Handlers bind what they need before the evaluator pins instructions; the return slots they name are theirs to fill.
        const outputs = new Map<string, string[]>()
        for (const step of evaluationSteps(r, path)) {
          const handler = executorFor(step)
          if (!handler?.prepare || step.row?.requirement?.satisfied) continue
          const prepared = await handler.prepare({ userId: user.id, username: user.username, step, replica: () => r, update: save, now })
          if (prepared?.outputs?.length) outputs.set(JSON.stringify(step.path), prepared.outputs)
        }
        const result = await evaluateNode(path, {
          get: () => r, save, now,
          // a return slot a handler fills is excluded from the change check of its step and of every step below it (whose context includes it)
          outputs: step => [...outputs.entries()].filter(([at]) => { const prefix = JSON.parse(at) as Scope; return prefix.length <= step.path.length && prefix.every((id, i) => step.path[i] === id) }).flatMap(([, ids]) => ids),
          handles: step => registry.executors(step, r).length > 0,
          isPeerActive: peer => peer === 'fos' || active.get(peer) === true,
          check: step => registry.executors(step, r).length && !executorFor(step) ? [`${[...new Set(registry.executors(step, r).map(h => peerLabel(h.peerId)))].join(' or ')} is not active in this context.`] : [],
          effect: async step => {
            const handler = executorFor(step)
            if (!handler) throw new Error('No active handler for this requirement.')
            return handler.effect!({ userId: user.id, username: user.username, step, replica: () => r, update: save, now })
          }
        })
        if (result.status !== 'committed' && result.status !== 'awaiting-review') throw new Error(result.error ?? 'Evaluation needs recovery.')
        return result
      }
      if (request) {
        const cid = resolveScope(r.store, headCid(r), request.path)
        if (!cid) throw new Error('The node changed. Sync and review it before evaluating.')
        // a continuation (a payment confirmed) resumes whatever the node is now; owners' requests pin the version they saw
        if (request.action !== 'continue' && put(r.store, valueContent(r.store, cid)) !== request.expected) throw new Error('The node changed. Sync and review it before evaluating.')
        if (request.action === 'recover') { await save(recoverEvaluation(r, request.path, now())); return null }
        return evaluate(request.path)
      }
      await runNodeTriggers({ get: () => r, save, now, available: (peer, kind, path) => peer === 'fos' && kind === 'cron' && registry.offers('fos').includes('cron') && capabilityPeers(r, path, 'cron').includes('fos'), evaluate: async path => { await evaluate(path) } })
      return null
    })
  }
  return {
    runNode: (username: string, request: { path: Scope; branches: Record<string, string>; expected: string; recover?: boolean }) => run(username, { ...request, ...(request.recover ? { action: 'recover' as const } : {}) }),
    runCron: (username: string) => run(username),
    /** Resume an evaluation left awaiting review once the effect it waited on is settled (sync/payments.ts). */
    continueNode: (username: string, path: Scope) => run(username, { path, branches: {}, expected: '', action: 'continue' }),
  }
}
