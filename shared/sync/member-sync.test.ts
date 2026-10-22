import { publishedTemplateId } from './graph'
import { memberEntryId } from './index'
/**
 * Member edges travel by node exchange like other children of a node: the owner's devices receive and push every
 * member entry; any other peer receives a masked projection (its own entry, the rows it may read).
 */
import { syncWith, userView } from './test-helpers'
import { HOME_ID, MARKET_PEER, SERVER_TRANSPORT_CAPABILITIES, content, memberEdgesOf, readMembers, resolveScope, type Scope } from './graph'
import { addMemberAt, addRow, addTask, createReplica, ensureHomeContext, headCid, linkLocalStore, removeMemberAt, setMemberCapabilitiesAt, shareHome, view, type Replica } from './replica'
import { exchangeNode, finishNodeSync, isDirty, nodeSyncPush, planNodeSync, type NodeAuthority, type NodeSyncContext } from './index'
import { isListed } from './graph'
import { marketGrantsAt, setMarketAt } from './market'
import { marketplaceOffers, publishTemplate } from './handlers'
import { TEMPLATE_TYPE } from './library-types'

const PROJECT: Scope = [HOME_ID, 'project']
const membersAt = (r: Replica, path: Scope) => readMembers(r.store, content(r.store, resolveScope(r.store, headCid(r), path)!))
const member = (r: Replica, path: Scope, peerId: string) => membersAt(r, path).find(m => m.peerId === peerId)
const device = (peerId: string) => shareHome(ensureHomeContext(createReplica(peerId), 0))

test('member edges round-trip between two devices and the account', () => {
  const account = ensureHomeContext(createReplica('user:alice'), 0)
  let phone = addTask(device('phone'), [HOME_ID], 'Project', 1, 'project')
  phone = addMemberAt(phone, PROJECT, 'user:bob', 'Bob', ['read'], 2)
  phone = syncWith(phone, account)
  expect(member(account, PROJECT, 'user:bob')).toMatchObject({ name: 'Bob', capabilities: ['read'] })
  expect(isDirty(phone)).toBe(false)

  // the laptop receives the entry with its node, and changes it
  let laptop = syncWith(device('laptop'), account, { now: 20 })
  expect(member(laptop, PROJECT, 'user:bob')).toMatchObject({ name: 'Bob', capabilities: ['read'] })
  laptop = setMemberCapabilitiesAt(laptop, PROJECT, 'user:bob', ['read', 'edit'], ['edit'], 21)
  laptop = syncWith(laptop, account, { now: 22 })
  phone = syncWith(phone, account, { now: 23 })
  expect(member(phone, PROJECT, 'user:bob')).toMatchObject({ capabilities: ['read', 'edit'], disabled: ['edit'] })

  // removal travels the same way
  phone = removeMemberAt(phone, PROJECT, 'user:bob', 24)
  phone = syncWith(phone, account, { now: 25 })
  laptop = syncWith(laptop, account, { now: 26 })
  expect(member(account, PROJECT, 'user:bob')).toBeUndefined()
  expect(member(laptop, PROJECT, 'user:bob')).toBeUndefined()
  expect(isDirty(laptop)).toBe(false)
})

test('concurrent member changes on two devices merge like other children', () => {
  const account = ensureHomeContext(createReplica('user:alice'), 0)
  let phone = syncWith(addTask(device('phone'), [HOME_ID], 'Project', 1, 'project'), account)
  let laptop = syncWith(device('laptop'), account, { now: 11 })
  phone = addMemberAt(phone, PROJECT, 'user:bob', 'Bob', ['read'], 12)
  laptop = addMemberAt(laptop, PROJECT, 'user:carol', 'Carol', ['read', 'edit'], 13)
  phone = syncWith(phone, account, { now: 14 })
  laptop = syncWith(laptop, account, { now: 15 })
  phone = syncWith(phone, account, { now: 16 })
  for (const r of [account, phone, laptop]) expect(membersAt(r, PROJECT).map(m => m.peerId).sort()).toEqual(['user:bob', 'user:carol'])
})

