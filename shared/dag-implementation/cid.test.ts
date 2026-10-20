import { userView } from '../sync/test-helpers'
import { FosStore } from './store'
import { CURRENT_CID_VERSION, cidVersion, formatCid, hashContent, hashContentAt, isCurrentCid, parseCid, shortCid, verifyCid } from './cid'
import { MigrationError, migrateContext, needsMigration } from './migrations'
import type { FosContextData, FosNodeContent, FosNodesData, FosPathElem } from '../types'
import { addTask, createReplica, headCid, loadReplica, serializeReplica, view } from '../sync/replica'
import { content, viewNode } from '../sync/graph'
import { nodeShape, nodeSyncKey } from '../sync/node-sync'
import { seedRowTypeContent, type RowTypeKind } from './row-templates'
import { put, readMembers, resolveScope, rowTypeAt } from '../sync/graph'
import { HOME_TYPE, TASK_TYPE } from '../sync/library-types'
import { rootTypeOf } from '../sync/patterns'
import { v3SeedRowTypeContent } from './migration-v3'

/** The seed version of a row type (as cid migration v4 pins rows to it), in `store`. */
const seed = (store: FosStore, kind: RowTypeKind) => put(store, seedRowTypeContent(kind, (c) => put(store, c)))

const leaf: FosNodeContent = { data: { description: { content: 'leaf' } }, children: [] }

/** What a loading store provides to migrations: its primitives in the current format. */
function environment() {
  const store = new FosStore()
  return { table: store.table, primitive: store.primitive as unknown as Record<string, { getId(): string }> }
}

/** Rewrite a current-format context into an older format (bottom-up), as old databases hold it. */
function downgradeTo(context: FosContextData, version: number): FosContextData {
  return downgradeToLegacyAt(context, version).context
}

function downgradeToLegacy(context: FosContextData): { context: FosContextData; mapping: Record<string, string> } {
  return downgradeToLegacyAt(context, 0)
}

function downgradeToLegacyAt(context: FosContextData, version: number): { context: FosContextData; mapping: Record<string, string> } {
  const mapping: Record<string, string> = {}
  const nodes: FosNodesData = {}
  const down = (cid: string): string => {
    if (mapping[cid]) return mapping[cid] as string
    const content = context.nodes[cid]
    if (!content) throw new Error(`missing ${cid}`)
    const next: FosNodeContent = { ...content, children: content.children.map(([a, b]) => [down(a), down(b)]) }
    const legacy = hashContentAt(next, version)
    mapping[cid] = legacy
    nodes[legacy] = next
    return legacy
  }
  for (const cid of Object.keys(context.nodes)) down(cid)
  return { context: { nodes, route: [], rootNodeId: mapping[context.rootNodeId] as string }, mapping }
}

describe('versioned content ids', () => {
  it('produces prefixed cids in the current format and parses them back', () => {
    const cid = hashContent(leaf)
    expect(cid).toMatch(/^v4-[0-9a-f]{64}$/)
    expect(parseCid(cid)).toEqual({ version: CURRENT_CID_VERSION, digest: cid.slice(3) })
    expect(isCurrentCid(cid)).toBe(true)
    expect(formatCid(1, 'ab')).toBe('v1-ab')
    expect(shortCid(cid)).toBe(`v4-${cid.slice(3, 11)}`)
  })

  it('recognises legacy bare-hex cids as version 0 and verifies them with the v0 algorithm', () => {
    const legacy = hashContentAt(leaf, 0)
    expect(legacy).toMatch(/^[0-9a-f]{64}$/)
    expect(cidVersion(legacy)).toBe(0)
    expect(verifyCid(legacy, leaf)).toBe(true)
    expect(verifyCid(hashContent(leaf), leaf)).toBe(true)
    // v1 keeps the v0 digest for a leaf; only the prefix differs
    expect(hashContentAt(leaf, 1)).toBe(`v1-${legacy}`)
    expect(isCurrentCid(legacy)).toBe(false)
    expect(isCurrentCid(hashContentAt(leaf, 1))).toBe(false)
  })

  it('rejects wrong content and unknown formats', () => {
    expect(verifyCid(hashContent(leaf), { data: { description: { content: 'other' } }, children: [] })).toBe(false)
    expect(parseCid('v99-abcd')).toBeNull()
    expect(parseCid('not a cid')).toBeNull()
    expect(cidVersion('v1-xyz')).toBeNull()
    expect(() => formatCid(42, 'ab')).toThrow(/unknown/)
  })
})

