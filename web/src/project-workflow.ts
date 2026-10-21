import type { App } from './app'
import {
  WORKFLOW_CONFIG, WORKFLOW_JOB, configureProjectWorkflow, enqueueWorkflowJob, projectWorkflow, projectWorkflows, workflowPath,
  CODING_TEMPLATE, agentRequest, validateAgentRequest, workflowTriggerPath, workflowDefault, instantiateTemplate, addTask,
  readNodeValue, writeNodeValue, addRow, addMemberAt, setMemberCapabilitiesAt,
  withBranches, view, ALLOCATION_TYPE,
  type ProjectWorkflow, type WorkflowJob, type Replica, type Scope
} from '../../shared/sync/index'
import { agentContext, agentPeerId, launchAgent, localRepository } from './agents'
import { inTauri, tauriInvoke } from './project'
import { readRepositoryDeployment } from './api'
import { hashContent, parseCid } from '../../shared/dag-implementation/cid'

const authorizationKey = (app: App, config: ProjectWorkflow) => `fos.workflow:${app.state.replica.meta.peerId}:${JSON.stringify(config.project)}`
function authorization(app: App, config: ProjectWorkflow): string | null {
  if (JSON.stringify(projectWorkflow(app.state.replica, config.project)) !== JSON.stringify(config)) return null
  try { const saved = JSON.parse(localStorage.getItem(authorizationKey(app, config)) ?? 'null'); return saved?.config === JSON.stringify(config) && typeof saved.directory === 'string' ? saved.directory : null } catch { return null }
}
export function workflowForScope(r: Replica, scope: Scope): ProjectWorkflow | null {
  for (let depth = scope.length; depth > 0; depth--) { const config = projectWorkflow(r, scope.slice(0, depth)); if (config) return config }
  return projectWorkflows(r).find(w => w.path.every((id, i) => scope[i] === id))?.config ?? null
}
export function queueAgentEffect(r: Replica, scope: Scope, operation: string, now: number): Replica {
  const config = workflowForScope(r, scope)
  if (!config) throw new Error('Configure the project workflow before requesting a coding agent.')
  const id = `agent-${parseCid(hashContent({ data: { description: { content: operation } }, children: [] }))!.digest}`
  return enqueueWorkflowJob(r, config, { request: agentRequest(r, config, scope), scope: config.project.every((id, i) => scope[i] === id) ? scope : config.project, id }, now).replica
}
function onBranch<T>(r: Replica, project: Scope, branch: string, fn: () => T): T {
  const row = view(r, project.slice(0, -1))?.tasks.find(row => row.id === project.at(-1))
  if (!row || row.branches && !row.branches.names.includes(branch)) throw new Error('The requested project branch is unavailable.')
  return withBranches(r.store, { [project.at(-1)!]: branch }, fn)
}

