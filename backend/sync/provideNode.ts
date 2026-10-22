import { nodeRelay } from './nodeRelay'
import type { Request, Response } from 'express'
import { createReplica, ensureHomeContext, type Replica, exchangeNode, findRowByAlias, nodeAuthorityAt, parseNodeRequest, rootTargetCid, viewNode, SERVER_TRANSPORT_CAPABILITIES, NodeAccessError, nodeReferenceAt, nodeLinkEndpoint, nodeRequestLinkId, acceptProvidedNode, acceptTemplateNodes, exchangeNodeContext, resolveScope, publication, validateNodeShape, type NodeRequest, type ProvidedNode, type NodeAuthority } from '@fosforescent/shared/sync/index'
import type { HostRuntime } from './host-runtime'
import { withUserLock, serverPeerIdFor, type AccountStoreDeps } from './accountStore'

/**
 * What an account's store carries whenever its owner syncs: Home, with the offers of this host's handlers. The
 * standard library is not linked here: devices ship it, and people who contribute link the shared one themselves.
 */
export function ensureAccountContext(r: Replica, now: number, runtime?: HostRuntime): Replica {
  return ensureHomeContext(r, now, runtime?.hostOffers())
}

export function createNodeProvider(deps: AccountStoreDeps, relay: { request(user: number, peer: string, address: string[], request: Omit<NodeRequest, 'scope' | 'path'>): Promise<ProvidedNode> } = nodeRelay) {
  return async (req: Request, res: Response): Promise<Response> => {
    const claims = (req as Request & { claims?: { username?: string; kind?: string; peerId?: string; scope?: string[] } }).claims
    if (!claims?.username) return res.status(401).json({ error: 'Authentication required.' })
    try {
      const request = parseNodeRequest(req.body)
      // `owner`: another account's node, shared with this user. They act there as the peer `user:<me>`, inside the
      // grants that account gave them; every write is a `node-sync` proposal on the owner's node.
      const owner = claims.kind !== 'peer' && typeof req.body?.owner === 'string' && req.body.owner !== claims.username ? String(req.body.owner) : null
      if (owner && request.peerId !== serverPeerIdFor(claims.username)) throw new NodeAccessError('On another account\'s node you are the peer user:<you>.')
      const account = owner ?? claims.username
      const authority: NodeAuthority = { peerId: claims.kind === 'peer' ? claims.peerId! : request.peerId,
        scope: claims.kind === 'peer' ? claims.scope! : owner ? request.scope : [], owner: claims.kind !== 'peer' && !owner, proposeOnly: claims.kind === 'peer' || !!owner, capabilities: deps.runtime?.serverCapabilities() ?? SERVER_TRANSPORT_CAPABILITIES }
      if (claims.kind === 'peer' && (!claims.peerId || !Array.isArray(claims.scope))) throw new NodeAccessError('Invalid peer credential.')
      const pending = !request.update && !request.proposal ? await withUserLock(`user:${account}`, async () => {
        const loaded = await deps.loadStore(account)
        if (!loaded) throw new NodeAccessError('Account unavailable.')
        const r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
        const reference = nodeReferenceAt(r, request, authority)
        if (!reference || reference.peer === r.meta.peerId) return null
        const path = [...request.scope, ...request.path]
        const upstream: NodeRequest = { peerId: r.meta.peerId, scope: [], path: reference.scope, branches: reference.branches,
          linkId: nodeLinkEndpoint(r, path, reference.peer)?.id ?? nodeRequestLinkId(r.meta.peerId, { peerId: reference.peer, scope: reference.scope }),
          // templates the requester is missing come from the device holding the node
          ...(request.templates?.length ? { templates: request.templates } : {}) }
        return { reference, upstream, user: loaded.user.id }
      }) : null
      // Release the account lock while the browser answers. Recheck the exact
      // reference and current grants after reacquiring it, before installing data.
      const upstreamNode = pending ? await relay.request(pending.user, pending.reference.peer, pending.reference.scope, pending.upstream) : null
      if (pending && upstreamNode) {
        validateNodeShape(upstreamNode)
        if (JSON.stringify(upstreamNode.address.branches ?? []) !== JSON.stringify(pending.reference.branches ?? []) || upstreamNode.children.some(child => child.address.peerId !== pending.reference.peer || JSON.stringify(child.address.scope) !== JSON.stringify([...pending.reference.scope, child.id]))) throw new NodeAccessError('Relay response contains an unauthorized child address.')
        if (upstreamNode.peerId !== pending.reference.peer || upstreamNode.address.peerId !== pending.reference.peer || upstreamNode.remoteLinkId !== pending.upstream.linkId || JSON.stringify(upstreamNode.address.scope) !== JSON.stringify(pending.reference.scope)) throw new NodeAccessError('Relay response does not match the provider request.')
      }
      const result = await withUserLock(`user:${account}`, async () => {
        const loaded = await deps.loadStore(account)
        if (!loaded) throw new NodeAccessError('Account unavailable.')
        let r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
        const before = loaded.store.rootNodeId
        if (claims.kind === 'peer' && (!claims.peerId || !Array.isArray(claims.scope))) throw new NodeAccessError('Invalid peer credential.')
        if (authority.owner) r = ensureAccountContext(r, deps.now?.() ?? Date.now(), deps.runtime)
        const now = deps.now?.() ?? Date.now()
        if (pending && upstreamNode) {
          const current = nodeReferenceAt(r, request, authority)
          if (!current || current.cid !== pending.reference.cid || current.peer !== pending.reference.peer) throw new NodeAccessError('The referenced node changed while its provider was answering.')
          const hydrate = (target: typeof r, input: NodeRequest) => {
            let next = acceptProvidedNode(target, [...request.scope, ...request.path], pending.upstream, upstreamNode, now)
            if (upstreamNode.templates) next = acceptTemplateNodes(next, [...request.scope, ...request.path], upstreamNode.templates, now)
            return exchangeNode(next, input, authority, now)
          }
          r = request.branches?.length ? exchangeNodeContext(r, request, authority, now, (target, input) => hydrate(target, input)).replica : hydrate(r, request).replica
        }
        let served = exchangeNode(r, request, authority, now)
        // A normal owner read refreshes connected services after the exchange has validated access.
        // Previewing a proposal or submitting a write never executes a load handler.
        if (authority.owner && !request.update && !request.proposal && deps.runtime) {
          try {
            const refreshed = await deps.runtime.onLoad({ userId: loaded.user.id, replica: served.replica, path: [...request.scope, ...request.path], branches: request.branches ?? [], now })
            if (refreshed !== served.replica) served = exchangeNode(refreshed, request, authority, now)
          } catch (error) { console.error('node load handlers failed:', error) }
        }
        // a submission came in: the handlers that react to one run on that node (the relay moves messages into queues).
        // The answer stays what was exchanged; the writer sees their effect on its next sync.
        if (request.update && deps.runtime) {
          try { deps.runtime.afterSubmission(served.replica, [...request.scope, ...request.path], now) }
          catch (error) { console.error('submission handlers failed:', error) }
        }
        if (served.replica.store.rootNodeId !== before) {
          await deps.saveStore(loaded.user, served.replica.store)
          deps.notify?.(loaded.user.id, { type: 'sync_changed', peerId: request.peerId })
        }
        return { ...served.node, presence: deps.onlinePeers?.(loaded.user.id) ?? [] }
      })
      res.setHeader('Cache-Control', 'no-store')
      return res.json(result)
    } catch (error) {
      if (error instanceof NodeAccessError) return res.status(403).json({ error: error.message })
      if (error instanceof Error && /provider (is offline|disconnected|timed out|is unavailable|refused)/i.test(error.message)) return res.status(503).json({ error: error.message })
      console.error('provideNode failed:', error)
      return res.status(500).json({ error: 'Node request failed.' })
    }
  }
}

