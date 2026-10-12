/**
 * Chat channels inside the backend (replaces the standalone event-services):
 *   GET/POST /channels/whatsapp/webhook   Meta webhook verification + inbound messages
 *   GET      /channels/health             adapter status
 *
 * Inbound messages go through `channelBus`; register handlers with
 * `channelBus.onInbound(...)`. Send with `channelBus.send({ destination, to, text })`.
 * With CHANNELS_ECHO=true every inbound text is echoed back (smoke test).
 */

import { Router, json, type Request } from 'express'
import { ChannelBus, pubsubPublisher } from './bus'
import { createDiscordAdapter, discordConfigFromEnv } from './discord'
import { createWhatsAppAdapter, createWhatsAppWebhook, whatsAppConfigFromEnv } from './whatsapp'

export { ChannelBus } from './bus'
export type { InboundMessage, OutboundMessage, ChannelSource } from './types'

export const channelBus = new ChannelBus()

export function createChannelsRouter(bus: ChannelBus = channelBus, env: NodeJS.ProcessEnv = process.env): Router {
  const router = Router()
  const whatsapp = whatsAppConfigFromEnv(env)
  bus.register(createWhatsAppAdapter(whatsapp))
  bus.register(createDiscordAdapter(discordConfigFromEnv(env), bus))
  if (env.PUBSUB_INBOX_TOPIC) bus.setPublisher(pubsubPublisher(env.PUBSUB_INBOX_TOPIC))
  if (env.CHANNELS_ECHO === 'true') {
    bus.onInbound(async (message) => {
      await bus.send({ destination: message.source, to: message.replyTo, text: message.text })
    })
  }
  const webhook = createWhatsAppWebhook(whatsapp, bus)
  // keep the raw body for signature verification
  router.use('/whatsapp/webhook', json({ verify: (req, _res, buf) => { (req as Request & { rawBody?: Buffer }).rawBody = buf } }))
  router.get('/whatsapp/webhook', webhook.verify)
  router.post('/whatsapp/webhook', (req, res) => { void webhook.receive(req, res) })
  router.get('/health', (_req, res) => res.json({ channels: bus.health(), timestamp: new Date().toISOString() }))
  return router
}

/** Connect the adapters that have credentials (call after the HTTP server is listening). */
export function startChannels(bus: ChannelBus = channelBus): Promise<void> {
  return bus.start()
}

export function stopChannels(bus: ChannelBus = channelBus): Promise<void> {
  return bus.stop()
}
