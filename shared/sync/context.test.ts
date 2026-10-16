import { contextMembers, createBranch, selectBranch, addSupply, addMemberAt, addRow, addTask, buildSyncRequest, completeSync, content, createReplica, moveNode, ensureHomeContext, findChild, headCid, HOME_ID, homePath, resetHomeContent, rowKindOf, serveSync, valueContent, view } from './index'

test('legacy rows move into Home, constructors and peers remain at root, and migration is idempotent', () => {
  let r = addTask(createReplica('device'), [], 'Existing project', 1, 'project')
  r = addRow(r, [], 'template', 'Workflow', 2, { id: 'workflow' })
  r = addMemberAt(r, [], 'other', 'Other', ['read'], 3)
  const previousProject = findChild(r.store, headCid(r), 'project')
  r = ensureHomeContext(r, 4)
  expect(homePath(r)).toEqual([HOME_ID])
  expect(view(r, [])!.tasks.find(row => row.id === HOME_ID)!.kind).toBe('plain')
  const rootMembers = content(r.store, headCid(r)).children.filter(edge => edge[0] === r.store.primitive.memberField.getId())
  const homeMembers = content(r.store, findChild(r.store, headCid(r), HOME_ID)!).children.filter(edge => edge[0] === r.store.primitive.memberField.getId())
  expect(homeMembers.some(edge => rootMembers.some(root => root[1] === edge[1]))).toBe(false)
  expect(contextMembers(r, [HOME_ID]).some(peer => peer.peerId === 'fos')).toBe(true)
  expect(view(r, [])!.tasks.map(row => row.id)).toEqual(['workflow', HOME_ID])
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['project'])
  expect(findChild(r.store, findChild(r.store, headCid(r), HOME_ID)!, 'project')).toBe(previousProject)
  expect(view(r, [])!.members.map(peer => peer.peerId)).toEqual(expect.arrayContaining(['other', 'fos']))
  const head = headCid(r)
  expect(ensureHomeContext(r, 5)).toBe(r)
  expect(headCid(r)).toBe(head)
  r = resetHomeContent(r, 6)
  expect(view(r, [HOME_ID])!.tasks).toEqual([])
  expect(view(r, [])!.tasks.map(row => row.id)).toEqual(['workflow', HOME_ID])
})

