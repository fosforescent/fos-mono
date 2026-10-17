/**
 * Market listings. A listed node is one the account server's `market` effect flagged (backend/sync/hostHandlers.ts):
 * other accounts find it through the row index and may propose on it. The flag is the named value `fos:listing`
 * on the node, so it survives every later edit of the row and the serialize/sync round trip (a flag on the ref
 * node's data did not).
 */
import { LISTING_ARGUMENT, type Scope } from './graph'
import { readNodeValue, writeNodeValue } from './evaluation'
import { makeLinkAt, type Replica } from './replica'

export type Listing = { listedAt: number; by?: string }

export function listingAt(r: Replica, path: Scope): Listing | null {
  const value = readNodeValue<Listing>(r, path, LISTING_ARGUMENT)
  return value && typeof value.listedAt === 'number' ? value : null
}

/** List (or delist) a row on the market; listing a plain row makes it a link first. */
export function setMarketAt(r: Replica, at: Scope, listed: boolean, now: number, by?: string): Replica {
  if (listed === !!listingAt(r, at)) return r
  if (listed) r = makeLinkAt(r, at, now)
  return writeNodeValue(r, at, LISTING_ARGUMENT, listed ? { listedAt: now, ...(by ? { by } : {}) } : null, now)
}
