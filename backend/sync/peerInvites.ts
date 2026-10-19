/**
 * Peer invites: let a device attach to one of a user's nodes without the
 * user's password.
 *
 *   inviting user   POST /user/data/peer-invite {scope}        → token (shown as text / QR)
 *   invitee         POST /peer/connect {token, peerId, name}   → requestId; the user is notified
 *   inviting user   POST /user/data/peer-invite/:id/approve|deny
 *   invitee         GET  /peer/connect/:requestId?peerId=      → pending | approved {jwt, scope} | denied
 *
 * The granted JWT carries `kind: 'peer'`, the peer id and the scope; the JWT
 * middleware confines it to the peer-sync routes and the sync handler confines
 * it to that scope. The invite token itself is only stored hashed.
 */

import { createHash, randomBytes } from 'node:crypto'
import * as jsonwebtoken from 'jsonwebtoken'
// jsonwebtoken is CJS; under ESM (tsx) its functions live on the namespace, under ts-jest on .default.
const jwtSign: typeof jsonwebtoken.sign = jsonwebtoken.sign ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.sign
import type { Request, Response } from 'express'
import { prisma } from '../prismaClient'
import { sendToUser } from '../promptNotifications'
import { attachMemberToNode, prismaAccountStoreDeps } from './accountStore'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not set')
}

export const INVITE_TTL_MS = 15 * 60 * 1000
export const PEER_JWT_TTL_S = 30 * 24 * 60 * 60

export type PeerClaims = { username: string; peerId: string; scope: string[]; kind: 'peer'; name?: string; exp: number }

export type InviteStatus = 'open' | 'pending' | 'approved' | 'denied' | 'expired' | 'delivered'

export type InviteRecord = {
  id: number
  userId: number
  tokenHash: string
  requestId: string | null
  scope: string[]
  scopeNames: string[]
  status: InviteStatus
  peerId: string | null
  peerName: string | null
  grantedJwt: string | null
  expiresAt: Date
  createdAt: Date
}

export type InviteRepo = {
  create(data: Pick<InviteRecord, 'userId' | 'tokenHash' | 'scope' | 'scopeNames' | 'expiresAt'>): Promise<InviteRecord>
  findByTokenHash(tokenHash: string): Promise<InviteRecord | null>
  findByRequestId(requestId: string): Promise<InviteRecord | null>
  findById(id: number): Promise<InviteRecord | null>
  findPendingForUser(userId: number): Promise<InviteRecord[]>
  update(id: number, patch: Partial<InviteRecord>): Promise<InviteRecord>
}

export type PeerInviteDeps = {
  repo: InviteRepo
  resolveUser(username: string): Promise<{ id: number; username: string } | null>
  resolveUserById(id: number): Promise<{ id: number; username: string } | null>
  notify?(userId: number, message: Record<string, unknown>): void
  /** Record the approved device as a member of the invited node (makes it a link) with [CAPABILITY, …] edges. */
  attachMember?(username: string, scope: string[], peerId: string, name: string | null, capabilities: Array<'read' | 'edit' | 'execute'>): Promise<boolean>
  now?(): number
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateInviteToken(): string {
  return `fosinv_${randomBytes(24).toString('base64url')}`
}

export function signPeerJwt(username: string, peerId: string, scope: string[], nowMs: number = Date.now(), name?: string | null): string {
  const claims: PeerClaims = {
    username,
    peerId,
    scope,
    kind: 'peer',
    ...(name ? { name } : {}),
    exp: Math.floor(nowMs / 1000) + PEER_JWT_TTL_S
  }
  return jwtSign(claims, JWT_SECRET as string)
}

export function claimsOf(req: Request): { username?: string; kind?: string; peerId?: string; scope?: string[] } {
  return ((req as unknown as { claims?: Record<string, unknown> }).claims ?? {}) as { username?: string; kind?: string; peerId?: string; scope?: string[] }
}

function isScope(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 32 && value.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 128)
}

function publicView(invite: InviteRecord) {
  return {
    id: invite.id,
    peerId: invite.peerId,
    peerName: invite.peerName,
    scope: invite.scope,
    scopeNames: invite.scopeNames,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt
  }
}

