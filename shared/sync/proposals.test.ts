import { primitive } from './primitives'
import { addTask, createReplica, headCid, resolveScope, content, put, putStripped, proposalContent, readProposal, withProposal, makeLink, commitRoot, updateAtScope, refValueCid, argumentRefs, libAt, copyProposalBranch, view, selectBranch, writeNodeValue, rowEdgeAt, constructPlainRow, rowTypeAt } from './index'
import { PLAIN_TYPE } from './library-types'
function setup() {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addTask(r, ['project'], 'Main child', 2, 'main-child')
  const store = r.store, cid = resolveScope(store, headCid(r), ['project'])!, base = putStripped(store, content(store, cid))
  // Put a simple proposed subtree in the same store for the constructor's branch argument.
  const leaf = put(store, constructPlainRow(store, rowTypeAt(store, PLAIN_TYPE, []), 'proposed-child', 'Proposed child', 4))
  const branch = put(store, { data: {}, children: [rowEdgeAt(store, PLAIN_TYPE, leaf, [])] })
  const proposal = put(store, proposalContent(store, 'peer', 'Alternative', branch, base, 4))
  commitRoot(store, updateAtScope(store, headCid(r), ['project'], node => withProposal(store, makeLink(store, node, 4), 'peer', proposal, 'Alternative'), 'node'), 5)
  return { r, proposal, branch, base }
}
test('a submission is rows of the submission constructors: who sent it, the value, its base, the branch it carries', () => {
  const { r, proposal, branch, base } = setup(), store = r.store, node = content(store, proposal)
  expect(node.data.proposal).toBeUndefined()
  // no named arguments: what each row is, is its left
  expect(argumentRefs(store, proposal)).toEqual([])
  expect(node.children).toContainEqual([primitive(store, 'proposed'), branch])
  expect(node.children).toContainEqual([primitive(store, 'previous'), base])
  const sender = node.children.find(([key]) => key === primitive(store, 'sender'))![1]
  expect(content(store, sender).data.peerId?.content).toBe('peer')
  expect(readProposal(store, proposal)).toMatchObject({ peerId: 'peer', name: 'Alternative', contentCid: branch, baseCid: base, status: 'open', timestamp: 4 })
  // a rejected one says so in its data; the rest stays
  const rejected = put(store, proposalContent(store, 'peer', 'Alternative', branch, base, 4, 'rejected'))
  expect(readProposal(store, rejected)).toMatchObject({ status: 'rejected', contentCid: branch })
  // a peer's main submission carries no branch
  expect(readProposal(store, put(store, proposalContent(store, 'peer', '', branch, base, 4)))!.name).toBe('')
})
test('copying a proposed branch preserves main and the peer proposal', () => {
  let { r, proposal, branch } = setup()
  r = copyProposalBranch(r, ['project'], proposal, 'my-copy', 6)
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child'])
  r = addTask(r, ['project'], 'My edit', 7, 'local-edit')
  selectBranch(r.store, 'project', 'main')
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Project', '', 'Main child'])
  expect(readProposal(r.store, proposal)!.contentCid).toBe(branch)
  expect(readProposal(r.store, proposal)!.status).toBe('open')
  selectBranch(r.store, 'project', 'my-copy')
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child', 'My edit'])
  r = copyProposalBranch(r, ['project'], proposal, 'second-copy', 8)
  expect(view(r, ['project'])!.tasks.map(t => t.title)).toEqual(['Proposed child'])
})
