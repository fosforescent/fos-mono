import type { App } from './app'
import { view, viewNode, readProposal, headCid, HOME_ID, type Scope, type TaskView } from '../../shared/sync/index'
const selected = new WeakMap<App, { path: string; id: string }>()
import { combobox, type ComboOption } from './combobox'
export function proposalPreview(app: App) {
  const choice = selected.get(app)
  if (!choice || choice.path !== JSON.stringify(app.state.view) || !app.readsRequests()) return null
  const proposal = app.currentView()?.proposals.find(p => p.id === choice.id)
  const record = proposal && readProposal(app.state.replica.store, proposal.id)
  if (!record) {
    const remote = proposal && app.proposalPreviewData(proposal.id)
    if (remote) return { proposal: proposal!, ...remote }
    return null
  }
  return { proposal: proposal!, node: viewNode(app.state.replica.store, record.contentCid), cid: record.contentCid, store: app.state.replica.store, remote: false }
}
export function showProposal(app: App, path: Scope, id: string): void {
  document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
  selected.set(app, { path: JSON.stringify(path), id }); app.goTo(path)
  if (!readProposal(app.state.replica.store, id)) void app.loadProposalPreview(path, id)
}
export function clearProposal(app: App): void { selected.delete(app) }
/** Local and incoming branches share one picker; incoming values remain read-only. */
export function alternativePicker(app: App, path: Scope, row: TaskView | null, titleMode = false): HTMLElement {
  const draft = { store: app.state.replica.store, head: headCid(app.state.replica), path: [...path] }
  const proposals = () => app.readsRequests() ? (JSON.stringify(path) === JSON.stringify(app.state.view) ? app.currentView()?.proposals : view(app.state.replica, path)?.proposals) ?? [] : []
  const proposalLabel = (p: ReturnType<typeof proposals>[number]) => `${p.name || p.peerId} · ${p.peerId}${p.status === 'rejected' ? ' (rejected)' : ''}`
  const current = selected.get(app)
  const active = current?.path === JSON.stringify(path) ? proposals().find(p => p.id === current.id) : undefined
  const previewing = !!active
  const options = (): ComboOption[] => [
    ...(row?.branches?.names ?? ['Current']).map(name => ({ label: name, group: 'Branches', accessory: row?.branches ? { label: `Request merge: ${name}`, pressed: !!row.branches.mergeRequests?.includes(name), run: () => app.toggleBranchMergeRequest(path, name) } : undefined, selected: !previewing && name === (row?.branches?.selected ?? 'Current'), run: () => {
      clearProposal(app)
      if (row?.branches) app.selectNodeBranch(path.slice(0, -1), row.id, name, true)
      else app.refresh()
    } })),
    ...proposals().map(p => ({ label: proposalLabel(p), group: 'Branches', accessory: { label: 'Merge requested by ' + p.peerId, pressed: p.status === 'open', disabled: true, run: () => {} }, selected: active?.id === p.id, run: () => showProposal(app, path, p.id) })),

  ]
  const box = combobox(`Branches of ${row?.title ?? 'Settings'}`, titleMode ? (proposalPreview(app)?.node.name ?? row?.title ?? 'Settings') : active ? proposalLabel(active) : row?.branches?.selected ?? 'Branches', options, query => {
    if (app.state.voice || app.state.work?.busy) return []
    if (previewing) return row && query ? [{ label: `Copy to branch “${query}”`, group: 'Create', run: () => { if (app.copyProposalToBranch(active!.id, query)) { clearProposal(app); app.refresh() } } }] : []
    const actions: ComboOption[] = []
    if (row && query && !row.branches?.names.includes(query)) actions.push({ label: `Create branch “${query}”`, group: 'Create', run: () => { void app.createNodeBranch(path.slice(0, -1), row.id, query, true) } })
    if (titleMode && row && row.kind !== 'home' && !row.refPeer && !row.construction && !row.template && query && query !== row.title) actions.push({ label: `Set node text to “${query}”`, group: 'Edit', run: () => app.editCurrentText(query, draft) })
    if (titleMode && row && row.kind !== 'home' && !row.refPeer) actions.push({ label: 'Change template', group: 'Edit', run: () => app.openTemplatePicker(path) })
    return actions
  })
  box.classList.add('alternative-picker')
  box.querySelector('button')!.disabled = !!app.state.voice || !!app.state.work?.busy
  return box
}
