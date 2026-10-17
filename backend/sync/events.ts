/**
 * The account server's adapters for the event grammar (shared/sync/events.ts): HTTP, MCP and the WebSocket all
 * build the same principal from the request's claims and hand the event to `dispatchEvent` under the user's store
 * lock. `complete` hands the authorized request to the evaluation service, which runs the handler registry.
 */
import type { Request, Response } from 'express'
import { createReplica, dispatchEvent, EventError, handleMcp, parseEvent, pathOf, MCP_PROTOCOL_VERSIONS, type EvaluateRequest, type FosEvent, type Principal, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, serverPeerIdFor, type PeerSyncDeps } from './peerSync'

type Claims = { username?: string; kind?: string; peerId?: string; scope?: string[]; name?: string; exp?: number }
export type Evaluate = (username: string, request: EvaluateRequest) => Promise<unknown>

export class EventAuthError extends Error { constructor(public status: number, message: string) { super(message) } }

/** The acting principal: an owner (optionally at an explicit scope) or an invited peer at its signed attachment. */
export function principalOf(claims: Claims | undefined, ownerScope?: unknown): Principal & { username: string } {
  if (!claims?.username) throw new EventAuthError(401, 'Authentication required.')
  if (claims.exp && claims.exp * 1000 <= Date.now()) throw new EventAuthError(401, 'Credential expired.')
  if (claims.kind === 'peer') {
    if (!claims.peerId || !Array.isArray(claims.scope)) throw new EventAuthError(400, 'Invalid peer attachment.')
    // A peer cannot widen its signed grant with a parameter.
    return { username: claims.username, peerId: claims.peerId, owner: false, scope: pathOf(claims.scope), name: claims.name }
  }
  let scope: Scope
  try { scope = pathOf(ownerScope) } catch { throw new EventAuthError(400, 'Owner connections require scope=["node-id",…]; peer connections use their signed attachment.') }
  return { username: claims.username, peerId: serverPeerIdFor(claims.username), owner: true, scope }
}

export function createEventService(deps: PeerSyncDeps, evaluate?: Evaluate) {
  /** Dispatch one event for a principal: load, dispatch, save, notify; then let the host evaluate if asked. */
  async function handle(principal: Principal & { username: string }, event: FosEvent): Promise<unknown> {
    const outcome = await withUserLock(`user:${principal.username}`, async () => {
      const loaded = await deps.loadStore(principal.username)
      if (!loaded) throw new EventError('Account unavailable.')
      const r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
      const dispatched = dispatchEvent(r, event, principal, deps.now?.() ?? Date.now())
      if (dispatched.changed) {
        await deps.saveStore(loaded.user, dispatched.replica.store)
        deps.notify?.(loaded.user.id, { type: 'sync_changed', scope: principal.scope, byPeerId: principal.owner ? 'fos:event' : principal.peerId })
      }
      return dispatched
    })
    // The evaluator acquires the same lock itself and rechecks the version before dispatching effects.
    if (outcome.evaluate) {
      if (!evaluate) throw new EventError('Evaluation is not available on this host.')
      return { evaluation: await evaluate(principal.username, outcome.evaluate) }
    }
    return outcome.result
  }

  const claimsOf = (req: Request) => (req as Request & { claims?: Claims }).claims
  const errorStatus = (error: unknown) => error instanceof EventAuthError ? error.status : 400
  const message = (error: unknown) => error instanceof Error ? error.message : String(error)

  return {
    handle,
    principalOf,
    /** POST /user/data/events — body `{ event, scope? }` (or the event itself); owners may pass `scope`. */
    async http(req: Request, res: Response) {
      res.setHeader('Cache-Control', 'no-store')
      try {
        const body = req.body ?? {}
        const principal = principalOf(claimsOf(req), body.scope ?? [])
        const event = parseEvent(body.event ?? body)
        return res.json(await handle(principal, event))
      } catch (error) { return res.status(errorStatus(error)).json({ error: message(error) }) }
    },
    /** POST /user/data/peer-sync/mcp — JSON-RPC; owners choose a scope with ?scope=["id",…], peers use their credential. */
    async mcp(req: Request, res: Response) {
      res.setHeader('Cache-Control', 'no-store')
      if (!claimsOf(req)?.username) return res.status(401).json({ error: 'Authentication required.' })
      // No ambient-cookie auth or browser origins: clients send explicit bearer credentials.
      if (req.headers.origin) return res.status(403).json({ error: 'Browser-origin MCP requests are not supported.' })
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
      const protocol = req.headers['mcp-protocol-version']
      if (protocol && !MCP_PROTOCOL_VERSIONS.includes(String(protocol))) return res.status(400).json({ error: 'Unsupported MCP protocol version.' })
      let principal: Principal & { username: string }
      try {
        let scope: unknown = []
        if (claimsOf(req)?.kind !== 'peer') { try { scope = JSON.parse(String(req.query.scope ?? 'null')) } catch { scope = null } }
        principal = principalOf(claimsOf(req), scope)
      } catch (error) { return res.status(errorStatus(error)).json({ error: message(error) }) }
      const result = await handleMcp(req.body, { owner: principal.owner, dispatch: event => handle(principal, event), serverName: 'Fos project tree' })
      return result === null ? res.status(202).end() : res.json(result)
    },
    /** WebSocket `{type:'event', id, event, scope?}` → `{type:'event_result', id, result|error}` (see ws.ts). */
    async socket(claims: Claims, body: any): Promise<unknown> {
      const principal = principalOf(claims, body?.scope ?? [])
      return handle(principal, parseEvent(body?.event ?? body))
    },
  }
}
