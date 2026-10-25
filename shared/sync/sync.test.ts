import { memberEdgesOf, memberPeerOf, peerNode } from './graph'
import { userView } from './test-helpers'
import { unverifiedUser } from './users'
import { LIBRARY_ID } from './graph'
import { FosStore } from '../dag-implementation/store'
import type { FosPathElem } from '../types'
import { parseToml, peerPolicyOf, serverPolicyOf, type FosProjectConfig } from './project'
import {
  acceptsFrom,
  libAt,
  capabilityNames,
  SERVER_TRANSPORT_CAPABILITIES,
  INTEGRATION_PEERS,
  HOME_ID,
  readMembers,
  withMember,
  bookkeepingOf,
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
  rowEdge,
  ensureLibraryRow,
  put,
  readChoice,
  refValueCid,
  resolveScope,
  rootTargetCid,
  stripLink,
  taskContent,
  rowEdgeAt,
  valueContent,
  viewNode
} from './graph'
import { mergeNodes, resolveChoiceIn } from './merge'
import { exchangeNode, nodeShape, nodeTreeSync, validateNodeShape } from './node-sync'
import { formatCid, parseCid } from '../dag-implementation/cid'
import type { NodeAuthority, NodeRequest, ProvidedNode } from './node-provider'
import type { Scope } from './graph'
import {
  addMemberAt,
  addRef,
  addRow,
  addTask,
  applyProposalAt,
  bindUserAt,
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
  setQueryOptionsAt,
  setRowContentAt,
  setRowType,
  setTaskDone,
  type Replica,
  view, ensureHomeContext } from './replica'

const LABELS = { ours: 'A', theirs: 'B' }

/** Build content nodes in one store for the merge tests. */
function fixtures(store: FosStore) {
  const task = (id: string, title: string, done = false, time = 1000, updated = time) =>
    rowEdgeAt(store, TASK_TYPE, put(store, taskContent(id, title, done, time, updated)), [])
  const node = (...edges: FosPathElem[]) => put(store, { data: {}, children: edges })
  const part = (id: string, name: string, ...edges: FosPathElem[]) => rowEdgeAt(store, PLAIN_TYPE, put(store, { data: { alias: { id }, description: { content: name } }, children: edges }), [])
  return { task, node, part }
}

