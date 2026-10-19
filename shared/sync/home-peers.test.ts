import { userView } from './test-helpers'
import { addMemberAt, createReplica, ensureHomeContext, headCid, HOME_ID, view } from './index'
test('legacy integration peers move from Settings to Home, retaining their permissions', () => {
  let replica = addMemberAt(createReplica('home-peers'), [], 'integration:github', 'GitHub', ['read'], 1)
  replica = ensureHomeContext(replica, 2)
  expect(userView(replica)!.members.some(m => m.peerId === 'integration:github')).toBe(false)
  expect(view(replica, [HOME_ID])!.members.find(m => m.peerId === 'integration:github')!.capabilities).toContain('read')
  expect(userView(replica)!.members.some(m => m.peerId === 'fos')).toBe(true)
  const head = headCid(replica)
  expect(headCid(ensureHomeContext(replica, 3))).toBe(head)
})
