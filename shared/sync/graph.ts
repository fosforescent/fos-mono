/**
 * Graph helpers for sync, written against the hash-consed FosStore.
 *
 * Conventions used by the sync layer (all expressed with existing primitives):
 *
 *   task        edge [taskNode, COMPLETION]      taskNode.data: alias{id}, description, todo{completed,time}, updated
 *   node        edge [LIST, node]   (legacy)      a plain node without completion: data alias{id}, description; children like a task's. Older data only; the UI shows it as an uncheckable row
 *   peer        edge [PEER, peerRefNode]          peerRefNode.data: peerId{content}   (see membership.ts)
 *   choice      edge [CHOICE, choiceNode]         an unresolved divergence; replaces the task/partition edge it concerns
 *                 choiceNode.data: alias{id of the thing in conflict}, conflict{path}, option{defaultResolutionStrategy:'choice'}
 *                 children: [CONFLICTBASE, altNode] [NOTSELECTED, altNode] [NOTSELECTED, altNode] …
 *                 altNode.data: peerId{content} ; children: [INSTRUCTIONPOINTER, instr] [TARGETPOINTER, target]  (none = deleted)
 *   root        the store's root alias (TARGETPOINTER → content, PREV → previous root alias, MERGESOURCE → merged-in root)
 *
 * Identity across versions is `data.alias.id`, the same mechanism the root alias
 * uses. A node's cid changes with every edit; its alias id does not.
 */

import { FosStore } from '../dag-implementation/store'
import { isCurrentCid, verifyCid } from '../dag-implementation/cid'
import type { FosContextData, FosNodeContent, FosNodesData, FosPathElem } from '../types'

export type Scope = string[] // alias ids of nested nodes (tasks or legacy plain nodes), [] = the node a replica is attached to

export const SYNC_FORMAT_VERSION = 1 as const

// ---------------------------------------------------------------------------
// Basics

export function content(store: FosStore, cid: string): FosNodeContent {
  const value = store.table.get(cid)
  if (!value) throw new Error(`node ${cid.slice(0, 12)} not found`)
  return value
}

export function hasNode(store: FosStore, cid: string | null | undefined): cid is string {
  return !!cid && store.table.has(cid)
}

/** Insert content (validating its edges) and return its cid. */
export function put(store: FosStore, value: FosNodeContent): string {
  return store.create(value).getId()
}

export function aliasIdOf(value: FosNodeContent): string | null {
  return value.data.alias?.id ?? null
}

export function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Identity key of an edge inside its parent. The alias id of the target (partition,
 * choice) or of the instruction (task) when one exists; otherwise the edge itself,
 * which then behaves as an immutable set member.
 */
export function edgeKey(store: FosStore, edge: FosPathElem): string {
  const [instr, target] = edge
  // One proposal per (peer, branch name) on a node: replacing it is a modification, not a removal plus an addition.
  if (instr === store.primitive.proposalField.getId()) {
    const p = readProposal(store, target)
    if (p) return `p:${p.peerId}/${p.name}`
  }
  const targetAlias = aliasIdOf(content(store, target))
  if (targetAlias) return `a:${targetAlias}`
  const instrAlias = aliasIdOf(content(store, instr))
  if (instrAlias) return `a:${instrAlias}`
  return `e:${instr}:${target}`
}

export function isTaskEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[1] === store.primitive.completeField.getId() && !!content(store, edge[0]).data.todo
}

/** Legacy plain-node edge ([LIST, node]). New data only creates tasks; these still merge, zoom and move like any node. */
export function isPartitionEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.listField.getId()
}

export function isChoiceEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.choiceTarget.getId()
}

export function isPeerEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.peerField.getId()
}

/** The node that carries an edge's identity and data (task → instruction, otherwise target). */
export function identityCid(store: FosStore, edge: FosPathElem): string {
  return isTaskEdge(store, edge) ? edge[0] : edge[1]
}

/** Rebuild an edge around a new version of its identity node. */
export function withIdentity(store: FosStore, edge: FosPathElem, cid: string): FosPathElem {
  return isTaskEdge(store, edge) ? [cid, edge[1]] : [edge[0], cid]
}

/** Edges have the same "shape" when they differ only in their identity node. */
export function sameShape(store: FosStore, a: FosPathElem, b: FosPathElem): boolean {
  const aTask = isTaskEdge(store, a)
  const bTask = isTaskEdge(store, b)
  if (aTask !== bTask) return false
  return aTask ? a[1] === b[1] : a[0] === b[0]
}

// ---------------------------------------------------------------------------
// Content constructors

