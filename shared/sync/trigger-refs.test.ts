import {
  addTask, content,
  createReplica,
  nativeRef,
  publishNativeRef,
  put,
  setNodeTrigger,
  triggerOccurrence,
  nodeTrigger,
  triggerOffers,
  argumentRefs,
  resolveScope,
  headCid,
  loadReplica,
  serializeReplica,
  removeMemberAt,
  setHandlerOffersAt,
  runNodeTriggers,
  triggerState,
  setHandlerEnabledAt,
  type PrimitiveDefinition
} from './index'
import { ensureHomeContext, shareHome, HOME_ID } from './index'
import { syncWith } from './test-helpers'

function definition(label = 'A custom event'): PrimitiveDefinition<unknown> {
  return {
    id: 'user-authored-observer',
    label,
    type: (store) =>
      put(store, {
        data: {
          name: { content: 'user:event-pattern' },
          triggerDefinition: { label, icon: 'clock', mode: 'resume' }
        },
        children: []
      }),
    trigger: { observe: ({ config }) => (config.enabled ? { id: 'custom-event' } : null) }
  }
}

test('an unfamiliar observer executes only through its scoped declaration, pinned as the call instruction', () => {
  let r = addTask(createReplica('host'), [], 'Listen', 1, 'task')
  const def = definition(),
    ref = nativeRef(r.store, 'host', def)
  const config = { handler: ref, peer: 'host', enabled: true, created: 1 }
  expect(() => setNodeTrigger(r, ['task'], config, 1)).toThrow(/available observer/)
  r = publishNativeRef(r, [], 'host', ref, 1)
  r = setNodeTrigger(r, ['task'], config, 1)
  expect(triggerOffers(r, ['task']).map((o) => o.cid)).toEqual([ref])
  // a trigger given one observer's declaration is pinned to it: the row's left is that offer
  expect(nodeTrigger(r, ['task'])?.handler).toBe(ref)
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 2)).toBe('custom-event')
  r = setHandlerEnabledAt(r, [], 'host', content(r.store, ref).data.alias!.id, false, 2)
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 2)).toBeNull()
  r = setHandlerEnabledAt(r, [], 'host', content(r.store, ref).data.alias!.id, true, 2)
  r = loadReplica(serializeReplica(r))
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 2)).toBeNull()
  nativeRef(r.store, 'host', def) // restore the host meaning without registering anything
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 2)).toBe('custom-event')
  r = removeMemberAt(r, [], 'host', 3)
  nativeRef(r.store, 'host', def)
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 4)).toBeNull()
})

test('an observer failure is journalled for review and does not stop other observers', async () => {
  let r = addTask(addTask(createReplica('host'), [], 'Bad observer', 1, 'bad'), [], 'Good observer', 1, 'good')
  const base = definition()
  for (const id of ['bad', 'good']) {
    const def = {
      ...base,
      id,
      trigger: {
        observe: () => {
          if (id === 'bad') throw new Error('Invalid event source')
          return { id: 'event' }
        }
      }
    }
    const ref = nativeRef(r.store, 'host', def)
    r = publishNativeRef(r, [], 'host', ref, 1)
    r = setNodeTrigger(r, [id], { handler: ref, peer: 'host', enabled: true, created: 1 }, 1)
  }
  const runs: string[][] = []
  const driver = {
    get: () => r,
    save: (next: typeof r) => {
      r = next
    },
    now: () => 2,
    available: () => true,
    evaluate: async (path: string[]) => {
      runs.push(path)
    }
  }
  await runNodeTriggers(driver)
  await runNodeTriggers(driver)
  expect(triggerState(r, ['bad'])).toMatchObject({ status: 'failed', error: 'Invalid event source' })
  expect(runs).toEqual([['good']])
})

test('a selected observer never silently switches to another declaration of the same type', () => {
  let r = addTask(createReplica('host'), [], 'Listen', 1, 'task')
  const first = definition(),
    second = { ...first, id: 'other-observer', trigger: { observe: () => ({ id: 'wrong-event' }) } }
  const one = nativeRef(r.store, 'host', first),
    two = nativeRef(r.store, 'host', second)
  r = publishNativeRef(publishNativeRef(r, [], 'host', one, 1), [], 'host', two, 1)
  r = setNodeTrigger(r, ['task'], { handler: one, peer: 'host', enabled: true, created: 1 }, 1)
  r = setHandlerOffersAt(r, [], 'host', first.type(r.store, []), [two], 2)
  expect(triggerOccurrence(r, ['task'], nodeTrigger(r, ['task'])!, 3)).toBeNull()
})

test('node exchange preserves the exact observer instruction and independent configuration fields', () => {
  const account = ensureHomeContext(createReplica('account'), 0)
  let a = shareHome(ensureHomeContext(createReplica('a'), 0)),
    b = shareHome(ensureHomeContext(createReplica('b'), 0))
  const def = definition(),
    ref = nativeRef(a.store, 'a', def)
  a = publishNativeRef(a, [HOME_ID], 'a', ref, 1)
  a = addTask(a, [HOME_ID], 'Listen', 1, 'task')
  a = setNodeTrigger(a, [HOME_ID, 'task'], { handler: ref, peer: 'a', enabled: true, created: 1, threshold: 7 }, 1)
  a = syncWith(a, account, { now: 2 })
  b = syncWith(b, account, { now: 3 })
  const config = nodeTrigger(b, [HOME_ID, 'task'])!
  expect(config).toMatchObject({ handler: ref, threshold: 7 })
  expect(triggerOccurrence(b, [HOME_ID, 'task'], config, 4)).toBeNull()
  nativeRef(b.store, 'a', def) // this test host explicitly supplies the native implementation
  expect(triggerOccurrence(b, [HOME_ID, 'task'], config, 4)).toBe('custom-event')
})
