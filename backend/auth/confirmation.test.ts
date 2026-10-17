import type { Request, Response } from 'express'
import { createConfirmation, maskDestination, validateRegistration, type ConfirmationUser } from './confirmation'
import { hashCode } from '../integrations/secrets'

function setup(sms: boolean = true) {
  const users = new Map<number, ConfirmationUser>()
  const emails: Array<{ to: string; code: string; url: string }> = [], texts: Array<{ to: string; text: string }> = [], linked: Array<{ userId: number; number: string }> = []
  let clock = 1_000_000
  const deps = {
    users: {
      async byName(name: string) { return [...users.values()].find(u => u.user_name === name) ?? null },
      async byToken(token: string) { return [...users.values()].find(u => u.email_confirmation_token === token) ?? null },
      async update(id: number, data: Partial<ConfirmationUser>) { users.set(id, { ...users.get(id)!, ...data }) },
    },
    async linkPhone(userId: number, number: string) { linked.push({ userId, number }) },
    async sendEmail(to: string, code: string, url: string) { emails.push({ to, code, url }) },
    sms: sms ? async (to: string, text: string) => { texts.push({ to, text }) } : null,
    secret: 'test-secret', webUrl: 'https://fos.test/', now: () => clock,
  }
  const confirmation = createConfirmation(deps)
  const add = (user: Partial<ConfirmationUser> & { id: number; user_name: string }) => { users.set(user.id, { email: null, phone: null, approved: false, confirmation_channel: null, confirmation_code_hash: null, confirmation_expiration: null, email_confirmation_token: null, ...user }); return users.get(user.id)! }
  const call = async (handler: (req: Request, res: Response) => Promise<Response>, body: unknown) => {
    let status = 200, result: any
    const res = { status(n: number) { status = n; return res }, json(b: unknown) { result = b; return res } } as unknown as Response
    await handler({ body } as Request, res)
    return { status, body: result }
  }
  return { users, emails, texts, linked, deps, confirmation, add, call, tick: (ms: number) => { clock += ms } }
}

test('registration needs a matching password confirmation and exactly one way to reach the person', () => {
  const base = { username: 'ada', password: 'Example1x', confirmPassword: 'Example1x', accepted_terms: true }
  expect(validateRegistration({ ...base, email: 'Ada@Example.com' })).toMatchObject({ ok: true, input: { channel: 'email', destination: 'ada@example.com', email: 'ada@example.com' } })
  expect(validateRegistration({ ...base, phone: '+1 (555) 123-4567' })).toMatchObject({ ok: true, input: { channel: 'phone', destination: '+15551234567' } })
  expect(validateRegistration({ ...base, email: 'ada@example.com', confirmPassword: 'other' })).toEqual({ ok: false, error: 'Passwords do not match' })
  expect(validateRegistration(base)).toMatchObject({ ok: false, error: expect.stringMatching(/email address or a phone number/) })
  expect(validateRegistration({ ...base, email: 'not-an-email' })).toMatchObject({ ok: false, error: expect.stringMatching(/does not look right/) })
  expect(validateRegistration({ ...base, phone: '12' })).toMatchObject({ ok: false, error: expect.stringMatching(/country code/) })
  expect(validateRegistration({ ...base, email: 'a@b.co', accepted_terms: false })).toMatchObject({ ok: false, error: expect.stringMatching(/terms/) })
  expect(validateRegistration({ ...base, email: 'a@b.co', password: 'weak', confirmPassword: 'weak' })).toMatchObject({ ok: false })
  expect(maskDestination('email', 'ada@example.com')).toBe('ad…@example.com')
  expect(maskDestination('phone', '+15551234567')).toBe('+15…67')
})

test('an emailed code (or its link) approves the account; wrong, expired and reused codes do not', async () => {
  const s = setup()
  const ada = s.add({ id: 1, user_name: 'ada', email: 'ada@example.com' })
  const started = await s.confirmation.start(ada, 'email')
  expect(started).toEqual({ channel: 'email', destination: 'ad…@example.com' })
  expect(s.emails).toHaveLength(1)
  const { code, url } = s.emails[0]!
  expect(url).toMatch(/^https:\/\/fos\.test\/\?confirm-email-token=[0-9a-f]{96}$/)
  expect(s.users.get(1)!.confirmation_code_hash).toBe(hashCode(code, 'ada', 'test-secret'))
  expect((await s.call(s.confirmation.confirm, { username: 'ada', code: '000000' })).body.error).toBe('Wrong code.')
  expect((await s.call(s.confirmation.confirm, { username: 'nobody', code })).status).toBe(404)
  const ok = await s.call(s.confirmation.confirm, { username: 'ada', code })
  expect(ok.body).toEqual({ confirmed: true, username: 'ada' })
  expect(s.users.get(1)).toMatchObject({ approved: true, confirmation_code_hash: null, email_confirmation_token: null })
  expect(s.linked).toEqual([])
  expect((await s.call(s.confirmation.confirm, { username: 'ada', code })).body).toEqual({ confirmed: true, already: true })
  // the link works too, once
  const bob = s.add({ id: 2, user_name: 'bob', email: 'bob@example.com' })
  await s.confirmation.start(bob, 'email')
  const token = new URL(s.emails[1]!.url).searchParams.get('confirm-email-token')!
  expect((await s.call(s.confirmation.confirm, { token })).body).toEqual({ confirmed: true, username: 'bob' })
  expect((await s.call(s.confirmation.confirm, { token })).status).toBe(404)
  // expiry
  const cy = s.add({ id: 3, user_name: 'cy', email: 'cy@example.com' })
  await s.confirmation.start(cy, 'email')
  s.tick(16 * 60_000)
  const late = await s.call(s.confirmation.confirm, { username: 'cy', code: s.emails[2]!.code })
  expect([late.status, late.body.code]).toEqual([410, 'expired'])
})

test('a texted code approves the account and links the phone; resend issues a fresh code; no SMS means email only', async () => {
  const s = setup()
  const dee = s.add({ id: 4, user_name: 'dee', phone: '+15551234567' })
  await s.confirmation.start(dee, 'phone')
  expect(s.texts[0]).toMatchObject({ to: '+15551234567' })
  const first = s.texts[0]!.text.match(/\d{6}/)![0]
  const resent = await s.call(s.confirmation.resend, { username: 'dee' })
  expect(resent.body).toEqual({ sent: true, channel: 'phone', destination: '+15…67' })
  const second = s.texts[1]!.text.match(/\d{6}/)![0]
  expect((await s.call(s.confirmation.confirm, { username: 'dee', code: first })).body.error).toBe('Wrong code.')
  expect((await s.call(s.confirmation.confirm, { username: 'dee', code: second })).body).toEqual({ confirmed: true, username: 'dee' })
  expect(s.linked).toEqual([{ userId: 4, number: '+15551234567' }])
  expect(s.confirmation.pending(s.users.get(4)!)).toBeNull()
  // unknown names and confirmed accounts get the same answer from resend
  expect((await s.call(s.confirmation.resend, { username: 'ghost' })).body).toEqual({ sent: true })
  const noSms = setup(false)
  const eve = noSms.add({ id: 5, user_name: 'eve', phone: '+15550000000' })
  await expect(noSms.confirmation.start(eve, 'phone')).rejects.toThrow(/Texting is not configured/)
})