export function taskContent(id: string, title: string, done: boolean, createdAt: number, updatedAt: number): FosNodeContent {
  return {
    data: {
      alias: { id },
      description: { content: title },
      todo: { completed: done, time: createdAt },
      updated: { time: updatedAt }
    },
    children: []
  }
}

export function partitionContent(id: string, name: string, children: FosPathElem[] = []): FosNodeContent {
  return { data: { alias: { id }, description: { content: name } }, children }
}

export function peerRefContent(peerId: string): FosNodeContent {
  return { data: { peerId: { content: peerId } }, children: [] }
}

export function taskEdge(store: FosStore, taskCid: string): FosPathElem {
  return [taskCid, store.primitive.completeField.getId()]
}

export function partitionEdge(store: FosStore, partitionCid: string): FosPathElem {
  return [store.primitive.listField.getId(), partitionCid]
}

// ---------------------------------------------------------------------------
// Choice nodes

export type ChoiceOption = { peerId: string; edge: FosPathElem | null }

export type ChoiceRecord = {
  cid: string
  id: string
  base: FosPathElem | null
  options: ChoiceOption[]
}

function pointerContent(peerId: string | null, edge: FosPathElem | null, store: FosStore): FosNodeContent {
  const data = peerId ? { peerId: { content: peerId } } : {}
  const children: FosPathElem[] = edge
    ? [
        [store.primitive.instructionPointerConstructor.getId(), edge[0]],
        [store.primitive.targetPointerConstructor.getId(), edge[1]]
      ]
    : []
  return { data, children }
}

function readPointer(store: FosStore, cid: string): { peerId: string | null; edge: FosPathElem | null } {
  const value = content(store, cid)
  let instr: string | null = null
  let target: string | null = null
  for (const [i, t] of value.children) {
    if (i === store.primitive.instructionPointerConstructor.getId()) instr = t
    if (i === store.primitive.targetPointerConstructor.getId()) target = t
  }
  return {
    peerId: value.data.peerId?.content ?? null,
    edge: instr && target ? [instr, target] : null
  }
}

/** Build and insert a choice node; the alternatives are sorted so the cid is deterministic. */
export function putChoice(store: FosStore, id: string, base: FosPathElem | null, options: ChoiceOption[]): string {
  const alternatives = options
    .map((o) => ({ peerId: o.peerId, cid: put(store, pointerContent(o.peerId, o.edge, store)) }))
    .sort((a, b) => (a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0))
  const baseCid = put(store, pointerContent(null, base, store))
  const children: FosPathElem[] = [
    [store.primitive.conflictBaseNode.getId(), baseCid],
    ...alternatives.map((a): FosPathElem => [store.primitive.optionNotSelectedConstructor.getId(), a.cid])
  ]
  return put(store, {
    data: {
      alias: { id },
      conflict: { path: id },
      option: { selectedIndex: 0, defaultResolutionStrategy: 'choice' }
    },
    children
  })
}

export function readChoice(store: FosStore, choiceCid: string): ChoiceRecord {
  const value = content(store, choiceCid)
  let base: FosPathElem | null = null
  const options: ChoiceOption[] = []
  for (const [instr, target] of value.children) {
    if (instr === store.primitive.conflictBaseNode.getId()) {
      base = readPointer(store, target).edge
    } else if (instr === store.primitive.optionNotSelectedConstructor.getId()) {
      const pointer = readPointer(store, target)
      options.push({ peerId: pointer.peerId ?? 'unknown', edge: pointer.edge })
    }
  }
  return { cid: choiceCid, id: aliasIdOf(value) ?? choiceCid, base, options }
}

// ---------------------------------------------------------------------------
// Navigation and immutable updates

export function findEdge(store: FosStore, value: FosNodeContent, key: string): FosPathElem | undefined {
  return value.children.find((edge) => edgeKey(store, edge) === key)
}

/** Follow alias ids (tasks or legacy plain nodes) from `nodeCid`. Null if any step is missing. */
export function resolveScope(store: FosStore, nodeCid: string | null, scope: Scope): string | null {
  let current = nodeCid
  for (const step of scope) {
    if (!current) return null
    current = findChild(store, current, step)
  }
  return current
}

/** Replace, append or remove (`null`) the edge with `key`, keeping the others in order. */
export function replaceEdge(store: FosStore, value: FosNodeContent, key: string, edge: FosPathElem | null): FosNodeContent {
  let found = false
  const children: FosPathElem[] = []
  for (const existing of value.children) {
    if (edgeKey(store, existing) === key) {
      found = true
      if (edge) children.push(edge)
    } else {
      children.push(existing)
    }
  }
  if (!found && edge) children.push(edge)
  return { ...value, children }
}

