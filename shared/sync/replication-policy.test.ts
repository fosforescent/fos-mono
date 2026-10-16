import { addMemberAt, addTask, addRef, buildSyncRequest, completeSync, createBranch, createReplica, headCid, isDirty, loadReplica, selectBranch, serializeReplica, serveSync, setMemberCapabilitiesAt, view } from './index'
import { isPeerReference } from './graph'
import { content, resolveScope } from './graph'

function privateGroup() {
  let r = addTask(createReplica('host'), [], 'Private group', 1, 'group')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 3)
  return addTask(r, ['group'], 'Must stay on devices', 4, 'secret')
}

test('nested exclusion exports a peer reference while siblings sync, including full, delta, and pull', () => {
  let r = addTask(privateGroup(), [], 'Public sibling', 5, 'public')
  const server = createReplica('server')
  for (const options of [{}, { full: true }, { push: false }]) {
    const packet = buildSyncRequest(r, undefined, options)
    expect(JSON.stringify(packet.nodes)).not.toContain('Must stay on devices')
    expect(JSON.stringify(packet.nodes)).not.toContain('Private group')
  }
  const packet = buildSyncRequest(r)
  expect(JSON.stringify(packet.nodes)).toContain('Public sibling')
  const served = serveSync(server.store, packet, 'server', 6)
  if ('error' in served) throw new Error(served.error)
  expect(isPeerReference(content(server.store, resolveScope(server.store, headCid(server), ['group'])!))).toBe(true)
  expect(JSON.stringify(served.response.nodes)).not.toContain('Must stay on devices')
  r = completeSync(r, packet, served.response, 7).replica
  expect(view(r, ['group'])!.tasks[0]!.title).toBe('Must stay on devices')
  expect(isDirty(r)).toBe(false)
  r = loadReplica(serializeReplica(r))
  expect(isDirty(r)).toBe(false)
  r = addTask(r, ['group'], 'New private edit', 8, 'private2')
  const next = buildSyncRequest(r)
  expect(JSON.stringify(next.nodes)).not.toContain('New private edit')
  expect(JSON.stringify(buildSyncRequest(r, undefined, { recipient: 'device' }).nodes)).toContain('New private edit')
})

test('history, inactive branches and references into private descendants do not bypass exclusion', () => {
  let r = privateGroup()
  r = addRef(r, [], 'secret', 5)
  r = createBranch(r, ['group'], 'experiment', 6)
  for (const branch of ['main', 'experiment']) {
    selectBranch(r.store, 'group', branch)
    expect(JSON.stringify(buildSyncRequest(r, branch, { full: true }).nodes)).not.toContain('Must stay on devices')
  }

})

test('concurrent private edits survive a response and server sibling edits merge', () => {
  let r = privateGroup()
  const server = createReplica('server')
  let packet = buildSyncRequest(r)
  let served = serveSync(server.store, packet, 'server', 5)
  if ('error' in served) throw new Error(served.error)
  r = completeSync(r, packet, served.response, 6).replica
  packet = buildSyncRequest(r)
  addTask(server, [], 'Server edit', 7, 'public')
  served = serveSync(server.store, packet, 'server', 8)
  if ('error' in served) throw new Error(served.error)
  r = addTask(r, ['group'], 'Concurrent private edit', 9, 'new')
  r = completeSync(r, packet, served.response, 10).replica
  expect(view(r, ['group'])!.tasks.map(t => t.id)).toEqual(['secret', 'new'])
  expect(view(r, [])!.tasks.some(t => t.id === 'public')).toBe(true)
  const next = buildSyncRequest(r)
  expect(JSON.stringify(next.nodes)).not.toContain('Concurrent private edit')
})

test('a fresh client keeps unresolved references and can edit public siblings without erasing the owner data', () => {
  let host = privateGroup(), guest = createReplica('guest')
  const server = createReplica('server')
  function sync(r: typeof host) {
    const request = buildSyncRequest(r)
    const result = serveSync(server.store, request, 'server', 20)
    if ('error' in result) throw new Error(result.error)
    return completeSync(r, request, result.response, 21).replica
  }
  host = sync(host); guest = sync(guest)
  expect(isPeerReference(content(guest.store, resolveScope(guest.store, headCid(guest), ['group'])!))).toBe(true)
  guest = addTask(guest, [], 'Guest sibling', 22, 'guest-row')
  guest = sync(guest); host = sync(host)
  expect(view(host, ['group'])!.tasks[0]!.id).toBe('secret')
  expect(view(host, [])!.tasks.some(t => t.id === 'guest-row')).toBe(true)
})

test('revocation sanitizes previously shared server history in subsequent responses', () => {
  let r = addTask(createReplica('host'), [], 'Previously shared', 1, 'group')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  const server = createReplica('server')
  let request = buildSyncRequest(r)
  let result = serveSync(server.store, request, 'server', 3)
  if ('error' in result) throw new Error(result.error)
  r = completeSync(r, request, result.response, 4).replica
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 5)
  r = addTask(r, ['group'], 'Never shared', 6, 'secret')
  expect(JSON.stringify(buildSyncRequest(r, undefined, { full: true }).nodes)).not.toContain('Previously shared')
  request = buildSyncRequest(r)
  result = serveSync(server.store, request, 'server', 7)
  if ('error' in result) throw new Error(result.error)
  expect(JSON.stringify(result.response.nodes)).not.toContain('Previously shared')
  expect(JSON.stringify(result.response.nodes)).not.toContain('Never shared')
  expect(isPeerReference(content(server.store, resolveScope(server.store, headCid(server), ['group'])!))).toBe(true)
})

