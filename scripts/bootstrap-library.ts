/**
 * One-time bootstrap of the standard library in the pattern-row model: writes `.fos/library.json`. Run once with
 * `node scripts/bootstrap-library.cjs`, then edit the library in the app and export it as usual.
 *
 * A type is its structure: a node of rows `[field, value | void]`, the left the field, `void` on the right a hole that
 * must be supplied. Name rows only tell apart constructors of the same structure (stringAlias, tag); a type with no
 * fields of its own carries a tag. Parameters are refs declared in their constructor. Only primitives are read by host code.
 */
import type { FosNodeContent, FosNodesData, FosPathElem } from '../shared/types'
import { hashContent, putNode, type FosStore } from '../shared/dag-implementation/store'
import { primitive } from '../shared/sync/primitives'
import { putBranches } from '../shared/sync/graph'
import { FOS_DATA_VERSION } from '../shared/version'

const store: FosStore = { table: new Map(), rootNodeId: '', implementations: new Map() }
const put = (node: FosNodeContent) => putNode(store, node)
const content = (cid: string) => store.table.get(cid)!
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
const textField = (field: string) => node([stringAliasOf(field), string])
/** A text field's value. */
const fill = (field: string, value: string) => node([stringAliasOf(field), text(value)])

const title = textField('title'), body = textField('body'), label = textField('label'), syntax = textField('syntax')
const done = tagOf('done')
// a sum: either an emoji or a Font Awesome id, as the choice node submissions to one ref make
const icon = putBranches(store, 'icon', null, ['emojiValue', 'fontAwesomeId'].map(option => ({ peerId: option, edge: [stringAliasOf(option), string] })), 'emojiValue')
const username = textField('username'), displayName = textField('displayName'), publicKey = textField('publicKey'), account = textField('account')
const verifiedBy = textField('verifiedBy'), verifyMethod = textField('verifyMethod')
const path = textField('path'), sha256 = textField('sha256'), peer = textField('peer'), method = textField('method')
const by = textField('by'), issuedAt = node([stringAliasOf('issuedAt'), number]), attestation = textField('attestation')
const filename = textField('filename'), data = textField('data'), markdown = textField('markdown'), mediaType = textField('mediaType')
const size = node([stringAliasOf('size'), number])
// an allocation's rows: what resource, how much of it, when, from whom, where (a grant also carries its nonce)
const numberField = (field: string) => node([stringAliasOf(field), number])
const amount = numberField('amount'), unitField = textField('unit'), resourceType = textField('resourceType'), start = numberField('start'), end = numberField('end')
const at = numberField('at'), bank = textField('bank'), place = textField('place'), lat = numberField('lat'), lng = numberField('lng'), nonce = textField('nonce')

/** A type the kernel tells apart (Home, Device root, Library, Document root, …): a tag, since the empty node is the wildcard; folder-like types are just `{}`. */
const tagged = (tagName: string, ...rows: FosPathElem[]) => node([tagOf(tagName), unit], ...rows)
const Home = tagged('home')
const types: Record<string, string> = {
  library: tagged('library'),
  documentRoot: tagged('documentRoot'),
  home: Home,
  deviceRoot: tagged('deviceRoot', [Home, unit]),
  task: node([title, never], [done, unit]),
  note: node([title, never], [body, never]),
  comment: node([body, never]),
  specification: tagged('specification', [title, never], [body, never]),
  ref: tagged('ref'),
  query: tagged('query', [title, never]),
  resource: tagged('bank', [title, never]),
  template: tagged('template', [title, never]),
  allocation: node(),
  money: node(),
  people: node(),
  person: node([username, never], [displayName, unit]),
  user: node([account, unit], [username, never], [displayName, unit], [publicKey, unit], [verifiedBy, unit], [verifyMethod, unit], [issuedAt, unit], [attestation, unit]),
  attestation: node([by, never], [method, unit], [issuedAt, unit], [attestation, unit]),
  attachment: node([filename, never], [mediaType, never], [data, never], [size, never]),
  fileReference: node([path, never], [sha256, never], [size, never]),
  relayQueue: tagged('relayQueue', [peer, never]),
  relayMessage: tagged('relayMessage', [peer, never]),
  relayAck: tagged('relayAck', [title, never]),
  listText: node(),
  // fields and value types, reachable by name
  title, body, label, syntax, done, icon, stringAlias, tag, username, displayName, path, markdown,
  amount, unit: unitField, resourceType, start, end, by, at, bank, place, lat, lng, nonce,
  text: string, number, time: number, boolean, peer
}

/**
 * The capabilities: a capability is a ref whose value is a pattern with holes (`mail<to, subject>`): told apart by its
 * tag, its inputs refs declared in it (`[string, ref to]`: the left types the hole). A requirement row asks for one (`[mail<to: bob>, ref → unit]`); a handler is a
 * value matching it. What a menu shows (its title, syntax, icon) is on the ref, never in the pattern.
 */
type Capability = { label: string; syntax: string[]; inputs?: Array<[string, string?]>; time?: string[]; icon?: string; hidden?: true }
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
// the triggers: what starts an evaluation (their own inputs say when)
Object.assign(capabilities, {
  cron: { label: 'Cron trigger', syntax: ['cron'], icon: 'repeat', inputs: [['expression']] },
  timer: { label: 'Timer trigger', syntax: ['timer'], icon: 'hourglass', time: ['due'] },
  request: { label: 'On request', syntax: ['request'], icon: 'request' },
  'task-completion': { label: 'Child evaluation', syntax: ['task-completion'], icon: 'flag' },
  'ref-change': { label: 'Reference change', syntax: ['ref-change'], icon: 'link', hidden: true },
  response: { label: 'On response', syntax: ['response'], icon: 'reply', hidden: true },
} satisfies Record<string, Capability>)
const capability = (capabilityName: string, c: Capability) => tagged(capabilityName,
  ...(c.inputs ?? []).map(([input, value]): FosPathElem => [string, ref(input, value === undefined ? null : text(value))]),
  ...(c.time ?? []).map((input): FosPathElem => [number, ref(input)]))
/** The ref a capability is assigned to: its pattern as its value, its title, syntax and icon as its own rows. */
const capabilityRef = (capabilityName: string, c: Capability, pattern: string) => {
  const own = ref(capabilityName, pattern), id = content(own).data.alias!.id
  const titled = put({ data: { alias: { id: hashContent({ data: { alias: { id } }, children: [[title, title]] }) } }, children: [[P('target'), fill('title', c.label)], [P('alias'), unit]] })
  return put({ ...content(own), children: [...content(own).children, [title, titled], ...c.syntax.map((s): FosPathElem => [syntax, fill('syntax', s)]),
    ...(c.icon ? [[icon, fill('fontAwesomeId', c.icon)] as FosPathElem] : []), ...(c.hidden ? [[tagOf('hidden'), unit] as FosPathElem] : [])] })
}
const capabilityGroup = node(...Object.entries(capabilities).map(([capabilityName, c]): FosPathElem => {
  const pattern = capability(capabilityName, c)
  return [pattern, capabilityRef(capabilityName, c, pattern)]
}))

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
