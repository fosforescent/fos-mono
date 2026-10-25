import { standardHostRef } from '../sync/host-runtime'
/**
 * Organizing a capture is an effect of this server: the `organize` handler fills an `organize` requirement placed in
 * the target node (shared/sync/organize.ts `requestOrganize`: its text is what the capture is, its `capture` input
 * the captured text). Reached like every other effect, through a `complete` event on the requirement
 * (sync/events.ts → sync/evaluation.ts); there is no route. The handler is a run: it asks the model for a plan
 * (retried once when the answer is not JSON) and answers the request with the plan's rows inside it. Primitives see no
 * tree, so the model gets the capture alone; the target's outline, and the plan as one submission on the target the
 * owner accepts or rejects, await their replacement (current_tasks.md).
 *
 * The same model plumbing and free budget as voice notes (voiceNotes.ts): spend is metered and recorded as voice
 * usage; a non-paying account over the budget is refused. Texted messages use the same handler
 * (`createAccountOrganizer`, for channels/textCommands.ts); their filled request waits in Home.
 */
import { deleteTask, headCid, homePath, organizePrompt, parseOrganizePlan, ORGANIZE_SYSTEM, put, requestOrganize, requirementAnswer, resolveScope, valueContent, view, createReplica, type OrganizedResult, type OrganizePlan, type OutlineEntry, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type AccountStoreDeps } from '../sync/accountStore'
import type { HostHandler } from '../sync/host-runtime'
import { valueOfPattern } from '@fosforescent/shared/sync/structural'
import { patternInputs, rowTypeAt, newId, organizedRowCount, content } from '@fosforescent/shared/sync/index'
import { constructForm } from '@fosforescent/shared/sync/forms'
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


/**
 * The `organize` handler. `model` makes one provider instance per capture (its `drain` meters that capture alone);
 * `usage` is the voice budget.
 */
export function organizeHandler(model: () => VoiceDeps, usage?: VoiceUsage): HostHandler {
  return {
    peerId: 'fos', ref: standardHostRef('fos', 'organize'),
    // the capture is the request's input; the plan's rows are the answer. Primitives see no tree, so the outline is the request's own text.
    run: user => async (operands, ctx) => {
      const self = operands.outputs.self
      if (!self) throw new Error('This handler fills an organize requirement.')
      const text = (patternInputs(ctx.store, self.pattern).capture ?? '').trim()
      if (!text) throw new Error('Put the captured text in the organize request.')
      const payer = usage?.userNamed ? await usage.userNamed(user.username) : null
      const refusal = usage && payer ? await budgetRefusal(usage, payer) : null
      if (refusal) throw new Error(refusal.error)
      const deps = model(), started = Date.now()
      deps.drain?.()
      let plan: OrganizePlan
      try { plan = await organizeCapture(deps, { text, title: self.data.description?.content ?? '', outline: [] }) }
      finally {
        const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
        if (usage && payer) await recordSafely(usage, payer.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: text.length, clusters: 0 })
      }
      const rowsAt = (parent: string | null): Array<[string, string]> => plan.items.filter(item => item.parent === parent).map(item => {
        const type = rowTypeAt(ctx.store, item.type, ctx.step), id = newId()
        const node = content(ctx.store, type).data.form
          ? constructForm(ctx.store, type, id, { text: item.text }, ctx.now)
          : { data: { alias: { id }, description: { content: item.text } }, children: [] }
        return [type, ctx.put({ ...node, children: [...node.children, ...rowsAt(item.ref)] })]
      })
      const rows = rowsAt(null)
      return { outputs: { self: valueOfPattern(ctx.store, self.pattern, { description: { content: plan.title || 'Organized' }, peerId: { content: 'fos' } }, rows) } }
    }
  }
}

type RunNode = (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => Promise<unknown>

/**
 * Organizing on an account's behalf without a device (texted messages): the organize requirement is placed in Home
 * under the account's lock and evaluated like a device's (`runNode`, the same handler and budget); filled, it stays
 * in Home as the row holding the plan's rows. Null when it could not be organized (no handler, over budget, the model
 * failed): the requirement is removed again and the caller files the text unorganized.
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
      const at = homePath(r)
      const request = requestOrganize(r, at, text, label, deps.now?.() ?? Date.now())
      const cid = resolveScope(request.replica.store, headCid(request.replica), request.path)!
      return { replica: request.replica, value: { path: request.path, expected: put(request.replica.store, valueContent(request.replica.store, cid)) } }
    })
    let failure: unknown = null
    try { await runNode(username, { path: placed.path, branches: {}, expected: placed.expected }) } catch (error) { failure = error }
    return edit(username, r => {
      // the answer is the request's value: the plan's rows, inside the filled request, which stays in Home holding them
      const title = failure ? null : requirementAnswer(r, placed.path)
      if (title !== null) return { replica: r, value: { rows: organizedRowCount(r, placed.path), title } as OrganizedResult }
      if (failure) console.error('organizing failed:', failure instanceof Error ? failure.message : failure)
      const exists = !!resolveScope(r.store, headCid(r), placed.path)
      return { replica: exists ? deleteTask(r, placed.path.slice(0, -1), placed.path.at(-1)!, deps.now?.() ?? Date.now()) : r, value: null }
    })
  }
}