test('a direct device exchange resolves peer-held content and server sync still excludes it', () => {
  let host = privateGroup(), guest = createReplica('guest')
  const server = createReplica('server')
  const push = buildSyncRequest(host)
  const stored = serveSync(server.store, push, 'server', 1)
  if ('error' in stored) throw new Error(stored.error)
  host = completeSync(host, push, stored.response, 2).replica
  const pull = buildSyncRequest(guest)
  const shared = serveSync(server.store, pull, 'server', 3)
  if ('error' in shared) throw new Error(shared.error)
  guest = completeSync(guest, pull, shared.response, 4).replica
  expect(view(guest, [])!.tasks[0]!.refPeer).toBe('host')
  expect(() => addTask(guest, ['group'], 'Cannot edit unavailable content', 5)).toThrow(/another peer/)
  const direct = buildSyncRequest(guest, undefined, { recipient: 'device', full: true })
  const transferred = serveSync(host.store, direct, 'host', 6, { recipient: 'device' })
  if ('error' in transferred) throw new Error(transferred.error)
  guest = completeSync(guest, direct, transferred.response, 7).replica
  expect(view(guest, ['group'])!.tasks[0]!.title).toBe('Must stay on devices')
  expect(JSON.stringify(buildSyncRequest(guest, undefined, { full: true }).nodes)).not.toContain('Must stay on devices')
})

test('an excluded branched subtree remains a visible reference and disables inherited Fos handlers', async () => {
  const { discoverHandlers } = await import('./index')
  let host = createBranch(privateGroup(), ['group'], 'alternative', 8)
  const server = createReplica('server')
  const request = buildSyncRequest(host)
  const result = serveSync(server.store, request, 'server', 9, { recipient: 'server' })
  if ('error' in result) throw new Error(result.error)
  expect(view(server, [])!.tasks.find(t => t.id === 'group')?.refPeer).toBe('host')
  expect(view(server, ['group'])!.members.find(m => m.peerId === 'fos')!.disabled).toContain('persist')
  expect(discoverHandlers(server, ['group']).every(h => !h.enabled)).toBe(true)
  host = completeSync(host, request, result.response, 10).replica
  expect(view(host, [])!.tasks.find(t => t.id === 'group')!.branches!.names).toEqual(expect.arrayContaining(['main', 'alternative']))
})

test('re-enabling persistence shares the current snapshot but not deleted private history', async () => {
  const { deleteTask } = await import('./index')
  let r = privateGroup()
  r = deleteTask(r, ['group'], 'secret', 8)
  r = addTask(r, ['group'], 'Now shared', 9, 'shared')
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], [], 10)
  const packet = buildSyncRequest(r, undefined, { full: true })
  expect(JSON.stringify(packet.nodes)).toContain('Now shared')
  expect(JSON.stringify(packet.nodes)).not.toContain('Must stay on devices')
})

test('a peer reference cannot expose a version from an unrelated private local context', async () => {
  const { put, reachableNodes } = await import('./graph')
  const { restorePeerReferences } = await import('./replication')
  const r = addTask(createReplica('local'), [], 'Unrelated local secret', 1, 'secret')
  const secret = resolveScope(r.store, headCid(r), ['secret'])!
  const forged = put(r.store, { data: { alias: { id: 'secret' }, ref: { id: 'secret', peer: 'someone', version: secret } }, children: [] })
  const attachment = put(r.store, { data: {}, children: [[forged, r.store.primitive.descriptionField.getId()]] })
  const restored = restorePeerReferences(r.store, attachment, [attachment])
  expect(JSON.stringify(reachableNodes(r.store, [restored]))).not.toContain('Unrelated local secret')
})

test('re-enabled content converges through the server while old private history stays excluded', async () => {
  const { deleteTask } = await import('./index')
  let host = privateGroup()
  const server = createReplica('server')
  function sync() {
    const request = buildSyncRequest(host)
    const result = serveSync(server.store, request, 'server', 20, { recipient: 'server' })
    if ('error' in result) throw new Error(result.error)
    host = completeSync(host, request, result.response, 21).replica
  }
  sync()
  host = deleteTask(host, ['group'], 'secret', 8)
  host = addTask(host, ['group'], 'Published snapshot', 9, 'shared')
  host = setMemberCapabilitiesAt(host, ['group'], 'fos', ['persist'], [], 10)
  sync(); sync()
  expect(isDirty(host)).toBe(false)
  expect(view(server, ['group'])!.tasks[0]!.title).toBe('Published snapshot')
  expect(JSON.stringify(buildSyncRequest(host, undefined, { full: true }).nodes)).not.toContain('Must stay on devices')
})
