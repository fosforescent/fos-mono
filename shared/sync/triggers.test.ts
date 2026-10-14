import { addTask, addRow, createReplica, cronMatches, setNodeTrigger, triggerState, runNodeTriggers, view, setTaskDone, renameTask, loadReplica, serializeReplica } from './index'

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
  let r = addTask(createReplica('device'), [], 'Run', 0, 'task'), time = 10
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
  r = addTask(r, ['parent'], 'After parent', 1, 'child')
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
  let r = addRow(createReplica('device'), [], 'template', 'Workflow', 1, { id: 'template' })
  r = addTask(r, ['template'], 'Step', 1, 'step')
  r = setNodeTrigger(r, ['template'], { kind: 'timer', peer: 'device', enabled: true, created: 1, due: 2 }, 1)
  let runs = 0
  const driver = { get: () => r, save: (next: typeof r) => { r = next }, now: () => 3, available: () => true, evaluate: async (path: string[]) => { runs++; expect(path).not.toEqual(['template']); expect(view(r, path)!.tasks[0]!.title).toBe('Step'); throw new Error('Needs confirmation') } }
  await runNodeTriggers(driver); await runNodeTriggers(driver)
  expect(runs).toBe(1)
  expect(triggerState(r, ['template'])?.error).toBe('Needs confirmation')
  expect(view(r, [])!.tasks).toHaveLength(2)
})

test('an incoming proposal fires the request trigger and its saved occurrence is not replayed', async () => {
  const { makeLinkAt, proposalContent, withProposal, commitRoot, updateAtScope, headCid, resolveScope, put, rowContent } = await import('./index')
  let r = makeLinkAt(addTask(createReplica('device'), [], 'Inbox', 1, 'inbox'), ['inbox'], 1)
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

test('changing the trigger reuses its typed argument and switches its capability type', async () => {
  const { argumentRefs, capabilityTarget, headCid, resolveScope } = await import('./index')
  let r = addTask(createReplica('device'), [], 'Task', 1, 'task')
  r = setNodeTrigger(r, ['task'], { kind: 'timer', peer: 'device', enabled: true, created: 1, due: 10 }, 1)
  const args = () => argumentRefs(r.store, resolveScope(r.store, headCid(r), ['task'])!)
  expect(args()[0]!.type).toBe(capabilityTarget(r.store, 'timer'))
  r = setNodeTrigger(r, ['task'], { kind: 'request', peer: 'device', enabled: true, created: 2 }, 2)
  expect(args()).toHaveLength(1)
  expect(args()[0]!.type).toBe(capabilityTarget(r.store, 'request'))
})
