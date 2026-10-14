import { FosStore } from '../dag-implementation/store'
import { CURRENT_CID_VERSION } from '../dag-implementation/cid'
import type { FosPathElem } from '../types'
import { parseToml, peerPolicyOf, serverPolicyOf, type FosProjectConfig } from './project'
import {
  acceptsFrom,
  CAPABILITIES,
  SERVER_CAPABILITIES,
  INTEGRATION_PEERS,
  readMembers,
  withMember,
  bookkeepingOf,
  SYNC_FORMAT_VERSION,
  commitRoot,
  content,
  edgeKey,
  hasCapability,
  isChoiceEdge,
  parsePolicy,
  isHandle,
  isLegacyInlineLink,
  isRefNode,
  linkHistory,
  normalizeRefs,
  partitionContent,
  partitionEdge,
  put,
  readChoice,
  refValueCid,
  resolveScope,
  rootTargetCid,
  stripLink,
  taskContent,
  taskEdge,
  valueContent,
  viewNode
} from './graph'
import { mergeNodes, resolveChoiceIn } from './merge'
import { parseSyncRequest, serveSync, type SyncResponse } from './protocol'
import {
  addMemberAt,
  addPartition,
  addRef,
  addRow,
  addSupply,
  addTask,
  applyProposalAt,
  buildSyncRequest,
  completeSync,
  copyNode,
  createReplica,
  deleteTask,
  findTemplateByName,
  headCid,
  instantiateTemplate,
  removeMemberAt,
  setMemberCapabilitiesAt,
  isDirty,
  loadReplica,
  makeLinkAt,
  reattach,
  renameTask,
  resolve,
  resolveRef,
  serializeReplica,
  serveSync,
  setMarketAt,
  setQueryOptionsAt,
  setRowContentAt,
  setRowKind,
  setTaskDone,
  type Replica,
  view
} from './replica'

const LABELS = { ours: 'A', theirs: 'B' }

/** Build content nodes in one store for the merge tests. */
function fixtures(store: FosStore) {
  const task = (id: string, title: string, done = false, time = 1000, updated = time) =>
    taskEdge(store, put(store, taskContent(id, title, done, time, updated)))
  const node = (...edges: FosPathElem[]) => put(store, { data: {}, children: edges })
  const part = (id: string, name: string, ...edges: FosPathElem[]) => partitionEdge(store, put(store, partitionContent(id, name, edges)))
  return { task, node, part }
}

