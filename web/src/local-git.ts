import type { App } from './app'
import { openCliAgent } from './agents'
import { inTauri, tauriInvoke } from './project'
import { argumentRefs, capabilityTarget, content, contextMembers, headCid, refValueCid, resolveScope, specificationRows, type FeatureSpecification, type Scope } from '../../shared/sync/index'

type Snapshot = { cwd: string; branch: string; head: string; revision: string; specifications: FeatureSpecification[]; branches: string[]; merged: boolean; dirty: boolean }
type Binding = { path: string; scope: Scope; peer: string }
function binding(app: App, path = app.state.view): Binding | null {
  const r = app.state.replica
  for (let depth = path.length; depth >= 0; depth--) {
    const scope = path.slice(0,depth), cid = resolveScope(r.store, headCid(r), scope)
    if (!cid) continue
    const arg = argumentRefs(r.store,cid).find(a => a.name === 'local-repository' && a.type === capabilityTarget(r.store,'repo'))
    if (!arg) continue
    const value = refValueCid(r.store,content(r.store,arg.cid))
    try { const data = JSON.parse(value ? content(r.store,value).data.description?.content ?? '' : ''); if (data.device === r.meta.peerId && typeof data.path === 'string') return { path: data.path, scope, peer: data.peer ?? `git:${r.meta.peerId}:${encodeURIComponent(data.path)}` } } catch { return null }
  }
  return null
}
type State = { binding: Binding; store: App['state']['replica']['store']; session: App['state']['session']; snapshot?: Snapshot; observed?: {branch:string;head:string;graph:string;disk:string}; graph?: string; disk?: string; busy: boolean; error?: string; conflict?: Snapshot; timer?: ReturnType<typeof setTimeout> }
const states = new WeakMap<App, State>()
const json = (specs: FeatureSpecification[]) => JSON.stringify([...specs].sort((a,b) => a.id.localeCompare(b.id)))
const invoke = async (request: Record<string,unknown>) => { const result = await tauriInvoke<Snapshot>('local_git', { request }); if (!result) throw new Error('Desktop app required.'); return result }
const valid = (app: App, state: State) => app.state.replica.store === state.store && app.state.session === state.session && states.get(app) === state
const allowed = (app: App, state: State) => { const member = contextMembers(app.state.replica,state.binding.scope).find(m => m.peerId === state.binding.peer); return !!member && member.capabilities.includes('repo') && (member.accepts ?? []).includes('repo') && !member.disabled?.includes('repo') }
const observationKey = (state: State) => `fos.local-git:${state.binding.peer}:${JSON.stringify(state.binding.scope)}`
function remember(state: State) {
  if (!state.snapshot) return
  state.observed={branch:state.snapshot.branch,head:state.snapshot.head,graph:state.graph!,disk:state.disk!}
  try { localStorage.setItem(observationKey(state),JSON.stringify(state.observed)) } catch { /* storage can be unavailable */ }
}
const pendingBranch = (app:App,snapshot:Snapshot) => {
  const normalize=(path:string)=>path.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()
  return app.projectDirectory() && normalize(app.projectDirectory()!)===normalize(snapshot.cwd) && app.currentBranch()!==snapshot.branch
}
async function sync(app: App, state: State) {
  if (state.busy || !valid(app,state)) return
  clearTimeout(state.timer)
  state.busy = true
  const before = JSON.stringify([state.snapshot,state.graph,state.error])
  try {
    app.registerLocalGitPeer(state.binding.scope, state.binding.path)
    if (!allowed(app,state)) throw new Error('Local Git peer access is disabled.')
    const graph = json(specificationRows(app.state.replica,state.binding.scope))
    let snapshot = await invoke({ cwd: state.binding.path, action: 'status', previousHead: state.snapshot?.head ?? state.observed?.head })
    if (!valid(app,state) || graph !== json(specificationRows(app.state.replica,state.binding.scope))) return
    if (pendingBranch(app,snapshot)) return
    if (!state.snapshot && state.observed) {
      if (state.observed.branch === snapshot.branch) { state.graph=state.observed.graph; state.disk=state.observed.disk }
      else { state.graph=graph; state.disk='branch-switch' }
    }
    const merged = snapshot.merged
    const disk = json(snapshot.specifications), initial = state.graph === undefined
    const graphChanged = initial ? graph !== '[]' : graph !== state.graph
    const diskChanged = initial ? disk !== '[]' : disk !== state.disk
    if (graphChanged && diskChanged && graph !== disk) { state.conflict=snapshot; throw new Error('Both graph and Git specifications changed. Resolve them before syncing; neither copy was overwritten.') }
    if (diskChanged && graph !== disk) app.importFeatureSpecifications(state.binding.scope,snapshot.specifications)
    else if (graphChanged && graph !== disk) snapshot = await invoke({ cwd: state.binding.path, action: 'save-specifications', expected: snapshot.revision, specifications: JSON.parse(graph) })
    if (!valid(app,state)) return
    if (merged && (state.snapshot?.branch ?? state.observed?.branch) === snapshot.branch) app.queueFeatureVerification(state.binding.scope,snapshot.head,snapshot.branch)
    state.snapshot = snapshot; state.disk = json(snapshot.specifications); state.graph = json(specificationRows(app.state.replica,state.binding.scope)); state.error = undefined; state.conflict=undefined; remember(state)
  } catch (error) { state.error = String(error) }
  finally { state.busy = false; if (valid(app,state)) { if (before !== JSON.stringify([state.snapshot,state.graph,state.error])) app.refresh(); state.timer = setTimeout(() => void sync(app,state),3000); (state.timer as any).unref?.() } }
}
function verifyDialog(app: App, state: State) {
  const snapshot = state.snapshot!, specs = specificationRows(app.state.replica,state.binding.scope), dialog = document.createElement('dialog')
  dialog.className = 'constructor-dialog'
  const heading = document.createElement('h3'); heading.textContent = 'Verify feature specifications'
  const explanation = document.createElement('p'); explanation.textContent = 'Launch a CLI with its configured browser/MCP tools, or copy the prompt for another agent. A run is not a pass: import one evidenced result per specification. Browser plugins must be installed and authorized in that agent.'
  const prompt = document.createElement('textarea'); prompt.rows = 10; prompt.readOnly = true; prompt.setAttribute('aria-label','Verification prompt')
  prompt.value = `Verify every specification against commit ${snapshot.head} on branch ${snapshot.branch}. Use configured Chrome/browser/MCP tools where applicable. Do not change implementation or .fos files. Mark unavailable tools or inaccessible apps as blocked, not passed. Return JSON {"commit":"${snapshot.head}","results":[{"id":"spec-id","status":"pass|fail|blocked","evidence":"concrete steps, observations, URLs or test output"}]}.\nSpecifications:\n${JSON.stringify(specs,null,2)}`
  const target = document.createElement('input'); target.placeholder = 'Application URL to verify (optional)'; target.setAttribute('aria-label','Verification application URL')
  const chrome=document.createElement('input'); chrome.type='checkbox'; chrome.setAttribute('aria-label','Use Claude Chrome integration')
  const browser=document.createElement('label'); browser.append(chrome,'Use configured Claude Chrome integration')
  const buttons = document.createElement('div')
  for (const provider of ['claude','codex'] as const) { const b = document.createElement('button'); b.textContent = `Verify with ${provider === 'claude' ? 'Claude Code' : 'Codex'}`; b.onclick = () => { if (!valid(app,state)) return; openCliAgent(app,provider,state.binding.path,prompt.value + (target.value ? `\nApplication URL: ${target.value}` : ''),true,{autoStart:true,scope:state.binding.scope,chrome:chrome.checked}) }; buttons.append(b) }
  const report = document.createElement('textarea'); report.rows = 8; report.placeholder = 'Paste the verifier JSON report'; report.setAttribute('aria-label','Verification report')
  const status = document.createElement('p'); status.setAttribute('role','status')
  const save = document.createElement('button'); save.textContent = 'Record results and create issues'
  save.onclick = async () => { save.disabled = true; try {
    if (!valid(app,state)) throw new Error('Data session changed.')
    const current = await invoke({ cwd: state.binding.path, action: 'status' })
    if (!valid(app,state) || current.head !== snapshot.head || current.dirty) throw new Error('Working tree changed or is uncommitted. Verify the current committed tree.')
    const value = JSON.parse(report.value)
    if (value.commit !== snapshot.head || !Array.isArray(value.results)) throw new Error('Report must match the verified commit.')
    app.recordFeatureVerification(state.binding.scope,{ commit: snapshot.head, specifications: specs, results: value.results }); status.textContent = 'Results recorded; failed or blocked checks are task rows.'
  } catch(error) { status.textContent = String(error) } finally { save.disabled = false } }
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close()
  dialog.append(heading,explanation,target,browser,prompt,buttons,report,save,status,close); dialog.addEventListener('close',()=>dialog.remove()); document.body.append(dialog); dialog.showModal()
}
export function localGitControls(app: App): HTMLElement | null {
  if (!inTauri()) return null
  const selected = binding(app); if (!selected) return null
  let state = states.get(app)
  if (!state || state.store !== app.state.replica.store || state.session !== app.state.session || JSON.stringify(state.binding) !== JSON.stringify(selected)) {
    clearTimeout(state?.timer); state = { binding:selected, store:app.state.replica.store, session:app.state.session, busy:false }; try { const saved=JSON.parse(localStorage.getItem(observationKey(state)) ?? 'null'); if(saved && ['branch','head','graph','disk'].every(key=>typeof saved[key]==='string')) state.observed=saved } catch {}
    states.set(app,state); const captured = state; queueMicrotask(() => void sync(app,captured))
  }
  const box = document.createElement('div'); box.className = 'local-git-controls'; box.dataset.peer = selected.peer
  const label = document.createElement('small'); label.textContent = `Local Git: ${state.snapshot?.branch || 'loading'} ${state.snapshot?.head.slice(0,8) ?? ''}`; box.append(label)
  if (state.error) { const error = document.createElement('p'); error.textContent = state.error; box.append(error) }
  if (state.conflict) for (const useGit of [true,false]) {
    const resolve=document.createElement('button'); resolve.textContent=useGit?'Use Git specifications':'Use graph specifications'
    resolve.onclick=async()=> { const captured=state!, conflict=captured.conflict!; if(captured.busy || !valid(app,captured) || !allowed(app,captured)) return; captured.busy=true
      try { const current=await invoke({cwd:selected.path,action:'status'}); if(!valid(app,captured) || current.revision!==conflict.revision) throw new Error('Git changed again. Refresh before resolving.')
        const specs=specificationRows(app.state.replica,selected.scope)
        const snapshot=useGit ? current : await invoke({cwd:selected.path,action:'save-specifications',expected:current.revision,specifications:specs})
        if(!valid(app,captured)) return
        if(useGit) app.importFeatureSpecifications(selected.scope,snapshot.specifications)
        if(snapshot.merged || conflict.merged) app.queueFeatureVerification(selected.scope,snapshot.head,snapshot.branch)
        captured.snapshot=snapshot; captured.disk=json(snapshot.specifications); captured.graph=json(specificationRows(app.state.replica,selected.scope)); captured.error=undefined; captured.conflict=undefined; remember(captured)
      } catch(error) { captured.error=String(error) } finally {captured.busy=false; app.refresh()} }
    box.append(resolve)
  }
  const branch = document.createElement('select'); branch.setAttribute('aria-label','Local Git branch'); for (const name of state.snapshot?.branches ?? []) branch.append(new Option(name,name)); branch.value = state.snapshot?.branch ?? ''; box.append(branch)
  const run = async (action: string, name: string) => {
    const captured = state!; clearTimeout(captured.timer)
    if (captured.busy || !valid(app,captured) || !allowed(app,captured)) return
    captured.busy = true
    try {
      let snapshot = await invoke({ cwd:selected.path, action:'status' })
      const specs = specificationRows(app.state.replica,selected.scope)
      if (!valid(app,captured)) return
      if (json(snapshot.specifications) !== captured.disk) throw new Error('Git specifications changed. Refresh before changing branches.')
      if (json(snapshot.specifications) !== json(specs)) snapshot = await invoke({ cwd:selected.path, action:'save-specifications', expected:snapshot.revision, specifications:specs })
      snapshot = await invoke({ cwd:selected.path, action, branch:name, expected:snapshot.revision })
      if (!valid(app,captured)) return
      if (pendingBranch(app,snapshot)) return
      app.importFeatureSpecifications(selected.scope,snapshot.specifications)
      if (snapshot.merged) app.queueFeatureVerification(selected.scope,snapshot.head,snapshot.branch)
      captured.snapshot=snapshot; captured.disk=json(snapshot.specifications); captured.graph=json(specificationRows(app.state.replica,selected.scope)); captured.error=undefined; remember(captured)
    } catch(error) { captured.error=String(error) } finally { captured.busy=false; if(valid(app,captured)) { app.refresh(); captured.timer=setTimeout(()=>void sync(app,captured),3000) } }
  }
  for (const [label,action] of [['Switch branch','switch'],['Merge branch','merge'],['Create branch','create-branch']]) { const b=document.createElement('button'); b.textContent=label!; b.disabled=state.busy || !state.snapshot || !allowed(app,state); b.onclick=()=> { const name=action==='create-branch'?window.prompt('New branch name'):branch.value; if(name) void run(action!,name) }; box.append(b) }
  const verify=document.createElement('button'); verify.textContent='Verify specifications'; verify.disabled=state.busy || !state.snapshot?.head || state.snapshot.dirty || !allowed(app,state); verify.onclick=()=>verifyDialog(app,state!); box.append(verify)
  return box
}

/** Explicit user action; merge detection never calls this launcher. */
export function canVerifySpecifications(app:App,path:Scope):boolean {
  const linked=inTauri() && binding(app,path)
  return !!linked && specificationRows(app.state.replica,linked.scope).length>0
}
export async function openSpecificationVerification(app:App,path:Scope):Promise<void> {
  try {
    app.goTo(path)
    localGitControls(app)
    const state=states.get(app)
    if (!state) throw new Error('Attach a local Git peer first.')
    for(let count=0;state.busy && count<200;count++) await new Promise(resolve=>setTimeout(resolve,50))
    if (state.busy || !valid(app,state) || !allowed(app,state)) throw new Error('The repository is busy or unavailable.')
    await sync(app,state)
    if (!valid(app,state) || !state.snapshot || state.error) throw new Error(state.error ?? 'Repository state is unavailable.')
    if (!state.snapshot.head || state.snapshot.dirty) throw new Error('Commit working-tree changes before verifying specifications.')
    verifyDialog(app,state)
  } catch(error) { app.notify('error',String(error)) }
}
