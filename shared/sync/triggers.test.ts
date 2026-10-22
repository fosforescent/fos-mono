import { installTestObservers } from './test-helpers'
import { userView } from './test-helpers'
import { addTask, addRow, createReplica as bareReplica, cronMatches, setNodeTrigger, triggerState, runNodeTriggers, view, setTaskDone, renameTask, loadReplica as bareLoadReplica, serializeReplica, requestContinuation, triggerOccurrence, nodeTrigger, writeNodeValue, rejectProposalAt, dispatchEvent, addMemberAt, setMemberCapabilitiesAt, put, valueContent, resolveScope, headCid } from './index'
import { TEMPLATE_TYPE } from './library-types'
import { bindTemplateTriggers, TRIGGER_TEMPLATE_ARGUMENT } from './triggers'
import { readNodeValue } from './evaluation'

test('any graph template can declare and rebind a trigger without workflow-specific code', () => {
  let r = addTask(createReplica('device'), [], 'Observed node', 1, 'source')
  r = addRow(r, [], TEMPLATE_TYPE, 'User-defined continuation', 2, { id: 'template' })
  const declaration = { kind: 'ref-change', peer: '{{executor}}', enabled: true, created: 0, watch: { path: '{{input}}', branch: '{{branch}}', argument: 'user-event' } }
  r = writeNodeValue(r, ['template'], TRIGGER_TEMPLATE_ARGUMENT, declaration, 3)
  r = bindTemplateTriggers(r, ['template'], { executor: 'first-peer', input: ['source'], branch: 'main' }, 4)
  expect(nodeTrigger(r, ['template'])).toMatchObject({ peer: 'first-peer', watch: { path: ['source'], argument: 'user-event' } })
  r = bindTemplateTriggers(r, ['template'], { executor: 'second-peer', input: ['source'], branch: 'main' }, 5)
  expect(nodeTrigger(r, ['template'])?.peer).toBe('second-peer')
  expect(readNodeValue(r, ['template'], TRIGGER_TEMPLATE_ARGUMENT)).toEqual(declaration)
  expect(() => bindTemplateTriggers(r, ['template'], {}, 6)).toThrow(/Missing binding/)
})

test('UTC cron validates fields and handles ranges, steps and day OR semantics', () => {
  const now = Date.UTC(2026, 9, 14, 9, 15)
  expect(cronMatches('*/15 9 * * *', now)).toBe(true)
  expect(cronMatches('0 9 * * *', now)).toBe(false)
  expect(cronMatches('15 8-10 1 * 3', now)).toBe(true)
  expect(() => cronMatches('60 * * * *', now)).toThrow()
  expect(() => cronMatches('*/0 * * * *', now)).toThrow()
  expect(() => cronMatches('* * *', now)).toThrow()
})
test('timer belongs to one device, claims before running and does not replay after reload', async () => {
  let r = addRow(createReplica('device'), [], TEMPLATE_TYPE, 'Run', 0, { id: 'task' }), time = 10
  r = setNodeTrigger(r, ['task'], { kind: 'timer', peer: 'device', enabled: true, created: 0, due: 20 }, 0)
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => time, available: (id: string) => id === 'device', evaluate: async () => { expect(triggerState(r, ['task'])?.status).toBe('running'); runs++ } }
  await runNodeTriggers(driver); expect(runs).toBe(0)
  time = 20
  await runNodeTriggers({ ...driver, available: () => false }); expect(runs).toBe(0)
  await runNodeTriggers(driver); expect(runs).toBe(1)
  r = loadReplica(serializeReplica(r)); await runNodeTriggers(driver); expect(runs).toBe(1)
})
test('parent completion fires once; editing its title does not refire; reopening arms it again', async () => {
  let r = addTask(createReplica('device'), [], 'Parent', 1, 'parent')
  r = addRow(r, ['parent'], TEMPLATE_TYPE, 'After parent', 1, { id: 'child' })
  r = setNodeTrigger(r, ['parent', 'child'], { kind: 'task-completion', peer: 'device', enabled: true, created: 1 }, 1)
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 10, available: () => true, evaluate: async () => { runs++ } }
  await runNodeTriggers(driver); expect(runs).toBe(0)
  r = setTaskDone(r, [], 'parent', true, 2); await runNodeTriggers(driver); expect(runs).toBe(1)
  r = renameTask(r, [], 'parent', 'Renamed', 3); await runNodeTriggers(driver); expect(runs).toBe(1)
  r = setTaskDone(r, [], 'parent', false, 4); await runNodeTriggers(driver)
  r = setTaskDone(r, [], 'parent', true, 5); await runNodeTriggers(driver); expect(runs).toBe(2)
})
test('template triggers create an independent instance and failed runs do not spin', async () => {
  let r = addRow(createReplica('device'), [], TEMPLATE_TYPE, 'Workflow', 1, { id: 'template' })
  r = addTask(r, ['template'], 'Step', 1, 'step')
  r = setNodeTrigger(r, ['template'], { kind: 'timer', peer: 'device', enabled: true, created: 1, due: 2 }, 1)
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 3, available: () => true, evaluate: async (path: string[]) => { runs++; expect(path).not.toEqual(['template']); expect(view(r, path)!.tasks[0]!.title).toBe('Step'); throw new Error('Needs confirmation') } }
  await runNodeTriggers(driver); await runNodeTriggers(driver)
  expect(runs).toBe(1)
  expect(triggerState(r, ['template'])?.error).toBe('Needs confirmation')
  expect(userView(r)!.tasks).toHaveLength(2)
})

