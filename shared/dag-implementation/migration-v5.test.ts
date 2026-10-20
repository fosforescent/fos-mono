/**
 * cid v4 → v5 on real-shaped data. `fixtures/v4-replica.json` is a device replica written by the release build
 * (543d665: rows pinned to the alias-less seed types, notes as Markdown descriptions, comments with `data.comment`)
 * and then by main (990cad3: library types with `behavior: builtin:*`, templates with `behavior: builtin:task`, graph
 * notes and comments, payments settled with a separate supply), its history cut to one version per node.
 */
import * as fs from 'fs'
import * as path from 'path'
import { FosStore } from './store'
import { cidVersion, CURRENT_CID_VERSION, hashContentAt } from './cid'
import { migrateContext } from './migrations'
import type { FosContextData, FosNodeContent, FosNodesData, FosPathElem } from '../types'
import { loadReplica, headCid, view, type SerializedReplica } from '../sync/replica'
import { content, identityCid, libraryTypeAt, resolveScope, rootTargetCid, rowTypeOf, typeIdOf, valueContent } from '../sync/graph'
import { constructForm } from '../sync/forms'
import { nodeSyncKey } from '../sync/node-sync'
import { COMMENT_TYPE, MONEY_TYPE, NOTE_TYPE } from '../sync/library-types'

const fixture = (): SerializedReplica => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v4-replica.json'), 'utf8'))
const HOME = ['fos:home']

function environment() {
  const store = new FosStore()
  return { table: store.table, primitive: store.primitive as unknown as Record<string, { getId(): string }> }
}

/** Every row under `at`, depth first, without the field rows of constructed values. */
function rows(r: ReturnType<typeof loadReplica>, at: string[] = HOME): Array<Record<string, unknown>> {
  return (view(r, at)?.tasks ?? []).filter((t) => !t.id.includes('/field/')).flatMap((t) => [
    {
      id: t.id, type: t.type, done: t.done, checkable: t.checkable,
      ...(t.text ? { markdown: t.text.mediaType === 'text/markdown' } : {}),
      ...(t.author ? { author: `${t.author.name}/${t.author.id}` } : {}),
      ...(t.requirement ? { requirement: `${t.requirement.capability} ${t.requirement.resource ?? ''} ${t.requirement.amount ?? ''}`.trim() } : {}),
      ...(t.supply ? { supply: `${t.supply.capability} by ${t.supply.by}` } : {}),
      ...(t.allocation ? { allocation: `${t.allocation.type} ${t.allocation.amount}` } : {}),
      ...(t.template ? { template: t.template.name } : {})
    },
    ...rows(r, [...at, t.id]).map((row) => ({ ...row, id: `${t.id}/${row.id}` }))
  ])
}

const byId = (list: Array<Record<string, unknown>>, id: string) => list.find((row) => row.id === id)

