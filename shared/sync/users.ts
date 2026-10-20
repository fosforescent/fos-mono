/**
 * Users as graph data. `@name` in row text is shorthand: it binds the row's `user` field to a user object, a row of
 * the standard library's `lib:type:user` (account id, username, display name, public key, and a verification made
 * by the fos server that attested it). A user object is recognised by its type (the edge's left node, any pinned
 * version) and read through that type's form; nothing here tells types apart by flags or row kinds.
 *
 * Verification is an ed25519 signature over `userAttestationPayload`. Today the fos server signs (`method`
 * `ed25519-server`, `by` = the server's peer id). Resolving `@name` is the effect of the server's `verify` handler:
 * a `verify` requirement (`requestVerification`) evaluated there comes back with the attested object bound as its
 * `user` field. The server's public key is graph data too: a `fos:key:fos` row in Home (`publishPeerKey`, written
 * when the server ensures the account context) that node exchange brings to devices, whose own verify handler
 * (`verifyPublished`) checks attestations against it; the server re-checks on use (payments, fos points).
 * `ed25519-self` is the seam for key pairs: the same payload signed by the key in the object's own `publicKey`. A
 * self signature proves possession of the key only; the binding of that key to an account is the server
 * attestation, which covers `publicKey` too. The crypto is injected (`UserTrust.verify`, `SignatureCheck`) so this
 * module runs in the browser, QuickJS and Node alike.
 *
 * Verified objects are cached in the user's graph (`fos:users` in Home, one user row each); a row typed offline
 * binds an unverified object (username only) that the client replaces once it resolves.
 */
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, identityCid, isLibraryType, libraryTypeAt, put, refNodeContent, resolveScope, valueCidOf, valueContent, type Scope } from './graph'
import { constructForm, formRecord, type FormInput } from './forms'
import { plainEdge } from './patterns'
import { addRow, bindUserAt, deleteTask, headCid, homePath, view, writeGraphNode, type Replica } from './replica'
import { PLAIN_TYPE } from './library-types'
import { ALLOCATION_TYPE } from './library-types'

export const USER_TYPE_ID = 'lib:type:user'
/** The field of a row that names a user (`-@bob`, `@bob 2h`, `-ff 5 reward @bob`). */
export const USER_FIELD = 'user'
/** The Home row caching verified user objects. */
export const USERS_ID = 'fos:users'
export const USER_SERVER_ATTESTATION = 'ed25519-server'
export const USER_SELF_ATTESTATION = 'ed25519-self'

export type UserVerification = { by: string; method: string; issuedAt: number; attestation: string }
export type UserRecord = { account: string; username: string; name: string; publicKey: string; verification: UserVerification | null }

/** Is `typeCid` (a row edge's left node) a version of the user type? */
export function isUserType(store: FosStore, typeCid: string): boolean {
  return isLibraryType(store, typeCid, USER_TYPE_ID)
}

/** The user type a row at `at` sees (nearest library, else the one this build ships). */
export function userType(store: FosStore, at: Scope = [], root?: string): string {
  const type = libraryTypeAt(store, USER_TYPE_ID, at, root)
  if (!type) throw new Error('No standard library here defines users (lib:type:user).')
  return type
}

/** What `@name` binds before the server has vouched for it: the username only. */
export function unverifiedUser(username: string): UserRecord {
  return { account: '', username, name: username, publicKey: '', verification: null }
}

/** A user object's fields, read through its type's form. */
export function readUser(store: FosStore, typeCid: string, node: FosNodeContent): UserRecord | null {
  const r = formRecord(store, typeCid, node) as Record<string, FormInput> | undefined
  if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.username !== 'string' || !r.username) return null
  const v = r.verification as Record<string, FormInput> | undefined
  const verification = v && typeof v === 'object' && !Array.isArray(v) && typeof v.attestation === 'string' && v.attestation
    ? { by: String(v.by ?? ''), method: String(v.method ?? ''), issuedAt: Number(v.issuedAt ?? 0), attestation: v.attestation }
    : null
  return { account: String(r.account ?? ''), username: r.username, name: String(r.name || r.username), publicKey: String(r.publicKey ?? ''), verification }
}

