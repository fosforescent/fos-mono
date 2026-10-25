/** Bootstrap native primitive values and dispatch through scoped ref declarations.
 * Runtime callbacks are meanings of graph nodes, never a second registration table.
 * Input definitions reconstruct this host's primitives after loading; only refs
 * present in the graph make values available to execution and lifecycle hooks.
 */
import { SERVER_TRANSPORT_CAPABILITIES, libAt, capabilityName, contextMemberRefs, registerNative, restoreNative, nativeOffer, nativeExecutorsOf, nativeValues, discoverHandlers, reachableNodes, createReplica, type Native, type PrimitiveDefinition, type Capability, type EvaluationStep, type HostOffers, type Replica, type Scope } from '@fosforescent/shared/sync/index'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'

/** The account an evaluation runs for: what a native closes over to reach this host's services on its behalf. */
export type HostUser = { id: number; username: string }

export type HostHandler = {
  trigger?: import('@fosforescent/shared/sync/triggers').TriggerObserver
  /** The peer that provides it: `fos` for the server's own services, `integration:<id>` for a fronted service, or a family such as `mcp:*` (with `matches`). */
  peerId: string
  /** Every implementation has a ref declaration. Standard-library names are only adapter syntax. */
  ref: PrimitiveDefinition<unknown>
  /** Peer ids this handler stands for when `peerId` is a family (attached MCP servers are `mcp:<id>`). */
  matches?(peerId: string): boolean
  /** Narrows which rows of the capability this handler runs, while the library's patterns are not refined enough to say. */
  handles?(step: EvaluationStep, replica: Replica): boolean
  /** Live availability for one account and peer (an OAuth connection, a verified phone, a connected MCP server). Absent = always available. */
  available?(userId: number, peerId: string): Promise<boolean>
  /** The one shape of a host implementation (shared/sync/native.ts), for the account it runs for: compiled operands in, values out; the evaluator writes. Absent = advertised service without an executor. */
  native?(user: HostUser): Native
  /**
   * Runs where a peer's submission landed (a node exchange that wrote at `path`, under the account's lock) and returns
   * the replica after it: graph-only handlers such as the relay, which moves messages into their recipients' queues.
   */
  submission?(replica: Replica, path: Scope, now: number): Replica
  /** The `approve` capability's handler: who attests the approvals this host records for the accounts it serves, in `replica`. */
  attester?(replica: Replica): import('@fosforescent/shared/sync/approvals').Attester | null
  /** Refresh a loaded node from a connected service. Called after access checks, under the account lock. */
  load?(ctx: { userId: number; replica: Replica; path: Scope; branches: Array<{ scope: Scope; name: string }>; now: number }): Promise<Replica>
  /**
   * The peer's public key (raw ed25519, base64) when it signs what it hands out (the `verify` handler's attestations):
   * published in every account's Home through `hostOffers().keys`, so devices check signatures against graph data.
   */
  publicKey?: string
}

export type HostRuntime = ReturnType<typeof createHostRuntime>

/** Standard-library adapter used by native implementations, not by discovery or dispatch. */
export function standardHostRef(peer: string, name: string, id = name): PrimitiveDefinition<unknown> {
  return { id, label: name, type: (store, at) => libAt(store, at).capabilities[name]! }
}