/** UI setup grants this computer permission to launch requests for exactly this project configuration. */
export function configureWorkflowDialog(app: App, project: Scope): void {
  const info = app.repositoryInfo(project)
  if (!info) return
  const previous = projectWorkflow(app.state.replica, project), dialog = document.createElement('dialog')
  dialog.className = 'constructor-dialog'
  const heading = document.createElement('h3'); heading.textContent = 'Project agent workflow'
  const explanation = document.createElement('p'); explanation.textContent = 'Save on the computer that will run agents. Keep Fos open and signed in there. Your phone can then request coding on a project branch. Tool approvals remain in the agent terminal. Verification waits for a successful GitHub deployment in the configured environment.'
  const field = (title: string, value: string) => {
    const label = document.createElement('label'), input = document.createElement('input'); input.value = value; input.setAttribute('aria-label', title); label.append(title, input); dialog.append(label); return input
  }
  dialog.append(heading, explanation)
  field('GitHub repository', info.repo).readOnly = true
  const directory = field('Local repository directory', previous && authorization(app, previous) || localRepository(app.state.replica, project) || app.projectDirectory() || '')
  const main = field('Main branch', previous?.main ?? info.snapshot?.defaultBranch ?? workflowDefault(app.state.replica, 'main-branch'))
  const url = field('Deployment URL', previous?.url ?? '')
  const environment = field('GitHub deployment environment', previous?.environment ?? workflowDefault(app.state.replica, 'deployment-environment'))
  const provider = document.createElement('select'); provider.setAttribute('aria-label', 'Coding agent')
  for (const [id, title] of [['claude', 'Claude Code'], ['codex', 'Codex']]) provider.append(new Option(title, id))
  provider.value = previous?.provider ?? app.state.localAgents[0]?.provider ?? workflowDefault(app.state.replica, 'coding-agent')
  const verifier = document.createElement('select'); verifier.setAttribute('aria-label', 'Verification agent')
  verifier.append(new Option('Claude Desktop — open prompt, send in Desktop', 'claude-desktop'), new Option('Claude Code with Chrome', 'claude'))
  verifier.value = previous?.verifier ?? workflowDefault(app.state.replica, 'verification-agent')
  const status = document.createElement('p'); status.setAttribute('role', 'status')
  const save = document.createElement('button'); save.textContent = 'Save and enable on this computer'; save.disabled = !inTauri()
  if (!inTauri()) status.textContent = 'Open this project on the Fos desktop app to enable its agent runner.'
  save.onclick = async () => {
    save.disabled = true
    try {
      if (!app.state.session || app.state.session.kind !== 'user') throw new Error('Sign in to Fos first.')
      if (!app.state.localAgents.some(a => a.provider === provider.value)) throw new Error('Install and sign in to the selected coding agent first, then restart Fos.')
      if (!directory.value.trim()) throw new Error('Choose the local repository directory.')
      const config: ProjectWorkflow = { project, repo: info.repo, device: app.state.replica.meta.peerId, provider: provider.value as ProjectWorkflow['provider'], main: main.value.trim(), url: url.value.trim(), environment: environment.value.trim(), verifier: verifier.value as ProjectWorkflow['verifier'], enabled: true }
      let r = configureProjectWorkflow(app.state.replica, config, app.now())
      const path = workflowPath(project)
      const peer = agentPeerId(config.provider)
      // These grants are the ones the setup button explicitly enables; agents still submit proposals for review.
      r = addMemberAt(r, project, peer, provider.selectedOptions[0]!.text, ['read', 'edit'], app.now())
      r = addMemberAt(r, path, config.device, app.state.deviceName, [], app.now())
      r = setMemberCapabilitiesAt(r, path, config.device, [], [], app.now(), ['ref-change'])
      await app.saveWorkflowReplica(r)
      localStorage.setItem(authorizationKey(app, config), JSON.stringify({ config: JSON.stringify(config), directory: directory.value.trim() }))
      dialog.close(); app.notify('info', 'Workflow enabled. Create a project branch, update notes and tasks, then request a coding agent.')
    } catch (error) { status.textContent = String(error); save.disabled = false }
  }
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close()
  dialog.append(provider, verifier, save, status, close); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal()
}

export async function requestProjectCoding(app: App, project: Scope): Promise<void> {
  try {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    const config = projectWorkflow(app.state.replica, project)
    if (!config?.enabled) throw new Error('Configure this project workflow on your desktop first.')
    const id = crypto.randomUUID(), path = [...project, id]
    let r = addTask(app.state.replica, project, 'Request coding agent', app.now(), id)
    r = instantiateTemplate(r, project, id, CODING_TEMPLATE, app.now())
    await app.saveWorkflowReplica(r)
    await app.evaluateAt(path)
  } catch (error) { app.notify('error', String(error)) }
}

