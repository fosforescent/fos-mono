import type { App } from './app'
import { view, viewNode, readProposal, type Scope, type TaskView } from '../../shared/sync/index'
const selected = new WeakMap<App, { path: string; id: string }>()
import { combobox, type ComboOption } from './combobox'
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
/** Shared row picker: branches/proposals choose a value; children open their own context. */
export function alternativePicker(app: App, path: Scope, row: TaskView | null): HTMLElement {
  const proposals = () => app.readsRequests() ? view(app.state.replica, path)?.proposals ?? [] : []
  const proposalLabel = (p: ReturnType<typeof proposals>[number]) => `${p.name || p.peerId} · ${p.peerId}${p.status === 'rejected' ? ' (rejected)' : ''}`
  const current = selected.get(app)
  const active = current?.path === JSON.stringify(path) ? proposals().find(p => p.id === current.id) : undefined
  const previewing = !!active
  const options = (): ComboOption[] => [
    ...(row?.branches?.names ?? ['Current']).map(name => ({ label: `Branch: ${name}`, group: 'Branches', selected: !previewing && name === (row?.branches?.selected ?? 'Current'), run: () => {
      clearProposal(app)
      if (row?.branches) app.selectNodeBranch(path.slice(0, -1), row.id, name, true)
      else app.refresh()
    } })),
    ...proposals().map(p => ({ label: `Proposal: ${proposalLabel(p)}`, group: 'Proposals', selected: active?.id === p.id, run: () => showProposal(app, path, p.id) })),
    // A proposal preview must not navigate into the owner's unrelated children.
    ...(!previewing ? view(app.state.replica, path)?.tasks ?? [] : []).map(child => ({ label: child.title || 'Untitled child', group: 'Children', run: () => { clearProposal(app); app.goTo([...path, child.id]) } }))
  ]
  const box = combobox(`Branches, proposals and children of ${row?.title ?? 'Settings'}`, active ? proposalLabel(active) : row?.branches?.selected ?? 'Branches / children', options, query => {
    if (app.state.voice || app.state.work?.busy) return []
    if (previewing) return row && query ? [{ label: `Copy to branch “${query}”`, group: 'Create', run: () => { if (app.copyProposalToBranch(active!.id, query)) { clearProposal(app); app.refresh() } } }] : []
    const actions: ComboOption[] = []
    if (row && query && !row.branches?.names.includes(query)) actions.push({ label: `Create branch “${query}”`, group: 'Create', run: () => { void app.createNodeBranch(path.slice(0, -1), row.id, query, true) } })
    actions.push({ label: query ? `Add child “${query}”` : 'Add child', group: 'Create', run: () => {
      clearProposal(app); app.goTo(path)
      const id = app.addRowAt([], 'plain', query); app.select([id])
    } })
    return actions
  })
  box.classList.add('alternative-picker')
  box.querySelector('button')!.disabled = !!app.state.voice || !!app.state.work?.busy
  return box
}
