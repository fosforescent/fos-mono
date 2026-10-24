import { addRefAt, addTask, createReplica, type Replica } from './replica'
import { content, put, refValueCid } from './graph'
import { primitiveRef } from './primitives'
import { constructNodeValue, readGraphValue } from './node-values'
import { resolveRefIdentity } from './ref-paths'
import { compileAuthorityGrant } from './authority-compilation'
import { linearAuthorityUsage, type AuthorityChecker } from './authority'

function setup() {
  let r = createReplica('owner')
  const type = put(r.store, { data: { form: { open: true } }, children: [] })
  const checker: AuthorityChecker = { usage: linearAuthorityUsage, transition: (store, operation) => {
    const sum = (values: typeof operation.inputs) => values.reduce((total, grant) => total + (readGraphValue(store, grant.value) as number), 0)
    return sum(operation.inputs) === sum(operation.outputs) ? [] : ['Conserve the supplied amount.']
  } }
  const native = primitiveRef(r.store, { id: 'check-authority', type, host: 'owner', native: { authority: checker } })
  const value = refValueCid(r.store, content(r.store, native))!
  r = addRefAt(r, [], 'policy', type, 1, value, 'policy')
  r = addTask(r, [], 'Work', 2, 'work')
  const payload = constructNodeValue(r.store, 10).cid
  const compiled = compileAuthorityGrant(r, ['work'], payload, { type, name: 'policy' })
  expect(compiled.problems).toEqual([])
  return { r, type }
}
const binding = (r: Replica, id: string, at: string[] = []) => {
  const found = resolveRefIdentity(r, at, id)
  expect(found.status).toBe('ready')
  return found.locations[0]!
}

test('issuance inherits the parent checking handler; declarations inside the row affect only children', () => {
  let { r, type } = setup()
  const outer = binding(r, 'policy'), payload = constructNodeValue(r.store, 2).cid
  const local = primitiveRef(r.store, { id: 'local', type, host: 'owner', native: { authority: { usage: () => [], transition: () => [] } } })
  r = addRefAt(r, ['work'], 'inner-policy', type, 7, refValueCid(r.store, content(r.store, local))!, 'policy')
  const own = compileAuthorityGrant(r, ['work'], payload, { type, name: 'policy' })
  const child = compileAuthorityGrant(r, ['work', 'nested'], payload, { type, name: 'policy' })
  const passed = compileAuthorityGrant(r, ['work', 'nested'], payload, { type, target: outer })
  expect(own.binding?.id).toBe('policy')
  expect(child.binding?.id).toBe('inner-policy')
  expect(passed.cid).toBe(own.cid)
  expect(child.cid).not.toBe(own.cid)
})

test('issuance never invents a checker for a missing capability binding', () => {
  const { r, type } = setup()
  const result = compileAuthorityGrant(r, ['work'], constructNodeValue(r.store, 5).cid, { type, name: 'absent' })
  expect(result.cid).toBeUndefined()
  expect(result.problems).toEqual([expect.stringMatching(/Missing binding/)])
})