/**
 * Path-copying update: apply `fn` to the node at `scope` under `nodeCid`;
 * returns the new cid of `nodeCid`. Every link node on the way to the change
 * gets a PREV edge to the version it replaces, so links keep their history.
 */
export function updateAtScope(store: FosStore, nodeCid: string, scope: Scope, fn: (value: FosNodeContent) => FosNodeContent): string {
  const value = content(store, nodeCid)
  const version = (next: FosNodeContent): string => {
    if (next === value) return nodeCid
    // A link gets a PREV edge only when its content changed, not for bookkeeping (members, proposals).
    const contentChanged = isLink(next) && putStripped(store, next) !== putStripped(store, value)
    return put(store, contentChanged ? withPrev(store, next, nodeCid) : next)
  }
  if (scope.length === 0) return version(fn(value))
  const [step, ...rest] = scope as [string, ...string[]]
  const found = findAliasEdge(store, value, step)
  if (!found || isChoiceEdge(store, found.edge)) throw new Error(`node ${step} not found`)
  const childCid = identityCid(store, found.edge)
  const nextChild = updateAtScope(store, childCid, rest, fn)
  if (nextChild === childCid) return nodeCid
  const children = [...value.children]
  children[found.index] = withIdentity(store, found.edge, nextChild)
  return version({ ...value, children })
}

/** Deliberately detach a device: drop its PEER edge (and its MEMBER entry, if any). */
export function withoutPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const children = value.children.filter((e) => {
    if (isPeerEdge(store, e) || isMemberEdge(store, e)) return content(store, e[1]).data.peerId?.content !== peerId
    return true
  })
  return children.length === value.children.length ? value : { ...value, children }
}

export function withPeer(store: FosStore, value: FosNodeContent, peerId: string): FosNodeContent {
  const refCid = put(store, peerRefContent(peerId))
  const edge: FosPathElem = [store.primitive.peerField.getId(), refCid]
  if (value.children.some(([i, t]) => i === edge[0] && t === edge[1])) return value
  return { ...value, children: [...value.children, edge] }
}

// ---------------------------------------------------------------------------
// Roots

/**
 * The content node the store's root points at. Roots created by `setRootNode`
 * and `commitRoot` are alias nodes (TARGETPOINTER → content); roots written by
 * the seed/registration are the content node itself. Both are supported.
 */
export function rootTargetCid(store: FosStore): string {
  const root = content(store, store.rootNodeId)
  const pointer = root.children.find(([i]) => i === store.primitive.targetPointerConstructor.getId())
  return pointer ? pointer[1] : store.rootNodeId
}

export function rootIsAlias(store: FosStore): boolean {
  return content(store, store.rootNodeId).children.some(([i]) => i === store.primitive.targetPointerConstructor.getId())
}

/**
 * Advance the root alias to a new target, keeping the alias id, linking PREV to
 * the previous root and optionally MERGESOURCE to a root that was merged in.
 */
export function commitRoot(store: FosStore, newTargetCid: string, now: number, mergeSourceCid: string | null = null): void {
  if (newTargetCid === rootTargetCid(store) && !mergeSourceCid) return
  const previous = content(store, store.rootNodeId)
  // A bare (non-alias) root is wrapped from here on: the alias keeps the history chain.
  const instruction = rootIsAlias(store)
    ? previous.children.find(([i]) => i === store.primitive.instructionPointerConstructor.getId())
    : undefined
  const children: FosPathElem[] = [
    [store.primitive.targetPointerConstructor.getId(), newTargetCid],
    [store.primitive.instructionPointerConstructor.getId(), instruction ? instruction[1] : store.primitive.rootInstructionNode.getId()],
    [store.primitive.previousVersion.getId(), store.rootNodeId]
  ]
  if (mergeSourceCid) children.push([store.primitive.mergeSourceNode.getId(), mergeSourceCid])
  const alias = previous.data.alias ?? { id: newId() }
  store.rootNodeId = put(store, { data: { alias, updated: { time: now } }, children })
  store.updateCtxCallback?.(store.exportContext([]))
}

// ---------------------------------------------------------------------------
// Serialization