export function createPeerInviteHandlers(deps: PeerInviteDeps) {
  const now = () => (deps.now ? deps.now() : Date.now())

  async function requireUser(req: Request, res: Response) {
    const claims = claimsOf(req)
    if (!claims.username) { res.status(401).json({ error: 'Unauthorized' }); return null }
    if (claims.kind === 'peer') { res.status(403).json({ error: 'A peer credential cannot manage invites' }); return null }
    const user = await deps.resolveUser(claims.username)
    if (!user) { res.status(401).json({ error: 'User not found' }); return null }
    return user
  }

  const expired = (invite: InviteRecord) => invite.expiresAt.getTime() < now()

  return {
    /** POST /user/data/peer-invite {scope, scopeNames} */
    async createInvite(req: Request, res: Response): Promise<Response | void> {
      try {
        const user = await requireUser(req, res)
        if (!user) return
        const body = (req.body ?? {}) as { scope?: unknown; scopeNames?: unknown }
        const scope = body.scope === undefined ? [] : body.scope
        if (!isScope(scope)) return res.status(400).json({ error: 'scope must be an array of ids' })
        const scopeNames = Array.isArray(body.scopeNames) && body.scopeNames.length === scope.length ? body.scopeNames.map(String) : [...scope]
        const token = generateInviteToken()
        const invite = await deps.repo.create({
          userId: user.id,
          tokenHash: hashInviteToken(token),
          scope,
          scopeNames,
          expiresAt: new Date(now() + INVITE_TTL_MS)
        })
        return res.json({ token, inviteId: invite.id, scope, scopeNames, expiresAt: invite.expiresAt })
      } catch (error) {
        console.error('create invite failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    },

    /** GET /user/data/peer-invite/requests */
    async listRequests(req: Request, res: Response): Promise<Response | void> {
      try {
        const user = await requireUser(req, res)
        if (!user) return
        const pending = (await deps.repo.findPendingForUser(user.id)).filter((i) => !expired(i))
        return res.json({ requests: pending.map(publicView) })
      } catch (error) {
        console.error('list invite requests failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    },

    /** POST /user/data/peer-invite/:id/approve {capabilities?: ['read' | 'edit' | 'execute', …]} — the approver decides what the device may do (default: edit). */
    async approveRequest(req: Request, res: Response): Promise<Response | void> {
      try {
        const user = await requireUser(req, res)
        if (!user) return
        const body = (req.body ?? {}) as { capabilities?: unknown }
        const allowed = ['read', 'edit', 'execute'] as const
        const requested = Array.isArray(body.capabilities) ? body.capabilities.filter((c): c is typeof allowed[number] => (allowed as readonly string[]).includes(c)) : []
        const capabilities: Array<typeof allowed[number]> = requested.length ? [...new Set(requested)] : ['edit']
        const invite = await deps.repo.findById(Number(req.params.id))
        if (!invite || invite.userId !== user.id) return res.status(404).json({ error: 'Request not found' })
        if (invite.status !== 'pending' || !invite.peerId) return res.status(409).json({ error: `Request is ${invite.status}` })
        if (expired(invite)) return res.status(409).json({ error: 'Request expired' })
        const granted = signPeerJwt(user.username, invite.peerId, invite.scope, now(), invite.peerName)
        const updated = await deps.repo.update(invite.id, { status: 'approved', grantedJwt: granted })
        if (deps.attachMember) await deps.attachMember(user.username, invite.scope, invite.peerId, invite.peerName, capabilities)
        return res.json({ request: publicView(updated), capabilities })
      } catch (error) {
        console.error('approve invite failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    },

    /** POST /user/data/peer-invite/:id/deny */
    async denyRequest(req: Request, res: Response): Promise<Response | void> {
      try {
        const user = await requireUser(req, res)
        if (!user) return
        const invite = await deps.repo.findById(Number(req.params.id))
        if (!invite || invite.userId !== user.id) return res.status(404).json({ error: 'Request not found' })
        const updated = await deps.repo.update(invite.id, { status: 'denied', grantedJwt: null })
        return res.json({ request: publicView(updated) })
      } catch (error) {
        console.error('deny invite failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    },

    /** POST /peer/connect {token, peerId, name}  (no auth) */
    async claimInvite(req: Request, res: Response): Promise<Response> {
      try {
        const body = (req.body ?? {}) as { token?: unknown; peerId?: unknown; name?: unknown }
        if (typeof body.token !== 'string' || !body.token.startsWith('fosinv_')) return res.status(400).json({ error: 'token required' })
        if (typeof body.peerId !== 'string' || !body.peerId || body.peerId.length > 128) return res.status(400).json({ error: 'peerId required' })
        const name = typeof body.name === 'string' ? body.name.slice(0, 80) : ''
        const invite = await deps.repo.findByTokenHash(hashInviteToken(body.token))
        if (!invite || expired(invite)) return res.status(404).json({ error: 'Invite not found or expired' })
        if (invite.status !== 'open') return res.status(409).json({ error: 'Invite already used' })
        const requestId = randomBytes(18).toString('base64url')
        const updated = await deps.repo.update(invite.id, { status: 'pending', peerId: body.peerId, peerName: name, requestId })
        deps.notify?.(invite.userId, {
          type: 'peer_request',
          inviteId: updated.id,
          peerId: body.peerId,
          peerName: name,
          scope: updated.scope,
          scopeNames: updated.scopeNames
        })
        return res.json({ requestId, scope: updated.scope, scopeNames: updated.scopeNames, expiresAt: updated.expiresAt })
      } catch (error) {
        console.error('claim invite failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    },

    /** GET /peer/connect/:requestId?peerId=  (no auth) */
    async pollRequest(req: Request, res: Response): Promise<Response> {
      try {
        const requestId = String(req.params.requestId ?? '')
        const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : ''
        const invite = requestId ? await deps.repo.findByRequestId(requestId) : null
        if (!invite || invite.peerId !== peerId) return res.status(404).json({ error: 'Request not found' })
        if (invite.status === 'pending' && expired(invite)) return res.json({ status: 'expired' })
        if (invite.status === 'approved' && invite.grantedJwt) {
          const granted = invite.grantedJwt
          const { scope, scopeNames } = invite
          const user = await deps.resolveUserById(invite.userId)
          await deps.repo.update(invite.id, { status: 'delivered', grantedJwt: null })
          return res.json({ status: 'approved', jwt: granted, username: user?.username ?? null, scope, scopeNames })
        }
        return res.json({ status: invite.status === 'delivered' ? 'approved' : invite.status })
      } catch (error) {
        console.error('poll invite failed:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
      }
    }
  }
}

function toRecord(row: {
  id: number; userId: number; tokenHash: string; requestId: string | null; scope: unknown; scopeNames: unknown
  status: string; peerId: string | null; peerName: string | null; grantedJwt: string | null; expiresAt: Date; createdAt: Date
}): InviteRecord {
  return {
    ...row,
    scope: Array.isArray(row.scope) ? row.scope.map(String) : [],
    scopeNames: Array.isArray(row.scopeNames) ? row.scopeNames.map(String) : [],
    status: row.status as InviteStatus
  }
}

export const prismaInviteRepo: InviteRepo = {
  async create(data) {
    return toRecord(await prisma.peerInviteModel.create({ data: { ...data, scope: data.scope, scopeNames: data.scopeNames } }))
  },
  async findByTokenHash(tokenHash) {
    const row = await prisma.peerInviteModel.findUnique({ where: { tokenHash } })
    return row ? toRecord(row) : null
  },
  async findByRequestId(requestId) {
    const row = await prisma.peerInviteModel.findUnique({ where: { requestId } })
    return row ? toRecord(row) : null
  },
  async findById(id) {
    if (!Number.isFinite(id)) return null
    const row = await prisma.peerInviteModel.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  },
  async findPendingForUser(userId) {
    const rows = await prisma.peerInviteModel.findMany({ where: { userId, status: 'pending' }, orderBy: { createdAt: 'desc' } })
    return rows.map(toRecord)
  },
  async update(id, patch) {
    const { scope, scopeNames, ...rest } = patch
    return toRecord(await prisma.peerInviteModel.update({
      where: { id },
      data: { ...rest, ...(scope ? { scope } : {}), ...(scopeNames ? { scopeNames } : {}) }
    }))
  }
}

export const prismaPeerInviteDeps: PeerInviteDeps = {
  repo: prismaInviteRepo,
  async resolveUser(username) {
    const user = await prisma.userModel.findUnique({ where: { user_name: username }, select: { id: true, user_name: true } })
    return user ? { id: user.id, username: user.user_name } : null
  },
  async resolveUserById(id) {
    const user = await prisma.userModel.findUnique({ where: { id }, select: { id: true, user_name: true } })
    return user ? { id: user.id, username: user.user_name } : null
  },
  notify(userId, message) {
    sendToUser(userId, message)
  },
  attachMember(username, scope, peerId, name, capabilities) {
    return attachMemberToNode(prismaAccountStoreDeps, username, scope, peerId, name, capabilities)
  }
}

export const peerInviteHandlers = createPeerInviteHandlers(prismaPeerInviteDeps)
