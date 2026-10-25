import { textValue, textOf } from './index'
import { primitive } from './primitives'
import { declareTestCapability } from './test-helpers'
import {
  addRefAt, addTask, applyProposalAt, libAt, compileRefGraph, compileRow, content, createReplica,
  headCid, putBranches, loadReplica, matchesRefPattern, parseRefExpression, proposeRefAt, put, refNodeContent,
  resolveRefExpression, resolveScope, resolveText, serializeReplica, updateAtScope, commitRoot, refValueCompatible,
  saveRefCompilation, valueContent, executionInputs, executionInput, executionSnapshot, evaluateNode,
  resolveRefIdentity, assertCompiledGraph, reachableNodes, setRefValueAt,
  compileConstructorCall, constructAt, assignRefAt, openRefs, textOf
} from './index'

const at = (r: ReturnType<typeof createReplica>, path: string[]) => resolveScope(r.store, headCid(r), path)!
const text = (r: ReturnType<typeof createReplica>, value: string) => textValue(r.store, value)

test('dot and application syntax agree, and ascent is counted before property lookup', () => {
  expect(parseRefExpression('....ref1.ref2')).toEqual({ up: 3, path: ['ref1', 'ref2'], lexical: false })
  expect(parseRefExpression('(ref2 (ref1 (.. (.. .))))')).toEqual(parseRefExpression('...ref1.ref2'))
  expect(() => parseRefExpression('(ref1 .) trailing')).toThrow()
  let r = createReplica(), type = primitive(r.store, 'string')
  const name = put(r.store, refNodeContent(r.store, { alias: { id: 'name-id' }, name: { content: 'name' } }, text(r, 'Ada'), []))
  r = addRefAt(r, [], 'profile-id', text(r, 'profile type'), 1, put(r.store, { data: {}, children: [[type, name]] }), 'profile')
  r = addTask(r, [], 'Child', 2, 'child')
  expect(resolveRefExpression(r, ['child'], '..profile.name').locations[0]?.cid).toBe(name)
  expect(resolveRefExpression(r, ['child'], '.profile.name').status).toBe('missing')
  expect(resolveText(r, ['child'], 'Hello {..profile.name} / {(name (profile (.. .)))}').text).toBe('Hello Ada / Ada')
  expect(resolveRefExpression(r, ['child'], '...profile.name').status).toBe('missing')
})

test('row shorthand constructs expression refs without flattening property names into inputs', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], 'name', type, 1, text(r, 'Ada'), 'name')
  r = addTask(r, [], 'Hello {..name}', 2, 'hello')
  const parameters = content(r.store, at(r, ['hello'])).children.map(edge => content(r.store, edge[1]))
  expect(parameters.some(node => node.data.refExpression?.up === 1)).toBe(true)
  expect(resolveText(r, ['hello'], 'Hello {..name}').text).toBe('Hello Ada')
  r = addTask(r, [], '.name', 3, 'direct')
  expect(compileRefGraph(r, at(r, ['direct']), ['direct']).complete).toBe(true)
  expect(content(r.store, at(r, ['direct'])).data.refExpression).toEqual(parseRefExpression('.name'))
})

test('UUID links use enclosing declarations and cannot search sibling subtrees', () => {
  let r = addTask(createReplica(), [], 'Folder', 1, 'folder')
  const id = '550e8400-e29b-41d4-a716-446655440000', type = primitive(r.store, 'string')
  r = addRefAt(r, ['folder'], id, type, 2, text(r, 'Nested value'), 'value')
  const link = put(r.store, { data: { ref: { id } }, children: [] })
  expect(resolveRefIdentity(r, [], id).status).toBe('missing')
  expect(compileRefGraph(r, link).complete).toBe(false)
  expect(resolveRefIdentity(r, ['folder'], id).locations[0]?.path).toEqual(['folder', id])
  expect(compileRefGraph(r, link, ['folder', 'consumer']).complete).toBe(true)
  const denied = compileRefGraph(r, link, ['folder', 'consumer'], { canRead: (_store, _cid, path) => path.at(-1) !== id })
  expect(denied.complete).toBe(false)
  expect(denied.holes[0]).toMatchObject({ id, reason: 'denied' })
})

