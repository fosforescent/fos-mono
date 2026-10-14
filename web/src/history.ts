import { valueContent, identityCid, commitRoot, headCid, mergeNodes, resolveScope, viewNode, type Replica, type Scope } from '../../shared/sync/index'

type Change = { from: string; to: string; path: Scope; settings: boolean }

/** Local intent history; content is already retained by the graph's PREV chain. */
export class EditHistory {
  private past: Change[] = []
  private future: Change[] = []
  get canUndo(): boolean { return this.past.length > 0 }
  get canRedo(): boolean { return this.future.length > 0 }
  clear(): void { this.past = []; this.future = [] }

  record(replica: Replica, before: string, settings: boolean, preferred?: Scope): void {
    const after = headCid(replica)
    if (before === after) return
    this.past.push({ from: after, to: before, path: changedPath(replica, after, before, preferred), settings })
    if (this.past.length > 100) this.past.shift()
    this.future = []
  }

  canApply(replica: Replica, redo: boolean, scope: Scope): boolean {
    return (redo ? this.future : this.past).some(change => withinScope(replica, change, scope))
  }

  apply(replica: Replica, redo: boolean, now: number, scope?: Scope): { replica: Replica; path: Scope; settings: boolean; conflicts: boolean } | null {
    const source = redo ? this.future : this.past
    const destination = redo ? this.past : this.future
    let index = source.length - 1
    if (scope) while (index >= 0 && !withinScope(replica, source[index], scope)) index--
    const change = source[index]
    if (!change) return null
    const before = headCid(replica)
    const result = mergeNodes(replica.store, change.from, before, change.to, { ours: 'Current edits', theirs: redo ? 'Redo' : 'Undo' })
    commitRoot(replica.store, result.cid, now)
    source.splice(index, 1)
    destination.push({ from: result.cid, to: before, path: changedPath(replica, result.cid, before, change.path), settings: change.settings })
    return { replica: { ...replica }, path: change.path, settings: change.settings, conflicts: result.newChoiceCids.length > 0 }
  }
}

/** Prefer a changed row in the destination; for a deletion focus its surviving parent. */
function changedPath(replica: Replica, before: string, after: string, preferred?: Scope): Scope {
  return addedPath(replica, before, after, []) ?? modifiedPath(replica, before, after, [], preferred)
}

// Search additions first across the changed branches: a move should follow the row to its destination.
function addedPath(replica: Replica, before: string, after: string, path: Scope): Scope | null {
  const oldCid = resolveScope(replica.store, before, path)
  const newCid = resolveScope(replica.store, after, path)
  if (!newCid || oldCid === newCid) return null
  if (!oldCid) return path
  const oldRows = viewNode(replica.store, oldCid).tasks
  const newRows = viewNode(replica.store, newCid).tasks
  for (const row of newRows) if (!oldRows.some((r) => r.id === row.id)) return [...path, row.id]
  for (const row of newRows) {
    const added = addedPath(replica, before, after, [...path, row.id])
    if (added) return added
  }
  return null
}

function modifiedPath(replica: Replica, before: string, after: string, path: Scope = [], preferred?: Scope): Scope {
  const oldCid = resolveScope(replica.store, before, path)
  const newCid = resolveScope(replica.store, after, path)
  if (!oldCid || !newCid) return path
  const oldRows = viewNode(replica.store, oldCid).tasks
  const newRows = viewNode(replica.store, newCid).tasks
  for (const row of newRows) {
    if (!oldRows.some((r) => r.id === row.id)) return [...path, row.id]
  }
  for (const row of newRows) {
    const child = [...path, row.id]
    if (resolveScope(replica.store, before, child) !== resolveScope(replica.store, after, child)) return modifiedPath(replica, before, after, child, preferred)
  }
  // Sibling reorders keep every child CID unchanged. Prefer the row the user moved.
  if (oldRows.length === newRows.length && newRows.some((row, i) => row.id !== oldRows[i]?.id)) {
    const selectedId = preferred?.[path.length]
    const selectedHere = preferred?.length === path.length + 1 && path.every((id, i) => preferred[i] === id)
    if (selectedHere && newRows.some((row) => row.id === selectedId)) return [...path, selectedId!]
    const moved = newRows.find((row, i) => row.id !== oldRows[i]?.id)
    if (moved) return [...path, moved.id]
  }
  return path
}

/** Do not let a node undo affect sibling nodes (including cross-parent moves). */
function withinScope(replica: Replica, change: Change, scope: Scope): boolean {
  if (!scope.length) return true
  const { store } = replica
  for (let depth = 0; depth < scope.length; depth++) {
    const parent = scope.slice(0, depth), childPath = scope.slice(0, depth + 1)
    const signature = (head: string) => {
      const parentCid = resolveScope(store, head, parent), childCid = resolveScope(store, head, childPath)
      if (!parentCid || !childCid) return null
      const value = valueContent(store, parentCid), { updated, ...data } = value.data
      return JSON.stringify({ data, children: value.children.map(edge => identityCid(store, edge) === childCid ? ['selected-child'] : edge) })
    }
    const before = signature(change.from), after = signature(change.to)
    if (before === null || after === null || before !== after) return false
  }
  return resolveScope(store, change.from, scope) !== resolveScope(store, change.to, scope)
}