describe('mergeNodes', () => {
  let store: FosStore
  let f: ReturnType<typeof fixtures>
  beforeEach(() => {
    store = new FosStore()
    ensureLibraryRow(store)
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

/**
 * An account (the server's store) and devices syncing with it node by node (`nodeTreeSync`, as the CLI does). A device
 * syncs as the account's owner, or as an invited peer at `invited` (its edits become a proposal there).
 */
class World {
  server = createReplica('user:alice')

  provide(request: NodeRequest, authority: NodeAuthority, now: number): ProvidedNode {
    const served = exchangeNode(this.server, request, authority, now)
    this.server = served.replica
    return served.node
  }

  /** Run one sync; `during` edits the device between the first request and its answer (an edit made in flight). */
  sync(replica: Replica, now = 10_000, invited?: Scope, during?: (r: Replica) => Replica): Replica {
    const scope = invited ?? [], localRoot = replica.meta.localScope ?? []
    const authority: NodeAuthority = invited ? { peerId: replica.meta.peerId, scope, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES } : { peerId: replica.meta.peerId, scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
    const run = nodeTreeSync(replica, { peer: replica.meta.serverPeerId ?? (invited ? null : 'user:alice'), scope, remoteRoot: invited ? scope : localRoot, localRoot, branches: [], push: true }, () => now)
    let step = run.next()
    while (!step.done) {
      const answer = this.provide(step.value.request, authority, now)
      if (during) { during(step.value.replica); during = undefined }
      step = run.next(answer)
    }
    return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: step.value.peer } }
  }

  serverTasks(scope: string[] = []): string[] {
    return view(this.server, scope)?.tasks.filter((t) => t.id !== LIBRARY_ID).map((t) => t.title) ?? []
  }
}

const titles = (r: Replica, at: string[] = []) => (at.length ? view(r, at) : userView(r))!.tasks.map((t) => t.title)
const rows = (r: Replica, at: string[] = []) => (at.length ? view(r, at) : userView(r))!.tasks.map((t) => [t.id, t.title, t.done])

describe('replica + account end to end', () => {
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

    expect(rows(phone)).toEqual(rows(laptop))
    expect(world.serverTasks().sort()).toEqual(['buy milk', 'write report'])
    expect(isDirty(phone)).toBe(false)
    expect(isDirty(laptop)).toBe(false)
  })

  it('keeps history: the account root alias links PREV to its previous versions', () => {
    const world = new World()
    let phone = createReplica('phone')
    phone = addTask(phone, [], 'one', 1)
    phone = world.sync(phone)
    phone = addTask(phone, [], 'two', 2)
    phone = world.sync(phone)
    const root = content(world.server.store, world.server.store.rootNodeId)
    expect(root.children.find(([i]) => i === world.server.store.primitive.previousVersion.getId())).toBeDefined()
    expect(world.server.store.getPrevList(world.server.store.rootNodeId).length).toBeGreaterThanOrEqual(2)
  })

  it('a field changed on both devices is refused on the second device, which keeps its change', () => {
    const world = new World()
    let phone = createReplica('phone')
    let laptop = createReplica('laptop')
    phone = addTask(phone, [], 'draft', 1, 't')
    phone = world.sync(phone)
    laptop = world.sync(laptop)

    phone = renameTask(phone, [], 't', 'draft v2 (phone)', 5)
    laptop = renameTask(laptop, [], 't', 'draft v2 (laptop)', 6)
    phone = world.sync(phone)
    expect(() => world.sync(laptop)).toThrow(/Concurrent change to node field "description"/)
    expect(titles(laptop)).toEqual(['draft v2 (laptop)'])
    expect(world.serverTasks()).toEqual(['draft v2 (phone)'])
  })

  it('a device attached at a partition only sees and syncs that partition', () => {
    const world = new World()
    let laptop = createReplica('laptop')
    laptop = addTask(laptop, [], 'root task', 1, 'r1')
    laptop = addRow(laptop, [], PLAIN_TYPE, 'work', 2, { id: 'work' })
    laptop = addTask(laptop, ['work'], 'work task', 3, 'w1')
    laptop = world.sync(laptop)
    laptop = reattach(laptop, ['work'])
    expect(laptop.meta.localScope).toEqual(['work'])

    laptop = addTask(laptop, ['work'], 'added at work', 5, 'w2')
    laptop = renameTask(laptop, [], 'r1', 'renamed outside', 6) // outside the attachment: stays here
    expect(isDirty(laptop)).toBe(true)
    const synced = world.sync({ ...laptop, meta: { ...laptop.meta } })
    expect(world.serverTasks(['work'])).toEqual(['work task', 'added at work'])
    expect(world.serverTasks()).toEqual(['root task', 'work'])
    expect(titles(synced)).toEqual(['renamed outside', 'work'])
  })

  it('refuses to change scope with unsynced changes', () => {
    const world = new World()
    let r = world.sync(addRow(createReplica('r'), [], PLAIN_TYPE, 'work', 1, { id: 'work' }))
    r = addTask(r, [], 'x', 2)
    expect(() => reattach(r, ['work'])).toThrow(/unsynced/)
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
    expect(userView(tablet)!.tasks.map((t) => [t.id, t.done]).sort()).toEqual([['e1', false], ['o1', true], ['o2', false]])
    laptop = world.sync(laptop)
    expect(rows(laptop).sort()).toEqual(rows(tablet).sort())
  })

  it('edits made during an in-flight request survive', () => {
    const world = new World()
    let phone = createReplica('phone')
    phone = addTask(phone, [], 'one', 1, 'a')
    phone = world.sync(phone, 5, undefined, (r) => addTask(r, [], 'two', 2, 'b'))
    expect(titles(phone)).toEqual(['one', 'two'])
    expect(world.serverTasks()).toEqual(['one'])
    expect(isDirty(phone)).toBe(true)
    phone = world.sync(phone)
    expect(isDirty(phone)).toBe(false)
    expect(world.serverTasks()).toEqual(['one', 'two'])
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

  it('the serialized replica stays bounded to what is reachable from the root', () => {
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
  moveNode,
  rejectProposalAt,
  removePeerAt
} from './replica'
import { readProposals, content as nodeContent } from './graph'
import { TASK_TYPE, PLAIN_TYPE, NOTE_TYPE, COMMENT_TYPE, QUERY_TYPE, RESOURCE_TYPE, TEMPLATE_TYPE, PATTERN_TYPE } from './library-types'
import { addAllocation, addBank, addRequirement, argumentSupplier, supplyRequirement } from './arguments'
import { TASK_DEMAND } from './test-helpers'
import { REF_TYPE } from './library-types'
import { TEXT_TYPE } from './library-types'

const ids = (r: Replica, at: string[] = []) => (at.length ? view(r, at) : userView(r))!.tasks.map((t) => t.id)

describe('tree: subtasks, zoom and moves', () => {
  it('nests tasks, zooms into them and reports subtree counts', () => {
    let r = createReplica('p')
    r = addTask(r, [], 'parent', 1, 'P')
    r = addTask(r, ['P'], 'child one', 2, 'c1')
    r = addTask(r, ['P'], 'child two', 3, 'c2')
    r = setTaskDone(r, ['P'], 'c1', true, 4)
    r = addTask(r, ['P', 'c2'], 'grandchild', 5, 'g')
    const root = userView(r)!
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
    owner = world.sync(owner)
    // grants are the account's bookkeeping (an invite records them there); node exchange does not carry them
    world.server = addMemberAt(makeLinkAt(world.server, ['proj'], 3), ['proj'], 'guest', 'Guest phone', ['edit'], 3)
    owner = addMemberAt(owner, ['proj'], 'guest', 'Guest phone', ['edit'], 3)
    return { world, owner }
  }
  /** A guest's replica holds the node it was invited to as its root. */
  const guestAt = (world: World, now: number) => world.sync(createReplica('guest'), now, ['proj'])

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

  // proposals are the account's: owners decide them there (a `decide` event), and their devices pull the result
  it('a peer attached to a link proposes instead of changing; once approved, everyone has it', () => {
    const { world, owner: owner0 } = setup()
    let owner = owner0
    let guest = guestAt(world, 5)
    expect(ids(guest)).toEqual(['f'])

    guest = addTask(guest, [], 'from guest', 6, 'g1')
    guest = world.sync(guest, 7, ['proj'])
    expect(ids(guest)).toEqual(['f', 'g1'])                 // the guest keeps its edit
    expect(world.serverTasks(['proj'])).toEqual(['first']) // main is untouched
    const proposals = view(world.server, ['proj'])!.proposals
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ peerId: 'guest', summary: { added: ['from guest'], changed: [], removed: [] } })

    // a second sync of the guest's unchanged edit keeps one proposal
    guest = world.sync(guest, 8, ['proj'])
    expect(view(world.server, ['proj'])!.proposals).toHaveLength(1)

    world.server = applyProposalAt(world.server, ['proj'], proposals[0]!.id, 'user:alice', 9)
    expect(world.serverTasks(['proj'])).toEqual(['first', 'from guest'])
    expect(view(world.server, ['proj'])!.proposals).toHaveLength(0)
    owner = world.sync(owner)
    expect(ids(owner, ['proj'])).toEqual(['f', 'g1'])
    guest = world.sync(guest, 10, ['proj'])
    expect(ids(guest)).toEqual(['f', 'g1'])
  })

  it('a rejected proposal stays rejected; main keeps its content', () => {
    const { world } = setup()
    let guest = guestAt(world, 5)
    guest = renameTask(guest, [], 'f', 'first (guest)', 6)
    guest = world.sync(guest, 7, ['proj'])
    const proposal = view(world.server, ['proj'])!.proposals[0]!
    expect(proposal.summary).toEqual({ added: [], changed: ['first (guest)'], removed: [] })
    world.server = rejectProposalAt(world.server, ['proj'], proposal.id, 10)
    expect(view(world.server, ['proj'])!.proposals.map((p) => p.status)).toEqual(['rejected'])
    expect(view(world.server, ['proj'])!.tasks.find((t) => t.id === 'f')?.title).toBe('first')
    const linkValue = nodeContent(world.server.store, resolveScope(world.server.store, headCid(world.server), ['proj'])!)
    expect(readProposals(world.server.store, linkValue)[0]?.status).toBe('rejected')
    expect(stripLink(world.server.store, linkValue).data.link).toBeUndefined()
  })

  it('member capabilities are [CAPABILITY, constructor] edges on the member reference, not data', () => {
    const { owner } = setup()
    const withApprover = addMemberAt(owner, ['proj'], 'reviewer', 'Reviewer', ['read', 'edit'], 5)
    const node = view(withApprover, ['proj'])!
    expect(node.members.map((m) => [m.peerId, m.capabilities])).toEqual([['guest', ['edit']], ['reviewer', ['read', 'edit']]])
    const store = withApprover.store
    const linkValue = nodeContent(store, resolveScope(store, headCid(withApprover), ['proj'])!)
    const memberships = memberEdgesOf(store, resolveScope(store, headCid(withApprover), ['proj'])!)
    const reviewer = nodeContent(store, memberships.find((e) => memberPeerOf(store, e) === 'reviewer')![1])
    expect(reviewer.data).not.toHaveProperty('actor')
    expect(reviewer.children).toEqual([
      [store.primitive.capabilityNode.getId(), libAt(store).capabilities.read!],
      [store.primitive.capabilityNode.getId(), libAt(store).capabilities.edit!]
    ])
    // deciding proposals is how edit is exercised on a node with several peers: no grant of its own
    expect(hasCapability(store, linkValue, 'reviewer', 'edit')).toBe(true)
    expect(hasCapability(store, linkValue, 'guest', 'read')).toBe(false)
  })

  it('removing a member on the account ends its access', () => {
    const { world } = setup()
    guestAt(world, 5)
    expect(view(world.server, ['proj'])!.members.map((m) => m.peerId)).toEqual(['guest'])
    world.server = removeMemberAt(world.server, ['proj'], 'guest', 7)
    expect(view(world.server, ['proj'])!.members).toEqual([])
    expect(() => guestAt(world, 8)).toThrow(/denied|access/i)
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

describe('row types', () => {
  it('rows of every type live in one ordered list; only tasks are checkable', () => {
    let r = createReplica('d')
    r = addRow(r, [], PLAIN_TYPE, 'a thought', 1, { id: 'p' })
    r = addRow(r, [], TASK_TYPE, 'do it', 2, { id: 't' })
    r = addRow(r, [], NOTE_TYPE, '# Title\n\nbody with {{who}}', 3, { id: 'n' })
    r = addRow(r, ['n'], PLAIN_TYPE, 'who: Ada', 4, { id: 'kv' })
    r = addRow(r, [], COMMENT_TYPE, 'nice', 5, { id: 'c', author: { id: 'peer-1', name: 'Ada' } })
    r = addRow(r, ['c'], COMMENT_TYPE, 'reply', 6, { id: 'c2' })
    const v = userView(r)!
    expect(v.tasks.map((t) => [t.id, t.type, t.checkable])).toEqual([['p', PLAIN_TYPE, false], ['t', TASK_TYPE, true], ['n', NOTE_TYPE, false], ['c', COMMENT_TYPE, false]])
    expect(v.tasks.find((t) => t.id === 'n')!.title).toBe('Title')
    expect(view(r, ['n'])!.tasks.find((t) => t.id === 'n/field/body')!.title).toBe('# Title\n\nbody with {{who}}')
    expect(v.tasks.find((t) => t.id === 'c')!.author).toMatchObject({ name: 'Ada' })
    expect(view(r, ['c'])!.tasks.map((t) => t.type)).toEqual([TEXT_TYPE, 'person', 'listText', COMMENT_TYPE])
    expect(view(r, ['c'])!.tasks.slice(0, 3).map(t => t.id)).toEqual(['c/field/body', 'c/field/person', 'c/field/texts'])
    // a plain row cannot be completed; converting it to a task makes it checkable
    expect(userView(setTaskDone(r, [], 'p', true, 7))!.tasks[0]).toMatchObject({ id: 'p', done: false, checkable: false })
    r = setRowType(r, [], 'p', TASK_TYPE, 8)
    r = setTaskDone(r, [], 'p', true, 9)
    expect(userView(r)!.tasks[0]).toMatchObject({ id: 'p', type: TASK_TYPE, done: true })
    // and back to plain drops the completion
    r = setRowType(r, [], 'p', PLAIN_TYPE, 10)
    expect(userView(r)!.tasks[0]).toMatchObject({ id: 'p', type: PLAIN_TYPE, done: false, checkable: false })
    // rename/delete work on any type
    r = renameTask(r, [], 'c', 'nicer', 11)
    expect(userView(r)!.tasks.find((t) => t.id === 'c')!.title).toBe('nicer')
    r = deleteTask(r, [], 'n', 12)
    expect(userView(r)!.tasks.map((t) => t.id)).toEqual(['p', 't', 'c'])
  })

  it('cross-subtree links declare their source in the shared scope; copies get fresh ids', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'project', 1, 'proj')
    r = addTask(r, ['proj'], 'design', 2, 'des')
    r = addTask(r, ['proj', 'des'], 'sketch', 3, 'sk')
    r = addTask(r, [], 'today', 4, 'today')
    r = addRef(r, ['today'], 'sk', 5)
    const refRow = view(r, ['today'])!.tasks[0]!
    expect(refRow.type).toBe(REF_TYPE)
    expect(refRow.refId).toBe('sk')
    expect(resolveRef(r, 'sk')).toMatchObject({ path: [], row: { id: 'sk', title: 'sketch' } })
    expect(view(r, ['proj', 'des'])!.tasks[0]!.refId).toBe('sk')
    expect(resolveRef(r, 'nope')).toBeNull()
    // a ref placed above a sibling
    r = addRef(r, [], 'des', 6, { relativeTo: 'today', position: 'above' })
    expect(userView(r)!.tasks.map((t) => t.type)).toEqual([TASK_TYPE, REF_TYPE, TASK_TYPE, TASK_TYPE, TASK_TYPE])
    // copying the project subtree next to it: same titles, new ids, independent afterwards
    r = copyNode(r, [], 'proj', [], { relativeTo: 'proj', position: 'below' }, 7)
    const top = userView(r)!.tasks
    expect(top.map((t) => t.title)).toEqual(['project', 'project', '', 'today', 'sketch', 'design'])
    const copyId = top[1]!.id
    expect(copyId).not.toBe('proj')
    expect(view(r, [copyId])!.tasks.map((t) => t.title)).toEqual(['design'])
    const copiedDesign = view(r, [copyId])!.tasks[0]!.id
    expect(copiedDesign).not.toBe('des')
    r = renameTask(r, [copyId], copiedDesign, 'design v2', 8)
    expect(resolveRef(r, 'des')!.row.title).toBe('design')
    // copy into a node
    r = copyNode(r, [], 'sk', [], { into: 'today' }, 9)
    expect(view(r, ['today'])!.tasks.map((t) => [t.type, t.title])).toEqual([[REF_TYPE, ''], [TASK_TYPE, 'sketch']])
  })

  it('rows of mixed types merge like tasks: both sides adding different types keeps all of them in order', () => {
    const world = new World()
    let a = createReplica('A')
    a = addRow(a, [], NOTE_TYPE, 'shared note', 1, { id: 'n' })
    a = world.sync(a)
    let b = world.sync(createReplica('B'))
    a = addRow(a, [], COMMENT_TYPE, 'from A', 2, { id: 'ca' })
    b = addRow(b, [], PLAIN_TYPE, 'from B', 3, { id: 'pb' })
    b = setRowType(b, [], 'n', TASK_TYPE, 4) // B turns the note into a task
    a = world.sync(a); b = world.sync(b); a = world.sync(a)
    const types = (r: Replica) => userView(r)!.tasks.map((t) => [t.id, t.type])
    expect(types(a)).toEqual(types(b))
    expect(types(a)[0]).toEqual(['n', TASK_TYPE])
    expect(types(a).slice(1).sort()).toEqual([['ca', COMMENT_TYPE], ['pb', PLAIN_TYPE]])
    expect(userView(a)!.choices).toEqual([])
  })
})

describe('approval convergence', () => {
  it('after the account applies a proposal (a `decide` event), the owner device pulls it and is clean', () => {
    const world = new World()
    let owner = createReplica('owner')
    owner = addTask(owner, [], 'project', 1, 'proj')
    owner = world.sync(owner)
    world.server = addMemberAt(makeLinkAt(world.server, ['proj'], 2), ['proj'], 'guest', 'Guest', ['edit'], 2)
    let guest = world.sync(createReplica('guest'), 4, ['proj'])
    guest = addRow(guest, [], TASK_TYPE, 'from guest', 5, { id: 'g1' })
    guest = world.sync(guest, 6, ['proj'])
    const proposals = view(world.server, ['proj'])!.proposals
    expect(proposals).toHaveLength(1)
    world.server = applyProposalAt(world.server, ['proj'], proposals[0]!.id, 'user:alice', 8)
    owner = world.sync(owner, 9)
    expect(view(owner, ['proj'])!.tasks.map((t) => t.title)).toEqual(['from guest'])
    expect(view(owner, ['proj'])!.proposals).toEqual([])
    expect(isDirty(owner)).toBe(false)
    guest = world.sync(guest, 11, ['proj'])
    expect(userView(guest)!.tasks.map((t) => t.title)).toEqual(['from guest'])
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
    expect(userView(r)!.tasks[0]).toMatchObject({ id: 'proj', type: TASK_TYPE, title: 'project', isLink: true })
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
    const des = resolveScope(store, headCid(r), ['des'])!
    expect(isRefNode(store, content(store, des))).toBe(true)
    expect(view(r, ['proj'])!.tasks[0]).toMatchObject({ refId: 'des', type: REF_TYPE })
    const handleRow = view(r, ['today'])!.tasks[0]!
    expect(handleRow.type).toBe(REF_TYPE)
    const handleCid = resolveScope(store, headCid(r), ['today', handleRow.id])!
    const handle = content(store, handleCid)
    expect(isRefNode(store, handle) && isHandle(handle)).toBe(true)
    expect(refValueCid(store, handle)).toBe(des)
    // the handle resolves live: renaming the target shows through
    r = renameTask(r, [], 'des', 'design v2', 7)
    expect(resolveRef(r, 'des')?.row.title).toBe('design v2')
    expect(view(r, ['today'])!.tasks[0]!.type).toBe(REF_TYPE) // the handle's own value is never followed as content
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
        [peerNode(store, 'guest'), put(store, { data: { alias: { id: 'guest-entry' } }, children: [[store.primitive.capabilityNode.getId(), store.primitive.proposeAction.getId()]] })],
        [store.primitive.peerField.getId(), put(store, { data: { peerId: { content: 'guest' } }, children: [] })],
        [store.primitive.previousVersion.getId(), olderVersion]]
    })
    const rootValue = content(store, headCid(r))
    const edge = rootValue.children.find((e) => edgeKey(store, e) === 'a:sh')!
    const legacyRoot = put(store, { ...rootValue, children: rootValue.children.map((e) => (e === edge ? [e[0], legacy] as FosPathElem : e)) })
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
    r = addRequirement(r, ['t'], 'confirmation', 2, { capability: 'confirmation' }, 'rq1')
    r = addRequirement(r, ['t'], 'choice', 3, { capability: 'choice', options: ['fast', 'cheap'] }, 'rq2')
    let task = userView(r)!.tasks[0]!
    expect(task.blockedBy).toEqual(['confirmation', 'choice (fast | cheap)'])
    expect(view(r, ['t'])!.tasks.map((x) => [x.type, x.requirement?.satisfied])).toEqual([['capabilities.confirmation', false], ['capabilities.choice', false]])
    // completion is refused while blocked
    r = setTaskDone(r, [], 't', true, 4)
    expect(userView(r)!.tasks[0]!.done).toBe(false)
    r = supplyRequirement(r, ['t'], 'rq1', { by: 'ada@x' }, 5)
    r = supplyRequirement(r, ['t'], 'rq2', { by: 'ada@x', choice: 1 }, 6)
    task = userView(r)!.tasks[0]!
    expect(task.blockedBy).toBeUndefined()
    expect(argumentSupplier(r, ['t', 'rq1'])).toBe('ada@x')
    expect(view(r, ['t'])!.tasks.map((x) => x.title)).toEqual(['confirmation', 'choice'])
    r = setTaskDone(r, [], 't', true, 7)
    expect(userView(r)!.tasks[0]!.done).toBe(true)
    // a choice is one of the declared options; a confirmation declares none
    let r2 = addRow(createReplica('e'), [], TASK_TYPE, 'x', 1, { id: 'x' })
    r2 = addRequirement(r2, ['x'], 'confirmation', 2, { capability: 'confirmation' }, 'q')
    expect(() => supplyRequirement(r2, ['x'], 'q', { by: 'bob', choice: 0 }, 3)).toThrow(/declared options/)
    expect(userView(r2)!.tasks[0]!.blockedBy).toEqual(['confirmation'])
  })

  it('amount rows under a bank (sub-banks included) are data: a bank holds only what was issued to it as grants', () => {
    let r = createReplica('d')
    r = addBank(r, [], 'Week 42', 1, { type: 'calendar', unit: 'h' }, 'cal')
    r = addAllocation(r, ['cal'], 'planning', 2, { resource: 'cal', type: 'calendar', amount: 1, unit: 'h', start: 1760000000000 }, { id: 'a1' })
    r = addBank(r, ['cal'], 'Mornings', 3, { type: 'calendar', unit: 'h' }, 'sub')
    r = addAllocation(r, ['cal', 'sub'], 'standups', 4, { resource: 'sub', type: 'calendar', amount: 2.5, unit: 'h' }, { id: 'a2' })
    const bank = userView(r)!.tasks[0]!
    expect(bank.resource).toMatchObject({ type: 'calendar', held: 0 })
    expect(view(r, ['cal'])!.tasks.find((t) => t.id === 'sub')!.resource).toMatchObject({ held: 0 })
    expect(view(r, ['cal'])!.tasks.find((t) => t.id === 'a1')!.allocation).toMatchObject({ type: 'calendar', amount: 1, start: 1760000000000 })
    // a resource requirement is linear: a reference to an amount row is data, not authority, and does not fill it
    r = addTask(r, [], 'interview', 5, 't')
    r = addRequirement(r, ['t'], 'calendar 1 h', 6, { capability: 'allocation', resource: 'calendar', amount: 1, unit: 'h' }, 'rq')
    expect(userView(r)!.tasks[1]!.blockedBy).toEqual(['calendar 1 h'])
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ capability: 'allocation', linear: true, resource: 'calendar', amount: 1, unit: 'h' })
    // what a bank holds is its value, not a lexical declaration: nothing outside can refer to it by id
    expect(() => supplyRequirement(r, ['t'], 'rq', { by: 'ada', ref: 'a1' }, 7)).toThrow(/not visible/)
    expect(userView(r)!.tasks[1]!.blockedBy).toEqual(['calendar 1 h'])
  })

  it('queries carry their options', () => {
    let r = createReplica('d')
    r = addRow(r, [], QUERY_TYPE, 'designers near me', 7, { id: 'q', query: {} })
    r = setQueryOptionsAt(r, [], 'q', { market: true, executedAt: 8, count: 3 }, 8)
    expect(userView(r)!.tasks[0]!.query).toEqual({ market: true, executedAt: 8, count: 3 })
  })

  it('a requirement is filled by a child row of the type it names: a done task; a plain amount does not fill a resource requirement', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'host dinner', 1, 't')
    r = addRequirement(r, ['t'], 'book a table', 2, TASK_DEMAND, 'rt')
    r = addRequirement(r, ['t'], 'groceries', 3, { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' }, 'ra')
    r = addRequirement(r, ['t'], 'recipes', 4, { capability: 'search' }, 'rs')
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['task', 'account 50 USD', 'search'])
    // "-[ ]": a task inside, checked off
    r = addRow(r, ['t', 'rt'], TASK_TYPE, 'call the restaurant', 5, { id: 'sub' })
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['task', 'account 50 USD', 'search'])
    r = setTaskDone(r, ['t', 'rt'], 'sub', true, 6)
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['account 50 USD', 'search'])
    // "-$ 50": an amount typed inside is data; only a grant moved by an allocate invocation fills it
    r = addAllocation(r, ['t', 'ra'], 'deposit', 7, { resource: 'bank', type: 'account', amount: 50, unit: 'USD' }, { id: 'a1' })
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['account 50 USD', 'search'])
    // "-?": a search is filled by its handler's answer
    r = supplyRequirement(r, ['t'], 'rs', { by: 'fos', receipt: '2 results' }, 10)
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['account 50 USD'])
    r = setTaskDone(r, [], 't', true, 11)
    expect(userView(r)!.tasks[0]!.done).toBe(false)
  })

  it('peer and market requirements are filled by a supply of that capability', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'review the deck', 1, 't')
    r = addRequirement(r, ['t'], 'give feedback', 2, { capability: 'peer', inputs: { peer: 'bob' } }, 'rp')
    r = addRequirement(r, ['t'], 'find a printer', 3, { capability: 'market' }, 'rm')
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['@bob', 'market'])
    expect(view(r, ['t'])!.tasks[0]!.requirement).toMatchObject({ capability: 'peer', peer: 'bob', inputs: { peer: 'bob' } })
    r = supplyRequirement(r, ['t'], 'rp', { by: 'bob' }, 5)
    expect(userView(r)!.tasks[0]!.blockedBy).toEqual(['market'])
    expect(argumentSupplier(r, ['t', 'rp'])).toBe('bob')
    r = supplyRequirement(r, ['t'], 'rm', { by: 'fos', receipt: 'listed' }, 7)
    expect(userView(r)!.tasks[0]!.blockedBy).toBeUndefined()
  })

  // a template copies its subtree with unfilled requirements: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end

})

