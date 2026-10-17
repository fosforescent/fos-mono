import type { Request, Response } from 'express'
import { createIntegrationHandlers, type IntegrationDeps, type StoredConnection } from './routes'
import { decryptSecret, encryptSecret, hashCode, readState, signState } from './secrets'
import { parseTwilioWebhook, verifyTwilioSignature, normalizePhone } from '../channels/sms'
import { createHmac } from 'node:crypto'

type Call = { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }

function fakeDeps(answers: Array<{ match: RegExp; status?: number; json: unknown }> = []) {
  const stored = new Map<string, StoredConnection>()
  const calls: Call[] = []
  const texts: Array<[string, string]> = []
  const deps: IntegrationDeps = {
    env: { INTEGRATION_SECRET: 'top-secret', API_URL: 'https://api.test', WEB_URL: 'https://web.test', GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret', GOOGLE_OAUTH_CLIENT_ID: 'g-id', GOOGLE_OAUTH_CLIENT_SECRET: 'g-secret' },
    async fetch(url, init) {
      calls.push({ url, init })
      const a = answers.find((x) => x.match.test(url))
      if (!a) return { ok: false, status: 404, json: async () => ({ message: 'no fake answer' }), text: async () => '' }
      return { ok: (a.status ?? 200) < 400, status: a.status ?? 200, json: async () => a.json, text: async () => JSON.stringify(a.json) }
    },
    userId: async (req) => (req as unknown as { userId: number }).userId,
    platformConnected: async (_id, provider) => ({ connected: provider === 'stripe', accountName: provider === 'stripe' ? 'cus_1' : null }),
    offers: (id) => (id === 'github' ? ['repo'] : id === 'phone' ? ['notify'] : []),
    connections: {
      list: async (id) => [...stored.entries()].filter(([k]) => k.startsWith(`${id}:`)).map(([, v]) => v),
      get: async (id, provider) => stored.get(`${id}:${provider}`) ?? null,
      put: async (id, c) => { stored.set(`${id}:${c.provider}`, c) },
      remove: async (id, provider) => { stored.delete(`${id}:${provider}`) },
      userByPhone: async (number) => { for (const [k, v] of stored) if (v.provider === 'phone' && v.accountName === number && v.metadata.verified === true) return Number(k.split(':')[0]); return null }
    },
    complete: async (_system, user) => `answer to: ${user}`,
    sms: async (to, text) => { texts.push([to, text]) },
    now: () => 1_760_000_000_000
  }
  return { deps, stored, calls, texts }
}

function call(handler: (req: Request, res: Response) => Promise<unknown>, userId: number, { params = {}, query = {}, body = {} }: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {}) {
  let status = 200
  let json: any
  let redirected: string | null = null
  const res = { status(c: number) { status = c; return res }, json(v: unknown) { json = v; return res }, redirect(url: string) { redirected = url } } as unknown as Response
  const req = { userId, params, query, body } as unknown as Request
  return handler(req, res).then(() => ({ status, json, redirected }))
}

test('secrets round-trip and signed state expires', () => {
  const stored = encryptSecret('{"access_token":"t"}', 'k')
  expect(stored.startsWith('v1.')).toBe(true)
  expect(decryptSecret(stored, 'k')).toBe('{"access_token":"t"}')
  expect(() => decryptSecret(stored, 'other')).toThrow()
  const state = signState({ userId: 7, provider: 'github', at: 1000 }, 'k')
  expect(readState(state, 'k', 60_000, 50_000)).toEqual({ userId: 7, provider: 'github', at: 1000 })
  expect(readState(state, 'k', 60_000, 70_000)).toBeNull()
  expect(readState(state + 'x', 'k', 60_000, 50_000)).toBeNull()
  expect(readState(signState({ userId: 7, provider: 'github', at: 1000 }, 'other'), 'k', 60_000, 50_000)).toBeNull()
})

test('list shows every peer with configuration and connection status', async () => {
  const { deps } = fakeDeps()
  const h = createIntegrationHandlers(deps)
  const { json } = await call(h.list, 1)
  const byId = Object.fromEntries(json.providers.map((p: any) => [p.id, p]))
  expect(byId.github).toMatchObject({ kind: 'oauth', configured: true, connected: false, provides: ['repo'] })
  expect(byId.google).toMatchObject({ kind: 'oauth', provides: [] })
  expect(byId.discord).toBeUndefined()
  expect(byId.stripe).toMatchObject({ kind: 'platform', connected: true, accountName: 'cus_1' })
  expect(byId.phone).toMatchObject({ kind: 'channel', configured: true, connected: false, pending: false, provides: ['notify'], consumes: [] })
})

test('OAuth: start builds the authorize URL, the callback exchanges the code, stores encrypted tokens and redirects back', async () => {
  const { deps, stored, calls } = fakeDeps([
    { match: /github\.com\/login\/oauth\/access_token/, json: { access_token: 'gh-token', scope: 'repo,read:user', token_type: 'bearer' } },
    { match: /api\.github\.com\/user$/, json: { login: 'ada' } }
  ])
  const h = createIntegrationHandlers(deps)
  const start = await call(h.start, 7, { params: { provider: 'github' } })
  expect(start.status).toBe(200)
  const url = new URL(start.json.url)
  expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize')
  expect(url.searchParams.get('redirect_uri')).toBe('https://api.test/integrations/github/callback')
  expect(url.searchParams.get('scope')).toBe('repo read:user')
  const state = url.searchParams.get('state') as string
  // an unconfigured provider refuses
  const unconfigured = createIntegrationHandlers({ ...deps, env: { ...deps.env, GOOGLE_OAUTH_CLIENT_ID: undefined } })
  expect((await call(unconfigured.start, 7, { params: { provider: 'google' } })).status).toBe(503)

  const cb = await call(h.callback, 0, { params: { provider: 'github' }, query: { code: 'the-code', state } })
  expect(cb.redirected).toBe('https://web.test/?integration=github&ok=1')
  const exchange = calls.find((c) => /access_token/.test(c.url))!
  expect(exchange.init?.body).toContain('code=the-code')
  expect(exchange.init?.body).toContain('client_secret=gh-secret')
  const conn = stored.get('7:github')!
  expect(conn).toMatchObject({ provider: 'github', kind: 'oauth', accountName: 'ada', scopes: 'repo,read:user' })
  expect(conn.secret).not.toContain('gh-token')
  expect(JSON.parse(decryptSecret(conn.secret, 'top-secret'))).toEqual({ access_token: 'gh-token' })
  // a tampered state is refused
  const bad = await call(h.callback, 0, { params: { provider: 'github' }, query: { code: 'x', state: state + 'z' } })
  expect(bad.redirected).toContain('ok=0')
  const list = await call(h.list, 7)
  expect(list.json.providers.find((p: any) => p.id === 'github')).toMatchObject({ connected: true, accountName: 'ada' })
  // disconnect forgets it
  await call(h.disconnect, 7, { params: { provider: 'github' } })
  expect(stored.has('7:github')).toBe(false)
})

test('repo and calendar effects use the stored tokens; refresh happens when a token has expired', async () => {
  const { deps, stored, calls } = fakeDeps([
    { match: /api\.github\.com\/repos\/ada\/site\/issues/, status: 201, json: { html_url: 'https://github.com/ada/site/issues/12', number: 12 } },
    { match: /oauth2\.googleapis\.com\/token/, json: { access_token: 'g-fresh', expires_in: 3600 } },
    { match: /calendar\/v3\/calendars\/primary\/events/, json: { id: 'ev1', htmlLink: 'https://calendar.google.com/ev1' } }
  ])
  const h = createIntegrationHandlers(deps)
  await expect(h.createIssue(7, { repo: 'ada/site', title: 'fix login' })).rejects.toThrow(/not connected/)
  stored.set('7:github', { provider: 'github', kind: 'oauth', accountName: 'ada', secret: encryptSecret(JSON.stringify({ access_token: 'gh-token' }), 'top-secret'), scopes: '', expiresAt: null, metadata: {} })
  const issue = await h.createIssue(7, { repo: 'ada/site', title: 'fix login', body: 'from the tree' })
  expect(issue).toEqual({ url: 'https://github.com/ada/site/issues/12', number: 12 })
  expect(calls.find((c) => /issues/.test(c.url))!.init?.headers?.Authorization).toBe('Bearer gh-token')
  await expect(h.createIssue(7, { repo: 'not a repo', title: 'x' })).rejects.toThrow(/repo/)

  // Google: expired access token, refresh token present → refreshed before the call
  stored.set('7:google', { provider: 'google', kind: 'oauth', accountName: 'ada@x', secret: encryptSecret(JSON.stringify({ access_token: 'g-old', refresh_token: 'g-refresh' }), 'top-secret'), scopes: '', expiresAt: new Date(1_760_000_000_000 - 1000), metadata: {} })
  const event = await h.createCalendarEvent(7, { summary: 'standup', start: 1_760_000_000_000, end: 1_760_003_600_000 })
  expect(event).toEqual({ url: 'https://calendar.google.com/ev1', id: 'ev1' })
  expect(calls.find((c) => /googleapis\.com\/token/.test(c.url))!.init?.body).toContain('refresh_token=g-refresh')
  expect(calls.find((c) => /calendars\/primary/.test(c.url))!.init?.headers?.Authorization).toBe('Bearer g-fresh')
  expect(JSON.parse(decryptSecret(stored.get('7:google')!.secret, 'top-secret'))).toEqual({ access_token: 'g-fresh', refresh_token: 'g-refresh' })
})

test('phone channel: a code is texted and verifying links the number', async () => {
  const { deps, stored, texts } = fakeDeps()
  const h = createIntegrationHandlers(deps)
  expect((await call(h.phoneStart, 7, { body: { number: 'nope' } })).status).toBe(400)
  const started = await call(h.phoneStart, 7, { body: { number: '+1 (555) 123-4567' } })
  expect(started.json).toEqual({ ok: true, number: '+15551234567' })
  expect(texts[0]![0]).toBe('+15551234567')
  const code = texts[0]![1].match(/\d{6}/)![0]
  expect(stored.get('7:phone')!.metadata).toMatchObject({ verified: false, codeHash: hashCode(code, String(1_760_000_000_000), 'top-secret') })
  expect((await call(h.phoneVerify, 7, { body: { code: '000000' } })).status).toBe(400)
  expect((await call(h.phoneVerify, 7, { body: { code } })).json).toEqual({ ok: true, number: '+15551234567' })
  expect((await call(h.list, 7)).json.providers.find((p: any) => p.id === 'phone')).toMatchObject({ connected: true, accountName: '+15551234567' })
  expect(await h.notifyUser(7, 'hello')).toBe(true)
  expect(texts.at(-1)).toEqual(['+15551234567', 'hello'])
  expect(await h.notifyUser(8, 'hello')).toBe(false)
})

test('Twilio webhook parsing and signature', () => {
  expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567')
  expect(normalizePhone('123')).toBeNull()
  expect(parseTwilioWebhook({ From: '+15551234567', Body: ' hi ', MessageSid: 'SM1' })).toMatchObject({ source: 'sms', id: 'SM1', from: '+15551234567', replyTo: '+15551234567', text: 'hi' })
  expect(parseTwilioWebhook({ From: '+15551234567', Body: '' })).toBeNull()
  const url = 'https://api.test/channels/sms/webhook'
  const params = { From: '+15551234567', Body: 'hi', MessageSid: 'SM1' }
  const sig = createHmac('sha1', 'tok').update(url + 'BodyhiFrom+15551234567MessageSidSM1').digest('base64')
  expect(verifyTwilioSignature('tok', url, params, sig)).toBe(true)
  expect(verifyTwilioSignature('other', url, params, sig)).toBe(false)
  expect(verifyTwilioSignature('tok', url, params, undefined)).toBe(false)
})
