import { githubRepository } from './repository'
/**
 * Integration peers: sign-in flows, the phone channel, and the handlers the peers provide.
 *
 *   GET    /user/integrations                      every peer with its status for this account
 *   GET    /user/integrations/:provider/start      OAuth: the authorize URL to send the browser to
 *   GET    /integrations/:provider/callback        OAuth (public): code → tokens, stored; redirects to the web app
 *   DELETE /user/integrations/:provider            forget the connection (or the phone)
 *   POST   /user/integrations/phone                { number } → a code is texted to it
 *   POST   /user/integrations/phone/verify         { code } → the phone peer is linked
 *   POST   /user/integrations/llm                  { prompt, system? } → { text, model }      (the fos server's own model)
 *   POST   /user/integrations/repo/issue           { repo: "owner/name", title, body? } → { url, number }   (GitHub)
 *   POST   /user/integrations/calendar/event       { summary, description?, start, end } → { url, id }     (Google)
 *
 * Inbound texts (`createSmsInbound`) become rows in the sender's tree: "done <words>" checks off the first open
 * task matching them, "list" texts back the open tasks, anything else is added as a row at the root
 * ("[ ] …" makes a task). `notifyUser` texts a linked phone.
 *
 * Everything outside (fetch, storage, the model, clock, env) comes through `deps` so the flows can be tested
 * without a network.
 */

import type { Request, Response } from 'express'
import { PROVIDERS, providerById, type Provider } from './providers'
import { decryptSecret, encryptSecret, hashCode, makeCode, readState, signState } from './secrets'
import { normalizePhone } from '../channels/sms'
import type { InboundMessage } from '../channels/types'

export type StoredConnection = { provider: string; kind: string; accountName: string | null; secret: string; scopes: string; expiresAt: Date | null; metadata: Record<string, unknown> }

export type IntegrationDeps = {
  env: Record<string, string | undefined>
  fetch: (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>
  userId(req: Request): Promise<number>
  /** Platform-level connections (Stripe): is the account set up with it? */
  platformConnected(userId: number, provider: string): Promise<{ connected: boolean; accountName: string | null }>
  connections: {
    list(userId: number): Promise<StoredConnection[]>
    get(userId: number, provider: string): Promise<StoredConnection | null>
    put(userId: number, c: StoredConnection): Promise<void>
    remove(userId: number, provider: string): Promise<void>
    /** The user a verified phone number belongs to. */
    userByPhone(number: string): Promise<number | null>
  }
  /** The fos server's own language model (OPENAI_API_KEY / Vertex, as the voice notes use). */
  complete(system: string, user: string): Promise<string>
  /** Text a phone number (the SMS channel adapter); null when the platform has no number. */
  sms: ((to: string, text: string) => Promise<void>) | null
  /** Rows of a user's tree, for texted commands. */
  rows: {
    add(userId: number, text: string): Promise<string>
    listOpen(userId: number, limit: number): Promise<string[]>
    markDone(userId: number, words: string): Promise<string | null>
  }
  now?: () => number
}

type OAuthTokens = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string }

