/**
 * WhatsApp Business (Cloud API) adapter: webhook routes for inbound messages
 * and Graph API calls for outbound ones.
 *
 * Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN (the
 * string you type into Meta's webhook setup; WEBHOOK_VERIFY_TOKEN still works),
 * WHATSAPP_APP_SECRET (optional; when set, X-Hub-Signature-256 is verified).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import type { ChannelAdapter, InboundMessage } from './types'
import type { ChannelBus } from './bus'

export type WhatsAppConfig = {
  token?: string
  phoneNumberId?: string
  verifyToken?: string
  appSecret?: string
  graphVersion?: string
  fetchImpl?: typeof fetch
}

export function whatsAppConfigFromEnv(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig {
  return {
    token: env.WHATSAPP_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? env.WEBHOOK_VERIFY_TOKEN,
    appSecret: env.WHATSAPP_APP_SECRET
  }
}

type WebhookBody = {
  entry?: Array<{
    changes?: Array<{
      field?: string
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>
        messages?: Array<{ id: string; from: string; timestamp?: string; type?: string; text?: { body?: string } }>
      }
    }>
  }>
}

/** Text messages in a webhook payload, as inbound messages. */
export function parseWhatsAppWebhook(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = []
  const entries = (body as WebhookBody | null)?.entry ?? []
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const names = new Map<string, string>()
      for (const c of change.value?.contacts ?? []) if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name)
      for (const m of change.value?.messages ?? []) {
        if (m.type !== 'text' || typeof m.text?.body !== 'string') continue
        const seconds = Number(m.timestamp)
        out.push({
          source: 'whatsapp',
          id: m.id,
          from: m.from,
          fromName: names.get(m.from),
          replyTo: m.from,
          text: m.text.body,
          timestamp: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString()
        })
      }
    }
  }
  return out
}

export function verifyWhatsAppSignature(appSecret: string, rawBody: Buffer | string, header: string | undefined): boolean {
  if (!header || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const given = header.slice('sha256='.length)
  if (given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'))
}

export function createWhatsAppAdapter(config: WhatsAppConfig): ChannelAdapter {
  // resolved per call so test environments without a global fetch can still load the module
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((...args) => globalThis.fetch(...args))
  const version = config.graphVersion ?? 'v21.0'
  return {
    source: 'whatsapp',
    configured: () => !!(config.token && config.phoneNumberId),
    ready: () => !!(config.token && config.phoneNumberId),
    async send(to, text) {
      const response = await fetchImpl(`https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body: text } })
      })
      if (!response.ok) throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`)
      const data = (await response.json()) as { messages?: Array<{ id?: string }> }
      return { id: data.messages?.[0]?.id ?? null }
    }
  }
}

/** Express handlers for GET/POST /channels/whatsapp/webhook. */
export function createWhatsAppWebhook(config: WhatsAppConfig, bus: ChannelBus) {
  return {
    verify(req: Request, res: Response): Response {
      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']
      if (mode === 'subscribe' && config.verifyToken && token === config.verifyToken && typeof challenge === 'string') {
        return res.status(200).send(challenge)
      }
      return res.sendStatus(403)
    },
    async receive(req: Request, res: Response): Promise<Response> {
      if (config.appSecret) {
        const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))
        if (!verifyWhatsAppSignature(config.appSecret, raw, req.header('x-hub-signature-256'))) return res.sendStatus(401)
      }
      const messages = parseWhatsAppWebhook(req.body)
      // Meta retries on anything but a fast 200; dispatch after acknowledging.
      res.sendStatus(200)
      for (const message of messages) await bus.inbound(message)
      return res
    }
  }
}
