/**
 * Stripe as the account's payment provider for `-$` requirements (sync/hostHandlers.ts `paymentHandler`).
 *
 * Opening a payment creates a Checkout session the owner completes in the browser; the amount goes to the payee's
 * connected account (a destination charge), so the payee must have finished Stripe Connect onboarding with payouts
 * enabled (`POST /subscription/connect-session`). The session's metadata names the owner, the requirement's path and
 * the handler's key, which is how the webhook (`checkout.session.completed`, `checkout.session.expired`) finds the
 * record to settle (`sync/payments.ts`). No money moves on this server; Stripe is the ledger.
 */
import type Stripe from 'stripe'
import type { PaymentDeps } from '../sync/hostHandlers'
import type { PaymentConfirmation } from '../sync/payments'

export const FOS_PAYMENT = 'fos-payment'

export type StripePaymentDeps = {
  stripe: Pick<Stripe, 'checkout'>
  /** The payee's connected account, when they have one that can receive payouts. */
  payee(username: string): Promise<{ connectedAccountId: string | null; payoutsEnabled: boolean } | null>
  /** The payer's Stripe customer, when known (prefills and saves the card on their customer). */
  customer?(userId: number): Promise<string | null>
  /** Where Checkout returns to. */
  webUrl: string
  /** Platform fee in percent of the amount, kept by the Fos account (0 when unset). */
  feePercent?: number
}

/** Currencies Stripe treats as zero-decimal: the amount is already in the smallest unit. */
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'])
export const minorUnits = (amount: number, currency: string) => Math.round(amount * (ZERO_DECIMAL.has(currency) ? 1 : 100))

export function stripePayments(deps: StripePaymentDeps): PaymentDeps {
  return {
    async request({ from, toUsername, amount, unit, memo, key, path }) {
      const payee = await deps.payee(toUsername)
      if (!payee) throw new Error(`No Fos user is named @${toUsername}.`)
      if (!payee.connectedAccountId || !payee.payoutsEnabled) throw new Error(`@${toUsername} has not set up payouts yet (Stripe, on their Fos peer).`)
      const currency = /^[a-z]{3}$/.test(unit) ? unit : 'usd'
      const total = minorUnits(amount, currency)
      if (!(total > 0)) throw new Error('The amount is too small to pay.')
      const fee = Math.round(total * ((deps.feePercent ?? 0) / 100))
      const customer = await deps.customer?.(from.id)
      const session = await deps.stripe.checkout.sessions.create({
        mode: 'payment',
        ...(customer ? { customer } : {}),
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: total, product_data: { name: memo.slice(0, 120), description: `Payment to @${toUsername} through Fosforescent` } } }],
        payment_intent_data: {
          transfer_data: { destination: payee.connectedAccountId },
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
          metadata: { type: FOS_PAYMENT, owner: from.username, path: JSON.stringify(path), key }
        },
        metadata: { type: FOS_PAYMENT, owner: from.username, path: JSON.stringify(path), key, payee: toUsername },
        success_url: `${deps.webUrl}/?payment=paid`,
        cancel_url: `${deps.webUrl}/?payment=cancelled`
      })
      return { id: session.id, url: session.url ?? null, status: 'pending' }
    }
  }
}

/** The confirmation a Checkout session carries, or null when the session is not one of our payments. */
export function paymentConfirmationOf(session: Pick<Stripe.Checkout.Session, 'id' | 'metadata' | 'payment_intent' | 'payment_status' | 'status'>): PaymentConfirmation | null {
  const meta = session.metadata
  if (meta?.type !== FOS_PAYMENT || typeof meta.owner !== 'string' || typeof meta.path !== 'string') return null
  let path: unknown
  try { path = JSON.parse(meta.path) } catch { return null }
  if (!Array.isArray(path) || !path.every(id => typeof id === 'string')) return null
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
  return { owner: meta.owner, path, id: session.id, ...(intent ? { intent } : {}), ...(paid ? {} : { failed: session.status === 'expired' ? 'The payment page expired before it was paid.' : `Payment ${session.payment_status}.` }) }
}

// The webhook module is loaded before the services exist, so the settler is registered at startup (index.ts).
let settler: ((confirmation: PaymentConfirmation) => Promise<unknown>) | null = null
export function setPaymentSettler(settle: (confirmation: PaymentConfirmation) => Promise<unknown>): void { settler = settle }
export async function settleCheckoutSession(session: Pick<Stripe.Checkout.Session, 'id' | 'metadata' | 'payment_intent' | 'payment_status' | 'status'>): Promise<boolean> {
  const confirmation = paymentConfirmationOf(session)
  if (!confirmation) return false
  if (!settler) { console.error(`[payments] no settler registered; payment ${session.id} for ${confirmation.owner} awaits a redelivery`); throw new Error('Payment settlement unavailable.') }
  const result = await settler(confirmation)
  console.log(`[payments] ${session.id} for ${confirmation.owner} at ${confirmation.path.join('/')}: ${String(result)}`)
  return true
}
