/**
 * One-time bootstrap of the standard library in the pattern-row model: writes `.fos/library.json`. Run once with
 * `node scripts/bootstrap-library.cjs`, then edit the library in the app and export it as usual.
 *
 * A type is a node of rows `[field, value | void]`: the left is the field, `void` on the right is a hole that must be
 * supplied. Parameters are refs declared in their constructor. Only primitives are read by host code.
 */
import type { FosNodeContent, FosNodesData, FosPathElem } from '../shared/types'
import { hashContent, putNode, type FosStore } from '../shared/dag-implementation/store'
import { primitive } from '../shared/sync/primitives'
import { putBranches } from '../shared/sync/graph'
import { FOS_DATA_VERSION } from '../shared/version'

const store: FosStore = { table: new Map(), rootNodeId: '', implementations: new Map() }
const put = (node: FosNodeContent) => putNode(store, node)
const unit = put({ data: {}, children: [] })
const P = (name: string) => primitive(store, name)
const name = P('name'), string = P('string'), number = P('number'), boolean = P('boolean'), never = P('void')
const text = (value: string) => put({ data: { scalar: { type: 'text', value } }, children: [] })
const node = (...rows: FosPathElem[]) => put({ data: {}, children: rows })
/** A ref named `label`, holding `value` (none: declared, unfilled). */
const ref = (label: string, value: string | null = null) => {
  const children: FosPathElem[] = value ? [[P('target'), value]] : []
  children.push([P('alias'), unit])
  return put({ data: { alias: { id: hashContent({ data: { name: { content: label } }, children: [] }) }, name: { content: label } }, children })
}

// field constructors: a string type and a unit type, each parameterized by a string (its `alias`, a local ref)
const alias = ref('alias')
const stringAlias = node([name, text('stringAlias')], [alias, string])
const tag = node([name, text('tag')], [alias, string])
const stringAliasOf = (value: string) => node([name, text('stringAlias')], [alias, text(value)])
const tagOf = (value: string) => node([name, text('tag')], [alias, text(value)])
/** A text field: told apart by its alias, holding one string. */
const textField = (field: string) => node([name, text(field)], [stringAliasOf(field), string])
/** A text field's value. */
const fill = (field: string, value: string) => node([name, text(field)], [stringAliasOf(field), text(value)])

const title = textField('title'), body = textField('body'), label = textField('label'), syntax = textField('syntax')
const done = tagOf('done')
// a sum: either an emoji or a Font Awesome id, as the choice node submissions to one ref make
const icon = putBranches(store, 'icon', null, ['emojiValue', 'fontAwesomeId'].map(option => ({ peerId: option, edge: [stringAliasOf(option), string] })), 'emojiValue')
const username = textField('username'), displayName = textField('displayName'), publicKey = textField('publicKey')
const path = textField('path'), sha256 = textField('sha256'), peer = textField('peer'), method = textField('method')
const by = textField('by'), issuedAt = node([name, text('issuedAt')], [stringAliasOf('issuedAt'), number]), attestation = textField('attestation')
const filename = textField('filename'), data = textField('data'), markdown = textField('markdown')

const type = (typeName: string, ...rows: FosPathElem[]) => node([name, text(typeName)], ...rows)
const Home = type('Home')
const types: Record<string, string> = {
  library: type('Library'),
  documentRoot: type('Document root'),
  home: Home,
  deviceRoot: type('Device root', [Home, unit]),
  task: type('Task', [title, never], [done, unit]),
  note: type('Note', [title, never], [body, never]),
  comment: type('Comment', [body, never]),
  specification: type('Specification', [title, never], [body, never]),
  ref: type('Reference'),
  query: type('Query', [title, never]),
  resource: type('Bank', [title, never]),
  template: type('Template', [title, never]),
  allocation: type('Allocation'),
  money: type('Money'),
  people: type('People'),
  person: type('Person', [username, never], [displayName, unit]),
  user: type('User', [username, never], [displayName, unit], [publicKey, unit]),
  attestation: type('Attestation', [by, never], [method, unit], [issuedAt, unit], [attestation, unit]),
  attachment: type('Attachment', [filename, never], [data, never]),
  fileReference: type('File reference', [path, never], [sha256, unit]),
  relayQueue: type('Relay queue', [peer, never]),
  relayMessage: type('Relay message', [peer, never]),
  relayAck: type('Relay acknowledgement', [title, never]),
  listText: type('List of text'),
  // fields and value types, reachable by name
  title, body, label, syntax, done, icon, stringAlias, tag, username, displayName, path, markdown,
  text: string, number, time: number, boolean, peer
}

