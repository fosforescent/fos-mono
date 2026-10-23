/**
 * Entry point of the sync core when embedded in the desktop binary (QuickJS).
 * Everything crosses the Rust↔JS boundary as JSON strings; replicas live in
 * this module keyed by a handle. See desktop/src-tauri/src/core.rs.
 */

import {
  addRef,
  addRow,
  addTask,
  copyNode,
  setRowType,
  COMMENT_TYPE,
  NOTE_TYPE,
  applyProposalAt,
  shareHome,
  ensureHomeContext,
  homePath,
  HOME_ID,
  createReplica,
  linkLocalStore,
  localStores,
  deleteTask,
  headCid,
  isDirty,
  loadReplica,
  moveNode,
  reattach,
  rejectProposalAt,
  renameTask,
  resolve,
  serializeReplica,
  setTaskDone,
  view,
  type MovePosition,
  type Replica,
  type Scope
} from './index'
import { acceptSubmission } from './approvals'
import { sharedAddressAt } from './sharing'
import { dispatchEvent, type FosEvent } from './events'
import { readNodeValue } from './evaluation'
import { membershipPathAt } from './replica'
import { LIBRARY_VERSION, ensureDeviceLibrary, exportLocalLibrary } from './library'
import { capabilityTarget, libraryInstanceOf, libraryRowOf, content, importNodes, put, resolveScope, valueContent, valueCidOf } from './graph'
import { nativeRef, publishNativeRef } from './native-refs'
import { discoverHandlers } from './handlers'
import { writeGraphNode, nativeDefaultsApplied, markNativeDefaultsApplied } from './replica'
import type { FosNodeContent, FosNodesData } from '../types'
import { accountContextAbove, exchangeNode, nodeTreeSync } from './node-sync'
import { addRelayAck, relayInbox, relayQueues } from './relay'
import type { ProvidedNode } from './node-provider'
import { handleMcp } from './mcp-adapter'

const replicas = new Map<string, Replica>()
/** Handles opened as the home store (`~/.fos`): only those keep their rows in Home. */
const homes = new Set<string>()

function get(handle: string): Replica {
  const r = replicas.get(handle)
  if (!r) throw new Error(`no replica ${handle}`)
  return r
}

function set(handle: string, r: Replica): void {
  replicas.set(handle, r)
}

const parse = <T>(json: string | null | undefined, fallback: T): T => (json ? (JSON.parse(json) as T) : fallback)

/** A node sync in progress under a handle (`nodeSyncBegin`/`nodeSyncStep`), and the clock its steps run at. */
const runs = new Map<string, { run: ReturnType<typeof nodeTreeSync>; now: number }>()

