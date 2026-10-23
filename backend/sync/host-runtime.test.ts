import { handlerOfferId } from '@fosforescent/shared/sync/index'
import { membershipPathAt } from '@fosforescent/shared/sync/index'
import { standardHostRef } from './host-runtime'
import { CAPABILITIES, SERVER_TRANSPORT_CAPABILITIES, RELAY_QUEUE_ID, addMemberAt, addRelayMessage, addTask, createReplica, ensureHomeContext, view, HOME_ID } from '@fosforescent/shared/sync/index'
import { createHostRuntime } from './host-runtime'
import { relayHandler } from './hostHandlers'
import { put, nativeRef, addRefCall, addRefAt, evaluationSteps, updateAtScope, commitRoot, headCid, content, setHandlerEnabledAt, setHandlerOffersAt, serializeReplica, loadReplica, discoverHandlers, type EvaluationStep } from '@fosforescent/shared/sync/index'

test('a host registers and discovers a custom ref pattern without a capability name', async () => {
  let calls = 0
  const runtime = createHostRuntime([{ peerId: 'fos', ref: {
    id: 'extension:render', type: store => put(store, { data: { name: { content: 'Rendering pattern' } }, children: [] }),
    effect: async () => { calls++ }
  } }])
  let replica = ensureHomeContext(createReplica('owner'), 1, runtime.hostOffers())
  replica = await runtime.onLoad({ userId: 1, replica, path: [], branches: [], now: 2 })
  const handler = runtime.handlers[0]!, type = handler.ref!.type(replica.store)
  const step = { path: [], row: { requirement: { capability: type } } } as unknown as EvaluationStep
  expect(runtime.executors(step, replica)).toEqual([handler])
  expect(runtime.providers(step, replica, handler)).toEqual(['fos'])
  await handler.effect!({ userId: 1, username: 'owner', step, replica: () => replica, update: async next => { replica = next }, now: () => 3 })
  expect(calls).toBe(1)
  replica = setHandlerEnabledAt(replica, [], 'fos', 'extension:render', false, 4)
  expect(runtime.providers(step, replica, handler)).toEqual([])
})

test('advertised capabilities are exactly transport facts plus registered handlers', () => {
  const runtime = createHostRuntime([
    { peerId: 'fos', ref: standardHostRef('fos', 'search') }, { peerId: 'fos', ref: standardHostRef('fos', 'llm') }, { peerId: 'fos', ref: standardHostRef('fos', 'search', 'alternate-search') },
    { peerId: 'integration:github', ref: standardHostRef('integration:github', 'repo'), effect: async () => undefined },
    { peerId: 'integration:phone', ref: standardHostRef('integration:phone', 'notify'), available: async () => false }
  ])
  expect(runtime.serverCapabilities()).toEqual([...new Set([...SERVER_TRANSPORT_CAPABILITIES, 'search', 'llm'])].sort())
  for (const unbacked of ['mail', 'send-payment', 'receive-payment', 'allocate', 'request-payment', 'cron']) expect(runtime.serverCapabilities()).not.toContain(unbacked)
  expect(runtime.integrationOffers()).toEqual({ github: ['repo'], phone: ['notify'] })
  const step = (capability: string) => ({ path: ['t', 'r'], row: { id: 'r', type: 'allocation', requirement: { capability } } } as any)
  const r = createReplica('owner')
  expect(runtime.executors(step('repo'), r)).toHaveLength(0) // no ref row means no registration
  expect(runtime.executors(step('search'), r)).toHaveLength(0)
})

test('a ref row is the registration: an empty host catalogue discovers it and removal withdraws it', async () => {
  const runtime = createHostRuntime([])
  let r = createReplica('host'), calls = 0
  const definition = { id: 'direct:render', label: 'render', type: (store: typeof r.store) => put(store, { data: {}, children: [] }) }
  const native = { peerId: 'host', ref: definition, effect: async () => { calls++ } }
  const value = nativeRef(r.store, 'host', definition, native)
  r = addRefCall(r, [], value, 1, 'call')
  const step = evaluationSteps(r, ['call'])[0]!
  expect(runtime.executors(step, r)).toEqual([])
  r = addRefAt(r, [], 'registration', definition.type(r.store), 2, value, 'renderer')
  expect(runtime.executors(step, r)).toEqual([native])
  expect(runtime.providers(step, r, native)).toEqual(['host'])
  expect(await runtime.active('host', 1, r, ['call'])).toBe(true)
  await runtime.executors(step, r)[0]!.effect!({ userId: 1, username: 'owner', step, replica: () => r, update: async next => { r = next }, now: () => 3 })
  expect(calls).toBe(1)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: node.children.filter(edge => content(r.store, edge[1]).data.alias?.id !== 'registration') })), 4)
  expect(runtime.executors(step, r)).toEqual([])
})

