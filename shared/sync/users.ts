/**
 * Users as graph data. `@name` in row text is shorthand: it binds the row's `user` field to a user object, a row of
 * the standard library's `lib.user` (account id, username, display name, public key, and a verification made
 * by the fos server that attested it). A user object is recognised by its type (the edge's left node, any pinned
 * version) and read through that type's form; nothing here tells types apart by flags or row kinds.
 *
 * Verification is an ed25519 signature over `userAttestationPayload`. Today the fos server signs (`method`
 * `ed25519-server`, `by` = the server's peer id). Resolving `@name` is the effect of the server's `verify` handler:
 * a `verify` requirement (`requestVerification`) evaluated there comes back with the attested object bound as its
 * `user` field. The server's public key is graph data too: a key row (a user-type row whose username is the entry's peer) on the fos member entry of the store
 * root (`publishPeerKey`, written when the server ensures the account context) that node exchange brings to the
 * owner's devices with that entry, whose own verify handler (`verifyPublished`) checks attestations against it; the
 * server re-checks on use (payments, fos points).
 * `ed25519-self` is the seam for key pairs: the same payload signed by the key in the object's own `publicKey`. A
 * self signature proves possession of the key only; the binding of that key to an account is the server
 * attestation, which covers `publicKey` too. The crypto is injected (`UserTrust.verify`, `SignatureCheck`) so this
 * module runs in the browser, QuickJS and Node alike.
 *
 * Verified objects are cached in the user's graph (the People row in Home, one user row each); a row typed offline
 * binds an unverified object (username only) that the client replaces once it resolves.
 */
import { hashContent } from '../dag-implementation/cid'
import type { FosStore } from '../dag-implementation/store'
import type { FosNodeContent, FosPathElem } from '../types'
import { content, identityCid, isLibraryType, isRowEdge, newId, libraryTypeAt, memberEdgesOf, memberPeerOf, membershipPath, put, refNodeContent, resolveScope, valueCidOf, valueContent, type Scope } from './graph'
import { constructRow, fieldValues, rowRecord } from './fields'
import { addRow, bindUserAt, deleteTask, headCid, homePath, view, writeGraphNode, type Replica } from './replica'
import { PLAIN_TYPE } from './library-types'
import { addRequirement } from './arguments'

export const USER_TYPE_ID = 'user'
/** The field of a row that names a user (`-@bob`, `@bob 2h`, `-ff 5 reward @bob`). */
export const USER_FIELD = 'user'
/** The library row type of the row in Home keeping the people this account verified (their user objects). */
export const PEOPLE_TYPE = 'people'
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
  if (!type) throw new Error('No standard library here defines users (lib.user).')
  return type
}

/** What `@name` binds before the server has vouched for it: the username only. */
export function unverifiedUser(username: string): UserRecord {
  return { account: '', username, name: username, publicKey: '', verification: null }
}

/** A user object's fields, read through its type's fields. */
export function readUser(store: FosStore, typeCid: string, node: FosNodeContent): UserRecord | null {
  const r = rowRecord(store, typeCid, node)
  if (typeof r.username !== 'string' || !r.username) return null
  const verification = typeof r.attestation === 'string' && r.attestation
    ? { by: String(r.verifiedBy ?? ''), method: String(r.verifyMethod ?? ''), issuedAt: Number(r.issuedAt ?? 0), attestation: r.attestation }
    : null
  return { account: String(r.account ?? ''), username: r.username, name: String(r.displayName || r.username), publicKey: String(r.publicKey ?? ''), verification }
}

function userInput(user: UserRecord): Record<string, string | number> {
  const v = user.verification
  return { account: user.account, username: user.username, displayName: user.name, publicKey: user.publicKey, ...(v ? { verifiedBy: v.by, verifyMethod: v.method, issuedAt: v.issuedAt, attestation: v.attestation } : {}) }
}

/** A user object's identity: the content address of the username, so devices that keep the same person make the same row. */
export const userObjectId = (user: Pick<UserRecord, 'username'>): string => hashContent({ data: { name: { content: user.username.toLowerCase() } }, children: [] })

/**
 * The user object node: the same record makes the same node (and cid) everywhere. Like every form field's value it
 * carries its field name (`user`), which is what node exchange keeps of a field.
 */
export function userObjectContent(store: FosStore, typeCid: string, user: UserRecord, id = userObjectId(user)): FosNodeContent {
  const node = constructRow(store, typeCid, id, fieldValues(store, typeCid, userInput(user)), user.verification?.issuedAt ?? 0)
  return { ...node, data: { ...node.data, name: { content: USER_FIELD } } }
}

