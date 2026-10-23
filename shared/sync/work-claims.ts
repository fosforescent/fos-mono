/** Host-coordinated leases on work: part of what running the store's root records (its execute row). */
import { executionClaims, writeExecutionClaims } from './evaluation'
import { withMainBranchPolicy, type Scope } from './graph'
import type { Replica } from './replica'

export const WORK_LEASE_MS = 15 * 60 * 1000
export type WorkClaim = {
  id: string; peerId: string; session: string; attachment: Scope; path: Scope
  branches: Record<string, string>; expiresAt: number
}
export const within = (path: Scope, root: Scope): boolean => root.every((id, i) => path[i] === id)
const validPath = (value: unknown): value is Scope => Array.isArray(value) && value.length <= 64
  && value.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128 && id !== '.' && id !== '..')
export function workClaims(r: Replica, now: number): WorkClaim[] {
  const value = withMainBranchPolicy(r.store, () => executionClaims<WorkClaim[]>(r, []))
  if (!Array.isArray(value)) return []
  return value.filter(c => c && typeof c.id === 'string' && typeof c.peerId === 'string' && typeof c.session === 'string'
    && validPath(c.attachment) && validPath(c.path) && within(c.path, c.attachment)
    && c.branches && typeof c.branches === 'object' && !Array.isArray(c.branches)
    && Object.values(c.branches).every(name => typeof name === 'string' && name.length > 0)
    && Number.isFinite(c.expiresAt) && c.expiresAt > now)
}
export function saveWorkClaims(r: Replica, claims: WorkClaim[], now: number): Replica {
  return withMainBranchPolicy(r.store, () => writeExecutionClaims(r, [], claims, now))
}
export function workOverlaps(claim: WorkClaim, path: Scope, branches: Record<string, string>): boolean {
  return (within(path, claim.path) || within(claim.path, path))
    && !Object.entries(claim.branches).some(([id, name]) => branches[id] !== undefined && branches[id] !== name)
}
