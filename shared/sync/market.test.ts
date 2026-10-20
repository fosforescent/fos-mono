import { syncWith, userView } from './test-helpers'
import { MARKET_PEER, content, put, readMembers, resolveScope, stripLink, viewNode } from './graph'
import { BidError, applyBid, copyBidRow, draftBid, marketGrantsAt, setMarketAt } from './market'
import { addRow, addTask, createReplica, headCid, loadReplica, removeMemberAt, renameTask, serializeReplica, setTaskDone } from './replica'
import { marketplaceOffers, publishTemplate } from './handlers'

test('a node is listed iff the market peer is its member; the listing reaches the subtree, survives edits, reloads and node sync, and unlisting removes the member', () => {
  let r = addTask(createReplica('d'), [], 'offer', 1, 'o')
  r = addTask(r, ['o'], 'part', 2, 'p')
  r = setMarketAt(r, ['o'], true, 3)
  expect(userView(r)!.tasks[0]).toMatchObject({ market: true, isLink: true })
  expect(readMembers(r.store, content(r.store, resolveScope(r.store, headCid(r), ['o'])!)).find(m => m.peerId === MARKET_PEER)).toMatchObject({ capabilities: expect.arrayContaining(['read', 'edit']) })
  expect(marketGrantsAt(r.store, headCid(r), ['o', 'p'])).toEqual(expect.arrayContaining(['read', 'edit']))
  expect(marketGrantsAt(r.store, headCid(r), [])).toEqual([])
  expect(userView(setTaskDone(r, [], 'o', true, 4))!.tasks[0]!.market).toBe(true)
  expect(userView(loadReplica(serializeReplica(r)))!.tasks[0]!.market).toBe(true)
  // the server lists it (its market effect): membership is the server's policy, kept when the owner's device pushes edits
  let server = createReplica('server')
  let device = syncWith(addTask(createReplica('dev'), [], 'job', 1, 'job'), server)
  server = setMarketAt(server, ['job'], true, 5)
  device = syncWith(renameTask(device, [], 'job', 'Logo job', 11), server, { now: 12 })
  expect(userView(server)!.tasks.find(t => t.id === 'job')).toMatchObject({ title: 'Logo job', market: true })
  r = removeMemberAt(r, ['o'], MARKET_PEER, 6)
  expect(userView(r)!.tasks[0]!.market).toBeUndefined()
  expect(marketGrantsAt(r.store, headCid(r), ['o', 'p'])).toEqual([])
})

test('handlers published to the market are the market member’s offers; publishing keeps an inherited listing', () => {
  let r = addTask(createReplica('d'), [], 'shop', 1, 'shop')
  r = addRow(r, ['shop'], 'template', 'Design a logo', 2, { id: 'design' })
  r = setMarketAt(r, ['shop'], true, 3)
  r = publishTemplate(r, ['shop'], ['shop', 'design'], 'Logo', 4)
  expect(marketplaceOffers(r)).toEqual([])
  r = publishTemplate(r, ['shop'], ['shop', 'design'], 'Logo', 5, true)
  expect(marketplaceOffers(r).map(o => [o.id, o.label, o.peerId])).toEqual([['fos:published:design', 'Logo', MARKET_PEER]])
  expect(userView(r)!.tasks[0]!.market).toBe(true)
})

test('a bid is rows the bidder built, appended to a branch of the node; grants, foreign attribution and unknown paths are refused', () => {
  let owner = addTask(createReplica('alice'), [], 'Logo job', 1, 'job')
  owner = addRow(owner, ['job'], 'requirement', 'pay', 2, { id: 'rq', requirement: { capability: 'allocation', resource: 'account', amount: 5, unit: 'USD' } })
  const main = put(owner.store, stripLink(owner.store, content(owner.store, resolveScope(owner.store, headCid(owner), ['job'])!)))
  const bidder = createReplica('bob')
  const bid = draftBid(bidder, [], 3, d => {
    d = addRow(d, [], 'comment', 'I can do it', 3)
    d = addRow(d, [], 'allocation', '$5', 3, { id: 'a-bob', allocation: { resource: '', type: 'account', amount: 5, unit: 'USD', by: 'bob' } })
    return addRow(d, [], 'supply', '', 3, { id: 's-bob', supply: { capability: 'allocation', by: 'bob', at: 3, ref: 'a-bob' } })
  }, id => id === 's-bob' ? ['rq'] : [])
  const wire = JSON.parse(JSON.stringify(bid))
  const branch = applyBid(owner.store, main, wire, 'bob')
  const rows = viewNode(owner.store, branch).tasks
  expect(rows.map(t => [t.kind, t.title])).toEqual([['requirement', 'pay'], ['plain', 'I can do it'], ['allocation', '$5']])
  expect(viewNode(owner.store, resolveScope(owner.store, branch, ['rq'])!).tasks.map(t => [t.kind, t.supply?.ref])).toEqual([['supply', 'a-bob']])
  // another's attribution, a reused id, an unknown target
  const forged = draftBid(bidder, [], 4, d => addRow(d, [], 'supply', '', 4, { supply: { capability: 'allocation', by: 'fos', at: 4 } }))
  expect(() => applyBid(owner.store, main, JSON.parse(JSON.stringify(forged)), 'bob')).toThrow(BidError)
  expect(() => applyBid(owner.store, branch, wire, 'bob')).toThrow(BidError)
  const lost = draftBid(bidder, [], 5, d => addRow(d, [], 'comment', 'x', 5), () => ['nowhere'])
  expect(() => applyBid(owner.store, main, JSON.parse(JSON.stringify(lost)), 'bob')).toThrow(BidError)
  expect(() => applyBid(owner.store, main, { nodes: {}, rows: [] }, 'bob')).toThrow(BidError)
  // the bidder's own row with its subtree, copied under a chosen id
  let own = addTask(createReplica('bob'), [], 'bin', 1, 'bin')
  own = addRow(own, ['bin'], 'requirement', 'deliver', 2, { requirement: { capability: 'task' } })
  const copy = applyBid(owner.store, main, JSON.parse(JSON.stringify(copyBidRow(own, ['bin'], 6, 'bin-bob'))), 'bob')
  const bin = resolveScope(owner.store, copy, ['bin-bob'])!
  expect(viewNode(owner.store, bin).tasks.map(t => [t.kind, t.title])).toEqual([['requirement', 'deliver']])
})
