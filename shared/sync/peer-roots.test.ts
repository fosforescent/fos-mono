import { addTask, buildSyncRequest, completeSync, createReplica, ensureHomeContext, headCid, HOME_ID, isDirty, loadReplica, serializeReplica, serveSync, shareHome, view, writeNodeValue, type Replica } from './index'

function device(id: string): Replica {
  let r = ensureHomeContext(createReplica(id), 1)
  r = addTask(r, [], `${id} private settings`, 2, `settings-${id}`)
  return shareHome(r)
}
function exchange(client: Replica, server: Replica): Replica {
  const request = buildSyncRequest(client)
  expect(request.scope).toEqual([HOME_ID])
  expect(JSON.stringify(request.nodes)).not.toContain('private settings')
  const result = serveSync(server.store, request, 'fos', 10)
  if ('error' in result) throw new Error(result.error)
  expect(JSON.stringify(result.response.nodes)).not.toContain('server private')
  return completeSync(client, request, result.response, 11).replica
}
test('two devices and a server keep independent roots while sharing Home and its merge base', () => {
  let server = ensureHomeContext(createReplica('fos'), 1)
  server = addTask(server, [], 'server private', 2, 'server-settings')
  server = writeNodeValue(server, [], 'fos:server-secret', 'not shared', 3)
  let a = addTask(device('a'), [HOME_ID], 'Shared task', 4, 'shared')
  a = exchange(a, server)
  let b = exchange(device('b'), server)
  expect(view(b, [HOME_ID])!.tasks.some(t => t.id === 'shared')).toBe(true)
  expect(view(b, [])!.tasks.map(t => t.id)).toContain('settings-b')
  expect(view(b, [])!.tasks.map(t => t.id)).not.toContain('settings-a')
  expect(view(server, [])!.tasks.map(t => t.id)).not.toContain('settings-a')
  b = loadReplica(serializeReplica(b))
  expect(b.meta.localScope).toEqual([HOME_ID])
  expect(isDirty(b)).toBe(false)
  b = addTask(b, [], 'another private setting', 5, 'private')
  expect(isDirty(b)).toBe(false)
  b = addTask(b, [HOME_ID], 'From b', 6, 'b-task')
  b = exchange(b, server); a = exchange(a, server)
  expect(view(a, [HOME_ID])!.tasks.some(t => t.id === 'b-task')).toBe(true)
})

test('in-flight Home edits merge without overwriting concurrent private root edits', () => {
  let a = device('a'), server = ensureHomeContext(createReplica('fos'), 1)
  a = exchange(a, server)
  const request = buildSyncRequest(a)
  server = addTask(server, [HOME_ID], 'Remote', 20, 'remote')
  const result = serveSync(server.store, request, 'fos', 21)
  if ('error' in result) throw new Error(result.error)
  a = addTask(a, [], 'Local setting during sync', 22, 'setting')
  a = addTask(a, [HOME_ID], 'Local task during sync', 23, 'local')
  a = completeSync(a, request, result.response, 24).replica
  expect(view(a, [])!.tasks.some(t => t.id === 'setting')).toBe(true)
  expect(view(a, [HOME_ID])!.tasks.map(t => t.id)).toEqual(expect.arrayContaining(['remote', 'local']))
  expect(isDirty(a)).toBe(true)
})

test('migration narrows the old whole-root base and excludes root history from exports', () => {
  let a = ensureHomeContext(createReplica('a'), 1)
  a = addTask(a, [], 'private settings', 2, 'settings')
  a = { ...a, meta: { ...a.meta, baseCid: headCid(a) } }
  a = shareHome(a)
  expect(a.meta.baseCid).not.toBe(headCid(a))
  expect(isDirty(a)).toBe(false)
  expect(JSON.stringify(buildSyncRequest(a, undefined, { full: true }).nodes)).not.toContain('private settings')
})

test('reattaching to a nested shared node preserves the device root and narrows the base', async () => {
  const { reattach } = await import('./index')
  let a = addTask(device('a'), [HOME_ID], 'Project', 1, 'project')
  a = addTask(a, [HOME_ID, 'project'], 'Nested', 2, 'nested')
  const server = ensureHomeContext(createReplica('fos'), 0)
  a = exchange(a, server)
  a = reattach(a, [HOME_ID, 'project'], 3)
  expect(a.meta.localScope).toEqual([HOME_ID, 'project'])
  expect(view(a, [])!.tasks.some(t => t.id === 'settings-a')).toBe(true)
  expect(isDirty(a)).toBe(false)
  expect(buildSyncRequest(a).scope).toEqual([HOME_ID, 'project'])
  expect(JSON.stringify(buildSyncRequest(a, undefined, { full: true }).nodes)).not.toContain('private settings')
})

test('sharing Home preserves its branch constructor rather than replacing it with one alternative', async () => {
  const { createBranch, selectBranch } = await import('./index')
  let a = addTask(device('a'), [HOME_ID], 'Main task', 1, 'main-task')
  a = createBranch(a, [HOME_ID], 'alternative', 2)
  a = addTask(a, [HOME_ID], 'Alternative task', 3, 'alternative-task')
  const server = ensureHomeContext(createReplica('fos'), 0)
  a = exchange(a, server)
  let b = exchange(device('b'), server)
  selectBranch(b.store, HOME_ID, 'main')
  expect(view(b, [HOME_ID])!.tasks.map(t => t.id)).toEqual(['main-task'])
  selectBranch(b.store, HOME_ID, 'alternative')
  expect(view(b, [HOME_ID])!.tasks.map(t => t.id)).toEqual(expect.arrayContaining(['main-task', 'alternative-task']))
  b = exchange(b, server)
  expect(view(b, [])!.tasks.find(t => t.id === HOME_ID)?.branches).toBeDefined()
})

test('a private root can exclude server persistence without preventing device replication', async () => {
  const { setMemberCapabilitiesAt } = await import('./index')
  let a = device('a')
  a = setMemberCapabilitiesAt(a, [], 'fos', ['persist'], ['persist'], 3)
  expect(() => buildSyncRequest(a)).toThrow(/excluded/)
  expect(buildSyncRequest(a, undefined, { recipient: 'device' }).scope).toEqual([HOME_ID])
})
