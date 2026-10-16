import type { Request, Response } from 'express'
import { agentMcp } from '@fosforescent/shared/sync/agent-mcp'
import { nodeRequestLinkId, type ProvidedNode } from '@fosforescent/shared/sync/index'
import { createNodeProvider } from '../sync/provideNode'
import type { PeerSyncDeps } from '../sync/peerSync'

/** Reuse authenticated node exchange, including relay, masks, revocation and proposal-only writes. */
export function createNodeAgentMcp(deps: PeerSyncDeps) {
  const provider = createNodeProvider(deps)
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    const claims = (req as any).claims
    if (claims?.kind !== 'peer' || !claims.username || !claims.peerId || !Array.isArray(claims.scope)) return res.status(401).json({ error: 'A scoped peer credential is required.' })
    if (req.headers.origin) return res.status(403).end()
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
    const result = await agentMcp(req.body, async (path, update) => {
      let status = 200, body: any
      const response = { setHeader() { return this }, status(code: number) { status = code; return this }, json(value: unknown) { body = value; return this } } as Response
      const request = Object.assign(Object.create(req), { body: { peerId: claims.peerId, scope: claims.scope, path, linkId: nodeRequestLinkId(claims.peerId, { peerId: `user:${claims.username}`, scope: [...claims.scope, ...path] }), ...(update ? { update } : {}) } }) as Request
      await provider(request, response)
      if (status !== 200) throw new Error(body?.error ?? 'Node access denied.')
      return body as ProvidedNode
    })
    return result === null ? res.status(202).end() : res.json(result)
  }
}
