/**
 * OAuth tokens of integration connections are stored encrypted (AES-256-GCM) under a key derived from
 * INTEGRATION_SECRET (or, failing that, JWT_SECRET). The ciphertext is `v1.<iv>.<tag>.<data>` in base64url.
 * The OAuth `state` and the phone verification code are HMAC-signed with the same secret.
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`
}

export function decryptSecret(stored: string, secret: string): string {
  const [v, iv, tag, data] = stored.split('.')
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('unreadable integration secret')
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

/** OAuth `state`: who started the flow and when, signed so the callback can trust it without a session. */
export function signState(payload: { userId: number; provider: string; at: number }, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function readState(state: string, secret: string, maxAgeMs = 15 * 60_000, now = Date.now()): { userId: number; provider: string; at: number } | null {
  const [body, mac] = state.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { userId?: unknown; provider?: unknown; at?: unknown }
    if (typeof payload.userId !== 'number' || typeof payload.provider !== 'string' || typeof payload.at !== 'number') return null
    if (now - payload.at > maxAgeMs) return null
    return { userId: payload.userId, provider: payload.provider, at: payload.at }
  } catch {
    return null
  }
}

/** A six-digit code for phone verification, and its keyed hash (what is stored). */
export function makeCode(): string {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000))
}

export function hashCode(code: string, salt: string, secret: string): string {
  return createHmac('sha256', secret).update(`${salt}:${code}`).digest('base64url')
}
