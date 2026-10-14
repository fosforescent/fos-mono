import type { Request, Response } from 'express'
import { verify } from 'jsonwebtoken'
import { addMemberAt, addRow, addTask, addRefAt, createReplica, setSharing, configurePoll, sharedProjection, writeNodeValue, participation, headCid, argumentRefs, content, refValueCid, removeMemberAt, setMemberCapabilitiesAt, renameTask, ensureSharedLink, ensureHomeContext, view, readNodeValue, resolveScope, valueContent, put, withProposal, proposalContent, commitRoot, updateAtScope, putStripped, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createSharingHandlers } from './sharing'
const share = 'public-link-0123456789', at = { owner: 'host', path: ['poll'], share }
function setup(audience: 'public' | 'users' = 'public', mode: 'approval' | 'rank' = 'approval') {
  let host = addRow(createReplica('user:host'), [], 'requirement', 'Lunch?', 1, { id: 'poll', requirement: { capability: 'choice', options: ['Soup', 'Salad'] } })
  host = setSharing(host, ['poll'], { id: share, audience, enabled: true }, 2)
  host = addMemberAt(host, [], 'fos', 'Fos', ['poll'], 2)
  host = configurePoll(host, ['poll'], mode, 3)
  host = writeNodeValue(host, [], 'secret', 'host-only-secret', 4)
  host = addRefAt(host, ['poll'], 'comment-slot', host.store.primitive.documentField.getId(), 4, undefined, 'Comment')
  let guest = addTask(createReplica('user:guest'), [], 'Visible text', 1, 'source')
  guest = addTask(guest, ['source'], 'private-child-secret', 2, 'private')
  guest = writeNodeValue(guest, [], 'private-token', 'guest-secret', 3)
  const replicas: Record<string, Replica> = { host, guest }
  const handlers = createSharingHandlers({ loadStore: async owner => replicas[owner] ? { user: { id: owner === 'host' ? 1 : 2, username: owner }, store: replicas[owner].store } : null, saveStore: async (user, store) => { replicas[user.username] = createReplica(`user:${user.username}`, store) }, now: () => 10 }, 'test-only-secret')
  const call = async (action: keyof typeof handlers, body: object, account?: string, kind = 'user') => {
    let status = 200, result: any
    const res = { status(n: number) { status = n; return res }, json(b: unknown) { result = b; return res }, setHeader() {} } as unknown as Response
    await handlers[action]({ body, ...(account ? { claims: { username: account, kind } } : {}) } as unknown as Request, res)
    return { status, body: result }
  }
  return { replicas, call }
}
const input = (visit: any, extra: object = {}) => ({ ...at, visitorToken: visit.visitorToken, revision: visit.node.revision, name: 'Pat', approvals: ['option:0'], ranking: [], fields: {}, ...extra })
test('anonymous poll asks for a name, persists one identity, and never grants an account token', async () => {
  const s = setup(), visit = await s.call('visit', at)
  expect(visit.status).toBe(200)
  expect(JSON.stringify(visit.body)).not.toContain('host-only-secret')
  expect(() => verify(visit.body.visitorToken, 'test-only-secret')).toThrow()
  expect((await s.call('submit', input(visit.body, { name: '' }))).status).toBe(400)
  const saved = await s.call('submit', input(visit.body))
  expect(saved.status).toBe(200)
  expect(saved.body.node.counts['option:0']).toBe(1)
  expect(saved.body.node.mine.name).toBe('Pat')
  const again = await s.call('submit', input(saved.body, { visitorToken: visit.body.visitorToken, approvals: ['option:1'] }))
  expect(again.status).toBe(200)
  expect(again.body.node.counts).toEqual({ 'option:1': 1 })
  const reload = await s.call('visit', { ...at, visitorToken: visit.body.visitorToken })
  expect(reload.body.node.mine.peer).toBe(saved.body.node.mine.peer)
})
test('authenticated state lives in guest account, with only declared projection and a ref in host', async () => {
  const s = setup('users')
  expect((await s.call('visit', at)).status).toBe(401)
  const visit = await s.call('visit', at, 'guest')
  expect(visit.status).toBe(200)
  const key = visit.body.node.inputs[0].key
  const saved = await s.call('submit', input(visit.body, { fields: { [key]: { source: 'source', value: 'spoofed' } } }), 'guest')
  expect(saved.status).toBe(200)
  expect(saved.body.node.mine.fields[key]).toBe('Visible text')
  const record = participation(s.replicas.host, ['poll'], 'user:guest')!
  expect(record.account?.owner).toBe('guest')
  expect(JSON.stringify(record)).not.toContain('private-child-secret')
  expect(JSON.stringify(record)).not.toContain('guest-secret')
  expect(JSON.stringify(saved.body)).not.toContain('private-child-secret')
  const arg = argumentRefs(s.replicas.guest.store, headCid(s.replicas.guest)).find(a => a.name?.startsWith('fos:participation:'))!
  expect(content(s.replicas.guest.store, arg.cid).data.alias?.id).toBe(record.account?.ref)
  expect(content(s.replicas.guest.store, refValueCid(s.replicas.guest.store, content(s.replicas.guest.store, arg.cid))!).data.description?.content).toContain('source')
})
test('revocation, audience permissions, stale versions, and unexpected fields reject input', async () => {
  const s = setup(), visit = await s.call('visit', at)
  expect((await s.call('submit', input(visit.body, { fields: { arbitrary: { value: 'no' } } }))).status).toBe(400)
  expect((await s.call('submit', input(visit.body, { revision: 'stale' }))).status).toBe(409)
  s.replicas.host = setMemberCapabilitiesAt(s.replicas.host, ['poll'], 'audience:public', ['read', 'approve', 'rank'], ['approve'], 11)
  expect((await s.call('submit', input(visit.body))).status).toBe(403)
  s.replicas.host = removeMemberAt(s.replicas.host, ['poll'], visit.body.node.mine.peer, 12)
  expect((await s.call('visit', { ...at, visitorToken: visit.body.visitorToken })).status).toBe(403)
  s.replicas.host = setSharing(s.replicas.host, ['poll'], { id: share, audience: 'public', enabled: false }, 13)
  expect((await s.call('visit', at)).status).toBe(404)
})
test('rank input requires unique, complete current options and replaces earlier ranking', async () => {
  const s = setup('public', 'rank'), visit = await s.call('visit', at)
  expect((await s.call('submit', input(visit.body, { approvals: [], ranking: ['option:0', 'option:0'] }))).status).toBe(400)
  expect((await s.call('submit', input(visit.body, { approvals: [], ranking: ['option:0'] }))).status).toBe(400)
  const saved = await s.call('submit', input(visit.body, { approvals: [], ranking: ['option:1', 'option:0'] }))
  expect(saved.status).toBe(200)
  expect(saved.body.node.rankings).toEqual({ 'option:1': 2, 'option:0': 1 })
  s.replicas.host = renameTask(s.replicas.host, [], 'poll', 'Changed question', 11)
  expect((await s.call('submit', input(visit.body, { approvals: [], ranking: ['option:0', 'option:1'] }))).status).toBe(409)
})

