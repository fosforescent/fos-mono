import { addTask, buildSyncRequest, completeSync, createReplica, headCid, serveSync, view } from './index'

test('a stale server-have assumption repairs with full head and base closure while retaining local edits', () => {
  let client = createReplica('device')
  const server = createReplica('server')
  client = addTask(client, [], 'Already synced', 1, 'existing')
  const first = buildSyncRequest(client)
  const served = serveSync(server.store, first, 'server', 2)
  if ('error' in served) throw new Error(served.error)
  client = completeSync(client, first, served.response, 3).replica
  client = addTask(client, [], 'Pending local edit', 4, 'pending')
  const restoredServer = createReplica('restored')
  const delta = serveSync(restoredServer.store, buildSyncRequest(client), 'server', 5)
  expect(delta).toMatchObject({ code: 'missing-nodes' })
  if (!('error' in delta)) throw new Error('expected missing nodes')
  expect(delta.missingNodeIds?.length).toBeGreaterThan(0)
  const repair = buildSyncRequest(client, undefined, { full: true })
  expect(repair.nodes[repair.headCid]).toBeDefined()
  expect(repair.nodes[repair.baseCid!]).toBeDefined()
  const repaired = serveSync(restoredServer.store, repair, 'server', 6)
  if ('error' in repaired) throw new Error(repaired.error)
  client = completeSync(client, repair, repaired.response, 7).replica
  expect(view(client, [])!.tasks.some((t) => t.id === 'pending')).toBe(true)
  const next = serveSync(restoredServer.store, buildSyncRequest(client), 'server', 8)
  expect(next).not.toHaveProperty('error')
})

test('repair respects receive-only policy instead of pushing unsent edits', () => {
  let client = createReplica('device')
  client = addTask(client, [], 'Private unsent work', 1, 'private')
  const packet = buildSyncRequest(client, undefined, { full: true, push: false })
  expect(packet.headCid).not.toBe(headCid(client))
  expect(Object.values(packet.nodes).some((node) => node.data.alias?.id === 'private')).toBe(false)
})
