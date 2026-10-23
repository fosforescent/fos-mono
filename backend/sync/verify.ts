import { standardHostRef } from './host-runtime'
/**
 * The fos server attests users. `@name` in a row is shorthand for a user object (shared/sync/users.ts, the standard
 * library type `lib.user`): account id, username, display name, public key and a verification. Resolving a
 * username to that object is the effect of this server's `verify` handler, reached like every other effect: a
 * `verify` requirement (`requestVerification`, its text `@name`) evaluated through a `complete`
 * event. The handler binds the attested object as the requirement's `user` field, signed with the server's ed25519
 * identity key, and records the supply. There is no route:
 *
 * - the public key is graph data: the handler's `publicKey` is in the runtime's `hostOffers().keys`, which
 *   `ensureHomeContext` writes onto the fos member entry of every account's root as its key row (a user-type row whose username is the entry's peer)
 *   (`publishPeerKey`); member entries travel by node exchange, and the owner's devices take that entry above their
 *   Home (`accountContextAbove`), so their own verify handler checks `verification.attestation` over
 *   `userAttestationPayload` against it (`verifyPublished`; WebCrypto Ed25519 in the app);
 * - the server re-checks the attestation whenever it acts on a user object it reads from a graph (`verify`, used by
 *   the payment and fos-points payees), so a tampered or foreign object is refused there regardless of the client.
 *
 * The key comes from `FOS_IDENTITY_SEED` (32 bytes, hex or base64). Without it, it is derived from `JWT_SECRET`
 * (HKDF, so attestations survive restarts and every instance agrees); with neither, a random key is used for this
 * process only (development). Key pairs held by users are the next step: `publicKey` is part of every attested
 * object (read from the account's profile when it has one) and `ed25519-self` verifications are signed by it.
 */
import { createPrivateKey, createPublicKey, hkdfSync, randomBytes, sign, verify, type KeyObject } from 'node:crypto'
import { USER_SERVER_ATTESTATION, userFieldEdge, content, identityCid, plainEdge, addSupply, bindUserAt, userAttestationPayload, verifyUser, headCid, resolveScope, valueContent, type UserRecord } from '@fosforescent/shared/sync/index'
import type { EffectContext, HostHandler } from './host-runtime'

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
  console.warn('[verify] no FOS_IDENTITY_SEED or JWT_SECRET: user attestations use a key that lasts only this process')
  return identityKeyFromSeed(randomBytes(32))
}

/** An ed25519 check: base64 signature, raw 32-byte public key in base64. */
export function verifyEd25519(payload: string, signature: string, publicKey: string): boolean {
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' })
  return verify(null, Buffer.from(payload), key, Buffer.from(signature, 'base64'))
}

export type VerifyDeps = {
  /** The account named `username`, with its display name and a registered public key when it has them. */
  findUser(username: string): Promise<{ id: number; username: string; name?: string | null; publicKey?: string | null } | null>
  now?(): number
}

export type VerifyHandler = HostHandler & {
  /** This server's public key (raw ed25519, base64), published in each account's Home. */
  publicKey: string
  /** The attested user object for `username`, or null when no account has that name. */
  resolve(username: string): Promise<UserRecord | null>
  attest(user: Omit<UserRecord, 'verification'>): UserRecord
  /** Is this user object attested by this server, unchanged since? */
  verify(user: UserRecord): boolean
}

/** The username a verify requirement asks about: its user field (the user as typed, `requestVerification`). */
function wanted(ctx: EffectContext): string {
  const name = (ctx.step.row?.user?.username ?? '').trim()
  if (!name) throw new Error('Name the user to verify: "@name".')
  return name
}

/** The fos `verify` service: a `verify` requirement is filled with the attested user object and the server's supply. */
export function verifyHandler(deps: VerifyDeps, key: IdentityKey, peer = 'fos'): VerifyHandler {
  const now = () => deps.now?.() ?? Date.now()
  const attest = (user: Omit<UserRecord, 'verification'>): UserRecord => {
    const issuedAt = now(), base = { account: user.account, username: user.username, name: user.name, publicKey: user.publicKey }
    const attestation = sign(null, Buffer.from(userAttestationPayload(base, peer, USER_SERVER_ATTESTATION, issuedAt)), key.privateKey).toString('base64')
    return { ...base, verification: { by: peer, method: USER_SERVER_ATTESTATION, issuedAt, attestation } }
  }
  const resolve = async (username: string): Promise<UserRecord | null> => {
    const found = await deps.findUser(username.trim().replace(/^@/, ''))
    return found ? attest({ account: String(found.id), username: found.username, name: found.name?.trim() || found.username, publicKey: found.publicKey?.trim() ?? '' }) : null
  }
  return {
    peerId: peer, ref: standardHostRef(peer, 'verify'), publicKey: key.publicKey, attest, resolve,
    verify(user) {
      return user.verification?.method === USER_SERVER_ATTESTATION && verifyUser(user, { servers: { [peer]: key.publicKey }, verify: verifyEd25519 }).ok
    },
    async prepare(ctx) {
      // an unknown name fails before the evaluation opens, so nothing is journaled for it
      const name = wanted(ctx)
      if (!await deps.findUser(name)) throw new Error(`No Fos user is named @${name}.`)
      // the handler fills the request's user field (the user as typed becomes the attested object): that field is its output
      const r = ctx.replica(), cid = resolveScope(r.store, headCid(r), ctx.step.path)!
      const field = userFieldEdge(r.store, valueContent(r.store, cid))
      const id = field && content(r.store, identityCid(r.store, plainEdge(r.store, field))).data.alias?.id
      return { outputs: id ? [id] : [] }
    },
    async effect(ctx) {
      const name = wanted(ctx), path = ctx.step.path
      const user = await resolve(name)
      if (!user) throw new Error(`No Fos user is named @${name}.`)
      let next = bindUserAt(ctx.replica(), path, user, ctx.now())
      next = addSupply(next, path.slice(0, -1), path.at(-1)!, { capability: 'verify', by: peer, ref: user.account }, ctx.now())
      await ctx.update(next)
    }
  }
}
