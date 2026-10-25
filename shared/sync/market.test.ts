import { publishedTemplateId } from './graph'
import { syncWith, userView } from './test-helpers'
import { MARKET_PEER, content, put, readMembers, resolveScope, stripLink, viewNode } from './graph'
import { BidError, applyBid, copyBidRow, draftBid, marketGrantsAt, setMarketAt } from './market'
import { addRow, addTask, createReplica, headCid, loadReplica, removeMemberAt, renameTask, serializeReplica, setTaskDone } from './replica'
import { addAllocation, addRequirement } from './arguments'
import { TASK_DEMAND } from './test-helpers'
import { marketplaceOffers, publishTemplate } from './handlers'
import { COMMENT_TYPE, TEMPLATE_TYPE } from './library-types'

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
  r = addRow(r, ['shop'], TEMPLATE_TYPE, 'Design a logo', 2, { id: 'design' })
  r = setMarketAt(r, ['shop'], true, 3)
  r = publishTemplate(r, ['shop'], ['shop', 'design'], 'Logo', 4)
  expect(marketplaceOffers(r)).toEqual([])
  r = publishTemplate(r, ['shop'], ['shop', 'design'], 'Logo', 5, true)
  expect(marketplaceOffers(r).map(o => [o.id, o.label, o.peerId])).toEqual([[publishedTemplateId(r.meta.peerId, 'design'), 'Logo', MARKET_PEER]])
  expect(userView(r)!.tasks[0]!.market).toBe(true)
})

// a bid is rows the bidder built: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end
