import { CAPABILITIES, SERVER_TRANSPORT_CAPABILITIES, createReplica, ensureHomeContext, view, HOME_ID } from '@fosforescent/shared/sync/index'
import { createHandlerRegistry } from './registry'

test('advertised capabilities are exactly transport facts plus registered handlers', () => {
  const registry = createHandlerRegistry([
    { peerId: 'fos', capability: 'search' }, { peerId: 'fos', capability: 'llm' }, { peerId: 'fos', capability: 'search' },
    { peerId: 'integration:github', capability: 'repo', effect: async () => undefined },
    { peerId: 'integration:phone', capability: 'notify', available: async () => false }
  ])
  expect(registry.serverCapabilities()).toEqual([...new Set([...SERVER_TRANSPORT_CAPABILITIES, 'search', 'llm'])].sort())
  for (const unbacked of ['mail', 'send-payment', 'receive-payment', 'allocate', 'request-payment', 'cron']) expect(registry.serverCapabilities()).not.toContain(unbacked)
  expect(registry.integrationOffers()).toEqual({ github: ['repo'], phone: ['notify'] })
  const step = (capability: string) => ({ path: ['t', 'r'], row: { id: 'r', kind: 'requirement', requirement: { capability } } } as any)
  expect(registry.executors(step('repo'))).toHaveLength(1)
  expect(registry.executors(step('search'))).toHaveLength(0)
})

test('availability follows the handler, and every advertised capability is a known one', async () => {
  const registry = createHandlerRegistry([
    { peerId: 'integration:github', capability: 'repo', available: async id => id === 1 },
    { peerId: 'fos', capability: 'poll' }
  ])
  expect(await registry.active('integration:github', 1)).toBe(true)
  expect(await registry.active('integration:github', 2)).toBe(false)
  expect(await registry.active('fos', 2)).toBe(true)
  expect(await registry.active('integration:google', 1)).toBe(false)
  for (const cap of registry.serverCapabilities()) expect(CAPABILITIES).toContain(cap)
})

test('the registry is what Home advertises for fos and the integration peers', () => {
  const registry = createHandlerRegistry([{ peerId: 'fos', capability: 'market' }, { peerId: 'integration:google', capability: 'calendar' }])
  const r = ensureHomeContext(createReplica('user:alice'), 1, registry.hostOffers())
  const fos = view(r, [])!.members.find(m => m.peerId === 'fos')!
  expect([...(fos.accepts ?? [])].sort()).toEqual(registry.serverCapabilities())
  const home = view(r, [HOME_ID])!.members
  expect(home.find(m => m.peerId === 'integration:google')!.accepts).toEqual(['calendar'])
  expect(home.find(m => m.peerId === 'integration:github')!.accepts ?? []).toEqual([])
})
