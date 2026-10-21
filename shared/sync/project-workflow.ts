/** Project automation is ordinary graph configuration and durable requests, shared by phone and desktop. */
import { readNodeValue, writeNodeValue } from './evaluation'
import { addTask, headCid, instantiateTemplate, resolveRef, proposeRefAt, applyProposalAt, view, type Replica } from './replica'
import { ensureDeviceLibrary, BUNDLED_LIBRARY } from './library'
import { argumentRefs, resolveText } from './bindings'
import { repositoryAt } from './repository'
import { branchSelection, content, valueContent, put, isBranchChoice, newId, resolveScope, type Scope } from './graph'
import { bindTemplateTriggers, nodeTrigger } from './triggers'
import { bindRefInputs } from './refs'

export const AGENT_TOOL = 'fos.agent'
export const AGENT_REQUEST = 'fos:agent-request'
export const WORKFLOW_CONFIG = 'fos:project-workflow'
export const WORKFLOW_JOB = 'fos:workflow-job'
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
export const workflowPath = (project: Scope): Scope => [...project.slice(0, -1), `fos:workflow:${project.at(-1)}`]
export function projectWorkflow(r: Replica, project: Scope): ProjectWorkflow | null {
  const path = workflowPath(project), config = readNodeValue<ProjectWorkflow>(r, path, WORKFLOW_CONFIG)
  if (!config) return null
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
  const path = workflowPath(project)
  const row = view(r, path)?.tasks.find(row => !!nodeTrigger(r, [...path, row.id]))
  return row ? [...path, row.id] : null
}
export function workflowText(r: Replica, project: Scope, name: string): string {
  const path = workflowPath(project), cid = resolveScope(r.store, headCid(r), path)
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
  const path = workflowPath(config.project)
  r = ensureDeviceLibrary(r, BUNDLED_LIBRARY, now)
  if (!view(r, path)) r = addTask(r, path.slice(0, -1), `${view(r, config.project)?.name || config.repo} workflow`, now, path.at(-1)!)
  if (!workflowTriggerPath(r, config.project)) {
    if (!resolveRef(r, WORKFLOW_TEMPLATE)) throw new Error('Update the standard library to load the project workflow template.')
    r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, WORKFLOW_TEMPLATE, now)
  }
  for (const [name, value] of Object.entries({ repository: config.repo, 'deployment-url': config.url, 'deployment-environment': config.environment, 'main-branch': config.main, 'coding-agent': config.provider, 'verification-agent': config.verifier })) {
    const cid = resolveScope(r.store, headCid(r), path)!, arg = argumentRefs(r.store, cid).find(a => a.name === name)
    if (!arg) throw new Error(`The workflow template is missing ${name}.`)
    const at = [...path, content(r.store, arg.cid).data.alias!.id]
    const proposed = proposeRefAt(r, at, put(r.store, { data: { description: { content: value } }, children: [] }), r.meta.peerId, now)
    r = applyProposalAt(proposed.replica, at, proposed.proposalCid, r.meta.peerId, now)
  }
  r = bindTemplateTriggers(r, path, { project: config.project, desktop: config.device, 'main-branch': config.main }, now)
  return writeNodeValue(r, path, WORKFLOW_CONFIG, config, now)
}
export function selectedProjectBranch(r: Replica, project: Scope, fallback: string): string {
  const cid = resolveScope(r.store, headCid(r), project)
  return cid && isBranchChoice(r.store, content(r.store, cid)) ? branchSelection(r.store, cid) : fallback
}
export function agentRequest(r: Replica, config: ProjectWorkflow, at: Scope): AgentRequest {
  const declaration = readNodeValue(r, at, AGENT_REQUEST)
  if (!declaration) throw new Error('The agent requirement is missing its request bindings.')
  const path = workflowPath(config.project), cid = resolveScope(r.store, headCid(r), path)!
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
  const id = input.id ?? newId(), path = [...workflowPath(config.project), id]
  if (readNodeValue(r, path, WORKFLOW_JOB)) return { replica: r, path }
  r = addTask(r, path.slice(0, -1), `${input.request.provider}: ${branch}`, now, id)
  const job: WorkflowJob = { id, request: input.request, scope: input.scope, branch, requested: now, status: 'queued', ...(input.commit ? { commit: input.commit } : {}) }
  return { replica: writeNodeValue(r, path, WORKFLOW_JOB, job, now), path }
}
/** Only loaded, accepted rows are jobs; open proposals and linked foreign subtrees are never launched. */
export function projectWorkflows(r: Replica): Array<{ path: Scope; config: ProjectWorkflow }> {
  const result: Array<{ path: Scope; config: ProjectWorkflow }> = []; let count = 0
  const walk = (path: Scope) => {
    if (path.length > 32 || count++ > 5000) return
    const config = readNodeValue<ProjectWorkflow>(r, path, WORKFLOW_CONFIG)
    if (config && Array.isArray(config.project)) { result.push({ path, config: projectWorkflow(r, config.project) ?? config }); return }
    for (const row of view(r, path)?.tasks ?? []) if (!row.refId && !row.construction && !row.supply && row.id !== 'fos:library') walk([...path, row.id])
  }
  walk([]); return result
}
