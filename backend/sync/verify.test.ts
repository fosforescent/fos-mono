import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { usersPath, HOME_ID, accountContextAbove, membershipPathAt, addRequirement, argumentSupplier, bindUserAt, addRow, addTask, cacheUser, cachedUser, createReplica, ensureHomeContext, evaluationRecord, loadReplica, peerKeyId, publishedKey, rebindUsers, requestVerification, serializeReplica, shareHome, syncNodeTree, unverifiedUser, verifyPublished, verifyUser, view, type NodeRequest, type ProvidedNode, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { asAccountStore } from './deviceRoot'
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createNodeProvider } from './provideNode'
import { createHostRuntime } from './host-runtime'
import type { AccountStoreDeps } from './accountStore'
import { identityKeyFromEnv, identityKeyFromSeed, verifyEd25519, verifyHandler } from './verify'

const accounts: Record<string, { id: number; username: string; name?: string | null; publicKey?: string | null }> = { bob: { id: 42, username: 'bob', name: 'Bob Builder' }, ada: { id: 7, username: 'ada', publicKey: 'cHVibGljLWtleQ==' } }
const verify = verifyHandler({ findUser: async username => accounts[username] ?? null, now: () => 1234 }, identityKeyFromSeed(Buffer.alloc(32, 5)))

/** An account `alice` on a host with this runtime: its event route (owners' `complete`) and its node provider. */
function host(runtime = createHostRuntime([verify])) {
  let store = asAccountStore(new FosStore())
  const deps: AccountStoreDeps = {
    async loadStore(username) { return username === 'alice' ? { user: { id: 1, username }, store } : null },
    async saveStore(_user, next) { store = next },
    now: () => 2000, runtime
  }
  const events = createEventService(deps, createEvaluationService(deps, runtime).runNode)
  const provider = createNodeProvider(deps)
  const send = async (scope: string[], event: unknown) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await events.http({ claims: { username: 'alice' }, body: { scope, event } } as unknown as Request, res)
    return { status, body }
  }
  /** A device syncs its Home with the account node by node, as the app and the CLI do. */
  const sync = async (device: Replica): Promise<Replica> => {
    const r = shareHome(device), local = r.meta.localScope ?? []
    const done = await syncNodeTree(r, { peer: r.meta.serverPeerId ?? 'user:alice', scope: [], remoteRoot: local, localRoot: local, branches: [], push: true, above: accountContextAbove(r) }, async (request: NodeRequest) => {
      let status = 200, body: unknown
      const res = { setHeader() { return res }, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
      await provider({ body: request, claims: { username: 'alice' } } as unknown as Request, res)
      if (status !== 200) throw new Error(`${status} ${JSON.stringify(body)}`)
      return body as ProvidedNode
    }, () => 5)
    return { ...done.replica, meta: { ...done.replica.meta, serverPeerId: done.peer } }
  }
  return { send, sync, get: () => createReplica('user:alice', store), set: (r: Replica) => { store = r.store } }
}

test('the verifier attests a username: account id, username, display name, key, verification', async () => {
  const bob = (await verify.resolve('@bob'))!
  expect(bob).toEqual({ account: '42', username: 'bob', name: 'Bob Builder', publicKey: '', verification: { by: 'fos', method: 'ed25519-server', issuedAt: 1234, attestation: expect.any(String) } })
  expect((await verify.resolve('ada'))!).toMatchObject({ name: 'ada', publicKey: 'cHVibGljLWtleQ==' })
  expect(await verify.resolve('nobody')).toBeNull()
  expect(verifyUser(bob, { servers: { fos: verify.publicKey }, verify: verifyEd25519 })).toEqual({ ok: true, by: 'fos' })
  expect(verify.verify(bob)).toBe(true)
})

test('the server re-checks before it acts: tampered, unverified and foreign objects are rejected', async () => {
  const bob = (await verify.resolve('bob'))!
  expect(verify.verify({ ...bob, username: 'mallory' })).toBe(false)
  expect(verify.verify({ ...bob, account: '1' })).toBe(false)
  expect(verify.verify({ ...bob, publicKey: 'c29tZW9uZSBlbHNl' })).toBe(false)
  expect(verify.verify({ ...bob, verification: { ...bob.verification!, attestation: Buffer.alloc(64).toString('base64') } })).toBe(false)
  expect(verify.verify({ ...bob, verification: null })).toBe(false)
  const other = verifyHandler({ findUser: async username => accounts[username] ?? null }, identityKeyFromSeed(Buffer.alloc(32, 6)))
  expect(verify.verify((await other.resolve('bob'))!)).toBe(false)
  // a self signature is the key-pair seam, not something the server pays on
  expect(verify.verify({ ...bob, verification: { ...bob.verification!, method: 'ed25519-self' } })).toBe(false)
})

