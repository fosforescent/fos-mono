import { FosStore } from '../dag-implementation/store'
import { content, put, refValueCid, importNodes, reachableNodes } from './graph'
import { primitiveRef } from './primitives'
import { constructNodeValue, readGraphValue } from './node-values'
import { applyAuthorityTransaction, authorityBindings, authorityGrant, authorityOperation, authorityState, authorityTransaction, checkAuthorityTransaction, linearAuthorityUsage, type AuthorityChecker } from './authority'

function fixture(check?: AuthorityChecker['transition']) {
  const store = new FosStore()
  const type = put(store, { data: { form: { open: true } }, children: [] })
  const native: AuthorityChecker = { usage: linearAuthorityUsage, transition: check ?? ((store, operation) => {
    const amount = (value: string) => readGraphValue(store, value) as number
    return operation.inputs.reduce((n, grant) => n + amount(grant.value), 0) === operation.outputs.reduce((n, grant) => n + amount(grant.value), 0)
      ? [] : ['The split must conserve the supplied amount.']
  }) }
  const checkerRef = primitiveRef(store, { id: 'checker', type, host: 'test', native: { authority: native } })
  const checker = refValueCid(store, content(store, checkerRef))!
  const ref = (slot: number) => put(store, { data: { refDeclaration: { slot } }, children: [] })
  const grant = (value: unknown, policy = checker) => authorityGrant(store, policy, constructNodeValue(store, value).cid)
  const original = grant(10), before = authorityState(store, [[ref(0), original]])
  return { store, checker, ref, grant, original, before }
}

test('a split consumes the original and returns a child and explicit remainder without mutating authority while checking', () => {
  const { store, ref, grant, original, before } = fixture()
  const child = grant(6), remainder = grant(4)
  const operation = authorityOperation(store, [[ref(0), original]], [[ref(1), child], [ref(2), remainder]])
  const transaction = authorityTransaction(store, before, [operation])
  const checked = checkAuthorityTransaction(store, transaction)
  expect(checked.problems).toEqual([])
  const after = content(store, checked.next!)
  expect(content(store, after.children[0]![1]).children).toEqual([[ref(1), child], [ref(2), remainder]])
  expect(content(store, content(store, before).children[0]![1]).children).toEqual([[ref(0), original]])
  expect(applyAuthorityTransaction(store, before, transaction).next).toBe(checked.next)
  expect(applyAuthorityTransaction(store, checked.next!, transaction).problems).toEqual([expect.stringMatching(/changed before commit/)])
})

test('discarding the remainder fails the domain check even though the original grant was used once', () => {
  const { store, ref, grant, original, before } = fixture()
  const tx = authorityTransaction(store, before, [authorityOperation(store, [[ref(0), original]], [[ref(1), grant(6)]])])
  expect(checkAuthorityTransaction(store, tx)).toEqual({ problems: ['The split must conserve the supplied amount.'] })
})

test('two operations cannot consume the same linear grant', () => {
  const { store, ref, grant, original, before } = fixture()
  const tx = authorityTransaction(store, before, [
    authorityOperation(store, [[ref(0), original]], [[ref(1), grant(10)]]),
    authorityOperation(store, [[ref(0), original]], [[ref(2), grant(10)]])
  ])
  expect(checkAuthorityTransaction(store, tx).problems).toEqual([expect.stringMatching(/exactly once/)])
})

test('nested splits consume explicitly selected child grants and preserve independent equal-valued outputs', () => {
  const { store, ref, grant, original, before } = fixture(), five = grant(5)
  const tx = authorityTransaction(store, before, [
    authorityOperation(store, [[ref(0), original]], [[ref(1), five], [ref(2), five]]),
    authorityOperation(store, [[ref(1), five]], [[ref(3), grant(2)], [ref(4), grant(3)]])
  ])
  const checked = checkAuthorityTransaction(store, tx)
  expect(checked.problems).toEqual([])
  expect(content(store, content(store, checked.next!).children[0]![1]).children.map(([ref]) => ref)).toEqual([ref(2), ref(3), ref(4)])
})

