/**
 * The host's handler registry: the single place that says which capabilities this server, and the
 * integration peers it fronts, can actually execute or serve. Everything advertised to devices is derived
 * from it: the `capabilities` list in sync and node-provider responses, the fos member's offers written into
 * each account's Home (`ensureHomeContext(..., offers)`), and the `provides` of `GET /user/integrations`.
 * A capability with no entry here is never advertised, so the palette cannot show a constructor that has
 * no handler behind it.
 *
 * Handlers with an `effect` run through the shared evaluator (backend/sync/evaluation.ts); handlers without
 * one are services reached by their own routes (search, market, llm, poll) and are advertised only.
 */
import { SERVER_TRANSPORT_CAPABILITIES, type Capability, type EvaluationStep, type HostOffers, type Replica } from '@fosforescent/shared/sync/index'

export type EffectContext = {
  userId: number
  step: EvaluationStep
  replica(): Replica
  /** Persist a new replica state (the evaluator journals before and after). */
  update(next: Replica): Promise<void>
  now(): number
}

export type HostHandler = {
  /** The peer that provides it: `fos` for the server's own services, `integration:<id>` for a fronted service. */
  peerId: string
  capability: Capability
  /** Live availability for one account (an OAuth connection, a verified phone, …). Absent = always available. */
  available?(userId: number): Promise<boolean>
  /** Executes a requirement of this capability as an evaluation effect; absent = advertised service without an executor. */
  effect?(ctx: EffectContext): Promise<void>
}

export type HandlerRegistry = ReturnType<typeof createHandlerRegistry>

export function createHandlerRegistry(handlers: HostHandler[]) {
  const unique = (caps: Capability[]) => [...new Set(caps)].sort()
  const offers = (peerId: string): Capability[] => unique(handlers.filter(h => h.peerId === peerId).map(h => h.capability))
  const peers = unique(handlers.map(h => h.peerId) as Capability[]) as string[]
  return {
    handlers,
    /** Capabilities `peerId` provides on this host. */
    offers,
    /** What the fos server advertises: its transport facts plus every registered fos service. */
    serverCapabilities(): Capability[] { return unique([...SERVER_TRANSPORT_CAPABILITIES, ...offers('fos')]) },
    /** Per integration peer id (`github`, `google`, …), the capabilities this host has handlers for. */
    integrationOffers(): Record<string, Capability[]> {
      return Object.fromEntries(peers.filter(p => p.startsWith('integration:')).map(p => [p.slice('integration:'.length), offers(p)]))
    },
    /** Everything `ensureHomeContext` needs to write into an account's context. */
    hostOffers(): HostOffers { return { server: this.serverCapabilities(), integrations: this.integrationOffers() } },
    /** Handlers that can execute `capability` as an effect. */
    executors(capability: Capability): HostHandler[] { return handlers.filter(h => h.capability === capability && !!h.effect) },
    /** Is `peerId` able to serve this account right now? */
    async active(peerId: string, userId: number): Promise<boolean> {
      const own = handlers.filter(h => h.peerId === peerId)
      if (!own.length) return false
      for (const h of own) if (h.available && !(await h.available(userId))) return false
      return true
    }
  }
}
