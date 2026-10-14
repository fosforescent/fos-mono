import { rememberLoadedRoot, saveRootVersion } from './storeVersion'

test('an atomic root advance rejects a stale writer, even if its save fetched a newer user record', async () => {
  let dbRoot = 'base'
  const first = { rootNodeId: 'first-claim' }, other = { rootNodeId: 'second-claim' }
  rememberLoadedRoot(first, dbRoot); rememberLoadedRoot(other, dbRoot)
  const advance = async (expected: string, next: string) => { if (dbRoot !== expected) return false; dbRoot = next; return true }
  await saveRootVersion(first, 'base', advance)
  await expect(saveRootVersion(other, dbRoot, advance)).rejects.toThrow(/changed on another server/)
  expect(dbRoot).toBe('first-claim')
  first.rootNodeId = 'effect-result'
  await saveRootVersion(first, 'base', advance)
  expect(dbRoot).toBe('effect-result')
})
