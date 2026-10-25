import { standardHostRef, type HostHandler, type HostUser } from './host-runtime'
import { cronObserver } from '@fosforescent/shared/sync/trigger-primitives'
/**
 * The handlers this backend registers (see host-runtime.ts). Each entry is a capability a peer provides on this host.
 * Those that execute are natives (shared/sync/native.ts): compiled operands in, values out. A requirement row's own
 * hole is the operand `self`; the native answers it with a value of the requirement's pattern, and the evaluator
 * publishes the answer when the run commits. Natives never read or write the tree.
 */
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { content, patternInputs, rowTypeAt, newId, type ResourceType, type UserRecord } from '@fosforescent/shared/sync/index'
import { TITLE_SYSTEM, truncateTitle, allocateNative, allocationPattern, allocateCapability, grantValue, supplyValue, userType, readUser, membershipPath, SERVER_MEMBER, writePageBase, headCid, relayAfterSubmission, type Allocation, type Compiled, type Native, type NativeContext } from '@fosforescent/shared/sync/index'
import { valueOfPattern } from '@fosforescent/shared/sync/structural'
import type { VerifyHandler } from './verify'
import { PLAIN_TYPE, REF_TYPE } from '@fosforescent/shared/sync/library-types'

// ---------------------------------------------------------------------------
// Reading operands

/** The requirement a native runs for: its pattern (what was asked, with its inputs) and its own text. */
function selfOf(operands: Compiled) {
  const self = operands.outputs.self
  if (!self) throw new Error('This handler fills a requirement row.')
  return self
}
const textOf = (store: FosStore, cid: string | undefined): string => {
  if (!cid) return ''
  const data = content(store, cid).data
  return data.description?.content ?? (typeof data.scalar?.value === 'string' ? data.scalar.value : '')
}
/** The named inputs of the requirement (`-mail to subject`, `-repo owner/name`): filled refs on its pattern. */
const inputsOf = (ctx: NativeContext, operands: Compiled) => patternInputs(ctx.store, selfOf(operands).pattern)
/** The answer to the requirement: a value of its pattern, as `by`, with `rows` inside it (what the handler produced). */
const answer = (ctx: NativeContext, operands: Compiled, by: string, description: string, rows: [string, string][] = []) =>
  ({ outputs: { self: valueOfPattern(ctx.store, selfOf(operands).pattern, { description: { content: description }, peerId: { content: by } }, rows) } })
/** A row the answer carries: a plain row of the library type `typeId`, with its own identity. */
const row = (ctx: NativeContext, typeId: string, data: Record<string, unknown>): [string, string] =>
  [rowTypeAt(ctx.store, typeId, ctx.step), ctx.put({ data: { alias: { id: newId() }, ...data } as any, children: [] })]
/** The user the requirement names (`-ff 5 @bob`): its `user` field, an operand like any other. */
const namedUser = (ctx: NativeContext, operands: Compiled): UserRecord | null =>
  operands.inputs.user ? readUser(ctx.store, userType(ctx.store, ctx.step), content(ctx.store, operands.inputs.user)) : null
/** A grant this host mints for authority it holds outside the graph (a ledger, a calendar): a value of the demand's own pattern. */
const grantAnswer = (ctx: NativeContext, operands: Compiled, allocation: Allocation, description: string) => {
  const at = ctx.step.slice(0, -1), store = ctx.store
  return { outputs: { self: grantValue(store, allocationPattern(store, at, allocation, true), allocateCapability(store, at), allocation, { description: { content: description }, peerId: { content: 'fos' } }) } }
}

// ---------------------------------------------------------------------------
// Handlers

export type GitHubIssueDeps = {
  connected(userId: number): Promise<boolean>
  createIssue(userId: number, input: { repo: string; title: string; body?: string }): Promise<{ url: string; number: number }>
}
/** `-repo owner/name title`: open a GitHub issue through the account's OAuth connection; the answer records it. */
export function githubRepoHandler(deps: GitHubIssueDeps): HostHandler {
  return {
    peerId: 'integration:github', ref: standardHostRef('integration:github', 'repo'),
    available: userId => deps.connected(userId),
    native: user => async (operands, ctx) => {
      if (!await deps.connected(user.id)) throw new Error('GitHub disconnected before the effect.')
      const repo = inputsOf(ctx, operands).repo
      if (!repo) throw new Error('Specify the GitHub repository first.')
      const issue = await deps.createIssue(user.id, { repo, title: selfOf(operands).data.description?.content || 'from fos', body: 'From a fos task.' })
      return answer(ctx, operands, 'integration:github', `${repo}#${issue.number} ${issue.url}`)
    }
  }
}

