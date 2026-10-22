/**
 * The account server's adapters for the event grammar (shared/sync/events.ts): HTTP, MCP and the WebSocket all
 * build the same principal from the request's claims and hand the event to `dispatchEvent` under the user's store
 * lock. `complete` hands the authorized request to the evaluation service, which runs the handler runtime.
 */
import type { Request, Response } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { createReplica, dispatchEvent, ensureHomeContext, ensureInviteRequest, EventError, handleMcp, waitMcp, headCid, inheritedNodeGrants, parseEvent, pathOf, MCP_PROTOCOL_VERSIONS, type Capability, type EvaluateRequest, type FosEvent, type Principal, type Scope } from '@fosforescent/shared/sync/index'
import { withUserLock, serverPeerIdFor, type AccountStoreDeps } from './accountStore'

type Claims = { username?: string; kind?: string; peerId?: string; scope?: string[]; name?: string; exp?: number }
export type Evaluate = (username: string, request: EvaluateRequest) => Promise<unknown>

export class EventAuthError extends Error { constructor(public status: number, message: string) { super(message) } }

/**
 * The acting principal: an owner (optionally at an explicit scope), an invited peer at its signed attachment, or a
 * signed-in user acting on *another* account's node (`owner` names that account): then they are the peer
 * `user:<me>` there, with exactly the capabilities that account granted them on the node.
 */
export function principalOf(claims: Claims | undefined, ownerScope?: unknown, owner?: unknown): Principal & { username: string } {
  if (!claims?.username) throw new EventAuthError(401, 'Authentication required.')
  if (claims.exp && claims.exp * 1000 <= Date.now()) throw new EventAuthError(401, 'Credential expired.')
  if (claims.kind === 'peer') {
    if (!claims.peerId || !Array.isArray(claims.scope)) throw new EventAuthError(400, 'Invalid peer attachment.')
    // A peer cannot widen its signed grant with a parameter.
    return { username: claims.username, peerId: claims.peerId, owner: false, scope: pathOf(claims.scope), name: claims.name }
  }
  let scope: Scope
  try { scope = pathOf(ownerScope) } catch { throw new EventAuthError(400, 'Owner connections require scope=["node-id",…]; peer connections use their signed attachment.') }
  if (typeof owner === 'string' && owner && owner !== claims.username) {
    if (!/^[\w.@+-]{1,128}$/.test(owner)) throw new EventAuthError(400, 'Invalid owner.')
    if (!scope.length) throw new EventAuthError(400, 'Acting on another account needs the scope of the node shared with you.')
    return { username: owner, peerId: serverPeerIdFor(claims.username), owner: false, scope, name: claims.username }
  }
  return { username: claims.username, peerId: serverPeerIdFor(claims.username), owner: true, scope }
}

