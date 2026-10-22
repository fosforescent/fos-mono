import { createHash, createHmac, randomUUID } from 'node:crypto'
import * as jsonwebtoken from 'jsonwebtoken'
import type { Request, Response } from 'express'
import { executionInput, servedTo } from '@fosforescent/shared/sync/index'
import { applyMergePolicy, proposeVisitorValues, nodeAuthorityAt, nodeLinkMaskAt, evaluationSteps, addMemberAt, ensureHomeContext, evaluateNode, evaluationRecord, writeEvaluationRecord, executionInputs, addRow, addSupply, proposeRefAt, applyProposalAt, addTask, instantiateTemplate, ensureSharedLink, writeParticipation, argumentRefs, content, createReplica, readNodeValue, writeLinkedNodeValue, headCid, participation, put, resolveRef, resolveScope, sharedProjection, publication, publishedTo, markExecution, mayParticipate, valueContent, view, writeNodeValue, audiencePeer, type Participation, type Replica, type Scope, type SharedInput, type SharedAddress } from '@fosforescent/shared/sync/index'
import { withUserLock, type AccountStoreDeps } from './accountStore'
import { ALLOCATION_TYPE, TEMPLATE_TYPE } from '@fosforescent/shared/sync/library-types'
void TEMPLATE_TYPE
import { MONEY_TYPE } from '@fosforescent/shared/sync/library-types'
const sign = jsonwebtoken.sign ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.sign
const verify = jsonwebtoken.verify ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.verify
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
type Address = SharedAddress
type Claims = { username?: string; kind?: string }
type Visitor = Address & { peer: string }
/** Whoever may not run (or read) a node gets the same answer as for a node that does not exist. */
const NOT_FOUND = 'Not found.'
class Failure extends Error { constructor(readonly status: number, message: string) { super(message) } }
/** A published node's address: its owner and its path there. Whether it may be visited is its membership (`publication`). */
function address(body: any): Address {
  if (!body || typeof body.owner !== 'string' || body.owner.length > 128 || !body.owner || !Array.isArray(body.path) || !body.path.length || body.path.length > 32 || body.path.some((id: unknown) => typeof id !== 'string' || !id || id.length > 256)) throw new Failure(400, 'Invalid shared-node address.')
  return { owner: body.owner, path: body.path }
}
function username(req: Request): string | null { const c = (req as Request & { claims?: Claims }).claims; return c?.username && (!c.kind || c.kind === 'user') ? c.username : null }
async function locks<T>(names: string[], work: () => Promise<T>): Promise<T> {
  const keys = [...new Set(names)].sort()
  const next = (i: number): Promise<T> => i === keys.length ? work() : withUserLock(`user:${keys[i]}`, () => next(i + 1))
  return next(0)
}
/** `evaluate` is the host's evaluation service (its handler runtime runs the effects of a finished execution). */
export function createSharingHandlers(deps: AccountStoreDeps, secret: string, evaluate?: (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => Promise<unknown>) {
  if (!secret) throw new Error('Sharing requires a signing secret.')
  // A guest receipt cannot be used as an account or peer-sync JWT, even if presented to another endpoint.
  const guestSecret = createHmac('sha256', secret).update('fos:public-participation:v1').digest('hex')
  const now = () => deps.now?.() ?? Date.now()
  const visitorToken = (visitor: Visitor) => sign(visitor, guestSecret, { algorithm: 'HS256', audience: 'fos-public-input', expiresIn: '30d' })
  const readVisitor = (token: unknown, at: Address): Visitor => {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw Error()
      const claims = verify(token, guestSecret, { algorithms: ['HS256'], audience: 'fos-public-input' }) as Visitor
      if (claims.owner !== at.owner || JSON.stringify(claims.path) !== JSON.stringify(at.path) || typeof claims.peer !== 'string' || !claims.peer.startsWith('visitor:')) throw Error()
      return { ...at, peer: claims.peer }
    } catch { throw new Failure(404, NOT_FOUND) }
  }
  const load = async (at: Address, account: string | null, peer?: string) => {
    const loaded = await deps.loadStore(at.owner)
    if (!loaded) throw new Failure(404, 'Shared node unavailable.')
    // published = an audience peer is a member that may run (or read) it; a template run is its visitor's own
    const r = createReplica(`user:${at.owner}`, loaded.store), policy = publication(r, at.path)
    const cid = resolveScope(r.store, headCid(r), at.path)
    if (!policy || !cid) throw new Failure(404, NOT_FOUND)
    if (policy.audience === 'users' && !account) throw new Failure(404, NOT_FOUND)
    if (policy.execution) {
      if (policy.execution.peer !== peer) throw new Failure(404, NOT_FOUND)
      const entry = policy.execution.entry
      // a run lasts while its endpoint is published to the audience it was started from
      if (entry.owner !== at.owner || !publication(r, entry.path)?.template || !publishedTo(r, entry.path, policy.audience)) throw new Failure(404, NOT_FOUND)
    }
    return { ...loaded, r, policy, cid }
  }
  const save = async (user: { id: number; username: string }, r: Replica) => { await deps.saveStore(user, r.store); deps.notify?.(user.id, { type: 'sync_changed', byPeerId: 'fos:sharing' }) }
  const run = (handler: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    res.setHeader?.('Cache-Control', 'no-store')
    try { if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 65536) throw new Failure(413, 'Input is too large.'); return await handler(req, res) } catch (error) { return res.status(error instanceof Failure ? error.status : 409).json({ error: error instanceof Failure ? error.message : 'The node changed or could not be saved. Refresh and try again.' }) }
  }
  // what a visitor may do is what it falls under (itself, else its audience) holds; running the node covers its inputs and votes
  const participantAccess = (r: Replica, path: Scope, peer: string, cap: 'read' | 'edit' | 'rank') => !!publication(r, path) && mayParticipate(r, path, peer, cap)
  const projectField = (field: SharedInput, value: any): Participation['fields'][string] => {
    if (field.kind === 'confirmation') { if (value !== true) throw new Failure(400, 'Confirmation is required.'); return true }
    if (field.kind === 'choice') { if (!Number.isInteger(value) || value < 0 || value >= (field.options?.length ?? 0)) throw new Failure(400, 'Choose a declared option.'); return value }
    if (field.kind === 'text' || field.kind === 'ref') {
      if (typeof value !== 'string' || value.length > 8000) throw new Failure(400, `Invalid text for ${field.name}.`)
      return value
    }
    if (!value || typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0 || value.type !== field.type || value.unit !== field.unit || (field.start !== undefined && (typeof value.start !== 'number' || !Number.isFinite(value.start) || value.start > field.start)) || (field.end !== undefined && (typeof value.end !== 'number' || !Number.isFinite(value.end) || value.end < field.end))) throw new Failure(400, `The supplied allocation does not match ${field.name}.`)
    if (field.direction === 'consume' && value.amount > (field.amount ?? 0)) throw new Failure(400, 'The requested amount exceeds this allocation.')
    return { amount: value.amount, type: field.type!, unit: field.unit!, ...(field.start !== undefined ? { start: field.start } : {}), ...(field.end !== undefined ? { end: field.end } : {}) }
  }
  return {
    visit: run(async (req, res) => {
      let at = address(req.body), account = username(req)
      return locks([at.owner, ...(account ? [account] : [])], async () => {
        let guest = account ? { ...at, peer: `user:${account}` } : req.body.visitorToken ? readVisitor(req.body.visitorToken, at) : { ...at, peer: `visitor:${randomUUID()}` }
        const loaded = await load(at, account, guest.peer)
        const { user } = loaded
        let r = loaded.r, policy = loaded.policy, token: string | undefined, entryToken: string | undefined, executionAddress: Address | undefined, createdExecution = false
        const beforeJoin = headCid(r)
        if (policy.template) {
          const entry = { ...at }, key = `fos:execution:${digest([at.path, guest.peer])}`
          if (!account) entryToken = visitorToken(guest)
          executionAddress = readNodeValue<Address>(r, at.path, key) ?? undefined
          if (!executionAddress) {
            createdExecution = true
            const template = view(r, at.path.slice(0, -1))?.tasks.find(t => t.id === at.path.at(-1))
            if (template?.type !== TEMPLATE_TYPE) throw new Failure(409, 'This trigger requires a template.')
            const id = randomUUID(), parent = at.path.slice(0, -1)
            r = addTask(r, parent, template.title, now(), id)
            r = instantiateTemplate(r, parent, id, template.id, now())
            // the visitor's private run: a node whose only visitor is them
            executionAddress = { owner: at.owner, path: [...parent, id] }
            r = markExecution(r, executionAddress.path, { peer: guest.peer, entry, audience: policy.audience }, account ?? 'Anonymous guest', now())
            r = writeEvaluationRecord(r, executionAddress.path, { id: randomUUID(), status: 'idle', started: now(), effects: [] }, now())
            r = writeNodeValue(r, at.path, key, executionAddress, now())
          }
          at = executionAddress; policy = publication(r, at.path)!
          if (policy?.execution?.peer !== guest.peer) throw new Failure(404, NOT_FOUND)
          guest = { ...at, peer: guest.peer }
        }
        const member = view(r, at.path)!.members.find(m => m.peerId === guest.peer)
        if (!member) {
          if (view(r, at.path)!.members.length >= 1000) throw new Failure(409, 'This node has reached its guest limit.')
          if ((policy.execution && !createdExecution) || req.body.visitorToken && !executionAddress) throw new Failure(404, NOT_FOUND)
          r = addMemberAt(r, at.path, guest.peer, account ?? 'Anonymous guest', ['execute'], now())
        }
        if (!participantAccess(r, at.path, guest.peer, 'read')) throw new Failure(404, NOT_FOUND)
        if (!participation(r, at.path, guest.peer)) {
          let record: Participation = { peer: guest.peer, audience: audiencePeer(policy.audience), revision: '', updated: now(), approvals: [], ranking: [], fields: {} }
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
          if (account !== at.owner) context = ensureHomeContext(context, now(), deps.runtime?.hostOffers())
          context = ensureSharedLink(context, at, node.title, now()).replica
          if (headCid(context) !== before) await save(own.user, context)
        }
        if (account === at.owner) node = sharedProjection(r, at.path, digest, guest.peer, req.body.interaction === true)
        const sources = own ? readNodeValue<{ links?: Record<string, string> }>(createReplica(`user:${account}`, own.store), [], `fos:participation:${digest(at)}`)?.links : undefined
        return res.json({ node: { ...node, sources, mine: participation(r, at.path, guest.peer), capabilities: ['read', 'edit', 'rank'].filter(c => participantAccess(r, at.path, guest.peer, c as 'read' | 'edit' | 'rank')) }, ...(token ? { visitorToken: token } : {}), ...(executionAddress ? { address: executionAddress } : {}), ...(entryToken ? { entryToken } : {}) })
      })
    }),
    submit: run(async (req, res) => {
      const at = address(req.body), account = username(req)
      const outcome = await locks([at.owner, ...(account ? [account] : [])], async () => {
        const { user, r: host, policy } = await load(at, account, account ? `user:${account}` : readVisitor(req.body.visitorToken, at).peer)
        const peer = account ? `user:${account}` : readVisitor(req.body.visitorToken, at).peer
        if ((policy.execution || req.body.interaction === true) && !['idle', 'rolled-back'].includes(evaluationRecord(host, at.path)?.status ?? 'idle')) throw new Failure(409, 'This execution no longer accepts input.')
        if (!participantAccess(host, at.path, peer, 'read')) throw new Failure(404, NOT_FOUND)
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
        // approvals and rankings are of the node's open proposals; a choice is an input like any other
        const approvals = strings(body.approvals, node.proposals.map(p => p.id))
        const ranking = strings(body.ranking, node.proposals.map(o => o.id))
        if (approvals.length && !participantAccess(host, at.path, peer, 'edit')) throw new Failure(403, 'Approval input is disabled for this guest.')
        if (ranking.length && !participantAccess(host, at.path, peer, 'rank')) throw new Failure(403, 'Ranking input is disabled for this guest.')
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
        let record: Participation = { peer, name: name || undefined, labels: Object.fromEntries([...node.proposals.map(o => [o.id, o.label]), ...node.inputs.map(f => [f.key, f.name])]), audience: audiencePeer(policy.audience), revision: node.revision, updated: now(), approvals, ranking, fields }
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
            if (field.kind === 'ref') {
              r = executionInput(r, at.path, { revision: headCid(r), key, value }, peer, now(), {
                canRead: (store, _cid, path) => store === r.store && path.length >= at.path.length && at.path.every((id, index) => path[index] === id) && servedTo(r, at.path, path, peer) &&
                  (!nodeLinkMaskAt(r, path, peer)?.fields || nodeLinkMaskAt(r, path, peer)!.fields!.includes('description'))
              })
            } else if (field.kind === 'text') {
              const proposed = proposeRefAt(r, target, put(r.store, { data: { description: { content: value as string } }, children: [] }), r.meta.peerId, now())
              r = applyProposalAt(proposed.replica, target, proposed.proposalCid, r.meta.peerId, now())
            } else if (field.direction === 'consume') r = writeNodeValue(r, target, 'fos:consumed', { peer, value, time: now() }, now())
            else if (field.kind === 'confirmation' || field.kind === 'choice') r = addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: field.kind, by: peer, ...(field.kind === 'choice' ? { choice: value as number } : {}) }, now())
            else {
              const amount = value as { amount: number; type: string; unit: string; start?: number; end?: number }, id = randomUUID()
              // money is a payment: the positive money row under the request fills it
              if (amount.type === 'account') r = addRow(r, target, MONEY_TYPE, field.name, now(), { id, allocation: { ...amount, by: peer } as any })
              else {
                r = addRow(r, target, ALLOCATION_TYPE, field.name, now(), { id, allocation: amount as any })
                r = addSupply(r, target.slice(0, -1), target.at(-1)!, { capability: 'allocation', by: peer, ref: id }, now())
              }
            }
          }
        } else {
          // on the shared original, text answers to holes (missing bindings, empty fields) are this visitor's candidate values
          const candidates = Object.entries(fields).flatMap(([key, value]) => { const field = node.inputs.find(f => f.key === key)!; return field.kind === 'text' && typeof value === 'string' ? [{ path: field.path ?? [field.key], value }] : [] })
          if (candidates.length) r = proposeVisitorValues(r, at.path, peer, candidates, now())
        }
        // the owner's standing decision: proposals that enough members approved merge now (the standard library's governance)
        const governed = applyMergePolicy(r, at.path, digest, now())
        r = governed.replica
        await save(user, r)
        const complete = (policy.execution || req.body.interaction === true) && !executionInputs(r, at.path).length
        return { peer, links, record, complete, expected: put(r.store, valueContent(r.store, resolveScope(r.store, headCid(r), at.path)!)) }
      })
      // The last input finishes the execution: the host evaluates it (its runtime runs the effects, e.g. a fos-points
      // payout) outside the request's locks, since the evaluator takes the owner's lock itself.
      if (outcome.complete) {
        try {
          if (evaluate) await evaluate(at.owner, { path: at.path, branches: {}, expected: outcome.expected })
          else await withUserLock(`user:${at.owner}`, async () => { const loaded = (await deps.loadStore(at.owner))!; let r = createReplica(`user:${at.owner}`, loaded.store); await evaluateNode(at.path, { get: () => r, save: async next => { r = next; await save(loaded.user, r) }, now, check: () => [], handles: () => false }) })
        } catch (error) {
          await withUserLock(`user:${at.owner}`, async () => {
            const loaded = (await deps.loadStore(at.owner))!, r = createReplica(`user:${at.owner}`, loaded.store)
            if ((evaluationRecord(r, at.path)?.status ?? 'idle') === 'idle') await save(loaded.user, writeEvaluationRecord(r, at.path, { ...(evaluationRecord(r, at.path) ?? { id: randomUUID(), status: 'idle', started: now(), effects: [] }), error: error instanceof Error ? error.message : 'Execution needs another handler.' }, now()))
          })
        }
      }
      const r = createReplica(`user:${at.owner}`, (await deps.loadStore(at.owner))!.store), { peer, links, record } = outcome
      return res.json({ node: { ...sharedProjection(r, at.path, digest, peer, req.body.interaction === true), sources: account ? links : undefined, mine: record, capabilities: ['read', 'edit', 'rank'].filter(c => participantAccess(r, at.path, peer, c as 'read' | 'edit' | 'rank')) } })
    }),
    /** `GET /public/node/read?owner=&path=[…]`: the public projection for embeds. Nothing is written (no guest joins), so any page may show it. */
    read: run(async (req, res) => {
      const q = req.query ?? {}
      let path: unknown
      try { path = typeof q.path === 'string' && q.path.length <= 9000 ? JSON.parse(q.path) : null } catch { path = null }
      const at = address({ owner: q.owner, path })
      // a template endpoint reads as its page; a visitor's private execution starts with their first visit
      const { r } = await load(at, null)
      res.setHeader?.('Cache-Control', 'public, max-age=60')
      return res.json({ node: sharedProjection(r, at.path, digest) })
    })
  }
}
