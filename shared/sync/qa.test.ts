import { addTask, buildSyncRequest, commitRoot, completeSync, content, createReplica, discardOwnProposalAt, headCid, makeLinkAt, mergeNodes, proposalContent, proposalView, put, readProposal, rejectProposalAt, renameTask, serveSync, view } from './index'

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

test('rejected proposer changes stay rejected on sync and can be discarded without resubmission', () => {
  const server = makeLinkAt(addTask(createReplica('host'), [], 'Accepted', 1, 'accepted'), [], 2)
  let guest = createReplica('proposer')
  const sync = () => {
    const request = buildSyncRequest(guest)
    const result = serveSync(server.store, request, 'host', 3, { proposeOnly: true, peerName: 'Proposer' })
    if ('error' in result) throw new Error(result.error)
    guest = completeSync(guest, request, result.response, 4).replica
  }
  sync()
  guest = addTask(guest, [], 'Reject me', 5, 'rejected')
  sync()
  const proposal = view(server, [])!.proposals[0]!
  rejectProposalAt(server, [], proposal.id, 6)
  renameTask(server, [], 'accepted', 'Host update after rejection', 7)
  sync(); sync()
  expect(view(guest, [])!.proposals[0]!.status).toBe('rejected')
  guest = discardOwnProposalAt(guest, [], view(guest, [])!.proposals[0]!.id, 7)
  sync()
  expect(view(guest, [])!.tasks.map((task) => task.id)).toEqual(['accepted'])
  expect(view(server, [])!.proposals).toEqual([])
})

test('a new edit after rejection does not silently resubmit previously rejected rows', () => {
  const server = makeLinkAt(addTask(createReplica('host'), [], 'Accepted', 1, 'accepted'), [], 2)
  let guest = createReplica('proposer')
  const sync = () => {
    const packet = buildSyncRequest(guest)
    const result = serveSync(server.store, packet, 'host', 3, { proposeOnly: true, peerName: 'Proposer' })
    if ('error' in result) throw new Error(result.error)
    guest = completeSync(guest, packet, result.response, 4).replica
  }
  sync(); guest = addTask(guest, [], 'Reject me', 5, 'rejected'); sync()
  rejectProposalAt(server, [], view(server, [])!.proposals[0]!.id, 6); sync()
  guest = addTask(guest, [], 'New intent', 7, 'new'); sync()
  expect(view(guest, [])!.tasks.map((row) => row.id)).toEqual(['accepted', 'new'])
  expect(view(server, [])!.proposals[0]!.summary.added).toEqual(['New intent'])
})
