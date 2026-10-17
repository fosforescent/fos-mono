/**
 * The handlers this backend registers (see registry.ts). Each entry is a capability a peer provides on this host;
 * entries with an `effect` execute requirements through the shared evaluator when a `complete` event reaches them,
 * the rest are services reached by their own routes and are only advertised.
 */
import { createHash } from 'node:crypto'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { addRow, addSupply, beginTaskWork, proposeTaskResult, readNodeValue, setMarketAt, sharedProjection, sharing, taskWorkContext, view, type EvaluationStep, type Replica, type ResourceType } from '@fosforescent/shared/sync/index'
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

export type MarketDeps = {
  /** Index the account's rows now, so the listing is searchable by other accounts before it is recorded as supplied. */
  index(user: { id: number; username: string }, store: FosStore): Promise<void>
  /**
   * The market trigger: deliver the listing as a request to the accounts whose published capabilities match it
   * (search/rowIndex.ts `matchOffers`), the way an invite is delivered. Returns the usernames reached.
   */
  notifyProviders?(listing: { user: { id: number; username: string }; aliasId: string; title: string; text: string }): Promise<string[]>
}

/**
 * `-market` requirements under a task: the server lists the task (the `listing` flag on its ref node), indexes the
 * account so other accounts find it, and only then records the supply as its own. The client never writes a supply
 * in the server's name.
 */
export function marketHandler(deps: MarketDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'market',
    async effect(ctx) {
      const path = ctx.step.path
      if (path.length < 2) throw new Error('Market requirements go under a task; the task is what gets listed.')
      const taskPath = path.slice(0, -1)
      const user = { id: ctx.userId, username: ctx.username }
      await ctx.update(setMarketAt(ctx.replica(), taskPath, true, ctx.now(), ctx.username))
      await deps.index(user, ctx.replica().store)
      // what the listing asks for: the task's title and its rows (requirements included), the text providers matched against
      const task = view(ctx.replica(), taskPath.slice(0, -1))?.tasks.find(t => t.id === taskPath.at(-1))
      const text = [task?.title ?? '', ...(view(ctx.replica(), taskPath)?.tasks ?? []).filter(t => t.id !== path.at(-1)).map(t => t.title)].filter(Boolean).join('\n').slice(0, 2000)
      const providers = deps.notifyProviders && task ? await deps.notifyProviders({ user, aliasId: task.id, title: task.title, text }) : []
      let r = ctx.replica()
      if (providers.length) r = addRow(r, path, 'plain', `Offered to ${providers.map(p => `@${p}`).join(', ')}`, ctx.now())
      await ctx.update(addSupply(r, taskPath, path.at(-1)!, { capability: 'market', by: 'fos', ref: taskPath.at(-1)! }, ctx.now()))
    }
  }
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
/** A `choice` requirement with a poll configured on it (`fos:poll`, sync/sharing.ts `configurePoll`). */
export const pollConfigured = (step: EvaluationStep, r: Replica) => step.row?.requirement?.capability === 'choice' && !!readNodeValue(r, step.path, 'fos:poll')

/**
 * Polls as the choice handler: a `choice` requirement with a poll configured is resolved by the tally when the node
 * runs. Rank polls take the top Borda score, approval polls the most approvals; a tie blocks until more responses
 * come in or the owner decides by hand. Approvals on pending submissions stay what they are, input the owner sees
 * when deciding them.
 */
export function pollHandler(): HostHandler {
  return {
    peerId: 'fos', capability: 'poll',
    handles: pollConfigured,
    async effect(ctx) {
      const r = ctx.replica(), path = ctx.step.path
      if (!sharing(r, path)?.enabled) throw new Error('Publish this choice as a poll first (its share link is off).')
      const node = sharedProjection(r, path, digest)
      if (!node.poll) throw new Error('No poll is configured on this choice.')
      if (!node.participants) throw new Error('No poll responses yet.')
      const scores = node.options.map((option, index) => ({ index, label: option.label, score: (node.poll!.mode === 'rank' ? node.rankings : node.counts)[option.id] ?? 0 }))
      const best = Math.max(...scores.map(s => s.score))
      if (best <= 0) throw new Error('No poll responses yet.')
      const winners = scores.filter(s => s.score === best)
      if (winners.length > 1) throw new Error(`The poll is tied between ${winners.map(w => `“${w.label}”`).join(' and ')}; wait for more responses or decide by hand.`)
      await ctx.update(addSupply(r, path.slice(0, -1), path.at(-1)!, { capability: 'choice', by: 'fos', choice: winners[0]!.index }, ctx.now()))
    }
  }
}

