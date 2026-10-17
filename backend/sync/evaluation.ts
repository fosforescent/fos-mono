/** Owner-initiated and scheduled evaluation share the same graph evaluator, user-store lock and handler registry. */
import { CAPABILITIES, INTEGRATION_PEERS, recoverEvaluation, capabilityPeers, createReplica, evaluateNode, headCid, put, resolveScope, runNodeTriggers, selectBranch, valueContent, type Capability, type EvaluationStep, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type PeerSyncDeps } from './peerSync'
import type { HandlerRegistry, HostHandler } from './registry'

const peerLabel = (peerId: string) => peerId === 'fos' ? 'Fos' : INTEGRATION_PEERS.find(p => `integration:${p.id}` === peerId)?.name ?? peerId

export function createEvaluationService(deps: PeerSyncDeps, registry: HandlerRegistry) {
  async function run(username: string, request?: { path: Scope; branches: Record<string, string>; expected: string; action?: 'recover' }) {
    return withUserLock(`user:${username}`, async () => {
      const loaded = await deps.loadStore(username)
      if (!loaded) throw new Error('Account unavailable.')
      const { user } = loaded
      let r = createReplica(`user:${username}`, loaded.store)
      const now = () => deps.now?.() ?? Date.now()
      // Live availability of every peer that can execute something, checked once per run.
      const active = new Map<string, boolean>()
      for (const peerId of new Set(registry.handlers.filter(h => h.effect).map(h => h.peerId))) active.set(peerId, await registry.active(peerId, user.id))
      if (request) for (const [id, name] of Object.entries(request.branches)) selectBranch(r.store, id, name)
      const save = async (next: typeof r) => { r = next; await deps.saveStore(user, r.store); deps.notify?.(user.id, { type: 'sync_changed', by: 'fos:evaluation' }) }
      /** Requirement kinds that are host capabilities (`repo`, `llm`, …); confirmations, choices and allocations are filled by people. */
      const capabilityOf = (step: EvaluationStep): Capability | null => { const kind = step.row?.requirement?.capability; return kind && (CAPABILITIES as string[]).includes(kind) ? kind as Capability : null }
      const executors = (step: EvaluationStep): HostHandler[] => { const cap = capabilityOf(step); return cap ? registry.executors(cap) : [] }
      /** The executor whose peer provides the capability in this context and is active now. */
      const executorFor = (step: EvaluationStep): HostHandler | null => {
        const peers = capabilityPeers(r, step.path, capabilityOf(step)!)
        return executors(step).find(h => peers.includes(h.peerId) && active.get(h.peerId)) ?? null
      }
      const evaluate = async (path: Scope) => {
        const result = await evaluateNode(path, {
          get: () => r, save, now,
          handles: step => executors(step).length > 0,
          isPeerActive: peer => peer === 'fos' || active.get(peer) === true,
          check: step => executors(step).length && !executorFor(step) ? [`${executors(step).map(h => peerLabel(h.peerId)).join(' or ')} is not active in this context.`] : [],
          effect: async step => {
            const handler = executorFor(step)
            if (!handler) throw new Error('No active handler for this requirement.')
            await handler.effect!({ userId: user.id, step, replica: () => r, update: save, now })
          }
        })
        if (result.status !== 'committed') throw new Error(result.error ?? 'Evaluation needs recovery.')
        return result
      }
      if (request) {
        const cid = resolveScope(r.store, headCid(r), request.path)
        if (!cid || put(r.store, valueContent(r.store, cid)) !== request.expected) throw new Error('The node changed. Sync and review it before evaluating.')
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
  }
}
