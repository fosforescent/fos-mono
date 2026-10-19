import { syncWith, userView } from './test-helpers'
import { addMemberAt, addTask, createReplica, deleteTask, headCid, isDirty, loadReplica, serializeReplica, setMemberCapabilitiesAt, view, type Replica } from './index'
import { content, isPeerReference, resolveScope } from './graph'

// A node can exclude Fos persistence (`persist` switched off for the fos member): node sync never visits it or
// anything below it, so its content stays on the devices; the server knows only that the row exists (a reference to
// the device that holds it). Node exchange sends no history, so nothing earlier of it can leak either.

function privateGroup() {
  let r = addTask(createReplica('host'), [], 'Private group', 1, 'group')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 3)
  return addTask(r, ['group'], 'Must stay on devices', 4, 'secret')
}
const held = (r: Replica, path: string[]) => isPeerReference(content(r.store, resolveScope(r.store, headCid(r), path)!))

test('nested exclusion keeps a row the server only references while siblings sync, pushing or pulling', () => {
  let r = addTask(privateGroup(), [], 'Public sibling', 5, 'public')
  const server = createReplica('user:alice')
  for (const push of [false, true]) {
    const wire: unknown[] = []
    r = syncWith(r, server, { push, wire })
    expect(JSON.stringify(wire)).not.toContain('Must stay on devices')
    expect(JSON.stringify(wire)).not.toContain('Private group')
  }
  expect(userView(server)!.tasks.map(t => t.title)).toContain('Public sibling')
  expect(held(server, ['group'])).toBe(true)
  expect(view(r, ['group'])!.tasks[0]!.title).toBe('Must stay on devices')
  expect(isDirty(r)).toBe(false)
  r = loadReplica(serializeReplica(r))
  expect(isDirty(r)).toBe(false)
  r = addTask(r, ['group'], 'New private edit', 8, 'private2')
  expect(isDirty(r)).toBe(false)
  const wire: unknown[] = []
  syncWith(r, server, { wire })
  expect(JSON.stringify(wire)).not.toContain('New private edit')
})

test('concurrent private edits survive a sync and server sibling edits merge', () => {
  let r = privateGroup()
  const server = createReplica('user:alice')
  r = syncWith(r, server)
  addTask(server, [], 'Server edit', 7, 'public')
  r = syncWith(r, server, { during: (local) => addTask(local, ['group'], 'Concurrent private edit', 9, 'new') })
  expect(view(r, ['group'])!.tasks.map(t => t.id)).toEqual(['secret', 'new'])
  expect(userView(r)!.tasks.some(t => t.id === 'public')).toBe(true)
  const wire: unknown[] = []
  syncWith(r, server, { wire })
  expect(JSON.stringify(wire)).not.toContain('Concurrent private edit')
})

test('another device keeps the reference and can edit public siblings without erasing the holder’s data', () => {
  let host = privateGroup(), other = createReplica('other-device')
  const server = createReplica('user:alice')
  host = syncWith(host, server); other = syncWith(other, server)
  expect(held(other, ['group'])).toBe(true)
  expect(userView(other)!.tasks.find(t => t.id === 'group')!.refPeer).toBe('host')
  expect(() => addTask(other, ['group'], 'Cannot edit unavailable content', 5)).toThrow(/another peer/)
  other = addTask(other, [], 'Other sibling', 22, 'other-row')
  other = syncWith(other, server); host = syncWith(host, server)
  expect(view(host, ['group'])!.tasks[0]!.id).toBe('secret')
  expect(userView(host)!.tasks.some(t => t.id === 'other-row')).toBe(true)
})

test('switching persistence off sends the node blank: the server holds it as the device’s, the old version behind it, and re-sharing adds the next version', () => {
  let r = addTask(createReplica('host'), [], 'Previously shared', 1, 'group')
  r = addTask(r, ['group'], 'Shared child', 1, 'child')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  const server = createReplica('user:alice')
  r = syncWith(r, server)
  const shared = resolveScope(server.store, headCid(server), ['group'])!
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 5)
  r = addTask(r, ['group'], 'Never shared', 6, 'secret')
  const wire: unknown[] = []
  r = syncWith(r, server, { wire })
  expect(JSON.stringify(wire)).not.toContain('Never shared')
  expect(JSON.stringify([...server.store.table.values()])).not.toContain('Never shared')
  // like any node a peer holds: a reference to the device, with what the server had as its previous version
  expect(held(server, ['group'])).toBe(true)
  const blanked = resolveScope(server.store, headCid(server), ['group'])!
  expect(content(server.store, blanked).data.ref?.peer).toBe('host')
  expect(content(server.store, blanked).children).toEqual([[server.store.primitive.previousVersion.getId(), shared]])
  let other = syncWith(createReplica('other-device'), server)
  expect(userView(other)!.tasks.find(t => t.id === 'group')!.refPeer).toBe('host')
  // nothing more is sent while it stays private
  const again: unknown[] = []
  r = syncWith(r, server, { wire: again })
  expect(again.filter(m => (m as { path?: string[] }).path?.[0] === 'group')).toEqual([])
  // shared again: the device's content is the version after the reference
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], [], 7)
  r = syncWith(r, server)
  expect(view(server, ['group'])!.tasks.map(t => t.title)).toEqual(['Shared child', 'Never shared'])
  // its history runs back through the reference to what was shared before
  const prev = server.store.primitive.previousVersion.getId(), history: string[] = []
  for (let cid: string | undefined = resolveScope(server.store, headCid(server), ['group'])!; cid && history.length < 20; cid = content(server.store, cid).children.find(([i]) => i === prev)?.[1]) history.push(cid)
  expect(history.indexOf(blanked)).toBeGreaterThan(0)
  expect(history.indexOf(shared)).toBe(history.indexOf(blanked) + 1)
  other = syncWith(other, server)
  expect(isDirty(r)).toBe(false)
})

test('re-enabling persistence shares the current content, never what was deleted while private', () => {
  let host = privateGroup()
  const server = createReplica('user:alice')
  host = syncWith(host, server)
  host = deleteTask(host, ['group'], 'secret', 8)
  host = addTask(host, ['group'], 'Published snapshot', 9, 'shared')
  host = setMemberCapabilitiesAt(host, ['group'], 'fos', ['persist'], [], 10)
  const wire: unknown[] = []
  host = syncWith(host, server, { wire })
  expect(isDirty(host)).toBe(false)
  expect(view(server, ['group'])!.tasks.map(t => t.title)).toEqual(['Published snapshot'])
  expect(JSON.stringify(wire)).not.toContain('Must stay on devices')
  expect(JSON.stringify([...server.store.table.values()])).not.toContain('Must stay on devices')
})
