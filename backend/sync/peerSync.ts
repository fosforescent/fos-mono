/**
 * POST /user/data/peer-sync — the user group's side of the peer-link protocol
 * (shared/sync/protocol.ts). The user's FosStore *is* the user group: a device
 * attaches to its root content (scope []) or to a partition inside it, and the
 * merged result is committed as a new root alias with PREV history, then saved
 * with the existing storeToDb path. Divergences become CHOICE edges in the
 * graph, so every device sees and can resolve them.
 *
 * Persistence is injected so the handler can be unit-tested without Postgres.
 */

import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { readNodeValue, writeNodeValue, HOME_ID, createReplica, ensureHomeContext, SERVER_TRANSPORT_CAPABILITIES, applyProposalAt, content, findPeerScope, hasCapability, headCid, normalizeReplicaRefs, parseSyncRequest, rejectProposalAt, resolveScope, rootTargetCid, scopeNames, serveSync, viewNode, type Replica } from '@fosforescent/shared/sync/index'
import { prisma } from '../prismaClient'
import { dbToStore, storeToDb } from '../util'
import { onlinePeersOf, sendToUser } from '../promptNotifications'
import { indexStore, vertexEmbed } from '../search/rowIndex'
import type { HandlerRegistry } from './registry'

export type PeerSyncUser = { id: number; username: string }

export type PeerSyncDeps = {
  /** Load the user's store (the user group). Null when the user is unknown. */
  loadStore(username: string): Promise<{ user: PeerSyncUser; store: FosStore } | null>
  saveStore(user: PeerSyncUser, store: FosStore): Promise<void>
  /** Nudge the user's other connected devices to pull. */
  notify?(userId: number, message: Record<string, unknown>): void
  /** Peer ids of the user's devices currently connected over the WebSocket. */
  onlinePeers?(userId: number): string[]
  now?(): number
  /** What this host can do (sync/registry.ts); absent (tests) means transport only. */
  registry?: HandlerRegistry
}

/** Peer id the user group uses when labelling its side of a divergence. */
export function serverPeerIdFor(username: string): string {
  return `user:${username}`
}

/** Called after every save of a user's tree (indexing is built in; MCP peer listeners register here). Failures are logged. */
export const afterSaveHooks: Array<(user: PeerSyncUser, store: FosStore) => void> = []

/**
 * Serialize every load-modify-save of one user's store (syncs, proposal
 * decisions, member attachment) so none of them races another's save.
 * The lock must cover the load, so it is keyed by username (known before loading).
 */
const userQueues = new Map<string | number, Promise<unknown>>()

