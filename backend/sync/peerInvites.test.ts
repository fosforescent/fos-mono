import type { Request, Response } from 'express'
import * as jsonwebtoken from 'jsonwebtoken'
const jwtVerify: typeof jsonwebtoken.verify = jsonwebtoken.verify ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.verify

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))

import { createPeerInviteHandlers, hashInviteToken, type InviteRecord, type InviteRepo, type PeerInviteDeps } from './peerInvites'

type Sent = { status: number; body: any }
function fakeRes(): { res: Response; sent: () => Sent } {
  const state: Sent = { status: 200, body: undefined }
  const res = {
    status(code: number) { state.status = code; return res },
    json(body: unknown) { state.body = body; return res }
  } as unknown as Response
  return { res, sent: () => state }
}
const req = (body: unknown, claims: unknown, params: Record<string, string> = {}, query: Record<string, string> = {}): Request =>
  ({ body, claims, params, query } as unknown as Request)

function memoryRepo(): InviteRepo & { rows: InviteRecord[] } {
  const rows: InviteRecord[] = []
  let nextId = 1
  return {
    rows,
    async create(data) {
      const row: InviteRecord = { id: nextId++, requestId: null, status: 'open', peerId: null, peerName: null, grantedJwt: null, createdAt: new Date(), ...data }
      rows.push(row)
      return row
    },
    async findByTokenHash(h) { return rows.find((r) => r.tokenHash === h) ?? null },
    async findByRequestId(id) { return rows.find((r) => r.requestId === id) ?? null },
    async findById(id) { return rows.find((r) => r.id === id) ?? null },
    async findPendingForUser(userId) { return rows.filter((r) => r.userId === userId && r.status === 'pending') },
    async update(id, patch) { const row = rows.find((r) => r.id === id)!; Object.assign(row, patch); return row }
  }
}

function makeDeps(nowMs = Date.now()) {
  const repo = memoryRepo()
  const notifications: Array<{ userId: number; message: Record<string, unknown> }> = []
  let now = nowMs
  const deps: PeerInviteDeps = {
    repo,
    async resolveUser(username) { return username === 'alice' ? { id: 7, username } : null },
    async resolveUserById(id) { return id === 7 ? { id, username: 'alice' } : null },
    notify(userId, message) { notifications.push({ userId, message }) },
    now: () => now
  }
  return { deps, repo, notifications, advance: (ms: number) => { now += ms } }
}

describe('peer invites', () => {
  it('runs the full flow: create → claim → notify → approve → poll delivers a scoped peer jwt once', async () => {
    const { deps, repo, notifications } = makeDeps()
    const h = createPeerInviteHandlers(deps)

    const c = fakeRes()
    await h.createInvite(req({ scope: ['work'], scopeNames: ['Work'] }, { username: 'alice' }), c.res)
    expect(c.sent().status).toBe(200)
    const { token, inviteId } = c.sent().body
    expect(token).toMatch(/^fosinv_/)
    expect(repo.rows[0]?.tokenHash).toBe(hashInviteToken(token))

    const claim = fakeRes()
    await h.claimInvite(req({ token, peerId: 'phone-1', name: 'My phone' }, undefined), claim.res)
    expect(claim.sent().status).toBe(200)
    const { requestId } = claim.sent().body
    expect(notifications[0]).toMatchObject({ userId: 7, message: { type: 'peer_request', peerId: 'phone-1', scope: ['work'] } })

    const list = fakeRes()
    await h.listRequests(req({}, { username: 'alice' }), list.res)
    expect(list.sent().body.requests).toHaveLength(1)
    expect(list.sent().body.requests[0]).toMatchObject({ id: inviteId, peerId: 'phone-1', peerName: 'My phone', scopeNames: ['Work'] })

    const pending = fakeRes()
    await h.pollRequest(req({}, undefined, { requestId }, { peerId: 'phone-1' }), pending.res)
    expect(pending.sent().body).toEqual({ status: 'pending' })

    const attached: unknown[] = []
    deps.attachMember = async (...args) => { attached.push(args); return true }
    const approve = fakeRes()
    await h.approveRequest(req({ capabilities: ['approve'] }, { username: 'alice' }, { id: String(inviteId) }), approve.res)
    expect(approve.sent().status).toBe(200)
    expect(attached).toEqual([['alice', ['work'], 'phone-1', 'My phone', ['edit', 'approve']]])

    const granted = fakeRes()
    await h.pollRequest(req({}, undefined, { requestId }, { peerId: 'phone-1' }), granted.res)
    expect(granted.sent().body).toMatchObject({ status: 'approved', username: 'alice', scope: ['work'], scopeNames: ['Work'] })
    const claims = jwtVerify(granted.sent().body.jwt, process.env.JWT_SECRET as string) as Record<string, unknown>
    expect(claims).toMatchObject({ username: 'alice', peerId: 'phone-1', scope: ['work'], kind: 'peer', name: 'My phone' })

    // the jwt is handed out once; later polls just report the state
    const again = fakeRes()
    await h.pollRequest(req({}, undefined, { requestId }, { peerId: 'phone-1' }), again.res)
    expect(again.sent().body).toEqual({ status: 'approved' })
    expect(repo.rows[0]?.grantedJwt).toBeNull()
  })

  it('rejects wrong tokens, reused invites, other peers polling, denial, and expiry', async () => {
    const { deps, advance } = makeDeps()
    const h = createPeerInviteHandlers(deps)
    const c = fakeRes()
    await h.createInvite(req({ scope: [] }, { username: 'alice' }), c.res)
    const { token, inviteId } = c.sent().body

    const bad = fakeRes()
    await h.claimInvite(req({ token: 'fosinv_nope', peerId: 'p' }, undefined), bad.res)
    expect(bad.sent().status).toBe(404)

    const ok = fakeRes()
    await h.claimInvite(req({ token, peerId: 'p' }, undefined), ok.res)
    const { requestId } = ok.sent().body
    const reuse = fakeRes()
    await h.claimInvite(req({ token, peerId: 'q' }, undefined), reuse.res)
    expect(reuse.sent().status).toBe(409)

    const other = fakeRes()
    await h.pollRequest(req({}, undefined, { requestId }, { peerId: 'q' }), other.res)
    expect(other.sent().status).toBe(404)

    const deny = fakeRes()
    await h.denyRequest(req({}, { username: 'alice' }, { id: String(inviteId) }), deny.res)
    const polled = fakeRes()
    await h.pollRequest(req({}, undefined, { requestId }, { peerId: 'p' }), polled.res)
    expect(polled.sent().body).toEqual({ status: 'denied' })

    const c2 = fakeRes()
    await h.createInvite(req({ scope: [] }, { username: 'alice' }), c2.res)
    advance(16 * 60 * 1000)
    const late = fakeRes()
    await h.claimInvite(req({ token: c2.sent().body.token, peerId: 'p' }, undefined), late.res)
    expect(late.sent().status).toBe(404)
  })

  it('does not let a peer credential manage invites and validates scope', async () => {
    const { deps } = makeDeps()
    const h = createPeerInviteHandlers(deps)
    const peer = fakeRes()
    await h.createInvite(req({ scope: [] }, { username: 'alice', kind: 'peer', peerId: 'x' }), peer.res)
    expect(peer.sent().status).toBe(403)
    const badScope = fakeRes()
    await h.createInvite(req({ scope: 'root' }, { username: 'alice' }), badScope.res)
    expect(badScope.sent().status).toBe(400)
  })
})
