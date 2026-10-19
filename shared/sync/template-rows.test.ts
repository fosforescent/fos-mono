import { userView } from './test-helpers'
import { acceptProvidedNode, acceptTemplateNodes, addRow, addTask, copyNode, createReplica, content, exchangeNode, headCid, instantiateTemplate, missingTemplatesAt, nodeShape, resolveScope, rowTemplate, templateNodesAt, valueCidOf, valueContent, view, type NodeAuthority, type NodeRequest, type Replica } from './index'

/** A template row "Trip" with one requirement, and a task "Oslo" made from it. */
function withTrip(r: Replica, at: string[] = []): Replica {
  r = addRow(r, at, 'template', 'Trip', 1, { id: 'trip' })
  r = addRow(r, [...at, 'trip'], 'requirement', 'Destination agreed', 2, { id: 'where', requirement: { capability: 'confirmation' } })
  r = addTask(r, at, 'Oslo', 3, 'oslo')
  return instantiateTemplate(r, at, 'oslo', 'trip', 4)
}
const edgeOf = (r: Replica, at: string[], id: string) => valueContent(r.store, resolveScope(r.store, headCid(r), at)!).children.find(e => content(r.store, e[1]).data.alias?.id === id)!

test('a task made from a template row is the edge [template, task], pinned to that version', () => {
  let r = withTrip(createReplica('p'))
  const templateValue = valueCidOf(r.store, resolveScope(r.store, headCid(r), ['trip'])!)
  expect(edgeOf(r, [], 'oslo')[0]).toBe(templateValue)
  expect(edgeOf(r, [], 'trip')[0]).toBe(rowTemplate(r.store, 'template'))
  const oslo = userView(r)!.tasks.find(t => t.id === 'oslo')!
  expect(oslo).toMatchObject({ kind: 'task', template: { id: 'trip', name: 'Trip' } })
  expect(view(r, ['oslo'])!.tasks.map(t => t.kind)).toEqual(['requirement'])
  // editing the template does not change what existing instances are made from
  r = addRow(r, ['trip'], 'requirement', 'Dates agreed', 5, { id: 'when', requirement: { capability: 'confirmation' } })
  expect(edgeOf(r, [], 'oslo')[0]).toBe(templateValue)
  expect(view(r, ['oslo'])!.tasks).toHaveLength(1)
})

test('copying a subtree pins copied instances to the copied template; outside templates stay pinned', () => {
  let r = addTask(createReplica('p'), [], 'Plans', 1, 'plans')
  r = withTrip(r, ['plans'])
  r = addTask(r, [], 'Archive', 5, 'archive')
  r = copyNode(r, [], 'plans', [], { into: 'archive' }, 6)
  const copy = view(r, ['archive'])!.tasks[0]!
  const copiedTrip = view(r, ['archive', copy.id])!.tasks.find(t => t.kind === 'template')!
  const copiedOslo = view(r, ['archive', copy.id])!.tasks.find(t => t.title === 'Oslo')!
  expect(copiedOslo.template).toEqual({ id: copiedTrip.id, name: 'Trip' })
  expect(copiedTrip.id).not.toBe('trip')
  // copying only the instance keeps it pinned to the original template
  r = copyNode(r, ['plans'], 'oslo', [], { into: 'archive' }, 7)
  expect(view(r, ['archive'])!.tasks.find(t => t.title === 'Oslo')!.template).toEqual({ id: 'trip', name: 'Trip' })
})

describe('node sync with pinned templates', () => {
  const request: NodeRequest = { peerId: 'device', scope: [], path: [], linkId: 'device-link' }
  const authority: NodeAuthority = { peerId: 'device', scope: [], owner: true, capabilities: ['provideNode', 'sync'] }

  test('a row pinned to a template the receiver lacks is a reference error until it requests the template', () => {
    let server = withTrip(createReplica('server'))
    const served = exchangeNode(server, request, authority, 10); server = served.replica
    const oslo = served.node.children.find(c => c.id === 'oslo')!
    expect(oslo).toMatchObject({ kind: 'task', template: edgeOf(server, [], 'oslo')[0] })
    // every row carries what it is made from: here the root's installed Template row type
    expect(served.node.children.find(c => c.id === 'trip')!.template).toBe(rowTemplate(server.store, 'template'))

    let device = acceptProvidedNode(createReplica('device'), [], request, served.node, 11)
    expect(userView(device)!.tasks.find(t => t.id === 'oslo')!.missingTemplate).toEqual({ kind: 'task' })
    // reported on the wire as the row it stands for, so it is not a local change
    expect(nodeShape(device, []).children.find(c => c.id === 'oslo')).toMatchObject({ kind: 'task', template: oslo.template })
    const missing = missingTemplatesAt(device, [])
    expect(missing).toEqual([oslo.template])

    // only templates the served rows are pinned to are handed out
    expect(exchangeNode(server, { ...request, templates: [rowTemplate(server.store, 'task')] }, authority, 12).node.templates).toBeUndefined()
    const reply = exchangeNode(server, { ...request, templates: missing }, authority, 12)
    device = acceptTemplateNodes(device, [], reply.node.templates!, 13)
    expect(missingTemplatesAt(device, [])).toEqual([])
    expect(userView(device)!.tasks.find(t => t.id === 'oslo')!).toMatchObject({ template: { id: 'trip', name: 'Trip' } })
    expect(userView(device)!.tasks.find(t => t.id === 'oslo')!.missingTemplate).toBeUndefined()
  })

  test('a provider that receives a row pinned to a template it lacks asks for it and resolves it', () => {
    let server = createReplica('server')
    const first = exchangeNode(server, request, authority, 10); server = first.replica
    let device = acceptProvidedNode(createReplica('device'), [], request, first.node, 11)
    device = withTrip(device)
    const pushed = exchangeNode(server, { ...request, update: { base: first.node, value: nodeShape(device, []) } }, authority, 12); server = pushed.replica
    const template = edgeOf(device, [], 'oslo')[0]
    expect(userView(server)!.tasks.find(t => t.id === 'oslo')!.missingTemplate).toEqual({ kind: 'task' })
    expect(pushed.node.wanted).toEqual([template])
    // the row is held by the device (a peer reference here) and keeps its template on the edge
    expect(pushed.node.children.find(c => c.id === 'oslo')).toMatchObject({ kind: 'ref', template })

    const nodes = templateNodesAt(device, [], pushed.node.wanted!)!
    const answered = exchangeNode(server, { ...request, templateNodes: nodes }, authority, 13); server = answered.replica
    expect(answered.node.wanted).toBeUndefined()
    expect(userView(server)!.tasks.find(t => t.id === 'oslo')!).toMatchObject({ template: { id: 'trip', name: 'Trip' } })
    expect(userView(server)!.tasks.find(t => t.id === 'oslo')!.missingTemplate).toBeUndefined()
    expect(edgeOf(server, [], 'oslo')[0]).toBe(template)
  })
})
