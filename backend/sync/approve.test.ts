import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { SERVER_TRANSPORT_CAPABILITIES, addMemberAt, addTask, approvalsOf, createBranch, createReplica, ensureHomeContext, exchangeNode, makeLinkAt, nodeTreeSync, openSubmission, pullRequest, setMergeRule, renameTask, verifyApproval, view, type NodeAuthority, type NodeSyncContext, type Replica } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { asAccountStore } from './deviceRoot'
import { createEventService } from './events'
import { createEvaluationService } from './evaluation'
import { createHostRuntime } from './host-runtime'
import type { AccountStoreDeps } from './accountStore'
import { identityKeyFromSeed, verifyEd25519, verifyHandler } from './verify'
import { approveHandler } from './approve'

const key = identityKeyFromSeed(Buffer.alloc(32, 9))
const PROJECT = ['proj']

/** Alice's account on a host whose `approve` handler attests approvals (and whose key `verify` publishes). */
function host() {
  const runtime = createHostRuntime([verifyHandler({ findUser: async () => null }, key), approveHandler(key)])
  let store = asAccountStore(new FosStore())
  const deps: AccountStoreDeps = {
    async loadStore(username) { return username === 'alice' ? { user: { id: 1, username }, store } : null },
    async saveStore(_user, next) { store = next },
    now: () => 2000, runtime
  }
  const events = createEventService(deps, createEvaluationService(deps, runtime).runNode)
  return { events, runtime, get: () => createReplica('user:alice', store), set: (r: Replica) => { store = r.store } }
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

test("a member's approval is recorded and attested by the server; the owner's completes the group's rule", async () => {
  const h = host()
  let r = ensureHomeContext(h.get(), 1, h.runtime.hostOffers())
  r = addTask(r, [], 'project', 1, 'proj')
  r = addTask(r, PROJECT, 'first', 2, 'f')
  r = makeLinkAt(r, PROJECT, 2)
  r = addMemberAt(r, PROJECT, 'bob', 'Bob', ['edit'], 2)
  r = addMemberAt(r, PROJECT, 'user:carol', 'Carol', ['edit'], 2)
  // the group asks for both alice's and carol's approval
  h.set(setMergeRule(pullRequested(r), PROJECT, ['user:alice', 'user:carol'], 2))
  const proposal = () => openSubmission(h.get(), PROJECT, 'try')
  // carol decides on alice's node: her approval, attested with the server's key
  const carol = await h.events.handle({ username: 'alice', peerId: 'user:carol', owner: false, scope: PROJECT }, { kind: 'decide', path: [], proposalId: proposal().cid, decision: 'approve' }) as { merged: boolean; missing: string[] }
  expect(carol).toMatchObject({ merged: false, missing: ['user:alice'] })
  const [approval] = approvalsOf(h.get().store, proposal().cid)
  expect(approval!.approver).toBe('user:carol')
  expect(verifyApproval(h.get(), proposal().contentCid, approval!, verifyEd25519)).toBe(true)
  // the owner's approval is this store's own: no attestation, and the rule now holds
  const alice = await h.events.handle({ username: 'alice', peerId: 'user:alice', owner: true, scope: [] }, { kind: 'decide', path: PROJECT, proposalId: proposal().cid, decision: 'approve' }) as { merged: boolean }
  expect(alice.merged).toBe(true)
  expect(view(h.get(), PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first, better')
})