describe('migrations', () => {
  it('migrates a legacy context bottom-up and reproduces the current cids exactly', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'first', 1, 't1')
    replica = addTask(replica, [], 'second', 2, 't2')
    const current = replica.store.exportContext([])
    const { context: legacy, mapping: downMap } = downgradeToLegacy(current.fosData)

    expect(needsMigration(legacy.nodes)).toBe(true)
    expect(needsMigration(current.fosData.nodes)).toBe(false)

    const report = migrateContext(legacy, undefined, environment())
    expect(report.fromVersions).toEqual([0])
    expect(Object.keys(report.context.nodes).every((cid) => cidVersion(cid) === CURRENT_CID_VERSION)).toBe(true)
    expect(report.context.rootNodeId).toBe(current.fosData.rootNodeId)
    for (const [currentCid, legacyCid] of Object.entries(downMap)) {
      expect(report.mapping[legacyCid]).toBe(currentCid)
    }
    expect(Object.keys(report.context.nodes).sort()).toEqual(Object.keys(current.fosData.nodes).sort())
  })

  it('v2 makes edge order and direction part of the identity', () => {
    const a = hashContent(leaf)
    const b = hashContent({ data: { description: { content: 'other' } }, children: [] })
    const ab: FosNodeContent = { data: {}, children: [[a, b]] }
    const ba: FosNodeContent = { data: {}, children: [[b, a]] }
    expect(hashContent(ab)).not.toBe(hashContent(ba))
    expect(hashContentAt(ab, 1)).toBe(hashContentAt(ba, 1))
    const first: FosNodeContent = { data: {}, children: [[a, a], [b, b]] }
    const second: FosNodeContent = { data: {}, children: [[b, b], [a, a]] }
    expect(hashContent(first)).not.toBe(hashContent(second))
  })

  it('migrates a v1 context (unordered edges) to the current format keeping the stored order', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'first', 1, 't1')
    replica = addTask(replica, [], 'second', 2, 't2')
    const current = replica.store.exportContext([])
    const v1 = downgradeTo(current.fosData, 1)
    expect(needsMigration(v1.nodes)).toBe(true)
    const report = migrateContext(v1, undefined, environment())
    expect(report.fromVersions).toEqual([1])
    expect(report.context.rootNodeId).toBe(current.fosData.rootNodeId)
  })

  it('is a no-op on a current context', () => {
    const store = new FosStore()
    const ctx = store.exportContext([]).fosData
    const report = migrateContext(ctx, undefined, environment())
    expect(report.mapping).toEqual({})
    expect(report.context.rootNodeId).toBe(ctx.rootNodeId)
  })

  it('refuses contexts with dangling references or newer formats', () => {
    const child = hashContentAt(leaf, 0)
    const parent: FosNodeContent = { data: {}, children: [[child, child]] }
    const parentCid = hashContentAt(parent, 0)
    expect(() => migrateContext({ nodes: { [parentCid]: parent }, route: [], rootNodeId: parentCid }, undefined, environment())).toThrow(MigrationError)
    const future = `v2-${'0'.repeat(64)}`
    expect(() => migrateContext({ nodes: { [future]: leaf }, route: [], rootNodeId: future }, 1)).toThrow(/not a recognised|newer/)
    expect(parseCid(`v5-${'0'.repeat(64)}`)).toBeNull()
  })

  it('a store loaded from a legacy context migrates itself and exposes the mapping', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'kept', 1, 't1')
    const current = replica.store.exportContext([])
    const { context: legacy } = downgradeToLegacy(current.fosData)

    const store = new FosStore({ fosCtxData: { fosData: legacy, trellisData: current.trellisData } })
    expect(store.rootNodeId).toBe(current.fosData.rootNodeId)
    expect(store.migration).not.toBeNull()
    expect(store.remapCid(legacy.rootNodeId)).toBe(current.fosData.rootNodeId)
    expect(Object.keys(store.migration!.mapping).length).toBeGreaterThan(0)
    expect([...store.table.keys()].every(isCurrentCid)).toBe(true)
  })

  it('a stored replica in the legacy format comes back with its node sync records remapped', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'kept', 1, 't1')
    const serialized = serializeReplica(replica)
    const { context: legacy, mapping } = downgradeToLegacy(serialized.context)
    const local = nodeShape(replica, [])
    const legacyShape = { ...local, children: local.children.map((child) => ({ ...child, template: mapping[child.template] as string })) }
    expect(legacyShape.children[0]!.template).not.toBe(local.children[0]!.template)
    const restored = loadReplica({ meta: { ...serialized.meta, serverPeerId: 'user:a', nodeSync: { [nodeSyncKey('user:a', [])]: { local: legacyShape, remote: legacyShape } } }, context: legacy })
    expect(headCid(restored)).toBe(headCid(replica))
    expect(restored.meta.nodeSync![nodeSyncKey('user:a', [])]!.local).toEqual(local)
    expect(userView(restored)!.tasks.map((t) => t.title)).toEqual(['kept'])
  })
})

