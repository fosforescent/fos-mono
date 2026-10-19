import { syncWith, userView } from './test-helpers'
import { addTask, createReplica, ensureHomeContext, HOME_ID, isDirty, loadReplica, serializeReplica, shareHome, view, writeNodeValue, type Replica } from './index'

function device(id: string): Replica {
  let r = ensureHomeContext(createReplica(id), 1)
  r = addTask(r, [], `${id} private settings`, 2, `settings-${id}`)
  return shareHome(r)
}
function exchange(client: Replica, server: Replica, during?: (r: Replica) => Replica): Replica {
  const wire: unknown[] = []
  const next = syncWith(client, server, { wire, during })
  expect(JSON.stringify(wire)).not.toContain('private settings')
  expect(JSON.stringify(wire)).not.toContain('server private')
  expect(JSON.stringify(wire)).not.toContain('not shared')
  return next
}
test('two devices and a server keep independent roots while sharing Home', () => {
  let server = ensureHomeContext(createReplica('user:alice'), 1)
  server = addTask(server, [], 'server private', 2, 'server-settings')
  server = writeNodeValue(server, [], 'fos:server-secret', 'not shared', 3)
  let a = addTask(device('a'), [HOME_ID], 'Shared task', 4, 'shared')
  a = exchange(a, server)
  let b = exchange(device('b'), server)
  expect(view(b, [HOME_ID])!.tasks.some(t => t.id === 'shared')).toBe(true)
  expect(userView(b)!.tasks.map(t => t.id)).toContain('settings-b')
  expect(userView(b)!.tasks.map(t => t.id)).not.toContain('settings-a')
  expect(userView(server)!.tasks.map(t => t.id)).not.toContain('settings-a')
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
  let a = device('a'), server = ensureHomeContext(createReplica('user:alice'), 1)
  a = exchange(a, server)
  server = addTask(server, [HOME_ID], 'Remote', 20, 'remote')
  a = exchange(a, server, r => addTask(addTask(r, [], 'Local setting during sync', 22, 'setting'), [HOME_ID], 'Local task during sync', 23, 'local'))
  expect(userView(a)!.tasks.some(t => t.id === 'setting')).toBe(true)
  expect(view(a, [HOME_ID])!.tasks.map(t => t.id)).toEqual(expect.arrayContaining(['remote', 'local']))
  expect(isDirty(a)).toBe(true)
})

test('reattaching to a nested shared node preserves the device root and syncs only that node', async () => {
  const { reattach } = await import('./index')
  let a = addTask(device('a'), [HOME_ID], 'Project', 1, 'project')
  a = addTask(a, [HOME_ID, 'project'], 'Nested', 2, 'nested')
  a = addTask(a, [HOME_ID], 'Sibling', 2, 'sibling')
  const server = ensureHomeContext(createReplica('user:alice'), 0)
  a = exchange(a, server)
  a = reattach(a, [HOME_ID, 'project'])
  expect(a.meta.localScope).toEqual([HOME_ID, 'project'])
  expect(userView(a)!.tasks.some(t => t.id === 'settings-a')).toBe(true)
  expect(isDirty(a)).toBe(false)
  a = addTask(a, [HOME_ID], 'Outside the node', 3, 'outside')
  a = addTask(a, [HOME_ID, 'project'], 'Inside the node', 4, 'inside')
  const wire: unknown[] = []
  a = syncWith(a, server, { wire })
  expect(JSON.stringify(wire)).not.toContain('Outside the node')
  expect(view(server, [HOME_ID, 'project'])!.tasks.map(t => t.id)).toEqual(['nested', 'inside'])
  expect(view(server, [HOME_ID])!.tasks.map(t => t.id)).toEqual(['project', 'sibling'])
})

test('a private root can exclude server persistence: nothing below it reaches the server', async () => {
  const { setMemberCapabilitiesAt } = await import('./index')
  let a = addTask(device('a'), [HOME_ID], 'Kept here', 1, 'kept')
  a = setMemberCapabilitiesAt(a, [], 'fos', ['persist'], ['persist'], 3)
  const server = ensureHomeContext(createReplica('user:alice'), 0)
  const wire: unknown[] = []
  a = syncWith(a, server, { wire })
  expect(wire).toEqual([])
  expect(view(server, [HOME_ID])!.tasks).toEqual([])
  expect(view(a, [HOME_ID])!.tasks.map(t => t.id)).toEqual(['kept'])
})