/** The capabilities: what a requirement row asks for (`[capability<inputs>, void]`, its right the handler's answer). */
type Capability = { label: string; syntax: string[]; inputs?: Array<[string, string?]>; trigger?: NonNullable<FosNodeContent['data']['triggerDefinition']> }
const capabilities: Record<string, Capability> = {
  approve: { label: 'attested approvals', syntax: ['approve'] }, edit: { label: 'edit (propose and decide proposals)', syntax: ['edit'] },
  persist: { label: 'persist storage', syntax: ['persist'] }, task: { label: 'task', syntax: ['task'] }, notify: { label: 'notify', syntax: ['notify'] },
  allocation: { label: 'allocation', syntax: ['allocation'] }, peer: { label: 'peer connection', syntax: ['peer'] }, sign: { label: 'sign a node', syntax: ['sign'] },
  solve: { label: 'solutions by unification', syntax: ['solve'] }, confirmation: { label: 'confirmation', syntax: ['confirm', 'confirmation'] },
  choice: { label: 'choice', syntax: ['choice'] }, allocate: { label: 'allocate', syntax: ['allocate'] }, ws: { label: 'websockets', syntax: ['ws'] },
  points: { label: 'fos points', syntax: ['points'] }, market: { label: 'market', syntax: ['market'] }, rank: { label: 'rank', syntax: ['rank'] },
  llm: { label: 'language model', syntax: ['llm', 'ai', 'ask'] }, fetch: { label: 'network requests', syntax: ['fetch'], inputs: [['url'], ['method', 'GET']] },
  url: { label: 'links to published nodes', syntax: ['url'] }, mail: { label: 'mail', syntax: ['mail'], inputs: [['to'], ['subject']] },
  provideNode: { label: 'provide nodes', syntax: ['provideNode'] }, verify: { label: 'verify users', syntax: ['verify'] },
  'receive-payment': { label: 'receive payment', syntax: ['receive-payment'] }, organize: { label: 'organize captures', syntax: ['organize'] },
  title: { label: 'titles from text', syntax: ['title'] }, 'read-requests': { label: 'read requests', syntax: ['read-requests'] },
  'request-payment': { label: 'request payment', syntax: ['request-payment'] }, local: { label: 'this machine (files)', syntax: ['local'] },
  tool: { label: 'tools', syntax: ['tool', 'mcp'], inputs: [['tool']] }, approveMerge: { label: 'merge rules', syntax: ['approveMerge'] },
  search: { label: 'search', syntax: ['?', 'search'] }, autopush: { label: 'autopush', syntax: ['autopush'] }, relay: { label: 'relay', syntax: ['relay'] },
  execute: { label: 'run evaluations', syntax: ['execute'] }, repo: { label: 'repositories', syntax: ['repo'] },
  'verify-signature': { label: 'verify a signature', syntax: ['verify-signature'] }, calendar: { label: 'calendar', syntax: ['calendar'] },
  sync: { label: 'traverse and sync', syntax: ['sync'] }, http: { label: 'http', syntax: ['http'] }, 'send-payment': { label: 'send payment', syntax: ['send-payment'] },
  direct: { label: 'direct connect', syntax: ['direct'] }, read: { label: 'read', syntax: ['read'] },
}
// the trigger capabilities keep their trigger definitions as data until triggers are rows
const old = require('../.fos/library.json') as { nodes: FosNodesData }
for (const value of Object.values(old.nodes)) {
  const definition = value.data.capabilityDefinition, trigger = value.data.triggerDefinition
  if (definition && trigger) capabilities[definition.name] = { label: definition.label, syntax: definition.syntax ?? [definition.name], trigger }
}
const capability = (capabilityName: string, c: Capability) => put({
  data: c.trigger ? { triggerDefinition: c.trigger } : {},
  children: [[name, text(capabilityName)], [label, fill('label', c.label)], ...c.syntax.map((s): FosPathElem => [syntax, fill('syntax', s)]),
    ...(c.inputs ?? []).map(([input, value]): FosPathElem => [ref(input, value === undefined ? null : text(value)), string])]
})
const capabilityGroup = node(...Object.entries(capabilities).map(([capabilityName, c]): FosPathElem => [capability(capabilityName, c), ref(capabilityName)]))

const library = node(
  ...Object.entries(types).map(([field, value]): FosPathElem => [unit, ref(field, value)]),
  [unit, ref('capabilities', capabilityGroup)]
)

const nodes: FosNodesData = {}
const visit = (cid: string) => {
  if (nodes[cid]) return
  const value = store.table.get(cid)!
  nodes[cid] = value
  for (const edge of value.children) for (const end of edge) visit(end)
}
visit(library)
const out = { version: FOS_DATA_VERSION, rootNodeId: library, nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))) }
require('fs').writeFileSync(require('path').join(__dirname, '..', '.fos', 'library.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`[library] bootstrapped ${Object.keys(nodes).length} nodes`)
