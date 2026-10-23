import { declareTestCapability } from './test-helpers'
import {
  addMemberAt, addRefAt, addRow, addSupply, ALLOCATION_TYPE, addTask, applyProposalAt, libAt, content, contextBindings, nativeRef, publishNativeRef, primitiveExecutors,
  createReplica, discoverHandlers, headCid, inspectRef, matchesRefPattern, parsePolicy, proposeRefAt, put,
  refNodeContent, refSubmissions, requirementSatisfied, resolveBinding, resolveScope, resolveText, scopedRefs,
  serializeReplica, loadReplica, nestScope, setHandlerEnabledAt, type EvaluationStep
} from './index'

const leaf = (r: ReturnType<typeof createReplica>, name: string) => put(r.store, { data: { description: { content: name } }, children: [] })
const at = (r: ReturnType<typeof createReplica>, path: string[]) => resolveScope(r.store, headCid(r), path)!

test('a nested document inherits device ref declarations without writing device declarations into the document', () => {
  let device = declareTestCapability(createReplica('device'), 'custom')
  device = publishNativeRef(device, [], 'device', nativeRef(device.store, 'device', { id: 'device:custom', type: store => libAt(store).capabilities.custom! }), 1)
  const document = createReplica('device')
  const before = headCid(document)
  nestScope(document.store, { store: device.store, root: headCid(device), at: [] })
  expect(discoverHandlers(document, []).some(offer => offer.type === libAt(device.store).capabilities.custom)).toBe(true)
  expect(headCid(document)).toBe(before)
  const shared = addMemberAt(document, [], 'device', 'Device', ['read'], 2)
  expect(discoverHandlers(shared, []).some(offer => offer.type === libAt(device.store).capabilities.custom)).toBe(true)
})

test('custom ref declarations work in scope without a capability enum, member, or global registry', () => {
  let r = addTask(createReplica('device'), [], 'Project', 1, 'project')
  const type = put(r.store, { data: {}, children: [] }), value = leaf(r, 'handler')
  r = addRefAt(r, [], 'custom', type, 2, value, 'custom')
  expect(discoverHandlers(r, ['project']).find(offer => offer.id === 'custom')).toMatchObject({ type, peerId: 'device' })
  expect(resolveBinding(r.store, type, null, contextBindings(r, ['project'])).cid).toBe(value)
  expect(parsePolicy({ from: ['custom-extension'], to: [] })?.from).toEqual(['custom-extension'])
  r = addRefAt(r, ['project'], 'custom', type, 3)
  expect(scopedRefs(r, ['project']).find(ref => ref.id === 'custom')!.values).toEqual([])
  expect(discoverHandlers(r, ['project']).some(offer => offer.id === 'custom')).toBe(false)
  expect(discoverHandlers(r, []).some(offer => offer.id === 'custom')).toBe(true)
})

test('submissions reveal sub-refs only after acceptance and keep alternatives separate across reload', () => {
  let r = createReplica('device')
  const type = put(r.store, { data: {}, children: [] }), childType = leaf(r, 'child value')
  const child = put(r.store, refNodeContent(r.store, { alias: { id: 'child' } }, leaf(r, 'child value'), []))
  const first = put(r.store, { data: { peerId: { content: 'remote' } }, children: [[childType, child]] })
  r = addRefAt(r, [], 'parent', type, 1)
  expect(requirementSatisfied(r.store, at(r, ['parent']))).toBe(false)
  const pending = proposeRefAt(r, ['parent'], first, 'remote', 2)
  r = pending.replica
  expect(discoverHandlers(r, []).some(offer => offer.id === 'child')).toBe(false)
  r = applyProposalAt(r, ['parent'], pending.proposalCid, 'device', 3)
  expect(discoverHandlers(r, []).find(offer => offer.id === 'child')).toMatchObject({ peerId: 'remote', type: childType })
  const second = leaf(r, 'another handler'), proposal = proposeRefAt(r, ['parent'], second, 'another', 4)
  r = applyProposalAt(proposal.replica, ['parent'], proposal.proposalCid, 'device', 5)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  expect(refSubmissions(r.store, at(r, ['parent'])).sort()).toEqual([first, second].sort())
  expect(discoverHandlers(r, []).filter(offer => offer.id === 'parent')).toHaveLength(2)
  expect(resolveBinding(r.store, type, null, contextBindings(r, [])).status).toBe('ambiguous')
})

