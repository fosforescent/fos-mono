import { FosStore } from './store'
import { CURRENT_CID_VERSION, cidVersion, formatCid, hashContent, hashContentAt, isCurrentCid, parseCid, shortCid, verifyCid } from './cid'
import { MigrationError, migrateContext, needsMigration } from './migrations'
import type { FosContextData, FosNodeContent, FosNodesData } from '../types'
import { addTask, createReplica, headCid, loadReplica, serializeReplica, view } from '../sync/replica'

const leaf: FosNodeContent = { data: { description: { content: 'leaf' } }, children: [] }

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
    expect(cid).toMatch(/^v2-[0-9a-f]{64}$/)
    expect(parseCid(cid)).toEqual({ version: CURRENT_CID_VERSION, digest: cid.slice(3) })
    expect(isCurrentCid(cid)).toBe(true)
    expect(formatCid(1, 'ab')).toBe('v1-ab')
    expect(shortCid(cid)).toBe(`v2-${cid.slice(3, 11)}`)
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

    const report = migrateContext(legacy)
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

  it('migrates a v1 context (unordered edges) to v2 keeping the stored order', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'first', 1, 't1')
    replica = addTask(replica, [], 'second', 2, 't2')
    const current = replica.store.exportContext([])
    const v1 = downgradeTo(current.fosData, 1)
    expect(needsMigration(v1.nodes)).toBe(true)
    const report = migrateContext(v1)
    expect(report.fromVersions).toEqual([1])
    expect(report.context.rootNodeId).toBe(current.fosData.rootNodeId)
  })

  it('is a no-op on a current context', () => {
    const store = new FosStore()
    const ctx = store.exportContext([]).fosData
    const report = migrateContext(ctx)
    expect(report.mapping).toEqual({})
    expect(report.context.rootNodeId).toBe(ctx.rootNodeId)
  })

  it('refuses contexts with dangling references or newer formats', () => {
    const child = hashContentAt(leaf, 0)
    const parent: FosNodeContent = { data: {}, children: [[child, child]] }
    const parentCid = hashContentAt(parent, 0)
    expect(() => migrateContext({ nodes: { [parentCid]: parent }, route: [], rootNodeId: parentCid })).toThrow(MigrationError)
    const future = `v2-${'0'.repeat(64)}`
    expect(() => migrateContext({ nodes: { [future]: leaf }, route: [], rootNodeId: future }, 1)).toThrow(/not a recognised|newer/)
    expect(parseCid(`v3-${'0'.repeat(64)}`)).toBeNull()
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

  it('a stored replica in the legacy format comes back with its base remapped', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'kept', 1, 't1')
    const serialized = serializeReplica(replica)
    const { context: legacy, mapping } = downgradeToLegacy(serialized.context)
    const legacyBase = mapping[headCid(replica)] as string
    const restored = loadReplica({ meta: { ...serialized.meta, baseCid: legacyBase }, context: legacy })
    expect(headCid(restored)).toBe(headCid(replica))
    expect(restored.meta.baseCid).toBe(headCid(replica))
    expect(view(restored, [])!.tasks.map((t) => t.title)).toEqual(['kept'])
  })
})