test('received links reuse the host peer under Home and do not grant access to the guest context', () => {
  let r = ensureHomeContext(createReplica('guest-device'), 1)
  const first = ensureSharedLink(r, at, 'Lunch?', 2)
  r = first.replica
  expect(first.path[0]).toBe('fos:home')
  expect(view(r, ['fos:home'])!.tasks).toHaveLength(1)
  expect(view(r, first.path.slice(0, -1))!.members[0].capabilities).toEqual([])
  expect(readNodeValue(r, first.path, 'fos:shared-link')).toEqual(at)
  const repeated = ensureSharedLink(r, at, 'Lunch?', 3)
  expect(repeated.replica).toBe(r)
  r = ensureSharedLink(r, { ...at, share: 'another-share-0123456' }, 'Dinner?', 4).replica
  expect(view(r, ['fos:home'])!.tasks).toHaveLength(1)
  expect(view(r, first.path.slice(0, -1))!.tasks).toHaveLength(2)
  const anonymous = ensureSharedLink(ensureHomeContext(createReplica('anon'), 1), at, 'Lunch?', 2, true)
  expect(view(anonymous.replica, ['fos:home'])!.tasks[0].title).toBe('Host')
})
test('only an owner can configure a link; enabling polls requires the Fos handler', async () => {
  const s = setup()
  const expected = () => put(s.replicas.host.store, valueContent(s.replicas.host.store, resolveScope(s.replicas.host.store, headCid(s.replicas.host), ['poll'])!))
  const body = { path: ['poll'], expected: expected(), audience: 'public', enabled: true, poll: 'approval' }
  expect((await s.call('configure', body)).status).toBe(403)
  expect((await s.call('configure', body, 'host', 'peer')).status).toBe(403)
  s.replicas.host = removeMemberAt(s.replicas.host, [], 'fos', 10)
  expect((await s.call('configure', { ...body, expected: expected() }, 'host')).status).toBe(409)
  s.replicas.host = addMemberAt(s.replicas.host, [], 'fos', 'Fos', ['poll'], 11)
  expect((await s.call('configure', { ...body, expected: expected() }, 'host')).status).toBe(200)
})