test('availability follows the handler, and every advertised capability is a known one', async () => {
  const runtime = createHostRuntime([
    { peerId: 'integration:github', ref: standardHostRef('integration:github', 'repo'), available: async id => id === 1 },
    { peerId: 'fos', ref: standardHostRef('fos', 'search') }
  ])
  expect(await runtime.active('integration:github', 1)).toBe(true)
  expect(await runtime.active('integration:github', 2)).toBe(false)
  expect(await runtime.active('fos', 2)).toBe(true)
  expect(await runtime.active('integration:google', 1)).toBe(false)
  for (const cap of runtime.serverCapabilities()) expect(CAPABILITIES).toContain(cap)
})

test('reloading and applying host defaults never resurrects a withdrawn declaration', () => {
  const runtime = createHostRuntime([{ peerId: 'fos', ref: standardHostRef('fos', 'search'), effect: async () => {} }])
  let r = ensureHomeContext(createReplica('owner'), 1, runtime.hostOffers())
  const offer = discoverHandlers(r, []).find(value => value.id === handlerOfferId('fos', 'search'))!
  expect(offer).toBeDefined()
  r = addRefCall(r, [], offer.cid, 2, 'call')
  expect(runtime.executors(evaluationSteps(r, ['call'])[0]!, r)).toHaveLength(1)
  r = setHandlerOffersAt(r, [], 'fos', offer.type, [], 3)
  r = loadReplica(serializeReplica(r))
  r = runtime.migrate(ensureHomeContext(r, 4, runtime.hostOffers()), [], 5)
  expect(discoverHandlers(r, []).some(value => value.id === offer.id)).toBe(false)
  expect(runtime.executors(evaluationSteps(r, ['call'])[0]!, r)).toHaveLength(0)
})

test('the runtime is what Home advertises for fos and the integration peers', () => {
  const runtime = createHostRuntime([{ peerId: 'fos', ref: standardHostRef('fos', 'market') }, { peerId: 'integration:google', ref: standardHostRef('integration:google', 'calendar') }])
  const r = ensureHomeContext(createReplica('user:alice'), 1, runtime.hostOffers())
  const fos = view(r, [])!.members.find(m => m.peerId === 'fos')!
  expect([...(fos.accepts ?? [])].sort()).toEqual(runtime.serverCapabilities())
  const home = view(r, [HOME_ID])!.members
  expect(home.find(m => m.peerId === 'integration:google')!.accepts).toEqual(['calendar'])
  expect(home.find(m => m.peerId === 'integration:github')!.accepts ?? []).toEqual([])
})

test('the server runs the relay on submissions: a message to a peer the account knows lands in its queue', () => {
  const runtime = createHostRuntime([relayHandler()])
  expect(runtime.serverCapabilities()).toContain('relay')
  let r = ensureHomeContext(createReplica('user:alice'), 1, runtime.hostOffers())
  r = addTask(r, [HOME_ID], 'Hub', 2, 'hub')
  r = addMemberAt(r, [HOME_ID, 'hub'], 'desktop', 'Desktop', ['read'], 3)
  r = addRelayMessage(r, [HOME_ID, 'hub'], 'desktop', 4, 'm1')
  r = addRelayMessage(r, [HOME_ID, 'hub'], 'stranger', 4, 'm2')
  r = runtime.afterSubmission(r, [HOME_ID, 'hub', 'm1'], 5)
  expect(view(r, [...membershipPathAt(r, [HOME_ID, 'hub'], 'desktop')!, RELAY_QUEUE_ID])!.tasks.map(t => t.id)).toEqual(['m1'])
  expect(view(r, [HOME_ID, 'hub'])!.tasks.map(t => t.id)).toEqual(['m2'])
})
