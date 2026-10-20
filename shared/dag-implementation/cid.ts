/**
 * Content ids (cids) carry the data version they were written in: `v<version>-<digest>`, where version is the
 * dotted `FOS_DATA_VERSION` (shared/version.ts), e.g. `v0.0.1-3f9a…`, and the digest is the sha3-256 hex of the
 * node's canonical form (data as key-sorted JSON, edges exactly as written: order and direction are part of a node's
 * identity).
 *
 * Only the current version is read or written. Data in another version is not migrated: loading it fails with
 * `UnsupportedDataVersionError` (reset the data), and a peer pinned to another version is told to update the app
 * (sync/node-sync.ts `validateNodeShape`). See docs/cid-versioning.md.
 */

import type { FosNodeContent } from '../types'
import { FOS_DATA_VERSION } from '../version'

import * as jsSha3 from 'js-sha3'
// js-sha3 is CJS; depending on the runtime's ESM interop the exports may land
// on the namespace itself or on .default (e.g. under tsx ESM).
const sha3_256 = jsSha3.sha3_256 ?? (jsSha3 as unknown as { default: typeof jsSha3 }).default.sha3_256

export { FOS_DATA_VERSION }

/** A data version as written in a cid prefix: dotted numbers (`0.0.1`), or a bare number for the formats before. */
export type CidVersion = string

export type ParsedCid = { version: CidVersion; digest: string }

/** Any versioned cid, whatever its version: `v<n>(.<n>)*-<64 hex>`. */
const VERSIONED = /^v(\d+(?:\.\d+)*)-([0-9a-f]{64})$/
/** Bare hex digests, written before cids carried a version. */
const UNVERSIONED = /^[0-9a-f]{64}$/

const CURRENT_PREFIX = `v${FOS_DATA_VERSION}-`

/** Data written in another version than this build's: not migrated, the data has to be reset. */
export class UnsupportedDataVersionError extends Error {
  constructor(readonly found: string) {
    super(`Unsupported data version (${found}): this app reads data version ${FOS_DATA_VERSION} only. Reset the stored data.`)
    this.name = 'UnsupportedDataVersionError'
  }
}

/** Deeply sort object keys so JSON.stringify is order-independent. */
function normalizeObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(normalizeObject)
  const source = obj as Record<string, unknown>
  return Object.keys(source)
    .sort()
    .reduce((result: Record<string, unknown>, key: string) => {
      result[key] = normalizeObject(source[key])
      return result
    }, {})
}

/** The digest of a node's content: data canonicalized, edges hashed as written. */
function digest(content: FosNodeContent): string {
  return sha3_256(JSON.stringify({
    data: JSON.stringify(normalizeObject(content.data)),
    children: (content.children || []).map(([a, b]) => [a, b])
  }))
}

/** A versioned cid's version and digest, in any version (null when `cid` is not one). */
export function parseCid(cid: string): ParsedCid | null {
  if (typeof cid !== 'string') return null
  const match = VERSIONED.exec(cid)
  return match ? { version: match[1] as string, digest: match[2] as string } : null
}

/** The data version a cid was written in: its prefix, `unversioned` for a bare digest, null when it is not a cid. */
export function cidVersion(cid: string): CidVersion | null {
  if (typeof cid !== 'string') return null
  return parseCid(cid)?.version ?? (UNVERSIONED.test(cid) ? 'unversioned' : null)
}

export function formatCid(digestHex: string, version: CidVersion = FOS_DATA_VERSION): string {
  return `v${version}-${digestHex}`
}

/** Does `value` have the shape of a cid in any version (so a caller can tell an outdated peer from garbage)? */
export function isCid(value: unknown): value is string {
  return typeof value === 'string' && parseCid(value) !== null
}

/** Is `cid` a cid of this build's data version? */
export function isCurrentCid(cid: string): boolean {
  return typeof cid === 'string' && cid.startsWith(CURRENT_PREFIX) && parseCid(cid) !== null
}

/** Throw `UnsupportedDataVersionError` unless `cid` is in the current data version. */
export function assertCurrentCid(cid: string): void {
  if (!isCurrentCid(cid)) throw new UnsupportedDataVersionError(cidVersion(cid) ?? 'not a cid')
}

/** The cid of `content`, in the current data version. */
export function hashContent(content: FosNodeContent): string {
  return CURRENT_PREFIX + digest(content)
}

/** Does `cid` address `content` in the current data version? A cid in another version never verifies. */
export function verifyCid(cid: string, content: FosNodeContent): boolean {
  return isCurrentCid(cid) && hashContent(content) === cid
}

/** Short form for logs: keeps the version prefix and the first hex characters. */
export function shortCid(cid: string, chars = 8): string {
  const parsed = parseCid(cid)
  return parsed ? formatCid(parsed.digest.slice(0, chars), parsed.version) : cid.slice(0, chars)
}
