import { hashContent } from '@fosforescent/shared/dag-implementation/store'
import type { FosNodeContent } from '@fosforescent/shared/types'

/**
 * A new account's root alias node: an alias id around the store's root. The stored row is the whole content the cid
 * was hashed from (data and children), since loading verifies every node it reads (`dbToStore`).
 */
export function accountRootAlias(rootNodeId: string, id: string): { cid: string; content: FosNodeContent } {
  const content: FosNodeContent = { data: { alias: { id } }, children: [[rootNodeId, rootNodeId]] }
  return { cid: hashContent(content), content }
}
