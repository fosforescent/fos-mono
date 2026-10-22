import type { App } from './app'
import { view, viewNode, readProposal, headCid, submittedBranch, HOME_ID, type Scope, type TaskView } from '../../shared/sync/index'
const selected = new WeakMap<App, { path: string; id: string }>()
import { combobox, type ComboOption } from './combobox'
import { iconSvg } from './icons'
import { HOME_TYPE } from '../../shared/sync/library-types'
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
/** `header`: the title row's picker, which also offers Change template (the title row has no row menu). */
export function alternativePicker(app: App, path: Scope, row: TaskView | null, titleMode = false, header = false): HTMLElement {
  const draft = { store: app.state.replica.store, head: headCid(app.state.replica), path: [...path] }
  const proposals = () => app.readsRequests() ? (JSON.stringify(path) === JSON.stringify(app.state.view) ? app.currentView()?.proposals : view(app.state.replica, path)?.proposals) ?? [] : []
  // a pull request (a peer's `branch:<name>` submission) is labelled by its branch
  const proposalLabel = (p: ReturnType<typeof proposals>[number]) => `${submittedBranch(p.name) ?? (p.name || p.peerId)} · ${p.peerId}${p.status === 'rejected' ? ' (rejected)' : ''}`
  // on a row a peer holds, marking a branch for merge sends it there as a pull request
  const held = !!row?.branches && !!app.pullRequestTarget(path)
  const requestLabel = (name: string) => held ? `Pull request: ${name}` : `Request merge: ${name}`
  const current = selected.get(app)
  const active = current?.path === JSON.stringify(path) ? proposals().find(p => p.id === current.id) : undefined
  const previewing = !!active
  const options = (): ComboOption[] => [
    ...(row?.branches?.names ?? ['Current']).map(name => ({ label: name, group: 'Branches', accessory: row?.branches && !(held && name === 'main') ? { label: requestLabel(name), pressed: !!row.branches.mergeRequests?.includes(name), run: () => app.toggleBranchMergeRequest(path, name) } : undefined, selected: !previewing && name === (row?.branches?.selected ?? 'Current'), run: () => {
      clearProposal(app)
      if (row?.branches) app.selectNodeBranch(path.slice(0, -1), row.id, name, true)
      else app.refresh()
    } })),
    ...proposals().map(p => {
      const branch = submittedBranch(p.name)
      return { label: proposalLabel(p), group: 'Branches', accessory: { label: branch ? `Pull request from ${p.peerId}` : 'Merge requested by ' + p.peerId, pressed: p.status === 'open', disabled: true, ...(branch && p.status === 'open' ? { tone: 'pending' as const } : {}), run: () => {} }, selected: active?.id === p.id, run: () => showProposal(app, path, p.id) }
    }),

  ]
  const box = combobox(`Branches of ${row?.title ?? 'Device root'}`, titleMode ? (proposalPreview(app)?.node.name ?? row?.title ?? 'Device root') : active ? proposalLabel(active) : row?.branches?.selected ?? 'Branches', options, query => {
    if (app.state.voice || app.state.work?.busy) return []
    if (previewing) return row && query ? [{ label: `Copy to branch “${query}”`, group: 'Create', run: () => { if (app.copyProposalToBranch(active!.id, query)) { clearProposal(app); app.refresh() } } }] : []
    const actions: ComboOption[] = []
    if (row && query && !row.branches?.names.includes(query)) actions.push({ label: `Create branch “${query}”`, group: 'Create', run: () => { void app.createNodeBranch(path.slice(0, -1), row.id, query, true) } })
    if (titleMode && row && row.type !== HOME_TYPE && !row.refPeer && !row.construction && !row.template && query && query !== row.title) actions.push({ label: `Set node text to “${query}”`, group: 'Edit', run: () => app.editCurrentText(query, draft) })
    if ((titleMode || header) && row && row.type !== HOME_TYPE && !row.refPeer) actions.push({ label: 'Change template', group: 'Edit', run: () => app.openTemplatePicker(path) })
    return actions
  })
  box.classList.add('alternative-picker')
  box.querySelector('button')!.disabled = !!app.state.voice || !!app.state.work?.busy
  // looking into a pull request: approve it beside the picker (the server signs the approval; the group's rule merges)
  const pulled = active && active.status === 'open' ? submittedBranch(active.name) : null
  if (!pulled) return box
  const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'icon approve-pull-request'
  approve.innerHTML = iconSvg('pull-request') ?? 'PR'; approve.title = `Approve ${active!.peerId}'s pull request “${pulled}”`; approve.setAttribute('aria-label', approve.title)
  approve.disabled = !!app.state.voice || !!app.state.work?.busy || app.evaluating
  approve.onclick = () => { clearProposal(app); void app.approvePullRequest(path, pulled) }
  const wrap = document.createElement('span'); wrap.className = 'alternative-picker-group'
  wrap.append(box, approve)
  return wrap
}
