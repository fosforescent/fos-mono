/**
 * The fos server attests users. `@name` in a row is shorthand for a user object (shared/sync/users.ts, the standard
 * library type `lib:type:user`): account id, username, display name, public key and a verification. This handler
 * resolves a username to that object and signs it with the server's ed25519 identity key, so the object can travel
 * through anyone's graph and still be checked:
 *
 * - clients fetch the key once from `GET /identity/key` (`{ peer: 'fos', alg: 'ed25519', publicKey }`, the raw
 *   32-byte key in base64) and check `verification.attestation` over `userAttestationPayload` (web/src/api.ts
 *   `checkUserAttestation`, WebCrypto Ed25519);
 * - the server re-checks the attestation whenever it acts on a user object it reads from a graph (`verify`, used by
 *   the payment and fos-points payees), so a tampered or foreign object is refused there regardless of the client.
 *
 * The key comes from `FOS_IDENTITY_SEED` (32 bytes, hex or base64). Without it, it is derived from `JWT_SECRET`
 * (HKDF, so attestations survive restarts and every instance agrees); with neither, a random key is used for this
 * process only (development). Key pairs held by users are the next step: `publicKey` is part of every attested
 * object (read from the account's profile when it has one) and `ed25519-self` verifications are signed by it.
 */
import { createPrivateKey, createPublicKey, hkdfSync, randomBytes, sign, verify, type KeyObject } from 'node:crypto'
import type { Request, Response } from 'express'
import { USER_SERVER_ATTESTATION, userAttestationPayload, verifyUser, type UserRecord } from '@fosforescent/shared/sync/index'
import type { HostHandler } from './registry'

export type IdentityKey = { privateKey: KeyObject; publicKey: string }

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex')
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex')

/** The ed25519 key pair a 32-byte seed makes; the public key as raw bytes in base64. */
export function identityKeyFromSeed(seed: Buffer): IdentityKey {
  if (seed.length !== 32) throw new Error('An identity seed is 32 bytes.')
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: 'der', type: 'pkcs8' })
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer
  return { privateKey, publicKey: spki.subarray(spki.length - 32).toString('base64') }
}

export function identityKeyFromEnv(env: NodeJS.ProcessEnv = process.env): IdentityKey {
  const seed = env.FOS_IDENTITY_SEED?.trim()
  if (seed) return identityKeyFromSeed(/^[0-9a-f]{64}$/i.test(seed) ? Buffer.from(seed, 'hex') : Buffer.from(seed, 'base64'))
  if (env.JWT_SECRET) return identityKeyFromSeed(Buffer.from(hkdfSync('sha256', env.JWT_SECRET, 'fos', 'fos identity key v1', 32)))
  console.warn('[identity] no FOS_IDENTITY_SEED or JWT_SECRET: user attestations use a key that lasts only this process')
  return identityKeyFromSeed(randomBytes(32))
}

/** An ed25519 check: base64 signature, raw 32-byte public key in base64. */
export function verifyEd25519(payload: string, signature: string, publicKey: string): boolean {
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' })
  return verify(null, Buffer.from(payload), key, Buffer.from(signature, 'base64'))
}

export type IdentityDeps = {
  /** The account named `username`, with its display name and a registered public key when it has them. */
  findUser(username: string): Promise<{ id: number; username: string; name?: string | null; publicKey?: string | null } | null>
  now?(): number
}

export type IdentityHandler = HostHandler & {
  /** The peer id attestations name as their verifier. */
  peer: string
  /** This server's public key (raw ed25519, base64). */
  publicKey: string
  /** The attested user object for `username`, or null when no account has that name. */
  resolve(username: string): Promise<UserRecord | null>
  attest(user: Omit<UserRecord, 'verification'>): UserRecord
  /** Is this user object attested by this server, unchanged since? */
  verify(user: UserRecord): boolean
}

/** The fos `identity` service: resolve and attest users (a route, `createIdentityRoutes`; no evaluation effect). */
export function identityHandler(deps: IdentityDeps, key: IdentityKey, peer = 'fos'): IdentityHandler {
  const now = () => deps.now?.() ?? Date.now()
  const attest = (user: Omit<UserRecord, 'verification'>): UserRecord => {
    const issuedAt = now(), base = { account: user.account, username: user.username, name: user.name, publicKey: user.publicKey }
    const attestation = sign(null, Buffer.from(userAttestationPayload(base, peer, USER_SERVER_ATTESTATION, issuedAt)), key.privateKey).toString('base64')
    return { ...base, verification: { by: peer, method: USER_SERVER_ATTESTATION, issuedAt, attestation } }
  }
  return {
    peerId: peer, capability: 'identity', peer, publicKey: key.publicKey, attest,
    async resolve(username) {
      const found = await deps.findUser(username.trim().replace(/^@/, ''))
      return found ? attest({ account: String(found.id), username: found.username, name: found.name?.trim() || found.username, publicKey: found.publicKey?.trim() ?? '' }) : null
    },
    verify(user) {
      return user.verification?.method === USER_SERVER_ATTESTATION && verifyUser(user, { servers: { [peer]: key.publicKey }, verify: verifyEd25519 }).ok
    }
  }
}

function username(req: Request): string | null {
  const claims = (req as Request & { claims?: { username?: string; kind?: string } }).claims
  return claims?.username && claims.kind !== 'peer' ? claims.username : null
}

/** `GET /identity/key` (public) and `GET /user/data/users/:username` (a signed-in account): the attested user object. */
export function createIdentityRoutes(identity: IdentityHandler) {
  return {
    key(_req: Request, res: Response): Response {
      return res.json({ peer: identity.peer, alg: 'ed25519', publicKey: identity.publicKey })
    },
    async user(req: Request, res: Response): Promise<Response> {
      if (!username(req)) return res.status(401).json({ error: 'Sign in to look up users.' })
      const name = String(req.params.username ?? '').trim()
      if (!name) return res.status(400).json({ error: 'Name a user.' })
      const user = await identity.resolve(name)
      return user ? res.json({ user }) : res.status(404).json({ error: `No Fos user is named @${name}.` })
    }
  }
}