export type PointsDeps = {
  /** Move fos points between accounts on the server's ledger; throws when the payer cannot cover it or the payee is unknown. */
  transfer(from: { id: number; username: string }, toUsername: string, amount: number, memo: string): Promise<void>
}

/**
 * A fos-points requirement (`ff 5 reward`) under a task is a payout: when the task runs, the server moves that many
 * points from the owner's balance to the respondent (the signed-in user whose supplies filled the task's other
 * requirements, or the user the requirement names with @) and records the allocation and supply as its own.
 */
export function pointsHandler(deps: PointsDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'points',
    handles: step => { const r = step.row?.requirement; return !!r && r.capability === 'allocation' && r.resource === 'points' },
    async effect(ctx) {
      const r = ctx.replica(), path = ctx.step.path, req = ctx.step.row!.requirement!
      const amount = req.amount ?? 0
      if (!(amount > 0)) throw new Error('Name an amount of fos points to pay.')
      if (path.length < 2) throw new Error('A fos-points payout goes under the task it rewards.')
      const taskPath = path.slice(0, -1), self = `user:${ctx.username}`
      let recipient = req.peer
      if (!recipient) {
        const suppliers = new Set<string>()
        for (const row of view(r, taskPath)?.tasks ?? []) if (row.kind === 'requirement' && row.id !== path.at(-1)) for (const supply of view(r, [...taskPath, row.id])?.tasks ?? []) if (supply.supply?.by) suppliers.add(supply.supply.by)
        const people = [...suppliers].filter(p => p !== self && p !== 'fos')
        if (people.some(p => p.startsWith('visitor:'))) throw new Error('Fos points go to signed-in Fos users; this respondent is anonymous.')
        const users = people.filter(p => p.startsWith('user:')).map(p => p.slice('user:'.length))
        if (!users.length) throw new Error('No one to pay yet: the other requirements of this task have no respondent.')
        if (users.length > 1) throw new Error(`Several users answered (${users.map(u => `@${u}`).join(', ')}); name the recipient with @name on the points row.`)
        recipient = users[0]!
      }
      if (recipient === ctx.username) throw new Error('The owner cannot pay themselves.')
      const memo = `${ctx.step.row!.title || 'fos points'} (${taskPath.join('/')})`
      await deps.transfer({ id: ctx.userId, username: ctx.username }, recipient, amount, memo)
      const id = `points:${ctx.now().toString(36)}`
      let next = addRow(ctx.replica(), path, 'allocation', `${amount} fos points to @${recipient}`, ctx.now(), { id, allocation: { resource: 'fos:points', type: 'points', amount, unit: 'ff', by: 'fos', person: recipient } })
      next = addSupply(next, taskPath, path.at(-1)!, { capability: 'allocation', by: 'fos', ref: id }, ctx.now())
      await ctx.update(next)
    }
  }
}

export type HostHandlerDeps = {
  github: GitHubIssueDeps
  google: CalendarDeps
  llm: LlmDeps
  market: MarketDeps
  points: PointsDeps
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
    // the server's own services: the row search index (search/routes.ts) is a route; market listing, polls and
    // fos points run as effects
    { peerId: 'fos', capability: 'search' },
    marketHandler(deps.market),
    pollHandler(),
    pointsHandler(deps.points),
    llmHandler(deps.llm),
    ...(deps.cron ? [{ peerId: 'fos', capability: 'cron' as const }] : []),
    githubRepoHandler(deps.github),
    calendarHandler(deps.google),
    ...(deps.tool ? [deps.tool] : []),
    ...(deps.sms ? [{ peerId: 'integration:phone', capability: 'notify' as const, available: (id: number) => deps.connected(id, 'phone') }] : [])
  ]
}
