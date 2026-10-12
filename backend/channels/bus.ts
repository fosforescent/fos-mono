/**
 * In-process message bus for chat channels. Adapters publish inbound messages
 * here; handlers subscribe; `send` routes outbound messages to the adapter.
 * When PUBSUB_INBOX_TOPIC is set, inbound messages are also published to that
 * Pub/Sub topic so other consumers can subscribe without touching this process.
 */

import type { ChannelAdapter, ChannelSource, InboundMessage, OutboundMessage } from './types'

export type InboundHandler = (message: InboundMessage) => void | Promise<void>

type Publisher = (message: InboundMessage) => Promise<void>

export class ChannelBus {
  private adapters = new Map<ChannelSource, ChannelAdapter>()
  private handlers = new Set<InboundHandler>()
  private publisher: Publisher | null = null

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.source, adapter)
  }

  adapter(source: ChannelSource): ChannelAdapter | undefined {
    return this.adapters.get(source)
  }

  onInbound(handler: InboundHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** Mirror inbound messages somewhere else (Pub/Sub). Failures are logged, never thrown. */
  setPublisher(publisher: Publisher | null): void {
    this.publisher = publisher
  }

  async inbound(message: InboundMessage): Promise<void> {
    if (this.publisher) {
      try {
        await this.publisher(message)
      } catch (error) {
        console.error('[channels] inbox publish failed:', error instanceof Error ? error.message : error)
      }
    }
    for (const handler of this.handlers) {
      try {
        await handler(message)
      } catch (error) {
        console.error(`[channels] inbound handler failed for ${message.source} ${message.id}:`, error instanceof Error ? error.message : error)
      }
    }
  }

  async send(message: OutboundMessage): Promise<{ id: string | null }> {
    const adapter = this.adapters.get(message.destination)
    if (!adapter) throw new Error(`no adapter for ${message.destination}`)
    if (!adapter.configured()) throw new Error(`${message.destination} is not configured`)
    if (!adapter.ready()) throw new Error(`${message.destination} is not connected`)
    return adapter.send(message.to, message.text)
  }

  async start(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      if (!adapter.configured()) {
        console.log(`[channels] ${adapter.source}: not configured, skipped`)
        continue
      }
      try {
        await adapter.start?.()
      } catch (error) {
        console.error(`[channels] ${adapter.source} failed to start:`, error instanceof Error ? error.message : error)
      }
    }
  }

  async stop(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.stop?.()
      } catch {
        // shutting down anyway
      }
    }
  }

  health(): Record<string, { configured: boolean; ready: boolean }> {
    const out: Record<string, { configured: boolean; ready: boolean }> = {}
    for (const [source, adapter] of this.adapters) out[source] = { configured: adapter.configured(), ready: adapter.ready() }
    return out
  }
}

/** Publisher for PUBSUB_INBOX_TOPIC (loaded lazily so local runs need no GCP credentials). */
export function pubsubPublisher(topicName: string): Publisher {
  let topic: { publishMessage(data: { json: unknown; attributes?: Record<string, string> }): Promise<string> } | null = null
  return async (message) => {
    if (!topic) {
      const { PubSub } = await import('@google-cloud/pubsub')
      topic = new PubSub().topic(topicName)
    }
    await topic.publishMessage({ json: message, attributes: { source: message.source } })
  }
}