describe('mergeNodes', () => {
  let store: FosStore
  let f: ReturnType<typeof fixtures>
  beforeEach(() => {
    store = new FosStore()
    f = fixtures(store)
  })

  it('takes one-sided additions from both sides', () => {
    const base = f.node()
    const ours = f.node(f.task('a', 'ours'))
    const theirs = f.node(f.task('b', 'theirs'))
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    expect(viewNode(store, cid).tasks.map((t) => t.id).sort()).toEqual(['a', 'b'])
    expect(newChoiceCids).toHaveLength(0)
  })

  it('takes a one-sided modification and a one-sided delete', () => {
    const base = f.node(f.task('a', 'old'), f.task('b', 'keep'))
    const ours = f.node(f.task('a', 'old'), f.task('b', 'keep'))
    const theirs = f.node(f.task('a', 'new', false, 1000, 2000))
    const { cid } = mergeNodes(store, base, ours, theirs, LABELS)
    const tasks = viewNode(store, cid).tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: 'a', title: 'new' })
  })

  it('merges disjoint field changes of the same task without a choice', () => {
    const base = f.node(f.task('a', 'title'))
    const ours = f.node(f.task('a', 'renamed', false, 1000, 1500))
    const theirs = f.node(f.task('a', 'title', true, 1000, 1600))
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    expect(newChoiceCids).toHaveLength(0)
    expect(viewNode(store, cid).tasks[0]).toMatchObject({ title: 'renamed', done: true, updatedAt: 1600 })
  })

  it('creates a CHOICE edge when the same field diverges', () => {
    const base = f.node(f.task('a', 'title'))
    const ours = f.node(f.task('a', 'ours title'))
    const theirs = f.node(f.task('a', 'theirs title'))
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    expect(newChoiceCids).toHaveLength(1)
    const merged = content(store, cid)
    expect(merged.children.filter((e) => isChoiceEdge(store, e))).toHaveLength(1)
    const v = viewNode(store, cid)
    expect(v.tasks).toHaveLength(0)
    expect(v.choices).toHaveLength(1)
    expect(v.choices[0]?.id).toBe('a')
    expect(v.choices[0]?.base?.title).toBe('title')
    expect(v.choices[0]?.options.map((o) => o.task?.title).sort()).toEqual(['ours title', 'theirs title'])
    expect(v.choices[0]?.options.map((o) => o.peerId).sort()).toEqual(['A', 'B'])
  })

  it('creates a choice for delete vs modify', () => {
    const base = f.node(f.task('a', 'title'))
    const ours = f.node()
    const theirs = f.node(f.task('a', 'edited'))
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    expect(newChoiceCids).toHaveLength(1)
    const choice = viewNode(store, cid).choices[0]!
    expect(choice.options.find((o) => o.task === null)?.peerId).toBe('A')
  })

  it('is symmetric: swapping sides yields the same cid', () => {
    const base = f.node(f.task('a', 'title'), f.task('b', 'keep'))
    const x = f.node(f.task('a', 'x version'), f.task('b', 'keep'), f.task('c', 'from x'))
    const y = f.node(f.task('a', 'y version'), f.task('b', 'keep', true))
    const xy = mergeNodes(store, base, x, y, { ours: 'X', theirs: 'Y' }).cid
    const yx = mergeNodes(store, base, y, x, { ours: 'Y', theirs: 'X' }).cid
    expect(xy).toBe(yx)
  })

  it('drops a choice resolved on one side and re-raises one when both resolve differently', () => {
    const base = f.node(f.task('a', 'title'))
    const withChoice = mergeNodes(store, base, f.node(f.task('a', 'ours')), f.node(f.task('a', 'theirs')), LABELS).cid
    const resolvedFirst = put(store, resolveChoiceIn(store, content(store, withChoice), 'a', 0, 3000))
    const resolvedSecond = put(store, resolveChoiceIn(store, content(store, withChoice), 'a', 1, 3001))

    const oneSide = mergeNodes(store, withChoice, resolvedFirst, withChoice, LABELS)
    expect(oneSide.newChoiceCids).toHaveLength(0)
    expect(viewNode(store, oneSide.cid).choices).toHaveLength(0)
    expect(viewNode(store, oneSide.cid).tasks).toHaveLength(1)

    const bothSides = mergeNodes(store, withChoice, resolvedFirst, resolvedSecond, LABELS)
    expect(bothSides.newChoiceCids).toHaveLength(1)
    expect(viewNode(store, bothSides.cid).tasks).toHaveLength(0)
  })

  it('resolving with null deletes the task', () => {
    const base = f.node(f.task('a', 'title'))
    const withChoice = mergeNodes(store, base, f.node(f.task('a', 'ours')), f.node(f.task('a', 'theirs')), LABELS).cid
    const deleted = resolveChoiceIn(store, content(store, withChoice), 'a', null, 1)
    expect(deleted.children).toHaveLength(0)
  })

  it('merges partitions recursively and keeps a modified partition over a deletion', () => {
    const base = f.node(f.part('work', 'Work', f.task('w1', 'work one')), f.part('home', 'Home', f.task('h1', 'home one')))
    const ours = f.node(f.part('work', 'Work', f.task('w1', 'work one'), f.task('w2', 'work two')))
    const theirs = f.node(
      f.part('work', 'Work', f.task('w1', 'work one', true, 1000, 1200)),
      f.part('home', 'Home', f.task('h1', 'home one'), f.task('h2', 'home two')),
      f.part('play', 'Play', f.task('p1', 'play'))
    )
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    const v = viewNode(store, cid)
    // work: both sides changed different things inside it → merged recursively
    expect(v.tasks.filter((t) => !t.checkable).map((t) => t.title)).toEqual(['Work', 'Play'])
    const work = viewNode(store, resolveScope(store, cid, ['work'])!)
    expect(work.tasks.map((t) => [t.id, t.done])).toEqual([['w1', true], ['w2', false]])
    // home: deleted by ours, changed by theirs → a choice over the partition itself
    expect(newChoiceCids).toHaveLength(1)
    expect(v.choices).toHaveLength(1)
    expect(v.choices[0]).toMatchObject({ id: 'home' })
    expect(v.choices[0]?.base?.title).toBe('Home') // a plain row is a row like any other now
    expect(v.choices[0]?.options.map((o) => [o.peerId, o.task?.title ?? o.label]).sort()).toEqual([['A', null], ['B', 'Home']])
  })

  it('keeps a modified partition when the deletion side is chosen away', () => {
    const base = f.node(f.part('home', 'Home', f.task('h1', 'home one')))
    const ours = f.node()
    const theirs = f.node(f.part('home', 'Home', f.task('h1', 'home one'), f.task('h2', 'home two')))
    const { cid } = mergeNodes(store, base, ours, theirs, LABELS)
    const choice = viewNode(store, cid).choices[0]!
    const keep = choice.options.findIndex((o) => (o.task?.title ?? o.label) === 'Home')
    const resolved = put(store, resolveChoiceIn(store, content(store, cid), 'home', keep, 9))
    expect(viewNode(store, resolveScope(store, resolved, ['home'])!).tasks).toHaveLength(2)
  })

  it('keeps child order: ours is the backbone, theirs-only children land next to their neighbours', () => {
    const base = f.node(f.task('x', 'x'), f.task('y', 'y'))
    const ours = f.node(f.task('y', 'y'), f.task('x', 'x'))                       // ours reordered
    const theirs = f.node(f.task('n', 'new top'), f.task('x', 'x'), f.task('y', 'y'), f.task('z', 'new bottom'))
    const { cid, newChoiceCids } = mergeNodes(store, base, ours, theirs, LABELS)
    expect(newChoiceCids).toHaveLength(0)
    expect(viewNode(store, cid).tasks.map((t) => t.id)).toEqual(['y', 'z', 'n', 'x']) // each theirs-only child follows its predecessor on theirs' side (z after y, n before x)
    const disjoint = mergeNodes(store, f.node(), f.node(f.task('a', 'a')), f.node(f.task('b', 'b')), LABELS)
    expect(viewNode(store, disjoint.cid).tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('treats a null base as empty (first-contact union)', () => {
    const { cid, newChoiceCids } = mergeNodes(store, null, f.node(f.task('a', 'a')), f.node(f.task('b', 'b')), LABELS)
    expect(newChoiceCids).toHaveLength(0)
    expect(viewNode(store, cid).tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('protocol', () => {
  const SERVER = 'user:alice'

  it('validates requests', () => {
    expect(parseSyncRequest(null)).toHaveProperty('error')
    expect(parseSyncRequest({ version: 2 })).toHaveProperty('error')
    expect(parseSyncRequest({ version: SYNC_FORMAT_VERSION, peerId: '', scope: [], headCid: 'x' })).toHaveProperty('error')
    expect(parseSyncRequest({ version: SYNC_FORMAT_VERSION, peerId: 'p', scope: ['a', 3], headCid: 'x' })).toHaveProperty('error')
    expect(parseSyncRequest({ version: SYNC_FORMAT_VERSION, cidVersion: CURRENT_CID_VERSION, peerId: 'p', scope: [], headCid: 'x', nodes: {} })).not.toHaveProperty('error')
  })

  it('rejects a head whose nodes were not provided and an unknown scope', () => {
    const server = new FosStore()
    const missing = serveSync(server, { version: SYNC_FORMAT_VERSION, cidVersion: CURRENT_CID_VERSION, peerId: 'p', scope: [], baseCid: null, headCid: 'nope', nodes: {} }, SERVER)
    expect(missing).toMatchObject({ code: 'missing-nodes' })

    const device = createReplica('p')
    const req = buildSyncRequest({ ...device, meta: { ...device.meta, scope: ['no-such-partition'] } })
    expect(serveSync(server, req, SERVER)).toMatchObject({ code: 'scope-not-found' })
  })

  it('rejects a peer that addresses nodes in a different cid format', () => {
    const server = new FosStore()
    const request = { ...buildSyncRequest(addTask(createReplica('p'), [], 'x', 1)), cidVersion: 0 }
    expect(serveSync(server, request, SERVER)).toMatchObject({ code: 'version-mismatch' })
    expect(parseSyncRequest({ version: SYNC_FORMAT_VERSION, peerId: 'p', scope: [], headCid: 'x' })).toMatchObject({ error: expect.stringMatching(/cidVersion/) })
  })

  it('ignores nodes whose cid does not match their content', () => {
    const server = new FosStore()
    const req = { version: SYNC_FORMAT_VERSION, cidVersion: CURRENT_CID_VERSION, peerId: 'p', scope: [], baseCid: null, headCid: 'deadbeef', nodes: { deadbeef: { data: { description: { content: 'x' } }, children: [] } } }
    expect(serveSync(server, req, SERVER)).toMatchObject({ code: 'missing-nodes' })
    expect(server.table.has('deadbeef')).toBe(false)
  })
})

/** A user group (server store) plus helpers to play a device's round trip. */
class World {
  server = new FosStore()
  log: string[] = []

  sync(replica: Replica, now = 10_000): Replica {
    const request = buildSyncRequest(replica)
    const served = serveSync(this.server, request, 'user:alice', now)
    if ('error' in served) throw new Error(served.error)
    this.log.push(`${replica.meta.peerId}:${served.response.action}`)
    return completeSync(replica, request, served.response, now).replica
  }

  serverTasks(scope: string[] = []): string[] {
    const cid = resolveScope(this.server, rootTargetCid(this.server), scope)
    return cid ? viewNode(this.server, cid).tasks.map((t) => t.title) : []
  }
}

const titles = (r: Replica, at: string[] = []) => view(r, at)!.tasks.map((t) => t.title)

describe('replica + user group end to end', () => {
  it('offline edits on two devices converge after each syncs twice', () => {
    const world = new World()
    let phone = createReplica('phone')
    let laptop = createReplica('laptop')
    phone = addTask(phone, [], 'buy milk', 1, 'p1')
    laptop = addTask(laptop, [], 'write report', 2, 'l1')

    expect(isDirty(phone)).toBe(true)
    phone = world.sync(phone)
    expect(isDirty(phone)).toBe(false)
    laptop = world.sync(laptop)
    phone = world.sync(phone)

    expect(headCid(phone)).toBe(headCid(laptop))
    expect(headCid(phone)).toBe(rootTargetCid(world.server))
    expect(titles(phone)).toEqual(['buy milk', 'write report'])
    expect(world.log).toEqual(['phone:fast-forward', 'laptop:merge', 'phone:pull'])
    // both devices are registered as peers of the user group's root node
    expect(view(phone, [])!.peers.sort()).toEqual(['laptop', 'phone'])
  })

  it('serves a user store whose root is a bare content node (as the seed and registration create it)', () => {
    const world = new World()
    // mimic register.ts: the root is the workspace content itself, not an alias
    const workspace = put(world.server, { data: { description: { content: 'workspace' }, alias: { id: 'ws' } }, children: [] })
    world.server.rootNodeId = workspace
    expect(rootTargetCid(world.server)).toBe(workspace)

    let phone = createReplica('phone')
    phone = addTask(phone, [], 'first', 1, 'a')
    phone = world.sync(phone)
    expect(world.serverTasks()).toEqual(['first'])
    // the root is now an alias with history back to the bare root
    expect(rootTargetCid(world.server)).not.toBe(world.server.rootNodeId)
    expect(world.server.getPrevList(world.server.rootNodeId)).toContain(workspace)
    expect(viewNode(world.server, rootTargetCid(world.server)).name).toBe('workspace')
    phone = world.sync(addTask(phone, [], 'second', 2, 'b'))
    expect(world.serverTasks()).toEqual(['first', 'second'])
  })

  it('keeps history: the user group root alias links PREV to its previous version', () => {
    const world = new World()
    let phone = createReplica('phone')
    phone = addTask(phone, [], 'one', 1)
    phone = world.sync(phone)
    phone = addTask(phone, [], 'two', 2)
    phone = world.sync(phone)
    const root = content(world.server, world.server.rootNodeId)
    const prev = root.children.find(([i]) => i === world.server.primitive.previousVersion.getId())
    expect(prev).toBeDefined()
    expect(world.server.getPrevList(world.server.rootNodeId).length).toBeGreaterThanOrEqual(2)
  })

  it('surfaces a choice on every device and converges once it is resolved anywhere', () => {
    const world = new World()
    let phone = createReplica('phone')
    let laptop = createReplica('laptop')
    phone = addTask(phone, [], 'draft', 1, 't')
    phone = world.sync(phone)
    laptop = world.sync(laptop)

    phone = renameTask(phone, [], 't', 'draft v2 (phone)', 5)
    laptop = renameTask(laptop, [], 't', 'draft v2 (laptop)', 6)
    phone = world.sync(phone)
    laptop = world.sync(laptop)
    phone = world.sync(phone)

    expect(view(phone, [])!.choices).toHaveLength(1)
    expect(view(laptop, [])!.choices).toHaveLength(1)
    expect(titles(phone)).toEqual([])

    const choice = view(laptop, [])!.choices[0]!
    expect(choice.id).toBe('t')
    const laptopOption = choice.options.findIndex((o) => o.peerId === 'laptop')
    laptop = resolve(laptop, [], choice.id, laptopOption, 7)
    laptop = world.sync(laptop)
    phone = world.sync(phone)

    expect(view(phone, [])!.choices).toHaveLength(0)
    expect(titles(phone)).toEqual(['draft v2 (laptop)'])
    expect(headCid(phone)).toBe(headCid(laptop))
  })

  it('a device attached at a partition only sees and syncs that partition', () => {
    const world = new World()
    let laptop = createReplica('laptop')
    laptop = addTask(laptop, [], 'root task', 1, 'r1')
    laptop = addPartition(laptop, [], 'work', 2, 'work')
    laptop = addTask(laptop, ['work'], 'work task', 3, 'w1')
    laptop = world.sync(laptop)

    let workPhone = reattach(createReplica('work-phone'), ['work'], 4)
    workPhone = world.sync(workPhone)
    expect(titles(workPhone)).toEqual(['work task'])
    expect(view(workPhone, [])!.tasks.filter((t) => !t.checkable)).toEqual([])
    expect(view(workPhone, [])!.name).toBe('work')

    workPhone = addTask(workPhone, [], 'added on work phone', 5, 'w2')
    workPhone = setTaskDone(workPhone, [], 'w1', true, 6)
    workPhone = world.sync(workPhone)

    laptop = deleteTask(laptop, [], 'r1', 7)
    laptop = world.sync(laptop)
    expect(titles(laptop)).toEqual(['work']) // the plain node 'work' is a row like any other
    expect(view(laptop, ['work'])!.tasks.map((t) => [t.title, t.done])).toEqual([['work task', true], ['added on work phone', false]])
    expect(view(laptop, ['work'])!.peers).toEqual(['work-phone'])

    workPhone = world.sync(workPhone)
    expect(titles(workPhone)).toEqual(['work task', 'added on work phone'])
    expect(world.serverTasks()).toEqual(['work'])
  })

  it('reattaching a synced root replica into a partition keeps its agreed base; back to root pulls everything', () => {
    const world = new World()
    let laptop = createReplica('laptop')
    laptop = addPartition(laptop, [], 'work', 1, 'work')
    laptop = addTask(laptop, ['work'], 'w', 2, 'w1')
    laptop = world.sync(laptop)

    const scoped = reattach(laptop, ['work'], 3)
    expect(scoped.meta.scope).toEqual(['work'])
    expect(titles(scoped)).toEqual(['w'])
    expect(scoped.meta.baseCid).toBe(headCid(scoped))
    expect(isDirty(scoped)).toBe(false)

    let back = reattach(scoped, [], 6)
    expect(isDirty(back)).toBe(false)
    back = world.sync(back)
    expect(view(back, [])!.tasks.filter((t) => !t.checkable).map((t) => t.title)).toEqual(['work'])
    expect(titles(back, ['work'])).toEqual(['w'])
  })

  it('refuses to change scope with unsynced changes', () => {
    const world = new World()
    let r = world.sync(addPartition(createReplica('r'), [], 'work', 1, 'work'))
    r = addTask(r, [], 'x', 2)
    expect(() => reattach(r, ['work'], 3)).toThrow(/unsynced/)
  })

  it('an offline-first device merges with the account on first login without losing anything', () => {
    const world = new World()
    let laptop = createReplica('laptop')
    laptop = addTask(laptop, [], 'existing', 1, 'e1')
    laptop = world.sync(laptop)

    let tablet = createReplica('tablet')
    tablet = addTask(tablet, [], 'offline one', 2, 'o1')
    tablet = addTask(tablet, [], 'offline two', 3, 'o2')
    tablet = setTaskDone(tablet, [], 'o1', true, 4)

    tablet = world.sync(tablet)
    expect(view(tablet, [])!.tasks.map((t) => [t.id, t.done])).toEqual([['e1', false], ['o1', true], ['o2', false]])
    laptop = world.sync(laptop)
    expect(headCid(laptop)).toBe(headCid(tablet))
  })

  it('edits made during an in-flight request survive', () => {
    const world = new World()
    let phone = createReplica('phone')
    phone = addTask(phone, [], 'one', 1, 'a')

    const request = buildSyncRequest(phone)
    const served = serveSync(world.server, request, 'user:alice', 5)
    if ('error' in served) throw new Error(served.error)
    phone = addTask(phone, [], 'two', 2, 'b')
    const done = completeSync(phone, request, served.response, 5)
    expect(done.reMerged).toBe(true)
    expect(titles(done.replica)).toEqual(['one', 'two'])
    expect(isDirty(done.replica)).toBe(true)

    phone = world.sync(done.replica)
    expect(isDirty(phone)).toBe(false)
    expect(world.serverTasks()).toEqual(['one', 'two'])
  })

  it('responses only carry nodes the device is missing', () => {
    const world = new World()
    let phone = createReplica('phone')
    phone = addTask(phone, [], 'one', 1, 'a')
    phone = world.sync(phone)
    const request = buildSyncRequest(phone)
    const served = serveSync(world.server, request, 'user:alice', 5)
    if ('error' in served) throw new Error(served.error)
    expect(served.response.action).toBe('noop')
    expect(Object.keys(served.response.nodes)).toHaveLength(0)
    expect(Object.keys(request.nodes)).toHaveLength(0)
  })

  it('serializes to JSON and back, and tolerates garbage', () => {
    let r = createReplica('p')
    r = addTask(r, [], 'x', 1, 'x')
    const restored = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
    expect(headCid(restored)).toBe(headCid(r))
    expect(restored.meta.peerId).toBe('p')
    expect(titles(restored)).toEqual(['x'])
    expect(titles(loadReplica('nonsense'))).toEqual([])
    expect(titles(loadReplica({ meta: { peerId: 'q' }, context: { rootNodeId: 'missing', nodes: {} } }))).toEqual([])
  })

  it('the serialized replica stays bounded to what is reachable from head and base', () => {
    let r = createReplica('p')
    for (let i = 0; i < 20; i++) r = addTask(r, [], `task ${i}`, i, `t${i}`)
    const all = r.store.table.size
    const kept = Object.keys(serializeReplica(r).context.nodes).length
    expect(kept).toBeLessThanOrEqual(all)
    expect(loadReplica(JSON.parse(JSON.stringify(serializeReplica(r)))).store.getPrevList(r.store.rootNodeId).length).toBeGreaterThanOrEqual(20)
  })
})

// ---------------------------------------------------------------------------
// Tree, links and proposals

import {
  addMemberAt,
  applyProposalAt,
  makeLinkAt,
  moveNode,
  rejectProposalAt,
  removePeerAt
} from './replica'
import { hasCapability, linkHistory, readProposals, stripLink, content as nodeContent } from './graph'

const ids = (r: Replica, at: string[] = []) => view(r, at)!.tasks.map((t) => t.id)

describe('tree: subtasks, zoom and moves', () => {
  it('nests tasks, zooms into them and reports subtree counts', () => {
    let r = createReplica('p')
    r = addTask(r, [], 'parent', 1, 'P')
    r = addTask(r, ['P'], 'child one', 2, 'c1')
    r = addTask(r, ['P'], 'child two', 3, 'c2')
    r = setTaskDone(r, ['P'], 'c1', true, 4)
    r = addTask(r, ['P', 'c2'], 'grandchild', 5, 'g')
    const root = view(r, [])!
    expect(root.tasks[0]).toMatchObject({ id: 'P', childCount: 2, subtreeTasks: 3, subtreeDone: 1 })
    expect(ids(r, ['P'])).toEqual(['c1', 'c2'])
    expect(view(r, ['P', 'c2'])!.name).toBe('child two')
    expect(ids(r, ['P', 'c2'])).toEqual(['g'])
  })

  it('moves above, below and into, and refuses to move a node into its own subtree', () => {
    let r = createReplica('p')
    for (const [id, t] of [['a', 'A'], ['b', 'B'], ['c', 'C']] as const) r = addTask(r, [], t, 1, id)
    r = moveNode(r, [], 'c', [], { relativeTo: 'a', position: 'above' }, 2)
    expect(ids(r)).toEqual(['c', 'a', 'b'])
    r = moveNode(r, [], 'c', [], { relativeTo: 'b', position: 'below' }, 3)
    expect(ids(r)).toEqual(['a', 'b', 'c'])
    r = moveNode(r, [], 'c', [], { into: 'a' }, 4)
    expect(ids(r)).toEqual(['a', 'b'])
    expect(ids(r, ['a'])).toEqual(['c'])
    r = moveNode(r, ['a'], 'c', [], { relativeTo: 'a', position: 'above' }, 5)
    expect(ids(r)).toEqual(['c', 'a', 'b'])
    const before = headCid(r)
    r = moveNode(r, [], 'a', ['a'], { into: 'a' }, 6)
    expect(headCid(r)).toBe(before)
  })

  it('replicates order between devices', () => {
    const world = new World()
    let phone = createReplica('phone')
    for (const [id, t] of [['a', 'A'], ['b', 'B'], ['c', 'C']] as const) phone = addTask(phone, [], t, 1, id)
    phone = world.sync(phone)
    let laptop = world.sync(createReplica('laptop'))
    laptop = moveNode(laptop, [], 'c', [], { relativeTo: 'a', position: 'above' }, 2)
    laptop = world.sync(laptop)
    phone = world.sync(phone)
    expect(ids(phone)).toEqual(['c', 'a', 'b'])
  })
})

describe('link nodes: history, members and proposals', () => {
  function setup() {
    const world = new World()
    let owner = createReplica('owner-laptop')
    owner = addTask(owner, [], 'project', 1, 'proj')
    owner = addTask(owner, ['proj'], 'first', 2, 'f')
    owner = makeLinkAt(owner, ['proj'], 3)
    owner = addMemberAt(owner, ['proj'], 'guest', 'Guest phone', ['edit'], 3)
    owner = world.sync(owner)
    return { world, owner }
  }

  /** Round trip for a peer credential: the server runs in branch mode. */
  function peerSync(world: World, replica: Replica, now: number): Replica {
    const request = buildSyncRequest(replica)
    const served = serveSync(world.server, request, 'user:alice', now, { proposeOnly: true, peerName: 'Guest phone' })
    if ('error' in served) throw new Error(served.error)
    world.log.push(`${replica.meta.peerId}:${served.response.action}`)
    return completeSync(replica, request, served.response, now).replica
  }

  it('edits inside a link node record its previous versions', () => {
    const { owner } = setup()
    const linkCid = resolveScope(owner.store, headCid(owner), ['proj'])!
    expect(view(owner, ['proj'])!.isLink).toBe(true)
    // becoming a link and gaining members is bookkeeping, not a content version
    expect(linkHistory(owner.store, linkCid)).toHaveLength(0)
    const withMore = addTask(owner, ['proj'], 'second', 5, 's')
    const after = resolveScope(withMore.store, headCid(withMore), ['proj'])!
    expect(linkHistory(withMore.store, after)[0]).toBe(linkCid)
    expect(view(withMore, ['proj'])!.versions).toBeGreaterThan(view(owner, ['proj'])!.versions - 1)
  })

  it('a peer attached to a link proposes instead of changing; the owner approves and history is kept', () => {
    const { world, owner: owner0 } = setup()
    let owner = owner0
    let guest = reattach(createReplica('guest'), ['proj'], 4)
    guest = peerSync(world, guest, 5)                       // pulls the link node content
    expect(ids(guest)).toEqual(['f'])
    expect(view(guest, [])!.members.map((m) => m.peerId)).toEqual(['guest'])

    guest = addTask(guest, [], 'from guest', 6, 'g1')
    guest = peerSync(world, guest, 7)
    expect(world.log.at(-1)).toBe('guest:propose')
    expect(ids(guest)).toEqual(['f', 'g1'])                 // the guest keeps working on its branch
    expect(isDirty(guest)).toBe(false)
    expect(world.serverTasks(['proj'])).toEqual(['first']) // main is untouched

    owner = world.sync(owner)
    const node = view(owner, ['proj'])!
    expect(node.proposals).toHaveLength(1)
    expect(node.proposals[0]).toMatchObject({ peerId: 'guest', name: 'Guest phone', summary: { added: ['from guest'], changed: [], removed: [] } })
    expect(ids(guest)).toContain('g1')
    expect(view(guest, [])!.proposals.map((p) => p.peerId)).toEqual(['guest'])  // the guest sees its own proposal listed

    const versionsBefore = node.versions
    owner = applyProposalAt(owner, ['proj'], node.proposals[0]!.id, 'owner-laptop', 8)
    owner = world.sync(owner)
    expect(ids(owner, ['proj'])).toEqual(['f', 'g1'])
    expect(view(owner, ['proj'])!.proposals).toHaveLength(0)
    expect(view(owner, ['proj'])!.versions).toBeGreaterThan(versionsBefore)

    guest = peerSync(world, guest, 9)
    expect(world.log.at(-1)).toBe('guest:pull')
    expect(ids(guest)).toEqual(['f', 'g1'])
    expect(view(guest, [])!.proposals).toHaveLength(0)
  })

  it('rebases a proposal when main moves, and a rejection drops it', () => {
    const { world, owner: owner0 } = setup()
    let owner = owner0
    let guest = peerSync(world, reattach(createReplica('guest'), ['proj'], 4), 5)
    guest = renameTask(guest, [], 'f', 'first (guest)', 6)
    guest = peerSync(world, guest, 7)

    owner = addTask(owner, ['proj'], 'owner added', 8, 'o1')
    owner = world.sync(owner)
    guest = peerSync(world, guest, 9)                       // branch rebased onto the new main
    expect(ids(guest)).toEqual(['f', 'o1'])
    expect(view(guest, [])!.tasks.find((t) => t.id === 'f')?.title).toBe('first (guest)')

    owner = world.sync(owner)
    const proposal = view(owner, ['proj'])!.proposals[0]!
    expect(proposal.summary).toEqual({ added: [], changed: ['first (guest)'], removed: [] })
    owner = rejectProposalAt(owner, ['proj'], proposal.id, 10)
    owner = world.sync(owner)
    expect(view(owner, ['proj'])!.proposals.map((p) => p.status)).toEqual(['rejected'])
    expect(view(owner, ['proj'])!.tasks.find((t) => t.id === 'f')?.title).toBe('first')
    // the main content did not change, so rejecting adds no version
    const linkValue = nodeContent(owner.store, resolveScope(owner.store, headCid(owner), ['proj'])!)
    expect(readProposals(owner.store, linkValue)[0]?.status).toBe('rejected')
    expect(view(owner, ['proj'])!.tasks).toHaveLength(2)
    expect(stripLink(owner.store, linkValue).data.link).toBeUndefined()

    // the peer learns of the rejection and, without further edits, nothing reopens
    guest = peerSync(world, guest, 11)
    expect(view(guest, [])!.proposals.map((p) => [p.peerId, p.status])).toEqual([['guest', 'rejected']])
    expect(world.log.at(-1)).toBe('guest:pull')   // the rejection is bookkeeping the guest pulls; syncing again is a no-op
    guest = peerSync(world, guest, 11)
    expect(world.log.at(-1)).toBe('guest:noop')
    // a further edit reopens the proposal
    guest = addTask(guest, [], 'try again', 12, 'g2')
    guest = peerSync(world, guest, 13)
    expect(world.log.at(-1)).toBe('guest:propose')
    owner = world.sync(owner)
    expect(view(owner, ['proj'])!.proposals.map((p) => p.status)).toEqual(['open'])
  })

  it('a rejected proposal survives a rebase, and a second owner device does not resurrect replaced proposals', () => {
    const { world, owner: ownerA0 } = setup()
    let ownerA = ownerA0
    let ownerB = world.sync(createReplica('owner-phone'))          // synced before any proposal exists
    let guest = peerSync(world, reattach(createReplica('guest'), ['proj'], 4), 5)
    guest = renameTask(guest, [], 'f', 'first (guest)', 6)
    guest = peerSync(world, guest, 7)                                // proposal R (open)

    ownerA = world.sync(ownerA)
    const R = view(ownerA, ['proj'])!.proposals[0]!
    ownerA = rejectProposalAt(ownerA, ['proj'], R.id, 8)
    ownerA = world.sync(ownerA)

    // main moves (owner adds a task) → the guest's next sync rebases its branch: still rejected
    ownerA = addTask(ownerA, ['proj'], 'owner task', 9, 'o1')
    ownerA = world.sync(ownerA)
    guest = peerSync(world, guest, 10)
    expect(view(guest, [])!.proposals.map((p) => p.status)).toEqual(['rejected'])
    expect(ids(guest)).toEqual(['f', 'o1'])

    // the other owner device (which still holds nothing or an older proposal edge) merges: exactly one proposal
    ownerB = world.sync(ownerB)
    expect(view(ownerB, ['proj'])!.proposals.map((p) => p.status)).toEqual(['rejected'])
    ownerA = world.sync(ownerA)
    expect(view(ownerA, ['proj'])!.proposals).toHaveLength(1)

    // the guest edits → reopened, and still exactly one proposal everywhere
    guest = addTask(guest, [], 'retry', 11, 'g2')
    guest = peerSync(world, guest, 12)
    ownerA = world.sync(ownerA)
    ownerB = world.sync(ownerB)
    expect(view(ownerA, ['proj'])!.proposals.map((p) => p.status)).toEqual(['open'])
    expect(view(ownerB, ['proj'])!.proposals.map((p) => p.status)).toEqual(['open'])
    expect(view(ownerB, ['proj'])!.proposals[0]!.summary.added).toEqual(['retry'])
  })

  it('attaching another peer does not count as a content change of the link', () => {
    const { world, owner } = setup()
    let guest = peerSync(world, reattach(createReplica('guest'), ['proj'], 4), 5)
    guest = addTask(guest, [], 'g', 6, 'g1')
    guest = peerSync(world, guest, 7)
    const before = view(world.sync(owner), ['proj'])!.versions
    peerSync(world, reattach(createReplica('another-peer'), ['proj'], 8), 9)   // registers a PEER edge
    guest = peerSync(world, guest, 10)
    expect(world.log.at(-1)).toBe('guest:pull')                                  // bookkeeping changed (a new peer): the guest pulls it, no content moved
    expect(view(guest, [])!.peers.sort()).toEqual(['another-peer', 'guest'])
    guest = peerSync(world, guest, 11)
    expect(world.log.at(-1)).toBe('guest:noop')
    expect(view(world.sync(owner), ['proj'])!.versions).toBe(before)
  })

  it('member capabilities are [CAPABILITY, PROPOSE|APPROVE] edges on the member reference, not data', () => {
    const { owner } = setup()
    const withApprover = addMemberAt(owner, ['proj'], 'reviewer', 'Reviewer', ['edit', 'approve'], 5)
    const node = view(withApprover, ['proj'])!
    expect(node.members.map((m) => [m.peerId, m.capabilities])).toEqual([['guest', ['edit']], ['reviewer', ['edit', 'approve']]])
    const store = withApprover.store
    const linkValue = nodeContent(store, resolveScope(store, headCid(withApprover), ['proj'])!)
    const refs = linkValue.children.filter((e) => e[0] === store.primitive.memberField.getId()).map((e) => nodeContent(store, e[1]))
    const reviewer = refs.find((r) => r.data.peerId?.content === 'reviewer')!
    expect(reviewer.data).not.toHaveProperty('actor')
    expect(reviewer.children).toEqual([
      [store.primitive.capabilityNode.getId(), store.primitive.proposeAction.getId()],
      [store.primitive.capabilityNode.getId(), store.primitive.approveAction.getId()]
    ])
    expect(hasCapability(store, linkValue, 'reviewer', 'approve')).toBe(true)
    expect(hasCapability(store, linkValue, 'guest', 'approve')).toBe(false)
  })

  it('attachments persist across sessions; the owner can detach a device deliberately', () => {
    const { world, owner } = setup()
    let guest = peerSync(world, reattach(createReplica('guest'), ['proj'], 4), 5)
    let o = world.sync(owner)
    expect(view(o, ['proj'])!.peers).toEqual(['guest'])
    expect(view(o, ['proj'])!.members.map((m) => m.peerId)).toEqual(['guest'])
    const request = buildSyncRequest(guest)
    const served = serveSync(world.server, request, 'user:alice', 6, { proposeOnly: true, onlinePeers: ['guest'] })
    if ('error' in served) throw new Error(served.error)
    expect(served.response.presence).toEqual(['guest'])
    guest = completeSync(guest, request, served.response, 6).replica
    o = removePeerAt(o, ['proj'], 'guest', 7)
    o = world.sync(o)
    expect(view(o, ['proj'])!.peers).toEqual([])
    expect(view(o, ['proj'])!.members).toEqual([])
  })

  it('one peer can hold several branches, each its own proposal (git branches of a checkout)', () => {
    const { world, owner } = setup()
    const peerSyncOn = (replica: Replica, branch: string, now: number) => {
      const request = buildSyncRequest(replica, branch)
      const served = serveSync(world.server, request, 'user:alice', now, { proposeOnly: true, peerName: 'Repo' })
      if ('error' in served) throw new Error(served.error)
      return completeSync(replica, request, served.response, now).replica
    }
    let main = peerSyncOn(reattach(createReplica('repo'), ['proj'], 4), 'main', 5)
    let feature = peerSyncOn(reattach(createReplica('repo'), ['proj'], 4), 'feature', 6)
    main = setTaskDone(main, [], 'f', true, 7)                 // done on main …
    feature = addTask(feature, [], 'feature work', 8, 'fw')   // … something else on the feature branch
    main = peerSyncOn(main, 'main', 9)
    feature = peerSyncOn(feature, 'feature', 10)
    const o = world.sync(owner)
    const proposals = view(o, ['proj'])!.proposals
    expect(proposals.map((p) => [p.peerId, p.name, p.summary.changed, p.summary.added])).toEqual([
      ['repo', 'main', ['first'], []],
      ['repo', 'feature', [], ['feature work']]
    ])
    expect(view(main, [])!.tasks.find((t) => t.id === 'f')?.done).toBe(true)
    expect(view(feature, [])!.tasks.find((t) => t.id === 'f')?.done).toBe(false)
    main = addTask(main, [], 'more on main', 11, 'mm')
    main = peerSyncOn(main, 'main', 12)
    expect(view(world.sync(o), ['proj'])!.proposals.map((p) => p.name).sort()).toEqual(['feature', 'main'])
  })

  it('the owner’s own devices still merge directly at a link node', () => {
    const { world, owner: owner0 } = setup()
    let other = world.sync(createReplica('owner-phone'))
    other = addTask(other, ['proj'], 'from phone', 5, 'p1')
    other = world.sync(other)
    expect(world.serverTasks(['proj'])).toEqual(['first', 'from phone'])
    const owner = world.sync(owner0)
    expect(view(owner, ['proj'])!.proposals).toHaveLength(0)
  })
})

describe('row kinds', () => {
  it('rows of every kind live in one ordered list; only tasks are checkable', () => {
    let r = createReplica('d')
    r = addRow(r, [], 'plain', 'a thought', 1, { id: 'p' })
    r = addRow(r, [], 'task', 'do it', 2, { id: 't' })
    r = addRow(r, [], 'note', '# Title\n\nbody with {{who}}', 3, { id: 'n' })
    r = addRow(r, ['n'], 'plain', 'who: Ada', 4, { id: 'kv' })
    r = addRow(r, [], 'comment', 'nice', 5, { id: 'c', author: { id: 'peer-1', name: 'Ada' } })
    r = addRow(r, ['c'], 'comment', 'reply', 6, { id: 'c2' })
    const v = view(r, [])!
    expect(v.tasks.map((t) => [t.id, t.kind, t.checkable])).toEqual([['p', 'plain', false], ['t', 'task', true], ['n', 'note', false], ['c', 'comment', false]])
    expect(v.tasks.find((t) => t.id === 'n')!.title).toBe('# Title\n\nbody with {{who}}')
    expect(v.tasks.find((t) => t.id === 'c')!.author).toMatchObject({ name: 'Ada' })
    expect(view(r, ['c'])!.tasks.map((t) => t.kind)).toEqual(['comment'])
    // a plain row cannot be completed; converting it to a task makes it checkable
    expect(view(setTaskDone(r, [], 'p', true, 7), [])!.tasks[0]).toMatchObject({ id: 'p', done: false, checkable: false })
    r = setRowKind(r, [], 'p', 'task', 8)
    r = setTaskDone(r, [], 'p', true, 9)
    expect(view(r, [])!.tasks[0]).toMatchObject({ id: 'p', kind: 'task', done: true })
    // and back to plain drops the completion
    r = setRowKind(r, [], 'p', 'plain', 10)
    expect(view(r, [])!.tasks[0]).toMatchObject({ id: 'p', kind: 'plain', done: false, checkable: false })
    // rename/delete work on any kind
    r = renameTask(r, [], 'c', 'nicer', 11)
    expect(view(r, [])!.tasks.find((t) => t.id === 'c')!.title).toBe('nicer')
    r = deleteTask(r, [], 'n', 12)
    expect(view(r, [])!.tasks.map((t) => t.id)).toEqual(['p', 't', 'c'])
  })

  it('references point at rows anywhere in the tree and resolve to their path; copies get fresh ids', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'project', 1, 'proj')
    r = addTask(r, ['proj'], 'design', 2, 'des')
    r = addTask(r, ['proj', 'des'], 'sketch', 3, 'sk')
    r = addTask(r, [], 'today', 4, 'today')
    r = addRef(r, ['today'], 'sk', 5)
    const refRow = view(r, ['today'])!.tasks[0]!
    expect(refRow.kind).toBe('ref')
    expect(refRow.refId).toBe('sk')
    expect(resolveRef(r, 'sk')).toMatchObject({ path: ['proj', 'des'], row: { id: 'sk', title: 'sketch' } })
    expect(resolveRef(r, 'nope')).toBeNull()
    // a ref placed above a sibling
    r = addRef(r, [], 'des', 6, { relativeTo: 'today', position: 'above' })
    expect(view(r, [])!.tasks.map((t) => t.kind)).toEqual(['task', 'ref', 'task'])
    // copying the project subtree next to it: same titles, new ids, independent afterwards
    r = copyNode(r, [], 'proj', [], { relativeTo: 'proj', position: 'below' }, 7)
    const top = view(r, [])!.tasks
    expect(top.map((t) => t.title)).toEqual(['project', 'project', '', 'today'])
    const copyId = top[1]!.id
    expect(copyId).not.toBe('proj')
    expect(view(r, [copyId])!.tasks.map((t) => t.title)).toEqual(['design'])
    const copiedDesign = view(r, [copyId])!.tasks[0]!.id
    expect(copiedDesign).not.toBe('des')
    r = renameTask(r, [copyId], copiedDesign, 'design v2', 8)
    expect(view(r, ['proj'])!.tasks[0]!.title).toBe('design')
    // copy into a node
    r = copyNode(r, ['proj', 'des'], 'sk', [], { into: 'today' }, 9)
    expect(view(r, ['today'])!.tasks.map((t) => [t.kind, t.title])).toEqual([['ref', ''], ['task', 'sketch']])
  })

  it('mixed row kinds merge like tasks: both sides adding different kinds keeps all of them in order', () => {
    const world = new World()
    let a = createReplica('A')
    a = addRow(a, [], 'note', 'shared note', 1, { id: 'n' })
    a = world.sync(a)
    let b = world.sync(createReplica('B'))
    a = addRow(a, [], 'comment', 'from A', 2, { id: 'ca' })
    b = addRow(b, [], 'plain', 'from B', 3, { id: 'pb' })
    b = setRowKind(b, [], 'n', 'task', 4) // B turns the note into a task
    a = world.sync(a); b = world.sync(b); a = world.sync(a)
    const kinds = (r: Replica) => view(r, [])!.tasks.map((t) => [t.id, t.kind])
    expect(kinds(a)).toEqual(kinds(b))
    expect(kinds(a)).toEqual([['n', 'task'], ['ca', 'comment'], ['pb', 'plain']])
    expect(view(a, [])!.choices).toEqual([])
  })
})

describe('approval convergence', () => {
  it('after the owner approves a proposal (server side), the owner device pulls once and then syncs as noop', () => {
    const world = new World()
    let owner = createReplica('owner')
    owner = addTask(owner, [], 'project', 1, 'proj')
    owner = makeLinkAt(owner, ['proj'], 2)
    owner = addMemberAt(owner, ['proj'], 'guest', 'Guest', ['edit'], 2)
    owner = world.sync(owner)
    let guest = reattach(createReplica('guest'), ['proj'], 3)
    const peerSync = (r: Replica, now: number) => {
      const request = buildSyncRequest(r)
      const served = serveSync(world.server, request, 'user:alice', now, { proposeOnly: true, peerName: 'Guest' })
      if ('error' in served) throw new Error(served.error)
      return completeSync(r, request, served.response, now).replica
    }
    guest = peerSync(guest, 4)
    guest = addRow(guest, [], 'task', 'from guest', 5, { id: 'g1' })
    guest = peerSync(guest, 6)
    owner = world.sync(owner, 7)
    const proposals = view(owner, ['proj'])!.proposals
    expect(proposals).toHaveLength(1)
    // the server applies the proposal (what POST /peer-sync/proposals does), then the owner syncs
    const serverReplica: Replica = { store: world.server, meta: { version: SYNC_FORMAT_VERSION, peerId: 'user:alice', scope: [], scopeNames: [], baseCid: null, lastSyncAt: null, serverPeerId: null } }
    applyProposalAt(serverReplica, ['proj'], proposals[0]!.id, 'user:alice', 8)
    owner = world.sync(owner, 9)
    expect(world.log.at(-1)).toBe('owner:pull')
    expect(view(owner, ['proj'])!.tasks.map((t) => t.title)).toEqual(['from guest'])
    expect(view(owner, ['proj'])!.proposals).toEqual([])
    owner = world.sync(owner, 10)
    expect(world.log.at(-1)).toBe('owner:noop')
    expect(() => buildSyncRequest(owner)).not.toThrow()
    guest = peerSync(guest, 11)
    expect(view(guest, [])!.tasks.map((t) => t.title)).toEqual(['from guest'])
  })
})

describe('mutable references: root, link rows and reference rows are one node shape', () => {
  it('a link row, the root alias and a reference row are all ref nodes (TARGETPOINTER + PREV history)', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'project', 1, 'proj')
    r = addTask(r, ['proj'], 'design', 2, 'des')
    r = makeLinkAt(r, ['proj'], 3)
    const store = r.store
    // the root alias
    expect(isRefNode(store, content(store, store.rootNodeId))).toBe(true)
    // the link row's identity node: a ref node whose value holds the text and rows
    const projCid = resolveScope(store, headCid(r), ['proj'])!
    const proj = content(store, projCid)
    expect(isRefNode(store, proj)).toBe(true)
    expect(isHandle(proj)).toBe(false)
    expect(proj.data.alias?.id).toBe('proj')
    expect(proj.data.description).toBeUndefined()
    expect(valueContent(store, projCid).data.description?.content).toBe('project')
    expect(view(r, ['proj'])!.tasks.map((t) => t.title)).toEqual(['design'])
    expect(view(r, [])!.tasks[0]).toMatchObject({ id: 'proj', kind: 'task', title: 'project', isLink: true })
    // editing inside the link advances the ref: new ref node, PREV → the old one, same value shape
    const before = projCid
    r = addTask(r, ['proj'], 'build', 4, 'b')
    const after = resolveScope(store, headCid(r), ['proj'])!
    expect(after).not.toBe(before)
    expect(linkHistory(store, after)).toEqual([before])
    expect(isRefNode(store, content(store, after))).toBe(true)
    expect(view(r, ['proj'])!.versions).toBe(1)
    // a reference row to a plain row turns that row into a ref node and snapshots it
    r = addTask(r, [], 'today', 5, 'today')
    r = addRef(r, ['today'], 'des', 6)
    const des = resolveScope(store, headCid(r), ['proj', 'des'])!
    expect(isRefNode(store, content(store, des))).toBe(true)
    expect(view(r, ['proj'])!.tasks[0]).toMatchObject({ id: 'des', isLink: true, kind: 'task' })
    const handleRow = view(r, ['today'])!.tasks[0]!
    expect(handleRow.kind).toBe('ref')
    const handleCid = resolveScope(store, headCid(r), ['today', handleRow.id])!
    const handle = content(store, handleCid)
    expect(isRefNode(store, handle) && isHandle(handle)).toBe(true)
    expect(refValueCid(store, handle)).toBe(des)
    // the handle resolves live: renaming the target shows through
    r = renameTask(r, ['proj'], 'des', 'design v2', 7)
    expect(resolveRef(r, 'des')?.row.title).toBe('design v2')
    expect(view(r, ['today'])!.tasks[0]!.kind).toBe('ref') // the handle's own value is never followed as content
  })

  it('legacy inline link nodes are rewritten into ref nodes on load, keeping members, peers and history', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'shared', 1, 'sh')
    r = addTask(r, ['sh'], 'one', 2, 'o1')
    const store = r.store
    // hand-build the old shape: the content node itself carries data.link and the bookkeeping edges
    const shCid = resolveScope(store, headCid(r), ['sh'])!
    const inline = content(store, shCid)
    const olderVersion = put(store, { ...inline, data: { ...inline.data, link: { createdAt: 0 }, description: { content: 'shared (old)' } } })
    const legacy = put(store, {
      data: { ...inline.data, link: { createdAt: 0 } },
      children: [...inline.children,
        [store.primitive.memberField.getId(), put(store, { data: { peerId: { content: 'guest' } }, children: [[store.primitive.capabilityNode.getId(), store.primitive.proposeAction.getId()]] })],
        [store.primitive.peerField.getId(), put(store, { data: { peerId: { content: 'guest' } }, children: [] })],
        [store.primitive.previousVersion.getId(), olderVersion]]
    })
    const rootValue = content(store, headCid(r))
    const edge = rootValue.children.find((e) => edgeKey(store, e) === 'a:sh')!
    const legacyRoot = put(store, { ...rootValue, children: rootValue.children.map((e) => (e === edge ? [legacy, e[1]] as FosPathElem : e)) })
    commitRoot(store, legacyRoot, 3)
    expect(isLegacyInlineLink(store, content(store, resolveScope(store, headCid(r), ['sh'])!))).toBe(true)
    // reading still works before normalization
    expect(view(r, ['sh'])!).toMatchObject({ isLink: true, name: 'shared' })
    expect(view(r, ['sh'])!.members.map((m) => m.peerId)).toEqual(['guest'])
    // a serialized replica is normalized when loaded
    const loaded = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
    const shNow = resolveScope(loaded.store, headCid(loaded), ['sh'])!
    const node = content(loaded.store, shNow)
    expect(isRefNode(loaded.store, node)).toBe(true)
    expect(node.data.link).toBeUndefined()
    expect(stripLink(loaded.store, node).data.description?.content).toBe('shared')
    expect(view(loaded, ['sh'])!).toMatchObject({ isLink: true, name: 'shared', versions: 1, peers: ['guest'] })
    expect(view(loaded, ['sh'])!.members.map((m) => m.peerId)).toEqual(['guest'])
    expect(view(loaded, ['sh'])!.tasks.map((t) => t.title)).toEqual(['one'])
    // and it keeps working as a link: edits advance it
    const edited = addTask(loaded, ['sh'], 'two', 4, 'o2')
    expect(view(edited, ['sh'])!.versions).toBe(2)
    expect(normalizeRefs(edited.store, headCid(edited))).toBe(headCid(edited)) // idempotent
  })
})

