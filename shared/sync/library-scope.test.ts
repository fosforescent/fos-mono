import { FosStore } from '../dag-implementation/store'
import {
  addTask, addRefAt, addRow, compileRow, content, createReplica, commitRoot, headCid, libAt,
  libraryBindingAt, libraryInstanceEdge, libraryInstanceOf, libraryTypeAt, loadReplica, nativeRef,
  nestScope, publishNativeRef, primitiveExecutors, put, refNodeContent, resolveRefExpression,
  restoreNativeRef, rowTypeAt, serializeReplica, typeIdOf, updateAtScope, valueContent,
  capabilityName, triggerDefinitionOf, handlerOfferId, discoverHandlers, addRefCall, evaluationSteps, findTemplateByName, TEMPLATE_TYPE, type EvaluationStep
} from './index'
import { declareTestCapability } from './test-helpers'

test('lookup requires a declared library and never installs missing fields', () => {
  const store = new FosStore(), before = store.table.size
  expect(() => libAt(store)).toThrow('No library binding')
  expect(store.table.size).toBe(before)
  const r = createReplica()
  expect(() => libAt(r.store).capabilities.undeclared).toThrow('no capabilities.undeclared')
  expect(libraryTypeAt(r.store, 'undeclared')).toBeNull()
  const misleading = put(r.store, { data: { name: { content: 'fos:capability:timer' } }, children: [] })
  expect(capabilityName(r.store, misleading)).toBeNull()
  expect(triggerDefinitionOf(r.store, misleading)).toBeUndefined()
})

test('only ancestor declarations bind; a nested library shadows the whole namespace', () => {
  let r = addTask(createReplica(), [], 'Outer', 1, 'outer')
  r = addTask(r, [], 'Sibling', 1, 'sibling')
  r = declareTestCapability(r, 'custom', ['outer'])
  const custom = libAt(r.store, ['outer']).capabilities.custom!
  expect(typeIdOf(r.store, custom)).toBe('capabilities.custom')
  expect(() => libAt(r.store, ['sibling']).capabilities.custom).toThrow()
  expect(() => libAt(r.store).capabilities.custom).toThrow()
  const binding = libraryBindingAt(r.store, ['outer'])!
  const library = content(r.store, binding.library)
  const restricted = put(r.store, { ...library, children: library.children.filter(([, right]) => content(r.store, right).data.name?.content !== 'task') })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['outer'], node => ({ ...node, children: node.children.map(([left, right]) => [right === binding.cid ? restricted : left, right]) })), 2)
  expect(() => rowTypeAt(r.store, 'task', ['outer'])).toThrow()
  expect(rowTypeAt(r.store, 'task', ['sibling'])).toBe(libAt(r.store).field('task'))
  const loaded = loadReplica(serializeReplica(r))
  expect(typeIdOf(loaded.store, custom)).toBe('capabilities.custom')
  expect(libAt(loaded.store, ['outer']).capabilities.custom).toBe(custom)
})

test('two libraries in one scope are ambiguous, including identical definitions', () => {
  const r = createReplica(), library = libraryBindingAt(r.store)!.library
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: [...node.children, libraryInstanceEdge(r.store, library, undefined, 'another-lib')] })), 1)
  expect(() => libAt(r.store)).toThrow('Ambiguous library binding')
  expect(() => libraryInstanceOf(r.store, headCid(r))).toThrow('Ambiguous library binding')
})

test('nested stores resolve through their enclosing graph and recognize imported pinned fields', () => {
  let outer = addTask(createReplica(), [], 'Context', 1, 'context')
  outer = declareTestCapability(outer, 'paint', ['context'])
  const inner = createReplica('draft', new FosStore())
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: ['context'] })
  const type = libAt(inner.store).capabilities.paint!
  expect(type).toBe(libAt(outer.store, ['context']).capabilities.paint)
  expect(typeIdOf(inner.store, type)).toBe('capabilities.paint')
  expect(libraryInstanceOf(inner.store, headCid(inner))).toBeNull()
})

test('native restoration keeps the offered capability version after a library upgrade', () => {
  let r = declareTestCapability(createReplica('host'), 'paint')
  const effect = async () => {}, definition = { id: 'paint-native', type: (store: FosStore, at: string[]) => libAt(store, at).capabilities.paint!, effect }
  const ref = nativeRef(r.store, 'host', definition), original = libAt(r.store).capabilities.paint!
  r = publishNativeRef(r, [], 'host', ref, 1)
  r = addRow(r, [], ref, 'Paint', 2, { id: 'call' })
  r = declareTestCapability(r, 'paint', [], { description: { content: 'Revised definition' } })
  expect(libAt(r.store).capabilities.paint).not.toBe(original)
  expect(handlerOfferId('host', original, definition.id)).not.toBe(handlerOfferId('host', libAt(r.store).capabilities.paint!, definition.id))
  r = loadReplica(serializeReplica(r))
  restoreNativeRef(r, [], 'host', definition)
  const step = { path: ['call'], row: { typeCid: ref } } as EvaluationStep
  expect(primitiveExecutors(r, step).map(value => value.native.effect)).toEqual([effect])
  expect(discoverHandlers(r, []).find(offer => offer.cid === ref)?.type).toBe(original)
})