export function createHostRuntime(input: HostHandler[]) {
  const handlers: HostHandler[] = input.map(handler => ({ ...handler, handles: handler.handles ?? handler.ref.handles, trigger: handler.trigger ?? handler.ref.trigger }))
  const catalogue = createReplica().store
  const unique = (caps: Capability[]) => [...new Set(caps)].sort()
  const provides = (h: HostHandler, peerId: string) => h.peerId === peerId || !!h.matches?.(peerId)
  const offers = (peerId: string): Capability[] => unique(handlers.filter(h => h.peerId === peerId).map(h => { const type = h.ref.type(catalogue, []); return capabilityName(catalogue, type) ?? type }))
  const peers = [...new Set(handlers.map(h => h.peerId))]
  const materialize = (replica: Replica, at: Scope) => {
    // Restore runtime meanings after loading; this creates no ref rows or advertisements.
    const peers = new Set([...contextMemberRefs(replica, at).keys(), ...discoverHandlers(replica, at).map(offer => offer.peerId)])
    for (const peer of peers) for (const handler of handlers) if (provides(handler, peer)) restoreNative(replica, at, peer, handler.ref, handler)
  }
  return {
    restore: materialize,
    handlers,
    /** Publish native implementations through the same ref constructor used on devices. */
    declare(replica: Replica, at: Scope, peerId: string, now: number): Replica {
      for (const handler of handlers) if (provides(handler, peerId)) replica = registerNative(replica, at, peerId, handler.ref, handler, now)
      return replica
    },
    provides,
    providers(step: EvaluationStep, replica: Replica, handler: HostHandler): string[] {
      materialize(replica, step.path)
      return [...new Set(nativeExecutorsOf<HostHandler>(replica, step).filter(value => value.native === handler).map(value => value.host))]
    },
    /** Capabilities `peerId` provides on this host. */
    offers,
    /** What the fos server advertises: its transport facts plus every registered fos service. */
    serverCapabilities(): Capability[] { return unique([...SERVER_TRANSPORT_CAPABILITIES, ...offers('fos')]) },
    /** Per integration peer id (`github`, `google`, …), the capabilities this host has handlers for. */
    integrationOffers(): Record<string, Capability[]> {
      return Object.fromEntries(peers.filter(p => p.startsWith('integration:')).map(p => [p.slice('integration:'.length), offers(p)]))
    },
    /** Everything `ensureHomeContext` needs to write into an account's context. */
    hostOffers(): HostOffers {
      const keys = Object.fromEntries(handlers.filter(h => h.publicKey).map(h => [h.peerId, h.publicKey!]))
      const peers = Object.fromEntries([...new Set(handlers.filter(h => !h.matches).map(h => h.peerId))].map(peer => [peer, handlers.filter(h => h.peerId === peer).map(h => [h.ref.type(catalogue, []), nativeOffer(catalogue, peer, h.ref, h)] as [string, string])]))
      return { server: this.serverCapabilities(), integrations: this.integrationOffers(), native: { peers, nodes: reachableNodes(catalogue, Object.values(peers).flat(2)) }, ...(Object.keys(keys).length ? { keys } : {}) }
    },
    /** Every handler that reacts to a submission, run on the node it landed at (see `HostHandler.submission`). */
    afterSubmission(replica: Replica, path: Scope, now: number): Replica {
      materialize(replica, path)
      for (const { native } of nativeValues<HostHandler>(replica, path)) if (native.submission) replica = native.submission(replica, path, now)
      return replica
    },
    async onLoad(ctx: Parameters<NonNullable<HostHandler['load']>>[0]): Promise<Replica> {
      materialize(ctx.replica, ctx.path)
      let replica = ctx.replica
      for (const { native } of nativeValues<HostHandler>(replica, ctx.path)) if (native.load) replica = await native.load({ ...ctx, replica })
      return replica
    },
    /** Handlers that can execute this step as an effect. */
    executors(step: EvaluationStep, replica: Replica): HostHandler[] {
      materialize(replica, step.path)
      return [...new Set(nativeExecutorsOf<HostHandler>(replica, step).map(value => value.native))]
    },
    /** Is `peerId` able to serve this account right now? */
    async active(peerId: string, userId: number, replica?: Replica, at: Scope = []): Promise<boolean> {
      if (replica) materialize(replica, at)
      const own = replica ? nativeValues<HostHandler>(replica, at, peerId).map(value => value.native) : handlers.filter(h => provides(h, peerId))
      if (!own.length) return false
      for (const h of own) if (h.available && !(await h.available(userId, peerId))) return false
      return true
    }
  }
}
