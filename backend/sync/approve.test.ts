import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { SERVER_TRANSPORT_CAPABILITIES, addMemberAt, addRow, addTask, createBranch, createReplica, ensureHomeContext, exchangeNode, makeLinkAt, nodeTreeSync, openSubmission, pullRequest, readProposals, renameTask, resolveScope, content, headCid, verifiedApprovers, view, type NodeAuthority, type NodeSyncContext, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { asAccountStore } from './deviceRoot'
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHostRuntime } from './host-runtime'
import type { AccountStoreDeps } from './accountStore'
import { identityKeyFromSeed, verifyEd25519 } from './verify'
import { approveHandler, approvedBranch } from './approve'
import { ALLOCATION_TYPE } from '@fosforescent/shared/sync/library-types'

const key = identityKeyFromSeed(Buffer.alloc(32, 9))
const PROJECT = ['proj']

function host() {
  const runtime = createHostRuntime([approveHandler(key)])
  let store = asAccountStore(new FosStore())
  const deps: AccountStoreDeps = {
    async loadStore(username) { return username === 'alice' ? { user: { id: 1, username }, store } : null },
    async saveStore(_user, next) { store = next },
    now: () => 2000, runtime
  }
  const events = createEventService(deps, createEvaluationService(deps, runtime).runNode)
  const send = async (scope: string[], event: unknown) => {
    let status = 200, body: any
    const res = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { body = b; return res } } as unknown as Response
    await events.http({ claims: { username: 'alice' }, body: { scope, event } } as unknown as Request, res)
    return { status, body }
  }
  return { send, runtime, get: () => createReplica('user:alice', store), set: (r: Replica) => { store = r.store } }
}

/** Bob, a member who proposes, sends his branch `try` of the row `f` as a pull request to alice's project. */
function pullRequested(server: Replica): Replica {
  const authority: NodeAuthority = { peerId: 'bob', scope: PROJECT, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const context: NodeSyncContext = { peer: null, scope: PROJECT, remoteRoot: PROJECT, localRoot: [], branches: [], push: true }
  const drive = (run: Generator<any, any, any>) => {
    let step = run.next()
    while (!step.done) { const served = exchangeNode(server, step.value.request, authority, 3); server = served.replica; step = run.next(served.node) }
    return step.value.replica as Replica
  }
  let bob = drive(nodeTreeSync(createReplica('bob'), context, () => 3))
  bob = createBranch(bob, ['f'], 'try', 4)
  bob = renameTask(bob, [], 'f', 'first, better', 5)
  drive(pullRequest(bob, { ...context, peer: server.meta.peerId }, ['f'], 'try', () => 6))
  return server
}

test('the branch an approve requirement names', () => {
  expect(approvedBranch('try')).toBe('try')
  expect(approvedBranch('approve: try it')).toBe('try it')
})

test('an approve requirement signs the approval into the branch, and the default rule merges it', async () => {
  const h = host()
  let r = ensureHomeContext(h.get(), 1, h.runtime.hostOffers())
  r = addTask(r, [], 'project', 1, 'proj')
  r = addTask(r, PROJECT, 'first', 2, 'f')
  r = makeLinkAt(r, PROJECT, 2)
  r = addMemberAt(r, PROJECT, 'bob', 'Bob', ['edit'], 2)
  r = pullRequested(r)
  expect(readProposals(r.store, content(r.store, resolveScope(r.store, headCid(r), PROJECT)!)).map(p => p.name)).toEqual(['try'])
  r = addRow(r, PROJECT, ALLOCATION_TYPE, 'try', 7, { id: 'ok', requirement: { capability: 'approve' } })
  h.set(r)
  const path = [...PROJECT, 'ok']
  const read = await h.send([], { kind: 'read', path })
  const done = await h.send([], { kind: 'complete', path, expected: read.body.valueRevision })
  if (!done.body.evaluation) throw new Error(`approve failed: ${JSON.stringify(done.body)}`)
  expect(done.body.evaluation.status).toBe('committed')
  r = h.get()
  // alice was the one approval the default rule asked for: the branch is main now, the submission closed
  expect(view(r, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first, better')
  expect(() => openSubmission(r, PROJECT, 'try')).toThrow()
  expect(view(r, PROJECT)!.tasks.find(t => t.id === 'ok')!.requirement).toMatchObject({ capability: 'approve', satisfied: true })
})

test('an approval the rule does not complete stays on the open branch, verifiable', async () => {
  const h = host()
  let r = ensureHomeContext(h.get(), 1, h.runtime.hostOffers())
  r = addTask(r, [], 'project', 1, 'proj')
  r = addTask(r, PROJECT, 'first', 2, 'f')
  r = makeLinkAt(r, PROJECT, 2)
  r = addMemberAt(r, PROJECT, 'bob', 'Bob', ['edit'], 2)
  r = addMemberAt(r, PROJECT, 'carol', 'Carol', ['edit'], 2)
  r = pullRequested(r)
  r = addRow(r, PROJECT, ALLOCATION_TYPE, 'approve try', 7, { id: 'ok', requirement: { capability: 'approve' } })
  h.set(r)
  const path = [...PROJECT, 'ok']
  const read = await h.send([], { kind: 'read', path })
  const done = await h.send([], { kind: 'complete', path, expected: read.body.valueRevision })
  expect(done.body.evaluation?.status).toBe('committed')
  r = h.get()
  expect(view(r, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first')
  const submission = openSubmission(r, PROJECT, 'try')
  expect(verifiedApprovers(r.store, submission.contentCid, { fos: key.publicKey }, verifyEd25519)).toEqual(['user:alice'])
})
