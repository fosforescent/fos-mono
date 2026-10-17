/**
 * The handlers this backend registers (see registry.ts). Each entry is a capability a peer provides on this host;
 * entries with an `effect` execute requirements through the shared evaluator, the rest are services reached by
 * their own routes and are only advertised.
 */
import { addRow, addSupply } from '@fosforescent/shared/sync/index'
import type { HostHandler } from './registry'

export type GitHubIssueDeps = {
  connected(userId: number): Promise<boolean>
  createIssue(userId: number, input: { repo: string; title: string }): Promise<{ url: string; number: number }>
}

/** `-repo` requirements: open a GitHub issue through the account's OAuth connection and record it as the supply. */
export function githubRepoHandler(deps: GitHubIssueDeps): HostHandler {
  return {
    peerId: 'integration:github', capability: 'repo',
    available: userId => deps.connected(userId),
    async effect(ctx) {
      if (!await deps.connected(ctx.userId)) throw new Error('GitHub disconnected before the effect.')
      const requirement = ctx.step.row!.requirement!
      if (!requirement.repo) throw new Error('Specify the GitHub repository first.')
      const issue = await deps.createIssue(ctx.userId, { repo: requirement.repo, title: ctx.step.row!.title || 'from fos' })
      let r = ctx.replica()
      r = addRow(r, ctx.step.path, 'plain', `${requirement.repo}#${issue.number} ${issue.url}`, ctx.now())
      r = addSupply(r, ctx.step.path.slice(0, -1), ctx.step.path.at(-1)!, { capability: 'repo', by: 'integration:github', ref: String(issue.number) }, ctx.now())
      await ctx.update(r)
    }
  }
}

export type HostHandlerDeps = {
  github: GitHubIssueDeps
  /** Is the account connected to the provider (`google`, `phone`)? */
  connected(userId: number, provider: string): Promise<boolean>
  /** The server has an SMS adapter configured. */
  sms: boolean
  /** The cron runner is enabled on this instance (FOS_ENABLE_CRON). */
  cron: boolean
}

export function createHostHandlers(deps: HostHandlerDeps): HostHandler[] {
  return [
    // the server's own services: the row search index and market (search/routes.ts), its language model
    // (integrations/routes.ts `llm`) and polls on shared nodes (sync/sharing.ts)
    { peerId: 'fos', capability: 'search' },
    { peerId: 'fos', capability: 'market' },
    { peerId: 'fos', capability: 'llm' },
    { peerId: 'fos', capability: 'poll' },
    ...(deps.cron ? [{ peerId: 'fos', capability: 'cron' as const }] : []),
    githubRepoHandler(deps.github),
    { peerId: 'integration:google', capability: 'calendar', available: id => deps.connected(id, 'google') },
    ...(deps.sms ? [{ peerId: 'integration:phone', capability: 'notify' as const, available: (id: number) => deps.connected(id, 'phone') }] : [])
  ]
}
