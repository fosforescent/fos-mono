import type { Request, Response } from 'express'
import { publishedTemplateId } from '@fosforescent/shared/sync/index'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { MARKET_PEER, addAllocation, addRequirement, addMemberAt, addRow, addTask, content, copyBidRow, createReplica, draftBid, readProposals, removeMemberAt, setMarketAt, setMemberCapabilitiesAt, viewNode, resolveScope, rootTargetCid, type Replica } from '@fosforescent/shared/sync/index'
import { createMarketHandlers } from './routes'
import { COMMENT_TYPE, TEMPLATE_TYPE, PATTERN_TYPE } from '@fosforescent/shared/sync/library-types'
import { TASK_TYPE } from '@fosforescent/shared/sync/library-types'

type Saved = { user: { id: number; username: string }; store: FosStore }

function deps(stores: Record<string, Replica>) {
  const users: Record<string, number> = { alice: 1, bob: 2, carol: 3 }
  const saved: string[] = []
  const notified: Array<[number, Record<string, unknown>]> = []
  return {
    saved, notified,
    handlers: createMarketHandlers({
      async loadStore(username: string): Promise<Saved | null> {
        const r = stores[username]
        return r ? { user: { id: users[username]!, username }, store: r.store } : null
      },
      async saveStore(user) { saved.push(user.username) },
      withUserLock: (_k, fn) => fn(),
      notify: (id, m) => { notified.push([id, m]) },
      now: () => 1000
    })
  }
}

function call(handler: (req: Request, res: Response) => Promise<Response>, me: string, { query = {}, body = {} }: { query?: Record<string, string>; body?: unknown } = {}) {
  let status = 200
  let json: any
  const res = { status(c: number) { status = c; return res }, json(v: unknown) { json = v; return res } } as unknown as Response
  const req = { claims: { username: me, kind: 'user' }, query, body } as unknown as Request
  return handler(req, res).then(() => ({ status, json }))
}

function aliceWithListedTask(): Replica {
  let a = createReplica('alice-device')
  a = addTask(a, [], 'design a logo for the bakery', 1, 'job')
  a = addRequirement(a, ['job'], '1h of design time', 2, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' }, 'req')
  a = addTask(a, ['job'], 'brief', 3, 'brief')
  a = setMarketAt(a, ['job'], true, 4)
  a = addTask(a, [], 'private: dentist', 5, 'dentist')
  return a
}

/** A bid as the web client builds it: rows in a draft of the bidder's own tree, sent as JSON. */
const wire = (bid: unknown) => JSON.parse(JSON.stringify(bid))
const comment = (bidder: string, text: string, now = 10) => wire(draftBid(createReplica(bidder), [], now, d => addRow(d, [], COMMENT_TYPE, text, now)))

test('a bidder proposes on a node the market lists; bidders see only their own proposal, the owner sees all', async () => {
  const alice = aliceWithListedTask()
  const d = deps({ alice, bob: createReplica('bob'), carol: createReplica('carol') })

  // not listed → bidders cannot look at it; a row below a listed node is listed with it
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'dentist' } })).status).toBe(403)
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'brief' } })).status).toBe(200)

  // bob proposes: a comment plus his offered allocation under the requirement (a bid of rows he built, of whatever kind)
  const bid = draftBid(createReplica('bob'), [], 10, r => {
    r = addRow(r, [], COMMENT_TYPE, 'I can do this Tuesday', 10)
    return addAllocation(r, [], 'Tuesday hour', 10, { resource: '', type: 'calendar', amount: 1, unit: 'h', by: 'bob' }, { id: 'bob-supply' })
  }, id => id === 'bob-supply' ? ['req'] : [])
  const bob = await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', bid: wire(bid) } })
  expect(bob.status).toBe(200)
  expect(d.saved).toEqual(['alice'])
  expect(d.notified[0]![0]).toBe(1)

  // carol proposes too
  expect((await call(d.handlers.marketProposal, 'carol', { body: { owner: 'alice', aliasId: 'job', bid: comment('carol', 'Cheaper here') } })).status).toBe(200)

  // the owner's node now carries two proposals, keyed by account
  const jobCid = resolveScope(alice.store, rootTargetCid(alice.store), ['job'])!
  const ownerView = viewNode(alice.store, jobCid)
  expect(ownerView.proposals.map((p) => p.peerId).sort()).toEqual(['user:bob', 'user:carol'])
  expect(ownerView.proposals.find((p) => p.peerId === 'user:bob')!.summary.added).toEqual(['I can do this Tuesday'])
  expect(ownerView.tasks.map((t) => t.title)).toEqual(['1h of design time', 'brief']) // main content untouched until the owner approves

  // bob sees his own proposal only; carol hers; alice both. No peers/members leak to bidders.
  const asBob = await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'job' } })
  expect(asBob.status).toBe(200)
  expect(asBob.json.view.proposals.map((p: any) => p.peerId)).toEqual(['user:bob'])
  expect(asBob.json.view.peers).toEqual([])
  expect(asBob.json.view.members).toEqual([])
  expect(asBob.json.myProposal.status).toBe('open')
  const asCarol = await call(d.handlers.marketNode, 'carol', { query: { owner: 'alice', id: 'job' } })
  expect(asCarol.json.view.proposals.map((p: any) => p.peerId)).toEqual(['user:carol'])
  const asAlice = await call(d.handlers.marketNode, 'alice', { query: { owner: 'alice', id: 'job' } })
  expect(asAlice.json.view.proposals).toHaveLength(2)

  // the bidder's branch holds the comment and the supply under the requirement
  const bobProposal = readProposals(alice.store, content(alice.store, jobCid)).find((p) => p.peerId === 'user:bob')!
  const branch = viewNode(alice.store, bobProposal.contentCid)
  expect(branch.tasks.map((t) => [!!t.requirement, t.title])).toEqual([[true, '1h of design time'], [false, 'brief'], [false, 'I can do this Tuesday']])
  expect(branch.tasks.map((t) => t.type).slice(1)).toEqual([TASK_TYPE, COMMENT_TYPE])
  const reqInBranch = resolveScope(alice.store, bobProposal.contentCid, ['req'])!
  expect(viewNode(alice.store, reqInBranch).tasks.map((t) => t.allocation?.by)).toEqual(['bob'])

  // resubmitting replaces bob's proposal instead of adding a second one
  await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', bid: comment('bob', 'Wednesday works too', 11) } })
  const again = viewNode(alice.store, resolveScope(alice.store, rootTargetCid(alice.store), ['job'])!)
  expect(again.proposals.map((p) => p.peerId).sort()).toEqual(['user:bob', 'user:carol'])

  // bad input: no bid, one's own node, a supply in someone else's name
  expect((await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job' } })).status).toBe(400)
  expect((await call(d.handlers.marketProposal, 'alice', { body: { owner: 'alice', aliasId: 'job', bid: comment('alice', 'x') } })).status).toBe(400)
  const forged = draftBid(createReplica('bob'), [], 12, r => addAllocation(r, [], 'forged', 12, { resource: '', type: 'calendar', amount: 1, unit: 'h', by: 'fos' }))
  expect((await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', bid: wire(forged) } })).status).toBe(400)
})

test('the market member is the listing: switching off its edit stops proposals, removing it unlists', async () => {
  let alice = aliceWithListedTask()
  const stores: Record<string, Replica> = { alice, bob: createReplica('bob') }
  const d = deps(stores)
  stores.alice = alice = setMemberCapabilitiesAt(alice, ['job'], MARKET_PEER, ['read', 'edit'], ['edit'], 6)
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'job' } })).status).toBe(200)
  expect((await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', bid: comment('bob', 'hi') } })).status).toBe(403)
  stores.alice = alice = removeMemberAt(alice, ['job'], MARKET_PEER, 7)
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'job' } })).status).toBe(403)
})