test('compilation produces a stable partial CID and retains editor locations only in diagnostics', () => {
  let r = createReplica(), type = primitive(r.store, 'string')
  r = addRefAt(r, [], '550e8400-e29b-41d4-a716-446655440000', type, 1, null, 'input')
  const partial = compileRefGraph(r, at(r, ['550e8400-e29b-41d4-a716-446655440000']))
  expect(partial.holes).toEqual(expect.arrayContaining([expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000', reason: 'unbound' })]))
  expect(partial.complete).toBe(false)
  expect(() => assertCompiledGraph(r.store, [partial.cid])).not.toThrow()
  expect(JSON.stringify(reachableNodes(r.store, [partial.cid]))).not.toContain('550e8400-e29b-41d4-a716-446655440000')
  const saved = saveRefCompilation(r, [], 'compiled-snapshot', partial, 1)
  const reloaded = loadReplica(serializeReplica(saved))
  expect(valueContent(reloaded.store, at(reloaded, ['compiled-snapshot'])).data.refCompilation).toEqual({ cid: partial.cid })
  expect(reloaded.store.table.has(partial.cid)).toBe(true)
  const restored = loadReplica(serializeReplica(r))
  expect(compileRefGraph(restored, at(restored, ['550e8400-e29b-41d4-a716-446655440000'])).cid).toBe(partial.cid)
  const proposal = proposeRefAt(r, ['550e8400-e29b-41d4-a716-446655440000'], text(r, 'Filled'), 'owner', 2)
  r = applyProposalAt(proposal.replica, ['550e8400-e29b-41d4-a716-446655440000'], proposal.proposalCid, 'owner', 3)
  const full = compileRefGraph(r, at(r, ['550e8400-e29b-41d4-a716-446655440000']))
  expect(full.holes).toEqual([])
  expect(full.cid).not.toBe(partial.cid)
})

test('compiled dependencies and holes do not depend on editor UUIDs; edits require recompilation', () => {
  const build = (id: string) => {
    let r = createReplica(), type = primitive(r.store, 'string')
    r = addRefAt(r, [], id, type, 1, text(r, 'Before'), 'source')
    const link = put(r.store, { data: { alias: { id: `${id}-use` }, ref: { id } }, children: [] })
    const compiled = compileRefGraph(r, link, ['consumer'])
    const open = put(r.store, refNodeContent(r.store, { alias: { id: `${id}-output` }, name: { content: 'result' } }, null))
    return { r, link, compiled, partial: compileRefGraph(r, open) }
  }
  const a = build('550e8400-e29b-41d4-a716-446655440000'), b = build('ab078f34-6048-42cb-bf33-8b1c49e823da')
  expect(a.compiled.cid).toBe(b.compiled.cid)
  expect(a.partial.cid).toBe(b.partial.cid)
  expect(a.partial.holes[0]!.id).not.toBe(b.partial.holes[0]!.id)
  expect(() => assertCompiledGraph(a.r.store, [a.compiled.cid, a.partial.cid])).not.toThrow()
  a.r = setRefValueAt(a.r, ['550e8400-e29b-41d4-a716-446655440000'], text(a.r, 'After'), 2)
  expect(textOf(a.r.store, a.compiled.cid)).toBe('Before')
  expect(textOf(a.r.store, compileRefGraph(a.r, a.link, ['consumer'], { selected: true }).cid)).toBe('After')
})

test('constructor calls compile references and explicit overrides while keeping output locations out of the graph', () => {
  let r = addTask(createReplica(), [], 'Fetch', 1, 'call')
  const constructor = libAt(r.store).capabilities.fetch!, type = primitive(r.store, 'string')
  r = addRefAt(r, [], '550e8400-e29b-41d4-a716-446655440000', type, 2, text(r, 'https://example.com'), 'endpoint')
  r = constructAt(r, ['call'], constructor, { method: 'POST' }, 3)
  const url = openRefs(r.store, constructor).find(ref => ref.name === 'url')!
  r = assignRefAt(r, ['call'], url.alias, put(r.store, { data: { ref: { id: '550e8400-e29b-41d4-a716-446655440000' } }, children: [] }), 4)
  const call = compileConstructorCall(r, ['call'])
  expect(call.canRun).toBe(true)
  expect(textOf(r.store, call.args.find(arg => arg.name === 'url')!.cid)).toBe('https://example.com')
  expect(textOf(r.store, call.args.find(arg => arg.name === 'method')!.cid)).toBe('POST')
  expect(call.args.some(arg => arg.received && call.edits.has(arg.cid))).toBe(true)
  expect(JSON.stringify(reachableNodes(r.store, [call.cid]))).not.toContain('550e8400-e29b-41d4-a716-446655440000')
  const left = compileRow(r, ['call']).left
  expect(left.holes.every(hole => hole.reason === 'unbound')).toBe(true)
  expect(JSON.stringify(reachableNodes(r.store, [left.cid]))).toContain('POST')
  r = assignRefAt(r, ['call'], url.alias, put(r.store, { data: { scalar: { type: 'number', value: 17 } }, children: [] }), 5)
  expect(compileConstructorCall(r, ['call']).holes.some(hole => hole.reason === 'type')).toBe(true)
})

test('nested product holes are execute inputs and may be filled without replacing sibling properties', async () => {
  let r = addTask(createReplica(), [], 'Work', 1, 'work'), type = primitive(r.store, 'string')
  const answer = put(r.store, refNodeContent(r.store, { alias: { id: 'answer' }, name: { content: 'Answer' }, refRole: 'output' }, null, []))
  const sibling = put(r.store, refNodeContent(r.store, { alias: { id: 'sibling' }, name: { content: 'Sibling' } }, text(r, 'Keep'), []))
  r = addRefAt(r, ['work'], 'record', put(r.store, { data: {}, children: [] }), 2, put(r.store, { data: {}, children: [[type, answer], [type, sibling]] }), 'record')
  const field = executionInputs(r, ['work']).find(field => field.name === 'Answer')!
  expect(field.path).toEqual(['record', 'answer'])
  expect(field.role).toBe('output')
  expect(executionSnapshot(r, ['work']).canRun).toBe(true)
  r = executionInput(r, ['work'], { revision: headCid(r), key: field.key, value: 'Supplied' }, 'owner', 3)
  expect(resolveText(r, ['work'], '{.record.answer} {.record.sibling}').text).toBe('Supplied Keep')
  expect(executionInputs(r, ['work'])).toEqual([])
  const completed = await evaluateNode(['work'], { get: () => r, save: next => { r = next }, now: () => 4, executors: () => [], check: () => [] })
  expect(completed.status).toBe('committed')
})

test('a nested output may remain open during execution', async () => {
  let r = addTask(createReplica(), [], 'Work', 1, 'work'), type = primitive(r.store, 'string')
  const output = put(r.store, refNodeContent(r.store, { alias: { id: 'result' }, name: { content: 'Result' }, refRole: 'output' }, null, []))
  r = addRefAt(r, ['work'], 'record', put(r.store, { data: {}, children: [] }), 2, put(r.store, { data: {}, children: [[type, output]] }), 'record')
  const completed = await evaluateNode(['work'], { get: () => r, save: next => { r = next }, now: () => 3, executors: () => [], check: () => [] })
  expect(completed.status).toBe('committed')
  expect(compileRow(r, ['work']).right.holes.some(hole => hole.id === 'result')).toBe(true)
})

test('cached but forbidden values stay holes and are absent from compiled content', () => {
  let r = createReplica(), type = primitive(r.store, 'string'), secret = text(r, 'private body')
  r = addRefAt(r, [], 'secret', type, 1, secret, 'secret')
  const compiled = compileRefGraph(r, at(r, ['secret']), ['secret'], { canRead: (_store, cid) => cid !== secret })
  expect(compiled.complete).toBe(false)
  expect(compiled.holes[0]?.reason).toBe('denied')
  expect(resolveRefExpression(r, [], '.secret', { canRead: (_store, cid) => cid !== at(r, ['secret']) }).status).toBe('denied')
})

test('branches form sums, rows form products, and capability and handler assignments share checks', () => {
  let r = ['a', 'b', 'c'].reduce((r, name) => declareTestCapability(r, name), createReplica()), a = libAt(r.store).capabilities.a!, b = libAt(r.store).capabilities.b!
  const aHandler = put(r.store, refNodeContent(r.store, { alias: { id: 'handler-a' } }, a, []))
  const sum = putBranches(r.store, 'sum', null, [{ peerId: 'a', edge: [a, a] }, { peerId: 'b', edge: [b, b] }], 'a')
  expect(refValueCompatible(r.store, a, a)).toBe(true)
  expect(refValueCompatible(r.store, a, aHandler)).toBe(true)
  expect(refValueCompatible(r.store, a, b)).toBe(false)
  r = addRefAt(r, [], 'choice', sum, 1)
  for (const value of [aHandler, b]) {
    const proposal = proposeRefAt(r, ['choice'], value, 'owner', 2)
    r = applyProposalAt(proposal.replica, ['choice'], proposal.proposalCid, 'owner', 3)
  }
  expect(matchesRefPattern(r.store, sum, at(r, ['choice']))).toBe(true)
  expect(matchesRefPattern(r.store, a, at(r, ['choice']))).toBe(false)
  const compiled = compileRefGraph(r, at(r, ['choice']))
  expect(compiled.complete).toBe(true)
  const bad = proposeRefAt(r, ['choice'], libAt(r.store).capabilities.c!, 'owner', 4)
  expect(() => applyProposalAt(bad.replica, ['choice'], bad.proposalCid, 'owner', 5)).toThrow(/incompatible/)
})

test('Run requires a closed left side while the right can retain output holes', () => {
  let r = addTask(createReplica(), [], 'Run', 1, 'run'), type = primitive(r.store, 'string')
  const missing = put(r.store, refNodeContent(r.store, { alias: { id: 'instruction-input' }, name: { content: 'source' } }, null, []))
  const instruction = put(r.store, { data: {}, children: [[type, missing]] })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: node.children.map(edge => content(r.store, edge[1]).data.alias?.id === 'run' ? [instruction, edge[1]] : edge) })), 2)
  expect(compileRow(r, ['run']).canRun).toBe(false)
  r = addRefAt(r, ['run'], 'source', type, 3, text(r, 'Ready'), 'source')
  r = addRefAt(r, ['run'], 'result', type, 4, null, 'result')
  const compiled = compileRow(r, ['run'], { outputs: ['result'] })
  expect(compiled.canRun).toBe(true)
  expect(compiled.right.holes.some(hole => hole.id === 'result' && hole.role === 'output')).toBe(true)
})
