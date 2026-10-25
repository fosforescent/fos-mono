import { createStore } from '@fosforescent/shared/sync/graph'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { verifyCid } from '@fosforescent/shared/dag-implementation/cid'
import { accountRootAlias } from './accountRoot'

test('the stored root alias row verifies against its cid, as loading an account requires', () => {
  const store = createStore()
  const { cid, content } = accountRootAlias(store.rootNodeId, 'a')
  // the row as the database returns it (JSON round trip)
  expect(verifyCid(cid, JSON.parse(JSON.stringify(content)))).toBe(true)
  // the former row held only the alias data, which never matches the cid
  expect(verifyCid(cid, content.data as never)).toBe(false)
})
