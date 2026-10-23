import { libAt } from '@fosforescent/shared/sync/index'
import { installTestObservers } from '@fosforescent/shared/sync/test-helpers'
import {
  addRow, addTask, bindRepository, createBranch, createReplica,
  loadReplica, nodeTrigger, readNodeValue, runNodeTriggers, selectBranch, serializeReplica,
  setMemberCapabilitiesAt, repositoryPeerId, setNodeTrigger, TEMPLATE_TYPE, view, watchedRefValue,
  type RepositorySnapshot, type Replica
} from '@fosforescent/shared/sync/index'
import { repositoryLoadHandler } from './repository'

function fixture() {
  let r = bindRepository(addTask(createReplica('user:alice'), [], 'Project', 1, 'project'), ['project'], 'acme/project', 2)
  r = createBranch(r, ['project'], 'feature', 3)
  r = addTask(r, ['project'], 'Phone instructions', 4, 'note')
  selectBranch(r.store, 'project', 'main')
  const snapshot: RepositorySnapshot = { repo: 'acme/project', defaultBranch: 'main', canPush: true, branches: [{ name: 'main', sha: 'b'.repeat(40) }, { name: 'feature', sha: 'a'.repeat(40) }], pulls: [{ number: 7, title: 'Feature', url: 'https://github.com/acme/project/pull/7', head: 'feature', base: 'main', sha: 'a'.repeat(40), headRepo: 'acme/project', state: 'open' }] }
  const fetch = jest.fn(async () => snapshot)
  const handler = repositoryLoadHandler({ connected: async () => true, snapshot: fetch })
  const load = async (replica: Replica, now: number) => installTestObservers(await handler.load!({ userId: 7, replica, path: ['project'], branches: [{ scope: ['project'], name: 'feature' }], now }), ['desktop'], false)
  return { r, snapshot, fetch, load }
}

test('server load mediates PR -> Fos request -> Fos merge -> ordinary template trigger, once after reload', async () => {
  let { r, snapshot, fetch, load } = fixture()
  r = addRow(r, [], TEMPLATE_TYPE, 'An arbitrary continuation', 5, { id: 'continue' })
  r = setNodeTrigger(installTestObservers(r, ['desktop']), ['continue'], { observer: libAt(r.store).capabilities['ref-change']!, enabled: true, peer: 'desktop', created: 5, watch: { path: ['project'], branch: 'main', merges: true, baseline: watchedRefValue(r, ['project'], 'main', true)! } }, 5)
  let runs = 0
  const driver = { get: () => r, save: (next: Replica) => { r = next }, now: () => 90_000, available: () => true, evaluate: async () => { runs++ } }
  r = await load(r, 10)
  expect(fetch).toHaveBeenCalledWith(7, 'acme/project', [], 'feature')
  expect(view(r, [])!.tasks.find(t => t.id === 'project')!.branches?.mergeRequests).toEqual(['feature'])
  expect(view(r, ['project', 'note'])).toBeNull()
  await runNodeTriggers(driver); expect(runs).toBe(0)
  // Even a direct main edit is not a merge.
  r = addTask(r, ['project'], 'Direct main edit', 11, 'direct')
  await runNodeTriggers(driver); expect(runs).toBe(0)
  snapshot.pulls[0]!.state = 'merged'
  r = await load(r, 30_011)
  expect(fetch).toHaveBeenLastCalledWith(7, 'acme/project', [7], 'feature')
  expect(view(r, ['project', 'note'])?.name).toBe('Phone instructions')
  expect(view(r, [])!.tasks.find(t => t.id === 'project')!.branches?.mergeRequests ?? []).toEqual([])
  await runNodeTriggers(driver); expect(runs).toBe(1)
  const receipt = watchedRefValue(r, ['project'], 'main', true)
  r = installTestObservers(loadReplica(serializeReplica(r)), ['desktop'], false)
  r = await load(r, 60_012)
  expect(watchedRefValue(r, ['project'], 'main', true)).toBe(receipt)
  await runNodeTriggers(driver); expect(runs).toBe(1)
  expect(nodeTrigger(r, ['continue'])?.watch?.merges).toBe(true)
})

test('loading an unbound node, disabled integration or denied repository never fetches GitHub', async () => {
  const { r, fetch, load } = fixture()
  const denied = setMemberCapabilitiesAt(r, ['project'], repositoryPeerId('acme/project'), ['repo'], [], 10, [])
  expect(await load(denied, 11)).toBe(denied)
  expect(fetch).not.toHaveBeenCalled()
  const handler = repositoryLoadHandler({ connected: async () => false, snapshot: fetch })
  expect(await handler.load!({ userId: 7, replica: r, path: ['project'], branches: [], now: 12 })).toBe(r)
  expect(await load(addTask(createReplica('user:alice'), [], 'Unbound', 1, 'project'), 13)).toBeDefined()
  expect(fetch).not.toHaveBeenCalled()
})

test('a fork PR cannot merge a same-named local branch; a merged PR found on first load can', async () => {
  let { r, snapshot, load } = fixture()
  snapshot.pulls[0]!.state = 'merged'; snapshot.pulls[0]!.headRepo = 'someone/fork'
  r = await load(r, 10)
  expect(view(r, ['project', 'note'])).toBeNull()
  snapshot.pulls[0]!.headRepo = 'acme/project'
  r = await load(r, 30_011)
  expect(view(r, ['project', 'note'])?.name).toBe('Phone instructions')
})