export function createIntegrationHandlers(deps: IntegrationDeps) {
  const now = () => (deps.now ? deps.now() : Date.now())
  const secret = () => deps.env.INTEGRATION_SECRET || deps.env.JWT_SECRET || ''
  const apiBase = () => (deps.env.API_URL || deps.env.PUBLIC_API_URL || '').replace(/\/$/, '')
  const webBase = () => (deps.env.WEB_URL || '').replace(/\/$/, '')
  const configured = (p: Provider) => (p.kind === 'oauth' ? !!(p.oauth && deps.env[p.oauth.clientIdEnv] && deps.env[p.oauth.clientSecretEnv] && apiBase()) : p.kind === 'channel' ? !!deps.sms : true)
  const redirectUri = (p: Provider) => `${apiBase()}/integrations/${p.id}/callback`

  async function readSecret(userId: number, providerId: string): Promise<{ conn: StoredConnection; data: Record<string, string> } | null> {
    const conn = await deps.connections.get(userId, providerId)
    if (!conn) return null
    try { return { conn, data: JSON.parse(decryptSecret(conn.secret, secret())) as Record<string, string> } } catch { return null }
  }

  /** A valid OAuth access token for `p`, refreshed through the refresh token when it has expired. */
  async function accessToken(userId: number, p: Provider): Promise<string | null> {
    const read = await readSecret(userId, p.id)
    if (!read || !p.oauth) return null
    const { conn, data } = read
    const expired = conn.expiresAt ? conn.expiresAt.getTime() - 60_000 < now() : false
    if (!expired || !data.refresh_token) return data.access_token ?? null
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token, client_id: deps.env[p.oauth.clientIdEnv] ?? '', client_secret: deps.env[p.oauth.clientSecretEnv] ?? '' })
    const res = await deps.fetch(p.oauth.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString() })
    if (!res.ok) return null
    const tokens = (await res.json()) as OAuthTokens
    if (!tokens.access_token) return null
    const next = { ...data, access_token: tokens.access_token, ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}) }
    await deps.connections.put(userId, { ...conn, secret: encryptSecret(JSON.stringify(next), secret()), expiresAt: tokens.expires_in ? new Date(now() + tokens.expires_in * 1000) : conn.expiresAt })
    return tokens.access_token
  }

  /** The account name to show for a fresh OAuth connection. */
  async function profileName(p: Provider, token: string): Promise<string | null> {
    try {
      if (p.id === 'github') { const r = await deps.fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'fosforescent' } }); const j = (await r.json()) as { login?: string }; return j.login ?? null }
      if (p.id === 'google') { const r = await deps.fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } }); const j = (await r.json()) as { email?: string }; return j.email ?? null }
      if (p.id === 'discord') { const r = await deps.fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } }); const j = (await r.json()) as { username?: string }; return j.username ?? null }
    } catch { /* the name is cosmetic */ }
    return null
  }

  function fail(res: Response, status: number, error: string): Response { return res.status(status).json({ error }) }

  return {
    /** Every peer, with whether the server can run its flow and whether this account is connected. */
    async list(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const stored = await deps.connections.list(userId)
      const out = []
      for (const p of PROVIDERS) {
        const conn = stored.find((c) => c.provider === p.id)
        const platform = p.kind === 'platform' ? await deps.platformConnected(userId, p.id) : null
        const verified = p.kind === 'channel' ? conn?.metadata.verified === true : true
        out.push({
          id: p.id, name: p.name, kind: p.kind, provides: p.provides, consumes: p.consumes,
          configured: configured(p),
          connected: platform ? platform.connected : !!conn && verified,
          pending: p.kind === 'channel' && !!conn && !verified,
          accountName: platform ? platform.accountName : conn?.accountName ?? null
        })
      }
      return res.json({ providers: out })
    },

    /** OAuth: where to send the browser. The state carries the user id, signed, so the public callback can trust it. */
    async start(req: Request, res: Response): Promise<Response> {
      const p = providerById(String(req.params.provider ?? ''))
      if (!p || !p.oauth) return fail(res, 404, 'unknown OAuth provider')
      if (!configured(p)) return fail(res, 503, `${p.name} sign-in is not configured on this server (${p.oauth.clientIdEnv}, ${p.oauth.clientSecretEnv}, API_URL)`)
      const userId = await deps.userId(req)
      const state = signState({ userId, provider: p.id, at: now() }, secret())
      const params = new URLSearchParams({ client_id: deps.env[p.oauth.clientIdEnv] ?? '', redirect_uri: redirectUri(p), response_type: 'code', scope: p.oauth.scopes.join(' '), state, ...(p.oauth.extra ?? {}) })
      return res.json({ url: `${p.oauth.authorizeUrl}?${params.toString()}` })
    },

    /** OAuth callback (no session): verify the state, exchange the code, store the tokens, send the browser back to the app. */
    async callback(req: Request, res: Response): Promise<void> {
      const p = providerById(String(req.params.provider ?? ''))
      const back = (ok: boolean, message?: string) => { res.redirect(`${webBase() || ''}/?integration=${encodeURIComponent(p?.id ?? '')}&ok=${ok ? '1' : '0'}${message ? `&message=${encodeURIComponent(message)}` : ''}`) }
      if (!p || !p.oauth) { res.status(404).json({ error: 'unknown OAuth provider' }); return }
      const state = readState(String(req.query.state ?? ''), secret(), 15 * 60_000, now())
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      if (!state || state.provider !== p.id) { back(false, 'the sign-in link expired or was not started here'); return }
      if (!code) { back(false, typeof req.query.error === 'string' ? req.query.error : 'no code returned'); return }
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(p), client_id: deps.env[p.oauth.clientIdEnv] ?? '', client_secret: deps.env[p.oauth.clientSecretEnv] ?? '' })
      let tokens: OAuthTokens
      try {
        const r = await deps.fetch(p.oauth.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: p.oauth.tokenAccept ?? 'application/json' }, body: body.toString() })
        tokens = (await r.json()) as OAuthTokens
        if (!r.ok || !tokens.access_token) { back(false, `${p.name} did not return a token`); return }
      } catch (error) {
        back(false, error instanceof Error ? error.message : String(error)); return
      }
      const accountName = await profileName(p, tokens.access_token)
      const data: Record<string, string> = { access_token: tokens.access_token, ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}) }
      await deps.connections.put(state.userId, { provider: p.id, kind: 'oauth', accountName, secret: encryptSecret(JSON.stringify(data), secret()), scopes: tokens.scope ?? p.oauth.scopes.join(' '), expiresAt: tokens.expires_in ? new Date(now() + tokens.expires_in * 1000) : null, metadata: {} })
      back(true)
    },

    async disconnect(req: Request, res: Response): Promise<Response> {
      const p = providerById(String(req.params.provider ?? ''))
      if (!p) return fail(res, 404, 'unknown provider')
      if (p.kind === 'platform') return fail(res, 400, `${p.name} is set up on the account, not as a connection`)
      await deps.connections.remove(await deps.userId(req), p.id)
      return res.json({ ok: true })
    },

    /** The phone channel: a code is texted to the number; the peer is linked once it is typed back. */
    async phoneStart(req: Request, res: Response): Promise<Response> {
      if (!deps.sms) return fail(res, 503, 'texting is not configured on this server (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)')
      const userId = await deps.userId(req)
      const number = normalizePhone(String((req.body as { number?: unknown } | undefined)?.number ?? ''))
      if (!number) return fail(res, 400, 'a phone number with country code is required (+15551234567)')
      const code = makeCode()
      const salt = String(now())
      await deps.connections.put(userId, { provider: 'phone', kind: 'channel', accountName: number, secret: encryptSecret('{}', secret()), scopes: '', expiresAt: new Date(now() + 10 * 60_000), metadata: { verified: false, codeHash: hashCode(code, salt, secret()), salt } })
      try { await deps.sms(number, `fos: your code is ${code}`) } catch (error) { return fail(res, 502, `could not text ${number}: ${error instanceof Error ? error.message : String(error)}`) }
      return res.json({ ok: true, number })
    },

    async phoneVerify(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const conn = await deps.connections.get(userId, 'phone')
      const code = String((req.body as { code?: unknown } | undefined)?.code ?? '').trim()
      if (!conn || conn.metadata.verified === true) return fail(res, 400, 'no phone verification in progress')
      if (conn.expiresAt && conn.expiresAt.getTime() < now()) return fail(res, 400, 'the code expired; start again')
      if (!code || hashCode(code, String(conn.metadata.salt ?? ''), secret()) !== conn.metadata.codeHash) return fail(res, 400, 'wrong code')
      await deps.connections.put(userId, { ...conn, expiresAt: null, metadata: { verified: true } })
      return res.json({ ok: true, number: conn.accountName })
    },

    /** The llm capability: the fos server's own model answers about a task. */
    async llm(req: Request, res: Response): Promise<Response> {
      await deps.userId(req)
      const body = (req.body ?? {}) as { prompt?: unknown; system?: unknown }
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      if (!prompt) return fail(res, 400, 'prompt required')
      if (prompt.length > 20_000) return fail(res, 400, 'prompt exceeds 20,000 characters; narrow the task context')
      const system = typeof body.system === 'string' ? body.system.slice(0, 4000) : 'You help with a task list. Answer briefly and concretely; use markdown lists when listing.'
      try {
        const text = (await deps.complete(system, prompt)).trim()
        return res.json({ text, model: deps.env.VOICE_SUMMARY_MODEL || 'default' })
      } catch (error) {
        return fail(res, 502, `model: ${error instanceof Error ? error.message : String(error)}`)
      }
    },

    /** The repo capability: a GitHub issue from a task. */
    async repoIssue(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const token = await accessToken(userId, providerById('github') as Provider)
      if (!token) return fail(res, 409, 'GitHub is not connected: sign in with it on its peer row')
      const body = (req.body ?? {}) as { repo?: unknown; title?: unknown; body?: unknown }
      const repo = typeof body.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(body.repo) ? body.repo : ''
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 256) : ''
      if (!repo || !title) return fail(res, 400, 'repo (owner/name) and title required')
      const r = await deps.fetch(`https://api.github.com/repos/${repo}/issues`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'fosforescent' }, body: JSON.stringify({ title, body: typeof body.body === 'string' ? body.body.slice(0, 60_000) : '' }) })
      const j = (await r.json()) as { html_url?: string; number?: number; message?: string }
      if (!r.ok || !j.html_url) return fail(res, 502, `GitHub: ${j.message ?? r.status}`)
      return res.json({ url: j.html_url, number: j.number })
    },

    /** Repository metadata uses the same GitHub OAuth peer as issue creation. */
    async repository(req: Request, res: Response): Promise<Response> {
      const token = await accessToken(await deps.userId(req), providerById('github') as Provider)
      if (!token) return fail(res, 409, 'GitHub is not connected: sign in with it on its peer row')
      const body = (req.body ?? {}) as Record<string, unknown>
      try {
        const repo = githubRepository(deps.fetch, token, String(body.repo ?? ''))
        if (body.action === 'branch') { await repo.createBranch(String(body.name ?? ''), String(body.from ?? '')); return res.json({ ok: true }) }
        if (body.action === 'propose') return res.json(await repo.propose(String(body.head ?? ''), String(body.base ?? ''), String(body.title ?? '')))
        if (body.action === 'merge' || body.action === 'close') {
          await repo.decide(Number(body.number), body.action, String(body.sha ?? ''))
          return res.json({ ok: true })
        }
        if (body.action !== 'read') return fail(res, 400, 'Unknown repository action')
        const tracked = Array.isArray(body.tracked) ? body.tracked.filter((n): n is number => Number.isSafeInteger(n) && n > 0) : []
        if (tracked.length > 100) return fail(res, 400, 'At most 100 tracked pull requests per request')
        return res.json(await repo.snapshot(tracked))
      } catch (error) { return fail(res, 502, error instanceof Error ? error.message : String(error)) }
    },

    /** The calendar capability: a Google Calendar event for a time allocation with a window. */
    async calendarEvent(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const token = await accessToken(userId, providerById('google') as Provider)
      if (!token) return fail(res, 409, 'Google is not connected: sign in with it on its peer row')
      const body = (req.body ?? {}) as { summary?: unknown; description?: unknown; start?: unknown; end?: unknown }
      const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 256) : ''
      const start = typeof body.start === 'number' ? body.start : NaN
      const end = typeof body.end === 'number' ? body.end : NaN
      if (!summary || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fail(res, 400, 'summary, start and end (ms, end after start) required')
      const r = await deps.fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary, description: typeof body.description === 'string' ? body.description.slice(0, 8000) : '', start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } }) })
      const j = (await r.json()) as { htmlLink?: string; id?: string; error?: { message?: string } }
      if (!r.ok || !j.id) return fail(res, 502, `Google Calendar: ${j.error?.message ?? r.status}`)
      return res.json({ url: j.htmlLink ?? null, id: j.id })
    },

    /** Text a user's linked phone (notifications); silently nothing when there is none. */
    async notifyUser(userId: number, text: string): Promise<boolean> {
      if (!deps.sms) return false
      const conn = await deps.connections.get(userId, 'phone')
      if (!conn?.accountName || conn.metadata.verified !== true) return false
      try { await deps.sms(conn.accountName, text); return true } catch (error) { console.error('[sms] notify failed:', error instanceof Error ? error.message : error); return false }
    }
  }
}