test('approving a proposed edit records input without merging or removing the proposal', async () => {
  const s = setup(), r = s.replicas.host, store = r.store
  const cid = resolveScope(store, headCid(r), ['poll'])!
  const base = putStripped(store, content(store, cid))
  const proposed = put(store, { ...valueContent(store, cid), data: { ...valueContent(store, cid).data, description: { content: 'Proposed question' } } })
  const proposal = put(store, proposalContent(store, 'editor', 'Editor proposal', proposed, base, 5))
  commitRoot(store, updateAtScope(store, headCid(r), ['poll'], value => withProposal(store, value, 'editor', proposal, 'Editor proposal'), 'node'), 6)
  const visit = await s.call('visit', at)
  expect(visit.body.node.proposals).toHaveLength(1)
  const saved = await s.call('submit', input(visit.body, { approvals: [`proposal:${proposal}`], ranking: [`proposal:${proposal}`] }))
  expect(saved.status).toBe(200)
  expect(saved.body.node.counts[`proposal:${proposal}`]).toBe(1)
  expect(view(s.replicas.host, [])!.tasks.find(t => t.id === 'poll')!.title).toBe('Lunch?')
  expect(view(s.replicas.host, ['poll'])!.proposals[0].status).toBe('open')
})
test('allocation links expose only requested fields and reject mismatching sources', async () => {
  const s = setup('users')
  s.replicas.host = addRow(s.replicas.host, ['poll'], 'requirement', 'Bring one dress', 5, { id: 'need', requirement: { capability: 'allocation', resource: 'inventory', unit: 'dress', amount: 1 } })
  s.replicas.guest = addRow(s.replicas.guest, [], 'allocation', 'private inventory label', 5, { id: 'dress', allocation: { resource: 'private-bank', type: 'inventory', unit: 'dress', amount: 1, start: 123, end: 456 } })
  const visit = await s.call('visit', at, 'guest')
  const saved = await s.call('submit', input(visit.body, { fields: { need: { source: 'dress' } } }), 'guest')
  expect(saved.status).toBe(200)
  expect(saved.body.node.mine.fields.need).toEqual({ amount: 1, type: 'inventory', unit: 'dress' })
  expect(JSON.stringify(saved.body.node.mine)).not.toContain('private-bank')
  expect((await s.call('submit', input(visit.body, { fields: { need: { source: 'source' } } }), 'guest')).status).toBe(400)
  expect(view(s.replicas.guest, ['fos:home'])!.tasks.some(t => view(s.replicas.guest, ['fos:home', t.id])?.members.some(m => m.peerId === 'user:host'))).toBe(true)
})
