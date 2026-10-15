import type { App } from './app'
import { view, viewNode, readProposal, type Scope, type TaskView } from '../../shared/sync/index'
const selected = new WeakMap<App, { path: string; id: string }>()
let sequence = 0
export function proposalPreview(app: App) {
  const choice = selected.get(app)
  if (!choice || choice.path !== JSON.stringify(app.state.view) || !app.readsRequests()) return null
  const proposal = app.currentView()?.proposals.find(p => p.id === choice.id)
  const record = proposal && readProposal(app.state.replica.store, proposal.id)
  if (!record) { selected.delete(app); return null }
  return { proposal: proposal!, node: viewNode(app.state.replica.store, record.contentCid), cid: record.contentCid }
}
export function showProposal(app: App, path: Scope, id: string): void {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  selected.set(app, { path: JSON.stringify(path), id }); app.goTo(path)
}
export function clearProposal(app: App): void { selected.delete(app) }
/** Native combobox: one searchable list for named branches and proposed branches. */
export function alternativePicker(app: App, path: Scope, row: TaskView | null): HTMLElement {
  const box = document.createElement('span'); box.className = 'alternative-picker'
  const input = document.createElement('input'), list = document.createElement('datalist')
  list.id = `alternatives-${++sequence}`; input.setAttribute('list', list.id)
  input.setAttribute('aria-label', `Branch or proposal of ${row?.title ?? 'Settings'}`)
  input.placeholder = 'Find branch or proposal…'; input.autocomplete = 'off'
  const choices = new Map<string, () => void>()
  const add = (label: string, run: () => void) => { choices.set(label, run); const option = document.createElement('option'); option.value = label; list.append(option) }
  for (const name of row?.branches?.names ?? ['Current']) add(`Branch: ${name}`, () => {
    clearProposal(app)
    if (row?.branches) app.selectNodeBranch(path.slice(0, -1), row.id, name, true)
    else app.refresh()
  })
  const proposals = app.readsRequests() ? view(app.state.replica, path)?.proposals ?? [] : []
  const proposalLabel = (p: typeof proposals[number]) => `Proposal: ${p.name || p.peerId} · ${p.peerId}${p.status === 'rejected' ? ' (rejected)' : ''}`
  for (const p of proposals) add(proposalLabel(p), () => showProposal(app, path, p.id))
  const current = selected.get(app)
  const active = current?.path === JSON.stringify(path) ? proposals.find(p => p.id === current.id) : undefined
  input.value = active ? proposalLabel(active) : `Branch: ${row?.branches?.selected ?? 'Current'}`
  input.disabled = !!app.state.voice || !!app.state.work?.busy
  input.onpointerdown = e => { e.stopPropagation(); document.activeElement?.dispatchEvent(new window.Event('commit-edit')) }
  input.onclick = e => e.stopPropagation()
  input.onchange = () => { const run = choices.get(input.value); if (run) { input.blur(); run() } }
  input.onblur = () => { setTimeout(() => { if (input.isConnected) app.refresh() }, 0) }
  box.append(input, list); return box
}