export type CalendarDeps = {
  connected(userId: number): Promise<boolean>
  createEvent(userId: number, event: { summary: string; description?: string; start: number; end: number }): Promise<{ url: string | null; id: string }>
}
/** A windowed time (or person) demand: an event on the account's Google Calendar for that window, and the grant that fills it. */
export function calendarHandler(deps: CalendarDeps): HostHandler {
  return {
    peerId: 'integration:google', ref: standardHostRef('integration:google', 'allocation'),
    // resource demands all refine `allocation`; until the library offers refined patterns, this one takes windowed time
    handles: step => ['calendar', 'person'].includes(step.row?.requirement?.resource ?? ''),
    available: userId => deps.connected(userId),
    native: user => async (operands, ctx) => {
      if (!await deps.connected(user.id)) throw new Error('Google disconnected before the effect.')
      const self = selfOf(operands), demand = content(ctx.store, self.pattern).data.allocation
      const { start, end } = demand ?? {}
      if (!demand || start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Choose a concrete start and end before creating a calendar event.')
      const title = self.data.description?.content || 'fos'
      const event = await deps.createEvent(user.id, { summary: title, description: title, start, end })
      const allocation: Allocation = { resource: '', type: demand.type as ResourceType, amount: demand.amount ?? (end - start) / 3_600_000, unit: demand.unit || 'h', start, end, by: 'integration:google' }
      return grantAnswer(ctx, operands, allocation, event.url ? `on Google Calendar ${event.url}` : 'on Google Calendar')
    }
  }
}

export type LlmDeps = { complete(system: string, user: string): Promise<string> }
export const WORK_SYSTEM = 'You answer the task the person wrote, briefly and concretely. Return plain text.'
/** `-llm question`: the server's own model answers the requirement's text; the answer is the requirement's value. */
export function llmHandler(deps: LlmDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'llm'),
    native: () => async (operands, ctx) => {
      const prompt = selfOf(operands).data.description?.content?.trim() ?? ''
      if (!prompt) throw new Error('Write the question on the row.')
      if (prompt.length > 20_000) throw new Error('The question exceeds 20,000 characters.')
      const text = (await deps.complete(WORK_SYSTEM, prompt)).trim()
      if (!text) throw new Error('The model returned an empty result. Try again.')
      return answer(ctx, operands, 'fos', text)
    }
  }
}

/** `title` requests (shared/sync/title-request.ts): a short title for the text the request carries as its `text` input. */
export function titleHandler(deps: LlmDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'title'),
    native: () => async (operands, ctx) => {
      const text = inputsOf(ctx, operands).text ?? ''
      if (!text.trim()) throw new Error('There is no text to title here.')
      const first = (await deps.complete(TITLE_SYSTEM, text.slice(0, 8000))).trim().split(/\r?\n/)[0]!.replace(/^["'\s]+|["'.\s]+$/g, '')
      return answer(ctx, operands, 'fos', truncateTitle(first, 120) || truncateTitle(text))
    }
  }
}

export type MarketDeps = { index(user: { id: number; username: string }, store: FosStore): Promise<void> }
/** `-market` under a task: the server indexes the account so other accounts find the task; the answer is the listing. The node is listed while this answer holds (`isListed`). */
export function marketHandler(deps: MarketDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'market'),
    native: user => async (operands, ctx) => {
      if (ctx.step.length < 2) throw new Error('Market requirements go under a task; the task is what gets listed.')
      await deps.index(user, ctx.store)
      return answer(ctx, operands, 'fos', `listed ${ctx.step.at(-2)}`)
    }
  }
}

export type SearchHit = { aliasId: string; title: string; owner: string | null }
export type SearchDeps = { search(user: { id: number; username: string }, query: string, market: boolean): Promise<SearchHit[]> }
/** `-? text`: the server's row search; the hits are reference rows inside the answer. */
export function searchHandler(deps: SearchDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'search'),
    native: user => async (operands, ctx) => {
      const text = (selfOf(operands).data.description?.content ?? '').trim().slice(0, 1000)
      if (!text) throw new Error('Say what to search for: "-? text".')
      const hits = (await deps.search(user, text, false)).filter(hit => hit.aliasId !== ctx.step.at(-1))
      const rows = hits.map(hit => row(ctx, REF_TYPE, { description: { content: hit.title }, ref: { id: hit.aliasId, ...(hit.owner ? { owner: hit.owner } : {}) } }))
      return answer(ctx, operands, 'fos', `${hits.length} hits for ${text}`, rows)
    }
  }
}

