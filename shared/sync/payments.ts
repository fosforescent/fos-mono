/**
 * Money payments as evaluation effects. Money is the row type `lib:type:allocation:money`, told apart by sign: a
 * negative row is a request for payment (a requirement), a positive one a payment. A `-$ 20` request under a task is
 * a payment the owner makes to the respondent when the task runs. The `fos` payment handler does not move money itself: it opens a payment with the
 * account's payment provider (Stripe Checkout, paying the payee's connected account), records what it opened on the
 * requirement as a `fos:payment` value, and leaves the evaluation awaiting review. The provider confirms the payment
 * later, through its webhook, whether or not any of the owner's devices is online: the server then writes the payment
 * that fills the request (`settlePaymentRecord`) and continues the evaluation.
 */
import { addRow, view, type Replica } from './replica'
import { MONEY_TYPE } from './library-types'
import { readNodeValue, writeNodeValue } from './evaluation'
import type { Scope } from './graph'
import type { UserRecord } from './users'

export const PAYMENT_ARGUMENT = 'fos:payment'

export type PaymentRecord = {
  /** The provider's id for the payment (a Checkout session). */
  id: string
  /** Where the payer completes it; absent once it is paid or when the provider charged a saved method. */
  url: string | null
  status: 'pending' | 'paid' | 'failed'
  amount: number
  unit: string
  payer: string
  payee: string
  /** The payee's user object as the server verified it when opening the payment; settlement binds it on the allocation. */
  payeeUser?: UserRecord
  created: number
  paid?: number
  /** The provider's settled charge (a PaymentIntent). */
  intent?: string
  error?: string
}

export function paymentRecord(r: Replica, path: Scope): PaymentRecord | null {
  const value = readNodeValue<PaymentRecord>(r, path, PAYMENT_ARGUMENT)
  return value && typeof value.id === 'string' && ['pending', 'paid', 'failed'].includes(value.status) && typeof value.amount === 'number' ? value : null
}

export function writePaymentRecord(r: Replica, path: Scope, record: PaymentRecord, now: number): Replica {
  return writeNodeValue(r, path, PAYMENT_ARGUMENT, record, now)
}

/**
 * The payment is confirmed: the payment (a positive money row under the request, recorded as `fos`; its resource is
 * the request itself, which acts as the bank once satisfied) and the paid record. Idempotent: a record that is already
 * paid is left alone, so a redelivered confirmation changes nothing.
 */
export function settlePaymentRecord(r: Replica, path: Scope, confirmation: { intent?: string }, now: number): { replica: Replica; settled: boolean } {
  const record = paymentRecord(r, path)
  if (!record || record.status === 'paid') return { replica: r, settled: false }
  const requirement = path.at(-1)!, taskPath = path.slice(0, -1)
  const request = view(r, taskPath)?.tasks.find(t => t.id === requirement)
  if (request?.type !== MONEY_TYPE || !request.requirement) return { replica: r, settled: false }
  const id = `payment:${now.toString(36)}`
  let next = addRow(r, path, MONEY_TYPE, `${record.amount} ${record.unit.toUpperCase()} to @${record.payee}`, now, {
    id, allocation: { resource: requirement, type: 'account', amount: record.amount, unit: record.unit, by: 'fos', at: now }, ...(record.payeeUser ? { user: record.payeeUser } : {})
  })
  next = writePaymentRecord(next, path, { ...record, status: 'paid', url: null, paid: now, ...(confirmation.intent ? { intent: confirmation.intent } : {}) }, now)
  return { replica: next, settled: true }
}
