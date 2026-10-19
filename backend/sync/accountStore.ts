/**
 * The account server's side of syncing with devices and peers: loading and saving an account's store (one request
 * at a time per account, `withUserLock`), where a device attaches (`/user/data/peer-sync/attachment`), detaching, and
 * re-indexing rows after a save. Node exchange itself is `provideNode.ts` (shared/sync/node-provider.ts protocol).
 *
 * Persistence is injected so the handlers can be unit-tested without Postgres.
 */
import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { createReplica, content, findPeerScope, headCid, normalizeReplicaRefs, rootTargetCid, scopeNames, type Replica } from '@fosforescent/shared/sync/index'
import { prisma } from '../prismaClient'
import { dbToStore, storeToDb } from '../util'
import { onlinePeersOf, sendToUser } from '../promptNotifications'
import { indexStore, vertexEmbed } from '../search/rowIndex'
import type { HandlerRegistry } from './registry'

export type AccountUser = { id: number; username: string }

export type AccountStoreDeps = {
  /** Load the user's store (the user group). Null when the user is unknown. */
  loadStore(username: string): Promise<{ user: AccountUser; store: FosStore } | null>
  saveStore(user: AccountUser, store: FosStore): Promise<void>
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
export const afterSaveHooks: Array<(user: AccountUser, store: FosStore) => void> = []

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

/**
 * GET /user/data/peer-sync/attachment?peerId= — where this device should attach.
 * A peer credential answers from its claims; a user session looks the device up
 * in the graph ([PEER, ref] edges) and defaults to the root.
 */
export function createPeerAttachmentHandler(deps: Pick<AccountStoreDeps, 'loadStore'>) {
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

/** Mark the node at `scope` as a link and add `peerId` as a member with `capabilities` (used when an invite is approved). */
export async function attachMemberToNode(deps: AccountStoreDeps, username: string, scope: string[], peerId: string, name: string | null, capabilities: Array<'read' | 'edit' | 'execute'>): Promise<boolean> {
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
export function createDetachHandler(deps: AccountStoreDeps) {
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
function scheduleIndex(user: AccountUser, store: FosStore): void {
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

/** Index an account's rows right away (the market effect lists a task and wants it searchable before it reports success). */
export async function indexNow(user: { id: number; username: string }, store: FosStore): Promise<void> {
  if (process.env.ROW_INDEX_DISABLED === 'true') return
  const pending = indexTimers.get(user.id)
  if (pending) { clearTimeout(pending); indexTimers.delete(user.id) }
  await indexStore(prisma, user, store, indexEmbed)
}

export const prismaAccountStoreDeps: AccountStoreDeps = {
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

export const getPeerAttachment = createPeerAttachmentHandler(prismaAccountStoreDeps)
export const deleteAttachment = createDetachHandler(prismaAccountStoreDeps)
