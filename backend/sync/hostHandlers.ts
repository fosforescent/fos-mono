/**
 * The handlers this backend registers (see registry.ts). Each entry is a capability a peer provides on this host;
 * entries with an `effect` execute requirements through the shared evaluator when a `complete` event reaches them,
 * the rest are services reached by their own routes and are only advertised.
 */
import { addRow, addSupply, beginTaskWork, proposeTaskResult, taskWorkContext, type ResourceType } from '@fosforescent/shared/sync/index'
import type { HostHandler } from './registry'

export type GitHubIssueDeps = {
  connected(userId: number): Promise<boolean>
  createIssue(userId: number, input: { repo: string; title: string; body?: string }): Promise<{ url: string; number: number }>
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
      const task = ctx.step.path.length > 1 ? ctx.step.path.at(-2) : null
      const issue = await deps.createIssue(ctx.userId, { repo: requirement.repo, title: ctx.step.row!.title || 'from fos', ...(task ? { body: 'From a fos task.' } : {}) })
      let r = ctx.replica()
      r = addRow(r, ctx.step.path, 'plain', `${requirement.repo}#${issue.number} ${issue.url}`, ctx.now())
      r = addSupply(r, ctx.step.path.slice(0, -1), ctx.step.path.at(-1)!, { capability: 'repo', by: 'integration:github', ref: String(issue.number) }, ctx.now())
      await ctx.update(r)
    }
  }
}

export type CalendarDeps = {
  connected(userId: number): Promise<boolean>
  createEvent(userId: number, event: { summary: string; description?: string; start: number; end: number }): Promise<{ url: string | null; id: string }>
}

/**
 * A time (or person) allocation requirement with a window: an event on the account's Google Calendar for that
 * window, and the allocation row that fills the requirement.
 */
export function calendarHandler(deps: CalendarDeps): HostHandler {
  return {
    peerId: 'integration:google', capability: 'calendar',
    handles: step => { const r = step.row?.requirement; return !!r && r.capability === 'allocation' && (r.resource === 'calendar' || r.resource === 'person') && r.start !== undefined },
    available: userId => deps.connected(userId),
    async effect(ctx) {
      if (!await deps.connected(ctx.userId)) throw new Error('Google disconnected before the effect.')
      const req = ctx.step.row!, r = req.requirement!
      const start = r.start!, end = r.end ?? start + Math.round((r.amount ?? 1) * 3_600_000)
      const task = ctx.step.path.length > 1 ? null : null
      const event = await deps.createEvent(ctx.userId, { summary: req.title || 'fos', description: req.title, start, end })
      const allocation = { resource: '', type: r.resource as ResourceType, amount: r.amount ?? (end - start) / 3_600_000, unit: 'h', start, end, ...(r.peer ? { person: r.peer } : {}) }
      void task
      await ctx.update(addRow(ctx.replica(), ctx.step.path, 'allocation', event.url ? `on Google Calendar ${event.url}` : 'on Google Calendar', ctx.now(), { allocation }))
    }
  }
}

export type LlmDeps = { complete(system: string, user: string): Promise<string> }

/**
 * `-llm` requirements: the server's own model. The attempt is pinned in the graph (prompt, system, sources) before
 * the call; the answer is a proposal on the attempt's return ref, so the evaluation pauses for the owner's review
 * (`awaiting-review`). Accepting the result (`decideTaskResult`) supplies the requirement; a later `complete`
 * commits.
 */
export function llmHandler(deps: LlmDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'llm',
    async effect(ctx) {
      const path = ctx.step.path
      const preview = taskWorkContext(ctx.replica(), path)
      if (preview.prompt.length > 20_000) throw new Error('The task context exceeds 20,000 characters; narrow it before asking the model.')
      const run = beginTaskWork(ctx.replica(), path, preview, ctx.now())
      await ctx.update(run.replica) // the attempt is recorded before the model is asked
      const text = (await deps.complete(run.system, run.prompt)).trim()
      await ctx.update(proposeTaskResult(ctx.replica(), run.resultPath, text, ctx.now()))
      return 'pending'
    }
  }
}

export type HostHandlerDeps = {
  github: GitHubIssueDeps
  google: CalendarDeps
  llm: LlmDeps
  /** Attached MCP servers run `-tool` requirements (integrations/mcpPeers.ts `mcpToolHandler`). */
  tool?: HostHandler
  /** Is the account connected to the provider (`phone`)? */
  connected(userId: number, provider: string): Promise<boolean>
  /** The server has an SMS adapter configured. */
  sms: boolean
  /** The cron runner is enabled on this instance (FOS_ENABLE_CRON). */
  cron: boolean
}

export function createHostHandlers(deps: HostHandlerDeps): HostHandler[] {
  return [
    // the server's own services: the row search index and market (search/routes.ts) and polls on shared nodes (sync/sharing.ts)
    { peerId: 'fos', capability: 'search' },
    { peerId: 'fos', capability: 'market' },
    { peerId: 'fos', capability: 'poll' },
    llmHandler(deps.llm),
    ...(deps.cron ? [{ peerId: 'fos', capability: 'cron' as const }] : []),
    githubRepoHandler(deps.github),
    calendarHandler(deps.google),
    ...(deps.tool ? [deps.tool] : []),
    ...(deps.sms ? [{ peerId: 'integration:phone', capability: 'notify' as const, available: (id: number) => deps.connected(id, 'phone') }] : [])
  ]
}
