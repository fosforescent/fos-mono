/**
 * Organizing a capture into one node's subtree (shared/sync/organize.ts holds the plan format, its validation and
 * how it is applied). The model sees the capture and a bounded outline of the target's subtree and answers with a
 * plan; the plan is validated against that outline here, and again against the live tree where it is applied.
 *
 *   POST /user/data/voice-notes/organize   { text, title?, outline: [{ id, parent, title }] }
 *   → { plan: { title, items: [{ ref, parent, text, markdown? }] }, cost }
 *
 * The same model plumbing and free budget as voice notes (voiceNotes.ts): spend is metered and recorded as voice
 * usage, non-paying users are refused at the budget with 402.
 */
import type { Request, Response } from 'express'
import { ORGANIZE_LIMITS, ORGANIZE_SYSTEM, organizePrompt, parseOrganizePlan, parseOutline, type OrganizePlan, type OutlineEntry } from '@fosforescent/shared/sync/index'
import { admitCaller, budgetRefusal, recordSafely, type VoiceDeps, type VoiceUsage } from './voiceNotes'

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

/** The request body as an organize input, or the reason it is not one. */
export function organizeInputOf(body: unknown): OrganizeInput | { status: number; error: string } {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) return { status: 400, error: 'Send the captured text as `text`.' }
  if (text.length > ORGANIZE_LIMITS.captureChars) return { status: 413, error: `Organize at most ${ORGANIZE_LIMITS.captureChars.toLocaleString('en-US')} characters at a time.` }
  return { text, title: typeof raw.title === 'string' ? raw.title.slice(0, 500) : '', outline: parseOutline(raw.outline).slice(0, ORGANIZE_LIMITS.outlineEntries) }
}

export function createOrganizeHandler(deps: VoiceDeps, usage?: VoiceUsage) {
  return async (req: Request, res: Response): Promise<Response> => {
    const input = organizeInputOf(req.body)
    if ('error' in input) return res.status(input.status).json({ error: input.error })
    const user = await admitCaller(usage, req, res)
    if (user === false) return res
    const started = Date.now()
    deps.drain?.()
    try {
      const plan = await organizeCapture(deps, input)
      const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
      if (usage && user) await recordSafely(usage, user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: input.text.length, clusters: plan.items.length })
      return res.json({ plan, cost: { usd: cost.usd, tokens: cost.tokens } })
    } catch (error) {
      const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
      if (usage && user && cost.usd > 0) await recordSafely(usage, user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: input.text.length, clusters: 0 })
      console.error('organize failed:', error instanceof Error ? error.message : error)
      return res.status(502).json({ error: `organizing failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }
}

/**
 * Organizing on an account's behalf without a request (texted messages): the same budget and metering. Answers
 * null when the account is unknown or over its free budget, so the caller files the text unorganized.
 */
export function accountOrganizer(deps: VoiceDeps, usage: VoiceUsage) {
  return async (username: string, input: OrganizeInput): Promise<OrganizePlan | null> => {
    const user = await usage.userNamed?.(username)
    if (!user || await budgetRefusal(usage, user)) return null
    const started = Date.now()
    deps.drain?.()
    try {
      return await organizeCapture(deps, input)
    } finally {
      const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
      await recordSafely(usage, user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: input.text.length, clusters: 0 })
    }
  }
}
