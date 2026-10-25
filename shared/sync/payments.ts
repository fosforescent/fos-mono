/**
 * Payments confirmed by a provider: a `-$ 20 @bob` demand is a negative allocation of an account; the payment handler
 * opens a payment with the provider and the run waits. The provider's confirmation (the webhook) is authority the
 * host holds outside the graph: it mints the grant and binds it into the demand (`bindIssuedAuthority`), which
 * continues the evaluation. Nothing about an open payment is written into the graph: the provider's session carries
 * the owner, the path and the amount, and the requirement is either still open or filled.
 */
import { view, type Replica } from './replica'
import { allocateCapability, allocationPattern, bindIssuedAuthority, grantValue } from './arguments'
import type { Scope } from './graph'

/** What the provider confirms: the demand's amount, unit and payee as the payment was opened. */
export type PaymentSettlement = { amount: number; unit: string; payee: string; intent?: string }

/** Bind the confirmed payment as a grant into the demand at `path`; `settled` is false when the demand is gone or already filled. */
export function settlePayment(r: Replica, path: Scope, payment: PaymentSettlement, now: number): { replica: Replica; settled: boolean } {
  const taskPath = path.slice(0, -1), request = view(r, taskPath)?.tasks.find(t => t.id === path.at(-1))
  if (!request?.requirement || request.requirement.satisfied) return { replica: r, settled: false }
  const allocation = { resource: '', type: 'account' as const, amount: payment.amount, unit: request.requirement.unit ?? payment.unit, by: 'fos', at: now }
  const grant = grantValue(r.store, allocationPattern(r.store, taskPath, allocation, true), allocateCapability(r.store, taskPath), allocation,
    { description: { content: `${payment.amount} ${payment.unit.toUpperCase()} to @${payment.payee}${payment.intent ? ` (${payment.intent})` : ''}` }, peerId: { content: 'fos' } })
  return { replica: bindIssuedAuthority(r, path, grant, 'fos', now), settled: true }
}
