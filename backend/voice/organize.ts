import { standardHostRef } from '../sync/host-runtime'
/**
 * Organizing a capture into one node's subtree is an effect of this server: the `organize` handler fills an
 * `organize` requirement placed in the target node (shared/sync/organize.ts `requestOrganize`: its text is what the
 * capture is, its note child the captured text). Reached like every other effect, through a `complete` event on the
 * requirement (sync/events.ts → sync/evaluation.ts); there is no route. The handler
 *
 *   1. builds the outline of the target's subtree from the account's own store (`captureOutline`),
 *   2. asks the model for a plan (retried once when the answer is not JSON), validated against that outline,
 *   3. submits the plan, with the raw capture kept as a note, as ONE submission by `fos` on the target
 *      (`proposeOrganizePlan`: a proposal on the target's mutable ref; no row is written into main), and
 *   4. records the supply, with what it submitted as the requirement's `fos:organized` value.
 *
 * The owner accepts the submission on a device as one local edit (web: `App.acceptSubmission`) or rejects it; until
 * then nothing of the capture is on main.
 *
 * The same model plumbing and free budget as voice notes (voiceNotes.ts): spend is metered and recorded as voice
 * usage; a non-paying account over the budget is refused before the evaluation opens. Texted messages use the same
 * handler (`createAccountOrganizer`, for channels/textCommands.ts); their submission waits in Home.
 */
import { ORGANIZED_VALUE, proposeOrganizePlan, captureOutline, deleteTask, headCid, HOME_ID, organizeRequestAt, organizePrompt, parseOrganizePlan, ORGANIZE_SYSTEM, put, readNodeValue, requestOrganize, resolveScope, valueContent, view, writeNodeValue, addSupply, createReplica, type OrganizedResult, type OrganizePlan, type OutlineEntry, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type AccountStoreDeps } from '../sync/accountStore'
import type { HostHandler } from '../sync/host-runtime'
import { budgetRefusal, recordSafely, type VoiceDeps, type VoiceUsage } from './voiceNotes'

export type OrganizeInput = { text: string; title: string; outline: OutlineEntry[] }

/** One model call (retried once when the answer is not JSON), validated against the outline it was given. */
export async function organizeCapture(deps: Pick<VoiceDeps, 'complete'>, input: OrganizeInput): Promise<OrganizePlan> {
  const prompt = organizePrompt(input.title, input.outline, input.text), known = input.outline.map(entry => entry.id)
  try {
    return parseOrganizePlan(await deps.complete(ORGANIZE_SYSTEM, prompt, true), known)
  } catch (error) {
    if (!(error instanceof Error) || !/invalid JSON/.test(error.message)) throw error
    return parseOrganizePlan(await deps.complete(ORGANIZE_SYSTEM, `${prompt}\n\nAnswer with the JSON object only.`, true), known)
  }
}

const utcStamp = (now: number) => new Date(now).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

/**
 * The `organize` handler. `model` makes one provider instance per capture (its `drain` meters that capture alone);
 * `usage` is the voice budget.
 */