export const api = {
  /**
   * Load a `.fos` store's replica (or start a fresh one) under `handle`, forcing the device id. Every store is a device
   * root with a bundled library outside Home. A library appears inside Home only when explicitly linked.
   * Only the home store (`~/.fos`) has Home, the node it syncs with the account.
   */
  open(handle: string, serialized: string | null, peerId: string, home = true): void {
    let loaded = serialized ? loadReplica(JSON.parse(serialized)) : createReplica(peerId)
    loaded = ensureDeviceLibrary(loaded, undefined, Date.now())
    const seeded = nativeDefaultsApplied(loaded, [], `desktop:${peerId}`)
    for (const name of ['provideNode', 'sync']) {
      const ref = nativeRef(loaded.store, peerId, { id: `desktop:${name}`, label: name, type: store => capabilityTarget(store, name) })
      if (!seeded) loaded = publishNativeRef(loaded, [], peerId, ref, 0)
    }
    loaded = markNativeDefaultsApplied(loaded, [], `desktop:${peerId}`, 0)
    if (home) loaded = ensureHomeContext(loaded, Date.now())
    set(handle, { store: loaded.store, meta: { ...loaded.meta, peerId } })
    if (home) homes.add(handle); else homes.delete(handle)
  },
  /** Where this replica's own rows are: Home in the home store, else its root. */
  homePath(handle: string): string { return JSON.stringify(homePath(get(handle))) },
  /**
   * Link the store `peerId` (named `name`) on this machine as a peer of `handle`'s root (`home`: it is Home's store, so
   * what it shares is its Home); returns whether it changed.
   */
  linkStore(handle: string, peerId: string, name: string, home: boolean, now: number): boolean {
    const before = get(handle), after = linkLocalStore(before, peerId, name, now, home ? homePath(before) : [])
    set(handle, after)
    return after !== before
  },
  /** The stores `handle` is linked with on this machine: [{ peerId, name }]. */
  localStores(handle: string): string { return JSON.stringify(localStores(get(handle))) },
  /** The path of `peer`'s membership row at the node `atJson`, or null. */
  membershipPath(handle: string, atJson: string, peer: string): string { return JSON.stringify(membershipPathAt(get(handle), parse<Scope>(atJson, []), peer)) },
  /**
   * The tree of the linked store loaded under `peerHandle`, as `peerId` (this store) may see it: pulled node by node
   * through node exchange (what its grants allow), never by reading its graph directly. Text lines like `tree`.
   */
  browseStore(peerHandle: string, peerId: string, now: number): string {
    let peer = get(peerHandle)
    const view = createReplica(peerId)
    const run = nodeTreeSync(view, { peer: peer.meta.peerId, scope: [], remoteRoot: [], localRoot: [], branches: [], push: false }, () => now)
    let step = run.next()
    while (!step.done) {
      const capabilities = discoverHandlers(peer, []).filter(offer => offer.peerId === peer.meta.peerId && offer.enabled).flatMap(offer => offer.capability ? [offer.capability] : [])
      const served = exchangeNode(peer, step.value.request, { peerId, scope: [], capabilities }, now)
      peer = served.replica
      step = run.next(served.node)
    }
    set('browse', step.value.replica)
    const lines = JSON.parse(api.tree('browse', '[]')) as string[]
    replicas.delete('browse')
    return JSON.stringify(lines)
  },
  close(handle: string): void { replicas.delete(handle); homes.delete(handle) },
  serialize(handle: string): string { return JSON.stringify(serializeReplica(get(handle))) },
  meta(handle: string): string {
    const r = get(handle)
    return JSON.stringify({ ...r.meta, headCid: headCid(r), dirty: isDirty(r) })
  },
  setScope(handle: string, scopeJson: string, namesJson: string): void {
    const r = get(handle)
    const requested = parse<Scope>(scopeJson, [])
    const home = requested.length === 1 && homePath(r).length && requested[0] === homePath(r)[0]
    set(handle, shareHome({ store: r.store, meta: { ...r.meta, localScope: undefined, scope: home ? [] : requested, scopeNames: home ? [] : parse<string[]>(namesJson, []) } }))
  },
  view(handle: string, atJson: string): string { return JSON.stringify(view(get(handle), parse<Scope>(atJson, []))) },
  /** Add a row of the library row type `type` (`lib.task`, `lib.plain`, `lib.note`, …) under `at`; returns its view. */
  addRow(handle: string, atJson: string, type: string, text: string, now: number, optionsJson: string | null): string {
    const r = get(handle)
    const at = parse<Scope>(atJson, [])
    const options = parse<{ done?: boolean; refId?: string; id?: string }>(optionsJson, {})
    const id = options.id ?? crypto.randomUUID()
    set(handle, addRow(r, at, type, text, now, { ...options, id }))
    const added = view(get(handle), at)?.tasks.find((t) => t.id === id) ?? null
    return JSON.stringify(added)
  },
  setRowType(handle: string, atJson: string, id: string, type: string, now: number): void { set(handle, setRowType(get(handle), parse<Scope>(atJson, []), id, type, now)) },
  addRef(handle: string, atJson: string, targetId: string, now: number): void { set(handle, addRef(get(handle), parse<Scope>(atJson, []), targetId, now)) },
  copyNode(handle: string, fromJson: string, id: string, toJson: string, positionJson: string, now: number): void {
    set(handle, copyNode(get(handle), parse<Scope>(fromJson, []), id, parse<Scope>(toJson, []), parse<MovePosition>(positionJson, { into: '' }), now))
  },
  /** Text lines of the tree below `at` (for the CLI/REPL), with short ids. */
  tree(handle: string, atJson: string): string {
    const r = get(handle)
    const lines: string[] = []
    const library = [libraryRowOf(r.store, headCid(r))?.id, libraryInstanceOf(r.store, headCid(r))?.id]
    const walk = (at: Scope, depth: number) => {
      const node = view(r, at)
      if (!node) return
      for (const t of node.tasks) {
        if (!at.length && library.includes(t.id)) continue // the library the store ships and its instance (not its own rows)
        lines.push(`${'  '.repeat(depth)}${t.checkable ? (t.done ? '[x]' : '[ ]') : t.type === NOTE_TYPE ? ' ≡ ' : t.type === COMMENT_TYPE ? ' " ' : t.refId !== undefined ? ' → ' : ' · '} ${t.id.includes(':') ? t.id : t.id.slice(0, 8)} ${t.refPeer ? `${t.title} (held by ${t.refPeer.slice(0, 8)})` : t.refId !== undefined ? `ref ${t.refId.slice(0, 8)}` : t.title.split('\n')[0]}${t.childCount ? ` (${t.subtreeDone}/${t.subtreeTasks})` : ''}${t.isLink ? ' ⛓' : ''}`)
        if (t.childCount) walk([...at, t.id], depth + 1)
      }
      for (const c of node.choices) lines.push(`${'  '.repeat(depth)}[?] ${c.id.slice(0, 8)} ${c.subject} (conflict, ${c.options.length} versions)`)
      for (const p of node.proposals) lines.push(`${'  '.repeat(depth)}[>] ${p.id.slice(0, 8)} proposal "${p.name}" by ${p.peerId.slice(0, 8)} (${p.status}) +${p.summary.added.length} ~${p.summary.changed.length} -${p.summary.removed.length}`)
    }
    walk(parse<Scope>(atJson, []), 0)
    return JSON.stringify(lines)
  },
  /** Locate a task by id prefix anywhere below `at`: { id, at } or null. */
  findTask(handle: string, atJson: string, prefix: string): string {
    const r = get(handle)
    const search = (at: Scope): { id: string; at: Scope } | null => {
      const node = view(r, at)
      if (!node) return null
      const direct = node.tasks.find((t) => t.id.startsWith(prefix))
      if (direct) return { id: direct.id, at }
      for (const t of node.tasks) { const f = search([...at, t.id]); if (f) return f }
      return null
    }
    return JSON.stringify(search(parse<Scope>(atJson, [])))
  },

  addTask(handle: string, atJson: string, title: string, now: number): string {
    const next = addTask(get(handle), parse<Scope>(atJson, []), title, now)
    set(handle, next)
    const node = view(next, parse<Scope>(atJson, []))
    return JSON.stringify(node?.tasks.at(-1) ?? null)
  },
  setTaskDone(handle: string, atJson: string, id: string, done: boolean, now: number): void { set(handle, setTaskDone(get(handle), parse<Scope>(atJson, []), id, done, now)) },
  renameTask(handle: string, atJson: string, id: string, title: string, now: number): void { set(handle, renameTask(get(handle), parse<Scope>(atJson, []), id, title, now)) },
  deleteTask(handle: string, atJson: string, id: string, now: number): void { set(handle, deleteTask(get(handle), parse<Scope>(atJson, []), id, now)) },
  /** What relays delivered to this store's peer: the unacknowledged messages in its queues (`relayQueues`), with the titles of their rows. */
  relayInbox(handle: string): string {
    const r = get(handle)
    return JSON.stringify(relayQueues(r, r.meta.peerId).flatMap(queue => relayInbox(r, queue).map(m => ({ id: m.id, to: m.to, queue, rows: m.rows.map(row => row.title) }))))
  },
  /** Acknowledge a delivered message: an ack row in its queue, which the relay clears after the next sync. */
  relayAck(handle: string, queueJson: string, messageId: string, now: number): void { set(handle, addRelayAck(get(handle), parse<Scope>(queueJson, []), messageId, now)) },
  moveNode(handle: string, fromJson: string, id: string, toJson: string, positionJson: string, now: number): void {
    set(handle, moveNode(get(handle), parse<Scope>(fromJson, []), id, parse<Scope>(toJson, []), JSON.parse(positionJson), now))
  },
  resolveChoice(handle: string, atJson: string, choiceId: string, pick: number, now: number): void { set(handle, resolve(get(handle), parse<Scope>(atJson, []), choiceId, pick < 0 ? null : pick, now)) },
  applyProposal(handle: string, atJson: string, proposalId: string, approver: string, now: number): void { set(handle, acceptSubmission(get(handle), parse<Scope>(atJson, []), proposalId, approver, now).replica) },
  rejectProposal(handle: string, atJson: string, proposalId: string, now: number): void { set(handle, rejectProposalAt(get(handle), parse<Scope>(atJson, []), proposalId, now)) },
  reattach(handle: string, scopeJson: string): void {
    set(handle, reattach(get(handle), parse<Scope>(scopeJson, [])))
  },

  /**
   * Start syncing `handle` with its account server node by node. `kind` is the session's: a `user` syncs this device
   * root's Home with the account, a `peer` credential the node it was invited to (`meta.scope`). `push: false` only
   * pulls. `branch` (a project's git branch) syncs that branch of the attached node.
   */
  nodeSyncBegin(handle: string, kind: string, username: string, push: boolean, branch: string | null): void {
    // the device root syncs its Home with the account (rows of an older replica move there first); a project syncs
    // what it is attached to, from its own directory
    const r = homes.has(handle) && kind === 'user' && !get(handle).meta.scope.length ? shareHome(ensureHomeContext(get(handle), Date.now())) : get(handle)
    set(handle, r)
    const localRoot = r.meta.localScope ?? []
    const scope = kind === 'peer' ? r.meta.scope : []
    const remoteRoot = kind === 'peer' ? scope : [...r.meta.scope, ...localRoot]
    const peer = r.meta.serverPeerId ?? (kind === 'peer' ? null : `user:${username}`)
    const state = { run: undefined as unknown as ReturnType<typeof nodeTreeSync>, now: Date.now() }
    // a user's device also takes its server's own member entry above Home (its offers, its published key)
    state.run = nodeTreeSync(r, { peer, scope, remoteRoot, localRoot, branches: branch ? [{ scope: remoteRoot, name: branch }] : [], push, above: kind === 'user' ? accountContextAbove(r) : [] }, () => state.now)
    runs.set(handle, state)
  },
  /**
   * The host (Rust) sends each request this returns to the account server and passes the answer back (null on the
   * first call), until it returns `{ done, synced }`. Returns `{ request }` otherwise.
   */
  nodeSyncStep(handle: string, answerJson: string | null, now: number): string {
    const state = runs.get(handle)
    if (!state) throw new Error('no node sync in progress')
    state.now = now
    const step = answerJson ? state.run.next(JSON.parse(answerJson) as ProvidedNode) : state.run.next()
    if (!step.done) { set(handle, step.value.replica); return JSON.stringify({ request: step.value.request }) }
    runs.delete(handle)
    const r = step.value.replica
    set(handle, { ...r, meta: { ...r.meta, serverPeerId: step.value.peer ?? r.meta.serverPeerId } })
    return JSON.stringify({ done: true, synced: step.value.synced })
  },
  /** Drop a node sync that failed in transport (what it installed so far stays). */
  nodeSyncAbort(handle: string): void { runs.delete(handle) },
  libraryExportLocal(handle: string): string { return JSON.stringify(exportLocalLibrary(get(handle))) },
  graphNode(handle: string, atJson: string): string {
    const r = get(handle), cid = resolveScope(r.store, headCid(r), JSON.parse(atJson))
    if (!cid) throw new Error('Node not found.')
    return JSON.stringify({ cid: valueCidOf(r.store, cid), ...valueContent(r.store, cid) })
  },
  /** `fos node --write`: rows name existing cids, or give a node inline ({data, children}, nested to any depth). */
  writeGraphNode(handle: string, atJson: string, inputJson: string, instructionPathJson: string | null, now: number): void {
    const r = get(handle), input = JSON.parse(inputJson) as FosNodeContent & { nodes?: FosNodesData }
    if (input.nodes) {
      importNodes(r.store, input.nodes)
      if (Object.keys(input.nodes).some(cid => !r.store.table.has(cid))) throw new Error('Invalid graph dependencies.')
    }
    const inline = (side: unknown): string => {
      if (typeof side === 'string') return side
      const node = side as FosNodeContent
      if (!node || typeof node !== 'object' || !node.data || !Array.isArray(node.children)) throw new Error('A row side is a cid or a node {data, children}.')
      return put(r.store, { data: node.data, children: node.children.map(([left, right]) => [inline(left), inline(right)] as [string, string]) })
    }
    const cid = instructionPathJson ? resolveScope(r.store, headCid(r), JSON.parse(instructionPathJson)) : null
    if (instructionPathJson && !cid) throw new Error('Instruction node not found.')
    const children = (input.children as unknown[][]).map(([left, right]) => [inline(left), inline(right)] as [string, string])
    set(handle, writeGraphNode(r, JSON.parse(atJson), { data: input.data, children }, now, cid ? valueCidOf(r.store, cid) : undefined))
  },
  /** One MCP message (JSON-RPC) through the event grammar as this directory's owner. Returns {response, changed}. */
  mcp(handle: string, messageJson: string, peerId: string, now: number, sessionId?: string): string {
    let changed = false
    const previousRoot = get(handle).store.rootNodeId
    const response = handleMcp(JSON.parse(messageJson), { owner: true, serverName: 'fos', toolListChanges: true, dispatch: (event: FosEvent) => {
      const dispatched = dispatchEvent(get(handle), event, { peerId, owner: true, scope: [], sessionId }, now)
      if (dispatched.changed) { set(handle, dispatched.replica); changed = true }
      if (dispatched.evaluate) throw new Error('Evaluation is not available through the local server yet; run it from the app.')
      return dispatched.result
    } })
    if (response instanceof Promise) throw new Error('unexpected asynchronous dispatch')
    return JSON.stringify({ response, changed, previousRoot })
  },
  rollbackMcp(handle: string, previousRoot: string): void {
    const r = get(handle)
    if (!r.store.table.has(previousRoot)) throw new Error('Unknown MCP checkpoint.')
    r.store.rootNodeId = previousRoot
  }
}

type Host = { fosCore?: typeof api }
;(globalThis as Host).fosCore = api
