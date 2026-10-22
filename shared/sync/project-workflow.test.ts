import { installTestObservers } from './test-helpers'
import { createReplica as bareReplica, addTask, bindRepository, configureProjectWorkflow, createBranch, enqueueWorkflowJob, projectWorkflows, workflowPath, readNodeValue, WORKFLOW_JOB, loadReplica as bareLoadReplica, serializeReplica, selectBranch, renameTask, addRow, TEMPLATE_TYPE, setNodeTrigger, watchedRefValue, triggerOccurrence, nodeTrigger, runNodeTriggers, triggerState, view, type ProjectWorkflow } from './index'
import { ensureHomeContext, shareHome, HOME_ID, withBranches, writeNodeValue, repositoryAt, workflowTriggerPath, mergeBranch, workflowText } from './index'
import { syncWith } from './test-helpers'
import { AGENT_REQUEST, agentRequest, validateAgentRequest } from './index'

test('agent requests are bound graph data; adapter constraints are checked before dispatch', () => {
  let { r, config } = fixture()
  // A different graph-authored request needs no new workflow kind or native handler.
  r = addTask(r, config.project, 'Explain this project', 4, 'explain')
  r = writeNodeValue(r, [...config.project, 'explain'], AGENT_REQUEST, { provider: '{{coding-agent}}', prompt: '{{verification-instructions}}', readOnly: true, branch: '{{main-branch}}' }, 5)
  const request = agentRequest(r, config, [...config.project, 'explain'])
  expect(request.provider).toBe('codex')
  expect(request.prompt).toContain(config.url)
  const queued = enqueueWorkflowJob(r, config, { request, scope: config.project }, 6)
  expect(readNodeValue(queued.replica, queued.path, WORKFLOW_JOB)).toMatchObject({ request, branch: 'main', status: 'queued' })
  expect(() => validateAgentRequest(config, { ...request, readOnly: false }, 'main')).toThrow(/worktree/)
  expect(() => validateAgentRequest(config, { ...request, worktree: true }, 'main')).toThrow(/branch/)
  expect(() => validateAgentRequest(config, { ...request, deployment: { environment: 'other' } }, 'main')).toThrow(/environment/)
  expect(() => validateAgentRequest(config, { ...request, provider: 'claude' }, 'main')).toThrow(/Invalid agent request/)
  expect(() => validateAgentRequest(config, { ...request, chrome: true }, 'main')).toThrow(/Chrome/)
})

test('phone edits and execution requests travel through the account to desktop and claims return to phone', () => {
  const account = ensureHomeContext(createReplica('user:alice'), 0)
  const device = (id: string) => shareHome(ensureHomeContext(createReplica(id), 0))
  let desktop = addTask(device('desktop'), [HOME_ID], 'Project', 1, 'project')
  const project = [HOME_ID, 'project']
  desktop = bindRepository(desktop, project, 'acme/project', 2)
  const config: ProjectWorkflow = { ...fixture().config, project }
  desktop = configureProjectWorkflow(desktop, config, 3)
  desktop = syncWith(desktop, account, { now: 4 })
  let phone = syncWith(device('phone'), account, { now: 5 })
  expect(projectWorkflows(phone)[0]?.config).toEqual(config)
  expect(repositoryAt(phone, project)).toBe(config.repo)
  expect(workflowText(phone, project, 'verification-instructions')).toContain(config.url)
  phone = createBranch(phone, project, 'phone-feature', 6)
  phone = addTask(phone, project, 'Instructions just added on the phone', 7, 'phone-note')
  const queued = enqueueWorkflowJob(phone, config, { request: { provider: 'codex', prompt: 'Implement the notes', worktree: true }, scope: project, id: 'phone-request' }, 8)
  phone = syncWith(queued.replica, account, { now: 9 })
  desktop = syncWith(desktop, account, { now: 10 })
  expect(readNodeValue(desktop, queued.path, WORKFLOW_JOB)).toMatchObject({ branch: 'phone-feature', status: 'queued' })
  expect(withBranches(desktop.store, { project: 'phone-feature' }, () => view(desktop, [...project, 'phone-note'])?.name)).toBe('Instructions just added on the phone')
  desktop = writeNodeValue(desktop, queued.path, WORKFLOW_JOB, { ...readNodeValue<object>(desktop, queued.path, WORKFLOW_JOB), status: 'starting' }, 11)
  desktop = syncWith(desktop, account, { now: 12 })
  phone = syncWith(phone, account, { now: 13 })
  expect(readNodeValue(phone, queued.path, WORKFLOW_JOB)).toMatchObject({ status: 'starting' })
})

