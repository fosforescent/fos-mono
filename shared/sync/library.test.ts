/** The standard library: a mutable ref like any other, found by what it holds, changed by accepted submissions. */
import { nativeRef } from './native-refs'
import { primitiveImplementation } from './primitives'
import { libAt, handlerOfferId } from './graph'
import { FosStore } from '../dag-implementation/store'
import { HOME_ID, LIBRARY_ID, content, hasCapability, isLibraryRef, libraryRowOf, memberFor, namesInLibrary, put, refNodeContent, resolveScope, rowTypeAt, valueCidOf, valueContent } from './graph'
import { addMemberAt, addRefAt, makeLinkAt, addRow, addTask, createReplica, ensureHomeContext, headCid, proposeRefAt, view, type Replica } from './replica'
import { nodeAuthorityAt } from './node-context'
import { acceptSubmission, missingApprovals } from './approvals'
import { BUNDLED_LIBRARY, setLibraryArg, upgradeLibrary, useLibrary, ensureDeviceLibrary, exportLibrary, exportLocalLibrary, libraryPath, manualHandlers, manualHandlersFor } from './library'
import { LIBRARY_TYPE, PLAIN_TYPE, TASK_TYPE } from './library-types'

const TEAM = 'team-library'
/** The device root's library value with its task type titled `title`: a library its members changed. */
function changedLibrary(r: Replica, title: string): string {
  const store = r.store, value = valueCidOf(store, resolveScope(store, headCid(r), [LIBRARY_ID])!)
  return put(store, { ...content(store, value), children: content(store, value).children.map(edge => {
    const ref = content(store, edge[1])
    if (ref.data.name?.content !== TASK_TYPE) return edge
    const node = put(store, { ...valueContent(store, edge[1]), data: { ...valueContent(store, edge[1]).data, description: { content: title } } })
    return [edge[0], put(store, refNodeContent(store, ref.data, node))] as [string, string]
  }) })
}
const taskTitle = (r: Replica, at: string[]) => content(r.store, rowTypeAt(r.store, TASK_TYPE, at)).data.description?.content

test('a device root has its library ref, a row of the Library type, found by what it holds', () => {
  const r = ensureHomeContext(createReplica('user:alice'), 1)
  expect(view(r, [])!.tasks.map(t => t.id)).toEqual([LIBRARY_ID, HOME_ID])
  expect(libraryRowOf(r.store, headCid(r))).toEqual({ id: LIBRARY_ID, cid: resolveScope(r.store, headCid(r), [LIBRARY_ID]) })
  const edge = valueContent(r.store, headCid(r)).children.find(e => content(r.store, e[1]).data.alias?.id === LIBRARY_ID)!
  expect(edge[0]).toBe(rowTypeAt(r.store, LIBRARY_TYPE))
  expect(libraryPath(r)).toEqual([LIBRARY_ID])
  // a ref holding anything else is no library, whatever it is called
  const other = addRefAt(r, [HOME_ID], 'notes', rowTypeAt(r.store, PLAIN_TYPE), 2, put(r.store, { data: { description: { content: 'Standard library' } }, children: [] }))
  expect(isLibraryRef(other.store, content(other.store, resolveScope(other.store, headCid(other), [HOME_ID, 'notes'])!))).toBe(false)
  // loading a device root again keeps the library it has: the build's is already its value
  expect(headCid(ensureDeviceLibrary(r, BUNDLED_LIBRARY, 3))).toBe(headCid(r))
})

test('a library shared by a group is an ordinary ref: members submit, the ref\'s rule accepts, rows under it use it', () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addRefAt(r, [HOME_ID], TEAM, rowTypeAt(r.store, LIBRARY_TYPE), 2, changedLibrary(r, 'Chore'), 'Team library')
  // Home uses it: its own instance, pinned to the definition's value
  r = useLibrary(r, [HOME_ID], [HOME_ID, TEAM], 2)
  // nearest ancestor: under Home the team's library, at the root the device's
  expect(libraryPath(r)).toEqual([HOME_ID, TEAM])
  expect(libraryPath(r, [])).toEqual([LIBRARY_ID])
  expect(taskTitle(r, [HOME_ID])).toBe('Chore')
  r = makeLinkAt(r, [HOME_ID, TEAM], 3)
  r = addMemberAt(r, [HOME_ID, TEAM], 'user:bob', 'Bob', ['edit'], 3)
  r = addMemberAt(r, [HOME_ID, TEAM], 'user:carol', 'Carol', ['edit'], 3)
  // bob's submission: a value for the ref, accepted the way every submission is
  const proposed = proposeRefAt(r, [HOME_ID, TEAM], changedLibrary(r, 'Errand'), 'user:bob', 4)
  r = proposed.replica
  expect(missingApprovals(r, [HOME_ID, TEAM], proposed.proposalCid)).toEqual(['user:alice', 'user:carol'])
  const accepted = acceptSubmission(r, [HOME_ID, TEAM], proposed.proposalCid, 'user:carol', 5)
  expect(accepted.merged).toBe(true)
  r = accepted.replica
  // Home still uses the version it pinned until it upgrades
  expect(taskTitle(r, [HOME_ID])).toBe('Chore')
  r = upgradeLibrary(r, [HOME_ID], [HOME_ID, TEAM], 5)
  expect(taskTitle(r, [HOME_ID])).toBe('Errand')
  r = addTask(r, [HOME_ID], 'Shopping', 6, 'shop')
  expect(view(r, [HOME_ID])!.tasks.find(t => t.id === 'shop')!.type).toBe(TASK_TYPE)
  // exported, it is the content a new device's library takes, and the build source Home sees
  const bundle = exportLibrary(r, [HOME_ID, TEAM])
  const device = ensureDeviceLibrary(createReplica('user:dave', new FosStore()), bundle, 7)
  expect(taskTitle(device, [])).toBe('Errand')
  const source = exportLocalLibrary(r)
  expect(content(r.store, rowTypeAt(r.store, TASK_TYPE, [HOME_ID])).data).toEqual(source.nodes[namesInLibrary(r.store, source.rootNodeId).byName.get(TASK_TYPE)!]!.data)
})

