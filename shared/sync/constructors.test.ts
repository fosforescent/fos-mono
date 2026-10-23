import { memberEntryPeerAt } from './graph'
import { userView } from './test-helpers'
import { createReplica, ensureHomeContext, headCid, view, writeNodeValue, addMemberAt, addTask, setMemberCapabilitiesAt, deleteTask, resolveScope, content, capabilityTarget } from './index'

test('settings and peer constructors project their existing identities as traversable rows', () => {
  let r = ensureHomeContext(createReplica('device'), 1)
  r = writeNodeValue(r, [], 'fos:setting:device:direct', { handler: 'direct' }, 2, { type: capabilityTarget(r.store, 'peer'), peer: 'device' })
  r = addMemberAt(r, [], 'guest', 'Guest', ['read'], 3)
  const rows = view(r, [], true)!.tasks
  const setting = rows.find(row => row.construction?.name === 'fos:setting:device:direct')!
  const peer = rows.find(row => row.construction?.peerId === 'guest')!
  expect(setting).toBeTruthy(); expect(peer).toBeTruthy()
  expect(setting.typeCid).toBe(capabilityTarget(r.store, 'peer'))
  expect(memberEntryPeerAt(r.store, headCid(r), [peer.id])).toBe('guest')
  r = addTask(r, [peer.id], 'Connection argument', 4, 'connection-argument')
  r = setMemberCapabilitiesAt(r, [], 'guest', ['read', 'edit'], [], 4)
  expect(view(r, [], true)!.tasks.find(row => row.construction?.peerId === 'guest')!.id).toBe(peer.id)
  expect(view(r, [peer.id])!.tasks.map(row => row.title)).toEqual(['Connection argument'])
  r = deleteTask(r, [], setting.id, 5)
  expect(view(r, [], true)!.tasks.some(row => row.id === setting.id)).toBe(false)
  r = deleteTask(r, [], peer.id, 6)
  expect(userView(r)!.members.some(member => member.peerId === 'guest')).toBe(false)
})
