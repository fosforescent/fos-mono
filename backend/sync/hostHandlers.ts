/**
 * The handlers this backend registers (see registry.ts). Each entry is a capability a peer provides on this host;
 * entries with an `effect` execute requirements through the shared evaluator when a `complete` event reaches them,
 * the rest (cron, notify) are only advertised.
 */
import { createHash } from 'node:crypto'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { addRef, addRow, addSupply, beginTaskWork, deleteTask, headCid, resolveRef, resolveScope, rowsOfType, valueContent, paymentRecord, settlePaymentRecord, writePaymentRecord, proposeTaskResult, readNodeValue, setMarketAt, sharedProjection, sharing, taskWorkContext, view, type EvaluationStep, type Replica, type ResourceType } from '@fosforescent/shared/sync/index'
import type { EffectContext, HostHandler } from './registry'
import { formTitle } from '@fosforescent/shared/sync/forms'

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
}

/**
 * `-market` requirements under a task: the server lists the task (the market peer becomes its member), indexes the
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
      await ctx.update(setMarketAt(ctx.replica(), taskPath, true, ctx.now()))
      await deps.index({ id: ctx.userId, username: ctx.username }, ctx.replica().store)
      await ctx.update(addSupply(ctx.replica(), taskPath, path.at(-1)!, { capability: 'market', by: 'fos', ref: taskPath.at(-1)! }, ctx.now()))
    }
  }
}

export type SearchHit = { aliasId: string; title: string; owner: string | null }
export type SearchDeps = {
  /** Semantic search (search/rowIndex.ts `searchRows`): the account's own rows, plus rows the market lists when `market`. */
  search(user: { id: number; username: string }, query: string, market: boolean): Promise<SearchHit[]>
}

/**
 * `-? text` requirements: the server's row search. The query is the requirement's text, or a query row inside it
 * (its `market` option widens it to listed rows). Hits replace the earlier reference rows under the requirement
 * (own rows as references, other accounts' as refs that remember the owner) and the supply is recorded as `fos`.
 */
