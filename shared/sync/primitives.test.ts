import { content,
  addRefCall, createReplica, primitiveRef, publishPrimitive, primitiveExecutors, discoverHandlers, evaluationSteps, evaluateNode, put,
  refSubmissions, primitiveValue, resolveRefExpression, compileRow, setHandlerEnabledAt, serializeReplica, loadReplica,
  addRefAt, handlerRef
} from './index'

test('host primitives are execute-only sub-refs and ordinary rows call them without capability kinds', async () => {
  let r = createReplica('host'), calls = 0
  const type = (store: typeof r.store) => put(store, { data: { name: { content: 'custom-render-pattern' } }, children: [] })
  const render = { id: 'primitive:render', label: 'render', capability: type, run: async () => { calls++; return {} } }
  const other = { id: 'primitive:other-render', label: 'other-render', capability: type, run: async () => { throw new Error('Wrong implementation') } }
  for (const definition of [render, other]) r = publishPrimitive(r, [], 'host', primitiveRef(r.store, 'host', definition), 1)
  const ref = resolveRefExpression(r, [], '.host.render').locations[0]!
  expect(ref).toBeDefined()
  expect(primitiveValue(r.store, refSubmissions(r.store, ref.cid)[0]!)).toEqual({ implementation: render.id, host: 'host' })
  r = addRefCall(r, [], ref.cid, 2, 'call')
  r = loadReplica(serializeReplica(r))
  // Loading data restores refs; reconstructing host primitive values restores their runtime meanings.
  for (const definition of [render, other]) primitiveRef(r.store, 'host', definition)
  const step = evaluationSteps(r, ['call'])[0]!
  expect(step.row?.requirement).toBeUndefined()
  expect(compileRow(r, ['call']).canRun).toBe(true)
  expect(primitiveExecutors(r, step, 'host').map(value => value.implementation)).toEqual([render])
  const completed = await evaluateNode(['call'], { get: () => r, save: next => { r = next }, now: () => 3,
    check: () => [], executors: current => primitiveExecutors(r, current, 'host').map(value => ({ run: value.implementation.run! })) })
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
  primitiveRef(r.store, 'device', { id: 'registered', capability: () => type, run: async () => ({}) })
  const foreign = handlerRef(r.store, 'other-host', { id: 'registered', capability: () => type })
  r = addRefAt(r, [], 'alias', type, 1, foreign, 'foreign')
  r = addRefCall(r, [], foreign, 2, 'call')
  expect(discoverHandlers(r, []).some(offer => offer.peerId === 'other-host')).toBe(true)
  expect(primitiveExecutors(r, evaluationSteps(r, ['call'])[0]!, 'device')).toEqual([])
  const unknown = handlerRef(r.store, 'device', { id: 'unknown', capability: () => type })
  r = addRefAt(r, [], 'unknown-alias', type, 3, unknown)
  r = addRefCall(r, [], unknown, 4, 'unknown-call')
  expect(primitiveExecutors(r, evaluationSteps(r, ['unknown-call'])[0]!, 'device')).toEqual([])
})