test('forward dependencies, unknown inputs, and reused output slots are rejected', () => {
  const { store, ref, grant, original, before } = fixture()
  const future = grant(4)
  const tx = authorityTransaction(store, before, [
    authorityOperation(store, [[ref(2), future]], [[ref(3), future]]),
    authorityOperation(store, [[ref(0), original]], [[ref(1), grant(6)], [ref(2), future]])
  ])
  expect(checkAuthorityTransaction(store, tx).problems).toEqual([expect.stringMatching(/later operation/)])
  const overwrite = authorityTransaction(store, before, [authorityOperation(store, [[ref(0), original]], [[ref(0), original]])])
  expect(checkAuthorityTransaction(store, overwrite).problems).toEqual([expect.stringMatching(/fresh authority/)])
  expect(() => authorityBindings(store, [[ref(0), original], [ref(0), original]])).toThrow(/same grant twice/)
})

test('a consumer cannot substitute a permissive checker', () => {
  const { store, ref, grant, original, before } = fixture()
  const other = put(store, { data: {}, children: [] })
  const tx = authorityTransaction(store, before, [authorityOperation(store, [[ref(0), original]], [[ref(1), grant(10, other)]])])
  expect(checkAuthorityTransaction(store, tx).problems).toEqual([expect.stringMatching(/changes the checking contract/)])
})

test('a permissive co-input cannot launder a restricted grant', () => {
  const { store, ref, grant, original } = fixture()
  const type = put(store, { data: { form: { open: true } }, children: [] })
  const checkerRef = primitiveRef(store, { id: 'permissive', type, host: 'test', native: {
    authority: { usage: () => [], transition: () => [] }
  } })
  const permissive = refValueCid(store, content(store, checkerRef))!, extra = grant(0, permissive)
  const before = authorityState(store, [[ref(0), original], [ref(1), extra]])
  const tx = authorityTransaction(store, before, [authorityOperation(store,
    [[ref(0), original], [ref(1), extra]], [[ref(2), grant(10, permissive)]])])
  expect(checkAuthorityTransaction(store, tx).problems).toEqual([expect.stringMatching(/changes the checking contract/)])
})

test('adding metadata cannot turn the same declaration index into independent authority', () => {
  const { store, ref, original } = fixture()
  const counterfeit = put(store, { data: { refDeclaration: { slot: 0 }, description: { content: 'another grant' } }, children: [] })
  expect(() => authorityState(store, [[ref(0), original], [counterfeit, original]])).toThrow(/Invalid authority declaration/)
})

test('the common checker delegates nonnumeric transitions to the supplied handler', () => {
  const { store, ref, grant } = fixture((store, op) => {
    const locations = op.outputs.map(output => readGraphValue(store, output.value))
    return locations.length === 1 && locations[0] === 'room B' ? [] : ['Move to an authorized location.']
  })
  const original = grant('room A'), before = authorityState(store, [[ref(0), original]])
  const tx = authorityTransaction(store, before, [authorityOperation(store, [[ref(0), original]], [[ref(1), grant('room B')]])])
  expect(checkAuthorityTransaction(store, tx).problems).toEqual([])
})

test('an imported graph does not silently acquire a checking handler', () => {
  const { store, ref, grant, original, before } = fixture()
  const tx = authorityTransaction(store, before, [authorityOperation(store, [[ref(0), original]], [[ref(1), grant(10)]])])
  const isolated = new FosStore()
  importNodes(isolated, reachableNodes(store, [tx]))
  expect(checkAuthorityTransaction(isolated, tx).next).toBeUndefined()
  expect(checkAuthorityTransaction(isolated, tx).problems.every(problem => /handler is unavailable/.test(problem))).toBe(true)
})
