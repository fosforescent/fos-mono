import {
  refBranches, readChoice, branchEdge, selectBranch, createBranch, resolveBinding, addRefAt, addRow, addSupply, addTask, applyProposalAt, capabilityTarget, content,
  copyRowContent, createReplica, headCid, instantiateTemplate, mergeNodes, newId,
  proposeRefAt, put, refArguments, refNodeContent, refValueCid, resolveScope,
  valueContent, formTitle, view, serializeReplica, loadReplica, type Replica
} from './index'
import { PLAIN_TYPE, NOTE_TYPE, REF_TYPE, TEMPLATE_TYPE } from './library-types'
import { ALLOCATION_TYPE } from './library-types'

function node(r: Replica, path: string[]) { return content(r.store, resolveScope(r.store, headCid(r), path)!) }
function bind(r: Replica, path: string[], target: string, time: number) {
  const proposed = proposeRefAt(r, path, target, 'owner', time)
  return applyProposalAt(proposed.replica, path, proposed.proposalCid, 'owner', time)
}

test('typed arguments accept ref values without flattening; replay and stale proposals cannot change the binding', () => {
  let r = createReplica('owner')
  const type = capabilityTarget(r.store, 'tool')
  const value = put(r.store, { data: { description: { content: 'weather' } }, children: [] })
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'provider' } }, value, [], type))
  r = addRefAt(r, [], 'argument', type, 1)
  expect(refValueCid(r.store, node(r, ['argument']))).toBeNull()
  const first = proposeRefAt(r, ['argument'], handler, 'first', 2)
  const stale = proposeRefAt(first.replica, ['argument'], value, 'second', 3)
  r = applyProposalAt(stale.replica, ['argument'], first.proposalCid, 'owner', 4)
  expect(refValueCid(r.store, node(r, ['argument']))).toBe(handler)
  expect(refValueCid(r.store, content(r.store, handler))).toBe(value)
  r = loadReplica(JSON.parse(JSON.stringify(serializeReplica(r))))
  expect(refValueCid(r.store, node(r, ['argument']))).toBe(handler)
  r = applyProposalAt(r, ['argument'], stale.proposalCid, 'owner', 5)
  r = applyProposalAt(r, ['argument'], first.proposalCid, 'owner', 6)
  expect(refValueCid(r.store, node(r, ['argument']))).toBe(handler)
})

test('template instantiation shares deep copying, remaps internal refs and creates independent arguments', () => {
  let r = createReplica('owner')
  r = addRow(r, [], TEMPLATE_TYPE, 'Trip', 1, { id: 'template' })
  r = addTask(r, ['template'], 'Nested', 2, 'nested')
  r = addRow(r, ['template', 'nested'], NOTE_TYPE, 'Document', 3, { id: 'document' })
  r = addRow(r, ['template', 'nested'], REF_TYPE, 'Document ref', 4, { id: 'reference', refId: 'document' })
  r = addRow(r, ['template'], REF_TYPE, 'Root ref', 4, { id: 'root-reference', refId: 'template' })
  r = addRow(r, ['template', 'nested'], ALLOCATION_TYPE, 'weather', 5, { id: 'required', requirement: { capability: 'tool' } })
  r = addSupply(r, ['template', 'nested'], 'required', { capability: 'tool', by: 'old-run' }, 6)
  const type = capabilityTarget(r.store, 'tool')
  r = addRefAt(r, ['template', 'nested', 'required'], 'argument', type, 7)
  r = addTask(r, [], 'One', 8, 'one')
  r = addTask(r, [], 'Two', 9, 'two')
  r = instantiateTemplate(r, [], 'one', 'template', 10)
  r = instantiateTemplate(r, [], 'two', 'template', 11)
  const first = view(r, ['one'])!.tasks[0]!
  const second = view(r, ['two'])!.tasks[0]!
  expect(first.id).not.toBe(second.id)
  expect(view(r, ['one'])!.tasks[1]!.refId).toBe('one')
  const children = view(r, ['one', first.id])!.tasks
  const doc = children.find((t) => t.type === NOTE_TYPE)!
  expect(children.find((t) => t.refId !== undefined)!.refId).toBe(doc.id)
  const req = children.find((t) => !!t.requirement)!
  expect(req.requirement!.satisfied).toBe(false)
  const args = refArguments(r.store, node(r, ['one', first.id, req.id]), type)
  expect(args).toHaveLength(1)
  expect(args[0]!.id).not.toBe('argument')
  r = bind(r, ['one', first.id, req.id, args[0]!.id], put(r.store, { data: {}, children: [] }), 12)
  expect(refValueCid(r.store, node(r, ['template', 'nested', 'required', 'argument']))).toBeNull()
})