test('an account the owner made a member (edit) sends its own row as an allocation bin to an unlisted node', async () => {
  let alice = addTask(createReplica('alice-device'), [], 'inbox', 1, 'inbox')
  alice = addMemberAt(alice, ['inbox'], 'user:bob', 'bob', ['edit'], 2)
  let bob = addTask(createReplica('bob'), [], 'Deliver the logo', 3, 'bin')
  bob = addRequirement(bob, ['bin'], 'pay 5', 4, { capability: 'allocation', resource: 'account', amount: 5, unit: 'USD' })
  const d = deps({ alice, bob })
  const sent = await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'inbox', bid: wire(copyBidRow(bob, ['bin'], 5, 'bin-bob')) } })
  expect(sent.status).toBe(200)
  const inbox = content(alice.store, resolveScope(alice.store, rootTargetCid(alice.store), ['inbox'])!)
  const proposal = readProposals(alice.store, inbox).find(p => p.peerId === 'user:bob')!
  const bin = resolveScope(alice.store, proposal.contentCid, ['bin-bob'])!
  expect(viewNode(alice.store, bin).tasks.map(t => [!!t.requirement, t.title])).toEqual([[true, 'pay 5']])
  // without the grant (and unlisted) the node takes nothing
  expect((await call(d.handlers.marketProposal, 'carol', { body: { owner: 'alice', aliasId: 'inbox', bid: comment('carol', 'x') } })).status).toBe(403)
})

test('published handler snapshots are readable globally, and switching off the market offer revokes access', async () => {
  const { publishTemplate, setHandlerEnabledAt } = await import('@fosforescent/shared/sync/index')
  let alice = addRow(createReplica('alice-device'), [], TEMPLATE_TYPE, 'Design', 1, { id: 'template' })
  alice = addTask(alice, ['template'], 'Draw logo', 2, 'draw')
  alice = addTask(alice, [], 'Private calendar', 3, 'private')
  alice = publishTemplate(alice, [], ['template'], 'Design service', 4, true)
  const d = deps({ alice, bob: createReplica('bob') })
  const query = { owner: 'alice', id: publishedTemplateId(alice.meta.peerId, 'template') }
  const opened = await call(d.handlers.marketNode, 'bob', { query })
  expect(opened.status).toBe(200)
  expect(opened.json.capability).toBe(true)
  // the template's rows, besides its pattern rows (what tasks made from it accept)
  expect(opened.json.view.tasks.filter((t: { type: string }) => t.type !== PATTERN_TYPE).map((t: { title: string }) => t.title)).toEqual(['Draw logo'])
  expect(JSON.stringify(opened.json)).not.toContain('Private calendar')
  // publishing a capability does not list the context it is published in
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'private' } })).status).toBe(403)
  setHandlerEnabledAt(alice, [], MARKET_PEER, query.id, false, 5)
  expect((await call(d.handlers.marketNode, 'bob', { query })).status).toBe(404)
})