/** All nodes reachable from `roots` (children edges), optionally skipping a known set. */
export function reachableNodes(store: FosStore, roots: Array<string | null>, skip: Set<string> = new Set()): FosNodesData {
  const out: FosNodesData = {}
  const stack = roots.filter((r): r is string => !!r && store.table.has(r))
  const seen = new Set<string>()
  while (stack.length) {
    const cid = stack.pop() as string
    if (seen.has(cid)) continue
    seen.add(cid)
    const value = content(store, cid)
    if (!skip.has(cid)) out[cid] = value
    for (const [i, t] of value.children) {
      if (!seen.has(i)) stack.push(i)
      if (!seen.has(t)) stack.push(t)
    }
  }
  return out
}

export function reachableSet(store: FosStore, roots: Array<string | null>): Set<string> {
  return new Set(Object.keys(reachableNodes(store, roots)))
}

/**
 * Add foreign nodes to the store. Only nodes in the current cid format whose
 * cid matches their content and whose edges resolve are accepted; the rest are
 * ignored. Returns accepted cids.
 */
export function importNodes(store: FosStore, nodes: FosNodesData): string[] {
  const accepted: string[] = []
  let pending = Object.entries(nodes).filter(([cid, value]) => {
    if (store.table.has(cid)) return false
    if (!value || typeof value !== 'object' || !Array.isArray(value.children)) return false
    return isCurrentCid(cid) && verifyCid(cid, value)
  })
  let progress = true
  while (pending.length && progress) {
    progress = false
    const rest: typeof pending = []
    for (const entry of pending) {
      const [cid, value] = entry
      if (value.children.every(([i, t]) => store.table.has(i) && store.table.has(t))) {
        store.table.set(cid, value)
        accepted.push(cid)
        progress = true
      } else {
        rest.push(entry)
      }
    }
    pending = rest
  }
  return accepted
}

export function exportReachableContext(store: FosStore, extraRoots: Array<string | null> = []): FosContextData {
  return {
    nodes: reachableNodes(store, [store.rootNodeId, ...extraRoots]),
    route: [],
    rootNodeId: store.rootNodeId
  }
}

// ---------------------------------------------------------------------------
// View model: what the UI sees (opaque ids, no cids)

export type TaskView = {
  id: string
  title: string
  /** False for a legacy plain node (no completion): rendered as a row without a checkbox. */
  checkable: boolean
  done: boolean
  createdAt: number
  updatedAt: number
  /** Direct subtasks and unresolved choices, for the tree. */
  childCount: number
  childChoices: number
  /** Whole subtree. */
  subtreeTasks: number
  subtreeDone: number
  isLink: boolean
}
export type ChoiceOptionView = { peerId: string; task: TaskView | null; label: string | null }
export type ChoiceView = {
  id: string
  subject: string
  base: TaskView | null
  baseLabel: string | null
  options: ChoiceOptionView[]
}
export type ProposalView = {
  id: string
  peerId: string
  name: string
  status: 'open' | 'rejected'
  timestamp: number
  /** Changes the proposal would make to this node's tasks, relative to its base. */
  summary: { added: string[]; changed: string[]; removed: string[] }
}

export type NodeView = {
  name: string | null
  done: boolean | null
  tasks: TaskView[]
  choices: ChoiceView[]
  peers: string[]
  isLink: boolean
  members: MemberRecord[]
  proposals: ProposalView[]
  /** Number of previous versions reachable through PREV (links only). */
  versions: number
}

export function taskView(store: FosStore, taskCid: string): TaskView {
  const value = content(store, taskCid)
  const created = value.data.todo?.time ?? 0
  const sub = countNode(store, taskCid)
  return {
    id: aliasIdOf(value) ?? taskCid,
    title: value.data.description?.content ?? '',
    checkable: true,
    done: !!value.data.todo?.completed,
    createdAt: created,
    updatedAt: value.data.updated?.time ?? created,
    childCount: value.children.filter((e) => isTaskEdge(store, e) || isPartitionEdge(store, e)).length,
    childChoices: value.children.filter((e) => isChoiceEdge(store, e)).length,
    subtreeTasks: sub.tasks,
    subtreeDone: sub.done,
    isLink: isLink(value)
  }
}

/** A legacy plain node as a tree row: like a task but not checkable. */
export function plainNodeView(store: FosStore, nodeCid: string): TaskView {
  const value = content(store, nodeCid)
  const sub = countNode(store, nodeCid)
  return {
    id: aliasIdOf(value) ?? nodeCid,
    title: value.data.description?.content ?? '',
    checkable: false,
    done: false,
    createdAt: value.data.updated?.time ?? 0,
    updatedAt: value.data.updated?.time ?? 0,
    childCount: value.children.filter((e) => isTaskEdge(store, e) || isPartitionEdge(store, e)).length,
    childChoices: value.children.filter((e) => isChoiceEdge(store, e)).length,
    subtreeTasks: sub.tasks,
    subtreeDone: sub.done,
    isLink: isLink(value)
  }
}

