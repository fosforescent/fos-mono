/**
 * Discord adapter: a gateway bot (discord.js) that turns messages into inbound
 * bus messages and sends outbound text to channels.
 *
 * Env: DISCORD_TOKEN. The gateway is a persistent WebSocket, so the process
 * needs to stay alive (Cloud Run: min instances ≥ 1 and CPU always allocated).
 */

import type { ChannelAdapter, InboundMessage } from './types'
import type { ChannelBus } from './bus'

type DiscordClient = {
  once(event: 'ready', fn: () => void): unknown
  on(event: string, fn: (...args: any[]) => void): unknown
  login(token: string): Promise<string>
  destroy(): Promise<void> | void
  channels: { fetch(id: string): Promise<{ isTextBased?: () => boolean; send?: (text: string) => Promise<{ id: string }> } | null> }
  readyAt: Date | null
  user: { tag: string } | null
}

export type DiscordConfig = {
  token?: string
  /** Injected for tests; defaults to a real discord.js client (loaded lazily). */
  createClient?: () => Promise<DiscordClient>
}

export function discordConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DiscordConfig {
  return { token: env.DISCORD_TOKEN }
}

async function realClient(): Promise<DiscordClient> {
  const { Client, GatewayIntentBits, Partials } = await import('discord.js')
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel]
  }) as unknown as DiscordClient
}

/** A discord.js message as an inbound bus message (null for bot messages). */
export function inboundFromDiscord(message: {
  id: string
  content: string
  createdTimestamp: number
  author: { id: string; bot?: boolean; username?: string; displayName?: string }
  channel: { id: string; name?: string | null; type?: number }
  guild?: { id: string; name: string } | null
}): InboundMessage | null {
  if (message.author.bot) return null
  return {
    source: 'discord',
    id: message.id,
    from: message.author.id,
    fromName: message.author.displayName ?? message.author.username,
    replyTo: message.channel.id,
    text: message.content,
    timestamp: new Date(message.createdTimestamp).toISOString(),
    meta: { channelName: message.channel.name ?? null, channelType: message.channel.type ?? null, guild: message.guild ? { id: message.guild.id, name: message.guild.name } : null }
  }
}

export function createDiscordAdapter(config: DiscordConfig, bus: ChannelBus): ChannelAdapter {
  let client: DiscordClient | null = null
  return {
    source: 'discord',
    configured: () => !!config.token,
    ready: () => !!client?.readyAt,
    async start() {
      if (!config.token) return
      client = await (config.createClient ?? realClient)()
      client.once('ready', () => console.log(`[channels] discord: logged in as ${client?.user?.tag ?? '?'}`))
      client.on('messageCreate', (message) => {
        const inbound = inboundFromDiscord(message)
        if (inbound) void bus.inbound(inbound)
      })
      client.on('error', (error: Error) => console.error('[channels] discord error:', error.message))
      await client.login(config.token)
    },
    async stop() {
      await client?.destroy()
      client = null
    },
    async send(channelId, text) {
      if (!client) throw new Error('discord is not connected')
      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.send) throw new Error(`discord channel ${channelId} not found or not text-based`)
      const sent = await channel.send(text)
      return { id: sent.id }
    }
  }
}
