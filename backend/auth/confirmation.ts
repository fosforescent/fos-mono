/**
 * Account confirmation. A new account is unusable (`approved: false`) until the person proves they hold the email
 * address or phone number they registered with: a six-digit code sent there (email through Postmark, phone through
 * the SMS channel), or the link in the email. Confirming approves the account; a phone confirmation also links the
 * number as the account's `phone` integration connection, so texted commands and notifications work at once.
 *
 * Everything that touches storage or delivery comes in through `deps`, so the flow is testable without Prisma.
 */
import type { Request, Response } from 'express'
import { normalizePhone } from '../channels/sms'
import { randomBytes } from 'node:crypto'
import { encryptSecret, hashCode, makeCode } from '../integrations/secrets'

export type ConfirmationChannel = 'email' | 'phone'

export type ConfirmationUser = {
  id: number
  user_name: string
  email: string | null
  phone: string | null
  approved: boolean
  confirmation_channel: string | null
  confirmation_code_hash: string | null
  confirmation_expiration: Date | null
  email_confirmation_token: string | null
}

export type ConfirmationDeps = {
  users: {
    byName(username: string): Promise<ConfirmationUser | null>
    byToken(token: string): Promise<ConfirmationUser | null>
    update(id: number, data: Partial<Omit<ConfirmationUser, 'id' | 'user_name'>>): Promise<void>
  }
  /** Link a confirmed phone number as the account's `phone` connection (`IntegrationConnectionModel`). */
  linkPhone(userId: number, number: string, secret: { secret: string; expiresAt: Date | null }): Promise<void>
  sendEmail(to: string, code: string, actionUrl: string): Promise<void>
  sms: ((to: string, text: string) => Promise<void>) | null
  /** Whether texting is set up right now (the adapter may be configured after the handlers are created). */
  smsConfigured?(): boolean
  secret: string
  webUrl: string
  now?(): number
}

export const CODE_TTL_MS = 15 * 60_000

export type RegistrationInput = { username: string; password: string; confirmPassword: string; email?: string; phone?: string; acceptedTerms: boolean }

