/**
 * Entry point of the sync core when embedded in the desktop binary (QuickJS).
 * Everything crosses the Rust↔JS boundary as JSON strings; replicas live in
 * this module keyed by a handle. See desktop/src-tauri/src/core.rs.
 */

import {
  addPartition,
  addTask,
  applyProposalAt,
  buildSyncRequest,
  completeSync,
  createReplica,
  deleteTask,
  headCid,
  isDirty,
  loadReplica,
  moveNode,
  parseSyncRequest,
  reattach,
  rejectProposalAt,
  renameTask,
  resolve,
  serializeReplica,
  serveSync,
  setTaskDone,
  view,
  type Replica,
  type Scope,
  type SyncRequest,
  type SyncResponse
} from './index'

const replicas = new Map<string, Replica>()

function get(handle: string): Replica {
  const r = replicas.get(handle)
  if (!r) throw new Error(`no replica ${handle}`)
  return r
}

function set(handle: string, r: Replica): void {
  replicas.set(handle, r)
}

const parse = <T>(json: string | null | undefined, fallback: T): T => (json ? (JSON.parse(json) as T) : fallback)

export const api = {
  /** Load a serialized replica (or start a fresh one) under `handle`, forcing the device id. */
  open(handle: string, serialized: string | null, peerId: string): void {
    const loaded = serialized ? loadReplica(JSON.parse(serialized)) : createReplica(peerId)
    set(handle, { store: loaded.store, meta: { ...loaded.meta, peerId } })
  },
  close(handle: string): void { replicas.delete(handle) },
  serialize(handle: string): string { return JSON.stringify(serializeReplica(get(handle))) },
  meta(handle: string): string {
    const r = get(handle)
    return JSON.stringify({ ...r.meta, headCid: headCid(r), dirty: isDirty(r) })
  },
  setScope(handle: string, scopeJson: string, namesJson: string): void {
    const r = get(handle)
    set(handle, { store: r.store, meta: { ...r.meta, scope: parse<Scope>(scopeJson, []), scopeNames: parse<string[]>(namesJson, []), baseCid: null } })
  },
  view(handle: string, atJson: string): string { return JSON.stringify(view(get(handle), parse<Scope>(atJson, []))) },
  /** Text lines of the tree below `at` (for the CLI/REPL), with short ids. */
  tree(handle: string, atJson: string): string {
    const r = get(handle)
    const lines: string[] = []
    const walk = (at: Scope, depth: number) => {
      const node = view(r, at)
      if (!node) return
      for (const t of node.tasks) {
        lines.push(`${'  '.repeat(depth)}${t.done ? '[x]' : '[ ]'} ${t.id.slice(0, 8)} ${t.title}${t.childCount ? ` (${t.subtreeDone}/${t.subtreeTasks})` : ''}${t.isLink ? ' ⛓' : ''}`)
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
  addPartition(handle: string, atJson: string, name: string, now: number): void { set(handle, addPartition(get(handle), parse<Scope>(atJson, []), name, now)) },
  setTaskDone(handle: string, atJson: string, id: string, done: boolean, now: number): void { set(handle, setTaskDone(get(handle), parse<Scope>(atJson, []), id, done, now)) },
  renameTask(handle: string, atJson: string, id: string, title: string, now: number): void { set(handle, renameTask(get(handle), parse<Scope>(atJson, []), id, title, now)) },
  deleteTask(handle: string, atJson: string, id: string, now: number): void { set(handle, deleteTask(get(handle), parse<Scope>(atJson, []), id, now)) },
  moveNode(handle: string, fromJson: string, id: string, toJson: string, positionJson: string, now: number): void {
    set(handle, moveNode(get(handle), parse<Scope>(fromJson, []), id, parse<Scope>(toJson, []), JSON.parse(positionJson), now))
  },
  resolveChoice(handle: string, atJson: string, choiceId: string, pick: number, now: number): void { set(handle, resolve(get(handle), parse<Scope>(atJson, []), choiceId, pick < 0 ? null : pick, now)) },
  applyProposal(handle: string, atJson: string, proposalId: string, approver: string, now: number): void { set(handle, applyProposalAt(get(handle), parse<Scope>(atJson, []), proposalId, approver, now)) },
  rejectProposal(handle: string, atJson: string, proposalId: string, now: number): void { set(handle, rejectProposalAt(get(handle), parse<Scope>(atJson, []), proposalId, now)) },
  reattach(handle: string, scopeJson: string, now: number, namesJson: string | null): void {
    set(handle, reattach(get(handle), parse<Scope>(scopeJson, []), now, namesJson ? parse<string[]>(namesJson, []) : undefined))
  },

  buildSyncRequest(handle: string, branch: string | null): string { return JSON.stringify(buildSyncRequest(get(handle), branch ?? undefined)) },
  completeSync(handle: string, requestJson: string, responseJson: string, now: number): string {
    const done = completeSync(get(handle), JSON.parse(requestJson) as SyncRequest, JSON.parse(responseJson) as SyncResponse, now)
    set(handle, done.replica)
    return JSON.stringify({ reMerged: done.reMerged, newChoiceIds: done.newChoiceIds })
  },
  /** Serve another peer against this replica (the directory as a node). */
  serveSync(handle: string, requestJson: string, serverPeerId: string, now: number, optionsJson: string | null): string {
    const parsed = parseSyncRequest(JSON.parse(requestJson))
    if ('error' in parsed) return JSON.stringify({ error: parsed.error, code: parsed.code })
    const r = get(handle)
    const served = serveSync(r.store, parsed, serverPeerId, now, parse(optionsJson, {}))
    if ('error' in served) return JSON.stringify(served)
    if (served.changed) set(handle, { ...r })
    return JSON.stringify({ changed: served.changed, response: served.response })
  }
}

type Host = { fosCore?: typeof api }
;(globalThis as Host).fosCore = api