export function searchHandler(deps: SearchDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'search',
    async effect(ctx) {
      const path = ctx.step.path, r = ctx.replica(), cid = resolveScope(r.store, headCid(r), path)!
      // which rows inside are what is decided by their row types: a query row says what to look for, refs are earlier hits
      const queryRow = rowsOfType(r.store, cid, 'query')[0]
      const query = queryRow ? { id: queryRow.id, title: formTitle(r.store, valueContent(r.store, queryRow.cid)), market: !!valueContent(r.store, queryRow.cid).data.query?.market } : null
      const text = (query?.title || ctx.step.row!.title).trim().slice(0, 1000)
      if (!text) throw new Error('Say what to search for: "-? text".')
      const hits = await deps.search({ id: ctx.userId, username: ctx.username }, text, !!query?.market)
      let next = ctx.replica()
      for (const ref of rowsOfType(r.store, cid, 'ref')) next = deleteTask(next, path, ref.id, ctx.now())
      for (const hit of hits) {
        if (hit.aliasId === path.at(-1) || hit.aliasId === query?.id) continue
        if (!hit.owner) { if (resolveRef(next, hit.aliasId)) next = addRef(next, path, hit.aliasId, ctx.now()) }
        else next = addRow(next, path, 'ref', hit.title, ctx.now(), { refId: hit.aliasId, refOwner: hit.owner })
      }
      next = addSupply(next, path.slice(0, -1), path.at(-1)!, { capability: 'search', by: 'fos', ref: query?.id ?? path.at(-1)! }, ctx.now())
      await ctx.update(next)
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
  /**
   * Move fos points between accounts on the server's ledger; throws when the payer cannot cover it or the payee is
   * unknown. `key` identifies the payout (one per requirement): a transfer already recorded under it is not repeated.
   */
  transfer(from: { id: number; username: string }, toUsername: string, amount: number, memo: string, key: string): Promise<void>
}

/**
 * Who a task pays: the user the requirement names with @, else the one signed-in user whose supplies filled the
 * task's other requirements. Anonymous respondents, several respondents and the owner themselves are refused.
 */
function payeeOf(ctx: EffectContext, unit: string): string {
  const r = ctx.replica(), path = ctx.step.path, req = ctx.step.row!.requirement!
  if (path.length < 2) throw new Error(`A ${unit} payment goes under the task it rewards.`)
  const taskPath = path.slice(0, -1), self = `user:${ctx.username}`
  let recipient = req.peer
  if (!recipient) {
    const suppliers = new Set<string>()
    for (const row of view(r, taskPath)?.tasks ?? []) if (row.kind === 'requirement' && row.id !== path.at(-1)) for (const supply of view(r, [...taskPath, row.id])?.tasks ?? []) if (supply.supply?.by) suppliers.add(supply.supply.by)
    const people = [...suppliers].filter(p => p !== self && p !== 'fos')
    if (people.some(p => p.startsWith('visitor:'))) throw new Error(`${unit[0]!.toUpperCase()}${unit.slice(1)} go to signed-in Fos users; this respondent is anonymous.`)
    const users = people.filter(p => p.startsWith('user:')).map(p => p.slice('user:'.length))
    if (!users.length) throw new Error('No one to pay yet: the other requirements of this task have no respondent.')
    if (users.length > 1) throw new Error(`Several users answered (${users.map(u => `@${u}`).join(', ')}); name the recipient with @name on the ${unit} row.`)
    recipient = users[0]!
  }
  if (recipient === ctx.username) throw new Error('The owner cannot pay themselves.')
  return recipient
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
      const path = ctx.step.path, req = ctx.step.row!.requirement!
      const amount = req.amount ?? 0
      if (!(amount > 0)) throw new Error('Name an amount of fos points to pay.')
      const taskPath = path.slice(0, -1), recipient = payeeOf(ctx, 'fos points')
      const memo = `${ctx.step.row!.title || 'fos points'} (${taskPath.join('/')})`
      await deps.transfer({ id: ctx.userId, username: ctx.username }, recipient, amount, memo, `points:${ctx.username}:${path.join('/')}`)
      const id = `points:${ctx.now().toString(36)}`
      let next = addRow(ctx.replica(), path, 'allocation', `${amount} fos points to @${recipient}`, ctx.now(), { id, allocation: { resource: 'fos:points', type: 'points', amount, unit: 'ff', by: 'fos', person: recipient } })
      next = addSupply(next, taskPath, path.at(-1)!, { capability: 'allocation', by: 'fos', ref: id }, ctx.now())
      await ctx.update(next)
    }
  }
}

export type PaymentDeps = {
  /**
   * Open a payment from the owner to a Fos user with the account's payment provider. Returns the provider's id and,
   * when the payer has to complete it, the page to send them to; `status: 'paid'` means the provider charged a saved
   * method and the payment is already settled. Throws when the payee cannot receive payments yet.
   */
  request(input: { from: { id: number; username: string }; toUsername: string; amount: number; unit: string; memo: string; key: string; path: string[] }): Promise<{ id: string; url: string | null; status: 'pending' | 'paid'; intent?: string }>
}

/**
 * A money requirement (`-$ 20 reward`) under a task is a payment: when the task runs, the server opens one with the
 * payment provider from the owner to the respondent and leaves the evaluation awaiting review. The provider's
 * confirmation (its webhook, `sync/payments.ts`) settles the requirement and continues the evaluation, whether or
 * not the owner's devices are online. Running again while the payment is open does not open a second one.
 */