test('a synced legacy device migrates through the existing protocol without duplicating its rows', () => {
  const server = addTask(createReplica('server'), [], 'Existing', 1, 'existing')
  let client = createReplica('client')
  const sync = () => {
    const request = buildSyncRequest(client)
    const result = serveSync(server.store, request, 'server', 2)
    if ('error' in result) throw Error(result.error)
    client = completeSync(client, request, result.response, 3).replica
  }
  sync(); client = ensureHomeContext(client, 4); sync(); sync()
  expect(view(server, [])!.tasks.map(row => row.id)).toEqual([HOME_ID])
  expect(view(server, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['existing'])
})

test('scoped documents are already instances and never receive an extra Home wrapper', () => {
  const r = createReplica('scoped'); r.meta.scope = ['project']
  expect(ensureHomeContext(r, 1)).toBe(r)
  expect(homePath(r)).toEqual([])
})

test('resource demands and contributions use the same signed allocation representation and match', () => {
  let r = addTask(createReplica(), [], 'Trip', 1, 'trip')
  r = addRow(r, ['trip'], 'requirement', 'Budget', 2, { id: 'need', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
  const task = findChild(r.store, headCid(r), 'trip')!
  const demand = findChild(r.store, task, 'need')!
  expect(valueContent(r.store, demand).data.requirement).toBeUndefined()
  expect(valueContent(r.store, demand).data.allocation?.amount).toBe(-50)
  const edge = valueContent(r.store, task).children.find(e => rowKindOf(r.store, e) === 'requirement')!
  expect(edge[1]).toBe(r.store.primitive.allocationField.getId())
  r = addRow(r, ['trip', 'need'], 'allocation', 'Contribution', 3, { id: 'give', allocation: { resource: 'bank', type: 'account', amount: 50, unit: 'USD' } })
  expect(view(r, ['trip', 'need'])!.tasks[0]!.allocation?.amount).toBe(50)
  expect(view(r, ['trip'])!.tasks[0]!.requirement?.satisfied).toBe(true)
  expect(view(r, [])!.tasks[0]!.blockedBy).toBeUndefined()
})


test('legacy scoped attachment paths still update the same node beneath Home', () => {
  let server = addTask(createReplica('server'), [], 'Project', 1, 'project')
  server = ensureHomeContext(server, 0)
  let client = createReplica('attached')
  client.meta.scope = ['project']
  const sync = () => {
    const packet = buildSyncRequest(client)
    const result = serveSync(server.store, packet, 'server', 2)
    if ('error' in result) throw Error(result.error)
    expect(result.response.scope).toEqual(['project'])
    client = completeSync(client, packet, result.response, 3).replica
  }
  sync(); client = addTask(client, [], 'Child', 4, 'child'); sync()
  expect(view(server, [HOME_ID, 'project'])!.tasks[0]!.id).toBe('child')
})


test('moving rows inside the Home constructor follows its mutable value', () => {
  let r = ensureHomeContext(createReplica(), 0)
  r = addTask(r, [HOME_ID], 'First', 1, 'first')
  r = addTask(r, [HOME_ID], 'Second', 2, 'second')
  r = moveNode(r, [HOME_ID], 'second', [HOME_ID], { relativeTo: 'first', position: 'above' }, 3)
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['second', 'first'])
  r = moveNode(r, [HOME_ID], 'second', [HOME_ID], { into: 'first' }, 4)
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['first'])
  expect(view(r, [HOME_ID, 'first'])!.tasks[0]!.id).toBe('second')
})


test('handler demands and their supplied values share the same flow primitive', () => {
  let r = addTask(createReplica(), [], 'Task', 1, 'task')
  r = addRow(r, ['task'], 'requirement', 'Confirm', 2, { id: 'need', requirement: { capability: 'confirmation' } })
  r = addSupply(r, ['task'], 'need', { capability: 'confirmation', by: 'user' }, 3, 'answer')
  const task = findChild(r.store, headCid(r), 'task')!
  const need = findChild(r.store, task, 'need')!
  const answer = findChild(r.store, need, 'answer')!
  expect(valueContent(r.store, need).data.allocation?.amount).toBe(-1)
  expect(valueContent(r.store, answer).data.allocation?.amount).toBe(1)
  expect(valueContent(r.store, answer).data.supply).toBeUndefined()
  expect(view(r, ['task'])!.tasks[0]!.requirement?.satisfied).toBe(true)
  expect(view(r, ['task', 'need'])!.tasks[0]!.supply?.by).toBe('user')
})


test('legacy Home template becomes an ordinary container without losing children', () => {
  let r = addRow(createReplica(), [], 'template', 'Home', 1, { id: HOME_ID })
  r = addTask(r, [HOME_ID], 'Keep this', 2, 'child')
  r = ensureHomeContext(r, 3)
  expect(view(r, [])!.tasks.find(row => row.id === HOME_ID)!.kind).toBe('plain')
  expect(view(r, [HOME_ID])!.tasks[0].id).toBe('child')
  expect(ensureHomeContext(r, 4)).toBe(r)
})


test('Home branches survive normalization and keep their separate children', () => {
  let r = ensureHomeContext(createReplica(), 0)
  r = addTask(r, [HOME_ID], 'Original', 1, 'original')
  r = createBranch(r, [HOME_ID], 'alternative', 2)
  r = addTask(r, [HOME_ID], 'Alternative only', 3, 'extra')
  r = ensureHomeContext(r, 4)
  expect(view(r, [])!.tasks.find(row => row.id === HOME_ID)!.branches!.names).toContain('alternative')
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toContain('extra')
  selectBranch(r.store, HOME_ID, 'main')
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).not.toContain('extra')
})
