/** What types accept (their pattern rows), and the type errors a row in the wrong place makes. */
import { FosStore } from '../dag-implementation/store'
import { HOME_ID, content, nestScope, put, resolveScope, rootStoredTarget, rowTypeAt, valueContent } from './graph'
import { HOME_TYPE, NOTE_TYPE, PATTERN_TYPE, TASK_TYPE } from './library-types'
import { addRow, addTask, copyNode, createReplica, deleteTask, ensureHomeContext, headCid, loadReplica, serializeReplica, view, type Replica } from './replica'
import { installNodeShape } from './node-sync'
import { acceptsChild, isTypeErrorEdge, rootTypeOf, typeErrorInner } from './patterns'
import { userView } from './test-helpers'
import type { FosNodeContent } from '../types'

/** A pattern row's node: the wildcard, or a row type (any version unless `versions` pins some). */
function patternRowContent(owner: string, pattern: { any: true } | { type: string; versions?: string[] }): FosNodeContent {
  if ('any' in pattern) return { data: { alias: { id: `${owner}:accepts:any` }, description: { content: 'Any row' }, pattern: { any: true } }, children: [] }
  const versions = pattern.versions?.length ? [...pattern.versions] : undefined
  return { data: { alias: { id: `${owner}:accepts:${pattern.type}${versions ? `@${versions.join(',')}` : ''}` }, description: { content: pattern.type }, pattern: { type: pattern.type, ...(versions ? { versions } : {}) } }, children: [] }
}

const device = () => addTask(ensureHomeContext(createReplica('d'), 1), [HOME_ID], 'Task', 2, 't')
/** A document root (a project's), nested in a device root for its row types. */
function documentRoot(): Replica {
  const host = createReplica('host'), store = new FosStore()
  nestScope(store, { store: host.store, root: headCid(host), at: [] })
  return createReplica('doc', store)
}
/** Rows a peer sent under `at`: a Home row there (what no local edit could make). */
function receiveHome(r: Replica, at: string[]): Replica {
  const home = rowTypeAt(r.store, HOME_TYPE, at)
  return installNodeShape(r, at, { data: valueContent(r.store, resolveScope(r.store, headCid(r), at)!).data, children: [{ id: 'stray', template: home, address: { peerId: 'peer', scope: [...at, 'stray'] } }] }, 5)
}

test('only a device root accepts Home; nothing accepts a store root', () => {
  const r = device()
  expect(content(r.store, rootTypeOf(r.store)).data.alias).toEqual({ id: 'lib:type:device-root' })
  expect(userView(r)!.tasks.map(t => [t.id, t.type])).toEqual([[HOME_ID, HOME_TYPE]])
  // a device root also holds its own rows; Home and ordinary rows hold no Home
  expect(() => addTask(r, [], 'Device setting', 3, 'setting')).not.toThrow()
  expect(() => addRow(r, [HOME_ID], HOME_TYPE, 'Another Home', 3)).toThrow(/does not accept/)
  expect(() => addRow(r, [HOME_ID, 't'], HOME_TYPE, 'Home in a task', 3)).toThrow(/does not accept/)
  const doc = documentRoot()
  expect(content(doc.store, rootTypeOf(doc.store)).data.alias).toEqual({ id: 'lib:type:document-root' })
  expect(() => addRow(doc, [], HOME_TYPE, 'Home in a project', 3)).toThrow(/does not accept/)
  expect(() => addTask(doc, [], 'Project task', 3)).not.toThrow()
})

test('a refused edit leaves the replica as it was', () => {
  let r = device()
  r = addTask(r, [HOME_ID], 'Other', 3, 'o')
  const before = r.store.rootNodeId
  // a copy of Home cannot go into a task (only a device root accepts Home)
  expect(() => copyNode(r, [], HOME_ID, [HOME_ID], { into: 'o' }, 4)).toThrow(/does not accept/)
  expect(r.store.rootNodeId).toBe(before)
})

