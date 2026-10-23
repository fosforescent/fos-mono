import { syncWith, userView } from './test-helpers'
import { FosStore } from '../dag-implementation/store'
import { addRow, addTask, createBranch, createReplica, headCid, importNodes, loadReplica, mergeNodes, commitRoot, reachableNodes, renameTask, selectBranch, serializeReplica, setTaskDone, view } from './index'
import { NOTE_TYPE } from './library-types'

test('branch choices preserve the entire subtree and selection does not edit shared state', () => {
  let r = addTask(createReplica('a'), [], 'Project', 1, 'project')
  r = addTask(r, ['project'], 'Original child', 2, 'child')
  r = createBranch(r, ['project'], 'test1', 3)
  expect(userView(r)!.tasks[0]!.branches?.selected).toBe('test1')
  r = renameTask(r, [], 'project', 'Alternative project', 4)
  r = renameTask(r, ['project'], 'child', 'Alternative child', 5)
  r = setTaskDone(r, ['project'], 'child', true, 6)
  r = addRow(r, ['project','child'], NOTE_TYPE, 'Only in test1', 7)
  const head = headCid(r)
  selectBranch(r.store, 'project', 'main')
  expect(headCid(r)).toBe(head)
  expect(userView(r)!.tasks[0]!.title).toBe('Project')
  expect(view(r, ['project'])!.tasks[0]!.title).toBe('Original child')
  expect(view(r, ['project'])!.tasks[0]!.done).toBe(false)
  expect(view(r, ['project','child'])!.tasks).toHaveLength(0)
  selectBranch(r.store, 'project', 'test1')
  expect(userView(r)!.tasks[0]!.title).toBe('Alternative project')
  expect(view(r, ['project','child'])!.tasks[0]!.title).toBe('Only in test1')
})

test('devices editing different alternatives merge without changing either branch', () => {
  let a = addTask(createReplica('a'), [], 'Project', 1, 'p')
  a = createBranch(a, ['p'], 'test', 2)
  const base = headCid(a)
  let b = loadReplica(serializeReplica(a))
  selectBranch(a.store, 'p', 'test'); selectBranch(b.store, 'p', 'main')
  a = addTask(a, ['p'], 'Feature task', 3, 'feature')
  b = addTask(b, ['p'], 'Main task', 4, 'main-task')
  importNodes(a.store, reachableNodes(b.store, [headCid(b)]))
  const result = mergeNodes(a.store, base, headCid(a), headCid(b), { ours: 'a', theirs: 'b' })
  commitRoot(a.store, result.cid, 5)
  expect(result.newChoiceCids).toEqual([])
  selectBranch(a.store, 'p', 'test')
  expect(view(a, ['p'])!.tasks.map(t => t.title)).toEqual(['Feature task'])
  selectBranch(a.store, 'p', 'main')
  expect(view(a, ['p'])!.tasks.map(t => t.title)).toEqual(['Main task'])
})

test('scoped desktop sync targets its named branch and refuses an unknown checkout', () => {
  let host = addTask(createReplica('host'), [], 'Project', 1, 'p')
  host = addTask(host, ['p'], 'Main task', 2, 'task')
  host = createBranch(host, ['p'], 'test1', 3)
  let desktop = createReplica('desktop')
  desktop.meta.scope = ['p']
  const sync = (branch: string) => { desktop = syncWith(desktop, host, { at: ['p'], branches: [{ scope: ['p'], name: branch }] }) }
  sync('test1')
  desktop = renameTask(desktop, [], 'task', 'Desktop feature', 6)
  sync('test1')
  selectBranch(host.store, 'p', 'main')
  expect(view(host, ['p'])!.tasks[0]!.title).toBe('Main task')
  selectBranch(host.store, 'p', 'test1')
  expect(view(host, ['p'])!.tasks[0]!.title).toBe('Desktop feature')
  expect(() => sync('missing')).toThrow()
})

test('copy preserves every alternative and repeated merges keep later target edits', async () => {
  const { copyNode, mergeBranch } = await import('./index')
  let r = addTask(createReplica('a'), [], 'Project', 1, 'p')
  r = addTask(r, ['p'], 'Initial', 2, 'child')
  r = createBranch(r, ['p'], 'feature', 3)
  r = renameTask(r, ['p'], 'child', 'Feature', 4)
  r = mergeBranch(r, ['p'], 'feature', 'main', 5)
  r = renameTask(r, ['p'], 'child', 'Later on main', 6)
  r = mergeBranch(r, ['p'], 'feature', 'main', 7)
  expect(view(r, ['p'])!.tasks[0]!.title).toBe('Later on main')
  r = copyNode(r, [], 'p', [], { relativeTo: 'p', position: 'below' }, 8)
  const copy = userView(r)!.tasks.find(t => t.id !== 'p')!
  expect(copy.branches?.names.sort()).toEqual(['feature', 'main'])
  selectBranch(r.store, copy.id, 'feature')
  expect(view(r, [copy.id])!.tasks[0]!.title).toBe('Feature')
  selectBranch(r.store, copy.id, 'main')
  expect(view(r, [copy.id])!.tasks[0]!.title).toBe('Later on main')
})

