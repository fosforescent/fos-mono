import { FosStore } from './store'
import { FOS_DATA_VERSION, UnsupportedDataVersionError, assertCurrentCid, cidVersion, formatCid, hashContent, isCid, isCurrentCid, parseCid, shortCid, verifyCid } from './cid'
import type { FosNodeContent, FosNodesData } from '../types'
import { addTask, createReplica, headCid, loadReplica, serializeReplica } from '../sync/replica'
import { userView } from '../sync/test-helpers'
import * as LIBRARY from '../sync/library.generated.json'

const leaf: FosNodeContent = { data: { description: { content: 'leaf' } }, children: [] }

/** A context's nodes with every cid rewritten to another data version, as an older build stored them. */
function inVersion(nodes: FosNodesData, version: string): FosNodesData {
  const re = (cid: string) => formatCid(parseCid(cid)!.digest, version)
  return Object.fromEntries(Object.entries(nodes).map(([cid, node]) => [re(cid), { ...node, children: node.children.map(([a, b]) => [re(a), re(b)]) }]))
}

describe('versioned content ids', () => {
  it('writes cids in the current data version and parses them back', () => {
    const cid = hashContent(leaf)
    expect(FOS_DATA_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(cid.startsWith(`v${FOS_DATA_VERSION}-`)).toBe(true)
    expect(cid).toMatch(/^v\d+\.\d+\.\d+-[0-9a-f]{64}$/)
    const parsed = parseCid(cid)!
    expect(parsed.version).toBe(FOS_DATA_VERSION)
    expect(formatCid(parsed.digest)).toBe(cid)
    expect(isCurrentCid(cid)).toBe(true)
    expect(verifyCid(cid, leaf)).toBe(true)
    expect(shortCid(cid)).toBe(`v${FOS_DATA_VERSION}-${parsed.digest.slice(0, 8)}`)
  })

  it('tells cids of other data versions apart, and never verifies them', () => {
    const digest = parseCid(hashContent(leaf))!.digest
    for (const version of ['5', '0.0.1', '1.0.0', '0.0.10']) {
      const other = formatCid(digest, version)
      expect(isCid(other)).toBe(true)
      expect(cidVersion(other)).toBe(version)
      expect(isCurrentCid(other)).toBe(false)
      expect(verifyCid(other, leaf)).toBe(false)
      expect(() => assertCurrentCid(other)).toThrow(UnsupportedDataVersionError)
    }
    // a prefix that merely starts like the current one is another version
    expect(isCurrentCid(formatCid(digest, `${FOS_DATA_VERSION}.1`))).toBe(false)
    expect(isCurrentCid(formatCid(digest, `1${FOS_DATA_VERSION}`))).toBe(false)
    // bare digests (written before cids had a version) are recognised as unversioned
    expect(cidVersion(digest)).toBe('unversioned')
    expect(isCid(digest)).toBe(false)
    expect(() => assertCurrentCid(digest)).toThrow(/Unsupported data version \(unversioned\)/)
  })

  it('rejects wrong content and malformed cids', () => {
    expect(verifyCid(hashContent(leaf), { data: { description: { content: 'other' } }, children: [] })).toBe(false)
    expect(parseCid('not a cid')).toBeNull()
    expect(parseCid(`v${FOS_DATA_VERSION}-xyz`)).toBeNull()
    expect(parseCid(`v0..1-${'0'.repeat(64)}`)).toBeNull()
    expect(parseCid(`v-${'0'.repeat(64)}`)).toBeNull()
    expect(cidVersion('not a cid')).toBeNull()
    expect(isCurrentCid(`v${FOS_DATA_VERSION}-${'0'.repeat(63)}`)).toBe(false)
  })

  it('makes edge order and direction part of the identity', () => {
    const a = hashContent(leaf)
    const b = hashContent({ data: { description: { content: 'other' } }, children: [] })
    expect(hashContent({ data: {}, children: [[a, b]] })).not.toBe(hashContent({ data: {}, children: [[b, a]] }))
    expect(hashContent({ data: {}, children: [[a, a], [b, b]] })).not.toBe(hashContent({ data: {}, children: [[b, b], [a, a]] }))
  })

  it('the standard library is in the current data version', () => {
    expect(LIBRARY.version).toBe(FOS_DATA_VERSION)
    expect(Object.keys(LIBRARY.nodes).every(isCurrentCid)).toBe(true)
  })
})

describe('data of another version', () => {
  it('a store refuses a context in another data version instead of migrating it', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'kept', 1, 't1')
    const { context } = serializeReplica(replica)
    const older = inVersion(context.nodes, '0.0.0')
    const rootNodeId = formatCid(parseCid(context.rootNodeId)!.digest, '0.0.0')
    expect(() => new FosStore({ fosCtxData: { fosData: { nodes: older, route: [], rootNodeId }, trellisData: replica.store.trellisData } }))
      .toThrow(UnsupportedDataVersionError)
    // and the current data loads as it was
    const store = new FosStore({ fosCtxData: { fosData: { nodes: context.nodes, route: [], rootNodeId: context.rootNodeId }, trellisData: replica.store.trellisData } })
    expect(store.rootNodeId).toBe(context.rootNodeId)
  })

  it('a stored replica in another data version is reset, not migrated', () => {
    let replica = createReplica('p')
    replica = addTask(replica, [], 'kept', 1, 't1')
    const serialized = serializeReplica(replica)
    expect(userView(loadReplica(serialized))!.tasks.map((t) => t.title)).toEqual(['kept'])
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const older = { ...serialized, context: { nodes: inVersion(serialized.context.nodes, '5'), rootNodeId: formatCid(parseCid(serialized.context.rootNodeId)!.digest, '5') } }
      const restored = loadReplica(older)
      expect(headCid(restored)).not.toBe(headCid(replica))
      expect(userView(restored)?.tasks ?? []).toEqual([])
      expect(warn.mock.calls.some(([message]) => /Unsupported data version \(5\)/.test(String(message)))).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})