/**
 * GET /user/data/peer-sync/locate?owner=&id= — where a node another account shared with this user lives in that
 * account (its path, which is the attachment scope for provide-node and events), what they may do there, its title,
 * and the audience it is published to, if any (what the shared view opens). 403 when nothing was granted at or above it.
 */
export function createNodeLocator(deps: AccountStoreDeps) {
  return async (req: Request, res: Response): Promise<Response> => {
    const claims = (req as Request & { claims?: { username?: string; kind?: string } }).claims
    if (!claims?.username || claims.kind === 'peer') return res.status(401).json({ error: 'Authentication required.' })
    const owner = typeof req.query.owner === 'string' ? req.query.owner : '', aliasId = typeof req.query.id === 'string' ? req.query.id : ''
    if (!owner || !aliasId) return res.status(400).json({ error: 'owner and id required' })
    const loaded = await deps.loadStore(owner)
    if (!loaded) return res.status(404).json({ error: 'owner not found' })
    const r = createReplica(serverPeerIdFor(owner), loaded.store)
    const found = findRowByAlias(loaded.store, rootTargetCid(loaded.store), aliasId)
    if (!found) return res.status(404).json({ error: 'node not found' })
    const path = [...found.path, aliasId]
    try {
      const grants = owner === claims.username ? ['read', 'edit', 'execute'] : nodeAuthorityAt(r, path, { peerId: serverPeerIdFor(claims.username), scope: path, capabilities: [] })
      res.setHeader('Cache-Control', 'no-store')
      const published = publication(r, path)
      return res.json({ owner, aliasId, path, title: viewNode(loaded.store, found.row.id ? resolveScopeOrThrow(loaded.store, path) : rootTargetCid(loaded.store)).name, grants, ...(published ? { published: published.audience } : {}) })
    } catch (error) {
      if (error instanceof NodeAccessError) return res.status(403).json({ error: 'This node is not shared with you.' })
      throw error
    }
  }
}
function resolveScopeOrThrow(store: Parameters<typeof rootTargetCid>[0], path: string[]): string {
  const cid = resolveScope(store, rootTargetCid(store), path)
  if (!cid) throw new NodeAccessError('node not found')
  return cid
}
