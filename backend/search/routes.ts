/**
 * Search and market endpoints (all behind the user JWT middleware):
 *   POST /user/data/search            {query, market, limit} → {hits}
 *   POST /user/data/search/reindex    re-embed this account's rows
 *   GET  /user/data/market/node?owner=&id=   a listed node as a bidder sees it (own proposal only)
 *   POST /user/data/market/proposals  {owner, aliasId, rows} → this account's proposal on that node
 *
 * The market: a row listed by its owner (`listing` on its ref node) is searchable by other
 * accounts. A bidder sees the node's value and comments but only its own proposal; the owner
 * sees every proposal and approves one. Proposals are branches (shared/sync proposals) whose
 * content is the node's value plus the rows the bidder adds (comments, allocation references,
 * supplies for the task's requirements).
 */

import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { commitRoot, content, findRowByAlias, hasCapability, makeLink, newId, proposalContent, put, readProposals, resolveScope, rootTargetCid, rowContent, rowEdge, stripLink, updateAtScope, viewNode, withProposal, type NodeView, type RowExtras, type RowKind, type Scope } from '@fosforescent/shared/sync/index'
import { indexStore, searchRows, type Embed } from './rowIndex'

export type SearchDeps = {
  prisma: any
  embed: Embed
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

export function createSearchHandlers(deps: SearchDeps) {
  const now = () => (deps.now ? deps.now() : Date.now())
  return {
    async search(req: Request, res: Response): Promise<Response> {
      const me = username(req)
      if (!me) return res.status(401).json({ error: 'Unauthorized' })
      const body = (req.body ?? {}) as { query?: unknown; market?: unknown; limit?: unknown }
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, 1000) : ''
      if (!query) return res.status(400).json({ error: 'query required' })
      try {
        const loaded = await deps.loadStore(me)
        if (!loaded) return res.status(401).json({ error: 'User not found' })
        const hits = await searchRows(deps.prisma, { userId: loaded.user.id, query, market: body.market === true, limit: typeof body.limit === 'number' ? body.limit : 10 }, deps.embed)
        return res.json({ hits })
      } catch (error) {
        console.error('search failed:', error instanceof Error ? error.message : error)
        return res.status(502).json({ error: `search failed: ${error instanceof Error ? error.message : String(error)}` })
      }
    },

    async reindex(req: Request, res: Response): Promise<Response> {
      const me = username(req)
      if (!me) return res.status(401).json({ error: 'Unauthorized' })
      const loaded = await deps.loadStore(me)
      if (!loaded) return res.status(401).json({ error: 'User not found' })
      try {
        const result = await indexStore(deps.prisma, loaded.user, loaded.store, deps.embed)
        return res.json(result)
      } catch (error) {
        return res.status(502).json({ error: `indexing failed: ${error instanceof Error ? error.message : String(error)}` })
      }
    },

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
      const found = findRowByAlias(store, rootTargetCid(store), aliasId)
      if (!found) return res.status(404).json({ error: 'node not found' })
      const cid = resolveScope(store, rootTargetCid(store), [...found.path, aliasId])!
      const identity = content(store, cid)
      // open to bidders when listed, and to accounts the owner made members of the node (with `edit`): they may send proposals (e.g. an allocation bin)
      if (!identity.data.listing && owner !== me && !hasCapability(store, identity, `user:${me}`, 'edit')) return res.status(403).json({ error: 'not listed on the market, and you are not a member of it' })
      const view = viewNode(store, cid)
      const mine = `user:${me}`
      const filtered: NodeView = { ...view, peers: [], members: [], proposals: owner === me ? view.proposals : view.proposals.filter((p) => p.peerId === mine) }
      const myProposal = view.proposals.find((p) => p.peerId === mine) ?? null
      return res.json({ owner, aliasId, view: filtered, myProposal: myProposal ? { id: myProposal.id, status: myProposal.status } : null })
    },

    /** Submit (or replace) this account's proposal on a listed node: the node's value plus the given rows. */
    async marketProposal(req: Request, res: Response): Promise<Response> {
      const me = username(req)
      if (!me) return res.status(401).json({ error: 'Unauthorized' })
      const body = (req.body ?? {}) as { owner?: unknown; aliasId?: unknown; rows?: unknown }
      const owner = typeof body.owner === 'string' ? body.owner : ''
      const aliasId = typeof body.aliasId === 'string' ? body.aliasId : ''
      const rows = Array.isArray(body.rows) ? (body.rows as Array<{ kind?: unknown; text?: unknown; data?: unknown; under?: unknown; id?: unknown }>) : []
      if (!owner || !aliasId || !rows.length) return res.status(400).json({ error: 'owner, aliasId and rows required' })
      if (owner === me) return res.status(400).json({ error: 'propose on your own node from the tree instead' })
      const outcome = await deps.withUserLock(`user:${owner}`, async () => {
        const loaded = await deps.loadStore(owner)
        if (!loaded) return { status: 404, body: { error: 'owner not found' } } as const
        const { user, store } = loaded
        const found = findRowByAlias(store, rootTargetCid(store), aliasId)
        if (!found) return { status: 404, body: { error: 'node not found' } } as const
        const path: Scope = [...found.path, aliasId]
        const cid = resolveScope(store, rootTargetCid(store), path)!
        const identity = content(store, cid)
        const peerId = `user:${me}`
        if (!identity.data.listing && !hasCapability(store, identity, peerId, 'edit')) return { status: 403, body: { error: 'not listed on the market, and you are not a member of it' } } as const
        const t = now()
        // The branch: the node's current value plus the bidder's rows. Built on the value directly
        // (updateAtScope walks `under` paths inside it) so the owner's root pointer is never touched.
        const mainValueCid = put(store, stripLink(store, identity))
        let branchCid = mainValueCid
        for (const row of rows) {
          const kind = (typeof row.kind === 'string' && ['plain', 'comment', 'ref', 'supply', 'allocation', 'requirement', 'note', 'task'].includes(row.kind) ? row.kind : 'comment') as RowKind
          const text = typeof row.text === 'string' ? row.text.trim().slice(0, 4000) : ''
          const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>
          const under: Scope = typeof row.under === 'string' ? [row.under] : []
          const extras: RowExtras = { store }
          if (kind === 'supply' && data.supply && typeof data.supply === 'object') extras.supply = { ...(data.supply as NonNullable<RowExtras['supply']>), by: me, at: t }
          if (kind === 'allocation' && data.allocation && typeof data.allocation === 'object') extras.allocation = { ...(data.allocation as NonNullable<RowExtras['allocation']>), by: me }
          // an allocation bin: a row with requirement rows (what the receiver must fill) and allocation rows (what they get) sent as one proposal
          if (kind === 'requirement' && data.requirement && typeof data.requirement === 'object') extras.requirement = { ...(data.requirement as NonNullable<RowExtras['requirement']>) }
          if (kind === 'task') extras.done = false
          if (kind === 'ref' && typeof data.refId === 'string') extras.refId = data.refId
          if (kind === 'comment') extras.author = { id: peerId, name: me }
          if (!text && !['supply', 'allocation', 'ref'].includes(kind)) continue
          if (kind === 'ref' && !extras.refId) continue
          if (under.length && !resolveScope(store, branchCid, under)) continue // an `under` that does not exist in this node: skip
          const id = typeof row.id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(row.id) && !findRowByAlias(store, branchCid, row.id) ? row.id : newId()
          const rowCid = put(store, rowContent(kind, id, text, t, extras))
          branchCid = updateAtScope(store, branchCid, under, (value) => ({ ...value, children: [...value.children, rowEdge(store, kind, rowCid)], data: { ...value.data, updated: { time: t } } }))
        }
        if (branchCid === mainValueCid) return { status: 400, body: { error: 'no valid rows in the proposal' } } as const
        // the proposal is named after the bidder: that is what the owner sees in the proposals list
        const proposalCid = put(store, proposalContent(store, peerId, me, branchCid, mainValueCid, t))
        const nextIdentity = withProposal(store, makeLink(store, identity, t), peerId, proposalCid, me)
        const nextRoot = updateAtScope(store, rootTargetCid(store), path, () => nextIdentity, 'node')
        commitRoot(store, nextRoot, t)
        await deps.saveStore(user, store)
        deps.notify?.(user.id, { type: 'sync_changed', scope: path, byPeerId: peerId })
        return { status: 200, body: { proposalId: proposalCid, rows: readProposals(store, nextIdentity).length } } as const
      })
      return res.status(outcome.status).json(outcome.body)
    }
  }
}