describe('allocations: people allocate themselves, rows are rewritten in place', () => {
  it('a person allocates themself with "@bob 2h": an allocation row whose user field names them', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'review', 1, 't')
    r = addAllocation(r, ['t'], '', 4, { resource: '', type: 'person', amount: 2, unit: 'h', start: 1760000000000, end: 1760007200000 }, { id: 'a2' })
    r = bindUserAt(r, ['t', 'a2'], unverifiedUser('bob'), 4)
    const bob = view(r, ['t'])!.tasks.find(t => t.id === 'a2')!
    expect(bob.allocation).toMatchObject({ type: 'person', amount: 2, unit: 'h', start: 1760000000000, end: 1760007200000 })
    expect(bob.user).toMatchObject({ username: 'bob' })
    expect(bob.requirement).toBeUndefined()
  })

  it('setRowContentAt rewrites a row from re-parsed text in place: type, text and data change, id and children stay', () => {
    let r = createReplica('d')
    r = addTask(r, [], 'plan', 1, 't')
    r = addRequirement(r, ['t'], 'lunch', 2, { capability: 'allocation', resource: 'account', amount: 50, unit: 'USD' }, 'rq')
    r = addRow(r, ['t', 'rq'], COMMENT_TYPE, 'any place is fine', 3, { id: 'c' })
    expect(view(r, ['t'])!.tasks[0]).toMatchObject({ id: 'rq', title: 'lunch', requirement: { resource: 'account', amount: 50, unit: 'USD' } })
    expect(view(r, ['t', 'rq'])!.tasks.find((c) => c.id === 'c')).toMatchObject({ type: COMMENT_TYPE, title: 'any place is fine' })
    // "-$ 50 lunch" edited to "[x] lunch walk": a done task, still with its child
    r = setRowContentAt(r, ['t'], 'rq', TASK_TYPE, 'lunch walk', { done: true }, 5)
    expect(view(r, ['t'])!.tasks[0]).toMatchObject({ id: 'rq', type: TASK_TYPE, title: 'lunch walk', done: true })
    expect(view(r, ['t'])!.tasks[0]!.requirement).toBeUndefined()
    expect(view(r, ['t', 'rq'])!.tasks.find((c) => c.id === 'c')).toMatchObject({ type: COMMENT_TYPE, title: 'any place is fine' })
    // and back to plain text
    r = setRowContentAt(r, ['t'], 'rq', PLAIN_TYPE, 'just a note', {}, 6)
    expect(view(r, ['t'])!.tasks[0]).toMatchObject({ id: 'rq', type: PLAIN_TYPE, title: 'just a note', checkable: false })
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

  it('a receive-only policy: nothing local is sent, the pull still merges in, local edits stay local', () => {
    const world = new World()
    world.server = addTask(world.server, [], 'assigned to the work machine', 1, 'w')
    let device = addTask(createReplica('work'), [], 'private note', 2, 'p')
    const sent: NodeRequest[] = []
    const pull = (r: Replica, now: number) => {
      const run = nodeTreeSync(r, { peer: r.meta.serverPeerId ?? 'user:alice', scope: [], remoteRoot: [], localRoot: [], branches: [], push: false }, () => now)
      let step = run.next()
      while (!step.done) { sent.push(step.value.request); step = run.next(world.provide(step.value.request, { peerId: 'work', scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }, now)) }
      return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: step.value.peer } }
    }
    device = pull(device, 3)
    expect(JSON.stringify(sent)).not.toContain('private note')
    expect(userView(device)!.tasks.map((t) => t.title).sort()).toEqual(['assigned to the work machine', 'private note'])
    expect(world.serverTasks()).toEqual(['assigned to the work machine'])
    world.server = addTask(world.server, [], 'another task', 5, 'a')
    device = pull(device, 6)
    expect(JSON.stringify(sent)).not.toContain('private note')
    expect(userView(device)!.tasks.map((t) => t.title).sort()).toEqual(['another task', 'assigned to the work machine', 'private note'])
    expect(world.serverTasks()).toEqual(['assigned to the work machine', 'another task'])
  })

  it('policies come from fos.config.toml tables and preserve extension capabilities', () => {
    const config = parseToml('[attach]\nserver = "https://api.example"\n\n[server]\nto = ["http", "ws", "bogus"]\nfrom = ["read", "read-requests", "relay"]\n\n[peers.bob]\nto = ["read"]\nfrom = ["edit"]\n') as FosProjectConfig
    expect(serverPolicyOf(config)).toEqual({ to: ['http', 'ws', 'bogus'], from: ['read', 'read-requests', 'relay'] })
    expect(peerPolicyOf(config, '@bob')).toEqual({ to: ['read'], from: ['edit'] })
    expect(peerPolicyOf(config, 'carol')).toBeNull()
    expect(serverPolicyOf(parseToml('[attach]\nname = "x"\n') as FosProjectConfig)).toBeNull()
    expect(parsePolicy({ to: 'read' })).toBeNull()
    expect(parsePolicy({ from: ['read'] })).toEqual({ to: [], from: ['read'] })
  })

  it('a node shape pinned to another cid format is refused: that peer has to update', () => {
    const r = addTask(createReplica('dev'), [], 'x', 1, 'x')
    const shape = nodeShape(r, [])
    const older = { ...shape, children: shape.children.map((c) => ({ ...c, template: formatCid(parseCid(c.template)!.digest, '0.0.0') })) }
    expect(() => validateNodeShape(shape)).not.toThrow()
    expect(() => validateNodeShape(older)).toThrow(/Update the app/)
  })

  it('the serving side reports the capabilities it registers with the peer', () => {
    const server = createReplica('user:ada')
    const served = exchangeNode(server, { peerId: 'dev', scope: [], path: [], linkId: 'dev-root' }, { peerId: 'dev', scope: [], owner: true, capabilities: ['provideNode', 'http', 'ws', 'relay', 'search'] }, 2)
    expect(served.node.capabilities).toEqual(['provideNode', 'http', 'ws', 'relay', 'search'])
  })
})


