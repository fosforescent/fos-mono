import type { App } from './app'
import { view, headCid, withBranches, type Scope, type TaskView } from '../../shared/sync/index'

type Entry = { label: string; value: string; details: string; type: string }
/** Read both branches without changing the editor selection or its undo history. */
export function branchRows(app: App, path: Scope, branch: string): Map<string, Entry> {
  return withBranches(app.state.replica.store, { [path.at(-1)!]: branch }, () => {
    const rows = new Map<string, Entry>()
    const add = (row: TaskView, key: string, label: string, position = 0) => rows.set(key, { label, type: row.typeName ?? '', value: JSON.stringify([row.title, row.typeCid, row.done, row.scalar, row.requirement, row.allocation, position]), details: [row.typeName, row.checkable ? row.done ? 'complete' : 'open' : '', row.allocation ? `${row.allocation.amount} ${row.allocation.unit}` : '', row.requirement ? `${row.requirement.satisfied ? 'fulfilled' : 'requested'} ${row.requirement.amount ?? ''} ${row.requirement.unit ?? ''}` : '', `row ${position + 1}`].filter(Boolean).join(' · ') })
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node }

/**
 * What merging `source` into `target` changes, row by row, inline or side by side. With `request`, it is the review of
 * `source`'s merge request: approving merges it into `target` and settles the request, closing withdraws it.
 */
export function compareBranches(app: App, path: Scope, source: string, target: string, request = false): void {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  const store = app.state.replica.store
  const head = headCid(app.state.replica)
  const before = branchRows(app, path, target), after = branchRows(app, path, source)
  const keys = [...new Set([...before.keys(), ...after.keys()])]
  const status = (key: string) => { const old = before.get(key), next = after.get(key); return !old ? 'added' : !next ? 'removed' : old.value === next.value ? 'same' : 'changed' }
  const count = (kind: string) => keys.filter(key => status(key) === kind).length
  const dialog = document.createElement('dialog'); dialog.className = 'branch-compare'
  dialog.setAttribute('aria-label', request ? `Merge request: ${source} into ${target}` : `Compare ${source} with ${target}`)
  const head1 = el('div', 'compare-head')
  const title = el('h3', '', `${source} → ${target}`)
  const summary = el('span', 'compare-summary')
  summary.append(el('span', 'diff-added', `+${count('added')}`), ' · ', el('span', 'diff-removed', `−${count('removed')}`), ` · ${count('changed')} changed`)
  const layouts = el('div', 'compare-layout'); layouts.setAttribute('role', 'group'); layouts.setAttribute('aria-label', 'Diff layout')
  head1.append(title, summary, layouts)
  const body = el('div', 'branch-diff-rows')
  const renderInline = () => {
    body.replaceChildren()
    for (const key of keys) {
      const kind = status(key), old = before.get(key), next = after.get(key)
      const line = el('div', `branch-diff-row ${kind}`)
      line.append(el('span', 'diff-status', { added: '+', removed: '−', changed: '~', same: '' }[kind]), el('span', 'diff-type', (next ?? old)!.type), el('span', 'diff-label', next?.label ?? old!.label))
      if (kind === 'changed') line.append(el('small', '', `Before: ${old!.label} (${old!.details})`), el('small', '', `After: ${next!.label} (${next!.details})`))
      else line.append(el('small', '', kind === 'same' ? 'unchanged' : kind === 'added' ? `added on ${source}` : `removed on ${source}`))
      body.append(line)
    }
    if (!keys.some(key => status(key) !== 'same')) body.prepend(el('p', 'muted', 'No row differences.'))
  }
  const renderSplit = () => {
    body.replaceChildren()
    const grid = el('div', 'branch-diff-split')
    grid.append(el('div', 'split-head', target), el('div', 'split-head', source))
    for (const key of keys) {
      const kind = status(key), old = before.get(key), next = after.get(key)
      grid.append(el('div', `split-cell ${kind === 'added' ? 'empty' : kind}`, old?.label ?? '—'), el('div', `split-cell ${kind === 'removed' ? 'empty' : kind}`, next?.label ?? '—'))
    }
    body.append(grid)
  }
  for (const [label, render] of [['Inline', renderInline], ['Split', renderSplit]] as const) {
    const b = el('button', 'secondary small', label); b.type = 'button'
    b.onclick = () => { render(); for (const other of Array.from(layouts.children)) other.setAttribute('aria-pressed', String(other === b)) }
    b.setAttribute('aria-pressed', String(label === 'Inline')); layouts.append(b)
  }
  renderInline()
  const busy = () => !!app.state.voice || !!app.state.work?.busy || app.evaluating
  const stale = () => app.state.replica.store !== store || headCid(app.state.replica) !== head
  const merge = el('button', 'primary', request ? `Approve & merge into ${target}` : `Merge ${source} into ${target}`)
  merge.disabled = source === target || busy() || !app.canApprove()
  merge.onclick = () => {
    if (stale()) { app.notify('info', 'The branches changed. Open Compare again to review the latest changes.'); dialog.close(); return }
    app.mergeNodeBranch(path.slice(0, -1), path.at(-1)!, target, true, source)
    dialog.close()
  }
  const close = el('button', '', 'Close'); close.onclick = () => dialog.close()
  const actions = el('div', 'dialog-actions')
  if (request) {
    const section = el('section', 'merge-request'); section.setAttribute('aria-label', 'Merge request')
    const text = el('div', 'merge-request-text')
    text.append(el('strong', '', `Merge ${source} into ${target}`), el('span', 'muted', app.canApprove() ? `Approving merges these changes into ${target}.` : `Waiting for someone who can approve changes to ${target}.`))
    const withdraw = el('button', 'secondary', 'Close request')
    withdraw.disabled = busy()
    withdraw.onclick = () => { app.toggleBranchMergeRequest(path, source); dialog.close() }
    section.append(text, withdraw, merge)
    actions.append(close)
    dialog.append(head1, section, body, actions)
  } else {
    actions.append(close, merge)
    dialog.append(head1, el('p', 'muted', 'Review row changes before merging.'), body, actions)
  }
  dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}
