import { addMemberAt, addTask, buildSyncRequest, createBranch, createReplica, selectBranch, setMemberCapabilitiesAt } from './index'

test('server exclusion blocks complete and delta exports, including pull and historical versions, but permits device replication', () => {
  let r = addTask(createReplica('host'), [], 'Private group', 1, 'group')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  expect(() => buildSyncRequest(r)).not.toThrow()
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 3)
  r = addTask(r, ['group'], 'Must stay on devices', 4, 'secret')
  for (const options of [{}, { full: true }, { push: false }]) expect(() => buildSyncRequest(r, undefined, options)).toThrow(/storage is excluded/)
  const packet = buildSyncRequest(r, undefined, { recipient: 'device' })
  expect(JSON.stringify(packet.nodes)).toContain('Must stay on devices')
  // Re-enabling a visible checkbox must not silently release historical private data.
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], [], 5)
  expect(() => buildSyncRequest(r)).toThrow(/history/)
})

test('switching branch cannot bypass a storage exclusion in the exported closure', () => {
  let r = addTask(createReplica('host'), [], 'Group', 1, 'group')
  r = addMemberAt(r, ['group'], 'fos', 'fos', ['persist'], 2)
  r = createBranch(r, ['group'], 'experiment', 3)
  r = setMemberCapabilitiesAt(r, ['group'], 'fos', ['persist'], ['persist'], 4)
  for (const branch of ['main', 'experiment']) {
    selectBranch(r.store, 'group', branch)
    expect(() => buildSyncRequest(r, branch)).toThrow(/storage is excluded/)
    expect(() => buildSyncRequest(r, branch, { recipient: 'device' })).not.toThrow()
  }
})
