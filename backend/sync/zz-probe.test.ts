import { addRequirement, addTask, createReplica, ensureHomeContext, HOME_ID, evaluationSteps, loadReplica, serializeReplica, discoverHandlers } from '@fosforescent/shared/sync/index'
jest.mock('../prismaClient', () => ({ prisma: {} }))
jest.mock('../promptNotifications', () => ({ sendToUser: jest.fn() }))
jest.mock('../util', () => ({ dbToStore: jest.fn(), storeToDb: jest.fn() }))
import { createHostRuntime } from './host-runtime'
import { mailHandler } from './hostHandlers'
test('probe', async () => {
  const runtime = createHostRuntime([mailHandler({ send: async () => {} })])
  let r = ensureHomeContext(createReplica('user:owner'), 1, { server: ['mail'] })
  r = addTask(r, [HOME_ID], 'Plan the group trip', 2, 'trip')
  r = addRequirement(r, [HOME_ID, 'trip'], 'Plan the group trip', 2, { capability: 'mail', inputs: { to: 'team@example.com', subject: 'Trip plans' } }, 'notify')
  r = ensureHomeContext(loadReplica(serializeReplica(r)), 0, runtime.hostOffers())
  const steps = evaluationSteps(r, [HOME_ID, 'trip'])
  console.log(steps.map(s => [s.path.join('/'), s.row?.title, s.row?.requirement?.capability, runtime.executors(s, r).length]))
  console.log(discoverHandlers(r, [HOME_ID, 'trip', 'notify']).map(o => [o.id, o.label, o.peerId]))
})