function describeEdge(store: FosStore, edge: FosPathElem | null): { task: TaskView | null; label: string | null } {
  if (!edge) return { task: null, label: null }
  if (isTaskEdge(store, edge)) return { task: taskView(store, edge[0]), label: null }
  const value = content(store, identityCid(store, edge))
  return { task: null, label: value.data.description?.content ?? value.data.alias?.id ?? 'node' }
}

export function choiceView(store: FosStore, choiceCid: string): ChoiceView {
  const record = readChoice(store, choiceCid)
  const base = describeEdge(store, record.base)
  const options = record.options.map((o) => ({ peerId: o.peerId, ...describeEdge(store, o.edge) }))
  const subject =
    base.task?.title ?? base.label ?? options.map((o) => o.task?.title ?? o.label).find((s) => !!s) ?? record.id
  return { id: record.id, subject, base: base.task, baseLabel: base.label, options }
}

export function countNode(store: FosStore, cid: string): { tasks: number; done: number; choices: number } {
  let tasks = 0
  let done = 0
  let choices = 0
  for (const edge of content(store, cid).children) {
    if (isTaskEdge(store, edge)) {
      tasks++
      if (content(store, edge[0]).data.todo?.completed) done++
      const sub = countNode(store, edge[0])
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    } else if (isChoiceEdge(store, edge)) {
      choices++
    } else if (isPartitionEdge(store, edge)) {
      const sub = countNode(store, edge[1])
      tasks += sub.tasks; done += sub.done; choices += sub.choices
    }
  }
  return { tasks, done, choices }
}

export function viewNode(store: FosStore, cid: string): NodeView {
  const value = content(store, cid)
  const link = isLink(value)
  const view: NodeView = {
    name: value.data.description?.content ?? null,
    done: value.data.todo ? !!value.data.todo.completed : null,
    tasks: [], choices: [], peers: [],
    isLink: link,
    members: link ? readMembers(store, value) : [],
    proposals: link ? readProposals(store, value).map((p) => proposalView(store, value, p)) : [],
    versions: link ? linkHistory(store, cid).length : 0
  }
  for (const edge of value.children) {
    if (isTaskEdge(store, edge)) {
      view.tasks.push(taskView(store, edge[0]))
    } else if (isChoiceEdge(store, edge)) {
      view.choices.push(choiceView(store, edge[1]))
    } else if (isPartitionEdge(store, edge)) {
      view.tasks.push(plainNodeView(store, edge[1])) // legacy plain node: a row in the same list, in edge order
    } else if (isPeerEdge(store, edge)) {
      const peerId = content(store, edge[1]).data.peerId?.content
      if (peerId) view.peers.push(peerId)
    }
  }
  // Order is the edge order (part of the node's identity since cid v2); no sorting.
  return view
}

/** Where a peer is attached: the scope of the first node (depth-first) carrying a [PEER, ref] edge for `peerId`. */
export function findPeerScope(store: FosStore, nodeCid: string, peerId: string, prefix: Scope = []): Scope | null {
  const value = content(store, nodeCid)
  for (const edge of value.children) {
    if (isPeerEdge(store, edge) && content(store, edge[1]).data.peerId?.content === peerId) return prefix
  }
  for (const edge of value.children) {
    if (!isPartitionEdge(store, edge) && !isTaskEdge(store, edge)) continue
    const childCid = identityCid(store, edge)
    const id = aliasIdOf(content(store, childCid))
    if (!id) continue
    const found = findPeerScope(store, childCid, peerId, [...prefix, id])
    if (found) return found
  }
  return null
}

/** Node names along a scope, for labels. */
export function scopeNames(store: FosStore, nodeCid: string | null, scope: Scope): string[] {
  const names: string[] = []
  let current = nodeCid
  for (const step of scope) {
    if (!current) { names.push(step); continue }
    const next = findChild(store, current, step)
    names.push(next ? content(store, next).data.description?.content ?? step : step)
    current = next
  }
  return names
}

