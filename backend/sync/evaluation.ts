/** Owner-initiated and scheduled evaluation share the same graph evaluator and user-store lock. */
import type { Request, Response } from 'express'
import { recoverEvaluation, addRow, addSupply, capabilityPeers, createReplica, evaluateNode, headCid, put, resolveScope, runNodeTriggers, selectBranch, valueContent, type EvaluationStep, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type PeerSyncDeps } from './peerSync'

type Effects = {
  githubConnected(userId: number): Promise<boolean>
  createIssue(userId: number, input: { repo: string; title: string }): Promise<{ url: string; number: number }>
}
export function createEvaluationService(deps: PeerSyncDeps, effects: Effects) {
  async function run(username: string, request?: { path: Scope; branches: Record<string, string>; expected: string; action?: 'recover' }) {
    return withUserLock(`user:${username}`, async () => {
      const loaded = await deps.loadStore(username)
      if (!loaded) throw new Error('Account unavailable.')
      const { user } = loaded
      let r = createReplica(`user:${username}`, loaded.store)
      const now = () => deps.now?.() ?? Date.now()
      const active = await effects.githubConnected(user.id)
      if (request) for (const [id, name] of Object.entries(request.branches)) selectBranch(r.store, id, name)
      const save = async (next: typeof r) => { r = next; await deps.saveStore(user, r.store); deps.notify?.(user.id, { type: 'sync_changed', by: 'fos:evaluation' }) }
      const evaluate = async (path: Scope) => {
        const handles = (step: EvaluationStep) => step.row?.requirement?.capability === 'repo'
        const result = await evaluateNode(path, {
          get: () => r, save, now, handles,
          isPeerActive: peer => peer === 'fos' || (peer === 'integration:github' && active),
          check: step => handles(step) && (!active || !capabilityPeers(r, step.path, 'repo').includes('integration:github')) ? ['GitHub is not active in this context.'] : [],
          effect: async step => {
            if (!await effects.githubConnected(user.id)) throw new Error('GitHub disconnected before the effect.')
            const requirement = step.row!.requirement!
            if (!requirement.repo) throw new Error('Specify the GitHub repository first.')
            const issue = await effects.createIssue(user.id, { repo: requirement.repo, title: step.row!.title || 'from fos' })
            r = addRow(r, step.path, 'plain', `${requirement.repo}#${issue.number} ${issue.url}`, now())
            r = addSupply(r, step.path.slice(0, -1), step.path.at(-1)!, { capability: 'repo', by: 'integration:github', ref: String(issue.number) }, now())
            await save(r)
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
      await runNodeTriggers({ get: () => r, save, now, available: (peer, kind, path) => peer === 'fos' && kind === 'cron' && capabilityPeers(r, path, 'cron').includes('fos'), evaluate: async path => { await evaluate(path) } })
      return null
    })
  }
  return {
    runNode: (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => run(username, request),
    runCron: (username: string) => run(username),
    async handler(req: Request, res: Response) {
      const claims = (req as unknown as { claims?: { username?: string; kind?: string } }).claims
      if (!claims?.username || claims.kind === 'peer') return res.status(403).json({ error: 'An account owner must initiate evaluation.' })
      const { path, branches = {}, expected, action } = req.body ?? {}
      if ((action !== undefined && action !== 'recover') || !Array.isArray(path) || path.length > 64 || path.some(id => typeof id !== 'string' || id.length > 256) || typeof expected !== 'string' || !branches || typeof branches !== 'object' || Array.isArray(branches) || Object.entries(branches).length > 64 || Object.entries(branches).some(([id, name]) => id.length > 256 || typeof name !== 'string' || name.length > 256)) return res.status(400).json({ error: 'Invalid evaluation request.' })
      try { return res.json({ evaluation: await run(claims.username, { path, branches, expected, action }) }) }
      catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : String(error) }) }
    }
  }
}
