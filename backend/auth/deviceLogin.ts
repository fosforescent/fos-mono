/**
 * Browser sign-in for a device that has no browser of its own (the `fos` CLI
 * in the home directory). Works with any login the web app supports (password
 * today, SSO/SAML once the web app has it): the device never sees credentials.
 *
 *   device   POST /auth/device/start {name}        → {code, verifyUrl}; opens verifyUrl in a browser
 *   browser  signs in, then  GET  /user/data/device-login/:code  → {name, status}
 *            POST /user/data/device-login/:code/approve|deny
 *   device   GET  /auth/device/poll?code=           → pending | approved {jwt, username} | denied | expired
 *
 * Codes live in memory for ten minutes; the granted JWT is a normal user JWT.
 */

import { randomBytes } from 'node:crypto'
import * as jsonwebtoken from 'jsonwebtoken'
import type { Request, Response } from 'express'

const jwtSign: typeof jsonwebtoken.sign = jsonwebtoken.sign ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.sign

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not set')
}

export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000
export const DEVICE_JWT_TTL_S = 30 * 24 * 60 * 60

type DeviceLogin = {
  code: string
  name: string
  status: 'pending' | 'approved' | 'denied'
  username: string | null
  jwt: string | null
  createdAt: number
}

const pending = new Map<string, DeviceLogin>()

function prune(now: number): void {
  for (const [code, entry] of pending) {
    if (now - entry.createdAt > DEVICE_CODE_TTL_MS) pending.delete(code)
  }
}

function newCode(): string {
  // 8 unambiguous characters, grouped for reading aloud: ABCD-EFGH
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[(bytes[i] as number) % alphabet.length]
  return `${out.slice(0, 4)}-${out.slice(4)}`
}

function normalizeCode(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2')
}

export function webUrl(): string {
  return (process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5199').replace(/\/$/, '')
}

export const deviceLoginHandlers = {
  start(req: Request, res: Response): Response {
    prune(Date.now())
    const name = String((req.body as { name?: unknown })?.name ?? 'a device').slice(0, 80)
    let code = newCode()
    while (pending.has(code)) code = newCode()
    pending.set(code, { code, name, status: 'pending', username: null, jwt: null, createdAt: Date.now() })
    return res.json({ code, verifyUrl: `${webUrl()}/?device=${encodeURIComponent(code)}`, expiresInMs: DEVICE_CODE_TTL_MS })
  },

  poll(req: Request, res: Response): Response {
    prune(Date.now())
    const entry = pending.get(normalizeCode(req.query.code))
    if (!entry) return res.json({ status: 'expired' })
    if (entry.status === 'approved') {
      pending.delete(entry.code) // deliver once
      return res.json({ status: 'approved', jwt: entry.jwt, username: entry.username })
    }
    return res.json({ status: entry.status })
  },

  /** Authenticated: what the browser shows before approving. */
  describe(req: Request, res: Response): Response {
    prune(Date.now())
    const entry = pending.get(normalizeCode(req.params.code))
    if (!entry) return res.status(404).json({ error: 'That code is unknown or expired' })
    return res.json({ code: entry.code, name: entry.name, status: entry.status })
  },

  /** Authenticated: mint a user JWT for the device. */
  approve(req: Request, res: Response): Response {
    prune(Date.now())
    const entry = pending.get(normalizeCode(req.params.code))
    if (!entry || entry.status !== 'pending') return res.status(404).json({ error: 'That code is unknown, expired or already used' })
    const username = (req as Request & { claims: { username: string; kind?: string } }).claims.username
    const claims = { username, exp: Math.floor(Date.now() / 1000) + DEVICE_JWT_TTL_S, device: entry.name }
    entry.jwt = jwtSign(claims, JWT_SECRET)
    entry.username = username
    entry.status = 'approved'
    return res.json({ approved: true, name: entry.name })
  },

  deny(req: Request, res: Response): Response {
    const entry = pending.get(normalizeCode(req.params.code))
    if (!entry) return res.status(404).json({ error: 'That code is unknown or expired' })
    entry.status = 'denied'
    return res.json({ denied: true })
  }
}

/** For tests. */
export function _resetDeviceLogins(): void {
  pending.clear()
}