// ---------------------------------------------------------------------------
// Link nodes: history, members and proposals
//
//   link node  data.link = { createdAt }; edges:
//     [PREV, previousVersionCid]       one per parent version (two after a merge)
//     [MEMBER, memberRef]              memberRef.data: peerId{content}, actor{capabilities}
//     [PROPOSAL, proposalNode]         a peer's branch (proposal.ts shape):
//        [PROPOSALNAME, nameNode] [PROPOSEDCONTENT, contentCid] [SENDER, peerIdNode]
//        [TIMESTAMP, timeNode] [PREV, baseCid]
//
// The node's *content* is everything except these bookkeeping edges; proposals
// hold stripped content so they can be three-way merged against the main
// content with the proposal's PREV as the base.

export type Capability = 'edit' | 'approve'

export function isLink(value: FosNodeContent): boolean {
  return !!value.data.link
}

export function isPrevEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.previousVersion.getId()
}

export function isMemberEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.memberField.getId()
}

export function isProposalEdge(store: FosStore, edge: FosPathElem): boolean {
  return edge[0] === store.primitive.proposalField.getId()
}

/** Edges that describe who/what is attached to a link node rather than its content. */
export function isBookkeepingEdge(store: FosStore, edge: FosPathElem): boolean {
  return isPrevEdge(store, edge) || isMemberEdge(store, edge) || isProposalEdge(store, edge) || isPeerEdge(store, edge)
}

/** The node's content without history/member/proposal edges (and without the link marker). */
export function stripLink(store: FosStore, value: FosNodeContent): FosNodeContent {
  const { link: _link, ...data } = value.data
  return { data, children: value.children.filter((e) => !isBookkeepingEdge(store, e)) }
}

/** Put a stripped content node and return its cid. */
export function putStripped(store: FosStore, value: FosNodeContent): string {
  return put(store, stripLink(store, value))
}

/** Turn a node into a link node (idempotent). */
export function makeLink(value: FosNodeContent, now: number): FosNodeContent {
  if (isLink(value)) return value
  return { ...value, data: { ...value.data, link: { createdAt: now } } }
}

/** New version of a link node: `next` content plus a PREV edge to the version it replaces. */
export function withPrev(store: FosStore, next: FosNodeContent, previousCid: string): FosNodeContent {
  const prevEdge: FosPathElem = [store.primitive.previousVersion.getId(), previousCid]
  const children = next.children.filter((e) => !isPrevEdge(store, e))
  return { ...next, children: [...children, prevEdge] }
}

/** Previous versions of a link node, newest first (follows the first PREV at each step). */
export function linkHistory(store: FosStore, cid: string, limit = 50): string[] {
  const out: string[] = []
  let current: string | null = cid
  while (current && out.length < limit) {
    const prev: FosPathElem | undefined = content(store, current).children.find((e) => isPrevEdge(store, e))
    current = prev ? prev[1] : null
    if (current && store.table.has(current)) out.push(current)
    else break
  }
  return out
}

export type MemberRecord = { peerId: string; name: string | null; capabilities: Capability[] }

/**
 * Capabilities are graph vocabulary, not data: a member reference carries one
 * [CAPABILITY, <action constructor>] edge per capability, as the language
 * design does for actors. 'edit' → PROPOSE (may propose changes), 'approve' → APPROVE.
 */
export function capabilityTarget(store: FosStore, capability: Capability): string {
  return capability === 'approve' ? store.primitive.approveAction.getId() : store.primitive.proposeAction.getId()
}

export function capabilityOf(store: FosStore, edge: FosPathElem): Capability | null {
  if (edge[0] !== store.primitive.capabilityNode.getId()) return null
  if (edge[1] === store.primitive.approveAction.getId()) return 'approve'
  if (edge[1] === store.primitive.proposeAction.getId()) return 'edit'
  return null
}

export function memberRefContent(store: FosStore, peerId: string, name: string | null, capabilities: Capability[]): FosNodeContent {
  const unique = [...new Set(capabilities)]
  return {
    data: {
      peerId: { content: peerId },
      ...(name ? { name: { content: name } } : {})
    },
    children: unique.map((c): FosPathElem => [store.primitive.capabilityNode.getId(), capabilityTarget(store, c)])
  }
}

export function readMembers(store: FosStore, value: FosNodeContent): MemberRecord[] {
  const out: MemberRecord[] = []
  for (const edge of value.children) {
    if (!isMemberEdge(store, edge)) continue
    const ref = content(store, edge[1])
    const peerId = ref.data.peerId?.content
    if (!peerId) continue
    const caps = ref.children.map((e) => capabilityOf(store, e)).filter((c): c is Capability => c !== null)
    out.push({ peerId, name: ref.data.name?.content ?? null, capabilities: caps })
  }
  return out
}

