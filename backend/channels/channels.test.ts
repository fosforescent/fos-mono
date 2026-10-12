// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express') as typeof import('express')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('node:http') as typeof import('node:http')
import { createHmac } from 'node:crypto'
import { ChannelBus } from './bus'
import { createWhatsAppAdapter, parseWhatsAppWebhook, verifyWhatsAppSignature } from './whatsapp'
import { createDiscordAdapter, inboundFromDiscord } from './discord'
import { createChannelsRouter } from './index'

// the backend jest environment has no global fetch; a tiny http client is enough here
function request(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (res) => {
      let text = ''
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
    })
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}

const webhookBody = {
  object: 'whatsapp_business_account',
  entry: [{ id: '1', changes: [{ field: 'messages', value: {
    contacts: [{ wa_id: '15550001111', profile: { name: 'Ada' } }],
    messages: [
      { id: 'wamid.1', from: '15550001111', timestamp: '1760000000', type: 'text', text: { body: 'hello' } },
      { id: 'wamid.2', from: '15550001111', timestamp: '1760000001', type: 'image', image: { id: 'x' } }
    ] } }] }]
}

test('whatsapp webhook payloads become inbound messages (text only)', () => {
  const messages = parseWhatsAppWebhook(webhookBody)
  expect(messages).toEqual([{ source: 'whatsapp', id: 'wamid.1', from: '15550001111', fromName: 'Ada', replyTo: '15550001111', text: 'hello', timestamp: '2025-10-09T08:53:20.000Z' }])
  expect(parseWhatsAppWebhook(null)).toEqual([])
})

test('whatsapp signature verification', () => {
  const raw = JSON.stringify(webhookBody)
  const sig = 'sha256=' + createHmac('sha256', 's3cret').update(raw).digest('hex')
  expect(verifyWhatsAppSignature('s3cret', raw, sig)).toBe(true)
  expect(verifyWhatsAppSignature('other', raw, sig)).toBe(false)
  expect(verifyWhatsAppSignature('s3cret', raw, undefined)).toBe(false)
})

test('bus routes outbound to the adapter and refuses unconfigured ones', async () => {
  const bus = new ChannelBus()
  const calls: Array<{ url: string; body: any }> = []
  const fetchImpl = (async (url: any, init: any) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.out' }] }), text: async () => '' } as unknown as Response }) as unknown as typeof fetch
  bus.register(createWhatsAppAdapter({ token: 't', phoneNumberId: '42', fetchImpl }))
  bus.register(createDiscordAdapter({}, bus))
  expect(await bus.send({ destination: 'whatsapp', to: '1555', text: 'hi' })).toEqual({ id: 'wamid.out' })
  expect(calls[0].url).toContain('/42/messages')
  expect(calls[0].body).toEqual({ messaging_product: 'whatsapp', to: '1555', text: { body: 'hi' } })
  await expect(bus.send({ destination: 'discord', to: 'c', text: 'x' })).rejects.toThrow('not configured')
  expect(bus.health()).toEqual({ whatsapp: { configured: true, ready: true }, discord: { configured: false, ready: false } })
})

test('discord messages map to inbound messages and bots are ignored', () => {
  const m = inboundFromDiscord({ id: 'd1', content: 'yo', createdTimestamp: 1760000000000, author: { id: 'u1', username: 'ada', displayName: 'Ada' }, channel: { id: 'c1', name: 'general', type: 0 }, guild: { id: 'g1', name: 'Fos' } })
  expect(m).toMatchObject({ source: 'discord', id: 'd1', from: 'u1', fromName: 'Ada', replyTo: 'c1', text: 'yo', meta: { channelName: 'general', guild: { id: 'g1', name: 'Fos' } } })
  expect(inboundFromDiscord({ id: 'd2', content: 'beep', createdTimestamp: 1, author: { id: 'b', bot: true }, channel: { id: 'c1' } })).toBeNull()
})

test('discord adapter connects through the injected client and sends to channels', async () => {
  const bus = new ChannelBus()
  const received: string[] = []
  bus.onInbound((m) => { received.push(m.text) })
  const handlers: Record<string, (...args: any[]) => void> = {}
  const sent: string[] = []
  const client = {
    readyAt: null as Date | null, user: { tag: 'fos#1' },
    once: (_e: string, fn: () => void) => { handlers.ready = fn },
    on: (e: string, fn: (...a: any[]) => void) => { handlers[e] = fn },
    login: async () => { client.readyAt = new Date(); handlers.ready(); return 'ok' },
    destroy: () => {},
    channels: { fetch: async (id: string) => (id === 'c1' ? { send: async (t: string) => { sent.push(t); return { id: 'm1' } } } : null) }
  }
  const adapter = createDiscordAdapter({ token: 'tok', createClient: async () => client as any }, bus)
  bus.register(adapter)
  await bus.start()
  expect(adapter.ready()).toBe(true)
  handlers.messageCreate({ id: 'd1', content: 'ping', createdTimestamp: 1, author: { id: 'u1' }, channel: { id: 'c1' } })
  await new Promise((r) => setTimeout(r, 0))
  expect(received).toEqual(['ping'])
  expect(await bus.send({ destination: 'discord', to: 'c1', text: 'pong' })).toEqual({ id: 'm1' })
  await expect(bus.send({ destination: 'discord', to: 'nope', text: 'x' })).rejects.toThrow('not found')
})

test('router: webhook verification, inbound dispatch with signature, health', async () => {
  const bus = new ChannelBus()
  const seen: string[] = []
  bus.onInbound((m) => { seen.push(`${m.source}:${m.text}`) })
  const app = express()
  app.use('/channels', createChannelsRouter(bus, { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '42', WHATSAPP_VERIFY_TOKEN: 'verify-me', WHATSAPP_APP_SECRET: 's3cret' } as NodeJS.ProcessEnv))
  const server = http.createServer(app)
  await new Promise<void>((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/channels`
  try {
    const ok = await request(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`)
    expect([ok.status, ok.text]).toEqual([200, '12345'])
    expect((await request(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status).toBe(403)
    const raw = JSON.stringify(webhookBody)
    const unsigned = await request(`${base}/whatsapp/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw })
    expect(unsigned.status).toBe(401)
    const signed = await request(`${base}/whatsapp/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', 's3cret').update(raw).digest('hex') }, body: raw })
    expect(signed.status).toBe(200)
    await new Promise((r) => setTimeout(r, 10))
    expect(seen).toEqual(['whatsapp:hello'])
    const health = JSON.parse((await request(`${base}/health`)).text)
    expect(health.channels.whatsapp).toEqual({ configured: true, ready: true })
  } finally {
    server.close()
  }
})
