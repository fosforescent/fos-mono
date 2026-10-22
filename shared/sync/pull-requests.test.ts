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
import { acceptSubmission, approvalsOf, attesterKey, missingApprovals, openSubmission, setMergeRule, verifyApproval } from './approvals'
import { ensureHomeContext } from './replica'
import { nodeSyncRequest } from './node-sync'
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
  const check = (payload: string, signature: string, key: string) => verify(null, Buffer.from(payload), createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'base64')]), format: 'der', type: 'spki' }), Buffer.from(signature, 'base64'))

  // the hub's account publishes the fos server's key on its member entry, as an account server does
  function pullRequested() {
    const world = { server: ensureHomeContext(setup().server, 0, { keys: { fos: raw } }) }
    let bob = drive(world, nodeTreeSync(createReplica('bob'), context(createReplica('bob')), () => 5), authority, 5)
    bob = createBranch(bob, ['f'], 'try', 6)
    bob = renameTask(bob, [], 'f', 'first, better', 7)
    bob = drive(world, pullRequest(bob, context(bob), ['f'], 'try', () => 8), authority, 8)
    const attester = { key: attesterKey(world.server, 'fos')!, sign: (payload: string) => sign(null, Buffer.from(payload), privateKey).toString('base64') }
    return { world, bob, attester, proposal: () => openSubmission(world.server, PROJECT, 'try') }
  }

  test("by default the owner approving a member's pull request merges it into main", () => {
    const { world, proposal } = pullRequested()
    expect(missingApprovals(world.server, PROJECT, proposal().cid)).toEqual(['user:alice'])
    const accepted = acceptSubmission(world.server, PROJECT, proposal().cid, 'user:alice', 10)
    expect(accepted).toMatchObject({ merged: true, missing: [] })
    world.server = accepted.replica
    expect(view(world.server, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first, better')
    expect(proposalsAt(world.server, PROJECT).map(p => p.name)).toEqual([])
  })

  test('an approval is a row of the submission, attested for others, and anyone can check the attestation', () => {
    const { world, proposal, attester } = pullRequested()
    world.server = setMergeRule(world.server, PROJECT, ['user:alice', 'carol'], 9)
    const first = acceptSubmission(world.server, PROJECT, proposal().cid, 'carol', 10, { attester })
    expect(first).toMatchObject({ merged: false, missing: ['user:alice'] })
    world.server = first.replica
    const [approval] = approvalsOf(world.server.store, proposal().cid)
    expect(approval).toMatchObject({ approver: 'carol', signature: { key: attester.key } })
    // it checks against the key the hub publishes, over this content only
    expect(verifyApproval(world.server, proposal().contentCid, approval!, check)).toBe(true)
    expect(verifyApproval(world.server, put(world.server.store, { data: {}, children: [] }), approval!, check)).toBe(false)
    expect(verifyApproval(world.server, proposal().contentCid, { ...approval!, approver: 'mallory' }, check)).toBe(false)
  })

  test('the group defines its rule as an approveMerge row: every approver it names', () => {
    const { world, proposal, attester } = pullRequested()
    world.server = setMergeRule(world.server, PROJECT, ['user:alice', 'carol'], 9)
    expect(missingApprovals(world.server, PROJECT, proposal().cid)).toEqual(['user:alice', 'carol'])
    world.server = acceptSubmission(world.server, PROJECT, proposal().cid, 'user:alice', 10).replica
    expect(missingApprovals(world.server, PROJECT, proposal().cid)).toEqual(['carol'])
    expect(view(world.server, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first')
    const last = acceptSubmission(world.server, PROJECT, proposal().cid, 'carol', 11, { attester })
    expect(last.merged).toBe(true)
    expect(view(last.replica, PROJECT)!.tasks.find(t => t.id === 'f')!.title).toBe('first, better')
  })

  test('the proposer sees who approved its pull request', () => {
    const { world, bob, attester, proposal } = pullRequested()
    world.server = setMergeRule(world.server, PROJECT, ['user:alice', 'carol'], 9)
    world.server = acceptSubmission(world.server, PROJECT, proposal().cid, 'carol', 10, { attester }).replica
    const served = exchangeNode(world.server, { peerId: 'bob', scope: PROJECT, path: [], linkId: nodeSyncRequest(bob, [], world.server.meta.peerId, PROJECT, []).linkId }, authority, 11)
    expect(served.node.proposals?.find(p => p.name === 'try')?.approvals?.map(a => a.approver)).toEqual(['carol'])
  })
})