describe('v2 → v3: rows carry their template as instruction', () => {
  it('flips row edges and choice pointers, pins template instances and turns legacy partitions into plain rows', () => {
    const fresh = new FosStore(), p = fresh.primitive
    // the primitives as a v2 database holds them
    const primitives = downgradeToLegacyAt({ nodes: Object.fromEntries(fresh.table), route: [], rootNodeId: p.completeField.getId() }, 2)
    const v2 = (cid: string) => primitives.mapping[cid] as string
    const nodes: FosNodesData = { ...primitives.context.nodes }
    const add = (node: FosNodeContent) => { const cid = hashContentAt(node, 2); nodes[cid] = node; return cid }
    const COMPLETE = v2(p.completeField.getId()), TEMPLATE = v2(p.templateField.getId()), ALLOCATION = v2(p.allocationField.getId())
    const LIST = v2(p.listField.getId()), IP = v2(p.instructionPointerConstructor.getId()), TP = v2(p.targetPointerConstructor.getId()), PREV = v2(p.previousVersion.getId())
    type V2Data = FosNodeContent['data'] & { template?: { id: string; name: string } }
    const need = add({ data: { alias: { id: 'need' }, description: { content: 'Destination agreed' }, allocation: { capability: 'confirmation', resource: '', type: 'inventory', amount: -1, unit: 'unit' } }, children: [] })
    const trip = add({ data: { alias: { id: 'tpl' }, description: { content: 'Trip' }, updated: { time: 1 } }, children: [[need, ALLOCATION]] })
    const done = add({ data: { alias: { id: 't1' }, description: { content: 'Book' }, todo: { completed: true, time: 1 } }, children: [] })
    const plain = add({ data: { alias: { id: 'p1' }, description: { content: 'Plain' } }, children: [] })
    const oslo = add({ data: { alias: { id: 'oslo' }, description: { content: 'Oslo' }, todo: { completed: false, time: 2 }, template: { id: 'tpl', name: 'Trip' } } as V2Data, children: [] })
    const lost = add({ data: { alias: { id: 'lost' }, description: { content: 'Lost' }, todo: { completed: false, time: 2 }, template: { id: 'gone', name: 'Gone' } } as V2Data, children: [] })
    const partition = add({ data: { alias: { id: 'old' }, description: { content: 'Old' } }, children: [] })
    const pointer = add({ data: {}, children: [[IP, done], [TP, COMPLETE]] })
    // an older version of the template in history, with the same timestamp (adding rows does not move it)
    const tripBefore = add({ data: { alias: { id: 'tpl' }, description: { content: 'Trip' }, updated: { time: 1 } }, children: [] })
    const history = add({ data: {}, children: [[tripBefore, TEMPLATE]] })
    const root = add({ data: {}, children: [[done, COMPLETE], [plain, COMPLETE], [trip, TEMPLATE], [oslo, COMPLETE], [lost, COMPLETE], [LIST, partition], [PREV, history]] })

    const store = new FosStore({ fosCtxData: { fosData: { nodes, route: [], rootNodeId: root }, trellisData: fresh.exportContext([]).trellisData } })
    expect([...store.table.keys()].every(isCurrentCid)).toBe(true)
    // the frozen seed's types have no graph identity: their rows read as rows of no known type; template instances are tasks
    const rows = viewNode(store, store.rootNodeId).tasks.map((t) => [t.id, t.checkable, t.template?.name ?? null])
    expect(rows).toEqual([['t1', false, null], ['p1', false, null], ['tpl', false, null], ['oslo', true, 'Trip'], ['lost', true, 'Gone'], ['old', false, null]])
    const children = content(store, store.rootNodeId).children
    // every row is [template, rowNode]; the instance is pinned to the template version in the current tree, not history
    // pinned to the seed version of the library's row types, the one every device root ships
    expect(children[0]![0]).toBe(seed(store, 'task'))
    expect(children[2]![0]).toBe(seed(store, 'template'))
    expect(children[3]![0]).toBe(children[2]![1])
    expect(content(store, children[2]![1]).data.instanceKind).toEqual({ kind: 'task' })
    expect('template' in content(store, children[3]![1]).data).toBe(false)
    // the template row keeps its requirement and (v4) gets the pattern rows of what its tasks accept
    expect(viewNode(store, children[2]![1]).tasks.map((t) => t.typeCid)).toEqual([seed(store, 'allocation'), ...Array(4).fill(seed(store, 'pattern'))])
    // a template this graph never held is kept as a stand-in with its id and name
    expect(content(store, children[4]![0]).data).toEqual({ alias: { id: 'gone' }, description: { content: 'Gone' }, instanceKind: { kind: 'task' } })
    const flipped = content(store, store.remapCid(pointer)).children
    expect(flipped).toEqual([[p.instructionPointerConstructor.getId(), seed(store, 'task')], [p.targetPointerConstructor.getId(), store.remapCid(done)]])
  })
})