test('a peer gets a masked projection: its own entry and the rows it may read, nothing of other members', () => {
  let account = ensureHomeContext(createReplica('user:alice'), 0)
  account = addTask(account, [HOME_ID], 'Project', 1, 'project')
  account = addTask(account, PROJECT, 'Plan', 2, 'plan')
  account = addTask(account, PROJECT, 'Salaries', 3, 'salaries')
  account = addMemberAt(account, PROJECT, 'user:bob', 'Bob', ['read', 'edit'], 4)
  account = addMemberAt(account, PROJECT, 'user:carol', 'Carol', ['read'], 5)
  account = setMarketAt(account, PROJECT, true, 6)
  // the salaries row is switched off for bob
  account = addMemberAt(account, [...PROJECT, 'salaries'], 'user:bob', 'Bob', ['read'], 7)
  account = setMemberCapabilitiesAt(account, [...PROJECT, 'salaries'], 'user:bob', ['read'], ['read'], 8)
  const wire: unknown[] = []
  const bob = syncWith(createReplica('user:bob'), account, { invited: PROJECT, wire })
  expect(userView(bob)!.tasks.map(t => t.id)).toEqual(['plan'])
  expect(view(bob, [])!.members.map(m => m.peerId)).toEqual(['user:bob'])
  expect(member(bob, [], 'user:bob')).toMatchObject({ capabilities: ['read', 'edit'] })
  const sent = JSON.stringify(wire)
  for (const hidden of ['user:carol', MARKET_PEER, 'Salaries']) expect(sent).not.toContain(hidden)
  // it cannot step into another member's entry, nor write its own
  const authority = { peerId: 'user:bob', scope: PROJECT, proposeOnly: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  expect(() => exchangeNode(account, { peerId: 'user:bob', scope: PROJECT, path: [memberEntryId('user:carol')], linkId: 'x' }, authority, 9)).toThrow()
  expect(() => exchangeNode(account, { peerId: 'user:bob', scope: PROJECT, path: [memberEntryId('user:bob')], linkId: 'y', update: { base: { data: {}, children: [] }, value: { data: { name: { content: 'Boss' } }, children: [] } } }, authority, 9)).toThrow()
  expect(member(account, PROJECT, 'user:bob')!.name).toBe('Bob')
})

test('a peer\'s member edits are not taken: the node keeps its owner\'s members', () => {
  let account = ensureHomeContext(createReplica('user:alice'), 0)
  account = addTask(account, [HOME_ID], 'Project', 1, 'project')
  account = addMemberAt(account, PROJECT, 'user:bob', 'Bob', ['read', 'edit'], 2)
  let bob = syncWith(createReplica('user:bob'), account, { invited: PROJECT })
  bob = addMemberAt(bob, [], 'user:mallory', 'Mallory', ['read', 'edit'], 3)
  bob = addTask(bob, [], 'A step', 4, 'step')
  bob = syncWith(bob, account, { invited: PROJECT, now: 20 })
  expect(membersAt(account, PROJECT).map(m => m.peerId)).toEqual(['user:bob'])
})

test('a listing made on the account is visible on the device, and one made on the device reaches the account', () => {
  let account = ensureHomeContext(createReplica('user:alice'), 0)
  let phone = addTask(device('phone'), [HOME_ID], 'Logo job', 1, 'job')
  phone = addTask(phone, [HOME_ID], 'Shop', 2, 'shop')
  phone = syncWith(phone, account)
  // the server's market effect lists the job
  account = setMarketAt(account, [HOME_ID, 'job'], true, 3)
  phone = syncWith(phone, account, { now: 20 })
  expect(view(phone, [HOME_ID])!.tasks.find(t => t.id === 'job')!.market).toBe(true)
  expect(marketGrantsAt(phone.store, headCid(phone), [HOME_ID, 'job'])).toEqual(expect.arrayContaining(['read', 'edit']))

  // the device lists the shop and publishes a handler to the market there
  phone = addRow(phone, [HOME_ID, 'shop'], TEMPLATE_TYPE, 'Design a logo', 21, { id: 'design' })
  phone = setMarketAt(phone, [HOME_ID, 'shop'], true, 22)
  phone = publishTemplate(phone, [HOME_ID, 'shop'], [HOME_ID, 'shop', 'design'], 'Logo design', 23, true)
  phone = syncWith(phone, account, { now: 24 })
  expect(isListed(account.store, resolveScope(account.store, headCid(account), [HOME_ID, 'shop'])!)).toBe(true)
  expect(marketplaceOffers(account).map(o => [o.id, o.label, o.path])).toEqual([[publishedTemplateId(phone.meta.peerId, 'design'), 'Logo design', [HOME_ID, 'shop']]])
  // the device's own offer on its entry travelled too
  expect(member(account, [HOME_ID, 'shop'], 'phone')).toBeDefined()
  expect(isDirty(phone)).toBe(false)

  // unlisting on the device unlists on the account
  phone = setMarketAt(phone, [HOME_ID, 'job'], false, 25)
  phone = syncWith(phone, account, { now: 26 })
  expect(isListed(account.store, resolveScope(account.store, headCid(account), [HOME_ID, 'job'])!)).toBe(false)
})

test('a member entry arrives unloaded with its node and grants nothing until it syncs', () => {
  let account = ensureHomeContext(createReplica('user:alice'), 0)
  account = addTask(account, [HOME_ID], 'Project', 1, 'project')
  account = addMemberAt(account, PROJECT, 'user:bob', 'Bob', ['read'], 2)
  const owner: NodeAuthority = { peerId: 'phone', scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const context: NodeSyncContext = { peer: account.meta.peerId, scope: [], remoteRoot: [HOME_ID], localRoot: [HOME_ID], branches: [], push: true }
  const round = (r: Replica, path: Scope) => {
    const plan = planNodeSync(r, path, context), remote = exchangeNode(account, plan.first, owner, 5).node
    const step = nodeSyncPush(r, plan, remote, 5)
    return finishNodeSync(step.replica, plan, step.update ? exchangeNode(account, step.update, owner, 5).node : remote, 5)
  }
  // Home's round lists the project; the project's round lists bob's entry, unloaded: it names bob and grants nothing
  let phone = round(round(device('phone'), [HOME_ID]), PROJECT)
  const entry = () => content(phone.store, memberEdgesOf(phone.store, resolveScope(phone.store, headCid(phone), PROJECT)!)[0]![1])
  expect(entry().data.ref).toMatchObject({ version: 'unloaded', peer: account.meta.peerId })
  expect(member(phone, PROJECT, 'user:bob')).toMatchObject({ capabilities: [] })
  // its own round loads it; nothing below the project was loaded on the way
  phone = round(phone, [...PROJECT, memberEntryId('user:bob')])
  expect(entry().data.ref).toBeUndefined()
  expect(member(phone, PROJECT, 'user:bob')).toMatchObject({ name: 'Bob', capabilities: ['read'] })
})

test('a store linked through this machine\'s files stays on this machine', () => {
  const server = createReplica('server')
  let project = linkLocalStore(addTask(createReplica('project'), [], 'Work', 1, 'work'), 'home-store', 'Home', 2)
  project = addMemberAt(project, [], 'user:bob', 'Bob', ['read'], 3)
  const wire: unknown[] = []
  project = syncWith(project, server, { wire })
  expect(membersAt(server, []).map(m => m.peerId)).toEqual(['user:bob'])
  expect(JSON.stringify(wire)).not.toContain('home-store')
  expect(membersAt(project, []).map(m => m.peerId).sort()).toEqual(['home-store', 'user:bob'])
  expect(isDirty(project)).toBe(false)
})