export function organizeHandler(model: () => VoiceDeps, usage?: VoiceUsage): HostHandler {
  const payer = async (username: string) => usage?.userNamed ? await usage.userNamed(username) : null
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'organize'),
    async prepare(ctx) {
      // refusals come before the evaluation opens, so nothing is journaled for them
      if (!organizeRequestAt(ctx.replica(), ctx.step.path)) throw new Error('Put the captured text in the organize requirement as a note.')
      const user = usage ? await payer(ctx.username) : null
      const refusal = usage && user ? await budgetRefusal(usage, user) : null
      if (refusal) throw new Error(refusal.error)
    },
    async effect(ctx) {
      const path = ctx.step.path, target = path.slice(0, -1), r = ctx.replica()
      const request = organizeRequestAt(r, path)
      if (!request) throw new Error('The capture is missing from the organize requirement.')
      const title = target.length ? view(r, target.slice(0, -1))?.tasks.find(t => t.id === target.at(-1))?.title ?? '' : 'Home'
      const outline = await captureOutline(r, target)
      const deps = model(), started = Date.now(), user = usage ? await payer(ctx.username) : null
      deps.drain?.()
      let plan: OrganizePlan
      try {
        plan = await organizeCapture(deps, { text: request.text, title, outline })
      } finally {
        const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
        if (usage && user) await recordSafely(usage, user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: request.text.length, clusters: 0 })
      }
      // one submission by fos on the target: main gets the proposal (bookkeeping), never the rows
      const submitted = await proposeOrganizePlan(ctx.replica(), target, plan, { label: request.label, stamp: utcStamp(ctx.now()), text: request.text }, ctx.now())
      const titles = new Map(outline.map(entry => [entry.id, entry.title]))
      const result: OrganizedResult = { rows: submitted.rows.length, captureId: submitted.captureId, title: plan.title, under: [...new Set(plan.items.flatMap(item => item.parent && titles.has(item.parent) ? [titles.get(item.parent)!] : []))],
        proposal: submitted.proposalCid, name: submitted.name, additions: submitted.additions }
      let next = writeNodeValue(submitted.replica, path, ORGANIZED_VALUE, result, ctx.now())
      next = addSupply(next, target, path.at(-1)!, { capability: 'organize', by: 'fos', ref: submitted.captureId }, ctx.now())
      await ctx.update(next)
    }
  }
}

type RunNode = (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => Promise<unknown>

/**
 * Organizing on an account's behalf without a device (texted messages): the organize requirement is placed in Home
 * under the account's lock, evaluated like a device's (`runNode`, the same handler and budget), and removed once
 * filled; the submission (the plan's rows and the kept capture) waits on Home for the owner to accept it on a device.
 * Null when it could not be organized (no handler, over budget,
 * the model failed): the requirement is removed again and the caller files the text unorganized.
 */
export function createAccountOrganizer(deps: AccountStoreDeps, runNode: RunNode) {
  const edit = <T>(username: string, change: (r: ReturnType<typeof createReplica>) => { replica: ReturnType<typeof createReplica>; value: T }) => withUserLock(`user:${username}`, async () => {
    const loaded = await deps.loadStore(username)
    if (!loaded) throw new Error('Account unavailable.')
    const before = createReplica(`user:${username}`, loaded.store)
    const { replica, value } = change(before)
    if (headCid(replica) !== headCid(before)) { await deps.saveStore(loaded.user, replica.store); deps.notify?.(loaded.user.id, { type: 'sync_changed', by: 'fos:organize' }) }
    return value
  })
  return async (username: string, text: string, label: string): Promise<OrganizedResult | null> => {
    const placed = await edit(username, r => {
      const at = resolveScope(r.store, headCid(r), [HOME_ID]) ? [HOME_ID] : []
      const request = requestOrganize(r, at, text, label, deps.now?.() ?? Date.now())
      const cid = resolveScope(request.replica.store, headCid(request.replica), request.path)!
      return { replica: request.replica, value: { path: request.path, expected: put(request.replica.store, valueContent(request.replica.store, cid)) } }
    })
    let failure: unknown = null
    try { await runNode(username, { path: placed.path, branches: {}, expected: placed.expected }) } catch (error) { failure = error }
    return edit(username, r => {
      const result = failure ? null : readNodeValue<OrganizedResult>(r, placed.path, ORGANIZED_VALUE)
      if (failure) console.error('organizing failed:', failure instanceof Error ? failure.message : failure)
      const exists = !!resolveScope(r.store, headCid(r), placed.path)
      return { replica: exists ? deleteTask(r, placed.path.slice(0, -1), placed.path.at(-1)!, deps.now?.() ?? Date.now()) : r, value: result }
    })
  }
}