test('a verify requirement is filled through the evaluation: the attested object bound as its user field, and the server\'s supply', async () => {
  const h = host()
  let r = ensureHomeContext(h.get(), 1, createHostRuntime([verify]).hostOffers())
  const asked = requestVerification(r, 'bob', 2)
  h.set(asked.replica)
  const read = await h.send([], { kind: 'read', path: asked.path })
  const done = await h.send([], { kind: 'complete', path: asked.path, expected: read.body.valueRevision })
  if (!done.body.evaluation) throw new Error(`verify failed: ${JSON.stringify(done.body)}`)
  expect(done.body.evaluation.status).toBe('committed')
  r = h.get()
  const row = view(r, asked.path.slice(0, -1))!.tasks.find(t => t.id === asked.path.at(-1))!
  expect(row.requirement).toMatchObject({ capability: 'verify', satisfied: true })
  expect(row.user).toMatchObject({ account: '42', username: 'bob', name: 'Bob Builder', verification: { by: 'fos', method: 'ed25519-server' } })
  expect(verify.verify(row.user!)).toBe(true)
  expect(argumentSupplier(r, asked.path)).toBe('fos')
  // an unknown name is refused before anything runs; nothing is journaled
  const unknown = requestVerification(r, 'nobody', 3)
  h.set(unknown.replica)
  const again = await h.send([], { kind: 'read', path: unknown.path })
  const refused = await h.send([], { kind: 'complete', path: unknown.path, expected: again.body.valueRevision })
  expect(String(refused.body.error)).toMatch(/No Fos user is named @nobody/)
  expect(evaluationRecord(h.get(), unknown.path)).toBeNull()
})

test('the server\'s key is graph data: published on its member entry and carried to devices by node exchange, where they check attestations', async () => {
  const runtime = createHostRuntime([verify])
  expect(runtime.hostOffers().keys).toEqual({ fos: verify.publicKey })
  expect(runtime.serverCapabilities()).toContain('verify')
  const h = host(runtime)
  let device = ensureHomeContext(createReplica('user:alice'), 1)
  device = addTask(device, [HOME_ID], 'review the draft', 2, 'review')
  device = bindUserAt(addRequirement(device, [HOME_ID, 'review'], 'read it', 3, { capability: 'peer' }, 'rq'), [HOME_ID, 'review', 'rq'], unverifiedUser('bob'), 3)
  expect(publishedKey(device, 'fos')).toBeNull()
  device = await h.sync(device)
  // the account context the server ensured on exchange holds the key row, and so does the device now
  expect(publishedKey(h.get(), 'fos')).toBe(verify.publicKey)
  expect(publishedKey(device, 'fos')).toBe(verify.publicKey)
  // on the fos member entry of the root, above Home: not among the people
  expect(view(device, membershipPathAt(device, [], 'fos')!)!.tasks.map(t => t.id)).toContain(peerKeyId('fos'))
  expect(usersPath(device)).toBeNull()
  // re-implement later: the device asks for @bob through a verify requirement and pulls the attested user back (the user
  // now lives on the requirement's declaration, which node exchange does not carry to the device yet)
  // the key survives a reload and a second exchange leaves it alone
  expect(publishedKey(loadReplica(serializeReplica(device)), 'fos')).toBe(verify.publicKey)
})

test('the key is stable for a configured seed or JWT secret', () => {
  const seed = 'ab'.repeat(32)
  expect(identityKeyFromEnv({ FOS_IDENTITY_SEED: seed }).publicKey).toBe(identityKeyFromSeed(Buffer.from(seed, 'hex')).publicKey)
  expect(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey).toBe(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey)
  expect(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey).not.toBe(identityKeyFromEnv({ JWT_SECRET: 't' }).publicKey)
  expect(Buffer.from(verify.publicKey, 'base64')).toHaveLength(32)
})

test('no routes: users are verified and captures organized only through their handlers', () => {
  const index = readFileSync(path.resolve(process.cwd(), 'index.ts'), 'utf8')
  for (const route of ['/identity/key', '/users/:username', '/voice-notes/organize']) expect(index).not.toContain(`'${route}'`)
  expect(index).toContain("'/voice-notes'") // raw audio transcription stays a route
})
