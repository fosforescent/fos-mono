import { createHash, createHmac, randomUUID } from 'node:crypto'
import * as jsonwebtoken from 'jsonwebtoken'
import type { Request, Response } from 'express'
import { applyMergePolicy, nodeAuthorityAt, nodeLinkMaskAt, evaluationSteps, addMemberAt, ensureHomeContext, evaluateNode, evaluationRecord, executionInputs, addRow, addSupply, proposeRefAt, applyProposalAt, addTask, instantiateTemplate, ensureSharedLink, writeParticipation, argumentRefs, configurePoll, content, createReplica, capabilityPeers, readNodeValue, writeLinkedNodeValue, hasCapability, headCid, participation, put, resolveRef, resolveScope, setSharing, sharedProjection, sharing, valueContent, view, writeNodeValue, audiencePeer, type Participation, type Replica, type Scope, type SharedInput, type SharePolicy, type SharedAddress } from '@fosforescent/shared/sync/index'
import { withUserLock, type PeerSyncDeps } from './peerSync'
const sign = jsonwebtoken.sign ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.sign
const verify = jsonwebtoken.verify ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.verify
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
type Address = SharedAddress
type Claims = { username?: string; kind?: string }
type Visitor = Address & { peer: string }
class Failure extends Error { constructor(readonly status: number, message: string) { super(message) } }
function address(body: any): Address {
  if (!body || typeof body.owner !== 'string' || body.owner.length > 128 || !body.owner || typeof body.share !== 'string' || !/^[\w-]{16,128}$/.test(body.share) || !Array.isArray(body.path) || body.path.length > 32 || body.path.some((id: unknown) => typeof id !== 'string' || !id || id.length > 256)) throw new Failure(400, 'Invalid shared-node address.')
  return { owner: body.owner, share: body.share, path: body.path }
}
function username(req: Request): string | null { const c = (req as Request & { claims?: Claims }).claims; return c?.username && (!c.kind || c.kind === 'user') ? c.username : null }
async function locks<T>(names: string[], work: () => Promise<T>): Promise<T> {
  const keys = [...new Set(names)].sort()
  const next = (i: number): Promise<T> => i === keys.length ? work() : withUserLock(`user:${keys[i]}`, () => next(i + 1))
  return next(0)
}
/** `evaluate` is the host's evaluation service (its handler registry runs the effects of a finished execution). */
export function createSharingHandlers(deps: PeerSyncDeps, secret: string, evaluate?: (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => Promise<unknown>) {
  if (!secret) throw new Error('Sharing requires a signing secret.')
  // A guest receipt cannot be used as an account or peer-sync JWT, even if presented to another endpoint.
  const guestSecret = createHmac('sha256', secret).update('fos:public-participation:v1').digest('hex')
  const now = () => deps.now?.() ?? Date.now()
  const visitorToken = (visitor: Visitor) => sign(visitor, guestSecret, { algorithm: 'HS256', audience: 'fos-public-input', expiresIn: '30d' })
  const readVisitor = (token: unknown, at: Address): Visitor => {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw Error()
      const claims = verify(token, guestSecret, { algorithms: ['HS256'], audience: 'fos-public-input' }) as Visitor
      if (claims.owner !== at.owner || claims.share !== at.share || JSON.stringify(claims.path) !== JSON.stringify(at.path) || typeof claims.peer !== 'string' || !claims.peer.startsWith('visitor:')) throw Error()
      return { ...at, peer: claims.peer }
    } catch { throw new Failure(401, 'This guest session is invalid or expired.') }
  }
  const load = async (at: Address, account: string | null, peer?: string) => {
    const loaded = await deps.loadStore(at.owner)
    if (!loaded) throw new Failure(404, 'Shared node unavailable.')
    const r = createReplica(`user:${at.owner}`, loaded.store), policy = sharing(r, at.path)
    const cid = resolveScope(r.store, headCid(r), at.path)
    if (!policy?.enabled || policy.id !== at.share || !cid || !hasCapability(r.store, content(r.store, cid), audiencePeer(policy.audience), 'read')) throw new Failure(404, 'This link is unavailable or has been revoked.')
    if (policy.audience === 'users' && !account) throw new Failure(401, 'Sign in to a Fos account to visit this node.')
    if (policy.execution) {
      if (policy.execution.peer !== peer) throw new Failure(403, 'This evaluation belongs to another visitor.')
      const entry = policy.execution.entry, parent = sharing(r, entry.path)
      if (entry.owner !== at.owner || !parent?.enabled || !parent.template || parent.id !== entry.share) throw new Failure(404, 'This template endpoint has been revoked.')
    }
    return { ...loaded, r, policy, cid }
  }
  const save = async (user: { id: number; username: string }, r: Replica) => { await deps.saveStore(user, r.store); deps.notify?.(user.id, { type: 'sync_changed', byPeerId: 'fos:sharing' }) }
  const run = (handler: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    res.setHeader?.('Cache-Control', 'no-store')
    try { if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 65536) throw new Failure(413, 'Input is too large.'); return await handler(req, res) } catch (error) { return res.status(error instanceof Failure ? error.status : 409).json({ error: error instanceof Failure ? error.message : 'The node changed or could not be saved. Refresh and try again.' }) }
  }
  const participantAccess = (r: Replica, path: Scope, peer: string, cap: 'read' | 'approve' | 'rank') => {
    const cid = resolveScope(r.store, headCid(r), path)
    const policy = sharing(r, path)
    return !!cid && !!policy && hasCapability(r.store, content(r.store, cid), audiencePeer(policy.audience), cap) && hasCapability(r.store, content(r.store, cid), peer, cap)
  }
  const projectField = (field: SharedInput, value: any): Participation['fields'][string] => {
    if (field.kind === 'confirmation') { if (value !== true) throw new Failure(400, 'Confirmation is required.'); return true }
    if (field.kind === 'choice') { if (!Number.isInteger(value) || value < 0 || value >= (field.options?.length ?? 0)) throw new Failure(400, 'Choose a declared option.'); return value }
    if (field.kind === 'text') {
      if (typeof value !== 'string' || value.length > 8000) throw new Failure(400, `Invalid text for ${field.name}.`)
      return value
    }
    if (!value || typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0 || value.type !== field.type || value.unit !== field.unit || (field.start !== undefined && (typeof value.start !== 'number' || !Number.isFinite(value.start) || value.start > field.start)) || (field.end !== undefined && (typeof value.end !== 'number' || !Number.isFinite(value.end) || value.end < field.end))) throw new Failure(400, `The supplied allocation does not match ${field.name}.`)
    if (field.direction === 'consume' && value.amount > (field.amount ?? 0)) throw new Failure(400, 'The requested amount exceeds this allocation.')
    return { amount: value.amount, type: field.type!, unit: field.unit!, ...(field.start !== undefined ? { start: field.start } : {}), ...(field.end !== undefined ? { end: field.end } : {}) }
  }
  return {
    configure: run(async (req, res) => {
      const owner = username(req), body = req.body ?? {}
      if (!owner) throw new Failure(403, 'An account owner must configure sharing.')
      if (!Array.isArray(body.path) || body.path.length > 32 || body.path.some((id: unknown) => typeof id !== 'string' || !id || id.length > 256) || !['public', 'users'].includes(body.audience) || typeof body.enabled !== 'boolean' || (body.poll !== undefined && !['approval', 'rank', null].includes(body.poll))) throw new Failure(400, 'Invalid sharing settings.')
      return locks([owner], async () => {
        const loaded = await deps.loadStore(owner)
        if (!loaded) throw new Failure(404, 'Account unavailable.')
        let r = createReplica(`user:${owner}`, loaded.store)
        const cid = resolveScope(r.store, headCid(r), body.path)
        if (!cid || body.expected !== put(r.store, valueContent(r.store, cid))) throw new Failure(409, 'Sync this node and review its current contents before sharing.')
        const old = sharing(r, body.path)
        if (body.template !== undefined && typeof body.template !== 'boolean') throw new Failure(400, 'Invalid template trigger.')
        if (body.template && view(r, body.path.slice(0, -1))?.tasks.find(t => t.id === body.path.at(-1))?.kind !== 'template') throw new Failure(400, 'Triggers require a template.')
        const policy: SharePolicy = { id: old?.enabled && old.audience === body.audience && !!old.template === !!body.template ? old.id : randomUUID(), audience: body.audience, enabled: body.enabled, ...(body.template ? { template: true } : {}) }
        // Validate poll before modifying the store.
        if (body.poll && !capabilityPeers(r, body.path, 'poll').includes('fos')) throw new Failure(409, 'The Fos poll handler is not available in this context.')
        if (body.poll && view(r, body.path.slice(0, -1))?.tasks.find(t => t.id === body.path.at(-1))?.requirement?.capability !== 'choice') throw new Failure(400, 'A poll needs a choice requirement.')
        r = setSharing(r, body.path, policy, now())
        if (body.poll) r = configurePoll(r, body.path, body.poll, now())
        if (body.poll === null) r = writeNodeValue(r, body.path, 'fos:poll', null, now())
        await save(loaded.user, r)
        return res.json({ owner, path: body.path, share: policy.id, policy })
      })
    }),
    visit: run(async (req, res) => {
      let at = address(req.body), account = username(req)
      return locks([at.owner, ...(account ? [account] : [])], async () => {
        let guest = account ? { ...at, peer: `user:${account}` } : req.body.visitorToken ? readVisitor(req.body.visitorToken, at) : { ...at, peer: `visitor:${randomUUID()}` }
        const loaded = await load(at, account, guest.peer)
        const { user } = loaded
        let r = loaded.r, policy = loaded.policy, token: string | undefined, entryToken: string | undefined, executionAddress: Address | undefined, createdExecution = false
        const beforeJoin = headCid(r)
        if (policy.template) {
          const entry = { ...at }, key = `fos:execution:${digest([policy.id, guest.peer])}`
          if (!account) entryToken = visitorToken(guest)
          executionAddress = readNodeValue<Address>(r, at.path, key) ?? undefined
          if (!executionAddress) {
            createdExecution = true
            const template = view(r, at.path.slice(0, -1))?.tasks.find(t => t.id === at.path.at(-1))
            if (template?.kind !== 'template') throw new Failure(409, 'This trigger requires a template.')
            const id = randomUUID(), parent = at.path.slice(0, -1)
            r = addTask(r, parent, template.title, now(), id)
            r = instantiateTemplate(r, parent, id, template.id, now())
            executionAddress = { owner: at.owner, path: [...parent, id], share: randomUUID() }
            r = setSharing(r, executionAddress.path, { id: executionAddress.share, audience: policy.audience, enabled: true, execution: { peer: guest.peer, entry } }, now())
            r = writeNodeValue(r, executionAddress.path, 'fos:evaluation', { id: randomUUID(), status: 'idle', started: now(), effects: [] }, now())
            r = writeNodeValue(r, at.path, key, executionAddress, now())
          }
          at = executionAddress; policy = sharing(r, at.path)!
          if (!policy?.enabled || policy.id !== at.share || policy.execution?.peer !== guest.peer) throw new Failure(403, 'This evaluation is unavailable.')
          guest = { ...at, peer: guest.peer }
        }
        const member = view(r, at.path)!.members.find(m => m.peerId === guest.peer)
        if (!member) {
          if (view(r, at.path)!.members.length >= 1000) throw new Failure(409, 'This node has reached its guest limit.')
          if ((policy.execution && !createdExecution) || req.body.visitorToken && !executionAddress) throw new Failure(403, 'The host removed this guest. Request a new invitation.')
          r = addMemberAt(r, at.path, guest.peer, account ?? 'Anonymous guest', ['read', 'approve', 'rank'], now())
        }
        if (!participantAccess(r, at.path, guest.peer, 'read')) throw new Failure(403, 'The host disabled this guest.')
        if (!participation(r, at.path, guest.peer)) {
          let record: Participation = { peer: guest.peer, audience: policy.id, revision: '', updated: now(), approvals: [], ranking: [], fields: {} }
          if (account) {
            const loaded = account === at.owner ? { user, store: r.store } : await deps.loadStore(account)
            if (!loaded) throw new Failure(401, 'Guest account unavailable.')
            let own = createReplica(`user:${account}`, loaded.store)
            const name = `fos:participation:${digest(at)}`
            if (!readNodeValue(own, [], name)) own = writeNodeValue(own, [], name, { ...record, host: at, links: {} }, now())
            const ref = argumentRefs(own.store, headCid(own)).find(a => a.name === name)!
            record.account = { owner: account, ref: content(own.store, ref.cid).data.alias!.id }
            if (account !== at.owner) await save(loaded.user, own)
          }
          r = writeParticipation(r, at.path, record, now())
        }
        if (headCid(r) !== beforeJoin) await save(user, r)
        if (!account) token = visitorToken(guest)
        let node = sharedProjection(r, at.path, digest, guest.peer, req.body.interaction === true)
        const own = account ? account === at.owner ? { user, store: r.store } : await deps.loadStore(account) : null
        if (own) {
          let context = createReplica(`user:${account}`, own.store)
          const before = headCid(context)
          if (account !== at.owner) context = ensureHomeContext(context, now(), deps.registry?.hostOffers())
          context = ensureSharedLink(context, at, node.title, now()).replica
          if (headCid(context) !== before) await save(own.user, context)
        }
        if (account === at.owner) node = sharedProjection(r, at.path, digest, guest.peer, req.body.interaction === true)
        const sources = own ? readNodeValue<{ links?: Record<string, string> }>(createReplica(`user:${account}`, own.store), [], `fos:participation:${digest(at)}`)?.links : undefined
        return res.json({ node: { ...node, sources, mine: participation(r, at.path, guest.peer), capabilities: ['read', 'approve', 'rank'].filter(c => participantAccess(r, at.path, guest.peer, c as 'read' | 'approve' | 'rank')) }, ...(token ? { visitorToken: token } : {}), ...(executionAddress ? { address: executionAddress } : {}), ...(entryToken ? { entryToken } : {}) })
      })
    }),
    submit: run(async (req, res) => {
      const at = address(req.body), account = username(req)
      const outcome = await locks([at.owner, ...(account ? [account] : [])], async () => {
        const { user, r: host, policy } = await load(at, account, account ? `user:${account}` : readVisitor(req.body.visitorToken, at).peer)
        const peer = account ? `user:${account}` : readVisitor(req.body.visitorToken, at).peer
        if ((policy.execution || req.body.interaction === true) && !['idle', 'rolled-back'].includes(evaluationRecord(host, at.path)?.status ?? 'idle')) throw new Failure(409, 'This execution no longer accepts input.')
        if (!participantAccess(host, at.path, peer, 'read')) throw new Failure(403, 'Join this node before submitting input.')
        const node = sharedProjection(host, at.path, digest, peer, req.body.interaction === true), body = req.body
        if (req.body.interaction === true && !policy.execution) {
          const authority = { peerId: peer, scope: at.path, capabilities: [] }
          for (const step of evaluationSteps(host, at.path)) {
            if (!nodeAuthorityAt(host, step.path, authority).includes('edit')) throw new Failure(403, 'This peer cannot execute effects on this node.')
            const fields = nodeLinkMaskAt(host, step.path, peer).fields
            if (fields && ['description', 'requirement', 'allocation'].some(field => !fields.includes(field))) throw new Failure(403, 'Masked effects cannot be executed by this peer.')
          }
        }
        if (body.revision !== node.revision) throw new Failure(409, 'The node or its options changed. Refresh and review before submitting.')
        const strings = (value: unknown, allowed: string[]) => {
          if (!Array.isArray(value) || value.length > 200 || value.some(id => typeof id !== 'string' || !allowed.includes(id)) || new Set(value).size !== value.length) throw new Failure(400, 'Invalid or duplicate choices.')
          return value as string[]
        }
        const name = account ?? (typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '')
        if (!account && node.poll && !name) throw new Failure(400, 'Please enter a display name for this poll.')
        const approvals = strings(body.approvals, [...node.proposals.map(p => p.id), ...(node.poll?.mode === 'approval' ? node.options.map(o => o.id) : [])])
        const ranking = strings(body.ranking, (node.poll?.mode === 'rank' ? node.options : node.proposals).map(o => o.id))
        if (approvals.length && !participantAccess(host, at.path, peer, 'approve')) throw new Failure(403, 'Approval input is disabled for this guest.')
        if (ranking.length && !participantAccess(host, at.path, peer, 'rank')) throw new Failure(403, 'Ranking input is disabled for this guest.')
        if (node.poll?.mode === 'rank' && ranking.length && ranking.length !== node.options.length) throw new Failure(400, 'Rank each option exactly once.')
        if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields) || Object.keys(body.fields).some(key => !node.inputs.some(f => f.key === key))) throw new Failure(400, 'Only the inputs declared on this node may be submitted.')
        const guestLoaded = account ? account === at.owner ? { user, store: host.store } : await deps.loadStore(account) : null
        if (account && !guestLoaded) throw new Failure(401, 'Guest account unavailable.')
        let guestReplica = guestLoaded ? createReplica(`user:${account}`, guestLoaded.store) : null
        const fields: Participation['fields'] = Object.create(null), links: Record<string, string> = Object.create(null)
        for (const [key, input] of Object.entries(body.fields)) {
          const field = node.inputs.find(f => f.key === key)!, submitted = input as any
          let value: unknown = submitted?.value
          if (submitted?.source !== undefined) {
            if (!guestReplica || typeof submitted.source !== 'string' || submitted.source.length > 256) throw new Failure(400, 'Linked values must belong to your signed-in context.')
            const source = resolveRef(guestReplica, submitted.source)?.row
            if (!source) throw new Failure(400, 'The linked value is unavailable.')
            value = field.kind === 'text' ? source.title : source.allocation
            links[key] = submitted.source
          }
          fields[key] = projectField(field, value)
        }
        let record: Participation = { peer, name: name || undefined, labels: Object.fromEntries([...node.options.map(o => [o.id, o.label]), ...node.proposals.map(o => [o.id, o.label]), ...node.inputs.map(f => [f.key, f.name])]), audience: policy.id, revision: node.revision, updated: now(), approvals, ranking, fields }
        if (guestReplica && guestLoaded) {
          const name = `fos:participation:${digest(at)}`
          guestReplica = writeLinkedNodeValue(guestReplica, [], name, { ...record, host: at, links }, now(), Object.fromEntries(Object.entries(links).map(([key, id]) => [key, { id }])))
          const ref = argumentRefs(guestReplica.store, headCid(guestReplica)).find(a => a.name === name)!
          record = { ...record, account: { owner: account!, ref: content(guestReplica.store, ref.cid).data.alias!.id } }
          // Guest intent is persisted first; host failure leaves retryable intent, not a fake receipt.
          if (account !== at.owner) await save(guestLoaded.user, guestReplica)
        }
        let r = writeParticipation(host, at.path, record, now())
        if (policy.execution || req.body.interaction === true) {
          const journal = evaluationRecord(r, at.path)
          if (journal && !['idle', 'rolled-back'].includes(journal.status)) throw new Failure(409, 'This execution no longer accepts input.')
          for (const [key, value] of Object.entries(fields)) {
            const field = node.inputs.find(f => f.key === key)!, target = [...at.path, ...field.path!]
            if (field.kind === 'text') {
              const proposed = proposeRefAt(r, target, put(r.store, { data: { description: { content: value as string } }, children: [] }), r.meta.peerId, now())
              r = applyProposalAt(proposed.replica, target, proposed.proposalCid, r.meta.peerId, now())
            } else if (field.direction === 'consume') r = writeNodeValue(r, target, 'fos:consumed', { peer, value, time: now() }, now())
            else if (field.kind === 'confirmation' || field.kind === 'choice') r = addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: field.kind, by: peer, ...(field.kind === 'choice' ? { choice: value as number } : {}) }, now())
            else {
              const amount = value as { amount: number; type: string; unit: string; start?: number; end?: number }, id = randomUUID()
              r = addRow(r, target, 'allocation', field.name, now(), { id, allocation: amount as any })
              r = addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: 'allocation', by: peer, ref: id }, now())
            }
          }
        }
        // the owner's standing decision: proposals that enough members approved merge now (the standard library's governance)
        const governed = applyMergePolicy(r, at.path, digest, now())
        r = governed.replica
        await save(user, r)
        const complete = (policy.execution || req.body.interaction === true) && !executionInputs(r, at.path).length
        return { peer, links, record, complete, expected: put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), at.path)!)) }
      })
      // The last input finishes the execution: the host evaluates it (its registry runs the effects, e.g. a fos-points
      // payout) outside the request's locks, since the evaluator takes the owner's lock itself.
      if (outcome.complete) {
        try {
          if (evaluate) await evaluate(at.owner, { path: at.path, branches: {}, expected: outcome.expected })
          else await withUserLock(`user:${at.owner}`, async () => { const loaded = (await deps.loadStore(at.owner))!; let r = createReplica(`user:${at.owner}`, loaded.store); await evaluateNode(at.path, { get: () => r, save: async next => { r = next; await save(loaded.user, r) }, now, check: () => [], handles: () => false }) })
        } catch (error) {
          await withUserLock(`user:${at.owner}`, async () => {
            const loaded = (await deps.loadStore(at.owner))!, r = createReplica(`user:${at.owner}`, loaded.store)
            if ((evaluationRecord(r, at.path)?.status ?? 'idle') === 'idle') await save(loaded.user, writeNodeValue(r, at.path, 'fos:evaluation', { ...(evaluationRecord(r, at.path) ?? { id: randomUUID(), status: 'idle', started: now(), effects: [] }), error: error instanceof Error ? error.message : 'Execution needs another handler.' }, now()))
          })
        }
      }
      const r = createReplica(`user:${at.owner}`, (await deps.loadStore(at.owner))!.store), { peer, links, record } = outcome
      return res.json({ node: { ...sharedProjection(r, at.path, digest, peer, req.body.interaction === true), sources: account ? links : undefined, mine: record, capabilities: ['read', 'approve', 'rank'].filter(c => participantAccess(r, at.path, peer, c as 'read' | 'approve' | 'rank')) } })
    })
  }
}
