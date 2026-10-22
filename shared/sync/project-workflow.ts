/**
 * Project automation is ordinary graph configuration and durable requests, shared by phone and desktop. A project's
 * workflow is an instance of the workflow template beside the project, started for it: its configuration is what it
 * was started for (its execution origin) and the template's parameters. Each job is a row of it, whose state is its
 * handler result; what an agent requirement asks is that row's request.
 */
import { executionOrigin, executionRequest, handlerResult, writeExecutionOrigin, writeHandlerResult } from './evaluation'
import { addTask, headCid, instantiateTemplate, resolveRef, proposeRefAt, applyProposalAt, view, type Replica } from './replica'
import { ensureDeviceLibrary, BUNDLED_LIBRARY } from './library'
import { argumentRefs, resolveText } from './bindings'
import { repositoryAt } from './repository'
import { branchSelection, content, valueContent, put, isBranchChoice, isLibraryRef, newId, resolveScope, type Scope } from './graph'
import { bindTemplateTriggers, nodeTrigger } from './triggers'
import { bindRefInputs } from './refs'

export const AGENT_TOOL = 'fos.agent'
export const WORKFLOW_TEMPLATE = 'lib:project-agent-workflow'
export const CODING_TEMPLATE = 'lib:project-coding-request'
export type ProjectWorkflow = {
  project: Scope; repo: string; device: string; provider: 'claude' | 'codex'; main: string
  url: string; environment: string; verifier: 'claude' | 'claude-desktop'; enabled: boolean
}
/** The native agent adapter's inputs. The library composes these into workflows. */
export type AgentRequest = {
  provider: 'claude' | 'codex' | 'claude-desktop'; prompt: string
  branch?: string; worktree?: boolean; readOnly?: boolean; chrome?: boolean
  deployment?: { environment: string }
}
export type WorkflowJob = {
  id: string; request: AgentRequest; branch: string; requested: number
  scope: Scope; status: 'queued' | 'starting' | 'launched' | 'failed' | 'handoff'
  commit?: string; error?: string; directory?: string
}
const sameScope = (a: Scope, b: Scope) => a.length === b.length && a.every((id, i) => b[i] === id)
const isWorkflowConfig = (value: unknown): value is ProjectWorkflow => !!value && typeof value === 'object' && Array.isArray((value as ProjectWorkflow).project) && typeof (value as ProjectWorkflow).repo === 'string'
/** The workflow started for `project`: the row beside it whose execution origin is a workflow configuration for it. */
export function workflowAt(r: Replica, project: Scope): Scope | null {
  const parent = project.slice(0, -1)
  for (const row of view(r, parent)?.tasks ?? []) {
    const origin = executionOrigin<ProjectWorkflow>(r, [...parent, row.id])
    if (isWorkflowConfig(origin) && sameScope(origin.project, project)) return [...parent, row.id]
  }
  return null
}
/** A job of a workflow: the state its runner keeps on the job's row. */
export function workflowJob(r: Replica, path: Scope): WorkflowJob | null {
  const job = handlerResult<WorkflowJob>(r, path)
  return job && typeof job === 'object' && typeof job.id === 'string' && typeof job.status === 'string' && !!job.request ? job : null
}
export function writeWorkflowJob(r: Replica, path: Scope, job: WorkflowJob, now: number): Replica {
  return writeHandlerResult(r, path, job, now)
}
export function projectWorkflow(r: Replica, project: Scope): ProjectWorkflow | null {
  const path = workflowAt(r, project)
  const config = path ? executionOrigin<ProjectWorkflow>(r, path) : null
  if (!path || !isWorkflowConfig(config)) return null
  const cid = resolveScope(r.store, headCid(r), path)!
  const fields = argumentRefs(r.store, cid)
  const text = (name: string, fallback: string) => { const arg = fields.find(a => a.name === name); return arg ? valueContent(r.store, arg.cid).data.description?.content ?? fallback : fallback }
  return { ...config, repo: text('repository', config.repo), url: text('deployment-url', config.url), environment: text('deployment-environment', config.environment), main: text('main-branch', config.main), provider: text('coding-agent', config.provider) as ProjectWorkflow['provider'], verifier: text('verification-agent', config.verifier) as ProjectWorkflow['verifier'] }
}
export function workflowDefault(r: Replica, name: string): string {
  const template = resolveRef(r, WORKFLOW_TEMPLATE)
  if (!template) return ''
  const cid = resolveScope(r.store, headCid(r), [...template.path, template.row.id])!
  const arg = argumentRefs(r.store, cid).find(a => a.name === name)
  return arg ? valueContent(r.store, arg.cid).data.description?.content ?? '' : ''
}
export function workflowTriggerPath(r: Replica, project: Scope): Scope | null {
  const path = workflowAt(r, project)
  const row = path && view(r, path)?.tasks.find(row => !!nodeTrigger(r, [...path, row.id]))
  return row && path ? [...path, row.id] : null
}
export function workflowText(r: Replica, project: Scope, name: string): string {
  const path = workflowAt(r, project), cid = path && resolveScope(r.store, headCid(r), path)
  const arg = cid && argumentRefs(r.store, cid).find(a => a.name === name)
  if (!arg) throw new Error(`The workflow template is missing ${name}.`)
  const text = valueContent(r.store, arg.cid).data.description?.content ?? ''
  const result = resolveText(r, path, text)
  if (result.bindings.some(b => b.status !== 'ready')) throw new Error(`Fill the bindings in ${name} before execution.`)
  return result.text
}
export function configureProjectWorkflow(r: Replica, config: ProjectWorkflow, now: number): Replica {
  if (!config.project.length || repositoryAt(r, config.project) !== config.repo) throw new Error('Connect the project node to this GitHub repository first.')
  if (!config.device || !['claude', 'codex'].includes(config.provider) || !['claude', 'claude-desktop'].includes(config.verifier) || !config.main.trim() || !config.environment.trim()) throw new Error('Choose the desktop, agents, main branch and deployment environment.')
  const url = new URL(config.url)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) deployment URL without credentials.')
  r = ensureDeviceLibrary(r, BUNDLED_LIBRARY, now)
  let path = workflowAt(r, config.project)
  if (!path) {
    if (!resolveRef(r, WORKFLOW_TEMPLATE)) throw new Error('Update the standard library to load the project workflow template.')
    path = [...config.project.slice(0, -1), newId()]
    r = addTask(r, path.slice(0, -1), `${view(r, config.project)?.name || config.repo} workflow`, now, path.at(-1)!)
    r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, WORKFLOW_TEMPLATE, now)
    r = writeExecutionOrigin(r, path, config, now)
  }
  for (const [name, value] of Object.entries({ repository: config.repo, 'deployment-url': config.url, 'deployment-environment': config.environment, 'main-branch': config.main, 'coding-agent': config.provider, 'verification-agent': config.verifier })) {
    const cid = resolveScope(r.store, headCid(r), path)!, arg = argumentRefs(r.store, cid).find(a => a.name === name)
    if (!arg) throw new Error(`The workflow template is missing ${name}.`)
    const at = [...path, content(r.store, arg.cid).data.alias!.id]
    const proposed = proposeRefAt(r, at, put(r.store, { data: { description: { content: value } }, children: [] }), r.meta.peerId, now)
    r = applyProposalAt(proposed.replica, at, proposed.proposalCid, r.meta.peerId, now)
  }
  r = bindTemplateTriggers(r, path, { project: config.project, desktop: config.device, 'main-branch': config.main }, now)
  return writeExecutionOrigin(r, path, config, now)
}
export function selectedProjectBranch(r: Replica, project: Scope, fallback: string): string {
  const cid = resolveScope(r.store, headCid(r), project)
  return cid && isBranchChoice(r.store, content(r.store, cid)) ? branchSelection(r.store, cid) : fallback
}
export function agentRequest(r: Replica, config: ProjectWorkflow, at: Scope): AgentRequest {
  const declaration = executionRequest(r, at)
  if (!declaration) throw new Error('The agent requirement is missing its request bindings.')
  const path = workflowAt(r, config.project)
  if (!path) throw new Error('Configure the project workflow first.')
  const cid = resolveScope(r.store, headCid(r), path)!
  const bindings = Object.fromEntries(argumentRefs(r.store, cid).filter(arg => arg.name).map(arg => [arg.name!, workflowText(r, config.project, arg.name!)]))
  return bindRefInputs(declaration, bindings) as AgentRequest
}
/** Validate synced requests before any local side effect, including requests written without the UI. */
export function validateAgentRequest(config: ProjectWorkflow, request: AgentRequest, branch: string): void {
  if (typeof branch !== 'string' || !branch.trim()) throw new Error('Invalid agent branch.')
  if (!request || ![config.provider, config.verifier].includes(request.provider as ProjectWorkflow['provider']) || !['claude', 'codex', 'claude-desktop'].includes(request.provider) || typeof request.prompt !== 'string' || !request.prompt.trim()) throw new Error('Invalid agent request.')
  for (const key of ['worktree', 'readOnly', 'chrome'] as const) if (request[key] !== undefined && typeof request[key] !== 'boolean') throw new Error(`Invalid agent ${key} input.`)
  if (request.branch !== undefined && (typeof request.branch !== 'string' || request.branch !== branch)) throw new Error('Invalid agent branch.')
  if (request.worktree && branch === config.main) throw new Error('Create a project branch before requesting a worktree agent.')
  if (request.provider === 'claude-desktop' && (!request.readOnly || request.worktree)) throw new Error('Desktop chat handoffs require a read-only request without a worktree.')
  if (request.chrome && request.provider === 'codex') throw new Error('This agent does not support the Chrome adapter.')
  if (request.deployment && (request.deployment.environment !== config.environment || branch !== config.main || !request.readOnly)) throw new Error('Deployment requests must read the configured environment and main branch.')
  if (!request.readOnly && !request.worktree) throw new Error('Writable agent requests require an isolated worktree.')
}
export function enqueueWorkflowJob(r: Replica, config: ProjectWorkflow, input: Pick<WorkflowJob, 'request' | 'scope'> & { commit?: string; id?: string }, now: number): { replica: Replica; path: Scope } {
  if (!config.enabled) throw new Error('Enable the project workflow first.')
  if (!config.project.every((id, i) => input.scope[i] === id)) throw new Error('The request must be inside its project.')
  const branch = input.request.branch ?? selectedProjectBranch(r, config.project, config.main)
  validateAgentRequest(config, input.request, branch)
  const workflow = workflowAt(r, config.project)
  if (!workflow) throw new Error('Configure the project workflow first.')
  const id = input.id ?? newId(), path = [...workflow, id]
  if (workflowJob(r, path)) return { replica: r, path }
  r = addTask(r, path.slice(0, -1), `${input.request.provider}: ${branch}`, now, id)
  const job: WorkflowJob = { id, request: input.request, scope: input.scope, branch, requested: now, status: 'queued', ...(input.commit ? { commit: input.commit } : {}) }
  return { replica: writeWorkflowJob(r, path, job, now), path }
}
/** Only loaded, accepted rows are jobs; open proposals and linked foreign subtrees are never launched. */
export function projectWorkflows(r: Replica): Array<{ path: Scope; config: ProjectWorkflow }> {
  const result: Array<{ path: Scope; config: ProjectWorkflow }> = []; let count = 0
  const walk = (path: Scope) => {
    if (path.length > 32 || count++ > 5000) return
    const config = executionOrigin<ProjectWorkflow>(r, path)
    if (isWorkflowConfig(config)) { result.push({ path, config: projectWorkflow(r, config.project) ?? config }); return }
    for (const row of view(r, path)?.tasks ?? []) {
      const cid = resolveScope(r.store, headCid(r), [...path, row.id])
      if (!row.refId && !row.construction && !row.supply && !(cid && isLibraryRef(content(r.store, cid)))) walk([...path, row.id])
    }
  }
  walk([]); return result
}
