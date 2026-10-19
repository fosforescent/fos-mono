import { syncWith, userView } from './test-helpers'
import { addMemberAt, addTask, commitRoot, content, createReplica, headCid, makeLinkAt, mergeNodes, nodeSyncKey, proposalContent, proposalView, put, readProposal, rejectProposalAt, renameTask, type Replica } from './index'

test('an unresolved row conflict is summarized as a change, not a deletion', () => {
  let replica = addTask(createReplica(), [], 'QA C9', 1, 'row')
  const base = headCid(replica)
  replica = renameTask(replica, [], 'row', 'Local text', 2)
  const local = headCid(replica)
  commitRoot(replica.store, base, 3)
  replica = renameTask(replica, [], 'row', 'Remote text', 4)
  const merged = mergeNodes(replica.store, base, local, headCid(replica), { ours: 'local', theirs: 'remote' })
  const proposal = readProposal(replica.store, put(replica.store, proposalContent(replica.store, 'peer', 'QA', merged.cid, base, 5)))!
  const summary = proposalView(replica.store, content(replica.store, base), proposal).summary
  expect(summary.removed).toEqual([])
  expect(summary.changed).toHaveLength(1)
})

// the host's own node: the proposer is a peer invited at its root
const invited = (server: Replica) => addMemberAt(server, [], 'proposer', 'Proposer', ['edit'], 2)
const remoteProposals = (r: Replica) => r.meta.nodeSync?.[nodeSyncKey(r.meta.serverPeerId!, [])]?.remote.proposals ?? []

test('a rejected submission stays rejected, keeps the proposer’s rows and still brings main’s changes', () => {
  const server = invited(makeLinkAt(addTask(createReplica('host'), [], 'Accepted', 1, 'accepted'), [], 2))
  let guest = createReplica('proposer')
  const sync = () => { guest = syncWith(guest, server, { invited: [] }) }
  sync()
  guest = addTask(guest, [], 'Reject me', 5, 'rejected')
  sync()
  const proposal = userView(server)!.proposals[0]!
  rejectProposalAt(server, [], proposal.id, 6)
  renameTask(server, [], 'accepted', 'Host update after rejection', 7)
  sync(); sync()
  expect(remoteProposals(guest).map(p => [p.peerId, p.status])).toEqual([['proposer', 'rejected']])
  expect(userView(guest)!.tasks.map((task) => [task.id, task.title])).toEqual([['accepted', 'Host update after rejection'], ['rejected', 'Reject me']])
  expect(userView(server)!.tasks.map((task) => task.id)).toEqual(['accepted'])
  expect(userView(server)!.proposals.map(p => p.status)).toEqual(['rejected'])
})

test('a re-submission with different content is checked again; rejected ones sit at the bottom', () => {
  const server = invited(addMemberAt(makeLinkAt(addTask(createReplica('host'), [], 'Accepted', 1, 'accepted'), [], 2), [], 'other', 'Other', ['edit'], 2))
  let guest = createReplica('proposer'), other = createReplica('other')
  const sync = () => { guest = syncWith(guest, server, { invited: [] }) }
  sync(); guest = addTask(guest, [], 'Reject me', 5, 'rejected'); sync()
  rejectProposalAt(server, [], userView(server)!.proposals[0]!.id, 6)
  other = syncWith(other, server, { invited: [] }); other = addTask(other, [], 'Other idea', 6, 'idea'); other = syncWith(other, server, { invited: [] })
  expect(userView(server)!.proposals.map(p => [p.peerId, p.status])).toEqual([['other', 'open'], ['proposer', 'rejected']])
  guest = addTask(guest, [], 'New intent', 7, 'new'); sync()
  expect(userView(guest)!.tasks.map((row) => row.id)).toEqual(['accepted', 'rejected', 'new'])
  const resubmitted = userView(server)!.proposals.find(p => p.peerId === 'proposer')!
  expect(resubmitted.status).toBe('open')
  expect(resubmitted.summary.added).toEqual(['Reject me', 'New intent'])
})