/** Add or replace the member entry for `peerId`. */
export function withMember(store: FosStore, value: FosNodeContent, peerId: string, name: string | null, capabilities: Capability[]): FosNodeContent {
  const refCid = put(store, memberRefContent(store, peerId, name, capabilities))
  const children = value.children.filter((e) => !(isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId))
  return { ...value, children: [...children, [store.primitive.memberField.getId(), refCid]] }
}

export function hasCapability(store: FosStore, value: FosNodeContent, peerId: string, capability: Capability): boolean {
  return readMembers(store, value).some((m) => m.peerId === peerId && m.capabilities.includes(capability))
}

export type ProposalRecord = {
  cid: string
  peerId: string
  name: string
  status: 'open' | 'rejected'
  /** Stripped content proposed for this node. */
  contentCid: string
  /** Stripped main content the proposal was last rebased onto. */
  baseCid: string
  timestamp: number
}

function textNode(store: FosStore, text: string): string {
  return put(store, { data: { description: { content: text } }, children: [] })
}

export function proposalContent(store: FosStore, peerId: string, name: string, contentCid: string, baseCid: string, timestamp: number, status: 'open' | 'rejected' = 'open'): FosNodeContent {
  return {
    data: { proposal: { status } },
    children: [
      [store.primitive.proposalNameField.getId(), textNode(store, name)],
      [store.primitive.proposedContentField.getId(), contentCid],
      [store.primitive.senderField.getId(), textNode(store, peerId)],
      [store.primitive.timestampField.getId(), textNode(store, String(timestamp))],
      [store.primitive.previousVersion.getId(), baseCid]
    ]
  }
}

export function readProposal(store: FosStore, cid: string): ProposalRecord | null {
  const value = content(store, cid)
  let peerId = ''
  let name = ''
  let contentCid = ''
  let baseCid = ''
  let timestamp = 0
  for (const [instr, target] of value.children) {
    if (instr === store.primitive.proposalNameField.getId()) name = content(store, target).data.description?.content ?? ''
    else if (instr === store.primitive.proposedContentField.getId()) contentCid = target
    else if (instr === store.primitive.senderField.getId()) peerId = content(store, target).data.description?.content ?? ''
    else if (instr === store.primitive.timestampField.getId()) timestamp = Number(content(store, target).data.description?.content ?? 0) || 0
    else if (instr === store.primitive.previousVersion.getId()) baseCid = target
  }
  if (!peerId || !contentCid || !baseCid) return null
  return { cid, peerId, name, status: value.data.proposal?.status === 'rejected' ? 'rejected' : 'open', contentCid, baseCid, timestamp }
}

/** Mark a proposal rejected (kept on the node so the peer learns about it and it does not reopen by itself). */
export function markProposalRejected(store: FosStore, value: FosNodeContent, proposalCid: string): FosNodeContent {
  const record = readProposal(store, proposalCid)
  if (!record || record.status === 'rejected') return value
  const rejectedCid = put(store, proposalContent(store, record.peerId, record.name, record.contentCid, record.baseCid, record.timestamp, 'rejected'))
  return withProposal(store, value, record.peerId, rejectedCid, record.name)
}

export function readProposals(store: FosStore, value: FosNodeContent): ProposalRecord[] {
  const out: ProposalRecord[] = []
  for (const edge of value.children) {
    if (!isProposalEdge(store, edge)) continue
    const record = readProposal(store, edge[1])
    if (record) out.push(record)
  }
  return out
}

/** Replace (or add) the proposal from `peerId` named `name`, or remove it when `proposalCid` is null. */
export function withProposal(store: FosStore, value: FosNodeContent, peerId: string, proposalCid: string | null, name?: string): FosNodeContent {
  const matches = (cid: string) => {
    const p = readProposal(store, cid)
    return !!p && p.peerId === peerId && (name === undefined || p.name === name)
  }
  const children = value.children.filter((e) => !(isProposalEdge(store, e) && matches(e[1])))
  if (proposalCid) children.push([store.primitive.proposalField.getId(), proposalCid])
  return { ...value, children }
}

export function removeProposalByCid(store: FosStore, value: FosNodeContent, proposalCid: string): FosNodeContent {
  return { ...value, children: value.children.filter((e) => !(isProposalEdge(store, e) && e[1] === proposalCid)) }
}

/** Rebuild a link node from new stripped content, keeping bookkeeping edges and adding PREV → previous version. */
export function relinkContent(store: FosStore, previous: FosNodeContent, previousCid: string, strippedContent: FosNodeContent, now: number): FosNodeContent {
  const bookkeeping = previous.children.filter((e) => isBookkeepingEdge(store, e) && !isPrevEdge(store, e))
  const next: FosNodeContent = {
    data: { ...strippedContent.data, link: previous.data.link ?? { createdAt: now }, updated: { time: now } },
    children: [...strippedContent.children, ...bookkeeping]
  }
  return withPrev(store, next, previousCid)
}