function userInput(user: UserRecord): FormInput {
  return { account: user.account, username: user.username, name: user.name, publicKey: user.publicKey, verification: user.verification ?? { by: '', method: '', issuedAt: 0, attestation: '' } }
}

export const userObjectId = (user: Pick<UserRecord, 'username'>): string => `fos:user:${user.username}`

/**
 * The user object node: the same record makes the same node (and cid) everywhere. Like every form field's value it
 * carries its field name (`user`), which is what node exchange keeps of a field.
 */
export function userObjectContent(store: FosStore, typeCid: string, user: UserRecord, id = userObjectId(user)): FosNodeContent {
  const node = constructForm(store, typeCid, id, userInput(user), user.verification?.issuedAt ?? 0)
  return { ...node, data: { ...node.data, name: { content: USER_FIELD } } }
}

/** The edge of `node` that is its `user` field: the field named `user` whose type is a user type (any version). */
export function userFieldEdge(store: FosStore, node: FosNodeContent): FosPathElem | undefined {
  return node.children.find(edge => {
    const e = plainEdge(store, edge)
    return isUserType(store, e[0]) && valueContent(store, identityCid(store, e)).data.name?.content === USER_FIELD
  })
}

/** The user a row names (its `user` field), or null. */
export function userOf(store: FosStore, node: FosNodeContent): UserRecord | null {
  const edge = userFieldEdge(store, node)
  if (!edge) return null
  const e = plainEdge(store, edge)
  return readUser(store, e[0], valueContent(store, identityCid(store, e)))
}

/** `node` with its `user` field bound to `user` (in place of an earlier one), or without it for null. */
export function withUserField(store: FosStore, node: FosNodeContent, user: UserRecord | null, typeCid: string): FosNodeContent {
  const existing = userFieldEdge(store, node)
  if (!user) return existing ? { ...node, children: node.children.filter(e => e !== existing) } : node
  const value = put(store, userObjectContent(store, typeCid, user))
  if (existing && plainEdge(store, existing)[0] === typeCid && valueCidOf(store, identityCid(store, plainEdge(store, existing))) === value) return node
  const ref = put(store, refNodeContent(store, { alias: { id: `${node.data.alias?.id ?? 'row'}/field/${USER_FIELD}` }, name: { content: USER_FIELD } }, value))
  const edge: FosPathElem = [typeCid, ref]
  return { ...node, children: existing ? node.children.map(e => e === existing ? edge : e) : [...node.children, edge] }
}

export const userPeerId = (user: Pick<UserRecord, 'username'>): string => `user:${user.username}`

/** Two user objects name the same person: by account when both have one, else by username. */
export function sameUser(a: UserRecord, b: UserRecord): boolean {
  if (a.account && b.account) return a.account === b.account
  return a.username.toLowerCase() === b.username.toLowerCase()
}

/** What a verification signs: every field of the object but the signature, with who signed it, how and when. */
export function userAttestationPayload(user: Omit<UserRecord, 'verification'>, by: string, method: string, issuedAt: number): string {
  return JSON.stringify(['fos-user/1', user.account, user.username, user.name, user.publicKey, by, method, issuedAt])
}

/** `verify(payload, signature, publicKey)`: an ed25519 check, base64 signature and raw 32-byte base64 key. */
export type SignatureCheck = (payload: string, signature: string, publicKey: string) => boolean
/** The servers a client trusts to attest users (peer id → their public key) and the signature check to use. */
export type UserTrust = { servers: Record<string, string>; verify: SignatureCheck }