/**
 * Inbound texts from linked phones: "done <words>" checks off a task, "list" answers with the open tasks,
 * anything else becomes a row at the root. Unknown numbers get one short reply and nothing else.
 */
export function createSmsInbound(deps: Pick<IntegrationDeps, 'connections' | 'rows' | 'sms'>) {
  return async (message: InboundMessage): Promise<void> => {
    if (message.source !== 'sms' || !deps.sms) return
    const userId = await deps.connections.userByPhone(message.from)
    const reply = (text: string) => deps.sms!(message.replyTo, text)
    if (userId === null) { await reply('fos: this number is not linked to an account. Link it from the app (root › Phone).'); return }
    const text = message.text.trim()
    const done = text.match(/^(?:done|did|finished|✓)\s+(.+)$/i)
    if (done) {
      const title = await deps.rows.markDone(userId, (done[1] as string).trim())
      await reply(title ? `✓ done: ${title}` : `fos: no open task matches “${done[1]}”`)
      return
    }
    if (/^(list|ls|todo|tasks)$/i.test(text)) {
      const open = await deps.rows.listOpen(userId, 8)
      await reply(open.length ? open.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'fos: nothing open')
      return
    }
    const title = await deps.rows.add(userId, text)
    await reply(`fos: added “${title}”`)
  }
}