test('an incoming proposal fires the request trigger and its saved occurrence is not replayed', async () => {
  const { makeLinkAt, proposalContent, withProposal, commitRoot, updateAtScope, headCid, resolveScope, put, rowContent } = await import('./index')
  let r = makeLinkAt(addRow(createReplica('device'), [], TEMPLATE_TYPE, 'Inbox', 1, { id: 'inbox' }), ['inbox'], 1)
  r = setNodeTrigger(r, ['inbox'], { kind: 'request', peer: 'device', enabled: true, created: 2 }, 2)
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 10, available: () => true, evaluate: async () => { runs++ } }
  await runNodeTriggers(driver); expect(runs).toBe(0)
  const proposed = put(r.store, proposalContent(r.store, 'guest', 'request', put(r.store, rowContent('task', 'inbox', 'Requested change', 3)), resolveScope(r.store, headCid(r), ['inbox'])!, 3))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['inbox'], node => withProposal(r.store, node, 'guest', proposed, 'request'), 'node'), 3)
  await runNodeTriggers(driver); await runNodeTriggers(driver)
  expect(runs).toBe(1)
  expect(view(r, ['inbox'])!.proposals[0]!.status).toBe('open')
  const second = put(r.store, proposalContent(r.store, 'other', 'request', put(r.store, rowContent('task', 'inbox', 'Second request', 4)), resolveScope(r.store, headCid(r), ['inbox'])!, 4))
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['inbox'], node => withProposal(r.store, node, 'other', second, 'request'), 'node'), 4)
  await runNodeTriggers(driver); await runNodeTriggers(driver); expect(runs).toBe(2)
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['inbox'], node => withProposal(r.store, node, 'other', null, 'request'), 'node'), 5)
  await runNodeTriggers(driver); expect(runs).toBe(2) // the older still-open request must not reappear as a new event
})

test('changing the trigger reuses its argument row and switches its left observer', async () => {
  const { argumentRefs, capabilityTarget, matchesGraph, headCid, resolveScope } = await import('./index')
  let r = addRow(createReplica('device'), [], TEMPLATE_TYPE, 'Task', 1, { id: 'task' })
  r = setNodeTrigger(r, ['task'], { kind: 'timer', peer: 'device', enabled: true, created: 1, due: 10 }, 1)
  const args = () => argumentRefs(r.store, resolveScope(r.store, headCid(r), ['task'])!)
  expect(matchesGraph(r.store, capabilityTarget(r.store, 'timer'), args()[0]!.type)).toBe(true)
  r = setNodeTrigger(r, ['task'], { kind: 'request', peer: 'device', enabled: true, created: 2 }, 2)
  expect(args()).toHaveLength(1)
  expect(matchesGraph(r.store, capabilityTarget(r.store, 'request'), args()[0]!.type)).toBe(true)
})