test('both sides of a row resolve from its parent; children see its declarations', () => {
  let r = createReplica(), text = r.store.primitive.documentField.getId()
  const literal = (value: string) => put(r.store, { data: { description: { content: value } }, children: [] })
  r = addRefAt(r, [], 'outer', text, 1, literal('parent'), 'chosen')
  const expression = put(r.store, { data: { refExpression: { up: 0, path: ['chosen'], lexical: true } }, children: [] })
  const local = put(r.store, refNodeContent(r.store, { alias: { id: 'inner' }, name: { content: 'chosen' } }, literal('local')))
  const right = put(r.store, { data: { alias: { id: 'row' }, refExpression: { up: 0, path: ['chosen'], lexical: true } }, children: [[text, local]] })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: [...node.children, [expression, right]] })), 2)
  const compiled = compileRow(r, ['row'])
  expect(content(r.store, compiled.left.cid).data.description?.content).toBe('parent')
  expect(content(r.store, compiled.right.cid).data.description?.content).toBe('parent')
  expect(resolveRefExpression(r, ['row'], 'chosen').locations[0]?.cid).toBe(local)
})

test('library fields are reachable through graph refs with no encoded node ids', () => {
  const r = createReplica()
  expect(resolveRefExpression(r, [], 'lib.task').locations[0]?.cid).toBe(libAt(r.store).field('task'))
  expect(resolveRefExpression(r, [], 'lib.capabilities.llm').locations[0]?.cid).toBe(libAt(r.store).capabilities.llm)
})

test('a row cannot execute through its own declarations, but its children can', () => {
  let r = createReplica('host')
  const definition = { id: 'local-effect', type: (store: FosStore) => libAt(store).capabilities.llm!, effect: async () => {} }
  const ref = nativeRef(r.store, 'host', definition)
  r = addRefCall(r, [], ref, 1, 'call')
  r = publishNativeRef(r, ['call'], 'host', ref, 2)
  r = addRefCall(r, ['call'], ref, 3, 'child')
  expect(primitiveExecutors(r, evaluationSteps(r, ['call'])[0]!, 'host')).toEqual([])
  expect(primitiveExecutors(r, evaluationSteps(r, ['call', 'child'])[0]!, 'host')).toHaveLength(1)
})

test('nested scopes cannot form a cycle', () => {
  const outer = createReplica(), inner = createReplica()
  nestScope(inner.store, { store: outer.store, root: headCid(outer), at: [] })
  expect(() => nestScope(outer.store, { store: inner.store, root: headCid(inner), at: [] })).toThrow('cannot enclose itself')
})

test('template name lookup cannot see a sibling subtree', () => {
  let r = addTask(createReplica(), [], 'Sibling', 1, 'sibling')
  r = addRow(r, ['sibling'], TEMPLATE_TYPE, 'Private workflow', 2, { id: 'workflow' })
  expect(findTemplateByName(r, 'Private workflow')).toBeNull()
  expect(findTemplateByName(r, 'Private workflow', ['sibling'])?.row.id).toBe('workflow')
})

test('duplicate fields cannot silently select the first declaration', () => {
  const r = createReplica(), binding = libraryBindingAt(r.store)!, library = content(r.store, binding.library)
  const task = library.children.find(([, right]) => content(r.store, right).data.name?.content === 'task')!
  const duplicate = put(r.store, { ...library, children: [...library.children, task] })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: node.children.map(([left, right]) => [right === binding.cid ? duplicate : left, right]) })), 1)
  expect(() => libAt(r.store).field('task')).toThrow('Ambiguous library field task')
})

test('shared row envelopes preserve named namespaces and their declarations', () => {
  const r = createReplica(), binding = libraryBindingAt(r.store)!, library = content(r.store, binding.library)
  const group = libAt(r.store).field('capabilities'), llm = libAt(r.store).capabilities.llm
  const envelope = put(r.store, refNodeContent(r.store, { alias: { id: 'shared-capabilities' } }, group))
  const projected = put(r.store, { ...library, children: library.children.map(([left, right]) => [left, right === group ? envelope : right]) })
  commitRoot(r.store, updateAtScope(r.store, headCid(r), [], node => ({ ...node, children: node.children.map(([left, right]) => [right === binding.cid ? projected : left, right]) })), 1)
  expect(libAt(r.store).capabilities.llm).toBe(llm)
  expect(resolveRefExpression(r, [], 'lib.capabilities.llm').locations[0]?.cid).toBe(llm)
})
