/**
 * A pull request: a proposing peer's branch of a row reaches the owner as its own submission (`branch:<name>`), beside
 * the peer's ordinary `node-sync` submission, and the peer's main state with the owner stays as it was.
 */
import { userView } from './test-helpers'
import { SERVER_TRANSPORT_CAPABILITIES, readProposals, content, resolveScope, valueContent, identityCid, type Scope } from './graph'
import { plainEdge } from './patterns'
import { addMemberAt, addTask, createReplica, headCid, renameTask, view, type Replica } from './replica'
import { createBranch, setBranchMergeRequest } from './branches'
import { selectBranch } from './graph'
import { makeLinkAt, put } from './index'
import { approveSubmission, approvalId, approvalSubject, mergeIfApproved, mergeRule, missingApprovals, openSubmission, readApprovals, setMergeRule, verifiedApprovers, withApproval } from './approvals'
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import { exchangeNode, nodeTreeSync, pullRequest, type NodeAuthority, type NodeRequest, type ProvidedNode, type NodeSyncContext } from './index'

const PROJECT: Scope = ['proj']

function setup() {
  let server = createReplica('user:alice')
  server = addTask(server, [], 'project', 1, 'proj')
  server = addTask(server, PROJECT, 'first', 2, 'f')
  server = makeLinkAt(server, PROJECT, 3)
  server = addMemberAt(server, PROJECT, 'bob', 'Bob', ['edit'], 4)
  return { server }
}

type Run = Generator<{ request: NodeRequest; replica: Replica }, { replica: Replica; peer: string | null }, ProvidedNode>
function drive(world: { server: Replica }, run: Run, authority: NodeAuthority, now: number): Replica {
  let step = run.next()
  while (!step.done) {
    const served = exchangeNode(world.server, step.value.request, authority, now)
    world.server = served.replica
    step = run.next(served.node)
  }
  return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: step.value.peer } }
}

