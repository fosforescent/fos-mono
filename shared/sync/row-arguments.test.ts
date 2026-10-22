import {
  createReplica, ensureHomeContext, shareHome, HOME_ID, addRefAt, put, content, refNodeContent,
  headCid, resolveScope, valueContent, commitRoot, updateAtScope, view, refProperties,
  argumentRefs, compileInstructions, refValueCid, renameTask, provideNode,
  acceptProvidedNode, SERVER_TRANSPORT_CAPABILITIES, isRowEdge, writeNodeValue, readNodeValue,
  resolveRefExpression, proposeRefAt, applyProposalAt, refBranches, serializeReplica, loadReplica,
  missingTemplatesAt, templateNodesAt, acceptTemplateNodes
} from './index'

test('a native constructor and its unfilled right argument are an ordinary editable row', () => {
  let r = createReplica('owner')
  const left = r.store.primitive.documentField.getId()
  r = addRefAt(r, [], 'input', left, 1, null, 'input')
  expect(view(r, [])!.tasks.find(row => row.id === 'input')?.typeCid).toBe(left)
  expect(refProperties(r.store, headCid(r)).find(row => row.id === 'input')).toMatchObject({ type: left, argument: true })
  r = renameTask(r, [], 'input', 'Filled through the row editor', 2)
  const right = content(r.store, resolveScope(r.store, headCid(r), ['input'])!)
  expect(refValueCid(r.store, right)).toBeTruthy()
  expect(valueContent(r.store, refValueCid(r.store, right)!).data.description?.content).toBe('Filled through the row editor')
})

test('submitting to an ordinary property ref uses the row left and preserves value alternatives', () => {
  let r = writeNodeValue(createReplica('owner'), [], 'settings', { count: 1, untouched: true }, 1)
  const property = resolveRefExpression(r, [], '.settings.count').locations[0]!
  expect(content(r.store, property.cid).children.some(([key]) => key === r.store.primitive.instructionPointerConstructor.getId())).toBe(false)
  const next = put(r.store, { data: { scalar: { type: 'number', value: 2 } }, children: [] })
  const proposed = proposeRefAt(r, property.path, next, 'owner', 2)
  r = applyProposalAt(proposed.replica, property.path, proposed.proposalCid, 'owner', 3)
  expect(readNodeValue(r, [], 'settings')).toEqual({ count: 2, untouched: true })
  const ref = content(r.store, resolveScope(r.store, headCid(r), property.path)!)
  expect(refBranches(r.store, ref)?.names).toHaveLength(2)
  expect(readNodeValue(loadReplica(serializeReplica(r)), [], 'settings')).toEqual({ count: 2, untouched: true })
})

test('the enclosing left instruction is the only pattern carried through node exchange', () => {
  const device = (id: string) => shareHome(ensureHomeContext(createReplica(id), 0))
  let source = device('source'), receiver = device('receiver')
  const left = put(source.store, { data: { description: { content: 'Left capability' } }, children: [] })
  const value = put(source.store, { data: { scalar: { type: 'text', value: 'handler value' } }, children: [] })
  const right = put(source.store, refNodeContent(source.store, { alias: { id: 'handler' }, name: { content: 'handler' } }, value, []))
  commitRoot(source.store, updateAtScope(source.store, headCid(source), [HOME_ID], node => ({ ...node, children: [...node.children, [left, right]] })), 1)
  expect(isRowEdge(source.store, [left, right])).toBe(true)
  expect(argumentRefs(source.store, resolveScope(source.store, headCid(source), [HOME_ID])!).find(ref => ref.name === 'handler')?.type).toBe(left)
  expect(compileInstructions(source, [HOME_ID, 'handler']).cid).toBe(left)

  const request = { peerId: 'receiver', scope: [HOME_ID], path: [] as string[], linkId: 'parent' }
  const authority = { peerId: 'receiver', scope: [HOME_ID], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const parent = provideNode(source, request, authority, 2).node
  const child = parent.children.find(row => row.id === 'handler')!
  expect(child.template).toBe(left)
  expect(child.right).toEqual({ name: 'handler', bound: true })
  expect(JSON.stringify(parent)).not.toContain('handler value')
  receiver = acceptProvidedNode(receiver, [HOME_ID], request, parent, 3)
  const load = { ...request, path: ['handler'], linkId: 'value' }
  receiver = acceptProvidedNode(receiver, [HOME_ID, 'handler'], load, provideNode(source, load, authority, 4).node, 5)
  const received = resolveScope(receiver.store, headCid(receiver), [HOME_ID, 'handler'])!
  expect(content(receiver.store, received).children.some(([key]) => key === receiver.store.primitive.instructionPointerConstructor.getId())).toBe(false)
  expect(view(receiver, [HOME_ID])!.tasks.find(row => row.id === 'handler')?.typeCid).toBe(left)
  expect(valueContent(receiver.store, received).data.scalar?.value).toBe('handler value')
  expect(compileInstructions(receiver, [HOME_ID, 'handler']).cid).toBe(left)
})

test('a named right ref stays a row while its left definition is loaded separately', () => {
  const device = (id: string) => shareHome(ensureHomeContext(createReplica(id), 0))
  const source = device('source')
  let receiver = device('receiver')
  const left = put(source.store, { data: { description: { content: 'Custom field constructor' } }, children: [] })
  const value = put(source.store, { data: { scalar: { type: 'text', value: 'field value' } }, children: [] })
  const right = put(source.store, refNodeContent(source.store, { alias: { id: 'field' }, name: { content: 'field' } }, value))
  commitRoot(source.store, updateAtScope(source.store, headCid(source), [HOME_ID], node => ({ ...node, children: [...node.children, [left, right]] })), 1)
  const request = { peerId: 'receiver', scope: [HOME_ID], path: [] as string[], linkId: 'parent' }
  const authority = { peerId: 'receiver', scope: [HOME_ID], owner: true, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const shallow = provideNode(source, request, authority, 2).node
  delete shallow.templates
  receiver = acceptProvidedNode(receiver, [HOME_ID], request, shallow, 3)
  expect(view(receiver, [HOME_ID])!.tasks.some(row => row.id === 'field')).toBe(true)
  expect(missingTemplatesAt(receiver, [HOME_ID])).toContain(left)
  receiver = acceptTemplateNodes(receiver, [HOME_ID], templateNodesAt(source, [HOME_ID], [left])!, 4)
  expect(view(receiver, [HOME_ID])!.tasks.find(row => row.id === 'field')?.typeCid).toBe(left)
  const load = { ...request, path: ['field'], linkId: 'field' }
  receiver = acceptProvidedNode(receiver, [HOME_ID, 'field'], load, provideNode(source, load, authority, 5).node, 6)
  expect(readNodeValue(receiver, [HOME_ID], 'field')).toBe('field value')
})
