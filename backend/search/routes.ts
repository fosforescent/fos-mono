/**
 * The market, as the fos server serves it (behind the user JWT middleware):
 *   GET  /user/data/market/node?owner=&id=   a listed node as a bidder sees it (own proposal only)
 *   POST /user/data/market/proposals  {owner, aliasId, bid} → this account's proposal on that node
 *
 * A node is listed where the market peer (`MARKET_PEER`) is a member with `read`, and takes proposals where it also
 * has `edit` (shared/sync/market.ts `marketGrantsAt`, inherited down the tree). A bidder sees the node's value but
 * only its own proposal; the owner sees every proposal and approves one. A bid is rows the bidder built itself
 * (`draftBid`/`copyBidRow`), appended to a branch of the node's value (`applyBid`) and recorded as the proposal
 * `user:<bidder>`. Search is no route: it is the fos `search` effect (sync/hostHandlers.ts).
 */

import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { BidError, applyBid, createReplica, marketGrantsAt, marketplaceOffers, commitRoot, content, findRowByAlias, hasCapability, makeLink, proposalContent, put, readProposals, resolveScope, rootTargetCid, stripLink, updateAtScope, viewNode, withProposal, type NodeView, type Scope } from '@fosforescent/shared/sync/index'

export type MarketRouteDeps = {
  loadStore(username: string): Promise<{ user: { id: number; username: string }; store: FosStore } | null>
  saveStore(user: { id: number; username: string }, store: FosStore): Promise<void>
  withUserLock<T>(key: string, fn: () => Promise<T>): Promise<T>
  notify?(userId: number, message: Record<string, unknown>): void
  now?(): number
}

function username(req: Request): string | null {
  const u = (req as Request & { claims?: { username?: string; kind?: string } }).claims
  return u?.username && u.kind !== 'peer' ? u.username : null
}

/** The row `aliasId` of the owner's tree: its path, cid and what the market (and `user:<me>` as a member) may do there. */
function locate(store: FosStore, aliasId: string, me: string) {
  const root = rootTargetCid(store), found = findRowByAlias(store, root, aliasId)
  if (!found) return null
  const path: Scope = [...found.path, aliasId], cid = resolveScope(store, root, path)!, identity = content(store, cid)
  const market = marketGrantsAt(store, root, path)
  return { path, cid, identity, read: market.includes('read'), propose: market.includes('edit') || hasCapability(store, identity, `user:${me}`, 'edit') }
}

export function createMarketHandlers(deps: MarketRouteDeps) {
  const now = () => (deps.now ? deps.now() : Date.now())
  return {
    /** A listed node as the requesting account may see it: value and comments, proposals filtered to its own. */
    async marketNode(req: Request, res: Response): Promise<Response> {
      const me = username(req)
      if (!me) return res.status(401).json({ error: 'Unauthorized' })
      const owner = typeof req.query.owner === 'string' ? req.query.owner : ''
      const aliasId = typeof req.query.id === 'string' ? req.query.id : ''
      if (!owner || !aliasId) return res.status(400).json({ error: 'owner and id required' })
      const loaded = await deps.loadStore(owner)
      if (!loaded) return res.status(404).json({ error: 'owner not found' })
      const { store } = loaded
      const offer = marketplaceOffers(createReplica('market-read', store)).find(o => o.id === aliasId)
      if (offer) {
        const node = viewNode(store, offer.cid)
        return res.json({ owner, aliasId, view: { ...node, peers: [], members: [], proposals: [] }, myProposal: null, capability: true })
      }
      const found = locate(store, aliasId, me)
      if (!found) return res.status(404).json({ error: 'node not found' })
      // open to bidders where the market lists it, and to accounts the owner made members of the node (with `edit`)
      if (!found.read && !found.propose && owner !== me) return res.status(403).json({ error: 'not listed on the market, and you are not a member of it' })
      const view = viewNode(store, found.cid)
      const mine = `user:${me}`
      const filtered: NodeView = { ...view, peers: [], members: [], proposals: owner === me ? view.proposals : view.proposals.filter((p) => p.peerId === mine) }
      const myProposal = view.proposals.find((p) => p.peerId === mine) ?? null
      return res.json({ owner, aliasId, view: filtered, myProposal: myProposal ? { id: myProposal.id, status: myProposal.status } : null })
    },

    /** Submit (or replace) this account's proposal on a node: its value plus the bid's rows. */
    async marketProposal(req: Request, res: Response): Promise<Response> {
      const me = username(req)
      if (!me) return res.status(401).json({ error: 'Unauthorized' })
      const body = (req.body ?? {}) as { owner?: unknown; aliasId?: unknown; bid?: unknown }
      const owner = typeof body.owner === 'string' ? body.owner : ''
      const aliasId = typeof body.aliasId === 'string' ? body.aliasId : ''
      if (!owner || !aliasId || !body.bid) return res.status(400).json({ error: 'owner, aliasId and bid required' })
      if (owner === me) return res.status(400).json({ error: 'propose on your own node from the tree instead' })
      const outcome = await deps.withUserLock(`user:${owner}`, async () => {
        const loaded = await deps.loadStore(owner)
        if (!loaded) return { status: 404, body: { error: 'owner not found' } } as const
        const { user, store } = loaded
        const found = locate(store, aliasId, me)
        if (!found) return { status: 404, body: { error: 'node not found' } } as const
        if (!found.propose) return { status: 403, body: { error: 'the market takes no proposals on this node, and you are not a member of it' } } as const
        const t = now(), peerId = `user:${me}`
        // The branch: the node's current value plus the bid's rows, built on the value so the owner's root never moves.
        const mainValueCid = put(store, stripLink(store, found.identity))
        let branchCid: string
        try { branchCid = applyBid(store, mainValueCid, body.bid, me) }
        catch (error) { if (error instanceof BidError) return { status: 400, body: { error: error.message } } as const; throw error }
        // the proposal is named after the bidder: that is what the owner sees in the proposals list
        const proposalCid = put(store, proposalContent(store, peerId, me, branchCid, mainValueCid, t))
        const nextIdentity = withProposal(store, makeLink(store, found.identity, t), peerId, proposalCid, me)
        commitRoot(store, updateAtScope(store, rootTargetCid(store), found.path, () => nextIdentity, 'node'), t)
        await deps.saveStore(user, store)
        deps.notify?.(user.id, { type: 'sync_changed', scope: found.path, byPeerId: peerId })
        return { status: 200, body: { proposalId: proposalCid, rows: readProposals(store, nextIdentity).length } } as const
      })
      return res.status(outcome.status).json(outcome.body)
    }
  }
}
