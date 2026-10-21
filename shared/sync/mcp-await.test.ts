import { addTask, addMemberAt, createReplica, dispatchEvent, handleMcp, waitMcp, setMemberCapabilitiesAt, setNodeLinkMask, createBranch, selectBranch, type FosEvent, type Capability } from './index'

const message = (args: object = {}, name = 'fos_await_task') => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
const data = (reply: any) => JSON.parse(reply.result.content[0].text)
function fixture() {
  let r = addMemberAt(addTask(createReplica('owner'), [], 'Project', 1, 'project'), ['project'], 'agent', 'Agent', ['read', 'execute'], 2)
  const controller = new AbortController()
  const host = { owner: false, capabilities: ['read', 'execute'] as Capability[], wait: (ms: number) => waitMcp(ms, controller.signal), dispatch: (event: FosEvent) => dispatchEvent(r, event, { peerId: 'agent', owner: false, scope: ['project'] }, 10).result }
  return { host, controller, get: () => r, set: (next: typeof r) => { r = next } }
}
afterEach(() => jest.useRealTimers())

test('await returns the top outstanding item, assigned first, without claiming or changing it', async () => {
  const s = fixture()
  s.set(addTask(s.get(), ['project'], 'First', 3, 'first'))
  s.set(addMemberAt(addTask(s.get(), ['project'], 'Assigned', 4, 'assigned'), ['project', 'assigned'], 'agent', 'Agent', ['execute'], 5))
  const a = data(await handleMcp(message(), s.host)), b = data(await handleMcp(message(), s.host))
  expect(a).toMatchObject({ status: 'task', task: { path: ['assigned'], assigned: true } })
  expect(b).toEqual(a)
})

test('empty subtree waits, permits concurrent reads, then returns fresh work', async () => {
  jest.useFakeTimers()
  const s = fixture(), pending = handleMcp(message({ timeoutMs: 2000 }), s.host)
  expect(data(await handleMcp(message({}, 'fos_read'), s.host)).title).toBe('Project')
  s.set(addTask(s.get(), ['project'], 'New task', 3, 'new'))
  await jest.advanceTimersByTimeAsync(1000)
  expect(data(await pending)).toMatchObject({ status: 'task', task: { path: ['new'], title: 'New task' } })
  expect(jest.getTimerCount()).toBe(0)
})

test('timeout, zero wait, invalid input and cancellation have bounded outcomes', async () => {
  jest.useFakeTimers()
  const s = fixture()
  expect(data(await handleMcp(message({ timeoutMs: 0 }), s.host))).toMatchObject({ status: 'timeout', task: null })
  const pending = handleMcp(message({ timeoutMs: 1200 }), s.host)
  await jest.advanceTimersByTimeAsync(1200)
  expect(data(await pending)).toMatchObject({ status: 'timeout', task: null })
  for (const args of [{ timeoutMs: -1 }, { timeoutMs: 30001 }, { timeoutMs: '10' }, { timeoutMs: null }, { timeoutMs: 1.5 }, { offset: 1 }]) expect((await handleMcp(message(args), s.host) as any).result.isError).toBe(true)
  const cancelled = handleMcp(message(), s.host)
  s.controller.abort()
  expect((await cancelled as any).result.content[0].text).toMatch(/cancelled/)
  expect(jest.getTimerCount()).toBe(0)
})

test('execute revocation and subtree masks are enforced while waiting', async () => {
  jest.useFakeTimers()
  const s = fixture(), pending = handleMcp(message(), s.host)
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read'], [], 3))
  await jest.advanceTimersByTimeAsync(1000)
  expect((await pending as any).result.content[0].text).toMatch(/execute/)
  s.set(setMemberCapabilitiesAt(s.get(), ['project'], 'agent', ['read', 'execute'], [], 4))
  s.set(addTask(s.get(), ['project'], 'Hidden', 5, 'hidden'))
  s.set(setNodeLinkMask(s.get(), ['project'], 'agent', '', { children: [] }, 6))
  expect(data(await handleMcp(message({ timeoutMs: 0 }), s.host)).task).toBeNull()
  expect((await handleMcp(message({ path: ['hidden'], timeoutMs: 0 }), s.host) as any).result.isError).toBe(true)
})

test('waits retain subtree and branch selections on every probe', async () => {
  jest.useFakeTimers()
  const s = fixture()
  s.set(addTask(s.get(), ['project'], 'Subtree', 3, 'subtree'))
  s.set(createBranch(s.get(), ['project'], 'feature', 4))
  selectBranch(s.get().store, 'project', 'main')
  const pending = handleMcp(message({ path: ['subtree'], branches: [{ path: [], name: 'feature' }], timeoutMs: 2000 }), s.host)
  s.set(addTask(s.get(), ['project', 'subtree'], 'Main only', 5, 'main'))
  selectBranch(s.get().store, 'project', 'feature')
  s.set(addTask(s.get(), ['project', 'subtree'], 'Feature only', 6, 'feature'))
  selectBranch(s.get().store, 'project', 'main')
  await jest.advanceTimersByTimeAsync(1000)
  expect(data(await pending).task.path).toEqual(['subtree', 'feature'])
})
