/** Chat channels (WhatsApp, Discord, SMS) bridged into the backend process. */

export type ChannelSource = 'whatsapp' | 'discord' | 'sms'

export type InboundMessage = {
  source: ChannelSource
  /** Platform message id. */
  id: string
  /** Who sent it: a WhatsApp phone number, or a Discord user id. */
  from: string
  /** Display name when the platform provides one. */
  fromName?: string
  /** Where to reply: the WhatsApp number again, or the Discord channel id. */
  replyTo: string
  text: string
  /** ISO-8601. */
  timestamp: string
  /** Platform-specific extras (Discord guild/channel names, …). */
  meta?: Record<string, unknown>
}

export type OutboundMessage = {
  destination: ChannelSource
  /** WhatsApp number or Discord channel id. */
  to: string
  text: string
}

export type ChannelAdapter = {
  source: ChannelSource
  /** Whether the credentials for this adapter are configured. */
  configured(): boolean
  /** Whether the adapter can send right now (e.g. the Discord gateway is connected). */
  ready(): boolean
  send(to: string, text: string): Promise<{ id: string | null }>
  start?(): Promise<void>
  stop?(): Promise<void>
}
