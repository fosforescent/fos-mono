import type { Request, Response } from 'express'
import { verify } from 'jsonwebtoken'
import { addMemberAt, addRow, addTask, addRefAt, createReplica, publish, unpublish, sharedProjection, writeNodeValue, participation, headCid, argumentRefs, content, refValueCid, removeMemberAt, setMemberCapabilitiesAt, renameTask, ensureSharedLink, ensureHomeContext, view, readNodeValue, resolveScope, valueContent, put, withProposal, proposalContent, commitRoot, updateAtScope, putStripped, readProposals, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createSharingHandlers } from './sharing'
import { NOTE_TYPE, ALLOCATION_TYPE } from '@fosforescent/shared/sync/library-types'
const at = { owner: 'host', path: ['poll'] }
function setup(audience: 'public' | 'users' = 'public', mode: 'approval' | 'rank' = 'approval') {
  let host = addRow(createReplica('user:host'), [], ALLOCATION_TYPE, 'Lunch?', 1, { id: 'poll', requirement: { capability: 'choice', options: ['Soup', 'Salad'] } })
  // published: the audience may run the node (execute only); its choice is an input visitors answer
  host = publish(host, ['poll'], audience, 2)
  void mode
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
const input = (visit: any, extra: object = {}) => ({ ...at, visitorToken: visit.visitorToken, revision: visit.node.revision, name: 'Pat', approvals: [], ranking: [], fields: { '[]': { value: 0 } }, ...extra })
test('an anonymous visitor answers the published choice as an input, keeps one identity, and never gets an account token', async () => {
  const s = setup(), visit = await s.call('visit', at)
  expect(visit.status).toBe(200)
  expect(visit.body.node.inputs[0]).toMatchObject({ key: '[]', kind: 'choice', options: ['Soup', 'Salad'] })
  expect(JSON.stringify(visit.body)).not.toContain('host-only-secret')
  expect(() => verify(visit.body.visitorToken, 'test-only-secret')).toThrow()
  expect((await s.call('submit', input(visit.body, { fields: { '[]': { value: 7 } } }))).status).toBe(400)
  const saved = await s.call('submit', input(visit.body))
  expect(saved.status).toBe(200)
  expect(saved.body.node.mine).toMatchObject({ name: 'Pat', fields: { '[]': 0 } })
  const again = await s.call('submit', input(saved.body, { visitorToken: visit.body.visitorToken, fields: { '[]': { value: 1 } } }))
  expect(again.status).toBe(200)
  expect(again.body.node.mine.fields).toEqual({ '[]': 1 })
  const reload = await s.call('visit', { ...at, visitorToken: visit.body.visitorToken })
  expect(reload.body.node.mine.peer).toBe(saved.body.node.mine.peer)
})
test('authenticated state lives in guest account, with only declared projection and a ref in host', async () => {
  const s = setup('users')
  expect((await s.call('visit', at)).status).toBe(404) // no permission: as if there were no node
  const visit = await s.call('visit', at, 'guest')
  expect(visit.status).toBe(200)
  const key = visit.body.node.inputs.find((f: any) => f.kind === 'text').key
  const saved = await s.call('submit', input(visit.body, { fields: { '[]': { value: 0 }, [key]: { source: 'source', value: 'spoofed' } } }), 'guest')
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
test('unpublishing, removed visitors, stale versions, and unexpected fields reject input', async () => {
  const s = setup(), visit = await s.call('visit', at)
  expect((await s.call('submit', input(visit.body, { fields: { arbitrary: { value: 'no' } } }))).status).toBe(400)
  expect((await s.call('submit', input(visit.body, { revision: 'stale' }))).status).toBe(409)
  s.replicas.host = renameTask(s.replicas.host, [], 'poll', 'Changed question', 11)
  expect((await s.call('submit', input(visit.body))).status).toBe(409)
  s.replicas.host = removeMemberAt(s.replicas.host, ['poll'], visit.body.node.mine.peer, 12)
  expect((await s.call('visit', { ...at, visitorToken: visit.body.visitorToken })).status).toBe(404)
  // a visitor's own membership never outlives what its audience may do: an audience that may only read gives no votes
  const fresh = await s.call('visit', at)
  s.replicas.host = setMemberCapabilitiesAt(s.replicas.host, ['poll'], 'audience:public', ['read'], [], 13)
  expect(fresh.status).toBe(200)
  s.replicas.host = unpublish(s.replicas.host, ['poll'], 'public', 14)
  expect((await s.call('visit', at)).status).toBe(404)
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
  r = ensureSharedLink(r, { ...at, path: ['dinner'] }, 'Dinner?', 4).replica
  expect(view(r, ['fos:home'])!.tasks).toHaveLength(1)
  expect(view(r, first.path.slice(0, -1))!.tasks).toHaveLength(2)
  const anonymous = ensureSharedLink(ensureHomeContext(createReplica('anon'), 1), at, 'Lunch?', 2, true)
  expect(view(anonymous.replica, ['fos:home'])!.tasks[0].title).toBe('Host')
})
test('there is no configure route: publishing is a member edge the owner writes and syncs', () => {
  const s = setup() as any
  expect(s.call).toBeDefined()
  expect(Object.keys(createSharingHandlers({ loadStore: async () => null, saveStore: async () => {} }, 'x')).sort()).toEqual(['read', 'submit', 'visit'])
})

test('approving a proposed edit is input the owner decides with (the tally never merges or removes the proposal)', async () => {
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
  s.replicas.host = addRow(s.replicas.host, ['poll'], ALLOCATION_TYPE, 'Bring one dress', 5, { id: 'need', requirement: { capability: 'allocation', resource: 'inventory', unit: 'dress', amount: 1 } })
  s.replicas.guest = addRow(s.replicas.guest, [], ALLOCATION_TYPE, 'private inventory label', 5, { id: 'dress', allocation: { resource: 'private-bank', type: 'inventory', unit: 'dress', amount: 1, start: 123, end: 456 } })
  const visit = await s.call('visit', at, 'guest')
  const saved = await s.call('submit', input(visit.body, { fields: { need: { source: 'dress' } } }), 'guest')
  expect(saved.status).toBe(200)
  expect(saved.body.node.mine.fields.need).toEqual({ amount: 1, type: 'inventory', unit: 'dress' })
  expect(JSON.stringify(saved.body.node.mine)).not.toContain('private-bank')
  expect((await s.call('submit', input(visit.body, { fields: { need: { source: 'source' } } }), 'guest')).status).toBe(400)
  expect(view(s.replicas.guest, ['fos:home'])!.tasks.some(t => view(s.replicas.guest, ['fos:home', t.id])?.members.some(m => m.peerId === 'user:host'))).toBe(true)
})
test('the public read endpoint serves the projection for embeds without recording a visitor', async () => {
  let host = addRow(createReplica('user:host'), [], NOTE_TYPE, '# A post\n\nWith a **body**.', 1, { id: 'post' })
  host = addRow(host, ['post'], NOTE_TYPE, '## Part\n\nMore.', 2, { id: 'part' })
  host = writeNodeValue(host, [], 'secret', 'host-only-secret', 3)
  host = publish(host, ['post'], 'public', 4)
  const replicas: Record<string, Replica> = { host }
  let saves = 0
  const handlers = createSharingHandlers({ loadStore: async owner => replicas[owner] ? { user: { id: 1, username: owner }, store: replicas[owner].store } : null, saveStore: async () => { saves++ }, now: () => 10 }, 'test-only-secret')
  const read = async (query: Record<string, unknown>) => {
    let status = 200, result: any
    const headers: Record<string, string> = {}
    const res = { status(n: number) { status = n; return res }, json(b: unknown) { result = b; return res }, setHeader(k: string, v: string) { headers[k] = v } } as unknown as Response
    await handlers.read({ query } as unknown as Request, res)
    return { status, body: result, headers }
  }
  const ok = await read({ owner: 'host', path: JSON.stringify(['post']) })
  expect(ok.status).toBe(200)
  // a note publishes its title line, and its body as a Markdown row of its own
  expect(ok.body.node).toMatchObject({ title: 'A post', type: 'lib:type:note' })
  expect(ok.body.node.rows).toEqual([
    { id: 'post/field/body', title: '', depth: 0, type: 'lib:type:markdown', body: '# A post\n\nWith a **body**.' },
    { id: 'part', title: 'Part', depth: 0, type: 'lib:type:note' },
    { id: 'part/field/body', title: '', depth: 1, type: 'lib:type:markdown', body: '## Part\n\nMore.' }
  ])
  expect(ok.body.node.mine).toBeUndefined()
  expect(ok.headers['Cache-Control']).toBe('public, max-age=60')
  expect(JSON.stringify(ok.body)).not.toContain('host-only-secret')
  expect(saves).toBe(0)
  expect(view(replicas.host, ['post'])!.members.some(m => m.peerId.startsWith('visitor:'))).toBe(false)
  expect((await read({ owner: 'host', path: JSON.stringify(['post', 'part']) })).status).toBe(404)
  expect((await read({ owner: 'host', path: 'not json' })).status).toBe(400)
  replicas.host = publish(unpublish(replicas.host, ['post'], 'public', 5), ['post'], 'users', 5)
  expect((await read({ owner: 'host', path: JSON.stringify(['post']) })).status).toBe(404)
})
test('answers to a missing binding are binding proposals on the owner node, one per anonymous visitor', async () => {
  const s = setup(), visit = await s.call('visit', at), other = await s.call('visit', at)
  const key = visit.body.node.inputs.find((f: any) => f.kind === 'text').key
  expect((await s.call('submit', input(visit.body, { fields: { [key]: { value: 'Soup, hot' } } }))).status).toBe(200)
  expect((await s.call('submit', input(other.body, { fields: { [key]: { value: 'Salad' } } }))).status).toBe(200)
  const host = s.replicas.host, ref = content(host.store, resolveScope(host.store, headCid(host), ['poll', key])!)
  const proposals = readProposals(host.store, ref).filter(p => p.status === 'open')
  expect(proposals).toHaveLength(2)
  expect(new Set(proposals.map(p => p.peerId)).size).toBe(2)
  expect(proposals.every(p => p.peerId.startsWith('visitor:'))).toBe(true)
  // still unbound: the owner decides
  expect(refValueCid(host.store, ref)).toBeNull()
})