/** Registration rules in one place; returns the normalized input or the message to show. */
export function validateRegistration(body: unknown): { ok: true; input: RegistrationInput & { channel: ConfirmationChannel; destination: string } } | { ok: false; error: string } {
  const raw = (body ?? {}) as Record<string, unknown>
  const username = typeof raw.username === 'string' ? raw.username.trim() : ''
  const password = typeof raw.password === 'string' ? raw.password : ''
  const confirmPassword = typeof raw.confirmPassword === 'string' ? raw.confirmPassword : ''
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  const phone = typeof raw.phone === 'string' ? normalizePhone(raw.phone) : null
  if (!username || !password) return { ok: false, error: 'Missing username or password' }
  if (!/^[\w.@+-]{3,128}$/.test(username)) return { ok: false, error: 'Use 3–128 letters, digits, dots, dashes or underscores for the username' }
  if (!raw.accepted_terms) return { ok: false, error: 'You must accept the terms and conditions' }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { ok: false, error: 'Password must contain at least one uppercase letter and one number' }
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters long' }
  if (password !== confirmPassword) return { ok: false, error: 'Passwords do not match' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email address does not look right' }
  if (typeof raw.phone === 'string' && raw.phone.trim() && !phone) return { ok: false, error: 'A phone number with country code is required (+15551234567)' }
  if (!email && !phone) return { ok: false, error: 'Add an email address or a phone number: the account is confirmed with a code sent there' }
  const channel: ConfirmationChannel = email ? 'email' : 'phone'
  return { ok: true, input: { username, password, confirmPassword, email: email || undefined, phone: phone ?? undefined, acceptedTerms: true, channel, destination: email || phone! } }
}

/** What the person sees about where the code went: never the whole address. */
export function maskDestination(channel: ConfirmationChannel, destination: string): string {
  if (channel === 'phone') return `${destination.slice(0, 3)}…${destination.slice(-2)}`
  const [name = '', domain = ''] = destination.split('@')
  return `${name.slice(0, 2)}…@${domain}`
}

export function createConfirmation(deps: ConfirmationDeps) {
  const now = () => deps.now?.() ?? Date.now()
  const smsAvailable = () => deps.smsConfigured ? deps.smsConfigured() : !!deps.sms
  const fail =(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) => res.status(status).json({ error, ...extra })

  /** Issue (or reissue) a code for the user's channel and send it. Throws when it cannot be delivered. */
  async function start(user: ConfirmationUser, channel: ConfirmationChannel): Promise<{ channel: ConfirmationChannel; destination: string }> {
    const destination = channel === 'email' ? user.email : user.phone
    if (!destination) throw new Error(`The account has no ${channel} to confirm.`)
    if (channel === 'phone' && !smsAvailable()) throw new Error('Texting is not configured on this server; register with an email address instead.')
    const code = makeCode(), link = { token: randomBytes(48).toString('hex') } // the emailed one-click link
    await deps.users.update(user.id, {
      confirmation_channel: channel, confirmation_code_hash: hashCode(code, user.user_name, deps.secret), confirmation_expiration: new Date(now() + CODE_TTL_MS),
      ...(channel === 'email' ? { email_confirmation_token: link.token } : {}),
    })
    if (channel === 'email') await deps.sendEmail(destination, code, `${deps.webUrl.replace(/\/$/, '')}/?confirm-email-token=${link.token}`)
    else await deps.sms!(destination, `fos: your confirmation code is ${code}`)
    return { channel, destination: maskDestination(channel, destination) }
  }

  async function approve(user: ConfirmationUser): Promise<void> {
    await deps.users.update(user.id, { approved: true, confirmation_channel: null, confirmation_code_hash: null, confirmation_expiration: null, email_confirmation_token: null })
    if (user.confirmation_channel === 'phone' && user.phone) await deps.linkPhone(user.id, user.phone, { secret: encryptSecret('{}', deps.secret), expiresAt: null })
  }

  return {
    start,
    smsAvailable,
    /** The pending state login reports for an unconfirmed account. */
    pending(user: ConfirmationUser): { channel: ConfirmationChannel; destination: string } | null {
      const channel = user.confirmation_channel === 'phone' ? 'phone' : user.confirmation_channel === 'email' ? 'email' : null
      const destination = channel === 'phone' ? user.phone : channel === 'email' ? user.email : null
      return channel && destination ? { channel, destination: maskDestination(channel, destination) } : null
    },
    /** POST /auth/confirm — `{ username, code }` from the form, or `{ token }` from the email link. */
    async confirm(req: Request, res: Response): Promise<Response> {
      const body = (req.body ?? {}) as { username?: unknown; code?: unknown; token?: unknown }
      let user: ConfirmationUser | null = null
      if (typeof body.token === 'string' && body.token) {
        user = await deps.users.byToken(body.token)
        if (!user) return fail(res, 404, 'This confirmation link is invalid or was already used.')
      } else {
        const username = typeof body.username === 'string' ? body.username.trim() : '', code = typeof body.code === 'string' ? body.code.trim() : ''
        if (!username || !code) return fail(res, 400, 'Enter the code we sent.')
        user = await deps.users.byName(username)
        if (!user) return fail(res, 404, 'No account has that name.')
        if (user.approved) return res.json({ confirmed: true, already: true })
        if (!user.confirmation_code_hash || !user.confirmation_expiration) return fail(res, 400, 'No confirmation is pending; request a new code.')
        if (user.confirmation_expiration.getTime() < now()) return fail(res, 410, 'That code expired; request a new one.', { code: 'expired' })
        if (hashCode(code, user.user_name, deps.secret) !== user.confirmation_code_hash) return fail(res, 400, 'Wrong code.')
      }
      if (user.approved) return res.json({ confirmed: true, already: true })
      await approve(user)
      return res.json({ confirmed: true, username: user.user_name })
    },
    /** POST /auth/confirm/resend — `{ username }`: a fresh code to the same place. Always answers 200 for unknown names. */
    async resend(req: Request, res: Response): Promise<Response> {
      const username = typeof (req.body as { username?: unknown } | undefined)?.username === 'string' ? String((req.body as { username: string }).username).trim() : ''
      if (!username) return fail(res, 400, 'A username is required.')
      const user = await deps.users.byName(username)
      if (!user || user.approved) return res.json({ sent: true })
      const channel = user.confirmation_channel === 'phone' ? 'phone' : 'email'
      try { return res.json({ sent: true, ...(await start(user, channel)) }) }
      catch (error) { return fail(res, 502, error instanceof Error ? error.message : 'Could not send the code.') }
    },
  }
}

export type Confirmation = ReturnType<typeof createConfirmation>
