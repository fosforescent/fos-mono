import { addRefAt, addMemberAt, addTask, bindRefInputs, content, contextMemberRefs, createBranch, createReplica, headCid, put, refProperties, resolveScope, setHandlerOffersAt, refNodeContent, selectBranch, commitRoot, updateAtScope, withMember, type Replica } from './index'

const properties = (r: Replica, path: string[]) => refProperties(r.store, resolveScope(r.store, headCid(r), path)!)

test('local bindings and remote members expose properties through the same ref traversal', () => {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  const type = r.store.primitive.documentField.getId()
  r = addRefAt(r, ['project'], 'input', type, 2, null, 'input')
  r = addMemberAt(r, ['project'], 'remote', 'Remote', ['read'], 3)
  expect(properties(r, ['project'])).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'input', name: 'input', type, value: null, argument: true }),
    expect.objectContaining({ id: 'fos:peer:remote', peer: 'remote', name: 'Remote', member: true })
  ]))
  const handler = put(r.store, refNodeContent(r.store, { alias: { id: 'handler' }, name: { content: 'input' } }, put(r.store, { data: { description: { content: 'Remote result' } }, children: [] }), []))
  r = setHandlerOffersAt(r, ['project'], 'remote', type, [handler], 4)
  const remote = properties(r, ['project']).find(p => p.peer === 'remote')!
  expect(refProperties(r.store, remote.cid)).toContainEqual(expect.objectContaining({ id: 'handler', name: 'input', type, direction: 'from' }))
})

test('same-name submissions and types remain separate; reading a feature does not grant its peers main authority', () => {
  let r = addTask(createReplica('owner'), [], 'Project', 1, 'project')
  for (const id of ['first', 'second']) r = addRefAt(r, ['project'], id, r.store.primitive.documentField.getId(), 2, put(r.store, { data: { description: { content: id } }, children: [] }), 'shared')
  expect(properties(r, ['project']).filter(p => p.name === 'shared').map(p => content(r.store, p.value!).data.description?.content).sort()).toEqual(['first', 'second'])
  r = addMemberAt(r, ['project'], 'main-peer', 'Main', ['read'], 3)
  r = createBranch(r, ['project'], 'feature', 4)
  // Simulate an untrusted branch containing its own grant, bypassing the owner policy editor.
  commitRoot(r.store, updateAtScope(r.store, headCid(r), ['project'], node => withMember(r.store, node, 'feature-peer', 'Feature', ['read']), 'node'), 5)
  expect(properties(r, ['project']).some(p => p.peer === 'feature-peer')).toBe(true)
  expect([...contextMemberRefs(r, ['project']).keys()]).toContain('main-peer')
  expect([...contextMemberRefs(r, ['project']).keys()]).not.toContain('feature-peer')
  selectBranch(r.store, 'project', 'main')
  expect(properties(r, ['project']).some(p => p.peer === 'feature-peer')).toBe(false)
})

test('declarative input binding preserves values and refuses inherited or missing bindings', () => {
  expect(bindRefInputs({ path: '{{node}}', children: ['{{value}}'], literal: 'text {{value}}' }, { node: ['project'], value: 0 })).toEqual({ path: ['project'], children: [0], literal: 'text {{value}}' })
  expect(() => bindRefInputs('{{missing}}', {})).toThrow('Missing binding')
  expect(() => bindRefInputs('{{toString}}', {})).toThrow('Missing binding')
})
