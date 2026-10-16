import type { Request, Response } from 'express'
import { createReplica, evaluateNode, headCid, writeNodeValue, evaluationRecord, nodeAuthorityAt, nodeLinkMaskAt, evaluationSteps } from '@fosforescent/shared/sync/index'
import { executionInput, executionSnapshot, executionMcp } from '@fosforescent/shared/sync/execution-access'
import { withUserLock, type PeerSyncDeps } from './peerSync'
import { createSharingHandlers } from './sharing'

export function createExecutionHandlers(deps: PeerSyncDeps, secret: string) {
  const sharing = createSharingHandlers(deps, secret)
  const sharedInteraction = async (claims: any, body: any, visitorToken?: string) => {
    let status = 200, result: any
    const response = { setHeader() {}, status(code: number) { status = code; return this }, json(value: any) { result = value; return this } } as Response
    const request = { claims, body: { owner: body.owner, path: body.path, share: body.share, visitorToken, interaction: true, revision: body.revision, approvals: [], ranking: [], fields: body.action === 'input' ? { [body.key]: { value: body.value } } : {} } } as unknown as Request
    await sharing.visit(request, response)
    if (status !== 200) throw new Error(result?.error ?? 'Evaluation access denied.')
    if (body.action === 'read') return result
    if (!['input', 'complete'].includes(body.action)) throw new Error('Unknown interaction.')
    await sharing.submit(request, response)
    if (status !== 200) throw new Error(result?.error ?? 'Evaluation access denied.')
    return result
  }
  const interact = async (claims: any, body: any): Promise<any> => {
    if (!claims?.username || claims.kind && !['user', 'peer'].includes(claims.kind) || claims.exp && claims.exp * 1000 <= Date.now()) throw new Error('An unexpired account or peer JWT is required.')
    if (!body || !Array.isArray(body.path) || body.path.length > 32 || body.path.some((id: any) => typeof id !== 'string' || !id || id.length > 256) || !['read', 'input', 'complete'].includes(body.action)) throw new Error('Invalid evaluation request.')
    if (body.share && claims.kind !== 'peer') return sharedInteraction(claims, body)
    const authority = claims.kind === 'peer' ? { peerId: claims.peerId, scope: claims.scope, capabilities: [] } : undefined
    if (authority && (typeof authority.peerId !== 'string' || !Array.isArray(authority.scope) || authority.scope.some((id: any) => typeof id !== 'string'))) throw new Error('Invalid peer attachment.')
    if (authority) body = { ...body, path: [...authority.scope, ...body.path] }
    if (body.owner && body.owner !== claims.username) throw new Error('Use the private shared evaluation address to access another owner?s node.')
    return withUserLock(`user:${claims.username}`, async () => {
      const loaded = await deps.loadStore(claims.username)
      if (!loaded) throw new Error('Account unavailable.')
      let r = createReplica(`user:${claims.username}`, loaded.store)
      const now = () => deps.now?.() ?? Date.now()
      const save = async (next: typeof r) => { r = next; await deps.saveStore(loaded.user, r.store); deps.notify?.(loaded.user.id, { type: 'sync_changed', byPeerId: 'fos:evaluation' }) }
      const snapshot = executionSnapshot(r, body.path, authority)
      if (body.action === 'read') return snapshot
      if (authority) {
        const input = snapshot.inputs.find(f => f.key === body.key)
        if (body.action === 'input' && !input) throw new Error('Only visible declared inputs may be submitted.')
        const paths = body.action === 'input' ? [[...body.path, ...input!.path!]] : evaluationSteps(r, body.path).map(step => step.path)
        for (const at of paths) {
          if (!nodeAuthorityAt(r, at, authority).includes('edit')) throw new Error('This peer cannot interact with this node.')
          const fields = nodeLinkMaskAt(r, at, authority.peerId).fields
          if (body.action === 'complete' && fields && ['description', 'requirement', 'allocation'].some(field => !fields.includes(field))) throw new Error('A masked peer cannot execute hidden effects.')
        }
      }
      if (body.revision !== headCid(r)) throw new Error('Evaluation changed. Read it again.')
      if (!['idle', 'rolled-back'].includes(evaluationRecord(r, body.path)?.status ?? 'idle')) throw new Error('This evaluation no longer accepts input.')
      if (body.action === 'input') await save(executionInput(r, body.path, body, authority?.peerId ?? r.meta.peerId, now()))
      else {
        if (executionSnapshot(r, body.path).inputs.length) throw new Error('Provide the requested inputs before completing.')
        if (!evaluationRecord(r, body.path)) await save(writeNodeValue(r, body.path, 'fos:evaluation', { id: crypto.randomUUID(), status: 'idle', started: now(), effects: [] }, now()))
        await evaluateNode(body.path, { get: () => r, save, now, handles: () => false, check: () => [] })
      }
      return executionSnapshot(r, body.path, authority)
    })
  }
  const http = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    try { return res.json(await interact((req as any).claims, req.body)) }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : String(error) }) }
  }
  const mcpHandler = (guest: boolean) => async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
    if (req.headers.origin) return res.status(403).end()
    // Address is fixed for the HTTP connection URL, never replaced by tool arguments.
    let address: any
    try { address = JSON.parse(String(req.query.address ?? '')) } catch { return res.status(400).json({ error: 'Supply an encoded evaluation address.' }) }
    const result = await executionMcp(req.body, body => {
      const input = { ...body, owner: address.owner, path: address.path, share: address.share }
      return guest ? sharedInteraction(null, input, req.headers.authorization?.replace(/^Bearer /, '')) : interact((req as any).claims, input)
    })
    return result === null ? res.status(202).end() : res.json(result)
  }
  return { interact, http, mcp: mcpHandler(false), publicMcp: mcpHandler(true) }
}