export function verifyUser(user: UserRecord, trust: UserTrust): { ok: true; by: string } | { ok: false; reason: string } {
  const v = user.verification
  if (!v) return { ok: false, reason: `@${user.username} is not verified yet` }
  const key = v.method === USER_SERVER_ATTESTATION ? trust.servers[v.by] : v.method === USER_SELF_ATTESTATION ? user.publicKey : undefined
  if (!key) return { ok: false, reason: v.method === USER_SERVER_ATTESTATION ? `${v.by} is not a trusted verifier` : v.method === USER_SELF_ATTESTATION ? `@${user.username} has no public key` : `unknown verification method ${v.method}` }
  let valid = false
  try { valid = trust.verify(userAttestationPayload(user, v.by, v.method, v.issuedAt), v.attestation, key) } catch { valid = false }
  return valid ? { ok: true, by: v.by } : { ok: false, reason: `the verification of @${user.username} does not match` }
}

// ---------------------------------------------------------------------------
// The replica's cache of verified user objects

export function usersPath(r: Replica): Scope {
  return [...homePath(r), USERS_ID]
}

/** The cached verified user object for `username`, if this graph has one. */
export function cachedUser(r: Replica, username: string): UserRecord | null {
  const cid = resolveScope(r.store, headCid(r), usersPath(r))
  if (!cid) return null
  const wanted = username.toLowerCase()
  for (const edge of valueContent(r.store, cid).children) {
    const e = plainEdge(r.store, edge)
    // a peer's published key (`fos:key:…`) sits among the people but is no one `@name` binds
    if (!isUserType(r.store, e[0]) || content(r.store, identityCid(r.store, e)).data.alias?.id?.startsWith(PEER_KEY_PREFIX)) continue
    const user = readUser(r.store, e[0], valueContent(r.store, identityCid(r.store, e)))
    if (user?.username.toLowerCase() === wanted) return user
  }
  return null
}

/** Keep a verified user object in the graph (replacing an older one for the same username). */
export function cacheUser(r: Replica, user: UserRecord, now: number): Replica {
  if (!user.verification) return r
  const path = usersPath(r)
  if (!resolveScope(r.store, headCid(r), path)) r = addRow(r, path.slice(0, -1), PLAIN_TYPE, 'People', now, { id: USERS_ID })
  const existing = cachedUser(r, user.username)
  if (existing && JSON.stringify(existing) === JSON.stringify(user)) return r
  if (existing) r = deleteTask(r, path, userObjectId(existing), now)
  const type = userType(r.store, path)
  return writeGraphNode(r, path, userObjectContent(r.store, type, user), now, type)
}

/** The user a typed `@name` should bind: the cached verified object when there is one, else what was typed. */
export function knownUser(r: Replica, user: UserRecord): UserRecord {
  return user.verification ? user : cachedUser(r, user.username) ?? user
}

/** Replace the unverified objects bound for `user.username` anywhere in the tree with the verified `user`. */
export function rebindUsers(r: Replica, user: UserRecord, now: number): Replica {
  const paths: Scope[] = []
  const walk = (at: Scope, depth: number) => {
    if (depth > 64) return
    for (const row of view(r, at)?.tasks ?? []) {
      const path = [...at, row.id]
      if (row.user && !row.user.verification && row.user.username.toLowerCase() === user.username.toLowerCase() && path.join('/') !== usersPath(r).join('/')) paths.push(path)
      if (row.childCount) walk(path, depth + 1)
    }
  }
  walk([], 0)
  for (const path of paths) r = bindUserAt(r, path, user, now)
  return r
}

// ---------------------------------------------------------------------------
// Verifiers' keys as graph data

/** The row holding the key a peer (the fos server: `fos`) publishes, among the people in Home: `fos:key:<peer id>`. */
export const PEER_KEY_PREFIX = 'fos:key:'
export const peerKeyId = (peerId: string): string => `${PEER_KEY_PREFIX}${peerId}`

/**
 * Publish `peerId`'s public key in Home's users row (`fos:users`): a row of the user type for that peer (account and
 * username = its peer id, `publicKey` = its raw ed25519 key, base64). The account server writes it whenever it
 * ensures the account context (`ensureHomeContext(…, { keys })`), so node exchange brings it to every device with
 * Home. No-op when unchanged.
 */