// ---------------------------------------------------------------------------
// Tree operations (tasks can contain tasks)

/** Child edge (task, partition or choice) carrying `aliasId`, with its index. */
export function findAliasEdge(store: FosStore, value: FosNodeContent, aliasId: string): { edge: FosPathElem; index: number } | null {
  const key = `a:${aliasId}`
  const index = value.children.findIndex((e) => edgeKey(store, e) === key)
  return index >= 0 ? { edge: value.children[index] as FosPathElem, index } : null
}

/** Cid of the node that `aliasId` names below `nodeCid` (task or partition), or null. */
export function findChild(store: FosStore, nodeCid: string, aliasId: string): string | null {
  const found = findAliasEdge(store, content(store, nodeCid), aliasId)
  if (!found) return null
  const { edge } = found
  if (isChoiceEdge(store, edge)) return null
  return identityCid(store, edge)
}

export type MovePosition = { relativeTo: string; position: 'above' | 'below' } | { into: string; index?: number }

/**
 * Move the child `aliasId` of the node at `fromPath` to `toPath` at `position`
 * (relative to a sibling, or into a node). Paths are relative to `rootCid`.
 * Returns the new root cid, or null if the move is invalid (e.g. into itself).
 */
export function moveChild(store: FosStore, rootCid: string, fromPath: Scope, aliasId: string, toPath: Scope, position: MovePosition): string | null {
  if (toPath.includes(aliasId)) return null // cannot move a node into its own subtree
  const fromCid = resolveScope(store, rootCid, fromPath)
  if (!fromCid) return null
  const found = findAliasEdge(store, content(store, fromCid), aliasId)
  if (!found) return null
  const moving = found.edge

  // 1. remove from the source
  let root = updateAtScope(store, rootCid, fromPath, (value) => ({ ...value, children: value.children.filter((e) => e !== moving) }))

  // 2. insert at the destination (resolved after the removal, paths are by alias id so they still hold)
  const insert = (value: FosNodeContent): FosNodeContent => {
    const children = [...value.children]
    if ('into' in position) {
      const parent = findAliasEdge(store, value, position.into)
      if (!parent) throw new Error('destination not found')
      const target = identityCid(store, parent.edge)
      const targetContent = content(store, target)
      const kids = [...targetContent.children]
      const at = position.index === undefined || position.index < 0 ? kids.length : Math.min(position.index, kids.length)
      kids.splice(at, 0, moving)
      const newTarget = put(store, { ...targetContent, children: kids })
      children[parent.index] = withIdentity(store, parent.edge, newTarget)
      return { ...value, children }
    }
    const sibling = findAliasEdge(store, value, position.relativeTo)
    if (!sibling) throw new Error('destination not found')
    children.splice(position.position === 'above' ? sibling.index : sibling.index + 1, 0, moving)
    return { ...value, children }
  }
  root = updateAtScope(store, root, toPath, insert)
  return root
}

/** Task titles a proposal adds, changes or removes compared with the main content it was based on (so work landing on main later never shows up as 'removed'). */
export function proposalView(store: FosStore, nodeValue: FosNodeContent, proposal: ProposalRecord): ProposalView {
  const current = store.getNodeByAddress(proposal.baseCid) ? content(store, proposal.baseCid) : stripLink(store, nodeValue)
  const proposed = content(store, proposal.contentCid)
  const index = (value: FosNodeContent) => {
    const map = new Map<string, { title: string; cid: string }>()
    for (const edge of value.children) {
      if (!isTaskEdge(store, edge)) continue
      map.set(edgeKey(store, edge), { title: content(store, edge[0]).data.description?.content ?? '', cid: edge[0] })
    }
    return map
  }
  const a = index(current)
  const b = index(proposed)
  const summary = { added: [] as string[], changed: [] as string[], removed: [] as string[] }
  for (const [key, entry] of b) {
    const before = a.get(key)
    if (!before) summary.added.push(entry.title)
    else if (before.cid !== entry.cid) summary.changed.push(entry.title)
  }
  for (const [key, entry] of a) if (!b.has(key)) summary.removed.push(entry.title)
  return { id: proposal.cid, peerId: proposal.peerId, name: proposal.name, status: proposal.status, timestamp: proposal.timestamp, summary }
}
