import { api } from './embed'
import { addTask, createReplica, ensureHomeContext, HOME_ID, view } from './index'
import { exchangeNode } from './node-sync'
import { SERVER_TRANSPORT_CAPABILITIES } from './graph'
import type { NodeRequest } from './node-provider'
import { TASK_TYPE } from './library-types'

/** What the `fos` binary does for `fos sync`: begin, then send each request the core returns until it is done. */
function cliSync(handle: string, server: ReturnType<typeof createReplica>, push = true): { synced: number; requests: NodeRequest[] } {
  api.nodeSyncBegin(handle, 'user', 'alice', push, null)
  const requests: NodeRequest[] = []
  let answer: string | null = null
  for (;;) {
    const step = JSON.parse(api.nodeSyncStep(handle, answer, 5)) as { request?: NodeRequest; done?: boolean; synced?: number }
    if (step.done) return { synced: step.synced!, requests }
    requests.push(step.request!)
    answer = JSON.stringify(exchangeNode(server, step.request!, { peerId: 'laptop', scope: [], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }, 5).node)
  }
}

test('the CLI syncs Home with the account node by node through the embedded core', () => {
  let server = ensureHomeContext(createReplica('user:alice'), 0)
  server = addTask(server, [HOME_ID], 'From the web', 1, 'web')
  api.open('cli', null, 'laptop')
  api.addRow('cli', JSON.stringify([HOME_ID]), TASK_TYPE, 'From the CLI', 2, JSON.stringify({ id: 'cli' }))
  const first = cliSync('cli', server)
  expect(first.synced).toBeGreaterThanOrEqual(3)
  expect(view(server, [HOME_ID])!.tasks.map(t => t.id).sort()).toEqual(['cli', 'web'])
  expect(JSON.parse(api.view('cli', JSON.stringify([HOME_ID]))).tasks.map((t: { id: string }) => t.id).sort()).toEqual(['cli', 'web'])
  const meta = JSON.parse(api.meta('cli'))
  expect(meta.serverPeerId).toBe('user:alice')
  expect(meta.localScope).toEqual([HOME_ID])
  expect(meta.dirty).toBe(false)
  // a pull sends no update
  addTask(server, [HOME_ID], 'Later', 3, 'later')
  const pull = cliSync('cli', server, false)
  expect(pull.requests.some(r => r.update)).toBe(false)
  expect(JSON.parse(api.view('cli', JSON.stringify([HOME_ID]))).tasks.map((t: { id: string }) => t.id)).toContain('later')
  api.close('cli')
})

test('a failed transport leaves what was synced so far and the next sync starts over', () => {
  const server = ensureHomeContext(createReplica('user:alice'), 0)
  api.open('cli2', null, 'laptop')
  api.addRow('cli2', JSON.stringify([HOME_ID]), TASK_TYPE, 'Pending', 2, JSON.stringify({ id: 'pending' }))
  api.nodeSyncBegin('cli2', 'user', 'alice', true, null)
  JSON.parse(api.nodeSyncStep('cli2', null, 5))
  api.nodeSyncAbort('cli2')
  expect(() => api.nodeSyncStep('cli2', null, 5)).toThrow(/no node sync/)
  cliSync('cli2', server)
  expect(view(server, [HOME_ID])!.tasks.map(t => t.id)).toEqual(['pending'])
  api.close('cli2')
})

test('a project syncs from its own directory: a device root of its own, with no Home', () => {
  const server = ensureHomeContext(createReplica('user:alice'), 0)
  api.open('project', null, 'laptop', false)
  // first contact: the account says where it attaches (its Home)
  api.setScope('project', JSON.stringify([HOME_ID]), '[]')
  api.addRow('project', '[]', TASK_TYPE, 'Project row', 2, JSON.stringify({ id: 'row' }))
  cliSync('project', server)
  expect(view(server, [HOME_ID])!.tasks.map(t => t.id)).toEqual(['row'])
  // it ships the standard library like any device root; its own rows are at its root
  expect(JSON.parse(api.view('project', '[]')).tasks.map((t: { id: string }) => t.id)).toEqual(['fos:library', 'row'])
  expect(JSON.parse(api.meta('project')).localScope).toBeUndefined()
  api.close('project')
})

test('two stores on one machine link each other and read each other by node exchange, as their grants allow', () => {
  api.open('home', null, 'home-store')
  api.open('project', null, 'project-store', false)
  api.addRow('project', '[]', TASK_TYPE, 'Project row', 2, JSON.stringify({ id: 'p' }))
  api.addRow('home', JSON.stringify([HOME_ID]), TASK_TYPE, 'Home row', 2, JSON.stringify({ id: 'h' }))
  // nothing is readable before they are linked
  expect(() => api.browseStore('project', 'home-store', 3)).toThrow(/denied|access/i)
  expect(api.linkStore('project', 'home-store', 'Home', true, 3)).toBe(true)
  expect(api.linkStore('home', 'project-store', 'project', false, 3)).toBe(true)
  expect(api.linkStore('project', 'home-store', 'Home', true, 4)).toBe(false)
  expect(JSON.parse(api.localStores('project'))).toEqual([{ peerId: 'home-store', name: 'Home' }])
  // the linked store appears like any other peer: under its entry in Settings, a row held by it standing for its Home
  const held = JSON.parse(api.view('project', JSON.stringify(['fos:peer:home-store']))).tasks.find((t: { id: string }) => t.id === 'store:home-store')
  expect(held).toMatchObject({ refId: expect.any(String), refPeer: 'home-store', title: 'Home' })
  // each reads the other's tree through node exchange
  expect(JSON.parse(api.browseStore('project', 'home-store', 5)).join(' | ')).toContain('Project row')
  expect(JSON.parse(api.browseStore('home', 'project-store', 5)).join(' | ')).toContain('Home row')
  api.close('home'); api.close('project')
})