export function createEventService(deps: AccountStoreDeps, evaluate?: Evaluate) {
  const waiting = new Map<string, number>()
  const sessions = new Map<string, { identity: string; seen: number }>()
  /** Dispatch one event for a principal: load, dispatch, save, notify; then let the host evaluate if asked. */
  async function handle(principal: Principal & { username: string }, event: FosEvent): Promise<unknown> {
    // An invite names another account: it must exist before the owner's store records the membership.
    if (event.kind === 'invite' && !await deps.loadStore(event.user)) throw new EventError(`No Fos user is named @${event.user}.`)
    const outcome = await withUserLock(`user:${principal.username}`, async () => {
      const loaded = await deps.loadStore(principal.username)
      if (!loaded) throw new EventError('Account unavailable.')
      const r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
      const before = r.store.rootNodeId
      const attester = deps.runtime?.handlers.map(h => h.attester?.(r)).find(Boolean) ?? null
      const dispatched = dispatchEvent(r, event, principal, deps.now?.() ?? Date.now(), { attester })
      if (dispatched.changed) {
        try { await deps.saveStore(loaded.user, dispatched.replica.store) }
        catch (error) { r.store.rootNodeId = before; throw error }
        deps.notify?.(loaded.user.id, { type: 'sync_changed', scope: principal.scope, byPeerId: principal.owner ? 'fos:event' : principal.peerId })
      }
      return dispatched
    })
    // Membership reaches the invitee through the server's `relay` capability (the fos peer relays between the
    // accounts it hosts): the owner becomes a sub-peer of the invitee's fos server with nothing granted, and the node
    // arrives as a proposal on that sub-peer's row. Accepting it places the foreign ref there; the invitee then opens
    // it and proposes through the market routes, which honour the member grant.
    const delivery = outcome.result as { status?: string; id?: string; title?: string } | null
    if (event.kind === 'invite' && delivery?.status === 'invited' && delivery.id) {
      if (deps.runtime && !deps.runtime.serverCapabilities().includes('relay')) throw new EventError('This host does not relay between accounts; the member grant is recorded but not delivered.')
      await withUserLock(`user:${event.user}`, async () => {
        const loaded = await deps.loadStore(event.user)
        if (!loaded) return
        const now = deps.now?.() ?? Date.now(), before = createReplica(`user:${event.user}`, loaded.store), head = headCid(before)
        const r = ensureInviteRequest(ensureHomeContext(before, now, deps.runtime?.hostOffers()), principal.username, delivery.id!, delivery.title || principal.username, now).replica
        if (headCid(r) === head) return
        await deps.saveStore(loaded.user, r.store)
        deps.notify?.(loaded.user.id, { type: 'sync_changed', byPeerId: 'fos:invite' })
      })
    }
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
        const principal = principalOf(claimsOf(req), body.scope ?? [], body.owner)
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
        principal = principalOf(claimsOf(req), scope, claimsOf(req)?.kind !== 'peer' && typeof req.query.owner === 'string' ? req.query.owner : undefined)
      } catch (error) { return res.status(errorStatus(error)).json({ error: message(error) }) }
      // A session distinguishes workers sharing a credential; it never replaces credential authority.
      const identity = createHash('sha256').update(JSON.stringify([principal.username, principal.peerId, principal.owner, principal.scope, req.headers.authorization ?? ''])).digest('hex')
      const sessionHeader = req.headers['mcp-session-id'], now = Date.now()
      for (const [id, session] of sessions) if (now - session.seen >= 86400000) sessions.delete(id)
      if (sessionHeader !== undefined) {
        if (typeof sessionHeader !== 'string' || sessions.get(sessionHeader)?.identity !== identity) return res.status(404).json({ error: 'MCP session unavailable. Initialize a new session.' })
        sessions.get(sessionHeader)!.seen = now
        principal.sessionId = sessionHeader
      } else if (req.body?.method === 'initialize') {
        if (sessions.size >= 4096) return res.status(429).json({ error: 'Too many MCP sessions.' })
        principal.sessionId = randomUUID()
        sessions.set(principal.sessionId, { identity, seen: now })
      } else principal.sessionId = identity // older stateless clients share their credential's identity
      if (req.body?.method === 'initialize') res.setHeader('Mcp-Session-Id', principal.sessionId)
      // a peer sees the tools its grants on the attachment allow (nothing when everything was switched off)
      let capabilities: Capability[] | undefined
      if (!principal.owner) {
        try {
          capabilities = await withUserLock(`user:${principal.username}`, async () => {
            const loaded = await deps.loadStore(principal.username)
            if (!loaded) return []
            return inheritedNodeGrants(createReplica(serverPeerIdFor(loaded.user.username), loaded.store), principal.scope, { peerId: principal.peerId, scope: principal.scope, capabilities: [] })
          })
        } catch { capabilities = [] }
      }
      const longPoll = req.body?.method === 'tools/call' && req.body?.params?.name === 'fos_await_task'
      if (longPoll && (waiting.get(principal.username) ?? 0) >= 16) return res.status(429).json({ error: 'Too many pending task waits.' })
      if (longPoll) waiting.set(principal.username, (waiting.get(principal.username) ?? 0) + 1)
      const controller = new AbortController(), closed = () => controller.abort()
      res.on?.('close', closed)
      try {
        const result = await handleMcp(req.body, { owner: principal.owner, capabilities, toolListChanges: true, wait: ms => waitMcp(ms, controller.signal), dispatch: event => {
          if (controller.signal.aborted) throw new EventError('MCP request cancelled.')
          if (claimsOf(req)?.exp && claimsOf(req)!.exp! * 1000 <= Date.now()) throw new EventAuthError(401, 'Credential expired.')
          return handle(principal, event)
        }, serverName: 'Fos project tree' })
        if (controller.signal.aborted) return
        if (result && (result as any).result?._meta?.['fos/toolsChanged'] && String(req.headers.accept ?? '').includes('text/event-stream')) {
          res.setHeader('Content-Type', 'text/event-stream')
          const notification = { jsonrpc: '2.0', method: 'notifications/tools/list_changed' }
          return res.end(`event: message\ndata: ${JSON.stringify(notification)}\n\nevent: message\ndata: ${JSON.stringify(result)}\n\n`)
        }
        return result === null ? res.status(202).end() : res.json(result)
      } finally {
        res.off?.('close', closed)
        if (longPoll) { const count = (waiting.get(principal.username) ?? 1) - 1; if (count) waiting.set(principal.username, count); else waiting.delete(principal.username) }
      }
    },
    /** WebSocket `{type:'event', id, event, scope?}` → `{type:'event_result', id, result|error}` (see ws.ts). */
    async socket(claims: Claims, body: any): Promise<unknown> {
      const principal = principalOf(claims, body?.scope ?? [], body?.owner)
      return handle(principal, parseEvent(body?.event ?? body))
    },
  }
}