test('a received row its parent does not accept makes the parent a type error that keeps both', () => {
  let r = receiveHome(device(), [HOME_ID, 't'])
  // the task's edge is a type error around the task as it was; the task and the stray row read as before
  const edge = valueContent(r.store, resolveScope(r.store, headCid(r), [HOME_ID])!).children.find(e => content(r.store, e[1]).data.alias?.id === 't')!
  expect(isTypeErrorEdge(r.store, edge)).toBe(true)
  expect(content(r.store, typeErrorInner(r.store, edge)[1]).data.description?.content).toBe('Task')
  expect(view(r, [HOME_ID])!.tasks.find(t => t.id === 't')).toMatchObject({ type: TASK_TYPE, title: 'Task', typeError: ['stray'] })
  const inside = view(r, [HOME_ID, 't'])!
  expect(inside.typeError).toEqual(['stray'])
  expect(inside.tasks.map(t => [t.id, t.rejected ?? false])).toEqual([['stray', true]])
  // it survives a reload, and other edits around it do not clear it
  r = loadReplica(serializeReplica(r))
  r = addTask(r, [HOME_ID, 't'], 'Fine here', 6, 'fine')
  expect(view(r, [HOME_ID, 't'])!.typeError).toEqual(['stray'])
  // once the rejected row is gone, the task is a plain row again
  r = deleteTask(r, [HOME_ID, 't'], 'stray', 7)
  const plain = valueContent(r.store, resolveScope(r.store, headCid(r), [HOME_ID])!).children.find(e => content(r.store, e[1]).data.alias?.id === 't')!
  expect(isTypeErrorEdge(r.store, plain)).toBe(false)
  expect(view(r, [HOME_ID, 't'])!.typeError).toBeUndefined()
  expect(view(r, [HOME_ID, 't'])!.tasks.map(t => t.id)).toEqual(['fine'])
})

test('a store root holding what its type rejects is a type error too', () => {
  const doc = receiveHome(documentRoot(), [])
  expect(content(doc.store, rootStoredTarget(doc.store)).data.typeError).toEqual({ rejected: ['stray'] })
  expect(view(doc, [])!.typeError).toEqual(['stray'])
  expect(view(doc, [])!.tasks.find(t => t.id === 'stray')!.rejected).toBe(true)
})

test('a pattern matches a row type, and can pin the versions of it that match', () => {
  const r = device(), store = r.store
  const task = rowTypeAt(store, TASK_TYPE, [HOME_ID]), patternType = rowTypeAt(store, PATTERN_TYPE, [HOME_ID])
  const node = put(store, { data: { alias: { id: 'x' }, description: { content: 'x' }, todo: { completed: false, time: 1 } }, children: [] })
  const otherVersion = put(store, { ...content(store, task), data: { ...content(store, task).data, description: { content: 'To-do' } } })
  const typeWith = (patterns: Parameters<typeof patternRowContent>[1][]) => put(store, { data: { alias: { id: 'strict' }, description: { content: 'Strict' } }, children: patterns.map(p => [patternType, put(store, patternRowContent('strict', p))]) })
  // only tasks of one version
  const pinned = typeWith([{ type: TASK_TYPE, versions: [task] }])
  expect(acceptsChild(store, pinned, [task, node])).toBe(true)
  expect(acceptsChild(store, pinned, [otherVersion, node])).toBe(false)
  // any version of a task, nothing else
  const tasks = typeWith([{ type: TASK_TYPE }])
  expect(acceptsChild(store, tasks, [otherVersion, node])).toBe(true)
  expect(acceptsChild(store, tasks, [rowTypeAt(store, NOTE_TYPE, [HOME_ID]), node])).toBe(false)
  // the wildcard makes the patterns exclusions; absence of a placement policy imposes no editor restriction
  expect(acceptsChild(store, typeWith([{ any: true }, { type: TASK_TYPE }]), [task, node])).toBe(false)
  expect(acceptsChild(store, typeWith([{ any: true }, { type: TASK_TYPE }]), [rowTypeAt(store, NOTE_TYPE, [HOME_ID]), node])).toBe(true)
  expect(acceptsChild(store, typeWith([]), [task, node])).toBe(true)
})

test('a bare root (as the seed and registration write it) commits as a document root, its rows accepted', () => {
  const store = new FosStore(), host = createReplica('host')
  nestScope(store, { store: host.store, root: headCid(host), at: [] })
  store.rootNodeId = put(store, { data: { alias: { id: 'ws' }, description: { content: 'workspace' } }, children: [] })
  const r = addTask(createReplica('server', store), [], 'first', 1, 'a')
  expect(content(store, rootTypeOf(store)).data.alias).toEqual({ id: 'lib:type:document-root' })
  expect(view(r, [])!.typeError).toBeUndefined()
  expect(view(r, [])!.tasks.map(t => t.title)).toEqual(['first'])
})
