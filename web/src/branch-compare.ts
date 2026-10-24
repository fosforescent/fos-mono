import type { App } from './app'
import { view, headCid, withBranches, type Scope, type TaskView } from '../../shared/sync/index'

type Entry = { label: string; value: string; details: string }
/** Read both branches without changing the editor selection or its undo history. */
export function branchRows(app: App, path: Scope, branch: string): Map<string, Entry> {
  return withBranches(app.state.replica.store, { [path.at(-1)!]: branch }, () => {
    const rows = new Map<string, Entry>()
    const add = (row: TaskView, key: string, label: string, position = 0) => rows.set(key, { label, value: JSON.stringify([row.title, row.typeCid, row.done, row.scalar, row.requirement, row.allocation, position]), details: [row.typeName, row.checkable ? row.done ? 'complete' : 'open' : '', row.allocation ? `${row.allocation.amount} ${row.allocation.unit}` : '', row.requirement ? `${row.requirement.satisfied ? 'fulfilled' : 'requested'} ${row.requirement.amount ?? ''} ${row.requirement.unit ?? ''}` : '', `row ${position + 1}`].filter(Boolean).join(' · ') })
    const current = view(app.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1))
    if (current) add(current, 'self', current.title || current.typeName || 'Node')
    const walk = (at: Scope, names: string[], depth: number) => {
      if (depth > 64) return
      for (const [position, row] of (view(app.state.replica, at)?.tasks ?? []).entries()) {
        const next = [...at, row.id], labels = [...names, row.title || row.typeName || 'Untitled row']
        add(row, JSON.stringify(next.slice(path.length)), labels.join(' / '), position)
        if (row.childCount) walk(next, labels, depth + 1)
      }
    }
    walk(path, [], 0)
    return rows
  })
}

export function compareBranches(app: App, path: Scope, source: string, target: string): void {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  const store = app.state.replica.store
  const head = headCid(app.state.replica)
  const before = branchRows(app, path, target), after = branchRows(app, path, source)
  const dialog = document.createElement('dialog'); dialog.className = 'branch-compare'
  dialog.setAttribute('aria-label', `Compare ${source} with ${target}`)
  const title = document.createElement('h3'); title.textContent = `${source} → ${target}`
  const caption = document.createElement('p'); caption.className = 'muted'; caption.textContent = 'Review row changes before merging.'
  const list = document.createElement('div'); list.className = 'branch-diff-rows'
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(key), next = after.get(key)
    if (old?.value === next?.value) continue
    const line = document.createElement('div'); line.className = `branch-diff-row ${!old ? 'added' : !next ? 'removed' : 'changed'}`
    const status = document.createElement('span'); status.className = 'diff-status'; status.textContent = !old ? '+ Added' : !next ? '− Removed' : '~ Changed'
    const label = document.createElement('span'); label.textContent = next?.label ?? old!.label
    line.append(status, label)
    if (old && next) { const previous = document.createElement('small'); previous.textContent = `Before: ${old.label} (${old.details})`; const updated = document.createElement('small'); updated.textContent = `After: ${next.label} (${next.details})`; line.append(previous, updated) }
    list.append(line)
  }
  if (!list.childElementCount) list.textContent = 'No row differences.'
  const actions = document.createElement('div'); actions.className = 'dialog-actions'
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close()
  const merge = document.createElement('button'); merge.className = 'primary'; merge.textContent = `Merge ${source} into ${target}`
  merge.disabled = source === target || !!app.state.voice || !!app.state.work?.busy || !app.canApprove() || app.evaluating
  merge.onclick = () => {
    const row = view(app.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1))
    if (app.state.replica.store !== store || headCid(app.state.replica) !== head || row?.branches?.selected !== source) { app.notify('info', 'The branches changed. Open Compare again to review the latest changes.'); dialog.close(); return }
    app.mergeNodeBranch(path.slice(0, -1), path.at(-1)!, target, true)
    dialog.close()
  }
  actions.append(close, merge); dialog.append(title, caption, list, actions)
  dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}