test('library data observes Fos merges, independently of GitHub or direct edits', async () => {
  let { r, config } = fixture()
  const path = workflowTriggerPath(r, config.project)!, signal = config.project
  expect(path).not.toBeNull()
  expect(nodeTrigger(r, path)?.watch).toMatchObject({ path: signal, branch: 'main', merges: true })
  r = addTask(r, config.project, 'Direct main edit', 4, 'main-note')
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 10, available: () => true, evaluate: async (target: string[]) => {
    expect(view(r, target)?.tasks.some(row => row.requirement?.tool === 'fos.agent')).toBe(true)
    runs++
  } }
  r = createBranch(r, config.project, 'feature', 5)
  r = addTask(r, config.project, 'Only a feature note edit', 5, 'note')
  await runNodeTriggers(driver); expect(runs).toBe(0)
  r = writeNodeValue(r, [], 'external-status', { state: 'merged' }, 6)
  await runNodeTriggers(driver); expect(runs).toBe(0)
  r = mergeBranch(r, config.project, 'feature', 'main', 7)
  await runNodeTriggers(driver); expect(runs).toBe(1)
  r = loadReplica(serializeReplica(r))
  await runNodeTriggers(driver); expect(runs).toBe(1)
})

function fixture() {
  let r = addTask(createReplica('desktop'), [], 'Project', 1, 'project')
  r = bindRepository(r, ['project'], 'acme/project', 2)
  const config: ProjectWorkflow = { project: ['project'], repo: 'acme/project', device: 'desktop', provider: 'codex', main: 'main', url: 'https://app.example.test', environment: 'production', verifier: 'claude-desktop', enabled: true }
  r = configureProjectWorkflow(r, config, 3)
  return { r, config }
}
test('phone request remains discoverable on desktop main after a durable reload', () => {
  let { r, config } = fixture()
  expect(() => enqueueWorkflowJob(r, config, { request: { provider: 'codex', prompt: 'Implement the notes', worktree: true }, scope: ['project'] }, 4)).toThrow(/branch/)
  r = createBranch(r, ['project'], 'phone-feature', 4)
  r = addTask(r, ['project'], 'New phone instructions', 5, 'notes')
  const queued = enqueueWorkflowJob(r, config, { request: { provider: 'codex', prompt: 'Implement the notes', worktree: true }, scope: ['project'], id: 'request-1' }, 6)
  r = loadReplica(serializeReplica(queued.replica))
  selectBranch(r.store, 'project', 'main')
  expect(projectWorkflows(r)).toEqual([{ path: workflowPath(['project']), config }])
  expect(readNodeValue(r, queued.path, WORKFLOW_JOB)).toMatchObject({ status: 'queued', branch: 'phone-feature', scope: ['project'] })
  expect(enqueueWorkflowJob(r, config, { request: { provider: 'claude-desktop', prompt: 'Verify', readOnly: true, branch: 'main', deployment: { environment: 'production' } }, scope: ['project'], id: 'request-1' }, 7).replica).toBe(r)
  expect(() => enqueueWorkflowJob(r, config, { request: { provider: 'codex', prompt: 'Implement the notes', worktree: true }, scope: ['private'] }, 7)).toThrow(/inside/)
})
test('ref-change watches main independently of the displayed branch and cannot trigger itself', async () => {
  let { r } = fixture()
  r = createBranch(r, ['project'], 'phone-feature', 4)
  const path = [...workflowPath(['project']), 'watch']
  r = addRow(r, path.slice(0, -1), TEMPLATE_TYPE, 'Watch', 5, { id: 'watch' })
  r = setNodeTrigger(r, path, { kind: 'ref-change', peer: 'desktop', enabled: true, created: 6, watch: { path: ['project'], branch: 'main', baseline: watchedRefValue(r, ['project'], 'main')! } }, 6)
  expect(triggerOccurrence(r, path, nodeTrigger(r, path)!, 7)).toBeNull()
  r = renameTask(r, [], 'project', 'Feature edited', 7)
  expect(triggerOccurrence(r, path, nodeTrigger(r, path)!, 8)).toBeNull()
  selectBranch(r.store, 'project', 'main'); r = renameTask(r, [], 'project', 'Main changed', 8); selectBranch(r.store, 'project', 'phone-feature')
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 10, available: () => true, evaluate: async () => { runs++ } }
  await runNodeTriggers(driver); expect(runs).toBe(1)
  expect(view(r, ['project'])?.name).toBe('Feature edited')
  r = loadReplica(serializeReplica(r)); selectBranch(r.store, 'project', 'phone-feature')
  await runNodeTriggers(driver); expect(runs).toBe(1)
  expect(triggerState(r, path)?.status).toBe('finished')
  r = addRow(r, ['project'], TEMPLATE_TYPE, 'Unsafe watch', 10, { id: 'unsafe' })
  expect(() => setNodeTrigger(r, ['project', 'unsafe'], nodeTrigger(r, path)!, 11)).toThrow(/outside/)
  expect(watchedRefValue(r, ['project'], 'missing')).toBeNull()
})

function createReplica(id: string) { return installTestObservers(bareReplica(id), [id]) }
function loadReplica(data: Parameters<typeof bareLoadReplica>[0]) { const r = bareLoadReplica(data); return installTestObservers(r, [r.meta.peerId, 'desktop', 'device-a', 'device-b'], false) }
