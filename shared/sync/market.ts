/**
 * The market is a peer (`MARKET_PEER`, served by the fos server): a node is listed iff the market is a member of it
 * with `read`, and it takes proposals there when it also has `edit`. A member grant reaches the node's subtree like
 * any other (`marketGrantsAt`), indexing (backend/search/rowIndex.ts) and the market routes read it the same way.
 * Listing is the server's `market` effect or the owner adding the member; unlisting removes the member.
 *
 * Bids are generic: the bidder builds its rows in a draft nested where it stands (`draftBid`, `copyBidRow`) and sends
 * the verified nodes; the market appends them (`applyBid`) to a branch of the node and records that as the bidder's
 * proposal. Nothing here knows what kinds of rows a bid holds.
 */
import { FosStore } from '../dag-implementation/store'
import type { FosNodesData, FosPathElem } from '../types'
import {
  MARKET_PEER, commitRoot, content, findRowByAlias, identityCid, importNodes, isBookkeepingEdge, isPrevEdge, marketGrantsOf, marketMemberOf, nestScope, put,
  isRowEdge, isRowOfType, reachableNodes, resolveScope, updateAtScope, valueContent, withMainBranchPolicy, copyRowContent, newId, type Capability, type Scope
} from './graph'
import { addMemberAt, createReplica, headCid, removeMemberAt, type Replica } from './replica'

/** What the market may do at `path` below `root`: the nearest market member on the way down, else nothing. */
export function marketGrantsAt(store: FosStore, root: string, path: Scope): Capability[] {
  return withMainBranchPolicy(store, () => {
    let grants: Capability[] = []
    for (let i = 0; i <= path.length; i++) {
      const cid = resolveScope(store, root, path.slice(0, i))
      if (!cid) return []
      grants = marketGrantsOf(store, cid) ?? grants
    }
    return grants
  })
}

/** List the node at `at` (the market becomes its member: read, and proposals) or unlist it (the member is removed). */
export function setMarketAt(r: Replica, at: Scope, listed: boolean, now: number): Replica {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) throw new Error('The node no longer exists.')
  if (!listed) return marketMemberOf(r.store, cid) ? removeMemberAt(r, at, MARKET_PEER, now) : r
  const grants = marketGrantsOf(r.store, cid)
  return grants?.includes('read') && grants.includes('edit') ? r : addMemberAt(r, at, MARKET_PEER, 'Fos market', ['read', 'edit'], now)
}

/** Rows to add to another account's node, as verified nodes: each row edge and the path (in that node) it goes under. */
export type MarketBid = { nodes: FosNodesData; rows: Array<{ under: Scope; edge: FosPathElem }> }

/**
 * Build a bid: `build` adds rows at the root of a draft that stands at `at` of the bidder's tree (row types resolve
 * from there); `under(id)` says where each top-level row goes in the receiving node.
 */
export function draftBid(r: Replica, at: Scope, now: number, build: (draft: Replica) => Replica, under: (id: string) => Scope = () => []): MarketBid {
  const store = new FosStore()
  commitRoot(store, put(store, { data: {}, children: [] }), now)
  nestScope(store, { store: r.store, root: headCid(r), at })
  const draft = build(createReplica(r.meta.peerId, store))
  const edges = valueContent(draft.store, headCid(draft)).children.filter(e => isRowEdge(draft.store, e))
  return {
    nodes: reachableNodes(draft.store, edges.flat()),
    rows: edges.map(edge => ({ under: under(content(draft.store, identityCid(draft.store, edge)).data.alias?.id ?? ''), edge }))
  }
}

/** A bid of one of the bidder's own rows (with its subtree, fresh ids; `id` names the copy). */
export function copyBidRow(r: Replica, path: Scope, now: number, id?: string): MarketBid {
  const parent = resolveScope(r.store, headCid(r), path.slice(0, -1))
  const edge = parent && valueContent(r.store, parent).children.find(e => isRowEdge(r.store, e) && content(r.store, identityCid(r.store, e)).data.alias?.id === path.at(-1))
  if (!edge) throw new Error('The row no longer exists.')
  return draftBid(r, path.slice(0, -1), now, draft => {
    importNodes(draft.store, reachableNodes(r.store, [edge[0], identityCid(r.store, edge)]))
    const copied = copyRowContent(draft.store, identityCid(r.store, edge), now, newId, id ? { rootId: id } : {})
    commitRoot(draft.store, updateAtScope(draft.store, headCid(draft), [], value => ({ ...value, children: [...value.children, [edge[0], copied]] })), now)
    return { ...draft }
  })
}

export class BidError extends Error {}

/**
 * Receiving side: append a bid's rows to the node value `valueCid` and return the branch's value. Only nodes that
 * verify are taken in; every row must be a row edge whose rows carry no grants or proposals, attributed (supplies,
 * allocations) to the bidder alone, with ids new to the node, under a path that exists in it.
 */
export function applyBid(store: FosStore, valueCid: string, bid: unknown, bidder: string): string {
  const b = bid as Partial<MarketBid> | null
  if (!b || typeof b !== 'object' || !b.nodes || typeof b.nodes !== 'object' || !Array.isArray(b.rows) || !b.rows.length || b.rows.length > 50) throw new BidError('A bid of 1–50 rows is required.')
  if (Object.keys(b.nodes).length > 5000) throw new BidError('The bid is too large.')
  importNodes(store, b.nodes as FosNodesData)
  const checked = new Set<string>()
  const check = (edge: FosPathElem, depth: number) => {
    const cid = identityCid(store, edge)
    if (checked.has(cid)) return
    if (depth > 32 || checked.size > 2000) throw new BidError('The bid is too deep.')
    checked.add(cid)
    if (content(store, cid).children.some(e => isBookkeepingEdge(store, e) && !isPrevEdge(store, e))) throw new BidError('A bid cannot carry members or proposals.')
    // flow records (the allocation row type: allocations, requirements, supplies) name who they are by
    if (isRowOfType(store, edge, 'lib:type:allocation')) {
      const data = valueContent(store, cid).data
      for (const by of [data.allocation?.by, data.supply?.by]) if (by !== undefined && by !== bidder && by !== `user:${bidder}`) throw new BidError('Supplies and allocations in a bid are the bidder’s own.')
    }
    for (const child of valueContent(store, cid).children) if (isRowEdge(store, child)) check(child, depth + 1)
  }
  let branch = valueCid
  for (const row of b.rows) {
    const edge = row?.edge, under = Array.isArray(row?.under) && row.under.every(id => typeof id === 'string') ? row.under : null
    if (!Array.isArray(edge) || edge.length !== 2 || !edge.every(cid => typeof cid === 'string' && store.table.has(cid)) || !under) throw new BidError('Every bid row must be a node the bid carries.')
    if (!isRowEdge(store, edge as FosPathElem)) throw new BidError('Every bid row must be a row.')
    const identity = identityCid(store, edge as FosPathElem), id = content(store, identity).data.alias?.id
    if (!id || findRowByAlias(store, branch, id)) throw new BidError('A bid row needs an id new to this node.')
    check(edge as FosPathElem, 0)
    if (under.length && !resolveScope(store, branch, under)) throw new BidError('A bid row goes under a row this node does not have.')
    branch = updateAtScope(store, branch, under, value => ({ ...value, children: [...value.children, edge as FosPathElem] }))
  }
  return branch
}
