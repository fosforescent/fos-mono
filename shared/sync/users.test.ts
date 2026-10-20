import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { addRow, addSupply, addTask, bindUserAt, createReplica, ensureHomeContext, headCid, loadReplica, serializeReplica, setRowContentAt, shareHome, view, type Replica } from './replica'
import { content, identityCid, isRefNode, memberEntryId, resolveScope, typeIdOf, valueContent, HOME_ID } from './graph'
import { syncWith } from './test-helpers'
import {
  USER_FIELD, USER_SELF_ATTESTATION, USER_SERVER_ATTESTATION, cacheUser, cachedUser, isUserType, rebindUsers, unverifiedUser, userAttestationPayload,
  userFieldEdge, userOf, usersPath, verifyUser, peerKeyId, publishedKey, publishedKeys, requestVerification, verifiedAt, verifyPublished, verifyRequestId, type UserRecord, type UserTrust
} from './users'
import { ALLOCATION_TYPE } from './library-types'

// an ed25519 key from a fixed seed, as the server makes its identity key (backend/sync/verify.ts)
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

test('the server publishes its key on its member entry; a device\'s verify handler reads it there and rejects tampered objects', () => {
  let account = ensureHomeContext(createReplica('user:alice'), 1, { server: ['verify'], keys: { fos: server.publicKey } })
  expect(publishedKey(account, 'fos')).toBe(server.publicKey)
  expect(publishedKeys(account)).toEqual({ fos: server.publicKey })
  // unchanged on the next ensure; a new key replaces the row
  expect(ensureHomeContext(account, 2, { keys: { fos: server.publicKey } })).toBe(account)
  expect(publishedKey(ensureHomeContext(loadReplica(serializeReplica(account)), 2, { keys: { fos: stranger.publicKey } }), 'fos')).toBe(stranger.publicKey)
  // the key row is a row of the user type on the fos member entry of the root, not in Home, and no one `@fos` binds
  const keyRow = rowNode(account, [memberEntryId('fos'), peerKeyId('fos')])
  expect(keyRow.data.alias?.id).toBe('fos:key:fos')
  expect(resolveScope(account.store, headCid(account), [HOME_ID, 'fos:users', peerKeyId('fos')])).toBeNull()
  expect(cachedUser(account, 'fos')).toBeNull()
  // an owner's device attached at Home takes the server's entry above it, key row included
  const home = syncWith(shareHome(ensureHomeContext(createReplica('phone'), 1)), account)
  expect(publishedKey(home, 'fos')).toBe(server.publicKey)
  expect(verifyPublished(home, bob, ed25519)).toEqual({ ok: true, by: 'fos' })
  // and a device synced at the root receives it with the root's members
  let device = syncWith(ensureHomeContext(createReplica('user:alice'), 1), account)
  expect(publishedKey(device, 'fos')).toBe(server.publicKey)
  expect(verifyPublished(device, bob, ed25519)).toEqual({ ok: true, by: 'fos' })
  for (const forged of [{ ...bob, name: 'Mallory' }, { ...bob, account: '1' }, { ...bob, publicKey: stranger.publicKey }, attested({ account: '42', username: 'bob', name: 'Bob Builder', publicKey: '' }, stranger)]) expect(verifyPublished(device, forged, ed25519).ok).toBe(false)
  expect(verifyPublished(device, unverifiedUser('bob'), ed25519)).toMatchObject({ ok: false, reason: '@bob is not verified yet' })
  // attested by a server whose key this graph does not publish
  expect(verifyPublished(device, attested({ account: '42', username: 'bob', name: 'Bob', publicKey: '' }, stranger, 'elsewhere'), ed25519)).toMatchObject({ ok: false, reason: 'elsewhere has published no key here' })
  // without any published key nothing verifies
  expect(verifyPublished(ensureHomeContext(createReplica('d'), 1), bob, ed25519).ok).toBe(false)
  device = syncWith(device, account)
  expect(publishedKey(device, 'fos')).toBe(server.publicKey)
})

test('a verify request names the user in a verify requirement among the people; the filled one holds the attested object', () => {
  let r = ensureHomeContext(createReplica('d'), 1)
  const asked = requestVerification(r, '@Bob', 2)
  expect(asked.path).toEqual([HOME_ID, 'fos:users', verifyRequestId('bob')])
  const row = view(asked.replica, [HOME_ID, 'fos:users'])!.tasks.find(t => t.id === asked.path.at(-1))!
  expect(row.title).toBe('@Bob')
  expect(row.requirement).toMatchObject({ capability: 'verify', satisfied: false })
  expect(verifiedAt(asked.replica, asked.path)).toBeNull()
  // what the verifier does: bind the attested object, supply
  r = bindUserAt(asked.replica, asked.path, bob, 3)
  expect(view(r, [HOME_ID, 'fos:users'])!.tasks.find(t => t.id === asked.path.at(-1))!.requirement!.satisfied).toBe(false)
  r = addSupply(r, [HOME_ID, 'fos:users'], asked.path.at(-1)!, { capability: 'verify', by: 'fos', ref: '42' }, 4)
  expect(view(r, [HOME_ID, 'fos:users'])!.tasks.find(t => t.id === asked.path.at(-1))!.requirement).toMatchObject({ satisfied: true, summary: 'verify @bob' })
  expect(verifiedAt(r, asked.path)).toEqual(bob)
  // asking again replaces the earlier request
  expect(view(requestVerification(r, 'bob', 5).replica, [HOME_ID, 'fos:users'])!.tasks.filter(t => t.id === asked.path.at(-1))).toHaveLength(1)
})
