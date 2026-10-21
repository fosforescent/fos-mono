import { addTask, addMemberAt, createReplica, dispatchEvent, handleMcp, createBranch, selectBranch, renameTask, setMemberCapabilitiesAt, setNodeLinkMask, serializeReplica, loadReplica, type FosEvent, type Capability } from './index'
import { WORK_LEASE_MS, workClaims, saveWorkClaims } from './work-claims'

const call = (name: string, args: object = {}) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
const data = (reply: any) => reply.result.isError ? { error: reply.result.content[0].text } : JSON.parse(reply.result.content[0].text)
function fixture() {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project'), now = 10
  for (const id of ['one', 'two']) r = addTask(r, ['project'], id, 2, id)
  r = addTask(r, ['project', 'one'], 'Nested', 3, 'nested')
  for (const peer of ['a', 'b']) r = addMemberAt(r, ['project'], peer, peer, ['read', 'edit', 'execute'], 4)
  function host(peer = 'a', sessionId = peer, scope = ['project']) {
    return { owner: false, capabilities: ['read', 'edit', 'execute'] as Capability[], dispatch(event: FosEvent) {
      const out = dispatchEvent(r, event, { peerId: peer, sessionId, owner: false, scope }, now)
      r = out.replica
      return out.result
    } }
  }
  const request = (peer: string, name: string, args: object = {}, sessionId = peer) => data(handleMcp(call(name, args), host(peer, sessionId)))
  const claim = (peer = 'a', path = ['one'], branches?: Array<{ path: string[]; name: string }>, sessionId = peer) => {
    const read = request(peer, 'fos_read', { path, branches }, sessionId)
    return request(peer, 'fos_claim_task', { path, branches, expected: read.revision }, sessionId)
  }
  const list = (peer = 'a') => (handleMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, host(peer)) as any).result.tools.map((t: any) => t.name)
  return { request, claim, list, host, get: () => r, set: (next: typeof r) => { r = next }, advance: (ms: number) => { now += ms } }
}

test('exclusive claims change tools, exclude overlapping work, and pin all task operations to the task root', () => {
  const s = fixture(), claimed = s.claim(), claimId = claimed.claim.id
  expect(s.list()).toContain('fos_task_submit')
  expect(s.list()).not.toContain('fos_read')
  expect(s.list()).not.toContain('fos_await_task')
  expect(s.claim('b').error).toMatch(/already claimed/)
  expect(s.claim('b', ['one', 'nested']).error).toMatch(/overlapping/)
  expect(s.request('b', 'fos_outstanding').items.map((t: any) => t.path)).toEqual([['two']])
  expect(s.claim('b', ['two']).status).toBe('claimed')
  expect(s.request('a', 'fos_read').error).toMatch(/task-specific/)
  expect(s.request('a', 'fos_task_read', { claimId })).toMatchObject({ title: 'one', path: [], ancestors: [] })
  expect(s.request('a', 'fos_task_read', { claimId, path: ['two'] }).error).toBeDefined()
  expect(s.request('a', 'fos_task_read', { claimId, path: ['..'] }).error).toBeDefined()
  expect(s.request('b', 'fos_task_read', { claimId }).error).toMatch(/claim/)
  expect(s.request('a', 'fos_task_read', { claimId }, 'another-session').error).toMatch(/claim/)
})

test('failed submissions keep the claim; accepted proposals release it and restore tools', () => {
  const s = fixture(), claimId = s.claim().claim.id
  expect(s.request('a', 'fos_task_submit', { claimId, expected: 'stale', changes: [{ path: [], operation: 'add_note', text: 'Result' }] }).error).toMatch(/changed/)
  expect(s.list()).toContain('fos_task_submit')
  const read = s.request('a', 'fos_task_read', { claimId })
  const submitted = s.request('a', 'fos_task_submit', { claimId, expected: read.revision, changes: [{ path: [], operation: 'add_note', text: 'Implemented and tested', id: 'result' }, { path: [], operation: 'complete', done: true }] })
  expect(submitted).toMatchObject({ status: 'awaiting-review', releasedClaimId: claimId, toolsChanged: true })
  expect(s.list()).toContain('fos_await_task')
  expect(s.list()).not.toContain('fos_task_submit')
  expect(s.request('a', 'fos_task_read', { claimId }).error).toMatch(/expired|unavailable/)
  expect(s.request('a', 'fos_read', { path: ['one'] }).proposals).toHaveLength(1)
  expect(s.request('a', 'fos_read').proposals).toHaveLength(0)
})