test('child evaluation creates a fresh template instance for each completed parent execution', async () => {
  const { writeNodeValue } = await import('./index')
  let r = addTask(createReplica('device'), [], 'Parent', 1, 'parent')
  r = addRow(r, ['parent'], TEMPLATE_TYPE, 'Child workflow', 1, { id: 'child' })
  r = setNodeTrigger(r, ['parent', 'child'], { kind: 'task-completion', peer: 'device', enabled: true, created: 1 }, 1)
  const targets: string[][] = []
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 10, available: () => true, evaluate: async (path: string[]) => { targets.push(path) } }
  r = writeNodeValue(r, ['parent'], 'fos:evaluation', { id: 'one', status: 'committed', started: 2, effects: [] }, 3)
  await runNodeTriggers(driver); await runNodeTriggers(driver)
  expect(targets).toHaveLength(1)
  r = writeNodeValue(r, ['parent'], 'fos:evaluation', { id: 'two', status: 'committed', started: 4, effects: [] }, 5)
  await runNodeTriggers(driver)
  expect(targets).toHaveLength(2)
  expect(targets[0]).not.toEqual(targets[1])
  expect(() => setNodeTrigger(r, ['parent'], { kind: 'cron', peer: 'fos', enabled: true, created: 1, expression: '* * * * *' }, 1)).toThrow('This observer instantiates a template.')
})

test('a response trigger continues the requester when the asked peer commits or rejects', async () => {
  let r = addTask(createReplica('device-a'), [], 'Plan trip', 1, 'trip')
  r = addTask(r, [], 'Book flights', 1, 'flights')
  // peer A asked peer B to evaluate `flights`; the request is proposal "p1" recorded on B's attachment (here: the root)
  r = requestContinuation(r, ['trip'], { request: 'evaluate flights', node: ['flights'], requestedAt: 5 }, 5)
  expect(nodeTrigger(r, ['trip'])).toMatchObject({ kind: 'response', peer: 'device-a', enabled: true })
  expect(triggerOccurrence(r, ['trip'], nodeTrigger(r, ['trip'])!, 6)).toBeNull()
  // B's answer: a committed evaluation of the requested node after the request
  const answered = writeNodeValue(r, ['flights'], 'fos:evaluation', { id: 'run-1', status: 'committed', started: 7, effects: [] }, 7)
  expect(triggerOccurrence(answered, ['trip'], nodeTrigger(answered, ['trip'])!, 8)).toBe('response:evaluate flights:run-1')
  let runs: string[][] = []
  await runNodeTriggers({ get: () => answered, save: async () => {}, now: () => 9, available: (peer, kind) => peer === 'device-a' && kind === 'response', evaluate: async path => { runs.push(path) } })
  expect(runs).toEqual([['trip']])
  // or B's refusal: on B's side the request is a proposal (device A is an invited peer; B's device accepts requests)
  let b = addTask(addTask(createReplica('device-b'), [], 'Plan trip', 1, 'trip'), [], 'Book flights', 1, 'flights')
  b = addMemberAt(b, [], 'device-a', 'A', ['read', 'edit'], 6)
  b = installTestObservers(setMemberCapabilitiesAt(addMemberAt(b, [], 'device-b', 'B', [], 6), [], 'device-b', [], [], 6, ['request']))
  const asked = dispatchEvent(b, { kind: 'complete', path: ['flights'], expected: put(b.store, valueContent(b.store, resolveScope(b.store, headCid(b), ['flights'])!)) }, { peerId: 'device-a', owner: false, scope: [] }, 6)
  const proposalId = (asked.result as { proposalId: string }).proposalId
  expect(userView(asked.replica)!.proposals.some(p => p.id === proposalId && p.name === 'evaluate flights')).toBe(true)
  const refused = rejectProposalAt(asked.replica, [], proposalId, 7)
  const waiting = requestContinuation(refused, ['trip'], { request: 'evaluate flights', node: ['flights'], requestedAt: 5 }, 8)
  expect(triggerOccurrence(waiting, ['trip'], nodeTrigger(waiting, ['trip'])!, 9)).toBe('response:evaluate flights:rejected')
})

function createReplica(id: string) { return installTestObservers(bareReplica(id), [id, 'first-peer', 'second-peer', 'fos']) }
function loadReplica(data: Parameters<typeof bareLoadReplica>[0]) { const r = bareLoadReplica(data); return installTestObservers(r, [r.meta.peerId, 'desktop', 'device-a', 'device-b'], false) }
