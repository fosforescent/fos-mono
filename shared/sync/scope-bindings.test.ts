import { primitive } from './primitives'
import {
  addMemberAt, addRefAt, addRequirement, addTask, demandPattern, supplyRequirement, supplyValue,
  compileRefGraph, content, contextBindings, createReplica, discoverHandlers, headCid, put, refNodeContent,
  resolveBinding, resolveRefExpression, resolveRefIdentity, resolveScope, resolveText, setHandlerEnabledAt,
  setHandlerOffersAt, setRefValueAt, visibleBindings, valueContent
} from './index'

const at = (r: ReturnType<typeof createReplica>, path: string[]) => resolveScope(r.store, headCid(r), path)!
const literal = (r: ReturnType<typeof createReplica>, value: string) => put(r.store, { data: { description: { content: value } }, children: [] })

test('explicit arguments and structural ancestor paths retain their target while bare names resolve locally', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'outer', type, 1, literal(r, 'Outer tools'), 'Tools')
  r = addTask(r, [], 'Child', 2, 'child')
  r = addRefAt(r, ['child'], 'inner', type, 3, literal(r, 'Inner tools'), 'Tools')
  const explicit = put(r.store, { data: { ref: { id: 'outer' } }, children: [] })
  const structural = put(r.store, { data: { refExpression: { up: 1, path: ['Tools'], lexical: false } }, children: [] })
  for (const supplied of [explicit, structural]) {
    r = addRefAt(r, ['child'], 'argument', type, 4, supplied, 'argument')
    expect(resolveText(r, ['child'], '{argument} / {Tools}').text).toBe('Outer tools / Inner tools')
    const compiled = compileRefGraph(r, at(r, ['child', 'argument']), ['child', 'argument'])
    expect(compiled.complete).toBe(true)
    expect(content(r.store, compiled.cid).data.description?.content).toBe('Outer tools')
  }
  const declaration = resolveRefIdentity(r, ['child'], 'outer').locations[0]!
  expect(declaration.scope).toEqual({ store: r.store, path: [] })
  expect(declaration.submissions.map(value => value.cid)).toEqual([literal(r, 'Outer tools')])
})

test('all reference consumers retain conflicting same-ref assignments instead of selecting by traversal order', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'one', type, 1, literal(r, 'Same'), 'Tools')
  r = addRefAt(r, [], 'two', type, 2, literal(r, 'Same'), 'Tools')
  const reference = put(r.store, { data: { ref: { id: 'one' } }, children: [] })
  const binding = () => resolveRefIdentity(r, [], 'one').locations[0]!
  expect(binding().assignments).toHaveLength(2)
  expect(resolveBinding(r.store, type, binding()).status).toBe('ready')
  expect(compileRefGraph(r, reference, ['use']).complete).toBe(true)
  r = setRefValueAt(r, ['two'], literal(r, 'Different'), 3)
  const resolved = resolveBinding(r.store, type, binding())
  expect(resolved.status).toBe('conflict')
  expect(resolved.sources).toEqual(expect.arrayContaining([at(r, ['one']), at(r, ['two'])]))
  expect(resolveText(r, [], '{Tools}').bindings[0]!.status).toBe('conflict')
  expect(resolveText(r, [], '{{.Tools}}').bindings[0]!.status).toBe('conflict')
  expect(discoverHandlers(r, []).filter(offer => offer.enabled)).toEqual([])
  expect(resolveBinding(r.store, type, at(r, ['one']), contextBindings(r, [])).status).toBe('conflict')
  expect(compileRefGraph(r, reference, ['use']).complete).toBe(false)
})

test('supplies, arguments and handler discovery share a peer declaration and its withdrawal', () => {
  let r = addMemberAt(createReplica('owner'), [], 'peer', 'Peer', [], 1)
  const type = put(r.store, { data: {}, children: [] })
  // the peer offers a value of the demanded capability (a confirmation) as a named declaration
  const value = supplyValue(r.store, demandPattern(r.store, [], { capability: 'confirmation' }), 'peer')
  const offered = put(r.store, refNodeContent(r.store, { alias: { id: 'funding' }, name: { content: 'Funding' } }, value))
  r = setHandlerOffersAt(r, [], 'peer', type, [offered], 2)
  r = addRequirement(r, [], 'Budget', 3, { capability: 'confirmation' }, 'budget')
  r = supplyRequirement(r, [], 'budget', { by: 'peer', ref: 'funding' }, 4)
  const pattern = valueContent(r.store, headCid(r)).children.find(edge => content(r.store, edge[1]).data.alias?.id === 'budget')![0]
  const check = () => { const resolved = resolveBinding(r.store, pattern, at(r, ['budget']), [], undefined, { checkDependencies: false }); return { satisfied: resolved.status === 'ready', problems: resolved.problems } }
  const binding = resolveRefIdentity(r, ['budget'], 'funding').locations[0]!
  expect(contextBindings(r, ['budget']).find(candidate => candidate.cid === offered)?.binding?.scope).toEqual(binding.scope)
  expect(discoverHandlers(r, ['budget']).find(offer => offer.id === 'funding')?.scope).toEqual(binding.scope)
  expect(check().satisfied).toBe(true)
  r = setHandlerEnabledAt(r, [], 'peer', 'funding', false, 5)
  expect(resolveRefIdentity(r, ['budget'], 'funding').status).toBe('denied')
  expect(contextBindings(r, ['budget']).some(candidate => candidate.cid === offered)).toBe(false)
  expect(check().satisfied).toBe(false)
  expect(check().problems).toEqual([expect.stringMatching(/unavailable in this scope/)])
})

