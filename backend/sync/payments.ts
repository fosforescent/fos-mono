/**
 * Settling money payments the `fos` payment handler opened (hostHandlers.ts `paymentHandler`). The payment provider
 * confirms a payment through its webhook (subscription/webhook.ts → payments/stripe.ts), which lands here: under the
 * owner's store lock the requirement's `fos:payment` record is settled (allocation + supply as `fos`), the store is
 * saved, and the evaluation that was left awaiting review is continued so the task completes. Redelivered
 * confirmations find the record already paid and change nothing.
 */
import { createReplica, evaluationRecord, headCid, resolveScope, settlePayment, view, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, type AccountStoreDeps } from './accountStore'

export type PaymentConfirmation = {
  owner: string
  /** The requirement's path in the owner's store, as recorded in the provider's metadata. */
  path: Scope
  /** The provider's id for the payment. */
  id: string
  intent?: string
  /** The payment as it was opened, from the session's metadata. */
  amount?: number
  unit?: string
  payee?: string
  /** A failed or expired payment: nothing is recorded; the owner runs the task again to open a new one. */
  failed?: string
}

export type ContinueEvaluation = (username: string, path: Scope) => Promise<unknown>

export function createPaymentSettlement(deps: AccountStoreDeps, continueEvaluation?: ContinueEvaluation) {
  const now = () => deps.now?.() ?? Date.now()
  return {
    /** Apply one confirmation; returns what changed so the webhook can log it. */
    async settle(confirmation: PaymentConfirmation): Promise<'settled' | 'already-settled' | 'failed' | 'unknown'> {
      const outcome = await withUserLock(`user:${confirmation.owner}`, async (): Promise<{ result: 'settled' | 'already-settled' | 'failed' | 'unknown'; evaluate: Scope | null }> => {
        const loaded = await deps.loadStore(confirmation.owner)
        if (!loaded) return { result: 'unknown', evaluate: null }
        let r = createReplica(`user:${confirmation.owner}`, loaded.store)
        if (!resolveScope(r.store, headCid(r), confirmation.path)) return { result: 'unknown', evaluate: null }
        const request = view(r, confirmation.path.slice(0, -1))?.tasks.find(t => t.id === confirmation.path.at(-1))
        if (!request?.requirement) return { result: 'unknown', evaluate: null }
        if (request.requirement.satisfied) return { result: 'already-settled', evaluate: null }
        if (confirmation.failed) return { result: 'failed', evaluate: null }
        if (!(confirmation.amount! > 0) || !confirmation.unit || !confirmation.payee) return { result: 'unknown', evaluate: null }
        const settled = settlePayment(r, confirmation.path, { amount: confirmation.amount!, unit: confirmation.unit, payee: confirmation.payee, ...(confirmation.intent ? { intent: confirmation.intent } : {}) }, now())
        if (!settled.settled) return { result: 'unknown', evaluate: null }
        await deps.saveStore(loaded.user, settled.replica.store)
        deps.notify?.(loaded.user.id, { type: 'sync_changed', by: 'fos:payment' })
        // The evaluation the payment interrupted: the nearest ancestor whose journal is awaiting this very effect.
        let evaluate: Scope | null = null
        for (let i = confirmation.path.length - 1; i >= 0 && !evaluate; i--) {
          const at = confirmation.path.slice(0, i), journal = evaluationRecord(settled.replica, at)
          if (journal?.status === 'awaiting-review' && journal.effects.some(e => e.status === 'pending-review' && JSON.stringify(e.path) === JSON.stringify(confirmation.path))) evaluate = at
        }
        return { result: 'settled', evaluate }
      })
      // The evaluator takes the same lock itself; a failure there leaves a journal the owner reviews, never an unpaid state.
      if (outcome.evaluate && continueEvaluation) {
        try { await continueEvaluation(confirmation.owner, outcome.evaluate) }
        catch (error) { console.error(`[payments] continuing the evaluation at ${outcome.evaluate.join('/')} for ${confirmation.owner} failed:`, error instanceof Error ? error.message : error) }
      }
      return outcome.result
    }
  }
}