/** Prisma-backed deps for the real server; the model, the SMS sender and the row access are passed in. */
export function prismaIntegrationDeps(prisma: { integrationConnectionModel: any; userModel: any }, userId: (req: Request) => Promise<number>, extra: Pick<IntegrationDeps, 'complete' | 'sms' | 'rows'>): IntegrationDeps {
  const toStored = (row: any): StoredConnection => ({ provider: row.provider, kind: row.kind, accountName: row.accountName ?? null, secret: row.secret, scopes: row.scopes ?? '', expiresAt: row.expiresAt ?? null, metadata: (row.metadata ?? {}) as Record<string, unknown> })
  return {
    env: process.env,
    fetch: (url, init) => fetch(url, init) as Promise<any>,
    userId,
    ...extra,
    async platformConnected(id, provider) {
      if (provider !== 'stripe') return { connected: false, accountName: null }
      const user = await prisma.userModel.findUnique({ where: { id }, select: { stripe_customer_id: true, stripe_connected_account_id: true, stripe_connect_enabled: true } })
      const connected = !!(user?.stripe_customer_id || (user?.stripe_connected_account_id && user?.stripe_connect_enabled))
      return { connected, accountName: user?.stripe_connected_account_id ?? (user?.stripe_customer_id ? 'customer' : null) }
    },
    connections: {
      async list(id) { return (await prisma.integrationConnectionModel.findMany({ where: { userId: id } })).map(toStored) },
      async get(id, provider) { const row = await prisma.integrationConnectionModel.findUnique({ where: { userId_provider: { userId: id, provider } } }); return row ? toStored(row) : null },
      async put(id, c) {
        const data = { kind: c.kind, accountName: c.accountName, secret: c.secret, scopes: c.scopes, expiresAt: c.expiresAt, metadata: c.metadata }
        await prisma.integrationConnectionModel.upsert({ where: { userId_provider: { userId: id, provider: c.provider } }, update: data, create: { userId: id, provider: c.provider, ...data } })
      },
      async remove(id, provider) { await prisma.integrationConnectionModel.deleteMany({ where: { userId: id, provider } }) },
      async userByPhone(number) {
        const row = await prisma.integrationConnectionModel.findFirst({ where: { provider: 'phone', accountName: number }, select: { userId: true, metadata: true } })
        return row && (row.metadata as { verified?: boolean } | null)?.verified === true ? row.userId : null
      }
    }
  }
}
