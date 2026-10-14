/** Editable alternatives use the existing choice pointers and three-way merge. */
import { branchEdge, commitRoot, content, findAliasEdge, identityCid, isBranchChoice, putBranches, readChoice, resolveScope, selectBranch, updateAtScope, withIdentity, type Scope, type ChoiceOption } from './graph'
import { headCid, type Replica } from './replica'
import { mergeNodes } from './merge'

export function createBranch(r: Replica, at: Scope, name: string, now: number, baseName = 'main'): Replica {
  if (!name.trim() || name.length > 200) throw new Error('A branch name is required (at most 200 characters).')
  if (!at.length) throw new Error('Select a node to branch.')
  const id = at.at(-1)!, parent = at.slice(0, -1), store = r.store
  const next = updateAtScope(store, headCid(r), parent, value => {
    const found = findAliasEdge(store, value, id)
    if (!found) throw new Error('Node not found')
    const cid = identityCid(store, found.edge)
    const record = isBranchChoice(store, content(store, cid)) ? readChoice(store, cid) : null
    if (record?.options.some(o => o.peerId === name) || (!record && name === baseName)) throw new Error('That branch already exists.')
    const base = record?.base ?? found.edge
    const active = record ? branchEdge(store, cid)! : found.edge
    const options = record?.options ?? [{ peerId: baseName, edge: found.edge }]
    const choice = putBranches(store, id, base, [...options, { peerId: name, edge: active, base: active }], record?.defaultName ?? baseName)
    return { ...value, children: value.children.map((edge, i) => i === found.index ? [store.primitive.choiceTarget.getId(), choice] : edge) }
  })
  commitRoot(store, next, now)
  selectBranch(store, id, name)
  return { ...r }
}

export function mergeBranch(r: Replica, at: Scope, source: string, target: string, now: number, proposed?: ChoiceOption): Replica {
  const store = r.store, cid = resolveScope(store, headCid(r), at)
  if (!cid || !isBranchChoice(store, content(store, cid))) throw new Error('Select a branched node.')
  const record = readChoice(store, cid)
  const from = proposed?.edge ?? record.options.find(o => o.peerId === source)?.edge, to = record.options.find(o => o.peerId === target)?.edge
  if (!from || !to || source === target) throw new Error('Select different source and target branches.')
  const sourceBase = proposed?.base ?? record.options.find(o => o.peerId === source)?.base ?? record.base
  const merged = mergeNodes(store, sourceBase ? identityCid(store, sourceBase) : null, identityCid(store, to), identityCid(store, from), { ours: target, theirs: source })
  const nextChoice = putBranches(store, record.id, record.base, record.options.map(o => o.peerId === target ? { ...o, edge: withIdentity(store, to, merged.cid) } : o.peerId === source ? { ...o, base: from } : o), record.defaultName)
  const next = updateAtScope(store, headCid(r), at.slice(0, -1), value => ({ ...value, children: value.children.map(edge => identityCid(store, edge) === cid ? [store.primitive.choiceTarget.getId(), nextChoice] : edge) }))
  commitRoot(store, next, now)
  selectBranch(store, record.id, target)
  return { ...r }
}