test('declarations in sibling documents are not ambient capabilities', () => {
  let r = addTask(createReplica(), [], 'Private', 1, 'private')
  r = addTask(r, [], 'Other', 2, 'other')
  r = addRefAt(r, ['private'], 'hidden', leaf(r, 'type'), 3, leaf(r, 'value'))
  expect(discoverHandlers(r, ['other']).some(offer => offer.id === 'hidden')).toBe(false)
  expect(discoverHandlers(r, ['private']).some(offer => offer.id === 'hidden')).toBe(true)
})

test('named text bindings use the nearest declaration while type lookups aggregate alternatives', () => {
  let r = addTask(createReplica(), [], 'Child', 1, 'child')
  const text = r.store.primitive.documentField.getId()
  r = addRefAt(r, [], 'outer', text, 2, leaf(r, 'Ada'), 'recipient')
  r = addRefAt(r, ['child'], 'inner', text, 3, leaf(r, 'Grace'), 'recipient')
  expect(resolveText(r, ['child'], 'Hello {recipient}').text).toBe('Hello Grace')
  expect(resolveBinding(r.store, text, null, contextBindings(r, ['child'])).status).toBe('ambiguous')
})

test('patterns recurse through rows and submitted refs without node type declarations', () => {
  const r = createReplica(), key = leaf(r, 'next'), end = leaf(r, 'unit')
  const wrap = (child: string) => put(r.store, { data: {}, children: [[key, child]] })
  const pattern = wrap(wrap(end))
  const terminal = put(r.store, refNodeContent(r.store, { alias: { id: 'end' } }, end))
  const tree = wrap(wrap(terminal))
  expect(matchesRefPattern(r.store, pattern, tree)).toBe(true)
  expect(matchesRefPattern(r.store, wrap(end), tree)).toBe(false)
  expect(resolveBinding(r.store, pattern, null, [{ cid: tree, type: pattern }]).status).toBe('ready')
})

test('device and host native implementations are selected through published refs and respect disabled offers', async () => {
  let r = declareTestCapability(createReplica('device'), 'extension:paint'), calls = 0
  const ref = nativeRef<void>(r.store, 'device', { id: 'custom:executor', type: store => libAt(store).capabilities['extension:paint']!, effect: async () => { calls++ } })
  const step = { path: [], row: { requirement: { capability: 'extension:paint' } } } as unknown as EvaluationStep
  expect(primitiveExecutors(r, step, 'device')).toEqual([])
  r = publishNativeRef(r, [], 'device', ref, 1)
  await primitiveExecutors<void>(r, step, 'device')[0]!.native.effect!()
  expect(calls).toBe(1)
  r = setHandlerEnabledAt(r, [], 'device', content(r.store, ref).data.alias!.id, false, 2)
  expect(primitiveExecutors(r, step, 'device')).toEqual([])
})

test('a native implementation is reached through an assigned ref rather than the declaration name', () => {
  let r = declareTestCapability(createReplica('device'), 'paint')
  const reference = nativeRef<void>(r.store, 'device', { id: 'native:paint', type: store => libAt(store).capabilities.paint!, effect: async () => {} })
  r = addRefAt(r, [], 'my-handler', libAt(r.store).capabilities.paint!, 1, reference)
  const step = { path: [], row: { requirement: { capability: 'paint' } } } as unknown as EvaluationStep
  expect(primitiveExecutors(r, step, 'device')).toHaveLength(1)
  r = setHandlerEnabledAt(r, [], 'device', 'my-handler', false, 2)
  expect(primitiveExecutors(r, step, 'device')).toEqual([])
})

test('arbitrary extension names do not accidentally invoke Object prototype properties', () => {
  let r = addRow(createReplica(), [], ALLOCATION_TYPE, 'Custom requirement', 1, { id: 'req', requirement: { capability: 'constructor' } })
  r = addTask(r, ['req'], 'Unrelated', 2)
  expect(requirementSatisfied(r.store, at(r, ['req']))).toBe(false)
  r = addSupply(r, [], 'req', { capability: 'constructor', by: 'device' }, 3)
  expect(requirementSatisfied(r.store, at(r, ['req']))).toBe(true)
})

test('an old nominal annotation cannot satisfy a structural pattern', () => {
  let r = createReplica('device')
  const old = r.store.primitive.llmCapability.getId(), value = leaf(r, 'model')
  r = addRefAt(r, [], 'old-model', old, 1, value)
  expect(resolveBinding(r.store, libAt(r.store).capabilities.llm!, null, contextBindings(r, [])).status).toBe('missing')
})
