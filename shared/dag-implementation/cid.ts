/**
 * Content ids (cids) with a format version.
 *
 * A cid is `v<N>-<digest>`, where N selects the digest algorithm and canonical
 * form in `CID_FORMATS`. Version 0 is the legacy bare hex digest written before
 * versions existed; it is recognised on read but never produced.
 *
 * When hashing, canonicalization or node schemas change, add a new entry to
 * `CID_FORMATS`, bump `CURRENT_CID_VERSION`, and append a step to
 * `MIGRATIONS` in migrations.ts (like a database migration). Stores migrate
 * legacy graphs on load, so old objects are upgraded in order rather than
 * silently colliding with new ones.
 */

import type { FosNodeContent, FosPathElem } from '../types'

import * as jsSha3 from 'js-sha3'
// js-sha3 is CJS; depending on the runtime's ESM interop the exports may land
// on the namespace itself or on .default (e.g. under tsx ESM).
const sha3_256 = jsSha3.sha3_256 ?? (jsSha3 as unknown as { default: typeof jsSha3 }).default.sha3_256

export type CidVersion = number

export type ParsedCid = { version: CidVersion; digest: string }

export type CidFormat = {
  version: CidVersion
  description: string
  /** Digest of a node's content. Child cids inside `children` are hashed as written. */
  digest(content: FosNodeContent): string
}

const PREFIXED = /^v(\d+)-([0-9a-f]+)$/
const LEGACY = /^[0-9a-f]{64}$/

// --- canonical forms -------------------------------------------------------

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

/**
 * Legacy edge ordering: each edge's two cids are sorted, then the edges are
 * sorted. (Yes, this makes [a, b] and [b, a] hash the same; kept as-is for
 * v0/v1 compatibility. Changing it is a job for a later format version.)
 */
function sortEdgesUndirected(edges: FosPathElem[]): FosPathElem[] {
  return edges
    .map((edge) => [...edge].sort() as FosPathElem)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
}

function sha3Digest(content: FosNodeContent): string {
  const normalized = {
    data: JSON.stringify(normalizeObject(content.data)),
    children: sortEdgesUndirected(content.children || [])
  }
  return sha3_256(JSON.stringify(normalized))
}

/**
 * v2: edges are hashed exactly as written, so their order and direction are
 * part of a node's identity. Needed for user-controlled ordering (drag and
 * drop) to replicate, and for [a, b] to differ from [b, a].
 */
function sha3OrderedDigest(content: FosNodeContent): string {
  const normalized = {
    v: 2,
    data: JSON.stringify(normalizeObject(content.data)),
    children: (content.children || []).map(([a, b]) => [a, b])
  }
  return sha3_256(JSON.stringify(normalized))
}

// --- registry ----------------------------------------------------------------

export const CID_FORMATS: Record<CidVersion, CidFormat> = {
  0: {
    version: 0,
    description: 'Legacy: bare sha3-256 hex of {data: canonical JSON, children: sorted edges}; no version prefix.',
    digest: sha3Digest
  },
  1: {
    version: 1,
    description: 'Same digest as v0, written as "v1-<hex>" so the format can be told apart and migrated.',
    digest: sha3Digest
  },
  2: {
    version: 2,
    description: 'Edges hashed in order and direction (child order is part of identity).',
    digest: sha3OrderedDigest
  },
  3: {
    version: 3,
    description: 'Same digest as v2. Schema: every row is the edge [template, rowNode] (see migrations.ts).',
    digest: sha3OrderedDigest
  },
  4: {
    version: 4,
    description: 'Same digest as v2. Schema: types carry pattern edges (what rows they accept), Home and store roots are types (see migrations.ts).',
    digest: sha3OrderedDigest
  },
  5: {
    version: 5,
    description: 'Same digest as v2. Schema: a row type is told apart by its graph identity (lib:type:… alias) alone, with no instanceKind or builtin behavior (see migrations.ts).',
    digest: sha3OrderedDigest
  }
}

export const CURRENT_CID_VERSION: CidVersion = 5

// --- parsing / formatting ----------------------------------------------------

export function parseCid(cid: string): ParsedCid | null {
  if (typeof cid !== 'string') return null
  const prefixed = PREFIXED.exec(cid)
  if (prefixed) {
    const version = Number(prefixed[1])
    return version in CID_FORMATS ? { version, digest: prefixed[2] as string } : null
  }
  if (LEGACY.test(cid)) return { version: 0, digest: cid }
  return null
}

export function cidVersion(cid: string): CidVersion | null {
  return parseCid(cid)?.version ?? null
}

export function formatCid(version: CidVersion, digest: string): string {
  if (!(version in CID_FORMATS)) throw new Error(`unknown cid version ${version}`)
  return version === 0 ? digest : `v${version}-${digest}`
}

export function isCid(value: unknown): value is string {
  return typeof value === 'string' && parseCid(value) !== null
}

export function isCurrentCid(cid: string): boolean {
  return cidVersion(cid) === CURRENT_CID_VERSION
}

// --- hashing -----------------------------------------------------------------

export function hashContentAt(content: FosNodeContent, version: CidVersion): string {
  const format = CID_FORMATS[version]
  if (!format) throw new Error(`unknown cid version ${version}`)
  return formatCid(version, format.digest(content))
}

/** The cid of `content` in the current format. */
export function hashContent(content: FosNodeContent): string {
  return hashContentAt(content, CURRENT_CID_VERSION)
}

/**
 * Does `cid` really address `content`? Checks with the algorithm of the cid's
 * own version, so legacy rows verify without being rehashed first.
 */
export function verifyCid(cid: string, content: FosNodeContent): boolean {
  const parsed = parseCid(cid)
  if (!parsed) return false
  return hashContentAt(content, parsed.version) === cid
}

/** Short form for logs: keeps the version prefix and the first hex characters. */
export function shortCid(cid: string, chars = 8): string {
  const parsed = parseCid(cid)
  if (!parsed) return cid.slice(0, chars)
  return parsed.version === 0 ? parsed.digest.slice(0, chars) : `v${parsed.version}-${parsed.digest.slice(0, chars)}`
}