const busy = new WeakSet<App>(), nextPoll = new WeakMap<App, number>()
export function workflowStatus(app: App): HTMLElement | null {
  const path = app.state.view, config = readNodeValue<ProjectWorkflow>(app.state.replica, path, WORKFLOW_CONFIG)
  if (!config) return null
  const box = document.createElement('section'), title = document.createElement('p')
  title.textContent = `${config.repo} · ${config.enabled ? 'Enabled' : 'Paused'} · desktop ${config.device}`; box.append(title)
  const settings = document.createElement('button'); settings.textContent = 'Configure workflow'; settings.onclick = () => configureWorkflowDialog(app, config.project); box.append(settings)
  if (config.enabled) {
    const pause = document.createElement('button'); pause.textContent = 'Pause workflow'
    pause.onclick = async () => {
      let r = writeNodeValue(app.state.replica, path, WORKFLOW_CONFIG, { ...config, enabled: false }, app.now())
      const triggerPath = workflowTriggerPath(r, config.project), trigger = triggerPath && readNodeValue<object>(r, triggerPath, 'fos:trigger')
      if (trigger && triggerPath) r = writeNodeValue(r, triggerPath, 'fos:trigger', { ...trigger, enabled: false }, app.now())
      await app.saveWorkflowReplica(r)
    }
    box.append(pause)
  }
  if (inTauri() && config.device === app.state.replica.meta.peerId && !authorization(app, config)) {
    const help = document.createElement('p'); help.textContent = 'Save this configuration on this computer to authorize launches.'; box.append(help)
  }
  for (const row of view(app.state.replica, path)?.tasks ?? []) {
    const at = [...path, row.id], job = readNodeValue<WorkflowJob>(app.state.replica, at, WORKFLOW_JOB)
    if (!job) continue
    const item = document.createElement('p')
    item.textContent = `${row.title}: ${job.status}${job.request?.deployment && job.status === 'queued' ? ` — waiting for successful ${config.environment} deployment` : ''}${job.status === 'handoff' ? ' — send the prompt and enable Chrome in Claude Desktop' : ''}${job.error ? ` — ${job.error}` : ''}`
    if (job.status === 'failed' || job.status === 'starting') {
      const retry = document.createElement('button'); retry.textContent = 'Retry after review'
      retry.onclick = async () => {
        if (!window.confirm('Check the desktop terminal and worktree first. A previous agent may still be running. Create a new request?')) return
        const id = crypto.randomUUID()
        let r = addRow(app.state.replica, path, ALLOCATION_TYPE, `Retry ${row.title}`, app.now(), { id })
        r = writeNodeValue(r, [...path, id], WORKFLOW_JOB, { ...job, id, status: 'queued', error: undefined, directory: undefined, requested: app.now() }, app.now())
        await app.saveWorkflowReplica(r)
      }
      item.append(retry)
    }
    box.append(item)
  }
  return box
}
export async function runProjectWorkflows(app: App): Promise<void> {
  if (!inTauri() || busy.has(app) || !app.workflowReady || !navigator.locks || app.now() < (nextPoll.get(app) ?? 0)) return
  busy.add(app); nextPoll.set(app, app.now() + 5000)
  const store = app.state.replica.store, session = app.state.session
  const valid = () => app.state.replica.store === store && app.state.session === session
  try {
    await navigator.locks.request(`fos:workflow:${app.state.replica.meta.peerId}`, { ifAvailable: true }, async lock => {
      if (!lock || !session || session.kind !== 'user') return
      for (const { path, config } of projectWorkflows(app.state.replica)) {
        const directory = authorization(app, config)
        if (!valid() || !config.enabled || config.device !== app.state.replica.meta.peerId || !directory || view(app.state.replica, path)?.choices.length) continue
        for (const row of view(app.state.replica, path)?.tasks ?? []) {
          const at = [...path, row.id], job = readNodeValue<WorkflowJob>(app.state.replica, at, WORKFLOW_JOB)
          if (!job || job.status !== 'queued' || !app.workflowClaimAvailable(at) || view(app.state.replica, at)?.choices.length) continue
          let commit: string | undefined
          try {
            if (!Array.isArray(job.scope) || !config.project.every((id, i) => job.scope[i] === id)) throw new Error('Invalid project execution request.')
            validateAgentRequest(config, job.request, job.branch)
            if (job.request.deployment) {
              const deployment = await readRepositoryDeployment(session, config.repo, job.branch, job.request.deployment.environment)
              if (!valid() || !authorization(app, config)) return
              if (!deployment.ready) continue
              commit = deployment.sha
              if (readNodeValue(app.state.replica, path, `fos:verified-launch:${commit}`)) {
                await app.saveWorkflowReplica(writeNodeValue(app.state.replica, at, WORKFLOW_JOB, { ...job, commit, status: 'launched', error: 'Verification was already dispatched for this deployment.' }, app.now()))
                continue
              }
            }
            // Persist before starting any external process. An interrupted claim needs explicit review, never automatic replay.
            await app.saveWorkflowReplica(writeNodeValue(app.state.replica, at, WORKFLOW_JOB, { ...job, status: 'starting', ...(commit ? { commit } : {}) }, app.now()))
            if (!valid() || !authorization(app, config)) return
            const context = onBranch(app.state.replica, config.project, job.branch, () => agentContext(app.state.replica, config.project))
            let cwd = directory
            if (job.request.worktree) {
              const prepared = await tauriInvoke<{ cwd: string }>('local_git', { request: { action: 'agent-worktree', cwd: directory, repo: config.repo, branch: job.branch, id: job.id } })
              if (!valid() || !authorization(app, config)) return
              if (!prepared?.cwd) throw new Error('Could not prepare the agent worktree.')
              await app.saveWorkflowReplica(writeNodeValue(app.state.replica, at, WORKFLOW_JOB, { ...job, status: 'starting', directory: prepared.cwd }, app.now()))
              if (!valid() || !authorization(app, config)) return
              cwd = prepared.cwd
            }
            const prompt = `${job.request.prompt}\nRequested branch: ${job.branch}\n${job.request.worktree ? `Push target: refs/heads/${job.branch}\nThe worktree has an isolated local branch; MCP is bound to the requested project branch.\n` : ''}${commit ? `Deployed commit: ${commit}\n` : ''}Project context:\n${JSON.stringify(context.nodes).slice(0, 12000)}`
            if (job.request.provider === 'claude-desktop') {
              if (prompt.length > 12000) throw new Error('Context is too large for a Desktop chat link. Select a CLI agent.')
              await tauriInvoke('open_agent_link', { url: `claude://claude.ai/new?q=${encodeURIComponent(prompt)}` })
            } else await onBranch(app.state.replica, config.project, job.branch, () => launchAgent(app, job.request.provider as 'claude' | 'codex', { scope: config.project, branch: job.branch, cwd, prompt, chrome: job.request.chrome, verify: job.request.readOnly, throwErrors: true }))
            if (!valid() || !authorization(app, config)) return
            if (commit) await app.saveWorkflowReplica(writeNodeValue(app.state.replica, path, `fos:verified-launch:${commit}`, { job: job.id }, app.now()))
            if (!valid()) return
            const claimed = readNodeValue<WorkflowJob>(app.state.replica, at, WORKFLOW_JOB)!
            await app.saveWorkflowReplica(writeNodeValue(app.state.replica, at, WORKFLOW_JOB, { ...claimed, status: job.request.provider === 'claude-desktop' ? 'handoff' : 'launched' }, app.now()))
          } catch (error) {
            if (!valid()) return
            const current = readNodeValue<WorkflowJob>(app.state.replica, at, WORKFLOW_JOB) ?? job
            await app.saveWorkflowReplica(writeNodeValue(app.state.replica, at, WORKFLOW_JOB, { ...current, status: 'failed', error: String(error) }, app.now()))
          }
        }
      }
    })
  } finally { busy.delete(app) }
}