test('claims persist, renew, expire and can be explicitly released without stale calls widening scope', () => {
  const s = fixture(), claim = s.claim().claim
  s.set(loadReplica(serializeReplica(s.get())))
  expect(s.request('a', 'fos_task_status').claim.id).toBe(claim.id)
  s.advance(1000)
  expect(s.request('a', 'fos_task_renew', { claimId: claim.id }).claim.expiresAt).toBe(claim.expiresAt + 1000)
  s.advance(WORK_LEASE_MS + 1)
  expect(s.request('a', 'fos_task_read', { claimId: claim.id }).error).toMatch(/expired/)
  expect(s.request('a', 'fos_task_status').claim).toBeNull()
  const next = s.claim('b').claim
  expect(s.request('a', 'fos_task_release', { claimId: next.id }).error).toMatch(/claim/)
  expect(s.request('b', 'fos_task_release', { claimId: next.id }).status).toBe('released')
  expect(s.claim().status).toBe('claimed')
})

test('claims are branch-specific, and later UI branch changes cannot redirect task tools', () => {
  const s = fixture()
  s.set(createBranch(s.get(), ['project'], 'feature', 5))
  s.set(renameTask(s.get(), ['project'], 'one', 'Feature one', 6))
  selectBranch(s.get().store, 'project', 'main')
  const feature = s.claim('a', ['one'], [{ path: [], name: 'feature' }])
  expect(feature.task.title).toBe('Feature one')
  const main = s.claim('b')
  expect(main.task.title).toBe('one')
  expect(s.request('a', 'fos_task_read', { claimId: feature.claim.id }).title).toBe('Feature one')
  expect(s.request('a', 'fos_task_read', { claimId: feature.claim.id, branches: [{ path: [], name: 'main' }] }).error).toMatch(/branches/)
})

test('claiming and claimed reads preserve masks and fresh descendant permission checks', () => {
  const s = fixture()
  s.set(setNodeLinkMask(s.get(), ['project'], 'a', '', { children: ['two'] }, 5))
  expect(s.claim().error).toBeDefined()
  s.set(setNodeLinkMask(s.get(), ['project'], 'a', '', { children: ['one', 'two'] }, 6))
  const claimId = s.claim().claim.id
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'a', ['read', 'edit'], [], 7))
  expect(s.request('a', 'fos_task_read', { claimId }).error).toMatch(/execute/)
  expect(s.request('a', 'fos_task_release', { claimId }).status).toBe('released')
  s.set(addMemberAt(s.get(), ['project', 'one'], 'b', 'restricted', ['read'], 8))
  expect(s.claim('b').error).toMatch(/capabilities/)
})


test('a removed branch never redirects a claimed task to main', () => {
  const s = fixture(), original = serializeReplica(s.get())
  s.set(createBranch(s.get(), ['project'], 'feature', 5))
  selectBranch(s.get().store, 'project', 'main')
  const claimId = s.claim('a', ['one'], [{ path: [], name: 'feature' }]).claim.id
  // Remove the branch definition while retaining its persisted lease.
  s.set(saveWorkClaims(loadReplica(original), workClaims(s.get(), 10), 10))
  expect(s.request('a', 'fos_task_read', { claimId }).error).toMatch(/branch is no longer available/)
  expect(s.request('a', 'fos_task_release', { claimId }).status).toBe('released')
})

test('a partially invalid owner submission rolls back all edits and keeps its lease', () => {
  const s = fixture()
  const host = { owner: true, dispatch(event: FosEvent) {
    const out = dispatchEvent(s.get(), event, { peerId: 'owner', sessionId: 'owner', owner: true, scope: ['project'] }, 10)
    s.set(out.replica); return out.result
  } }
  const request = (name: string, args: object = {}) => data(handleMcp(call(name, args), host))
  const task = request('fos_read', { path: ['one'] })
  const claimId = request('fos_claim_task', { path: ['one'], expected: task.revision }).claim.id
  const before = s.get().store.rootNodeId
  const failure = request('fos_task_submit', { claimId, expected: task.revision, changes: [
    { path: [], operation: 'add_note', text: 'Must roll back' },
    { path: ['missing'], operation: 'rename', text: 'Invalid target' },
  ] })
  expect(failure.error).toBeDefined()
  expect(s.get().store.rootNodeId).toBe(before)
  expect(request('fos_task_status').claim.id).toBe(claimId)
  expect(request('fos_task_read', { claimId }).children).toHaveLength(1)
})