test('the users audience is a group every account belongs to; explicit entries still win', () => {
  let r = ensureHomeContext(createReplica('user:alice'), 1)
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'Shared', 2, { id: 'shared' })
  const path = [HOME_ID, 'shared']
  r = addMemberAt(r, path, 'audience:users', 'Fos users', ['read', 'edit', 'rank'], 2)
  const value = content(r.store, resolveScope(r.store, headCid(r), path)!)
  expect(memberFor(r.store, value, 'user:bob')?.peerId).toBe('audience:users')
  expect(hasCapability(r.store, value, 'user:bob', 'edit')).toBe(true)
  expect(hasCapability(r.store, value, 'user:bob', 'execute')).toBe(false)
  expect(hasCapability(r.store, value, 'visitor:anon', 'read')).toBe(false)
  expect(nodeAuthorityAt(r, path, { peerId: 'user:bob', scope: path, capabilities: [] })).toEqual(expect.arrayContaining(['read', 'edit', 'rank']))
  expect(() => nodeAuthorityAt(r, path, { peerId: 'visitor:anon', scope: path, capabilities: [] })).toThrow()
  const restricted = addMemberAt(r, path, 'user:carol', 'carol', ['read'], 5)
  const restrictedValue = content(restricted.store, resolveScope(restricted.store, headCid(restricted), path)!)
  expect(memberFor(restricted.store, restrictedValue, 'user:carol')?.peerId).toBe('user:carol')
  expect(hasCapability(restricted.store, restrictedValue, 'user:carol', 'edit')).toBe(false)
  expect(nodeAuthorityAt(restricted, path, { peerId: 'user:carol', scope: path, capabilities: [] })).toEqual(['read'])
})

test('the library carries manual fallback handlers for every kind of requirement, matched by capability and resource', () => {
  const r = ensureHomeContext(createReplica('user:device'), 1)
  const handlers = manualHandlers(r)
  expect(handlers.map(h => h.capability === 'allocation' ? `${h.capability}:${h.resource}` : h.capability).sort()).toEqual([
    'allocation:account', 'allocation:calendar', 'allocation:inventory', 'allocation:location', 'allocation:points', 'llm', 'mail', 'market', 'repo', 'search', 'tool'
  ])
  expect(manualHandlersFor(r, { capability: 'allocation', resource: 'account' }).map(h => h.label)).toEqual(['Paid outside Fos'])
  // a place is entered by hand; the device's position only once the device passed the library its native
  expect(manualHandlersFor(r, { capability: 'allocation', resource: 'location' }).map(h => h.device)).toEqual([false])
  expect(manualHandlersFor(r, { capability: 'mail' }).map(h => h.label)).toEqual(['Sent it myself'])
  expect(manualHandlersFor(r, { capability: 'confirmation' })).toEqual([])
})

test('the library requires natives the device passes in: its lib instance carries them, and they fill what they are declared for', () => {
  let r = ensureHomeContext(createReplica('user:device'), 1)
  const locate = { locate: async () => ({ lat: 1, lng: 2 }) }
  const native = nativeRef(r.store, r.meta.peerId, { id: 'location', label: 'This device', type: store => libAt(store).capabilities.allocation! }, locate as never)
  expect(() => setLibraryArg(r, [], 'nothingDeclared', native, 2)).toThrow(/requires no/)
  r = setLibraryArg(r, [], 'deviceLocation', native, 2)
  expect(headCid(setLibraryArg(r, [], 'deviceLocation', native, 3))).toBe(headCid(r))
  const device = manualHandlersFor(r, { capability: 'allocation', resource: 'location' }).find(h => h.device)!
  expect(device).toMatchObject({ label: "Use this device's location", native })
  // the native is what the device registered: the library holds no code, only what it was passed
  expect(primitiveImplementation(r.store, valueCidOf(r.store, device.native!))?.value).toBe(locate)
})
