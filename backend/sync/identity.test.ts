import type { Request, Response } from 'express'
import { verifyUser } from '@fosforescent/shared/sync/index'
import { createIdentityRoutes, identityHandler, identityKeyFromEnv, identityKeyFromSeed, verifyEd25519 } from './identity'
import { createHandlerRegistry } from './registry'

const accounts: Record<string, { id: number; username: string; name?: string | null; publicKey?: string | null }> = { bob: { id: 42, username: 'bob', name: 'Bob Builder' }, ada: { id: 7, username: 'ada', publicKey: 'cHVibGljLWtleQ==' } }
const identity = identityHandler({ findUser: async username => accounts[username] ?? null, now: () => 1234 }, identityKeyFromSeed(Buffer.alloc(32, 5)))

function call(handler: (req: Request, res: Response) => unknown, req: Partial<Request> & { claims?: unknown }) {
  let status = 200, body: any
  const res = { status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
  return Promise.resolve(handler(req as Request, res)).then(() => ({ status, body }))
}

test('a username resolves to the attested user object: account id, username, display name, key, verification', async () => {
  const bob = (await identity.resolve('@bob'))!
  expect(bob).toEqual({ account: '42', username: 'bob', name: 'Bob Builder', publicKey: '', verification: { by: 'fos', method: 'ed25519-server', issuedAt: 1234, attestation: expect.any(String) } })
  expect((await identity.resolve('ada'))!).toMatchObject({ name: 'ada', publicKey: 'cHVibGljLWtleQ==' })
  expect(await identity.resolve('nobody')).toBeNull()
  // any client checks it with the published key; the server checks it on use
  expect(verifyUser(bob, { servers: { fos: identity.publicKey }, verify: verifyEd25519 })).toEqual({ ok: true, by: 'fos' })
  expect(identity.verify(bob)).toBe(true)
})

test('tampered, unverified and foreign objects are rejected', async () => {
  const bob = (await identity.resolve('bob'))!
  expect(identity.verify({ ...bob, username: 'mallory' })).toBe(false)
  expect(identity.verify({ ...bob, account: '1' })).toBe(false)
  expect(identity.verify({ ...bob, publicKey: 'c29tZW9uZSBlbHNl' })).toBe(false)
  expect(identity.verify({ ...bob, verification: { ...bob.verification!, attestation: Buffer.alloc(64).toString('base64') } })).toBe(false)
  expect(identity.verify({ ...bob, verification: null })).toBe(false)
  const other = identityHandler({ findUser: async username => accounts[username] ?? null }, identityKeyFromSeed(Buffer.alloc(32, 6)))
  expect(identity.verify((await other.resolve('bob'))!)).toBe(false)
  // a self signature is the key-pair seam, not something the server pays on
  expect(identity.verify({ ...bob, verification: { ...bob.verification!, method: 'ed25519-self' } })).toBe(false)
})

test('the routes: a public key endpoint, and lookups for signed-in accounts only', async () => {
  const routes = createIdentityRoutes(identity)
  expect((await call(routes.key, {})).body).toEqual({ peer: 'fos', alg: 'ed25519', publicKey: identity.publicKey })
  expect(Buffer.from(identity.publicKey, 'base64')).toHaveLength(32)
  expect((await call(routes.user, { params: { username: 'bob' } as any })).status).toBe(401)
  expect((await call(routes.user, { params: { username: 'bob' } as any, claims: { username: 'ada', kind: 'peer' } })).status).toBe(401)
  const found = await call(routes.user, { params: { username: 'bob' } as any, claims: { username: 'ada' } })
  expect(found.status).toBe(200)
  expect(identity.verify(found.body.user)).toBe(true)
  expect((await call(routes.user, { params: { username: 'nobody' } as any, claims: { username: 'ada' } })).status).toBe(404)
})

test('the key is stable for a configured seed or JWT secret, and the service is advertised, not executed', () => {
  const seed = 'ab'.repeat(32)
  expect(identityKeyFromEnv({ FOS_IDENTITY_SEED: seed }).publicKey).toBe(identityKeyFromSeed(Buffer.from(seed, 'hex')).publicKey)
  expect(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey).toBe(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey)
  expect(identityKeyFromEnv({ JWT_SECRET: 's' }).publicKey).not.toBe(identityKeyFromEnv({ JWT_SECRET: 't' }).publicKey)
  const registry = createHandlerRegistry([identity])
  expect(registry.serverCapabilities()).toContain('identity')
  expect(registry.executors({ path: ['x'], row: null }, null as never)).toEqual([])
})