describe('service capability registration', () => {
  it('round-trips every advertised capability through member graph edges in both directions', () => {
    const store = createReplica().store
    const root = { data: { alias: { id: 'home' }, description: { content: 'Home' } }, children: [] }
    const member = withMember(store, root, 'user:services', 'Services', capabilityNames(store), [], capabilityNames(store))
    expect(readMembers(store, member)[0]).toEqual({ peerId: 'user:services', name: 'Services', capabilities: capabilityNames(store), accepts: capabilityNames(store) })
  })

  it('advertises only transport facts about fos by default; services come from host ref declarations', () => {
    for (const service of ['search', 'market', 'mail', 'llm', 'send-payment', 'receive-payment', 'allocate', 'request-payment', 'poll', 'cron']) expect(SERVER_TRANSPORT_CAPABILITIES).not.toContain(service)
    expect(INTEGRATION_PEERS.find((p) => p.id === 'phone')).toMatchObject({ kind: 'channel', consumes: [] })
    expect(INTEGRATION_PEERS.some((p) => p.id === 'discord')).toBe(false)
    const seeded = ensureHomeContext(createReplica('dev'), 1)
    expect(userView(seeded)!.members.find(m => m.peerId === 'fos')!.accepts).toEqual(expect.arrayContaining(SERVER_TRANSPORT_CAPABILITIES))
    expect(userView(seeded)!.members.find(m => m.peerId === 'fos')!.accepts).not.toContain('llm')
    const advertised = ensureHomeContext(seeded, 2, { server: ['llm', 'search'], integrations: { github: ['repo'] } })
    expect(userView(advertised)!.members.find(m => m.peerId === 'fos')!.accepts).toEqual(expect.arrayContaining(['llm', 'search', 'http']))
    expect(view(advertised, [HOME_ID])!.members.find(m => m.peerId === 'integration:github')!.accepts).toEqual(['repo'])
    expect(view(advertised, [HOME_ID])!.members.find(m => m.peerId === 'integration:google')!.accepts ?? []).toEqual([])
    const narrowed = ensureHomeContext(advertised, 3, { server: ['search'] })
    expect(userView(narrowed)!.members.find(m => m.peerId === 'fos')!.accepts).not.toContain('llm')
    expect(ensureHomeContext(narrowed, 4, { server: ['search'] })).toBe(narrowed)
  })
})
