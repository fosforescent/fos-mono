/**
 * The host's handler registry: the single place that says which capabilities this server, and the peers it fronts
 * (integration peers, attached MCP servers), can actually execute or serve. Everything advertised to devices is
 * derived from it: the `capabilities` list in sync and node-provider responses, the fos member's offers written
 * into each account's Home (`ensureHomeContext(..., offers)`), and the `provides` of `GET /user/integrations`.
 * A capability with no entry here is never advertised, so the palette cannot show a constructor that has no
 * handler behind it.
 *
 * Handlers with an `effect` run through the shared evaluator (backend/sync/evaluation.ts) when a `complete` event
 * reaches a node whose requirement they handle; handlers without one are services reached by their own routes
 * (search, market, poll) and are advertised only. An effect may answer `'pending'`: its result awaits human review
 * (a proposal on a return ref) and the evaluation pauses as `awaiting-review` instead of committing.
 */
import { SERVER_TRANSPORT_CAPABILITIES, type Capability, type EvaluationStep, type HostOffers, type LibraryAddress, type Replica } from '@fosforescent/shared/sync/index'

export type EffectContext = {
  userId: number
  username: string
  step: EvaluationStep
  replica(): Replica
  /** Persist a new replica state (the evaluator journals before and after). */
  update(next: Replica): Promise<void>
  now(): number
}

export type HostHandler = {
  /** The peer that provides it: `fos` for the server's own services, `integration:<id>` for a fronted service, or a family such as `mcp:*` (with `matches`). */
  peerId: string
  capability: Capability
  /** Peer ids this handler stands for when `peerId` is a family (attached MCP servers are `mcp:<id>`). */
  matches?(peerId: string): boolean
  /** Which evaluation steps it executes (the replica lets it read the node's configuration); default: requirements of its capability. */
  handles?(step: EvaluationStep, replica: Replica): boolean
  /** Live availability for one account and peer (an OAuth connection, a verified phone, a connected MCP server). Absent = always available. */
  available?(userId: number, peerId: string): Promise<boolean>
  /**
   * Before the evaluator pins the step's instructions: write what the effect will need (a handler binding, a return
   * ref) and name the return slots the effect fills, so they are excluded from the change check.
   */
  prepare?(ctx: EffectContext): Promise<{ outputs?: string[] } | void>
  /** Executes a requirement as an evaluation effect; `'pending'` when the result awaits review. Absent = advertised service without an executor. */
  effect?(ctx: EffectContext): Promise<void | 'pending'>
}

export type HandlerRegistry = ReturnType<typeof createHandlerRegistry>

export function createHandlerRegistry(handlers: HostHandler[]) {
  const unique = (caps: Capability[]) => [...new Set(caps)].sort()
  const provides = (h: HostHandler, peerId: string) => h.peerId === peerId || !!h.matches?.(peerId)
  const offers = (peerId: string): Capability[] => unique(handlers.filter(h => h.peerId === peerId).map(h => h.capability))
  const peers = [...new Set(handlers.map(h => h.peerId))]
  return {
    handlers,
    provides,
    /** The standard library this host seeds into every account's Home (sync/library.ts), once it exists at startup. */
    library: null as LibraryAddress | null,
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
    /** Handlers that can execute this step as an effect. */
    executors(step: EvaluationStep, replica: Replica): HostHandler[] {
      return handlers.filter(h => !!h.effect && (h.handles ? h.handles(step, replica) : step.row?.requirement?.capability === h.capability))
    },
    /** Is `peerId` able to serve this account right now? */
    async active(peerId: string, userId: number): Promise<boolean> {
      const own = handlers.filter(h => provides(h, peerId))
      if (!own.length) return false
      for (const h of own) if (h.available && !(await h.available(userId, peerId))) return false
      return true
    }
  }
}