describe('requirements, supplies, resource banks and market listings', () => {
  it('a task with unsatisfied requirements cannot be completed; supplies satisfy them', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'ship it', 1, 't')
    r = addRow(r, ['t'], 'requirement', 'confirmation', 2, { id: 'rq1', requirement: { capability: 'confirmation' } })
    r = addRow(r, ['t'], 'requirement', 'choice', 3, { id: 'rq2', requirement: { capability: 'choice', options: ['fast', 'cheap'] } })
    let task = view(r, [])!.tasks[0]!
    expect(task.blockedBy).toEqual(['confirmation', 'choice (fast | cheap)'])
    expect(view(r, ['t'])!.tasks.map((x) => [x.kind, x.requirement?.satisfied])).toEqual([['requirement', false], ['requirement', false]])
    // completion is refused while blocked
    r = setTaskDone(r, [], 't', true, 4)
    expect(view(r, [])!.tasks[0]!.done).toBe(false)
    r = addSupply(r, ['t'], 'rq1', { capability: 'confirmation', by: 'ada@x' }, 5)
    r = addSupply(r, ['t'], 'rq2', { capability: 'choice', by: 'ada@x', choice: 1 }, 6)
    task = view(r, [])!.tasks[0]!
    expect(task.blockedBy).toBeUndefined()
    expect(view(r, ['t', 'rq1'])!.tasks[0]).toMatchObject({ kind: 'supply', supply: { capability: 'confirmation', by: 'ada@x' } })
    r = setTaskDone(r, [], 't', true, 7)
    expect(view(r, [])!.tasks[0]!.done).toBe(true)
    // a supply of the wrong capability does not count
    let r2 = addRow(createReplica('e'), [], 'task', 'x', 1, { id: 'x' })
    r2 = addRow(r2, ['x'], 'requirement', 'confirmation', 2, { id: 'q', requirement: { capability: 'confirmation' } })
    r2 = addSupply(r2, ['x'], 'q', { capability: 'choice', by: 'bob', choice: 0 }, 3)
    expect(view(r2, [])!.tasks[0]!.blockedBy).toEqual(['confirmation'])
  })

  it('resource banks track allocations (sub-banks included); an allocation reference satisfies an allocation requirement', () => {
    let r = createReplica('d')
    r = addRow(r, [], 'resource', 'Week 42', 1, { id: 'cal', resource: { type: 'calendar', unit: 'h', capacity: 40 } })
    r = addRow(r, ['cal'], 'allocation', 'planning', 2, { id: 'a1', allocation: { resource: 'cal', type: 'calendar', amount: 1, unit: 'h', start: 1760000000000 } })
    r = addRow(r, ['cal'], 'resource', 'Mornings', 3, { id: 'sub', resource: { type: 'calendar', unit: 'h' } })
    r = addRow(r, ['cal', 'sub'], 'allocation', 'standups', 4, { id: 'a2', allocation: { resource: 'sub', type: 'calendar', amount: 2.5, unit: 'h' } })
    const bank = view(r, [])!.tasks[0]!
    expect(bank.resource).toMatchObject({ type: 'calendar', capacity: 40, allocated: 3.5, available: 36.5 })
    expect(view(r, ['cal'])!.tasks.find((t) => t.id === 'sub')!.resource).toMatchObject({ allocated: 2.5, available: null })
    // a task requiring 1h of calendar; supplied with a reference to the allocation
    r = addTask(r, [], 'interview', 5, 't')
    r = addRow(r, ['t'], 'requirement', 'calendar 1 h', 6, { id: 'rq', requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' } })
    expect(view(r, [])!.tasks[1]!.blockedBy).toEqual(['calendar 1 h'])
    r = addSupply(r, ['t'], 'rq', { capability: 'allocation', by: 'ada', ref: 'a1' }, 7)
    expect(view(r, [])!.tasks[1]!.blockedBy).toBeUndefined()
    // too small an allocation does not satisfy a larger requirement
    r = addRow(r, ['t'], 'requirement', 'calendar 2 h', 8, { id: 'rq2', requirement: { capability: 'allocation', resource: 'calendar', amount: 2, unit: 'h' } })
    r = addSupply(r, ['t'], 'rq2', { capability: 'allocation', by: 'ada', ref: 'a1' }, 9)
    expect(view(r, [])!.tasks[1]!.blockedBy).toEqual(['calendar 2 h'])
    r = addSupply(r, ['t'], 'rq2', { capability: 'allocation', by: 'ada', ref: 'a2' }, 10)
    expect(view(r, [])!.tasks[1]!.blockedBy).toBeUndefined()
  })

  it('listing on the market is a flag on the ref node (bookkeeping, no version); queries carry their options', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'offer', 1, 'o')
    r = makeLinkAt(r, ['o'], 2)
    const before = view(r, ['o'])!.versions
    r = setMarketAt(r, ['o'], true, 3, 'ada@x')
    expect(view(r, [])!.tasks[0]!.market).toBe(true)
    expect(view(r, ['o'])!.versions).toBe(before)
    r = setMarketAt(r, ['o'], false, 4)
    expect(view(r, [])!.tasks[0]!.market).toBeUndefined()
    // listing a plain row makes it a link first
    r = addTask(r, [], 'plain offer', 5, 'p')
    r = setMarketAt(r, ['p'], true, 6)
    expect(view(r, [])!.tasks[1]).toMatchObject({ isLink: true, market: true })
    r = addRow(r, [], 'query', 'designers near me', 7, { id: 'q', query: {} })
    r = setQueryOptionsAt(r, [], 'q', { market: true, executedAt: 8, count: 3 }, 8)
    expect(view(r, [])!.tasks[2]!.query).toEqual({ market: true, executedAt: 8, count: 3 })
  })

  it('a requirement is filled by a child row of the kind it names: a done task, an allocation, a run query', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'host dinner', 1, 't')
    r = addRow(r, ['t'], 'requirement', 'book a table', 2, { id: 'rt', requirement: { capability: 'task' } })
    r = addRow(r, ['t'], 'requirement', 'groceries', 3, { id: 'ra', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
    r = addRow(r, ['t'], 'requirement', 'recipes', 4, { id: 'rs', requirement: { capability: 'search' } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['task', 'account 50 USD', 'search'])
    // "-[ ]": a task inside, checked off
    r = addTask(r, ['t', 'rt'], 'call the restaurant', 5, 'sub')
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['task', 'account 50 USD', 'search'])
    r = setTaskDone(r, ['t', 'rt'], 'sub', true, 6)
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['account 50 USD', 'search'])
    // "-$ 50": a "$" allocation inside; too small does not count, enough does
    r = addRow(r, ['t', 'ra'], 'allocation', 'deposit', 7, { id: 'a1', allocation: { resource: 'bank', type: 'account', amount: 20, unit: 'USD' } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['account 50 USD', 'search'])
    r = addRow(r, ['t', 'ra'], 'allocation', 'the rest', 8, { id: 'a2', allocation: { resource: 'bank', type: 'account', amount: 50, unit: 'USD' } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['search'])
    // "-?": a query inside that has been run
    r = addRow(r, ['t', 'rs'], 'query', 'easy dinner recipes', 9, { id: 'q', query: {} })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['search'])
    r = setQueryOptionsAt(r, ['t', 'rs'], 'q', { executedAt: 10, count: 2 }, 10)
    expect(view(r, [])!.tasks[0]!.blockedBy).toBeUndefined()
    r = setTaskDone(r, [], 't', true, 11)
    expect(view(r, [])!.tasks[0]!.done).toBe(true)
  })

  it('peer, market and mail requirements are filled by a supply of that capability; "-@name" waits for that peer', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'review the deck', 1, 't')
    r = addRow(r, ['t'], 'requirement', 'give feedback', 2, { id: 'rp', requirement: { capability: 'peer', peer: 'bob' } })
    r = addRow(r, ['t'], 'requirement', 'find a printer', 3, { id: 'rm', requirement: { capability: 'market' } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['@bob', 'market'])
    r = addSupply(r, ['t'], 'rp', { capability: 'peer', by: 'ada' }, 4)
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['@bob', 'market']) // someone else confirming does not count
    r = addSupply(r, ['t'], 'rp', { capability: 'peer', by: 'bob' }, 5)
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['market'])
    r = addSupply(r, ['t'], 'rm', { capability: 'market', by: 'fos', ref: 't' }, 6)
    expect(view(r, [])!.tasks[0]!.blockedBy).toBeUndefined()
    expect(view(r, ['t', 'rm'])!.tasks[0]).toMatchObject({ kind: 'supply', title: 'listed on the market by fos' })
  })

  it('a template copies its subtree with unfilled requirements and remembers its source', () => {
    let r = createReplica('d')
    r = addRow(r, [], 'template', 'Trip', 1, { id: 'tpl' })
    r = addRow(r, ['tpl'], 'requirement', 'budget', 2, { id: 'r1', requirement: { capability: 'allocation', resource: 'account', amount: 300, unit: 'USD' } })
    r = addRow(r, ['tpl'], 'requirement', 'book transport', 3, { id: 'r2', requirement: { capability: 'task' } })
    r = addRow(r, ['tpl'], 'plain', 'packing notes', 4, { id: 'p' })
    expect(view(r, [])!.tasks[0]).toMatchObject({ kind: 'template', title: 'Trip', checkable: false })
    expect(findTemplateByName(r, 'trip')?.row.id).toBe('tpl')
    expect(findTemplateByName(r, 'nope')).toBeNull()
    // two executions, each with its own copies
    r = addTask(r, [], 'Trip to Oslo', 5, 'e1')
    r = instantiateTemplate(r, [], 'e1', 'tpl', 6)
    r = addTask(r, [], 'Trip to Rome', 7, 'e2')
    r = instantiateTemplate(r, [], 'e2', 'tpl', 8)
    const oslo = view(r, [])!.tasks.find((t) => t.id === 'e1')!
    expect(oslo.template).toEqual({ id: 'tpl', name: 'Trip' })
    expect(oslo.blockedBy).toEqual(['account 300 USD', 'task'])
    const copies = view(r, ['e1'])!.tasks
    expect(copies.map((c) => [c.kind, c.title, c.requirement?.satisfied])).toEqual([['requirement', 'budget', false], ['requirement', 'book transport', false], ['plain', 'packing notes', undefined]])
    expect(copies.map((c) => c.id)).not.toContain('r1')
    expect(view(r, ['e2'])!.tasks.map((c) => c.id)).not.toEqual(copies.map((c) => c.id))
    // filling one execution leaves the other and the template untouched
    r = addRow(r, ['e1', copies[0]!.id], 'allocation', 'fund', 9, { allocation: { resource: 'b', type: 'account', amount: 300, unit: 'USD' } })
    expect(view(r, [])!.tasks.find((t) => t.id === 'e1')!.blockedBy).toEqual(['task'])
    expect(view(r, [])!.tasks.find((t) => t.id === 'e2')!.blockedBy).toEqual(['account 300 USD', 'task'])
    expect(view(r, ['tpl'])!.tasks.map((c) => c.requirement?.satisfied)).toEqual([false, false, undefined])
    // a template name that is not a template, or a non-task, changes nothing
    expect(instantiateTemplate(r, [], 'e1', 'p', 10)).toBe(r)
    expect(instantiateTemplate(r, [], 'p', 'tpl', 11)).toBe(r)
  })
})