const authority: NodeAuthority = { peerId: 'bob', scope: PROJECT, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
const context = (r: Replica): NodeSyncContext => ({ peer: r.meta.serverPeerId ?? null, scope: PROJECT, remoteRoot: PROJECT, localRoot: [], branches: [], push: true })


test("a peer's branch reaches the owner as its own submission, and main stays as it was", () => {
  const world = setup()
  let bob = drive(world, nodeTreeSync(createReplica('bob'), context(createReplica('bob')), () => 5), authority, 5)
  expect(userView(bob)!.tasks.map(t => t.title)).toEqual(['first'])

  bob = createBranch(bob, ['f'], 'try', 6)
  bob = renameTask(bob, [], 'f', 'first, better', 7)
  bob = drive(world, pullRequest(bob, context(bob), ['f'], 'try', () => 8), authority, 8)

  // the owner's main is untouched; the branch is a submission named after it
  expect(view(world.server, PROJECT)!.tasks.map(t => t.title)).toEqual(['first'])
  const proposals = [...proposalsAt(world.server, PROJECT), ...proposalsAt(world.server, [...PROJECT, 'f'])]
  expect(proposals.map(p => [p.peerId, p.name])).toEqual([['bob', 'try']])
  const proposed = valueContent(world.server.store, proposals[0]!.contentCid)
  const row = valueContent(world.server.store, identityCid(world.server.store, plainEdge(world.server.store, proposed.children[0]!)))
  expect(row.data.description?.content).toBe('first, better')

  // bob's own selection is back where it was; on main, a plain sync proposes nothing of the branch
  expect(userView(bob)!.tasks[0]!.branches?.selected).toBe('try')
  selectBranch(bob.store, 'f', 'main')
  bob = drive(world, nodeTreeSync(bob, context(bob), () => 9), authority, 9)
  const after = [...proposalsAt(world.server, PROJECT), ...proposalsAt(world.server, [...PROJECT, 'f'])]
  expect(after.map(p => p.name)).toEqual(['try'])
})

function proposalsAt(r: Replica, at: Scope) {
  const cid = resolveScope(r.store, headCid(r), at)
  return cid ? readProposals(r.store, content(r.store, cid)) : []
}

test('a branch marked for merge goes as its pull request with every sync', () => {
  const world = setup()
  let bob = drive(world, nodeTreeSync(createReplica('bob'), context(createReplica('bob')), () => 5), authority, 5)
  bob = createBranch(bob, ['f'], 'try', 6)
  bob = renameTask(bob, [], 'f', 'first, better', 7)
  selectBranch(bob.store, 'f', 'main')
  bob = setBranchMergeRequest(bob, ['f'], 'try', true, 8)
  bob = drive(world, nodeTreeSync(bob, context(bob), () => 9), authority, 9)
  expect(proposalsAt(world.server, PROJECT).map(p => p.name)).toEqual(['try'])
  expect(view(world.server, PROJECT)!.tasks.map(t => t.title)).toEqual(['first'])
})

test('an owner\'s named submission is a proposal too, never a write to main', () => {
  const world = setup()
  const owner: NodeAuthority = { peerId: 'laptop', scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const ownerContext: NodeSyncContext = { peer: null, scope: [], remoteRoot: [], localRoot: [], branches: [], push: true }
  let laptop = drive(world, nodeTreeSync(createReplica('laptop'), ownerContext, () => 5), owner, 5)
  laptop = createBranch(laptop, ['proj', 'f'], 'try', 6)
  laptop = renameTask(laptop, ['proj'], 'f', 'owner try', 7)
  laptop = drive(world, pullRequest(laptop, { ...ownerContext, peer: laptop.meta.serverPeerId ?? null }, ['proj', 'f'], 'try', () => 8), owner, 8)
  expect(view(world.server, PROJECT)!.tasks.map(t => t.title)).toEqual(['first'])
  expect(proposalsAt(world.server, []).map(p => p.name)).toEqual(['try'])
})

describe('approvals and the merge rule', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const raw = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(-32).toString('base64')
  const signer = { by: 'fos', sign: (payload: string) => sign(null, Buffer.from(payload), privateKey).toString('base64') }
  const check = (payload: string, signature: string, key: string) => verify(null, Buffer.from(payload), createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'base64')]), format: 'der', type: 'spki' }), Buffer.from(signature, 'base64'))
  const keys = { fos: raw }

  function pullRequested() {
    const world = setup()
    let bob = drive(world, nodeTreeSync(createReplica('bob'), context(createReplica('bob')), () => 5), authority, 5)
    bob = createBranch(bob, ['f'], 'try', 6)
    bob = renameTask(bob, [], 'f', 'first, better', 7)
    bob = drive(world, pullRequest(bob, context(bob), ['f'], 'try', () => 8), authority, 8)
    return { world, bob }
  }

  test('by default the owner approves a member\'s pull request, and it merges into main', () => {
    const { world } = pullRequested()
    expect(missingApprovals(world.server, PROJECT, 'try', keys, check)).toEqual(['user:alice'])
    expect(mergeIfApproved(world.server, PROJECT, 'try', keys, check, 9).merged).toBe(false)

    world.server = approveSubmission(world.server, PROJECT, 'try', 'user:alice', signer, 10)
    // the approval is a row of the branch, signed over what it approves
    const submission = openSubmission(world.server, PROJECT, 'try')
    expect(readApprovals(world.server.store, submission.contentCid).map(a => [a.approver, a.by])).toEqual([['user:alice', 'fos']])
    expect(verifiedApprovers(world.server.store, submission.contentCid, keys, check)).toEqual(['user:alice'])
    // another key does not vouch for it
    expect(verifiedApprovers(world.server.store, submission.contentCid, { fos: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }, check)).toEqual([])

    const merged = mergeIfApproved(world.server, PROJECT, 'try', keys, check, 11)
    expect(merged).toMatchObject({ merged: true, missing: [] })
    world.server = merged.replica
    expect(view(world.server, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first, better')
    expect(proposalsAt(world.server, PROJECT).map(p => p.name)).toEqual([])
  })

  test('an approval stops counting when the branch changes after it', () => {
    const { world } = pullRequested()
    world.server = approveSubmission(world.server, PROJECT, 'try', 'user:alice', signer, 10)
    const submission = openSubmission(world.server, PROJECT, 'try')
    // the same approval row on other content: its subject no longer matches
    const [approval] = readApprovals(world.server.store, submission.contentCid)
    const other = withApproval(world.server.store, put(world.server.store, { data: { description: { content: 'else' } }, children: [] }), approval!)
    expect(approvalSubject(world.server.store, other)).not.toBe(approval!.subject)
    expect(verifiedApprovers(world.server.store, other, keys, check)).toEqual([])
  })

  test('the group defines its rule as an approveMerge row: every approver it names', () => {
    const { world } = pullRequested()
    world.server = setMergeRule(world.server, PROJECT, ['user:alice', 'carol'], 9)
    expect(mergeRule(world.server, PROJECT)).toEqual(['user:alice', 'carol'])
    world.server = approveSubmission(world.server, PROJECT, 'try', 'user:alice', signer, 10)
    expect(mergeIfApproved(world.server, PROJECT, 'try', keys, check, 11)).toMatchObject({ merged: false, missing: ['carol'] })
    world.server = approveSubmission(world.server, PROJECT, 'try', 'carol', signer, 12)
    expect(mergeIfApproved(world.server, PROJECT, 'try', keys, check, 13).merged).toBe(true)
  })

  test('the proposer sees the approval on its branch when it syncs the pull request again', () => {
    const { world, bob: before } = pullRequested()
    world.server = approveSubmission(world.server, PROJECT, 'try', 'user:alice', signer, 10)
    const bob = drive(world, pullRequest(before, context(before), ['f'], 'try', () => 11), authority, 11)
    const submission = openSubmission(world.server, PROJECT, 'try')
    expect(verifiedApprovers(world.server.store, submission.contentCid, keys, check)).toEqual(['user:alice'])
    selectBranch(bob.store, 'f', 'try')
    expect(view(bob, [])!.tasks.map(t => t.id)).toContain(approvalId('user:alice'))
  })
})
