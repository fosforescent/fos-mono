import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { addRow, addTask, content, createReplica, makeLinkAt, readProposals, setMarketAt, viewNode, resolveScope, rootTargetCid, type Replica } from '@fosforescent/shared/sync/index'
import { createSearchHandlers } from './routes'

type Saved = { user: { id: number; username: string }; store: FosStore }

function deps(stores: Record<string, Replica>) {
  const users: Record<string, number> = { alice: 1, bob: 2, carol: 3 }
  const saved: string[] = []
  const notified: Array<[number, Record<string, unknown>]> = []
  return {
    saved, notified,
    handlers: createSearchHandlers({
      prisma: {},
      embed: async (texts: string[]) => texts.map(() => [1, 0]),
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
  a = addRow(a, ['job'], 'requirement', '1h of design time', 2, { id: 'req', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' } })
  a = makeLinkAt(a, ['job'], 3)
  a = setMarketAt(a, ['job'], true, 4, 'alice')
  a = addTask(a, [], 'private: dentist', 5, 'dentist')
  return a
}

test('a bidder submits a proposal on a listed node; bidders see only their own proposal, the owner sees all', async () => {
  const alice = aliceWithListedTask()
  const d = deps({ alice, bob: createReplica('bob'), carol: createReplica('carol') })

  // not listed → bidders cannot look at it
  expect((await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'dentist' } })).status).toBe(403)

  // bob proposes: a comment plus an allocation supplied to the requirement
  const bob = await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', rows: [
    { kind: 'comment', text: 'I can do this Tuesday' },
    { kind: 'supply', text: '', under: 'req', data: { supply: { capability: 'allocation', ref: 'bob-alloc' } } }
  ] } })
  expect(bob.status).toBe(200)
  expect(d.saved).toEqual(['alice'])
  expect(d.notified[0]![0]).toBe(1)

  // carol proposes too
  const carol = await call(d.handlers.marketProposal, 'carol', { body: { owner: 'alice', aliasId: 'job', rows: [{ kind: 'comment', text: 'Cheaper here' }] } })
  expect(carol.status).toBe(200)

  // the owner's node now carries two proposals, keyed by account
  const jobCid = resolveScope(alice.store, rootTargetCid(alice.store), ['job'])!
  const ownerView = viewNode(alice.store, jobCid)
  expect(ownerView.proposals.map((p) => p.peerId).sort()).toEqual(['user:bob', 'user:carol'])
  expect(ownerView.proposals.find((p) => p.peerId === 'user:bob')!.summary.added).toEqual(['I can do this Tuesday'])
  expect(ownerView.tasks.map((t) => t.title)).toEqual(['1h of design time']) // main content untouched until the owner approves

  // bob sees his own proposal only; carol hers; alice both. No peers/members leak to bidders.
  const asBob = await call(d.handlers.marketNode, 'bob', { query: { owner: 'alice', id: 'job' } })
  expect(asBob.status).toBe(200)
  expect(asBob.json.view.proposals.map((p: any) => p.peerId)).toEqual(['user:bob'])
  expect(asBob.json.view.peers).toEqual([])
  expect(asBob.json.myProposal.status).toBe('open')
  const asCarol = await call(d.handlers.marketNode, 'carol', { query: { owner: 'alice', id: 'job' } })
  expect(asCarol.json.view.proposals.map((p: any) => p.peerId)).toEqual(['user:carol'])
  const asAlice = await call(d.handlers.marketNode, 'alice', { query: { owner: 'alice', id: 'job' } })
  expect(asAlice.json.view.proposals).toHaveLength(2)

  // the bidder's branch holds the comment and the supply under the requirement
  const bobProposal = readProposals(alice.store, content(alice.store, jobCid)).find((p) => p.peerId === 'user:bob')!
  const branch = viewNode(alice.store, bobProposal.contentCid)
  expect(branch.tasks.map((t) => [t.kind, t.title])).toEqual([['requirement', '1h of design time'], ['comment', 'I can do this Tuesday']])
  const reqInBranch = resolveScope(alice.store, bobProposal.contentCid, ['req'])!
  expect(viewNode(alice.store, reqInBranch).tasks.map((t) => t.kind)).toEqual(['supply'])

  // resubmitting replaces bob's proposal instead of adding a second one
  await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', rows: [{ kind: 'comment', text: 'Wednesday works too' }] } })
  const again = viewNode(alice.store, resolveScope(alice.store, rootTargetCid(alice.store), ['job'])!)
  expect(again.proposals.map((p) => p.peerId).sort()).toEqual(['user:bob', 'user:carol'])

  // bad input
  expect((await call(d.handlers.marketProposal, 'bob', { body: { owner: 'alice', aliasId: 'job', rows: [{ kind: 'comment', text: '' }] } })).status).toBe(400)
  expect((await call(d.handlers.marketProposal, 'alice', { body: { owner: 'alice', aliasId: 'job', rows: [{ kind: 'comment', text: 'x' }] } })).status).toBe(400)
  expect((await call(d.handlers.search, 'bob', { body: { query: '' } })).status).toBe(400)
})

test('published handler snapshots are readable globally, and disabling the offer revokes access', async () => {
  const { publishTemplate, setHandlerEnabledAt } = await import('@fosforescent/shared/sync/index')
  let alice = addRow(createReplica('alice-device'), [], 'template', 'Design', 1, { id: 'template' })
  alice = addTask(alice, ['template'], 'Draw logo', 2, 'draw')
  alice = addTask(alice, [], 'Private calendar', 3, 'private')
  alice = publishTemplate(alice, [], ['template'], 'Design service', 4, true)
  const d = deps({ alice, bob: createReplica('bob') })
  const query = { owner: 'alice', id: 'fos:published:template' }
  const opened = await call(d.handlers.marketNode, 'bob', { query })
  expect(opened.status).toBe(200)
  expect(opened.json.capability).toBe(true)
  expect(opened.json.view.tasks.map((t: { title: string }) => t.title)).toEqual(['Draw logo'])
  expect(JSON.stringify(opened.json)).not.toContain('Private calendar')
  setHandlerEnabledAt(alice, [], alice.meta.peerId, query.id, false, 5)
  expect((await call(d.handlers.marketNode, 'bob', { query })).status).toBe(404)
})