describe('allocations: amounts add up, people allocate themselves, rows are rewritten in place', () => {
  it('an allocation requirement reports how much is covered; smaller allocations add up to fill it', () => {
    let r = createReplica('d')
    r = addRow(r, [], 'resource', 'Travel', 1, { id: 'bank', resource: { type: 'account', unit: 'USD', capacity: 1000 } })
    r = addRow(r, ['bank'], 'allocation', 'deposit', 2, { id: 'a1', allocation: { resource: 'bank', type: 'account', amount: 30, unit: 'USD' } })
    r = addTask(r, [], 'dinner', 3, 't')
    r = addRow(r, ['t'], 'requirement', 'groceries', 4, { id: 'rq', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ satisfied: false, have: 0, need: 50 })
    // a supplied reference to the bank's allocation covers part of it
    r = addSupply(r, ['t'], 'rq', { capability: 'allocation', by: 'ada', ref: 'a1' }, 5)
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ satisfied: false, have: 30, need: 50 })
    // an allocation typed inside it covers the rest; a time allocation does not count towards money
    r = addRow(r, ['t', 'rq'], 'allocation', 'tip', 6, { id: 'a2', allocation: { resource: 'bank', type: 'calendar', amount: 500, unit: 'h' } })
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ satisfied: false, have: 30 })
    r = addRow(r, ['t', 'rq'], 'allocation', 'the rest', 7, { id: 'a3', allocation: { resource: 'bank', type: 'account', amount: 20, unit: 'USD', start: 1760000000000 } })
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ satisfied: true, have: 50, need: 50 })
    expect(view(r, [])!.tasks[1]!.blockedBy).toBeUndefined()
  })

  it('"-@bob" is filled when bob allocates himself inside it ("@bob 2h"), not by someone else', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'review', 1, 't')
    r = addRow(r, ['t'], 'requirement', 'read the draft', 2, { id: 'rq', requirement: { capability: 'peer', peer: 'bob' } })
    r = addRow(r, ['t', 'rq'], 'allocation', '', 3, { id: 'a1', allocation: { resource: '', type: 'person', amount: 2, unit: 'h', person: 'ada' } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toEqual(['@bob'])
    r = addRow(r, ['t', 'rq'], 'allocation', '', 4, { id: 'a2', allocation: { resource: '', type: 'person', amount: 2, unit: 'h', person: 'bob', start: 1760000000000, end: 1760007200000 } })
    expect(view(r, [])!.tasks[0]!.blockedBy).toBeUndefined()
    expect(view(r, ['t', 'rq'])!.tasks[1]!.allocation).toMatchObject({ type: 'person', person: 'bob', start: 1760000000000 })
  })

  it('setRowContentAt rewrites a row from re-parsed text in place: kind, text and data change, id and children stay', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'plan', 1, 't')
    r = addRow(r, ['t'], 'requirement', 'lunch', 2, { id: 'rq', requirement: { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' } })
    r = addRow(r, ['t', 'rq'], 'comment', 'any place is fine', 3, { id: 'c' })
    // "-$ 50 lunch" edited to "-: 1h lunch walk": same row, now a time requirement
    r = setRowContentAt(r, ['t'], 'rq', 'requirement', 'lunch walk', { requirement: { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' } }, 4)
    const row = view(r, ['t'])!.tasks[0]!
    expect(row).toMatchObject({ id: 'rq', kind: 'requirement', title: 'lunch walk', childCount: 1, requirement: { resource: 'calendar', amount: 1, unit: 'h' } })
    expect(view(r, ['t', 'rq'])!.tasks[0]).toMatchObject({ id: 'c', kind: 'comment', title: 'any place is fine' })
    // edited to "[x] lunch walk": a done task, still with its child
    r = setRowContentAt(r, ['t'], 'rq', 'task', 'lunch walk', { done: true }, 5)
    expect(view(r, ['t'])!.tasks[0]).toMatchObject({ id: 'rq', kind: 'task', done: true, childCount: 1 })
    expect(view(r, ['t'])!.tasks[0]!.requirement).toBeUndefined()
    // and back to plain text
    r = setRowContentAt(r, ['t'], 'rq', 'plain', 'just a note', {}, 6)
    expect(view(r, ['t'])!.tasks[0]).toMatchObject({ id: 'rq', kind: 'plain', title: 'just a note', checkable: false })
  })
})

describe('peer capabilities', () => {
  it('a member row carries what the owner exposes to that peer (connection kinds and services as CAPABILITY edges); switched-off ones stay visible but do not count', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'shared project', 1, 'p')
    r = addMemberAt(r, ['p'], 'user:bob', 'bob', ['edit', 'direct', 'search'], 2)
    expect(view(r, ['p'])!.members).toEqual([{ peerId: 'user:bob', name: 'bob', capabilities: ['edit', 'direct', 'search'] }])
    const before = view(r, ['p'])!.versions
    r = setMemberCapabilitiesAt(r, ['p'], 'user:bob', ['edit', 'direct', 'search', 'relay'], ['search'], 3)
    expect(view(r, ['p'])!.members[0]).toEqual({ peerId: 'user:bob', name: 'bob', capabilities: ['edit', 'direct', 'search', 'relay'], disabled: ['search'] })
    expect(view(r, ['p'])!.versions).toBe(before) // bookkeeping on the ref node: no version
    const node = content(r.store, resolveScope(r.store, headCid(r), ['p'])!)
    expect(hasCapability(r.store, node, 'user:bob', 'search')).toBe(false)
    expect(hasCapability(r.store, node, 'user:bob', 'relay')).toBe(true)
    expect(hasCapability(r.store, node, 'user:bob', 'mail')).toBe(false)
    // a disabled name that is not granted is dropped; removing the member drops every row
    r = setMemberCapabilitiesAt(r, ['p'], 'user:bob', ['edit'], ['relay'], 4)
    expect(view(r, ['p'])!.members[0]).toEqual({ peerId: 'user:bob', name: 'bob', capabilities: ['edit'] })
    r = removeMemberAt(r, ['p'], 'user:bob', 5)
    expect(view(r, ['p'])!.members).toEqual([])
  })

  it('the from direction: what the owner accepts from a member is ACCEPTS edges on the same reference', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'inbox', 1, 'i')
    r = addMemberAt(r, ['i'], 'user:bob', 'bob', ['read'], 2)
    r = setMemberCapabilitiesAt(r, ['i'], 'user:bob', ['read'], [], 3, ['edit', 'relay'])
    expect(view(r, ['i'])!.members[0]).toEqual({ peerId: 'user:bob', name: 'bob', capabilities: ['read'], accepts: ['edit', 'relay'] })
    const node = content(r.store, resolveScope(r.store, headCid(r), ['i'])!)
    expect(acceptsFrom(r.store, node, 'user:bob', 'edit')).toBe(true)
    expect(acceptsFrom(r.store, node, 'user:bob', 'autopush')).toBe(false)
    expect(hasCapability(r.store, node, 'user:bob', 'edit')).toBe(false) // accepting is not granting
    // changing the to side keeps the from side
    r = setMemberCapabilitiesAt(r, ['i'], 'user:bob', ['read', 'http'], ['http'], 4)
    expect(view(r, ['i'])!.members[0]).toEqual({ peerId: 'user:bob', name: 'bob', capabilities: ['read', 'http'], disabled: ['http'], accepts: ['edit', 'relay'] })
  })

  it('a receive-only policy: the sync request carries no local content, the pull still merges in, local edits stay local', () => {
    const SERVER = 'user:ada'
    let server = addTask(createReplica(SERVER), [], 'assigned to the work machine', 1, 'w')
    let device = addTask(createReplica('work'), [], 'private note', 2, 'p')
    // push: false → the head sent is an empty node (no base yet) and the private row is not in the request
    const req = buildSyncRequest(device, undefined, { push: false })
    expect(req.headCid).not.toBe(headCid(device))
    expect(Object.values(req.nodes).some((n) => JSON.stringify(n).includes('private note'))).toBe(false)
    const served = serveSync(server.store, req, SERVER, 3)
    expect('error' in served).toBe(false)
    if ('error' in served) return
    const done = completeSync(device, req, served.response, 4)
    device = done.replica
    // the device now holds the assigned task and still its private row; the server never saw the private row
    expect(view(device, [])!.tasks.map((t) => t.title).sort()).toEqual(['assigned to the work machine', 'private note'])
    expect(view(server, [])!.tasks.map((t) => t.title)).toEqual(['assigned to the work machine'])
    // a second round with the same policy: still nothing leaves (head = base), and a new server row arrives
    server = addTask(server, [], 'another task', 5, 'a')
    const req2 = buildSyncRequest(device, undefined, { push: false })
    expect(req2.headCid).toBe(device.meta.baseCid)
    const served2 = serveSync(server.store, req2, SERVER, 6)
    if ('error' in served2) throw new Error(served2.error)
    device = completeSync(device, req2, served2.response, 7).replica
    expect(view(device, [])!.tasks.map((t) => t.title).sort()).toEqual(['another task', 'assigned to the work machine', 'private note'])
    expect(view(server, [])!.tasks.map((t) => t.title)).toEqual(['assigned to the work machine', 'another task'])
  })

  it('policies come from fos.config.toml tables and keep only known capabilities', () => {
    const config = parseToml('[attach]\nserver = "https://api.example"\n\n[server]\nto = ["http", "ws", "bogus"]\nfrom = ["read", "read-requests", "relay"]\n\n[peers.bob]\nto = ["read"]\nfrom = ["edit"]\n') as FosProjectConfig
    expect(serverPolicyOf(config)).toEqual({ to: ['http', 'ws'], from: ['read', 'read-requests', 'relay'] })
    expect(peerPolicyOf(config, '@bob')).toEqual({ to: ['read'], from: ['edit'] })
    expect(peerPolicyOf(config, 'carol')).toBeNull()
    expect(serverPolicyOf(parseToml('[attach]\nname = "x"\n') as FosProjectConfig)).toBeNull()
    expect(parsePolicy({ to: 'read' })).toBeNull()
    expect(parsePolicy({ from: ['read'] })).toEqual({ to: [], from: ['read'] })
  })

  it('the serving side reports the capabilities it registers with the peer', () => {
    const device = addTask(createReplica('dev'), [], 'x', 1, 'x')
    const server = createReplica('user:ada')
    const served = serveSync(server.store, buildSyncRequest(device), 'user:ada', 2, { capabilities: ['http', 'ws', 'relay', 'search'] })
    expect('error' in served).toBe(false)
    if (!('error' in served)) expect(served.response.capabilities).toEqual(['http', 'ws', 'relay', 'search'])
  })
})


describe('service capability registration', () => {
  it('round-trips every advertised capability through member graph edges in both directions', () => {
    const store = new FosStore()
    const root = partitionContent('home', 'Home')
    const member = withMember(store, root, 'user:services', 'Services', CAPABILITIES, [], CAPABILITIES)
    expect(readMembers(store, member)[0]).toEqual({ peerId: 'user:services', name: 'Services', capabilities: CAPABILITIES, accepts: CAPABILITIES })
  })

  it('advertises payment and allocation services on fos and only notifications on the phone', () => {
    expect(SERVER_CAPABILITIES).toEqual(expect.arrayContaining(['send-payment', 'receive-payment', 'allocate', 'request-payment']))
    expect(INTEGRATION_PEERS.find((p) => p.id === 'phone')).toMatchObject({ provides: ['notify'], consumes: [] })
  })
})
