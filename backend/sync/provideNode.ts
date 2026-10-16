import { nodeRelay } from './nodeRelay'
import type { Request, Response } from 'express'
import { createReplica, ensureHomeContext, exchangeNode, parseNodeRequest, SERVER_CAPABILITIES, NodeAccessError, nodeReferenceAt, nodeLinkEndpoint, nodeRequestLinkId, acceptProvidedNode, exchangeNodeContext, validateNodeShape, type NodeRequest, type ProvidedNode, type NodeAuthority } from '@fosforescent/shared/sync/index'
import { withUserLock, serverPeerIdFor, type PeerSyncDeps } from './peerSync'

export function createNodeProvider(deps: PeerSyncDeps, relay: { request(user: number, peer: string, address: string[], request: Omit<NodeRequest, 'scope' | 'path'>): Promise<ProvidedNode> } = nodeRelay) {
  return async (req: Request, res: Response): Promise<Response> => {
    const claims = (req as Request & { claims?: { username?: string; kind?: string; peerId?: string; scope?: string[] } }).claims
    if (!claims?.username) return res.status(401).json({ error: 'Authentication required.' })
    try {
      const request = parseNodeRequest(req.body)
      const authority: NodeAuthority = { peerId: claims.kind === 'peer' ? claims.peerId! : request.peerId,
        scope: claims.kind === 'peer' ? claims.scope! : [], owner: claims.kind !== 'peer', proposeOnly: claims.kind === 'peer', capabilities: SERVER_CAPABILITIES }
      if (claims.kind === 'peer' && (!claims.peerId || !Array.isArray(claims.scope))) throw new NodeAccessError('Invalid peer credential.')
      const pending = !request.update && !request.proposal ? await withUserLock(`user:${claims.username}`, async () => {
        const loaded = await deps.loadStore(claims.username!)
        if (!loaded) throw new NodeAccessError('Account unavailable.')
        const r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
        const reference = nodeReferenceAt(r, request, authority)
        if (!reference || reference.peer === r.meta.peerId) return null
        const path = [...request.scope, ...request.path]
        const upstream: NodeRequest = { peerId: r.meta.peerId, scope: [], path: reference.scope, branches: reference.branches,
          linkId: nodeLinkEndpoint(r, path, reference.peer)?.id ?? nodeRequestLinkId(r.meta.peerId, { peerId: reference.peer, scope: reference.scope }) }
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
      const result = await withUserLock(`user:${claims.username}`, async () => {
        const loaded = await deps.loadStore(claims.username!)
        if (!loaded) throw new NodeAccessError('Account unavailable.')
        let r = createReplica(serverPeerIdFor(loaded.user.username), loaded.store)
        const before = loaded.store.rootNodeId
        if (claims.kind === 'peer' && (!claims.peerId || !Array.isArray(claims.scope))) throw new NodeAccessError('Invalid peer credential.')
        if (claims.kind !== 'peer') r = ensureHomeContext(r, deps.now?.() ?? Date.now())
        const now = deps.now?.() ?? Date.now()
        if (pending && upstreamNode) {
          const current = nodeReferenceAt(r, request, authority)
          if (!current || current.cid !== pending.reference.cid || current.peer !== pending.reference.peer) throw new NodeAccessError('The referenced node changed while its provider was answering.')
          const hydrate = (target: typeof r, input: NodeRequest) => {
            const next = acceptProvidedNode(target, [...request.scope, ...request.path], pending.upstream, upstreamNode, now)
            return exchangeNode(next, input, authority, now)
          }
          r = request.branches?.length ? exchangeNodeContext(r, request, authority, now, (target, input) => hydrate(target, input)).replica : hydrate(r, request).replica
        }
        const served = exchangeNode(r, request, authority, now)
        if (loaded.store.rootNodeId !== before) {
          await deps.saveStore(loaded.user, loaded.store)
          if (request.update) deps.notify?.(loaded.user.id, { type: 'sync_changed', peerId: request.peerId })
        }
        return served.node
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