/** The edge of `node` that is its `user` field: the field named `user` whose type is a user type (any version). */
export function userFieldEdge(store: FosStore, node: FosNodeContent): FosPathElem | undefined {
  return node.children.find(edge => {
    const e = edge
    return isUserType(store, e[0]) && valueContent(store, identityCid(store, e)).data.name?.content === USER_FIELD
  })
}

/** The user a row names (its `user` field), or null. */
export function userOf(store: FosStore, node: FosNodeContent): UserRecord | null {
  const edge = userFieldEdge(store, node)
  if (!edge) return null
  const e = edge
  return readUser(store, e[0], valueContent(store, identityCid(store, e)))
}

/** `node` with its `user` field bound to `user` (in place of an earlier one), or without it for null. */
export function withUserField(store: FosStore, node: FosNodeContent, user: UserRecord | null, typeCid: string): FosNodeContent {
  const existing = userFieldEdge(store, node)
  if (!user) return existing ? { ...node, children: node.children.filter(e => e !== existing) } : node
  const value = put(store, userObjectContent(store, typeCid, user))
  if (existing && existing[0] === typeCid && valueCidOf(store, identityCid(store, existing)) === value) return node
  // a replaced field keeps its identity; a new one is the row's user field
  const id = (existing && content(store, identityCid(store, existing)).data.alias?.id) || `${node.data.alias?.id ?? 'row'}/field/${USER_FIELD}`
  const ref = put(store, refNodeContent(store, { alias: { id }, name: { content: USER_FIELD } }, value))
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

/** The People row in Home (the row of the People type), if there is one. */
export function usersPath(r: Replica): Scope | null {
  const home = homePath(r), cid = resolveScope(r.store, headCid(r), home)
  const row = cid ? valueContent(r.store, cid).children.map(edge => edge).find(edge => isLibraryType(r.store, edge[0], PEOPLE_TYPE)) : undefined
  const id = row ? content(r.store, identityCid(r.store, row)).data.alias?.id : undefined
  return id ? [...home, id] : null
}
/** The People row, made when Home has none. */
function ensureUsersPath(r: Replica, now: number): { replica: Replica; path: Scope } {
  const found = usersPath(r)
  if (found) return { replica: r, path: found }
  const id = newId(), home = homePath(r)
  return { replica: addRow(r, home, PEOPLE_TYPE, 'People', now, { id }), path: [...home, id] }
}
/** The row of the cached user object for `username` in People, if there is one. */
function cachedUserRow(r: Replica, username: string): { id: string; user: UserRecord } | null {
  const path = usersPath(r), cid = path && resolveScope(r.store, headCid(r), path)
  if (!cid) return null
  const wanted = username.toLowerCase()
  for (const edge of valueContent(r.store, cid).children) {
    const e = edge
    if (!isUserType(r.store, e[0])) continue
    const node = valueContent(r.store, identityCid(r.store, e)), user = readUser(r.store, e[0], node)
    const id = content(r.store, identityCid(r.store, e)).data.alias?.id
    if (user?.username.toLowerCase() === wanted && id) return { id, user }
  }
  return null
}

/** The cached verified user object for `username`, if this graph has one. */
export function cachedUser(r: Replica, username: string): UserRecord | null {
  return cachedUserRow(r, username)?.user ?? null
}

/** Keep a verified user object in the graph (replacing an older one for the same username). */
export function cacheUser(r: Replica, user: UserRecord, now: number): Replica {
  if (!user.verification) return r
  const people = ensureUsersPath(r, now), path = people.path
  r = people.replica
  const existing = cachedUserRow(r, user.username)
  if (existing && JSON.stringify(existing.user) === JSON.stringify(user)) return r
  if (existing) r = deleteTask(r, path, existing.id, now)
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
      if (row.user && !row.user.verification && row.user.username.toLowerCase() === user.username.toLowerCase() && path.join('/') !== usersPath(r)?.join('/')) paths.push(path)
      if (row.childCount) walk(path, depth + 1)
    }
  }
  walk([], 0)
  for (const path of paths) r = bindUserAt(r, path, user, now)
  return r
}

// ---------------------------------------------------------------------------
// Verifiers' keys as graph data