export type PointsDeps = { transfer(from: { id: number; username: string }, toUsername: string, amount: number, memo: string, key: string): Promise<void> }
/** The payee a payout names (`-ff 5 reward @bob`): the requirement's user field, attested by this server. */
function payee(ctx: NativeContext, operands: Compiled, user: HostUser, unit: string, identity: VerifyHandler): UserRecord {
  const named = namedUser(ctx, operands)
  if (!named) throw new Error(`Name who the ${unit} go to with @name on the row.`)
  if (!identity.verify(named)) throw new Error(`@${named.username} on this ${unit} row is not verified by this server; retype @${named.username} while signed in.`)
  if (named.username === user.username) throw new Error('The owner cannot pay themselves.')
  return named
}
/** `-ff 5 reward @bob`: move fos points on the server's ledger to the named user; the grant fills the demand. */
export function pointsHandler(deps: PointsDeps, identity: VerifyHandler): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'allocation', 'points'),
    handles: step => step.row?.requirement?.resource === 'points',
    native: user => async (operands, ctx) => {
      const self = selfOf(operands), demand = content(ctx.store, self.pattern).data.allocation, amount = demand?.amount ?? 0
      if (!(amount > 0)) throw new Error('Name an amount of fos points to pay.')
      const recipient = payee(ctx, operands, user, 'fos points', identity)
      await deps.transfer(user, recipient.username, amount, `${self.data.description?.content || 'fos points'} (${ctx.step.slice(0, -1).join('/')})`, `points:${user.username}:${ctx.step.join('/')}`)
      return grantAnswer(ctx, operands, { resource: '', type: 'points', amount, unit: 'ff', by: 'fos' }, `${amount} fos points to ${recipient.name ?? recipient.username}`)
    }
  }
}

export type PaymentDeps = {
  request(input: { from: { id: number; username: string }; toUsername: string; amount: number; unit: string; memo: string; key: string; path: string[] }): Promise<{ id: string; url: string | null; status: 'pending' | 'paid'; intent?: string }>
}
/**
 * `-$ 20 @bob`: open a payment with the provider from the owner to the named user. Charged at once, the grant fills
 * the demand; otherwise the run waits (`pending`) and the provider's confirmation (sync/payments.ts) binds the grant.
 */
export function paymentHandler(deps: PaymentDeps, identity: VerifyHandler): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'allocation', 'send-payment'),
    handles: step => step.row?.requirement?.resource === 'account',
    native: user => async (operands, ctx) => {
      const self = selfOf(operands), demand = content(ctx.store, self.pattern).data.allocation, amount = demand?.amount ?? 0, unit = demand?.unit || 'usd'
      if (!(amount > 0)) throw new Error('Name an amount to pay.')
      const recipient = payee(ctx, operands, user, 'payments', identity)
      const opened = await deps.request({ from: user, toUsername: recipient.username, amount, unit: unit.toLowerCase(), memo: `${self.data.description?.content || 'payment'} (${ctx.step.slice(0, -1).join('/')})`, key: `payment:${user.username}:${ctx.step.join('/')}`, path: ctx.step })
      if (opened.status === 'paid') return grantAnswer(ctx, operands, { resource: '', type: 'account', amount, unit, by: 'fos' }, `${amount} ${unit} to @${recipient.username}`)
      return { pending: true }
    }
  }
}

export type MailDeps = { send(to: string, subject: string, text: string, onBehalfOf: string): Promise<void> }
export function mailRequest(inputs: { to: string | null; subject: string | null }, title: string): { to: string; subject: string; text: string } | null {
  if (!inputs.to) return null
  return { to: inputs.to, subject: (inputs.subject?.trim() || title || 'From Fosforescent').slice(0, 200), text: title.slice(0, 20_000) }
}
/** `-mail someone@example.com Subject`: the server emails the recipient input on the account's behalf; the answer records it. */
export function mailHandler(deps: MailDeps): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'mail'),
    native: user => async (operands, ctx) => {
      const inputs = inputsOf(ctx, operands)
      const request = mailRequest({ to: inputs.to ?? null, subject: inputs.subject ?? null }, selfOf(operands).data.description?.content ?? '')
      if (!request) throw new Error('Name the recipient: "-mail someone@example.com Subject".')
      await deps.send(request.to, request.subject, request.text, user.username)
      return answer(ctx, operands, 'fos', `sent to ${request.to}: ${request.subject}`)
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
  payments?: PaymentDeps
  mail: MailDeps
  organize?: HostHandler
  tool?: HostHandler
  connected(userId: number, provider: string): Promise<boolean>
  sms: boolean
  cron: boolean
  webUrl: string
  verify: VerifyHandler
  approve?: HostHandler
}

export function publicUrlHandler(webUrl: string): HostHandler {
  return { peerId: 'fos', ref: standardHostRef('fos', 'url'), submission: (replica, _path, now) => {
    const owner = replica.meta.peerId.startsWith('user:') ? replica.meta.peerId.slice('user:'.length) : null
    const entry = membershipPath(replica.store, headCid(replica), [], SERVER_MEMBER)
    return owner && entry ? writePageBase(replica, entry, { base: webUrl.replace(/\/$/, ''), owner }, now) : replica
  } }
}
export function relayHandler(): HostHandler {
  return { peerId: 'fos', ref: standardHostRef('fos', 'relay'), submission: (replica, path, now) => relayAfterSubmission(replica, path, 'fos', now) }
}
/** The server's allocate handler: the shared quantity-conservation native. */
export function allocateHandler(): HostHandler {
  return { peerId: 'fos', ref: standardHostRef('fos', 'allocate'), native: () => allocateNative }
}

export function createHostHandlers(deps: HostHandlerDeps): HostHandler[] {
  return [
    searchHandler(deps.search),
    relayHandler(),
    allocateHandler(),
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
export { supplyValue, PLAIN_TYPE }