export function paymentHandler(deps: PaymentDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'send-payment',
    handles: step => { const r = step.row?.requirement; return !!r && r.capability === 'allocation' && r.resource === 'account' },
    async effect(ctx) {
      const path = ctx.step.path, req = ctx.step.row!.requirement!
      const amount = req.amount ?? 0, unit = (req.unit || 'usd').toLowerCase()
      if (!(amount > 0)) throw new Error('Name an amount to pay.')
      const existing = paymentRecord(ctx.replica(), path)
      if (existing?.status === 'paid') {
        // confirmed while nobody was running the evaluation: record the settlement now
        const settled = settlePaymentRecord(ctx.replica(), path, {}, ctx.now())
        if (settled.settled) await ctx.update(settled.replica)
        return
      }
      if (existing?.status === 'pending') return 'pending'
      const recipient = payeeOf(ctx, 'payments')
      const memo = `${ctx.step.row!.title || 'payment'} (${path.slice(0, -1).join('/')})`
      const opened = await deps.request({ from: { id: ctx.userId, username: ctx.username }, toUsername: recipient, amount, unit, memo, key: `payment:${ctx.username}:${path.join('/')}`, path })
      // recorded as open first; settlement (here when the provider charged a saved method, else the webhook) marks it paid
      let next = writePaymentRecord(ctx.replica(), path, { id: opened.id, url: opened.url, status: 'pending', amount, unit, payer: ctx.username, payee: recipient, created: ctx.now(), ...(opened.intent ? { intent: opened.intent } : {}) }, ctx.now())
      if (opened.status === 'paid') next = settlePaymentRecord(next, path, { intent: opened.intent }, ctx.now()).replica
      await ctx.update(next)
      return opened.status === 'paid' ? undefined : 'pending'
    }
  }
}

export type MailDeps = { send(to: string, subject: string, text: string, onBehalfOf: string): Promise<void> }

/** `-mail someone@example.com Subject…` under a task: the recipient is the first address in the row, the subject the rest of it (else the task's title), the body the task and its rows. */
export function mailRequest(rowTitle: string, taskTitle: string, rows: string[]): { to: string; subject: string; text: string } | null {
  const match = rowTitle.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/)
  if (!match) return null
  const subject = rowTitle.replace(match[0], '').replace(/^[\s:,-]+|[\s:,-]+$/g, '').trim() || taskTitle || 'From Fosforescent'
  const text = [taskTitle, ...rows.filter(Boolean).map(r => `- ${r}`)].filter(Boolean).join('\n').slice(0, 20_000)
  return { to: match[0], subject: subject.slice(0, 200), text }
}

/** `-mail` requirements: the account server sends the email (Postmark) on the user's behalf and records the supply as `fos`. */
export function mailHandler(deps: MailDeps): HostHandler {
  return {
    peerId: 'fos', capability: 'mail',
    async effect(ctx) {
      const r = ctx.replica(), path = ctx.step.path, taskPath = path.slice(0, -1)
      const task = taskPath.length ? view(r, taskPath.slice(0, -1))?.tasks.find(t => t.id === taskPath.at(-1)) : null
      const rows = (view(r, taskPath)?.tasks ?? []).filter(t => t.id !== path.at(-1) && t.kind !== 'supply').map(t => t.title)
      const request = mailRequest(ctx.step.row!.title, task?.title ?? '', rows)
      if (!request) throw new Error('Name the recipient: "-mail someone@example.com Subject".')
      await deps.send(request.to, request.subject, request.text, ctx.username)
      let next = addRow(ctx.replica(), path, 'plain', `Sent to ${request.to}: ${request.subject}`, ctx.now())
      next = addSupply(next, taskPath, path.at(-1)!, { capability: 'mail', by: 'fos' }, ctx.now())
      await ctx.update(next)
    }
  }
}

export type HostHandlerDeps = {
  github: GitHubIssueDeps
  google: CalendarDeps
  llm: LlmDeps
  market: MarketDeps
  search: SearchDeps
  points: PointsDeps
  /** Money payments through the account's payment provider (payments/stripe.ts); absent when none is configured. */
  payments?: PaymentDeps
  mail: MailDeps
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
    // the server's own services, all effects: row search, market listing, polls, fos points, …
    searchHandler(deps.search),
    marketHandler(deps.market),
    pollHandler(),
    pointsHandler(deps.points),
    ...(deps.payments ? [paymentHandler(deps.payments)] : []),
    mailHandler(deps.mail),
    llmHandler(deps.llm),
    ...(deps.cron ? [{ peerId: 'fos', capability: 'cron' as const }] : []),
    githubRepoHandler(deps.github),
    calendarHandler(deps.google),
    ...(deps.tool ? [deps.tool] : []),
    ...(deps.sms ? [{ peerId: 'integration:phone', capability: 'notify' as const, available: (id: number) => deps.connected(id, 'phone') }] : [])
  ]
}