/** The row holding the key a peer (the fos server: `fos`) publishes on its member entry: a user object for that peer. */
export const peerKeyId = (peerId: string): string => userObjectId({ username: peerId })
/** The key row on the member entry at `entry` (the user object whose username is the entry's own peer), if there is one. */
function keyRowAt(r: Replica, entry: Scope, peerId: string): string | null {
  const cid = resolveScope(r.store, headCid(r), entry)
  for (const edge of cid ? content(r.store, cid).children : []) {
    const plain = edge
    if (!isRowEdge(r.store, plain) || !isUserType(r.store, plain[0])) continue
    const user = readUser(r.store, plain[0], valueContent(r.store, identityCid(r.store, plain)))
    if (user?.username === peerId) return content(r.store, identityCid(r.store, plain)).data.alias?.id ?? null
  }
  return null
}

/**
 * Publish `peerId`'s public key on its membership on the store root (`membershipPath(…, [], peerId)`): a row of the user type
 * for that peer (account and username = its peer id, `publicKey` = its raw ed25519 key, base64). The account server
 * writes it whenever it ensures the account context (`ensureHomeContext(…, { keys })`); member entries travel by node
 * exchange, and an owner's device takes the server's entry above its Home (`accountContextAbove`). No-op when
 * unchanged or when `peerId` is no member of the root. A key an older server left in Home (the People row) is removed.
 */
export function publishPeerKey(r: Replica, peerId: string, publicKey: string, now: number): Replica {
  const id = peerKeyId(peerId), entry = membershipPath(r.store, headCid(r), [], peerId)
  if (!entry || publishedKey(r, peerId) === publicKey) return r
  const existing = keyRowAt(r, entry, peerId)
  if (existing) r = deleteTask(r, entry, existing, now)
  const type = userType(r.store, entry)
  const peer: UserRecord = { account: peerId, username: peerId, name: peerId === 'fos' ? 'Fos' : peerId, publicKey, verification: null }
  return writeGraphNode(r, entry, userObjectContent(r.store, type, peer, id), now, type)
}

/** Every verifier key the members of this graph's root publish on their entries (peer id → key): the trust a device's verify handler uses. */
export function publishedKeys(r: Replica): Record<string, string> {
  const out: Record<string, string> = {}
  for (const member of memberEdgesOf(r.store, headCid(r))) {
    const peerId = memberPeerOf(r.store, member)
    // a key row is a row of the user type (the edge's left node) whose user is the entry's own peer; nothing else is read
    for (const edge of content(r.store, member[1]).children) {
      const plain = edge
      if (!isUserType(r.store, plain[0])) continue
      const peer = readUser(r.store, plain[0], valueContent(r.store, identityCid(r.store, plain)))
      if (peer?.username === peerId && peer.publicKey) out[peerId] = peer.publicKey
    }
  }
  return out
}

/** The key `peerId` published on its member entry on this graph's root, or null. */
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

/** The verify requirement asking about `username` in People, if one is open. */
export function verifyRequestAt(r: Replica, username: string): Scope | null {
  const path = usersPath(r), wanted = username.trim().replace(/^@/, '').toLowerCase()
  const row = path ? (view(r, path)?.tasks ?? []).find(t => t.requirement?.capability === 'verify' && t.user?.username.toLowerCase() === wanted) : undefined
  return path && row ? [...path, row.id] : null
}

/**
 * Ask for `@username` to be verified: a `verify` requirement in People whose `user` field is the user as typed (its
 * username). Evaluated by the account server (its `verify` handler), it comes back with the attested object bound as
 * its `user` field and the verifier's supply. Answers the requirement's path.
 */
export function requestVerification(r: Replica, username: string, now: number): { replica: Replica; path: Scope } {
  const name = username.trim().replace(/^@/, '')
  const people = ensureUsersPath(r, now), path = people.path
  r = people.replica
  const open = verifyRequestAt(r, name)
  if (open) r = deleteTask(r, path, open.at(-1)!, now)
  const id = newId()
  r = addRequirement(r, path, `@${name}`, now, { capability: 'verify' }, id)
  r = bindUserAt(r, [...path, id], unverifiedUser(name), now)
  return { replica: r, path: [...path, id] }
}

/** The attested user object a filled verify requirement at `path` holds (its `user` field), or null. */
export function verifiedAt(r: Replica, path: Scope): UserRecord | null {
  const cid = resolveScope(r.store, headCid(r), path)
  const user = cid ? userOf(r.store, valueContent(r.store, cid)) ?? userOf(r.store, content(r.store, cid)) : null
  return user?.verification ? user : null
}
