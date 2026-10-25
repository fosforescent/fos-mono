import { content,
  addRefCall, createReplica, nativeRef, publishNativeRef, primitiveExecutors, discoverHandlers, evaluationSteps, evaluateNode, put,
  refSubmissions, primitiveValue, resolveRefExpression, compileRow, setHandlerEnabledAt, serializeReplica, loadReplica,
  addRefAt, primitiveRef
} from './index'

test('host primitives are execute-only sub-refs and ordinary rows call them without capability kinds', async () => {
  let r = createReplica('host'), calls = 0
  const type = (store: typeof r.store) => put(store, { data: { name: { content: 'custom-render-pattern' } }, children: [] })
  const render = { id: 'native:render', label: 'render', type, native: async () => { calls++; return {} } }
  const other = { id: 'native:other-render', label: 'other-render', type, native: async () => { throw new Error('Wrong implementation') } }
  for (const definition of [render, other]) r = publishNativeRef(r, [], 'host', nativeRef(r.store, 'host', definition), 1)
  const ref = resolveRefExpression(r, [], '.host.render').locations[0]!
  expect(ref).toBeDefined()
  expect(primitiveValue(r.store, refSubmissions(r.store, ref.cid)[0]!)).toEqual({ implementation: render.id, host: 'host', access: 'execute' })
  r = addRefCall(r, [], ref.cid, 2, 'call')
  r = loadReplica(serializeReplica(r))
  // Loading data restores refs; reconstructing host primitive values restores their runtime meanings.
  for (const definition of [render, other]) nativeRef(r.store, 'host', definition)
  const step = evaluationSteps(r, ['call'])[0]!
  expect(step.row?.requirement).toBeUndefined()
  expect(compileRow(r, ['call']).canRun).toBe(true)
  expect(primitiveExecutors(r, step, 'host').map(value => value.native)).toEqual([render])
  const completed = await evaluateNode(['call'], { get: () => r, save: next => { r = next }, now: () => 3,
    check: () => [], executors: current => primitiveExecutors<void>(r, current, 'host').map(value => ({ native: value.native.native! })) })
  expect(completed.error).toBeUndefined()
  expect(completed.status).toBe('committed')
  expect(calls).toBe(1)
  r = setHandlerEnabledAt(r, [], 'host', content(r.store, ref.cid).data.alias!.id, false, 4)
  expect(primitiveExecutors(r, step, 'host')).toEqual([])
  await expect(evaluateNode(['call'], { get: () => r, save: () => {}, now: () => 5, check: () => [], executors: () => [] })).rejects.toThrow(/no available executor/)
})

test('unregistered and foreign primitive identities never select local code', () => {
  let r = createReplica('device')
  const type = put(r.store, { data: {}, children: [] })
  nativeRef<void>(r.store, 'device', { id: 'registered', type: () => type, native: async () => ({}) })
  const foreign = primitiveRef(r.store, { id: 'foreign', implementation: 'registered', type, host: 'other-host' })
  r = addRefAt(r, [], 'alias', type, 1, foreign, 'foreign')
  r = addRefCall(r, [], foreign, 2, 'call')
  expect(discoverHandlers(r, []).some(offer => offer.peerId === 'other-host')).toBe(true)
  expect(primitiveExecutors(r, evaluationSteps(r, ['call'])[0]!, 'device')).toEqual([])
  const unknown = primitiveRef(r.store, { id: 'unknown', type, host: 'device' })
  r = addRefAt(r, [], 'unknown-alias', type, 3, unknown)
  r = addRefCall(r, [], unknown, 4, 'unknown-call')
  expect(primitiveExecutors(r, evaluationSteps(r, ['unknown-call'])[0]!, 'device')).toEqual([])
})
