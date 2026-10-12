/**
 * SMS adapter on Twilio: outbound texts through the Messages API, inbound texts through Twilio's webhook
 * (form-encoded POST, X-Twilio-Signature verified against the auth token).
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (the platform's number, E.164),
 * API_URL (the public base the webhook is reached at: `${API_URL}/channels/sms/webhook`).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import type { ChannelAdapter, InboundMessage } from './types'
import type { ChannelBus } from './bus'

export type SmsConfig = {
  accountSid?: string
  authToken?: string
  from?: string
  /** Public URL of the webhook, for signature verification. */
  webhookUrl?: string
  fetchImpl?: typeof fetch
}

export function smsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmsConfig {
  const base = (env.API_URL || env.PUBLIC_API_URL || '').replace(/\/$/, '')
  return { accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM, webhookUrl: base ? `${base}/channels/sms/webhook` : undefined }
}

/** E.164-ish: digits with a leading +. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '')
  const m = digits.match(/^\+?(\d{7,15})$/)
  return m ? `+${m[1]}` : null
}

/** Twilio signs url + the form parameters (keys sorted, concatenated) with HMAC-SHA1 of the auth token, base64. */
export function verifyTwilioSignature(authToken: string, url: string, params: Record<string, string>, header: string | undefined): boolean {
  if (!header) return false
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  const expected = createHmac('sha1', authToken).update(data).digest('base64')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A Twilio inbound webhook body as an inbound message (null when it carries no text). */
export function parseTwilioWebhook(body: Record<string, string>): InboundMessage | null {
  const from = normalizePhone(body.From ?? '')
  const text = typeof body.Body === 'string' ? body.Body.trim() : ''
  if (!from || !text) return null
  return { source: 'sms', id: body.MessageSid ?? `sms-${Date.now()}`, from, replyTo: from, text, timestamp: new Date().toISOString() }
}

export function createSmsAdapter(config: SmsConfig): ChannelAdapter {
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((...args) => globalThis.fetch(...args))
  const configured = () => !!(config.accountSid && config.authToken && config.from)
  return {
    source: 'sms',
    configured,
    ready: configured,
    async send(to, text) {
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
      const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid ?? '')}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: config.from ?? '', Body: text.slice(0, 1600) }).toString()
      })
      const json = (await response.json().catch(() => ({}))) as { sid?: string; message?: string }
      if (!response.ok) throw new Error(`Twilio: ${json.message ?? response.status}`)
      return { id: json.sid ?? null }
    }
  }
}

/** The webhook handler: verify the signature (when the auth token is set), hand the text to the bus, answer empty TwiML. */
export function createSmsWebhook(config: SmsConfig, bus: ChannelBus) {
  return async (req: Request, res: Response): Promise<void> => {
    const params = (req.body ?? {}) as Record<string, string>
    if (config.authToken) {
      const url = config.webhookUrl ?? `${req.protocol}://${req.get('host')}${req.originalUrl}`
      if (!verifyTwilioSignature(config.authToken, url, params, req.get('X-Twilio-Signature'))) { res.status(403).send('bad signature'); return }
    }
    const message = parseTwilioWebhook(params)
    if (message) await bus.inbound(message)
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
}
