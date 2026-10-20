import { HOME_ID } from './graph'
import { exchangeNode, nodeShape } from './node-sync'
import { acceptProvidedNode, type NodeAuthority, type NodeRequest } from './node-provider'
import { addFileReference, addTask, copyNode, createReplica, ensureHomeContext, fileReferenceAt, setFileReferenceAt, view } from './replica'

const pinned = { path: 'docs/plan.md', sha256: 'a'.repeat(64), size: 12 }

test('a file reference is a plain row carrying the path and checksum as data', () => {
  let r = ensureHomeContext(createReplica('owner'), 1)
  r = addTask(r, [HOME_ID], 'Project', 2, 'project')
  r = addFileReference(r, [HOME_ID, 'project'], pinned, 3, { id: 'ref' })
  const row = view(r, [HOME_ID, 'project'])!.tasks.find(t => t.id === 'ref')!
  expect(row.kind).toBe('plain')
  expect(row.title).toBe('plan.md')
  expect(fileReferenceAt(r, [HOME_ID, 'project', 'ref'])).toEqual(pinned)
  r = setFileReferenceAt(r, [HOME_ID, 'project'], 'ref', { ...pinned, sha256: 'b'.repeat(64), size: 13 }, 4)
  expect(fileReferenceAt(r, [HOME_ID, 'project', 'ref'])).toEqual({ ...pinned, sha256: 'b'.repeat(64), size: 13 })
  r = copyNode(r, [HOME_ID, 'project'], 'ref', [HOME_ID], { relativeTo: 'project', position: 'below' }, 5)
  const copy = view(r, [HOME_ID])!.tasks.find(t => t.title === 'plan.md')!
  expect(fileReferenceAt(r, [HOME_ID, copy.id])?.path).toBe('docs/plan.md')
  for (const path of ['/etc/passwd', '../x', 'a/../b', 'C:/x', 'a\\b', '']) expect(() => addFileReference(r, [HOME_ID], { ...pinned, path }, 6)).toThrow()
  expect(() => addFileReference(r, [HOME_ID], { ...pinned, sha256: 'nope' }, 6)).toThrow()
})

test('file references travel through node exchange', () => {
  let owner = ensureHomeContext(createReplica('owner'), 1)
  owner = addFileReference(owner, [HOME_ID], pinned, 2, { id: 'ref' })
  expect(nodeShape(owner, [HOME_ID, 'ref']).data.file).toEqual(pinned)
  const authority: NodeAuthority = { peerId: 'device', scope: [HOME_ID], owner: true, capabilities: ['provideNode', 'sync'] }
  const top: NodeRequest = { peerId: 'device', scope: [HOME_ID], path: [], linkId: 'device-link' }
  const home = exchangeNode(owner, top, authority, 3); owner = home.replica
  let device = acceptProvidedNode(ensureHomeContext(createReplica('device'), 1), [HOME_ID], top, home.node, 4)
  const child: NodeRequest = { ...top, path: ['ref'], linkId: 'device-link-ref' }
  const served = exchangeNode(owner, child, authority, 5)
  expect(served.node.data.file).toEqual(pinned)
  device = acceptProvidedNode(device, [HOME_ID, 'ref'], child, served.node, 6)
  expect(fileReferenceAt(device, [HOME_ID, 'ref'])).toEqual(pinned)
})
