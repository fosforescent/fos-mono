import { HOME_ID, content, isLibraryType, resolveScope, valueContent } from './graph'
import { exchangeNode, nodeShape } from './node-sync'
import { acceptProvidedNode, type NodeAuthority, type NodeRequest } from './node-provider'
import { FILE_REFERENCE_TYPE, addFileReference, addRow, addTask, copyNode, createReplica, ensureHomeContext, fileReferenceAt, headCid, setFileReferenceAt, view, type Replica } from './replica'
import { BUNDLED_LIBRARY, ensureDeviceLibrary } from './library'
import { PLAIN_TYPE } from './library-types'

const pinned = { path: 'docs/plan.md', sha256: 'a'.repeat(64), size: 12 }
const device = (peer: string) => ensureHomeContext(ensureDeviceLibrary(createReplica(peer), BUNDLED_LIBRARY, 0), 1)
const edgeOf = (r: Replica, at: string[], id: string) => valueContent(r.store, resolveScope(r.store, headCid(r), at)!).children.find(e => content(r.store, e[1]).data.alias?.id === id)!

test('a file reference is a row of the library type, its values in the type\'s fields', () => {
  let r = device('owner')
  r = addTask(r, [HOME_ID], 'Project', 2, 'project')
  r = addFileReference(r, [HOME_ID, 'project'], pinned, 3, 'ref')
  expect(isLibraryType(r.store, edgeOf(r, [HOME_ID, 'project'], 'ref')[0], FILE_REFERENCE_TYPE)).toBe(true)
  expect(valueContent(r.store, resolveScope(r.store, headCid(r), [HOME_ID, 'project', 'ref'])!).data).not.toHaveProperty('file')
  expect(view(r, [HOME_ID, 'project'])!.tasks.find(t => t.id === 'ref')!.title).toBe('docs/plan.md')
  expect(fileReferenceAt(r, [HOME_ID, 'project', 'ref'])).toEqual(pinned)
  r = setFileReferenceAt(r, [HOME_ID, 'project'], 'ref', { ...pinned, sha256: 'b'.repeat(64), size: 13 }, 4)
  expect(fileReferenceAt(r, [HOME_ID, 'project', 'ref'])).toEqual({ ...pinned, sha256: 'b'.repeat(64), size: 13 })
  r = copyNode(r, [HOME_ID, 'project'], 'ref', [HOME_ID], { relativeTo: 'project', position: 'below' }, 5)
  const copy = view(r, [HOME_ID])!.tasks.find(t => t.title === 'docs/plan.md')!
  expect(fileReferenceAt(r, [HOME_ID, copy.id])?.path).toBe('docs/plan.md')
  // a plain row is not a reference, whatever it says
  r = addRow(r, [HOME_ID], PLAIN_TYPE, 'docs/plan.md', 6, { id: 'plain' })
  expect(fileReferenceAt(r, [HOME_ID, 'plain'])).toBeNull()
  expect(() => setFileReferenceAt(r, [HOME_ID], 'plain', pinned, 7)).toThrow()
  for (const path of ['/etc/passwd', '../x', 'a/../b', 'C:/x', 'a\\b', '']) expect(() => addFileReference(r, [HOME_ID], { ...pinned, path }, 8)).toThrow()
  expect(() => addFileReference(r, [HOME_ID], { ...pinned, sha256: 'nope' }, 8)).toThrow()
})

test('a fresh replica explicitly binds a library that defines file references', () => {
  let r = ensureHomeContext(createReplica('old'), 1)
  r = addFileReference(r, [HOME_ID], pinned, 2, 'ref')
  expect(fileReferenceAt(r, [HOME_ID, 'ref'])).toEqual(pinned)
})

test('file references and their fields travel through node exchange', () => {
  let owner = device('owner')
  owner = addFileReference(owner, [HOME_ID], pinned, 2, 'ref')
  const authority: NodeAuthority = { peerId: 'device', scope: [HOME_ID], owner: true, capabilities: ['provideNode', 'sync'] }
  let receiver = device('device')
  // node by node, as a peer pulls it: Home, the reference row, then each of its fields
  const pull = (path: string[]) => {
    const request: NodeRequest = { peerId: 'device', scope: [HOME_ID], path, linkId: `device-link:${path.join('|')}` }
    const served = exchangeNode(owner, request, authority, 3); owner = served.replica
    receiver = acceptProvidedNode(receiver, [HOME_ID, ...path], request, served.node, 4)
    return served.node
  }
  pull([])
  const row = pull(['ref'])
  expect(row.children.filter(c => !c.pinned).map(c => c.id).sort()).toEqual(['ref/field/path', 'ref/field/sha256', 'ref/field/size'])
  expect(row.children.filter(c => c.pinned)).toHaveLength(1)
  for (const field of row.children) if (!field.pinned) pull(['ref', field.id])
  expect(isLibraryType(receiver.store, edgeOf(receiver, [HOME_ID], 'ref')[0], FILE_REFERENCE_TYPE)).toBe(true)
  expect(fileReferenceAt(receiver, [HOME_ID, 'ref'])).toEqual(pinned)
  expect(nodeShape(owner, [HOME_ID, 'ref', 'ref/field/sha256']).data.scalar).toEqual({ type: 'text', value: pinned.sha256 })
})
