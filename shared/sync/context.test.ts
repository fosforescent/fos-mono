import { memberEdgesOf } from './graph'
import { syncWith, userView } from './test-helpers'
import { contextMembers, createBranch, selectBranch, addMemberAt, addRow, addTask, createReplica, moveNode, ensureHomeContext, findChild, headCid, HOME_ID, homePath, resetHomeContent, view } from './index'
import { addRequirement, argumentSupplier, supplyRequirement } from './arguments'
import { TEMPLATE_TYPE } from './library-types'
import { HOME_TYPE } from './library-types'

test('legacy rows move into Home, constructors and peers remain at root, and migration is idempotent', () => {
  let r = addTask(createReplica('device'), [], 'Existing project', 1, 'project')
  r = addRow(r, [], TEMPLATE_TYPE, 'Workflow', 2, { id: 'workflow' })
  r = addMemberAt(r, [], 'other', 'Other', ['read'], 3)
  const previousProject = findChild(r.store, headCid(r), 'project')
  r = ensureHomeContext(r, 4)
  expect(homePath(r)).toEqual([HOME_ID])
  expect(userView(r)!.tasks.find(row => row.id === HOME_ID)!.type).toBe(HOME_TYPE)
  const rootMembers = memberEdgesOf(r.store, headCid(r))
  const homeMembers = memberEdgesOf(r.store, findChild(r.store, headCid(r), HOME_ID)!)
  expect(homeMembers.some(edge => rootMembers.some(root => root[1] === edge[1]))).toBe(false)
  expect(contextMembers(r, [HOME_ID]).some(peer => peer.peerId === 'fos')).toBe(true)
  expect(userView(r)!.tasks.map(row => row.id)).toEqual(['workflow', HOME_ID])
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['project'])
  expect(findChild(r.store, findChild(r.store, headCid(r), HOME_ID)!, 'project')).toBe(previousProject)
  expect(userView(r)!.members.map(peer => peer.peerId)).toEqual(expect.arrayContaining(['other', 'fos']))
  const head = headCid(r)
  expect(ensureHomeContext(r, 5)).toBe(r)
  expect(headCid(r)).toBe(head)
  r = resetHomeContent(r, 6)
  expect(view(r, [HOME_ID])!.tasks).toEqual([])
  expect(userView(r)!.tasks.map(row => row.id)).toEqual(['workflow', HOME_ID])
})

test('scoped documents are already instances and never receive an extra Home wrapper', () => {
  const r = createReplica('scoped'); r.meta.scope = ['project']
  expect(ensureHomeContext(r, 1)).toBe(r)
  expect(homePath(r)).toEqual([])
})

test('legacy scoped attachment paths still update the same node beneath Home', () => {
  let server = addTask(createReplica('server'), [], 'Project', 1, 'project')
  server = addMemberAt(server, ['project'], 'attached', 'Attached', ['edit'], 0)
  server = ensureHomeContext(server, 0)
  // a credential issued before Home existed still names the project at the root
  let client = createReplica('attached')
  client.meta.scope = ['project']
  client = syncWith(client, server, { invited: ['project'] })
  client = addTask(client, [], 'Child', 4, 'child')
  client = syncWith(client, server, { invited: ['project'] })
  expect(view(server, [HOME_ID, 'project'])!.proposals[0]!.summary.added).toEqual(['Child'])
})


test('moving rows inside the Home constructor follows its mutable value', () => {
  let r = ensureHomeContext(createReplica(), 0)
  r = addTask(r, [HOME_ID], 'First', 1, 'first')
  r = addTask(r, [HOME_ID], 'Second', 2, 'second')
  r = moveNode(r, [HOME_ID], 'second', [HOME_ID], { relativeTo: 'first', position: 'above' }, 3)
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['second', 'first'])
  r = moveNode(r, [HOME_ID], 'second', [HOME_ID], { into: 'first' }, 4)
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toEqual(['first'])
  expect(view(r, [HOME_ID, 'first'])!.tasks.some(row => row.id === 'second')).toBe(true)
})


test('a handler demand is an argument row; supplying it binds its ref to a value naming the supplier', () => {
  let r = addTask(createReplica(), [], 'Task', 1, 'task')
  r = addRequirement(r, ['task'], 'Confirm', 2, { capability: 'confirmation' }, 'need')
  expect(view(r, ['task'])!.tasks.find(row => row.id === 'need')!.requirement).toMatchObject({ capability: 'confirmation', satisfied: false })
  expect(argumentSupplier(r, ['task', 'need'])).toBeNull()
  r = supplyRequirement(r, ['task'], 'need', { by: 'user' }, 3)
  expect(view(r, ['task'])!.tasks.find(row => row.id === 'need')!.requirement?.satisfied).toBe(true)
  expect(argumentSupplier(r, ['task', 'need'])).toBe('user')
  // the row keeps its title and holds no rows of its own: the value is what its ref is bound to
  expect(view(r, ['task'])!.tasks.find(row => row.id === 'need')!.title).toBe('Confirm')
  // the requirement's only row is its own title
  expect(view(r, ['task', 'need'])!.tasks.map(t => [t.type, t.title])).toEqual([['title', 'Confirm']])
})


test('Home branches survive normalization and keep their separate children', () => {
  let r = ensureHomeContext(createReplica(), 0)
  r = addTask(r, [HOME_ID], 'Original', 1, 'original')
  r = createBranch(r, [HOME_ID], 'alternative', 2)
  r = addTask(r, [HOME_ID], 'Alternative only', 3, 'extra')
  r = ensureHomeContext(r, 4)
  expect(userView(r)!.tasks.find(row => row.id === HOME_ID)!.branches!.names).toContain('alternative')
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).toContain('extra')
  selectBranch(r.store, HOME_ID, 'main')
  expect(view(r, [HOME_ID])!.tasks.map(row => row.id)).not.toContain('extra')
})