export function publishPeerKey(r: Replica, peerId: string, publicKey: string, now: number): Replica {
  if (!homePath(r).length || publishedKey(r, peerId) === publicKey) return r
  const users = usersPath(r), id = peerKeyId(peerId)
  if (!resolveScope(r.store, headCid(r), users)) r = addRow(r, users.slice(0, -1), PLAIN_TYPE, 'People', now, { id: USERS_ID })
  if (resolveScope(r.store, headCid(r), [...users, id])) r = deleteTask(r, users, id, now)
  const type = userType(r.store, users)
  const peer: UserRecord = { account: peerId, username: peerId, name: peerId === 'fos' ? 'Fos' : peerId, publicKey, verification: null }
  return writeGraphNode(r, users, userObjectContent(r.store, type, peer, id), now, type)
}

/** Every verifier key published in this graph's Home (peer id → key): the trust a device's verify handler uses. */
export function publishedKeys(r: Replica): Record<string, string> {
  const parent = homePath(r).length ? resolveScope(r.store, headCid(r), usersPath(r)) : null
  const out: Record<string, string> = {}
  // a key row is a row of the user type (the edge's left node) with a `fos:key:` identity; nothing else is read
  for (const edge of parent ? valueContent(r.store, parent).children : []) {
    const plain = plainEdge(r.store, edge)
    if (!isUserType(r.store, plain[0])) continue
    const id = content(r.store, identityCid(r.store, plain)).data.alias?.id ?? ''
    if (!id.startsWith(PEER_KEY_PREFIX)) continue
    const peerId = id.slice(PEER_KEY_PREFIX.length), peer = readUser(r.store, plain[0], valueContent(r.store, identityCid(r.store, plain)))
    if (peer?.username === peerId && peer.publicKey) out[peerId] = peer.publicKey
  }
  return out
}

/** The key `peerId` published in this graph's Home, or null. */
export function publishedKey(r: Replica, peerId: string): string | null {
  return publishedKeys(r)[peerId] ?? null
}

/**
 * The device's verify handler for user objects a server attested: the attestation's `by` must be a peer whose key
 * this graph publishes (`fos` for the account server), and the signature must check against that key. The crypto
 * is injected as in `verifyUser` (WebCrypto in the app, node:crypto in tests).
 */
export function verifyPublished(r: Replica, user: UserRecord, check: SignatureCheck): ReturnType<typeof verifyUser> {
  if (user.verification?.method !== USER_SERVER_ATTESTATION) return { ok: false, reason: user.verification ? `@${user.username} is not attested by a server` : `@${user.username} is not verified yet` }
  if (!publishedKey(r, user.verification.by)) return { ok: false, reason: `${user.verification.by} has published no key here` }
  return verifyUser(user, { servers: publishedKeys(r), verify: check })
}

// ---------------------------------------------------------------------------
// Verify requirements: how `@name` becomes an attested user object

/** The verify requirement for `username`, kept in the users row (`fos:users`) while the verifier fills it. */
export const verifyRequestId = (username: string): string => `fos:verify:${username.toLowerCase()}`

/**
 * Ask for `@username` to be verified: a `verify` requirement under `fos:users` whose text names the user. Evaluated
 * by the account server (its `verify` handler), it comes back with the attested object bound as its `user` field and
 * the verifier's supply. Answers the requirement's path.
 */
export function requestVerification(r: Replica, username: string, now: number): { replica: Replica; path: Scope } {
  const path = usersPath(r), name = username.trim().replace(/^@/, '')
  if (!resolveScope(r.store, headCid(r), path)) r = addRow(r, path.slice(0, -1), PLAIN_TYPE, 'People', now, { id: USERS_ID })
  const id = verifyRequestId(name)
  if (resolveScope(r.store, headCid(r), [...path, id])) r = deleteTask(r, path, id, now)
  r = addRow(r, path, ALLOCATION_TYPE, `@${name}`, now, { id, requirement: { capability: 'verify' } })
  return { replica: r, path: [...path, id] }
}

/** The attested user object a filled verify requirement at `path` holds (its `user` field), or null. */
export function verifiedAt(r: Replica, path: Scope): UserRecord | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const user = cid ? userOf(r.store, valueContent(r.store, cid)) : null
  return user?.verification ? user : null
}