describe('v4 → v5: row types are told apart by graph identity alone', () => {
  it('migrates the stored replica: every node in v5, no legacy markers left', () => {
    const r = loadReplica(fixture())
    expect(r.store.migration?.fromVersions).toEqual([4])
    expect([...r.store.table.keys()].every((cid) => cidVersion(cid) === CURRENT_CID_VERSION)).toBe(true)
    for (const node of r.store.table.values()) {
      expect(node.data.instanceKind).toBeUndefined()
      expect(node.data.behavior?.content?.startsWith('builtin:') ?? false).toBe(false)
    }
  })

  it('gives every row its type back: tasks with checkboxes, notes, comments, money, templates and their instances', () => {
    const list = rows(loadReplica(fixture()))
    const pick = (id: string) => byId(list, id)
    // tasks keep their done state and checkbox, nested rows stay where they were
    expect(pick('open')).toMatchObject({ type: 'lib:type:task', checkable: true, done: false })
    expect(pick('done')).toMatchObject({ type: 'lib:type:task', checkable: true, done: true })
    expect(pick('done/sub')).toMatchObject({ type: 'lib:type:task', checkable: true })
    expect(pick('done/sub/deep')).toMatchObject({ type: 'lib:type:plain', checkable: false })
    // release-era notes and comments are values of the library's constructors; main-era ones were already
    expect(pick('note')).toMatchObject({ type: NOTE_TYPE, markdown: true })
    expect(pick('note/note-child')).toMatchObject({ type: 'lib:type:task', checkable: true })
    expect(pick('comment')).toMatchObject({ type: COMMENT_TYPE, author: 'Alice/alice-id' })
    expect(pick('comment/reply')).toMatchObject({ type: COMMENT_TYPE, author: 'Bob/bob-id' })
    expect(pick('note2')).toMatchObject({ type: NOTE_TYPE, markdown: true })
    expect(pick('comment2')).toMatchObject({ type: COMMENT_TYPE, author: 'Carol/carol-id' })
    // money: a negative row is a request, a positive one a payment; points stay allocations
    expect(pick('lunch/request')).toMatchObject({ type: MONEY_TYPE, requirement: 'allocation account 50' })
    expect(pick('lunch/payment')).toMatchObject({ type: MONEY_TYPE, supply: 'allocation by ', allocation: 'account 20' })
    expect(pick('lunch/points')).toMatchObject({ type: 'lib:type:allocation', requirement: 'allocation points 5' })
    expect(pick('lunch/confirm/confirmed')).toMatchObject({ type: 'lib:type:allocation', supply: 'confirmation by alice' })
    // a settled payment fills its request alone: the supply the old settlement wrote beside it is gone
    for (const request of ['lunch/taxi', 'dinner/tickets']) {
      expect(pick(request)).toMatchObject({ type: MONEY_TYPE, requirement: 'allocation account 30' })
      const under = list.filter((row) => (row.id as string).startsWith(`${request}/`))
      expect(under).toHaveLength(1)
      expect(under[0]).toMatchObject({ type: MONEY_TYPE, supply: 'allocation by fos', allocation: 'account 30' })
    }
    // templates (release: instanceKind, main: builtin behavior) and the tasks made from them
    expect(pick('trip')).toMatchObject({ type: 'lib:type:template' })
    expect(pick('trip/budget')).toMatchObject({ type: MONEY_TYPE, requirement: 'allocation account 200' })
    expect(pick('oslo')).toMatchObject({ type: 'trip', checkable: true, done: false, template: 'Trip' })
    expect(pick('bergen')).toMatchObject({ type: 'visit', checkable: true, done: true, template: 'Visit' })
    expect(list.filter((row) => (row.id as string).startsWith('oslo/')).map((row) => row.type)).toEqual(['lib:type:task', MONEY_TYPE])
    expect(pick('query')).toMatchObject({ type: 'lib:type:query' })
    expect(pick('pool')).toMatchObject({ type: 'lib:type:resource' })
    expect(list.find((row) => row.type === 'lib:type:ref')).toBeTruthy()
    expect(list.filter((row) => !row.type)).toEqual([])
  })

  it('pins rows of every era to one version per type: the library’s own', () => {
    const r = loadReplica(fixture()), store = r.store
    const versions = new Map<string, Set<string>>()
    const seen = new Set<string>()
    const walk = (cid: string) => {
      if (seen.has(cid)) return
      seen.add(cid)
      for (const edge of valueContent(store, cid).children) {
        const type = rowTypeOf(store, edge)
        const id = type ? typeIdOf(store, type) : null
        if (type && id?.startsWith('lib:type:')) (versions.get(id) ?? versions.set(id, new Set()).get(id)!).add(type)
        walk(identityCid(store, edge))
      }
    }
    walk(rootTargetCid(store))
    expect(versions.size).toBeGreaterThan(8)
    for (const [id, types] of versions) expect([id, [...types]]).toEqual([id, [libraryTypeAt(store, id)]])
  })

  it('builds notes and comments as the live constructors would, keeping their rows and text parameters', () => {
    const r = loadReplica(fixture()), store = r.store
    const value = (id: string) => valueContent(store, resolveScope(store, headCid(r), [...HOME, id])!)
    const note = value('note')
    const fresh = constructForm(store, libraryTypeAt(store, NOTE_TYPE)!, 'note', { text: '# Plan\n\nSome **markdown** with {place}' }, note.data.created!.time)
    expect(note.data.presentation).toEqual(fresh.data.presentation)
    expect(note.children.slice(0, fresh.children.length)).toEqual(fresh.children)
    // the {place} parameter it already had is kept, not bound twice; its child task stays
    expect(note.children.filter(([, cid]) => content(store, cid).data.name?.content === 'place')).toHaveLength(1)
    const comment = value('comment')
    const made = constructForm(store, libraryTypeAt(store, COMMENT_TYPE)!, 'comment', { text: 'Looks good to me', author: { id: 'alice-id', name: 'Alice' } }, comment.data.updated!.time)
    expect(comment.children.slice(0, made.children.length)).toEqual(made.children)
    expect(comment.data.comment).toBeUndefined()
    expect(comment.data.description).toBeUndefined()
  })

  it('is deterministic and idempotent: the server and a device migrate the same v4 store to the same cids', () => {
    const input = fixture()
    const trellisData = new FosStore().exportContext([]).trellisData
    // the account server loads a store with `new FosStore` (dbToStore), the device with `loadReplica`
    const server = new FosStore({ fosCtxData: { fosData: input.context as FosContextData, trellisData } })
    const device = loadReplica(input)
    expect(server.remapCid(input.context.rootNodeId)).toBe(server.rootNodeId)
    const home = (store: FosStore) => resolveScope(store, rootTargetCid(store), HOME)
    expect(home(server)).toBe(home(device.store))
    // migrating the result again changes nothing
    const again = migrateContext(server.exportContext([]).fosData, undefined, environment())
    expect(again.mapping).toEqual({})
  })

  it('remaps the types and pinned grants a device’s node sync records name', () => {
    const input = fixture()
    const store = new FosStore({ fosCtxData: { fosData: input.context as FosContextData, trellisData: new FosStore().exportContext([]).trellisData } })
    const [oldType, newType] = Object.entries(store.migration!.mapping).find(([old]) => (input.context.nodes[old] as FosNodeContent).data.behavior)!
    const shape = { data: {}, children: [{ id: 'open', address: { scope: ['open'] }, template: oldType, pinned: oldType }] }
    const key = nodeSyncKey('user:a', [])
    const r = loadReplica({ ...input, meta: { ...input.meta, nodeSync: { [key]: { local: shape, remote: shape } } } })
    expect(r.meta.nodeSync![key]!.local.children[0]).toMatchObject({ template: newType, pinned: newType })
  })

  it('degrades unknown markers to the plain row type, keeps reference errors and converts rows inside pointers', () => {
    const fresh = new FosStore(), p = fresh.primitive
    // the primitives as a v4 store holds them
    const nodes: FosNodesData = {}
    const v4 = (cid: string): string => {
      const node = fresh.table.get(cid)!
      const out = hashContentAt({ data: node.data, children: node.children.map(([a, b]): FosPathElem => [v4(a), v4(b)]) }, 4)
      nodes[out] = { data: node.data, children: node.children.map(([a, b]): FosPathElem => [v4(a), v4(b)]) }
      return out
    }
    const add = (node: FosNodeContent) => { const cid = hashContentAt(node, 4); nodes[cid] = node; return cid }
    const IP = v4(p.instructionPointerConstructor.getId()), TP = v4(p.targetPointerConstructor.getId()), ROOT = v4(p.rootInstructionNode.getId())
    const PREV = v4(p.previousVersion.getId()), TERMINAL = v4(p.terminal.getId()), CHOICE = v4(p.choiceTarget.getId())
    const widget = add({ data: { description: { content: 'Widget' }, instanceKind: { kind: 'widget' }, behavior: { content: 'builtin:widget' } }, children: [] })
    const note = add({ data: { description: { content: 'Note' }, instanceKind: { kind: 'note' }, behavior: { content: 'builtin:note' } }, children: [] })
    const allocation = add({ data: { alias: { id: 'lib:type:allocation' }, description: { content: 'Allocation' }, behavior: { content: 'builtin:allocation' } }, children: [] })
    const missing = add({ data: { description: { content: 'Reference error' }, instanceKind: { kind: 'reference-error' }, missingTemplate: { cid: 'v4-gone', kind: 'task' } } as FosNodeContent['data'], children: [] })
    const leaf = add({ data: { alias: { id: 'leaf' }, description: { content: 'leaf' } }, children: [] })
    const gadget = add({ data: { alias: { id: 'gadget' }, description: { content: 'Gadget' }, custom: { content: 'kept' } } as FosNodeContent['data'], children: [[widget, leaf]] })
    const waiting = add({ data: { alias: { id: 'waiting' }, description: { content: 'Waiting' } }, children: [] })
    // a choice between two versions of a note, one of them a money request (pointer nodes: [IP, type], [TP, row])
    const draft = add({ data: { alias: { id: 'draft' }, description: { content: '*draft* {who}' }, updated: { time: 7 } }, children: [] })
    const pay = add({ data: { alias: { id: 'draft' }, description: { content: 'pay' }, allocation: { capability: 'allocation', resource: '', type: 'account', amount: -5, unit: 'USD' } }, children: [] })
    const optionA = add({ data: { peerId: { content: 'a' } }, children: [[IP, note], [TP, draft]] })
    const optionB = add({ data: { peerId: { content: 'b' } }, children: [[IP, allocation], [TP, pay]] })
    const choice = add({ data: { alias: { id: 'draft' }, choice: { content: 'draft' } } as FosNodeContent['data'], children: [[CHOICE, optionA], [CHOICE, optionB]] })
    const doc = add({ data: {}, children: [[widget, gadget], [missing, waiting], [CHOICE, choice]] })
    const root = add({ data: { alias: { id: 'doc' } }, children: [[TP, doc], [IP, ROOT], [PREV, TERMINAL]] })
    const store = new FosStore({ fosCtxData: { fosData: { nodes, route: [], rootNodeId: root }, trellisData: fresh.exportContext([]).trellisData } })
    const children = content(store, rootTargetCid(store)).children
    // an unknown kind is a version of the plain row type; the row keeps its data and rows
    expect(typeIdOf(store, children[0]![0])).toBe('lib:type:plain')
    expect(content(store, children[0]![0]).data).toEqual({ alias: { id: 'lib:type:plain' }, description: { content: 'Widget' } })
    expect(content(store, children[0]![1]).data).toMatchObject({ alias: { id: 'gadget' }, custom: { content: 'kept' } })
    expect(content(store, children[0]![1]).children.map(([type, row]) => [typeIdOf(store, type), content(store, row).data.alias?.id])).toEqual([['lib:type:plain', 'leaf']])
    // a reference error still waits for its template
    expect(content(store, children[1]![0]).data).toEqual({ description: { content: 'Reference error' }, missingTemplate: { cid: 'v4-gone' } })
    // inside the choice: the note alternative is a constructed note with its parameter bound, the money one pinned to Money
    const [a, b] = content(store, children[2]![1]).children.map(([, option]) => content(store, option).children)
    expect(typeIdOf(store, a![0]![1])).toBe(NOTE_TYPE)
    const rebuilt = content(store, a![1]![1])
    expect(rebuilt.data.presentation?.text).toEqual({ interpolate: true, mediaType: 'text/markdown' })
    expect(rebuilt.children.map(([, cid]) => content(store, cid).data.name?.content)).toEqual(['body', 'who'])
    expect(typeIdOf(store, b![0]![1])).toBe(MONEY_TYPE)
    expect(content(store, b![1]![1]).data.allocation).toMatchObject({ type: 'account', amount: -5 })
  })
})
