import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { addRow, addTask, createReplica, ensureHomeContext, headCid, loadReplica, serializeReplica, setRowContentAt, view, type Replica } from './replica'
import { content, identityCid, isRefNode, resolveScope, typeIdOf, valueContent, HOME_ID } from './graph'
import { syncWith } from './test-helpers'
import {
  USER_FIELD, USER_SELF_ATTESTATION, USER_SERVER_ATTESTATION, cacheUser, cachedUser, isUserType, rebindUsers, unverifiedUser, userAttestationPayload,
  userFieldEdge, userOf, usersPath, verifyUser, type UserRecord, type UserTrust
} from './users'
import { ALLOCATION_TYPE } from './library-types'

// an ed25519 key from a fixed seed, as the server makes its identity key (backend/sync/identity.ts)
const keyFrom = (byte: number) => {
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, byte)]), format: 'der', type: 'pkcs8' })
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer
  return { privateKey, publicKey: spki.subarray(spki.length - 32).toString('base64') }
}
const server = keyFrom(7), stranger = keyFrom(9)
const ed25519 = (payload: string, signature: string, publicKey: string) =>
  verify(null, Buffer.from(payload), createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' }), Buffer.from(signature, 'base64'))
const trust: UserTrust = { servers: { fos: server.publicKey }, verify: ed25519 }
function attested(base: Omit<UserRecord, 'verification'>, key = server, by = 'fos', method = USER_SERVER_ATTESTATION, issuedAt = 1000): UserRecord {
  return { ...base, verification: { by, method, issuedAt, attestation: sign(null, Buffer.from(userAttestationPayload(base, by, method, issuedAt)), key.privateKey).toString('base64') } }
}
const bob = attested({ account: '42', username: 'bob', name: 'Bob Builder', publicKey: '' })
const rowNode = (r: Replica, path: string[]) => valueContent(r.store, resolveScope(r.store, headCid(r), path)!)

test('"@bob" binds a ref to a user object, a row of the library user type read through its form', () => {
  let r = addTask(createReplica('d'), [], 'review', 1, 't')
  r = addRow(r, ['t'], ALLOCATION_TYPE, 'read the draft', 2, { id: 'rq', requirement: { capability: 'peer' }, user: bob })
  const node = rowNode(r, ['t', 'rq'])
  // no string: the requirement holds no peer name; its `user` field is a ref whose type is lib:type:user
  expect(node.data.allocation?.peer).toBeUndefined()
  const edge = userFieldEdge(r.store, node)!
  expect(typeIdOf(r.store, edge[0])).toBe('lib:type:user')
  expect(isUserType(r.store, edge[0])).toBe(true)
  const ref = content(r.store, identityCid(r.store, edge))
  expect(isRefNode(r.store, ref)).toBe(true)
  expect(ref.data.name?.content).toBe(USER_FIELD)
  expect(userOf(r.store, node)).toEqual(bob)
  const row = view(r, ['t'])!.tasks.find(t => t.id === 'rq')!
  expect(row.user).toEqual(bob)
  expect(row.requirement!.summary).toBe('@bob')
  // the same record is the same node wherever it is bound
  r = addRow(r, ['t'], ALLOCATION_TYPE, 'again', 3, { id: 'rq2', requirement: { capability: 'peer' }, user: bob })
  const other = userFieldEdge(r.store, rowNode(r, ['t', 'rq2']))!
  expect(valueContent(r.store, identityCid(r.store, other))).toEqual(valueContent(r.store, identityCid(r.store, edge)))
  // survives a reload
  expect(view(loadReplica(serializeReplica(r)), ['t'])!.tasks.find(t => t.id === 'rq')!.user).toEqual(bob)
})

test('a requirement naming a user is filled only by that same user object', () => {
  let r = addTask(createReplica('d'), [], 'review', 1, 't')
  r = addRow(r, ['t'], ALLOCATION_TYPE, 'read it', 2, { id: 'rq', requirement: { capability: 'peer' }, user: bob })
  r = addRow(r, ['t', 'rq'], ALLOCATION_TYPE, '', 3, { id: 'a1', allocation: { resource: '', type: 'person', amount: 1, unit: 'h' }, user: attested({ account: '43', username: 'bobby', name: 'Bob', publicKey: '' }) })
  expect(view(r, [])!.tasks.find(t => t.id === 't')!.blockedBy).toEqual(['@bob'])
  r = addRow(r, ['t', 'rq'], ALLOCATION_TYPE, '', 4, { id: 'a2', allocation: { resource: '', type: 'person', amount: 1, unit: 'h' }, user: bob })
  expect(view(r, [])!.tasks.find(t => t.id === 't')!.blockedBy).toBeUndefined()
  // an amount requirement for bob counts only bob's allocations
  r = addRow(r, ['t'], ALLOCATION_TYPE, 'reward', 5, { id: 'pay', requirement: { capability: 'allocation', resource: 'points', amount: 5, unit: 'ff' }, user: bob })
  r = addRow(r, ['t', 'pay'], ALLOCATION_TYPE, '', 6, { id: 'p1', allocation: { resource: 'fos:points', type: 'points', amount: 5, unit: 'ff' } })
  expect(view(r, ['t'])!.tasks.find(t => t.id === 'pay')!.requirement).toMatchObject({ satisfied: false, have: 0, summary: 'points 5 ff @bob' })
  r = addRow(r, ['t', 'pay'], ALLOCATION_TYPE, '', 7, { id: 'p2', allocation: { resource: 'fos:points', type: 'points', amount: 5, unit: 'ff' }, user: bob })
  expect(view(r, ['t'])!.tasks.find(t => t.id === 'pay')!.requirement).toMatchObject({ satisfied: true, have: 5 })
})

test('rewriting the row rebinds or drops its user', () => {
  let r = addTask(createReplica('d'), [], 'review', 1, 't')
  r = addRow(r, ['t'], ALLOCATION_TYPE, 'read it', 2, { id: 'rq', requirement: { capability: 'peer' }, user: bob })
  r = setRowContentAt(r, ['t'], 'rq', ALLOCATION_TYPE, 'read it', { requirement: { capability: 'peer' }, user: unverifiedUser('carol') }, 3)
  expect(view(r, ['t'])!.tasks[0]!.user).toMatchObject({ username: 'carol', verification: null })
  r = setRowContentAt(r, ['t'], 'rq', ALLOCATION_TYPE, 'read it', { requirement: { capability: 'confirmation' }, user: null }, 4)
  expect(view(r, ['t'])!.tasks[0]!.user).toBeUndefined()
  expect(view(r, ['t', 'rq'])!.tasks).toEqual([])
})

test('verified objects are cached in Home; typed "@bob" binds the cached one, earlier unverified rows are rebound', () => {
  let r = ensureHomeContext(createReplica('d'), 1)
  r = addTask(r, [HOME_ID], 'review', 2, 't')
  r = addRow(r, [HOME_ID, 't'], ALLOCATION_TYPE, 'offline', 3, { id: 'early', requirement: { capability: 'peer' }, user: unverifiedUser('bob') })
  expect(cachedUser(r, 'bob')).toBeNull()
  r = cacheUser(r, bob, 4)
  expect(usersPath(r)).toEqual([HOME_ID, 'fos:users'])
  expect(cachedUser(r, 'BOB')).toEqual(bob)
  expect(cacheUser(r, bob, 5)).toBe(r)
  r = addRow(r, [HOME_ID, 't'], ALLOCATION_TYPE, 'online', 6, { id: 'late', requirement: { capability: 'peer' }, user: unverifiedUser('bob') })
  expect(view(r, [HOME_ID, 't'])!.tasks.find(t => t.id === 'late')!.user).toEqual(bob)
  expect(view(r, [HOME_ID, 't'])!.tasks.find(t => t.id === 'early')!.user!.verification).toBeNull()
  r = rebindUsers(r, bob, 7)
  expect(view(r, [HOME_ID, 't'])!.tasks.find(t => t.id === 'early')!.user).toEqual(bob)
})

test('the user object travels with the row through node sync', () => {
  let a = addTask(createReplica('a'), [], 'review', 1, 't'), hub = createReplica('server'), b = createReplica('b')
  a = addRow(a, ['t'], ALLOCATION_TYPE, 'read it', 2, { id: 'rq', requirement: { capability: 'peer' }, user: bob })
  a = syncWith(a, hub)
  b = syncWith(b, hub)
  const row = view(b, ['t'])!.tasks.find(t => t.id === 'rq')!
  expect(row.user).toEqual(bob)
  expect(verifyUser(row.user!, trust)).toEqual({ ok: true, by: 'fos' })
})

test('verification accepts the server attestation and rejects tampered, unsigned and foreign objects', () => {
  expect(verifyUser(bob, trust)).toEqual({ ok: true, by: 'fos' })
  expect(verifyUser({ ...bob, name: 'Mallory' }, trust)).toMatchObject({ ok: false })
  expect(verifyUser({ ...bob, account: '1' }, trust)).toMatchObject({ ok: false })
  expect(verifyUser({ ...bob, verification: { ...bob.verification!, issuedAt: 2000 } }, trust)).toMatchObject({ ok: false })
  expect(verifyUser(unverifiedUser('bob'), trust)).toMatchObject({ ok: false, reason: '@bob is not verified yet' })
  // signed by a key the client does not trust for `fos`, or naming a verifier it does not know
  expect(verifyUser(attested({ account: '42', username: 'bob', name: 'Bob', publicKey: '' }, stranger), trust)).toMatchObject({ ok: false })
  expect(verifyUser(attested({ account: '42', username: 'bob', name: 'Bob', publicKey: '' }, stranger, 'elsewhere'), trust)).toMatchObject({ ok: false, reason: 'elsewhere is not a trusted verifier' })
  // the key-pair seam: a self signature checks against the object's own public key
  const own = keyFrom(3)
  const self = attested({ account: '42', username: 'bob', name: 'Bob', publicKey: own.publicKey }, own, 'user:bob', USER_SELF_ATTESTATION)
  expect(verifyUser(self, trust)).toEqual({ ok: true, by: 'user:bob' })
  expect(verifyUser({ ...self, publicKey: stranger.publicKey }, trust)).toMatchObject({ ok: false })
})