test('empty explicit refs never borrow a different same-name provider', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'outer', type, 1, literal(r, 'Outer'), 'Tools')
  r = addTask(r, [], 'Child', 2, 'child')
  r = addRefAt(r, ['child'], 'unfilled', type, 3, null, 'Tools')
  expect(resolveText(r, ['child'], '{Tools}').text).toBe('Outer')
  const binding = resolveRefIdentity(r, ['child'], 'unfilled').locations[0]!
  expect(resolveBinding(r.store, type, binding, contextBindings(r, ['child'])).status).toBe('missing')
  const ref = put(r.store, { data: { ref: { id: 'unfilled' } }, children: [] })
  expect(compileRefGraph(r, ref, ['child', 'use']).complete).toBe(false)
})

test('denied nearer declarations block outer providers across lookup and compilation', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'outer', type, 1, literal(r, 'Outer'), 'Tools')
  r = addTask(r, [], 'Child', 2, 'child')
  r = addRefAt(r, ['child'], 'inner', type, 3, literal(r, 'Secret'), 'Tools')
  const access = { canRead: (_store: typeof r.store, _cid: string, path: string[]) => path.at(-1) !== 'inner' }
  expect(resolveRefExpression(r, ['child'], 'Tools', access).status).toBe('denied')
  expect(contextBindings(r, ['child'], access)).toEqual([])
  expect(discoverHandlers(r, ['child'], access)).toEqual([])
  const ref = put(r.store, { data: { refExpression: { up: 0, path: ['Tools'], lexical: true } }, children: [] })
  expect(compileRefGraph(r, ref, ['child', 'use'], access).holes[0]?.reason).toBe('denied')
  expect(visibleBindings(r, ['child'], access).some(binding => binding.id === 'outer')).toBe(false)
})

test('nested accepted handler properties obey the same peer policy as their structural path', () => {
  let r = addMemberAt(createReplica('owner'), [], 'peer', 'Peer', [], 1)
  const type = put(r.store, { data: {}, children: [] })
  const child = put(r.store, refNodeContent(r.store, { alias: { id: 'child' }, name: { content: 'child' } }, literal(r, 'value')))
  const value = put(r.store, { data: {}, children: [[type, child]] })
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'parent' }, name: { content: 'parent' } }, value))
  r = setHandlerOffersAt(r, [], 'peer', type, [handler], 2)
  expect(resolveRefExpression(r, [], '.parent.child').status).toBe('ready')
  r = setHandlerEnabledAt(r, [], 'peer', 'child', false, 3)
  expect(discoverHandlers(r, []).find(offer => offer.id === 'child')?.enabled).toBe(false)
  expect(resolveRefExpression(r, [], '.parent.child').status).toBe('denied')
  expect(contextBindings(r, []).some(candidate => candidate.name === 'parent.child')).toBe(false)
})

test('peer submissions explicitly offer alternatives to one capability node, even with the same label', () => {
  let r = createReplica('owner')
  const capability = put(r.store, { data: {}, children: [] })
  for (const peer of ['alice', 'bob']) {
    r = addMemberAt(r, [], peer, peer, [], 1)
    const handler = put(r.store, refNodeContent(r.store, { alias: { id: peer }, name: { content: 'Tools' } }, literal(r, peer)))
    r = setHandlerOffersAt(r, [], peer, capability, [handler], 2)
  }
  const bindings = visibleBindings(r, [])
  expect(bindings.map(binding => binding.capability)).toEqual([capability, capability])
  expect(bindings.every(binding => binding.assignments.length === 1)).toBe(true)
  expect(resolveBinding(r.store, capability, null, contextBindings(r, []), 'Tools').status).toBe('ambiguous')
  expect(resolveRefExpression(r, [], 'Tools').status).toBe('ambiguous')
  expect(resolveBinding(r.store, capability, resolveRefIdentity(r, [], 'alice').locations[0]!).cid).toBe(literal(r, 'alice'))
  r = setHandlerEnabledAt(r, [], 'bob', 'bob', false, 3)
  expect(resolveBinding(r.store, capability, null, contextBindings(r, []), 'Tools').cid).toBe(literal(r, 'alice'))
  expect(resolveRefExpression(r, [], 'Tools').locations[0]?.path.at(-1)).toBe('alice')
})

test('explicit alternatives have the same graph meaning without any peer membership', () => {
  let r = createReplica(), capability = put(r.store, { data: {}, children: [] })
  const handlers = ['alice', 'bob'].map(id => put(r.store, refNodeContent(r.store, { alias: { id }, name: { content: 'Tools' } }, literal(r, id))))
  const alternatives = put(r.store, { data: { refAlternatives: true }, children: handlers.map(handler => [capability, handler]) })
  r = addRefAt(r, [], 'Tools', capability, 1, alternatives, 'Tools')
  expect(discoverHandlers(r, []).filter(offer => offer.enabled)).toHaveLength(2)
  expect(resolveBinding(r.store, capability, resolveRefIdentity(r, [], 'Tools').locations[0]!).status).toBe('ambiguous')
  expect(compileRefGraph(r, at(r, ['Tools']), ['Tools'], { selected: true }).holes[0]?.reason).toBe('ambiguous')
  r = setRefValueAt(r, ['Tools'], handlers[0]!, 2)
  expect(resolveBinding(r.store, capability, resolveRefIdentity(r, [], 'Tools').locations[0]!).cid).toBe(literal(r, 'alice'))
  expect(compileRefGraph(r, at(r, ['Tools']), ['Tools'], { selected: true }).complete).toBe(true)
})
