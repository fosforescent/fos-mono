import { startCronRunner } from './cron'

test('disabled cron never enumerates users; enabled runner pages accounts and stops cleanly', async () => {
  const users = jest.fn(async (after?: string) => after ? [] : ['alice', 'bob'])
  const run = jest.fn(async (_user: string) => undefined)
  expect(startCronRunner({ enabled: false, users, run })).toBeNull()
  expect(users).not.toHaveBeenCalled()
  const stop = startCronRunner({ enabled: true, users, run })!
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  stop()
  expect(run.mock.calls.map(([user]) => user)).toEqual(['alice', 'bob'])
})
