import { installTestHandler } from './test-helpers'
import { addMemberAt, addTask, capabilityPeers, libAt, contextBindings, createBranch, createReplica, discoverHandlers, headCid, put, refNodeContent, resolveBinding, selectBranch, setHandlerEnabledAt, setHandlerOffersAt, setMemberCapabilitiesAt, workHandler, view } from './index'
import { TEMPLATE_TYPE } from './library-types'

test('permissions do not become handlers; built-in offers use the same candidates as typed offers', () => {
  let r = addMemberAt(createReplica('owner'), [], 'guest', 'Guest', ['llm', 'edit'], 1)
  expect(discoverHandlers(r, [])).toEqual([])
  r = installTestHandler(r, 'fos', 'llm')
  const offer = discoverHandlers(r, [])[0]!
  expect(contextBindings(r, [])).toContainEqual(expect.objectContaining({ cid: offer.cid, type: offer.type, name: 'llm', refIds: [offer.id], scope: { store: r.store, path: [] }, binding: expect.objectContaining({ cid: offer.cid, submissions: expect.any(Array) }) }))
  expect(workHandler(r, []).status).toBe('ready')
  expect(discoverHandlers(r, [], { isPeerActive: () => false })[0]!.active).toBe(false)
  expect(contextBindings(r, [], { isPeerActive: () => false })).toEqual([])
})

test('custom typed handlers survive built-in edits and individual toggles', () => {
  let r = addMemberAt(createReplica('owner'), [], 'peer', 'Peer', ['read'], 1)
  const type = put(r.store, { data: { name: { content: 'custom capability' } }, children: [] })
  const value = put(r.store, { data: { name: { content: 'custom capability' }, description: { content: 'custom value' } }, children: [] })
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'custom-handler' } }, value, []))
  r = setHandlerOffersAt(r, [], 'peer', type, [handler], 2)
  expect(resolveBinding(r.store, type, null, contextBindings(r, [])).cid).toBe(value)
  r = setHandlerEnabledAt(r, [], 'peer', 'custom-handler', false, 3)
  r = setMemberCapabilitiesAt(r, [], 'peer', ['read', 'edit'], [], 4)
  expect(discoverHandlers(r, [])[0]).toMatchObject({ cid: handler, enabled: false })
  expect(contextBindings(r, [])).toEqual([])
  r = setHandlerEnabledAt(r, [], 'peer', 'custom-handler', true, 5)
  expect(contextBindings(r, [])[0]!.cid).toBe(handler)
})

test('main controls capability discovery while editing an alternative; policy edits affect main', () => {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  r = addMemberAt(r, ['project'], 'fos', 'fos', ['llm'], 2)
  r = createBranch(r, ['project'], 'experiment', 3)
  r = setMemberCapabilitiesAt(r, ['project'], 'fos', ['llm'], ['llm'], 4)
  expect(capabilityPeers(r, ['project'], 'llm')).toEqual([])
  selectBranch(r.store, 'project', 'main')
  expect(view(r, ['project'])!.members[0]!.disabled).toContain('llm')
  selectBranch(r.store, 'project', 'experiment')
  expect(workHandler(r, ['project']).status).toBe('missing')
})

test('wrong handler type is rejected without advancing the head', () => {
  const r = addMemberAt(createReplica(), [], 'peer', 'Peer', [], 0), before = headCid(r)
  const handler = put(r.store, refNodeContent(r.store, {}, null, []))
  expect(() => setHandlerOffersAt(r, [], 'peer', libAt(r.store).capabilities.repo!, [handler], 1)).toThrow()
  expect(headCid(r)).toBe(before)
})

test('published templates use ordinary instantiation and inherit per-peer toggles', async () => {
  const { addRow, publishTemplate, instantiateTemplateValue, refValueCid, content, resolveScope } = await import('./index')
  let r = addRow(createReplica('device'), [], TEMPLATE_TYPE, 'Build {feature}', 1, { id: 'template' })
  r = addTask(r, ['template'], 'Write tests', 2, 'tests')
  r = addTask(r, [], 'Project', 3, 'project')
  r = publishTemplate(r, [], ['template'], 'Build feature', 4)
  const offer = discoverHandlers(r, ['project']).find(o => o.type === r.store.primitive.templateField.getId())!
  expect(offer.label).toBe('Build feature')
  const source = refValueCid(r.store, content(r.store, offer.cid))!
  r = addTask(r, ['project'], 'Instance', 5, 'instance')
  r = instantiateTemplateValue(r, ['project'], 'instance', source, 6)
  expect(view(r, ['project', 'instance'])!.tasks.some(t => t.title === 'Write tests')).toBe(true)
  r = setHandlerEnabledAt(r, ['project'], 'device', offer.id, false, 7)
  expect(discoverHandlers(r, ['project']).find(o => o.id === offer.id)!.enabled).toBe(false)
  expect(discoverHandlers(r, []).find(o => o.id === offer.id)!.enabled).toBe(true)
  expect(resolveScope(r.store, headCid(r), ['template'])).toBe(source)
})