test('repository constructors use typed refs and branch files do not collide', async () => {
  const { bindRepository, repositoryAt, branchFileName } = await import('./index')
  let r = addTask(createReplica('a'), [], 'Project', 1, 'p')
  r = bindRepository(r, ['p'], 'acme/project', 2)
  r = createBranch(r, ['p'], 'feature', 3)
  expect(repositoryAt(r, ['p'])).toBe('acme/project')
  selectBranch(r.store, 'p', 'main')
  expect(repositoryAt(r, ['p'])).toBe('acme/project')
  const names = ['feature/x', 'feature__x', 'feature%2Fx', 'feature/日本語']
  expect(new Set(names.map(branchFileName)).size).toBe(names.length)
  expect(branchFileName(names[0]!)).toBe('feature%2Fx')
})

test('default branch survives serialization and a scoped attachment pins ancestor alternatives', () => {
  let host = addTask(createReplica('host'), [], 'Project', 1, 'p')
  host = addTask(host, ['p'], 'Child', 2, 'child')
  host = createBranch(host, ['p'], 'feature', 3, 'trunk')
  host = addTask(host, ['p', 'child'], 'Feature grandchild', 4, 'grandchild')
  const restored = loadReplica(serializeReplica(host))
  expect(userView(restored)!.tasks[0]!.branches?.selected).toBe('trunk')
  // a device synced with the host, its view on the feature alternative, then attached to the child
  const feature = [{ scope: ['p'], name: 'feature' }]
  let client = syncWith(createReplica('client'), host, { branches: feature })
  // (the alternative is selected per request, not in this graph, so `isDirty`/`reattach` cannot see it: attach directly)
  client = { ...client, meta: { ...client.meta, localScope: ['p', 'child'] } }
  selectBranch(host.store, 'p', 'trunk')
  client = syncWith(client, host, { branches: feature })
  expect(view(client, ['p', 'child'])!.tasks.map(t => t.title)).toEqual(['Feature grandchild'])
  expect(view(host, ['p', 'child'])!.tasks).toHaveLength(0)
})

test('merge requests are typed children of branch constructors and survive edits, reload and removal', async () => {
  const { setBranchMergeRequest, readChoice, resolveScope, content, libAt } = await import('./index')
  let r = addTask(createReplica('a'), [], 'Project', 1, 'p')
  r = createBranch(r, ['p'], 'feature', 2)
  r = setBranchMergeRequest(r, ['p'], 'feature', true, 3)
  const choice = resolveScope(r.store, headCid(r), ['p'])!
  const record = readChoice(r.store, choice)
  expect(record.options.filter(o => o.requestMerge).map(o => o.peerId)).toEqual(['feature'])
  // the request is a row of the approve action on the branch's option: what it is, is its left
  const pointers = content(r.store, choice).children.map(e => content(r.store, e[1]))
  expect(pointers.flatMap(pointer => pointer.children).filter(([key]) => key === r.store.primitive.approveAction.getId())).toHaveLength(1)
  r = renameTask(r, [], 'p', 'Changed on feature', 4)
  r = loadReplica(serializeReplica(r))
  expect(userView(r)!.tasks[0]!.branches?.mergeRequests).toEqual(['feature'])
  selectBranch(r.store, 'p', 'main')
  expect(userView(r)!.tasks[0]!.title).toBe('Project')
  r = setBranchMergeRequest(r, ['p'], 'feature', false, 5)
  expect(userView(r)!.tasks[0]!.branches?.mergeRequests).toEqual([])
  selectBranch(r.store, 'p', 'feature')
  expect(userView(r)!.tasks[0]!.title).toBe('Changed on feature')
})

test('a merge request and a concurrent branch edit are both retained', async () => {
  const { setBranchMergeRequest } = await import('./index')
  let a = addTask(createReplica('a'), [], 'Project', 1, 'p')
  a = createBranch(a, ['p'], 'feature', 2)
  const base = headCid(a)
  let b = loadReplica(serializeReplica(a))
  selectBranch(b.store, 'p', 'feature')
  a = setBranchMergeRequest(a, ['p'], 'feature', true, 3)
  b = addTask(b, ['p'], 'Concurrent task', 4, 'task')
  importNodes(a.store, reachableNodes(b.store, [headCid(b)]))
  for (const [ours, theirs] of [[headCid(a), headCid(b)], [headCid(b), headCid(a)]] as const) {
    const result = mergeNodes(a.store, base, ours, theirs, { ours: 'a', theirs: 'b' })
    const r = { ...a }
    commitRoot(r.store, result.cid, 5)
    expect(userView(r)!.tasks[0]!.branches?.mergeRequests).toEqual(['feature'])
    expect(view(r, ['p'])!.tasks.map(t => t.title)).toEqual(['Concurrent task'])
  }
})