describe('v3 → v4: types say what they accept, Home and store roots are types', () => {
  it('gives types their pattern rows, adds the new types, makes Home a Home row and types the roots', () => {
    const fresh = new FosStore(), p = fresh.primitive
    // the primitives as a v3 database holds them
    const primitives = downgradeToLegacyAt({ nodes: Object.fromEntries(fresh.table), route: [], rootNodeId: p.terminal.getId() }, 3)
    const v3 = (cid: string) => primitives.mapping[cid] as string
    const nodes: FosNodesData = { ...primitives.context.nodes }
    const add = (node: FosNodeContent) => { const cid = hashContentAt(node, 3); nodes[cid] = node; return cid }
    const IP = v3(p.instructionPointerConstructor.getId()), TP = v3(p.targetPointerConstructor.getId()), PREV = v3(p.previousVersion.getId()), ROOT = v3(p.rootInstructionNode.getId())
    const TERMINAL = v3(p.terminal.getId())
    const type = (kind: Parameters<typeof v3SeedRowTypeContent>[0]) => add(v3SeedRowTypeContent(kind))
    const typeRow = (kind: Parameters<typeof v3SeedRowTypeContent>[0]) => [type('template'), add({ data: { alias: { id: `lib:type:${kind}` } }, children: [[TP, type(kind)]] })] as FosPathElem
    const group = add({ data: { alias: { id: 'lib:types' }, description: { content: 'Row types' } }, children: (['task', 'plain', 'note', 'comment', 'ref', 'query', 'resource', 'allocation', 'template'] as const).map(typeRow) })
    const library = add({ data: { alias: { id: 'fos:library' }, description: { content: 'Standard library' } }, children: [[type('plain'), group]] })
    const trip = add({ data: { alias: { id: 'trip' }, description: { content: 'Trip' }, instanceKind: { kind: 'task' } }, children: [] })
    const oslo = add({ data: { alias: { id: 'oslo' }, description: { content: 'Oslo' }, todo: { completed: false, time: 1 } }, children: [] })
    // a member that could approve (alone, and beside edit): approve is edit from v4 on
    const CAP = v3(p.capabilityNode.getId()), MEMBER = v3(p.memberField.getId())
    const approver = add({ data: { alias: { id: 'fos:peer:rev' }, peerId: { content: 'rev' }, disabledCapabilities: { content: ['approve'] } }, children: [[CAP, v3(p.approveAction.getId())]] })
    const both = add({ data: { alias: { id: 'fos:peer:both' }, peerId: { content: 'both' } }, children: [[CAP, v3(p.proposeAction.getId())], [CAP, v3(p.approveAction.getId())]] })
    const home = add({ data: { alias: { id: 'fos:home' }, description: { content: 'Home' } }, children: [[type('template'), trip], [trip, oslo], [MEMBER, approver], [MEMBER, both]] })
    const device = add({ data: {}, children: [[type('plain'), library], [type('plain'), home]] })
    const root = add({ data: { alias: { id: 'device' } }, children: [[TP, device], [IP, ROOT], [PREV, TERMINAL]] })
    const store = new FosStore({ fosCtxData: { fosData: { nodes, route: [], rootNodeId: root }, trellisData: fresh.exportContext([]).trellisData } })
    expect([...store.table.keys()].every(isCurrentCid)).toBe(true)
    const r = createReplica('p', store)
    // the device root is typed, Home is a Home row, the library's types are the v4 seed (pattern rows and all)
    expect(content(store, rootTypeOf(store)).data.instanceKind).toEqual({ kind: 'device-root' })
    expect(view(r, [])!.tasks.map((t) => [t.id, t.typeCid])).toEqual([['fos:library', seed(store, 'plain')], ['fos:home', seed(store, 'home')]])
    expect(rowTypeAt(store, TASK_TYPE)).toBe(seed(store, 'task'))
    expect(rowTypeAt(store, HOME_TYPE)).toBe(seed(store, 'home'))
    expect(view(r, ['fos:library', 'lib:types'])!.tasks.map((t) => t.id)).toEqual(['task', 'plain', 'note', 'comment', 'ref', 'query', 'resource', 'allocation', 'template', 'pattern', 'home', 'device-root', 'document-root'].map((k) => `lib:type:${k}`))
    // a template row is a type: its tasks accept what a task does
    expect(view(r, ['fos:home', 'trip'])!.tasks.map((t) => t.typeCid)).toEqual(Array(4).fill(seed(store, 'pattern')))
    expect(view(r, ['fos:home'])!.tasks.find((t) => t.id === 'oslo')).toMatchObject({ checkable: true, template: { name: 'Trip' } })
    const homeNode = content(store, resolveScope(store, headCid(r), ['fos:home'])!)
    expect(readMembers(store, homeNode).map((m) => [m.peerId, m.capabilities, m.disabled ?? []])).toEqual([['rev', ['edit'], []], ['both', ['edit'], []]])
    for (const node of store.table.values()) expect(node.children.some(([i, t]) => i === p.capabilityNode.getId() && t === p.approveAction.getId())).toBe(false)
    // a root holding neither library nor Home is a document root
    const docContent = add({ data: {}, children: [[type('task'), add({ data: { alias: { id: 'x' }, description: { content: 'x' }, todo: { completed: false, time: 1 } }, children: [] })]] })
    const docRoot = add({ data: { alias: { id: 'doc' } }, children: [[TP, docContent], [IP, ROOT], [PREV, TERMINAL]] })
    const doc = new FosStore({ fosCtxData: { fosData: { nodes, route: [], rootNodeId: docRoot }, trellisData: fresh.exportContext([]).trellisData } })
    expect(content(doc, rootTypeOf(doc)).data.instanceKind).toEqual({ kind: 'document-root' })
  })
})
