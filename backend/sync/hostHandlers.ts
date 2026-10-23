import { requirementInput } from '@fosforescent/shared/sync/index'
import { QUERY_TYPE } from '@fosforescent/shared/sync/index'
import { standardHostRef } from './host-runtime'
import { cronObserver } from '@fosforescent/shared/sync/trigger-primitives'
/**
 * The handlers this backend registers (see runtime.ts). Each entry is a capability a peer provides on this host;
 * entries with an `effect` execute requirements through the shared evaluator when a `complete` event reaches them,
 * the rest (cron, notify) are only advertised.
 */
import { createHash } from 'node:crypto'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { addRef, addRow, addSupply, beginTaskWork, deleteTask, headCid, resolveRef, resolveScope, rowsOfType, valueContent, paymentRecord, settlePaymentRecord, writePaymentRecord, proposeTaskResult, readNodeValue, relayAfterSubmission, setMarketAt, sharedProjection, publication, taskWorkContext, view, type EvaluationStep, type Replica, type ResourceType, type UserRecord } from '@fosforescent/shared/sync/index'
import { TITLE_SYSTEM, writePageBase, memberEntryId, SERVER_MEMBER, titleRequestAt, truncateTitle, writeHandlerResult } from '@fosforescent/shared/sync/index'
import type { EffectContext, HostHandler } from './host-runtime'
import { formTitle } from '@fosforescent/shared/sync/forms'
import type { VerifyHandler } from './verify'
import { PLAIN_TYPE, REF_TYPE, ALLOCATION_TYPE } from '@fosforescent/shared/sync/library-types'
import { MONEY_TYPE } from '@fosforescent/shared/sync/library-types'

export type GitHubIssueDeps = {
  connected(userId: number): Promise<boolean>
  createIssue(userId: number, input: { repo: string; title: string; body?: string }): Promise<{ url: string; number: number }>
}