export function withUserLock<T>(userId: string | number, fn: () => Promise<T>): Promise<T> {
  const previous = userQueues.get(userId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  userQueues.set(userId, next)
  next.finally(() => {
    if (userQueues.get(userId) === next) userQueues.delete(userId)
  }).catch(() => undefined)
  return next
}

type RequestClaims = { username?: string; kind?: string; peerId?: string; scope?: string[]; name?: string }

function claimsOf(req: Request): RequestClaims {
  return ((req as unknown as { claims?: RequestClaims }).claims ?? {})
}

function claimsUsername(req: Request): string | null {
  const username = claimsOf(req).username
  return typeof username === 'string' ? username : null
}

/** A peer credential (from an invite) may only sync as its own peer id, at or below its scope. */
function peerCredentialError(claims: RequestClaims, peerId: string, scope: string[]): string | null {
  if (claims.kind !== 'peer') return null
  if (claims.peerId !== peerId) return 'credential belongs to a different peer'
  const granted = Array.isArray(claims.scope) ? claims.scope : []
  const within = granted.length <= scope.length && granted.every((s, i) => scope[i] === s)
  return within ? null : 'credential is limited to another node'
}

const STATUS_FOR_CODE = { 'bad-request': 400, 'scope-not-found': 404, 'missing-nodes': 400, 'version-mismatch': 409 } as const

export function createPeerSyncHandler(deps: PeerSyncDeps) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const username = claimsUsername(req)
      if (!username) return res.status(401).json({ error: 'Unauthorized' })

      const parsed = parseSyncRequest(req.body)
      if ('error' in parsed) return res.status(STATUS_FOR_CODE[parsed.code]).json(parsed)
      const denied = peerCredentialError(claimsOf(req), parsed.peerId, parsed.scope)
      if (denied) return res.status(403).json({ error: denied })

      const outcome = await withUserLock(`user:${username}`, async () => {
        const loaded = await deps.loadStore(username)
        if (!loaded) return { status: 401, body: { error: 'User not found' } } as const
        const { user, store } = loaded
        const serverReplica = createReplica(serverPeerIdFor(user.username), store)
        const independentRoot = readNodeValue<string>(serverReplica, [], 'fos:peer-root') === 'fos'
        if (independentRoot && !parsed.scope.length) return { status: 409, body: { error: 'This account shares Home, not its server root. Update this client to use a Home attachment.', code: 'version-mismatch' } } as const
        // Upgrade the account root only when a constructor-aware owner connects.
        // Older scoped peer credentials continue to resolve through Home.
        const beforeContext = rootTargetCid(store)
        if (claimsOf(req).kind !== 'peer' && ((!parsed.scope.length && Object.values(parsed.nodes).some(node => node?.data?.alias?.id === HOME_ID)) || parsed.scope[0] === HOME_ID)) {
          ensureHomeContext(serverReplica, 0, deps.registry?.hostOffers())
          if (parsed.scope[0] === HOME_ID && !independentRoot) writeNodeValue(serverReplica, [], 'fos:peer-root', 'fos', deps.now?.() ?? Date.now())
        }
        const contextChanged = rootTargetCid(store) !== beforeContext
        {
          const claims = claimsOf(req)
          if (claims.kind === 'peer') {
            const attachment = resolveScope(store, rootTargetCid(store), claims.scope ?? [])
            if (!attachment || (!hasCapability(store, content(store, attachment), parsed.peerId, 'read') && !hasCapability(store, content(store, attachment), parsed.peerId, 'edit'))) {
              return { status: 403, body: { error: 'Peer no longer has access to this attachment.' } } as const
            }
          }
          // Invited peers propose at link nodes (branches members approve); the owner's own devices merge.
          const options = {
            recipient: 'server' as const,
            ...(claims.kind === 'peer' ? { proposeOnly: true, peerName: claims.name } : {}),
            onlinePeers: deps.onlinePeers ? deps.onlinePeers(user.id) : undefined,
            // what this server registers with the peer: its transport facts plus the services its handler registry has
            capabilities: deps.registry?.serverCapabilities() ?? SERVER_TRANSPORT_CAPABILITIES
          }
          const served = serveSync(store, parsed, serverPeerIdFor(user.username), deps.now ? deps.now() : Date.now(), options)
          if ('error' in served) return { status: STATUS_FOR_CODE[served.code], body: { error: served.error, code: served.code, ...(served.missingNodeIds ? { missingNodeIds: served.missingNodeIds } : {}) } } as const
          if (served.changed || contextChanged) await deps.saveStore(user, store)
          return { status: 200, body: served.response, changed: served.changed || contextChanged, userId: user.id } as const
        }
      })

      if (outcome.status === 200 && outcome.changed) {
        deps.notify?.(outcome.userId, {
          type: 'sync_changed',
          scope: parsed.scope,
          resultCid: outcome.body.resultCid,
          byPeerId: parsed.peerId
        })
      }
      return res.status(outcome.status).json(outcome.body)
    } catch (error) {
      console.error('peer-sync failed:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

/** GET /user/data/peer-sync?scope=id,id — inspect the node a device would attach to. */
export function createPeerSyncInspector(deps: Pick<PeerSyncDeps, 'loadStore'>) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const username = claimsUsername(req)
      if (!username) return res.status(401).json({ error: 'Unauthorized' })
      const loaded = await deps.loadStore(username)
      if (!loaded) return res.status(401).json({ error: 'User not found' })
      const scopeParam = typeof req.query.scope === 'string' ? req.query.scope : ''
      const scope = scopeParam ? scopeParam.split(',').filter(Boolean) : []
      const claims = claimsOf(req)
      if (claims.kind === 'peer') {
        const denied = peerCredentialError(claims, claims.peerId ?? '', scope)
        if (denied) return res.status(403).json({ error: denied })
        // The raw inspector includes membership and proposal summaries. Scoped agents use
        // the MCP projection instead; it filters both and rechecks live permissions.
        return res.status(403).json({ error: 'Use the scoped MCP or peer-sync protocol to read a peer attachment.' })
      }
      const root = rootTargetCid(loaded.store)
      const cid = resolveScope(loaded.store, root, scope)
      if (!cid) return res.status(404).json({ error: 'scope not found' })
      return res.json({
        peerId: serverPeerIdFor(loaded.user.username),
        rootAliasCid: loaded.store.rootNodeId,
        cid,
        view: viewNode(loaded.store, cid)
      })
    } catch (error) {
      console.error('peer-sync inspect failed:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

/**
 * GET /user/data/peer-sync/attachment?peerId= — where this device should attach.
 * A peer credential answers from its claims; a user session looks the device up
 * in the graph ([PEER, ref] edges) and defaults to the root.
 */
export function createPeerAttachmentHandler(deps: Pick<PeerSyncDeps, 'loadStore'>) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const claims = claimsOf(req)
      if (!claims.username) return res.status(401).json({ error: 'Unauthorized' })
      const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : claims.peerId
      if (!peerId) return res.status(400).json({ error: 'peerId required' })
      const loaded = await deps.loadStore(claims.username)
      if (!loaded) return res.status(401).json({ error: 'User not found' })
      const root = rootTargetCid(loaded.store)
      const scope = claims.kind === 'peer'
        ? (Array.isArray(claims.scope) ? claims.scope : [])
        : findPeerScope(loaded.store, root, peerId) ?? []
      const attached = claims.kind === 'peer' || findPeerScope(loaded.store, root, peerId) !== null
      return res.json({
        username: loaded.user.username,
        serverPeerId: serverPeerIdFor(loaded.user.username),
        peerId,
        scope,
        scopeNames: scopeNames(loaded.store, root, scope),
        attached,
        kind: claims.kind === 'peer' ? 'peer' : 'user'
      })
    } catch (error) {
      console.error('peer attachment lookup failed:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

/**
 * POST /user/data/peer-sync/proposals {scope, proposalId, decision: 'approve'|'reject'}
 * The owner (user session) may decide any proposal; an invited peer needs the
 * `approve` capability on that node. Approval merges the branch into the main
 * content (new version with PREV), rejection drops it.
 */
export function createProposalDecisionHandler(deps: PeerSyncDeps) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const claims = claimsOf(req)
      if (!claims.username) return res.status(401).json({ error: 'Unauthorized' })
      const body = (req.body ?? {}) as { scope?: unknown; proposalId?: unknown; decision?: unknown }
      const scope = Array.isArray(body.scope) && body.scope.every((s) => typeof s === 'string') ? (body.scope as string[]) : null
      if (!scope || typeof body.proposalId !== 'string' || (body.decision !== 'approve' && body.decision !== 'reject')) {
        return res.status(400).json({ error: 'scope, proposalId and decision (approve|reject) required' })
      }
      const proposalId: string = body.proposalId
      const decision: 'approve' | 'reject' = body.decision
      const username = claims.username
      const outcome = await withUserLock(`user:${username}`, async () => {
        const loaded = await deps.loadStore(username)
        if (!loaded) return { status: 401, body: { error: 'User not found' } } as const
        const { user, store } = loaded
        const linkCid = resolveScope(store, rootTargetCid(store), scope)
        if (!linkCid) return { status: 404, body: { error: 'node not found' } } as const
        const actor = claims.kind === 'peer' ? claims.peerId ?? '' : serverPeerIdFor(user.username)
        if (claims.kind === 'peer') {
          const granted = Array.isArray(claims.scope) ? claims.scope : []
          const within = granted.length <= scope.length && granted.every((s, i) => scope[i] === s)
          if (!within || !hasCapability(store, content(store, linkCid), actor, 'approve')) {
            return { status: 403, body: { error: 'approve capability required on this node' } } as const
          }
        }
        const replica: Replica = createReplica(actor, store)
        const before = headCid(replica)
        const now = deps.now ? deps.now() : Date.now()
        if (decision === 'approve') applyProposalAt(replica, scope, proposalId, actor, now)
        else rejectProposalAt(replica, scope, proposalId, now)
        const changed = headCid(replica) !== before
        if (changed) await deps.saveStore(user, store)
        const node = resolveScope(store, rootTargetCid(store), scope)
        console.log(`[proposal] ${decision} ${proposalId.slice(0, 16)} by ${actor} at ${scope.join('/')} → changed=${changed}${node ? ` proposals=${viewNode(store, node).proposals.map((p) => `${p.id.slice(0, 10)}:${p.status}`).join(',')}` : ''}`)
        return { status: 200, body: { decision, changed, view: node ? viewNode(store, node) : null }, changed, userId: user.id } as const
      })
      if (outcome.status === 200 && outcome.changed) {
        deps.notify?.(outcome.userId, { type: 'sync_changed', scope, byPeerId: `decision:${proposalId}` })
      }
      return res.status(outcome.status).json(outcome.body)
    } catch (error) {
      console.error('proposal decision failed:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

/** Mark the node at `scope` as a link and add `peerId` as a member with `capabilities` (used when an invite is approved). */
export async function attachMemberToNode(deps: PeerSyncDeps, username: string, scope: string[], peerId: string, name: string | null, capabilities: Array<'edit' | 'approve'>): Promise<boolean> {
  return withUserLock(`user:${username}`, async () => {
    const loaded = await deps.loadStore(username)
    if (!loaded) return false
    const { user, store } = loaded
    const { addMemberAt } = await import('@fosforescent/shared/sync/index')
    const replica: Replica = createReplica(serverPeerIdFor(user.username), store)
    const before = headCid(replica)
    try {
      addMemberAt(replica, scope, peerId, name, capabilities, deps.now ? deps.now() : Date.now())
    } catch (error) {
      console.error('attachMemberToNode failed:', error)
      return false
    }
    if (headCid(replica) !== before) {
      await deps.saveStore(user, store)
      deps.notify?.(user.id, { type: 'sync_changed', scope, byPeerId: `member:${peerId}` })
    }
    return true
  })
}

/**
 * DELETE /user/data/peer-sync/attachment — a device deliberately detaches itself
 * from the node it is attached to (its PEER and MEMBER edges are removed).
 */
export function createDetachHandler(deps: PeerSyncDeps) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const claims = claimsOf(req)
      if (!claims.username) return res.status(401).json({ error: 'Unauthorized' })
      const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : claims.peerId
      if (!peerId) return res.status(400).json({ error: 'peerId required' })
      if (claims.kind === 'peer' && claims.peerId !== peerId) return res.status(403).json({ error: 'credential belongs to a different peer' })
      const username = claims.username
      const outcome = await withUserLock(`user:${username}`, async () => {
        const loaded = await deps.loadStore(username)
        if (!loaded) return { status: 401, body: { error: 'User not found' } } as const
        const { user, store } = loaded
        const root = rootTargetCid(store)
        const scope = findPeerScope(store, root, peerId)
        if (!scope) return { status: 200, body: { detached: false }, changed: false, userId: user.id } as const
        const { removePeerAt } = await import('@fosforescent/shared/sync/index')
        const replica: Replica = createReplica(serverPeerIdFor(user.username), store)
        const before = headCid(replica)
        removePeerAt(replica, scope, peerId, deps.now ? deps.now() : Date.now())
        const changed = headCid(replica) !== before
        if (changed) await deps.saveStore(user, store)
        return { status: 200, body: { detached: changed, scope }, changed, userId: user.id } as const
      })
      if (outcome.status === 200 && outcome.changed) deps.notify?.(outcome.userId, { type: 'sync_changed', scope: outcome.body.scope, byPeerId: `detach:${peerId}` })
      return res.status(outcome.status).json(outcome.body)
    } catch (error) {
      console.error('detach failed:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

/**
 * Re-embed a user's rows a little after each save (debounced per user, never on the request path).
 * Row embeddings feed `POST /user/data/search`; a failure here only logs (search degrades, sync does not).
 */
const indexTimers = new Map<number, ReturnType<typeof setTimeout>>()
const indexEmbed = vertexEmbed()
const INDEX_DELAY_MS = Number(process.env.ROW_INDEX_DELAY_MS ?? 3000)
function scheduleIndex(user: PeerSyncUser, store: FosStore): void {
  if (process.env.ROW_INDEX_DISABLED === 'true') return
  const pending = indexTimers.get(user.id)
  if (pending) clearTimeout(pending)
  indexTimers.set(user.id, setTimeout(() => {
    indexTimers.delete(user.id)
    indexStore(prisma, user, store, indexEmbed)
      .then((r) => { if (r.embedded || r.removed) console.log(`[search] indexed ${user.username}: +${r.embedded} -${r.removed}`) })
      .catch((error) => console.warn('[search] indexing failed:', String(error instanceof Error ? error.message || error : error).replace(/\s+/g, ' ').trim().slice(0, 400)))
  }, INDEX_DELAY_MS))
  indexTimers.get(user.id)?.unref?.()
}

export const prismaPeerSyncDeps: PeerSyncDeps = {
  async loadStore(username) {
    const user = await prisma.userModel.findUnique({ where: { user_name: username }, include: { fosNode: true } })
    if (!user) return null
    const store = await dbToStore(prisma, user)
    // Older data kept link nodes inline; rewrite them into ref nodes once and persist (deterministic, idempotent).
    if (normalizeReplicaRefs(store)) {
      console.log(`[sync] normalized legacy link nodes for ${username}`)
      await storeToDb(prisma, user, store)
    }
    return { user: { id: user.id, username: user.user_name }, store }
  },
  async saveStore(user, store) {
    const dbUser = await prisma.userModel.findUnique({ where: { id: user.id }, include: { fosNode: true } })
    if (!dbUser) throw new Error(`user ${user.id} vanished during sync`)
    await storeToDb(prisma, dbUser, store)
    scheduleIndex(user, store)
    for (const hook of afterSaveHooks) { try { hook(user, store) } catch (error) { console.error('[sync] after-save hook failed:', error instanceof Error ? error.message : error) } }
  },
  notify(userId, message) {
    sendToUser(userId, message)
  },
  onlinePeers(userId) {
    return onlinePeersOf(userId)
  }
}

export const postPeerSync = createPeerSyncHandler(prismaPeerSyncDeps)
export const getPeerSyncDoc = createPeerSyncInspector(prismaPeerSyncDeps)
export const getPeerAttachment = createPeerAttachmentHandler(prismaPeerSyncDeps)
export const postProposalDecision = createProposalDecisionHandler(prismaPeerSyncDeps)
export const deleteAttachment = createDetachHandler(prismaPeerSyncDeps)
