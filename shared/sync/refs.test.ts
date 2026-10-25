import { rowTitle, textValue, textOf } from './index'
import {
  refBranches, readChoice, branchEdge, selectBranch, createBranch, resolveBinding, addRefAt, addRow, addRequirement, supplyRequirement, addTask, applyProposalAt, libAt, content,
  copyRowContent, createReplica, headCid, instantiateTemplate, mergeNodes, newId,
  proposeRefAt, put, refArguments, refNodeContent, refValueCid, resolveScope,
  valueContent, view, serializeReplica, loadReplica, type Replica
} from './index'
import { PLAIN_TYPE, NOTE_TYPE, REF_TYPE, TEMPLATE_TYPE } from './library-types'

function node(r: Replica, path: string[]) { return content(r.store, resolveScope(r.store, headCid(r), path)!) }
function bind(r: Replica, path: string[], target: string, time: number) {
  const proposed = proposeRefAt(r, path, target, 'owner', time)
  return applyProposalAt(proposed.replica, path, proposed.proposalCid, 'owner', time)
}

test('typed arguments accept ref values without flattening; replay and stale proposals cannot change the binding', () => {
  let r = createReplica('owner')
  const type = put(r.store, { data: {}, children: [] })
  const value = textValue(r.store, 'weather')
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'provider' } }, value, []))
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

// template instantiation shares deep copying: tested the previous supply/attempt mechanism; the flow is to be rewritten end to end

test('copying remaps internal typed-ref targets and retains external defaults', () => {
  let r = createReplica('owner')
  r = addTask(r, [], 'Parent', 1, 'parent')
  r = addRow(r, ['parent'], NOTE_TYPE, 'Document', 2, { id: 'document' })
  const type = put(r.store, { data: {}, children: [] })
  const document = resolveScope(r.store, headCid(r), ['parent', 'document'])!
  r = addRefAt(r, ['parent'], 'internal', type, 3, document)
  const external = put(r.store, refNodeContent(r.store, { alias: { id: 'external' } }, document, []))
  r = addRefAt(r, ['parent'], 'external-default', type, 4, external)
  const copied = copyRowContent(r.store, resolveScope(r.store, headCid(r), ['parent'])!, 5, newId)
  const args = refArguments(r.store, content(r.store, copied), type)
  expect(args[0]!.targetCid).not.toBe(document)
  expect(rowTitle(r.store, args[0]!.targetCid!, null)).toBe('Document')
  expect(args[1]!.targetCid).toBe(external)
})

test('concurrent different handler bindings become a choice instead of merging provider values', () => {
  const r = createReplica('owner'), store = r.store, type = put(store, { data: {}, children: [] })
  const slot = (target: string | null) => put(store, refNodeContent(store, { alias: { id: 'slot' } }, target, []))
  const parent = (cid: string) => put(store, { data: {}, children: [[type, cid]] })
  const a = put(store, { data: { peerId: { content: 'a' } }, children: [] })
  const b = textValue(store, 'b')
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
  const type = put(r.store, { data: {}, children: [] })
  const a = textValue(r.store, 'a')
  const b = textValue(r.store, 'b')
  r = addRefAt(r, [], 'arg', type, 1, a)
  const old = proposeRefAt(r, ['arg'], b, 'old', 2)
  r = bind(old.replica, ['arg'], b, 3)
  r = bind(r, ['arg'], a, 4)
  r = applyProposalAt(r, ['arg'], old.proposalCid, 'owner', 5)
  expect(textOf(r.store, resolveScope(r.store, headCid(r), ['arg'])!)).toBe('a')
})


test('distinct supplied values branch with shared incoming identity and content; duplicates reuse their branch', () => {
  let r = addRow(createReplica('owner'), [], PLAIN_TYPE, 'Project', 1, { id: 'project' })
  r = createBranch(r, ['project'], 'feature', 2)
  const type = put(r.store, { data: {}, children: [] })
  const a = textValue(r.store, 'a')
  const b = textValue(r.store, 'b')
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
  expect(textOf(restored.store, resolved.cid!)).toBe('b')
})