test('copying remaps internal typed-ref targets and retains external defaults', () => {
  let r = createReplica('owner')
  r = addTask(r, [], 'Parent', 1, 'parent')
  r = addRow(r, ['parent'], NOTE_TYPE, 'Document', 2, { id: 'document' })
  const type = capabilityTarget(r.store, 'tool')
  const document = resolveScope(r.store, headCid(r), ['parent', 'document'])!
  r = addRefAt(r, ['parent'], 'internal', type, 3, document)
  const external = put(r.store, refNodeContent(r.store, { alias: { id: 'external' } }, document, [], type))
  r = addRefAt(r, ['parent'], 'external-default', type, 4, external)
  const copied = copyRowContent(r.store, resolveScope(r.store, headCid(r), ['parent'])!, 5, newId)
  const args = refArguments(r.store, content(r.store, copied), type)
  expect(args[0]!.targetCid).not.toBe(document)
  expect(formTitle(r.store, valueContent(r.store, args[0]!.targetCid!))).toBe('Document')
  expect(args[1]!.targetCid).toBe(external)
})

test('concurrent different handler bindings become a choice instead of merging provider values', () => {
  const r = createReplica('owner'), store = r.store, type = capabilityTarget(store, 'tool')
  const slot = (target: string | null) => put(store, refNodeContent(store, { alias: { id: 'slot' } }, target, [], type))
  const parent = (cid: string) => put(store, { data: {}, children: [[type, cid]] })
  const a = put(store, { data: { peerId: { content: 'a' } }, children: [] })
  const b = put(store, { data: { description: { content: 'b' } }, children: [] })
  const result = mergeNodes(store, parent(slot(null)), parent(slot(a)), parent(slot(b)), { ours: 'a', theirs: 'b' })
  expect(result.newChoiceCids).toHaveLength(0)
  const ref = content(store, resolveScope(store, result.cid, ['slot'])!)
  const branches = refBranches(store, ref)!
  expect(readChoice(store, branches.cid).options.map(o => o.edge![0]).sort()).toEqual([a, b].sort())
  const reverse = mergeNodes(store, parent(slot(null)), parent(slot(b)), parent(slot(a)), { ours: 'b', theirs: 'a' })
  expect(refValueCid(store, content(store, resolveScope(store, reverse.cid, ['slot'])!))).toBe(branches.cid)
})


test('binding offers are tied to a version, including when a ref moves away and back to its old value', () => {
  let r = createReplica('owner')
  const type = capabilityTarget(r.store, 'tool')
  const a = put(r.store, { data: { description: { content: 'a' } }, children: [] })
  const b = put(r.store, { data: { description: { content: 'b' } }, children: [] })
  r = addRefAt(r, [], 'arg', type, 1, a)
  const old = proposeRefAt(r, ['arg'], b, 'old', 2)
  r = bind(old.replica, ['arg'], b, 3)
  r = bind(r, ['arg'], a, 4)
  r = applyProposalAt(r, ['arg'], old.proposalCid, 'owner', 5)
  expect(valueContent(r.store, resolveScope(r.store, headCid(r), ['arg'])!).data.description?.content).toBe('a')
})


test('distinct supplied values branch with shared incoming identity and content; duplicates reuse their branch', () => {
  let r = addRow(createReplica('owner'), [], PLAIN_TYPE, 'Project', 1, { id: 'project' })
  r = createBranch(r, ['project'], 'feature', 2)
  const type = capabilityTarget(r.store, 'tool')
  const a = put(r.store, { data: { description: { content: 'a' } }, children: [] })
  const b = put(r.store, { data: { description: { content: 'b' } }, children: [] })
  const path = ['project', 'arg']
  r = addRefAt(r, ['project'], 'arg', type, 3, a)
  r = bind(r, path, b, 4)
  let branches = refBranches(r.store, node(r, path))!
  expect(branches.names).toContain('feature')
  let options = readChoice(r.store, branches.cid).options
  expect(options.map(o => o.edge![0]).sort()).toEqual([a, b].sort())
  expect(new Set(options.map(o => o.edge![1])).size).toBe(1)
  expect(resolveBinding(r.store, type, refValueCid(r.store, node(r, path))).cid).toBe(b)
  selectBranch(r.store, branches.id, 'feature')
  expect(resolveBinding(r.store, type, refValueCid(r.store, node(r, path))).cid).toBe(a)
  r = bind(r, path, b, 5)
  branches = refBranches(r.store, node(r, path))!
  expect(branches.names).toHaveLength(2)
  expect(branchEdge(r.store, branches.cid)![0]).toBe(b)
  r = addRow(r, path, PLAIN_TYPE, 'Only in b', 6, { id: 'b-child' })
  expect(view(r, path)!.tasks.map(t => t.title)).toEqual(['Only in b'])
  selectBranch(r.store, branches.id, 'feature')
  expect(view(r, path)!.tasks).toHaveLength(0)
  selectBranch(r.store, branches.id, branches.selected)
  const copied = copyRowContent(r.store, resolveScope(r.store, headCid(r), path)!, 7, () => 'copied-arg')
  const copiedBranches = refBranches(r.store, content(r.store, copied))!
  expect(copiedBranches.id).toBe('copied-arg')
  expect([...copiedBranches.names].sort()).toEqual([...refBranches(r.store, node(r, path))!.names].sort())
  const restored = loadReplica(serializeReplica(r)); selectBranch(restored.store, 'project', 'feature')
  const resolved = resolveBinding(restored.store, type, refValueCid(restored.store, node(restored, path)))
  expect(content(restored.store, resolved.cid!).data.description?.content).toBe('b')
})