/** `-repo` requirements: open a GitHub issue through the account's OAuth connection and record it as the supply. */
export function githubRepoHandler(deps: GitHubIssueDeps): HostHandler {
  return {
    peerId: 'integration:github', ref: standardHostRef('integration:github', 'repo'),
    available: userId => deps.connected(userId),
    async effect(ctx) {
      if (!await deps.connected(ctx.userId)) throw new Error('GitHub disconnected before the effect.')
      const requirement = ctx.step.row!.requirement!
      if (!requirement.repo) throw new Error('Specify the GitHub repository first.')
      const task = ctx.step.path.length > 1 ? ctx.step.path.at(-2) : null
      const issue = await deps.createIssue(ctx.userId, { repo: requirement.repo, title: ctx.step.row!.title || 'from fos', ...(task ? { body: 'From a fos task.' } : {}) })
      let r = ctx.replica()
      r = addRow(r, ctx.step.path, PLAIN_TYPE, `${requirement.repo}#${issue.number} ${issue.url}`, ctx.now())
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
    peerId: 'integration:google', ref: standardHostRef('integration:google', 'calendar'),
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
      await ctx.update(addRow(ctx.replica(), ctx.step.path, ALLOCATION_TYPE, event.url ? `on Google Calendar ${event.url}` : 'on Google Calendar', ctx.now(), { allocation }))
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
    peerId: 'fos', ref: standardHostRef('fos', 'llm'),
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

/**
 * `title` requirements (shared/sync/title-request.ts): a short title for the text of the row the requirement is in,
 * from the server's model. The device's own handler truncates; this one summarizes. The title is the requirement's
 * its handler result; the asker sets it as the row's title and removes the request.
 */
export function titleHandler(deps: LlmDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'title'),
    async effect(ctx) {
      const path = ctx.step.path, request = titleRequestAt(ctx.replica(), path)
      if (!request) throw new Error('There is no text to title here.')
      const answer = (await deps.complete(TITLE_SYSTEM, request.text.slice(0, 8000))).trim().split(/\r?\n/)[0]!.replace(/^["'\s]+|["'.\s]+$/g, '')
      const title = truncateTitle(answer, 120) || truncateTitle(request.text)
      let next = writeHandlerResult(ctx.replica(), path, title, ctx.now())
      next = addSupply(next, path.slice(0, -1), path.at(-1)!, { capability: 'title', by: 'fos' }, ctx.now())
      await ctx.update(next)
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
    peerId: 'fos', ref: standardHostRef('fos', 'market'),
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
    peerId: 'fos', ref: standardHostRef('fos', 'search'),
    async effect(ctx) {
      const path = ctx.step.path, r = ctx.replica(), cid = resolveScope(r.store, headCid(r), path)!
      // which rows inside are what is decided by their row types: a query row says what to look for, refs are earlier hits
      const queryRow = rowsOfType(r.store, cid, QUERY_TYPE)[0]
      const query = queryRow ? { id: queryRow.id, title: formTitle(r.store, valueContent(r.store, queryRow.cid)), market: !!valueContent(r.store, queryRow.cid).data.query?.market } : null
      const text = (query?.title || ctx.step.row!.title).trim().slice(0, 1000)
      if (!text) throw new Error('Say what to search for: "-? text".')
      const hits = await deps.search({ id: ctx.userId, username: ctx.username }, text, !!query?.market)
      let next = ctx.replica()
      for (const ref of rowsOfType(r.store, cid, REF_TYPE)) next = deleteTask(next, path, ref.id, ctx.now())
      for (const hit of hits) {
        if (hit.aliasId === path.at(-1) || hit.aliasId === query?.id) continue
        if (!hit.owner) { if (resolveRef(next, hit.aliasId)) next = addRef(next, path, hit.aliasId, ctx.now()) }
        else next = addRow(next, path, REF_TYPE, hit.title, ctx.now(), { refId: hit.aliasId, refOwner: hit.owner })
      }
      next = addSupply(next, path.slice(0, -1), path.at(-1)!, { capability: 'search', by: 'fos', ref: query?.id ?? path.at(-1)! }, ctx.now())
      await ctx.update(next)
    }
  }
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type PointsDeps = {
  /**
   * Move fos points between accounts on the server's ledger; throws when the payer cannot cover it or the payee is
   * unknown. `key` identifies the payout (one per requirement): a transfer already recorded under it is not repeated.
   */
  transfer(from: { id: number; username: string }, toUsername: string, amount: number, memo: string, key: string): Promise<void>
}

/**
 * Who a task pays, as a user object this server attests: the one the requirement names with @ (its `user` field,
 * whose attestation is checked here, so a tampered or foreign object is refused), else the one signed-in user whose
 * supplies filled the task's other requirements. Anonymous respondents, several respondents and the owner themselves
 * are refused.
 */
async function payeeOf(ctx: EffectContext, unit: string, identity: VerifyHandler): Promise<UserRecord> {
  const path = ctx.step.path
  if (path.length < 2) throw new Error(`A ${unit} payment goes under the task it rewards.`)
  const r = ctx.replica(), taskPath = path.slice(0, -1), self = `user:${ctx.username}`
  const named = ctx.step.row!.user
  let recipient: UserRecord | null = null
  if (named) {
    if (!identity.verify(named)) throw new Error(`@${named.username} on this ${unit} row is not verified by this server; retype @${named.username} while signed in.`)
    recipient = named
  } else {
    const suppliers = new Set<string>()
    for (const row of view(r, taskPath)?.tasks ?? []) if (!!row.requirement && row.id !== path.at(-1)) for (const supply of view(r, [...taskPath, row.id])?.tasks ?? []) if (supply.supply?.by) suppliers.add(supply.supply.by)
    const people = [...suppliers].filter(p => p !== self && p !== 'fos')
    if (people.some(p => p.startsWith('visitor:'))) throw new Error(`${unit[0]!.toUpperCase()}${unit.slice(1)} go to signed-in Fos users; this respondent is anonymous.`)
    const users = people.filter(p => p.startsWith('user:')).map(p => p.slice('user:'.length))
    if (!users.length) throw new Error('No one to pay yet: the other requirements of this task have no respondent.')
    if (users.length > 1) throw new Error(`Several users answered (${users.map(u => `@${u}`).join(', ')}); name the recipient with @name on the ${unit} row.`)
    recipient = await identity.resolve(users[0]!)
    if (!recipient) throw new Error(`No Fos user is named @${users[0]}.`)
  }
  if (recipient.username === ctx.username) throw new Error('The owner cannot pay themselves.')
  return recipient
}

/**
 * A fos-points requirement (`ff 5 reward`) under a task is a payout: when the task runs, the server moves that many
 * points from the owner's balance to the respondent (the signed-in user whose supplies filled the task's other
 * requirements, or the user the requirement names with @) and records the allocation and supply as its own.
 */
export function pointsHandler(deps: PointsDeps, identity: VerifyHandler): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'points'),
    handles: step => { const r = step.row?.requirement; return !!r && r.capability === 'allocation' && r.resource === 'points' },
    async effect(ctx) {
      const path = ctx.step.path, req = ctx.step.row!.requirement!
      const amount = req.amount ?? 0
      if (!(amount > 0)) throw new Error('Name an amount of fos points to pay.')
      const taskPath = path.slice(0, -1), recipient = await payeeOf(ctx, 'fos points', identity)
      const memo = `${ctx.step.row!.title || 'fos points'} (${taskPath.join('/')})`
      await deps.transfer({ id: ctx.userId, username: ctx.username }, recipient.username, amount, memo, `points:${ctx.username}:${path.join('/')}`)
      const id = `points:${ctx.now().toString(36)}`
      let next = addRow(ctx.replica(), path, ALLOCATION_TYPE, `${amount} fos points to ${recipient.name}`, ctx.now(), { id, allocation: { resource: 'fos:points', type: 'points', amount, unit: 'ff', by: 'fos' }, user: recipient })
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
 * A request for money (`-$ 20 reward`: a negative row of the money type, `lib.money`) under a task is a payment: when the task runs, the server opens one with the
 * payment provider from the owner to the respondent and leaves the evaluation awaiting review. The provider's
 * confirmation (its webhook, `sync/payments.ts`) settles the requirement and continues the evaluation, whether or
 * not the owner's devices are online. Running again while the payment is open does not open a second one.
 */
export function paymentHandler(deps: PaymentDeps, identity: VerifyHandler): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'send-payment'),
    // the row's type decides: a money row with a negative amount is a request for payment
    handles: step => step.row?.type === MONEY_TYPE && !!step.row.requirement,
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
      const recipient = await payeeOf(ctx, 'payments', identity)
      const memo = `${ctx.step.row!.title || 'payment'} (${path.slice(0, -1).join('/')})`
      const opened = await deps.request({ from: { id: ctx.userId, username: ctx.username }, toUsername: recipient.username, amount, unit, memo, key: `payment:${ctx.username}:${path.join('/')}`, path })
      // recorded as open first; settlement (here when the provider charged a saved method, else the webhook) marks it paid
      let next = writePaymentRecord(ctx.replica(), path, { id: opened.id, url: opened.url, status: 'pending', amount, unit, payer: ctx.username, payee: recipient.username, payeeUser: recipient, created: ctx.now(), ...(opened.intent ? { intent: opened.intent } : {}) }, ctx.now())
      if (opened.status === 'paid') next = settlePaymentRecord(next, path, { intent: opened.intent }, ctx.now()).replica
      await ctx.update(next)
      return opened.status === 'paid' ? undefined : 'pending'
    }
  }
}

export type MailDeps = { send(to: string, subject: string, text: string, onBehalfOf: string): Promise<void> }

/**
 * A `-mail` requirement under a task: its inputs are the recipient (`to`) and the subject (else the task's title), the
 * mail capability's declared refs, filled when the row was made; the body is the task and its rows.
 */
export function mailRequest(inputs: { to: string | null; subject: string | null }, taskTitle: string, rows: string[]): { to: string; subject: string; text: string } | null {
  if (!inputs.to) return null
  const subject = inputs.subject?.trim() || taskTitle || 'From Fosforescent'
  const text = [taskTitle, ...rows.filter(Boolean).map(r => `- ${r}`)].filter(Boolean).join('\n').slice(0, 20_000)
  return { to: inputs.to, subject: subject.slice(0, 200), text }
}

/** `-mail` requirements: the account server sends the email (Postmark) on the user's behalf and records the supply as `fos`. */
export function mailHandler(deps: MailDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'mail'),
    async effect(ctx) {
      const r = ctx.replica(), path = ctx.step.path, taskPath = path.slice(0, -1)
      const task = taskPath.length ? view(r, taskPath.slice(0, -1))?.tasks.find(t => t.id === taskPath.at(-1)) : null
      const rows = (view(r, taskPath)?.tasks ?? []).filter(t => t.id !== path.at(-1) && !t.supply).map(t => t.title)
      const cid = resolveScope(r.store, headCid(r), path), value = cid ? valueContent(r.store, cid) : null
      const request = mailRequest({ to: value && requirementInput(r.store, value, 'to'), subject: value && requirementInput(r.store, value, 'subject') }, task?.title ?? '', rows)
      if (!request) throw new Error('Name the recipient: "-mail someone@example.com Subject".')
      await deps.send(request.to, request.subject, request.text, ctx.username)
      let next = addRow(ctx.replica(), path, PLAIN_TYPE, `Sent to ${request.to}: ${request.subject}`, ctx.now())
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
  /** Captures organized into a node (voice/organize.ts `organizeHandler`): `organize` requirements. */
  organize?: HostHandler
  /** Attached MCP servers run `-tool` requirements (integrations/mcpPeers.ts `mcpToolHandler`). */
  tool?: HostHandler
  /** Is the account connected to the provider (`phone`)? */
  connected(userId: number, provider: string): Promise<boolean>
  /** The server has an SMS adapter configured. */
  sms: boolean
  /** The cron runner is enabled on this instance (FOS_ENABLE_CRON). */
  cron: boolean
  /** Where the web app lives: the base of the URLs the `url` handler makes for published nodes. */
  webUrl: string
  /** The server's user attestation (sync/verify.ts): fills `verify` requirements with attested user objects; payees are checked against it. */
  verify: VerifyHandler
  /** Approvals of pull requests, signed with the same identity key, and the group's merge rule (sync/approve.ts). */
  approve?: HostHandler
}

/**
 * The relay (shared/sync/relay.ts, the standard library's Relay): a message a peer leaves on a node is moved into the
 * queue of its addressee when the account knows that peer there (a member), and left alone otherwise. The same
 * handler any device can run; here it runs as `fos` after every submission a node exchange brings in.
 */
/**
 * The fos `url` handler: it records where this account's share pages are (the web app and the account's name) on
 * its member entry, after every write that reaches the account; devices make a published node's link from it and
 * the node's place (`publishedUrl`). Visiting a link serves the node's execute view to whoever may run it, and 404
 * to anyone else.
 */
export function publicUrlHandler(webUrl: string): HostHandler {
  return { peerId: 'fos', ref: standardHostRef('fos', 'url'), submission: (replica, _path, now) => {
    const owner = replica.meta.peerId.startsWith('user:') ? replica.meta.peerId.slice('user:'.length) : null
    const entry = [memberEntryId(SERVER_MEMBER)]
    return owner && resolveScope(replica.store, headCid(replica), entry) ? writePageBase(replica, entry, { base: webUrl.replace(/\/$/, ''), owner }, now) : replica
  } }
}

export function relayHandler(): HostHandler {
  return { peerId: 'fos', ref: standardHostRef('fos', 'relay'), submission: (replica, path, now) => relayAfterSubmission(replica, path, 'fos', now) }
}

export function createHostHandlers(deps: HostHandlerDeps): HostHandler[] {
  return [
    // the server's own services, all effects: row search, market listing, polls, fos points, …
    searchHandler(deps.search),
    relayHandler(),
    publicUrlHandler(deps.webUrl),
    marketHandler(deps.market),
    deps.verify,
    ...(deps.approve ? [deps.approve] : []),
    pointsHandler(deps.points, deps.verify),
    ...(deps.payments ? [paymentHandler(deps.payments, deps.verify)] : []),
    mailHandler(deps.mail),
    llmHandler(deps.llm),
    titleHandler(deps.llm),
    ...(deps.cron ? [{ peerId: 'fos', ref: standardHostRef('fos', 'cron'), trigger: cronObserver }] : []),
    githubRepoHandler(deps.github),
    calendarHandler(deps.google),
    ...(deps.organize ? [deps.organize] : []),
    ...(deps.tool ? [deps.tool] : []),
    ...(deps.sms ? [{ peerId: 'integration:phone', ref: standardHostRef('integration:phone', 'notify'), available: (id: number) => deps.connected(id, 'phone') }] : [])
  ]
}
