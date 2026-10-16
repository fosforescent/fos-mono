import { addRow, addTask, createReplica, makeLinkAt, setMarketAt } from '@fosforescent/shared/sync/index'
import { collectRows, indexStore, searchRows, type Embed } from './rowIndex'

// a deterministic "embedding": bag of letters, so related texts land close together
const embed: Embed = async (texts) => texts.map((t) => { const v = new Array(26).fill(0); for (const c of t.toLowerCase()) { const i = c.charCodeAt(0) - 97; if (i >= 0 && i < 26) v[i]++ } const n = Math.hypot(...v) || 1; return v.map((x) => x / n) })

function fakePrisma() {
  const table: Array<Record<string, unknown>> = []
  return {
    table,
    async $queryRawUnsafe(sql: string, ...p: unknown[]) {
      if (sql.startsWith('SELECT "aliasId", "textHash"')) return table.filter((r) => r.userId === p[0]).map((r) => ({ aliasId: r.aliasId, textHash: r.textHash }))
      if (sql.includes('ORDER BY')) {
        const q = (p[0] as string).slice(1, -1).split(',').map(Number)
        const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0)
        return table.filter((r) => r.userId === p[1] || (p[2] && r.market)).map((r) => ({ ...r, score: dot(q, r.embedding as number[]) })).sort((a, b) => b.score - a.score).slice(0, p[3] as number)
      }
      throw new Error('unexpected query ' + sql)
    },
    async $executeRawUnsafe(sql: string, ...p: unknown[]) {
      if (sql.startsWith('DELETE')) { const gone = new Set(p[1] as string[]); for (let i = table.length - 1; i >= 0; i--) if (table[i]!.userId === p[0] && gone.has(table[i]!.aliasId as string)) table.splice(i, 1); return }
      if (sql.startsWith('INSERT')) {
        const [userId, owner, aliasId, kind, title, path, market, textHash, vec] = p as [number, string, string, string, string, string, boolean, string, string]
        const row = { userId, owner, aliasId, kind, title, path: JSON.parse(path), market, textHash, embedding: vec.slice(1, -1).split(',').map(Number) }
        const i = table.findIndex((r) => r.userId === userId && r.aliasId === aliasId)
        if (i >= 0) table[i] = row; else table.push(row)
      }
    }
  }
}

test('rows are collected with paths and market inheritance; supplies and references are skipped', () => {
  let r = createReplica('d')
  r = addTask(r, [], 'offer: logo design', 1, 'o')
  r = addTask(r, ['o'], 'sketch ideas', 2, 's')
  r = makeLinkAt(r, ['o'], 3)
  r = setMarketAt(r, ['o'], true, 4)
  r = addTask(r, [], 'private groceries', 5, 'g')
  r = addRow(r, ['g'], 'requirement', 'confirmation', 6, { id: 'q', requirement: { capability: 'confirmation' } })
  const rows = collectRows(r.store)
  expect(rows.map((x) => [x.aliasId, x.market, x.path.join('/')])).toEqual([['o', true, ''], ['s', true, 'o'], ['g', false, ''], ['q', false, 'g']])
})

test('indexing embeds changed rows only, removes vanished rows; search ranks own rows and market rows', async () => {
  const prisma = fakePrisma()
  let alice = createReplica('a')
  alice = addTask(alice, [], 'logo design for a bakery', 1, 'o')
  alice = makeLinkAt(alice, ['o'], 2)
  alice = setMarketAt(alice, ['o'], true, 3)
  alice = addTask(alice, [], 'buy flour', 4, 'f')
  let first = await indexStore(prisma, { id: 1, username: 'alice' }, alice.store, embed)
  expect(first).toEqual({ embedded: 2, removed: 0 })
  first = await indexStore(prisma, { id: 1, username: 'alice' }, alice.store, embed)
  expect(first).toEqual({ embedded: 0, removed: 0 })
  let bob = createReplica('b')
  bob = addTask(bob, [], 'design a logo', 5, 'b1')
  bob = addTask(bob, [], 'walk the dog', 6, 'b2')
  await indexStore(prisma, { id: 2, username: 'bob' }, bob.store, embed)
  const own = await searchRows(prisma, { userId: 2, query: 'logo', market: false, limit: 5 }, embed)
  expect(own.map((h) => [h.aliasId, h.owner])).toEqual([['b1', null], ['b2', null]])
  const market = await searchRows(prisma, { userId: 2, query: 'logo design', market: true, limit: 5 }, embed)
  expect(market.slice(0, 2).map((h) => h.aliasId).sort()).toEqual(['b1', 'o'])
  expect(market.find((h) => h.aliasId === 'o')?.owner).toBe('alice')
  expect(market.some((h) => h.aliasId === 'f')).toBe(false) // alice's private row never shows for bob
  // alice deletes her offer → removed from the index
  const { deleteTask } = await import('@fosforescent/shared/sync/index')
  alice = deleteTask(alice, [], 'o', 7)
  expect(await indexStore(prisma, { id: 1, username: 'alice' }, alice.store, embed)).toEqual({ embedded: 0, removed: 1 })
})

test('global search aggregates only explicitly published enabled handler offers; revocation removes them', async () => {
  const { publishTemplate, discoverHandlers, setHandlerEnabledAt } = await import('@fosforescent/shared/sync/index')
  const prisma = fakePrisma()
  let r = addRow(createReplica('alice-device'), [], 'template', 'Design a logo', 1, { id: 'design' })
  r = addTask(r, [], 'Private notes', 2, 'private')
  r = publishTemplate(r, [], ['design'], 'Logo capability', 3)
  expect(collectRows(r.store).filter(row => row.kind === 'capability')).toEqual([])
  r = publishTemplate(r, [], ['design'], 'Logo capability', 4, true)
  await indexStore(prisma, { id: 1, username: 'alice' }, r.store, embed)
  const hits = await searchRows(prisma, { userId: 2, query: 'logo', market: true, limit: 10 }, embed)
  expect(hits.map(h => [h.aliasId, h.kind, h.owner])).toEqual([['fos:published:design', 'capability', 'alice']])
  const offer = discoverHandlers(r, []).find(o => o.id === 'fos:published:design')!
  r = setHandlerEnabledAt(r, [], r.meta.peerId, offer.id, false, 5)
  await indexStore(prisma, { id: 1, username: 'alice' }, r.store, embed)
  expect(await searchRows(prisma, { userId: 2, query: 'logo', market: true, limit: 10 }, embed)).toEqual([])
})
