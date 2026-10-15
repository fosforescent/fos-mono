import { addTask, createReplica, headCid, resolveScope, content, put, putStripped, proposalContent, readProposal, withProposal, makeLink, commitRoot, updateAtScope, refTypeCid, refValueCid, argumentRefs, capabilityTarget, copyProposalBranch, view, selectBranch, writeNodeValue } from './index'
function setup() {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addTask(r, ['project'], 'Main child', 2, 'main-child')
  const store = r.store, cid = resolveScope(store, headCid(r), ['project'])!, base = putStripped(store, content(store, cid))
  // Put a simple proposed subtree in the same store for the constructor's branch argument.
  const leaf = put(store, { data: { alias: { id: 'proposed-child' }, description: { content: 'Proposed child' } }, children: [] })
  const branch = put(store, { data: { description: { content: 'Proposed project' } }, children: [[leaf, store.primitive.descriptionField.getId()]] })
  const proposal = put(store, proposalContent(store, 'peer', 'Alternative', branch, base, 4))
  commitRoot(store, updateAtScope(store, headCid(r), ['project'], node => withProposal(store, makeLink(store, node, 4), 'peer', proposal, 'Alternative'), 'node'), 5)
  return { r, proposal, branch, base }
}
test('a proposal is a child mutable ref constructor with branch and merge-request arguments', () => {
  const { r, proposal, branch, base } = setup(), store = r.store, node = content(store, proposal)
  expect(node.data.proposal).toBeUndefined()
  expect(refTypeCid(store, node)).toBe(store.primitive.proposalField.getId())
  const args = argumentRefs(store, proposal)
  expect(args.map(a => a.name).sort()).toEqual(['branch', 'request merge', 'status'])
  const branchArg = content(store, args.find(a => a.name === 'branch')!.cid)
  expect(refValueCid(store, branchArg)).toBe(branch)
  expect(branchArg.children).toContainEqual([store.primitive.previousVersion.getId(), base])
  const input = args.find(a => a.name === 'request merge')!
  expect(input.type).toBe(capabilityTarget(store, 'approve'))
  expect(refValueCid(store, content(store, input.cid))).toBeNull()
  const path = ['project', node.data.alias!.id]
  expect(resolveScope(store, headCid(r), path)).toBe(proposal)
  const changed = writeNodeValue(r, path, 'status', 'rejected', 6)
  const next = resolveScope(store, headCid(changed), path)!
  expect(next).not.toBe(proposal)
  expect(readProposal(store, next)!.status).toBe('rejected')
})
test('copying a proposed branch preserves main and the peer proposal', () => {
  let { r, proposal, branch } = setup()
  r = copyProposalBranch(r, ['project'], proposal, 'my-copy', 6)
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child'])
  r = addTask(r, ['project'], 'My edit', 7, 'local-edit')
  selectBranch(r.store, 'project', 'main')
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Main child'])
  expect(readProposal(r.store, proposal)!.contentCid).toBe(branch)
  expect(readProposal(r.store, proposal)!.status).toBe('open')
  selectBranch(r.store, 'project', 'my-copy')
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child', 'My edit'])
  r = copyProposalBranch(r, ['project'], proposal, 'second-copy', 8)
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child'])
})
test('legacy proposal records remain readable', () => {
  const { r, branch, base } = setup(), s = r.store
  const text = (value: string) => put(s, { data: { description: { content: value } }, children: [] })
  const old = put(s, { data: { proposal: { status: 'rejected' } }, children: [[s.primitive.proposalNameField.getId(), text('Old')], [s.primitive.proposedContentField.getId(), branch], [s.primitive.senderField.getId(), text('peer')], [s.primitive.timestampField.getId(), text('4')], [s.primitive.previousVersion.getId(), base]] })
  expect(readProposal(s, old)).toMatchObject({ name: 'Old', status: 'rejected', contentCid: branch, baseCid: base })
})
