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
import { constructNodeValue } from '../shared/sync/node-values'
import { FOS_DATA_VERSION } from '../shared/version'

const store: FosStore = { table: new Map(), rootNodeId: '', implementations: new Map() }
const put = (node: FosNodeContent) => putNode(store, node)
const content = (cid: string) => store.table.get(cid)!
const unit = put({ data: {}, children: [] })
const P = (name: string) => primitive(store, name)
const name = P('name'), string = P('string'), number = P('number'), boolean = P('boolean'), never = P('void')
const text = (value: string) => put({ data: { scalar: { type: 'text', value } }, children: [] })
const node = (...rows: FosPathElem[]) => put({ data: {}, children: rows })
/** A field ref's identity: its field's (fields.ts `fieldRefId`). */
const fieldRefId = (field: string) => hashContent({ data: { name: { content: 'field' } }, children: [[field, field]] })
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

const title = textField('title'), body = textField('body'), author = textField('author'), label = textField('label'), syntax = textField('syntax')
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
  comment: node([body, never], [author, never]),
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
  title, body, author, label, syntax, done, icon, stringAlias, tag, username, displayName, path, markdown,
  amount, unit: unitField, resourceType, start, end, by, at, bank, place, lat, lng, nonce,
  string, number, time: number, boolean, peer
}

/**
 * The capabilities: a capability is a ref whose value is a pattern with holes (`mail<to, subject>`): told apart by its
 * tag, its inputs refs declared in it (`[string, ref to]`: the left types the hole). A requirement row asks for one (`[mail<to: bob>, ref → unit]`); a handler is a
 * value matching it. What a menu shows (its title, syntax, icon) is on the ref, never in the pattern.
 */
type Capability = { label: string; syntax: string[]; inputs?: Array<[string, string?]>; time?: string[]; outputs?: Array<[string, 'string' | 'boolean']>; icon?: string; hidden?: true; trigger?: 'instantiate' | 'resume' }
const capabilities: Record<string, Capability> = {
  approve: { label: 'attested approvals', syntax: ['approve'] }, edit: { label: 'edit (propose and decide proposals)', syntax: ['edit'] },
  persist: { label: 'persist storage', syntax: ['persist'] }, task: { label: 'task', syntax: ['task'] }, notify: { label: 'notify', syntax: ['notify'] },
  allocation: { label: 'allocation', syntax: ['allocation'] }, peer: { label: 'peer connection', syntax: ['peer'] }, sign: { label: 'sign a node', syntax: ['sign'], inputs: [['node'], ['key']], outputs: [['signature', 'string']] },
  solve: { label: 'solutions by unification', syntax: ['solve'] }, confirmation: { label: 'confirmation', syntax: ['confirm', 'confirmation'] },
  choice: { label: 'choice', syntax: ['choice'] }, allocate: { label: 'allocate', syntax: ['allocate'] }, ws: { label: 'websockets', syntax: ['ws'] },
  points: { label: 'fos points', syntax: ['points'] }, market: { label: 'market', syntax: ['market'] }, rank: { label: 'rank', syntax: ['rank'] },
  llm: { label: 'language model', syntax: ['llm', 'ai', 'ask'] }, fetch: { label: 'network requests', syntax: ['fetch'], inputs: [['url'], ['method', 'GET']], outputs: [['response', 'string']] },
  url: { label: 'links to published nodes', syntax: ['url'] }, mail: { label: 'mail', syntax: ['mail'], inputs: [['to'], ['subject']] },
  provideNode: { label: 'provide nodes', syntax: ['provideNode'] }, verify: { label: 'verify users', syntax: ['verify'] },
  'receive-payment': { label: 'receive payment', syntax: ['receive-payment'] }, organize: { label: 'organize captures', syntax: ['organize'] },
  title: { label: 'titles from text', syntax: ['title'] }, 'read-requests': { label: 'read requests', syntax: ['read-requests'] },
  'request-payment': { label: 'request payment', syntax: ['request-payment'] }, local: { label: 'this machine (files)', syntax: ['local'] },
  tool: { label: 'tools', syntax: ['tool', 'mcp'], inputs: [['tool']] }, approveMerge: { label: 'merge rules', syntax: ['approveMerge'] },
  search: { label: 'search', syntax: ['?', 'search'] }, autopush: { label: 'autopush', syntax: ['autopush'] }, relay: { label: 'relay', syntax: ['relay'] },
  execute: { label: 'run evaluations', syntax: ['execute'] }, repo: { label: 'repositories', syntax: ['repo'] },
  'verify-signature': { label: 'verify a signature', syntax: ['verify-signature'], inputs: [['node'], ['key'], ['signature']], outputs: [['valid', 'boolean']] }, calendar: { label: 'calendar', syntax: ['calendar'] },
  sync: { label: 'traverse and sync', syntax: ['sync'] }, http: { label: 'http', syntax: ['http'] }, 'send-payment': { label: 'send payment', syntax: ['send-payment'] },
  direct: { label: 'direct connect', syntax: ['direct'] }, read: { label: 'read', syntax: ['read'] },
}
// the triggers: what starts an evaluation (their own inputs say when)
Object.assign(capabilities, {
  cron: { label: 'Cron trigger', syntax: ['cron'], icon: 'repeat', inputs: [['expression']], trigger: 'instantiate' },
  timer: { label: 'Timer trigger', syntax: ['timer'], icon: 'hourglass', time: ['due'], trigger: 'instantiate' },
  request: { label: 'On request', syntax: ['request'], icon: 'request', trigger: 'instantiate' },
  'task-completion': { label: 'Child evaluation', syntax: ['task-completion'], icon: 'flag', trigger: 'instantiate' },
  'ref-change': { label: 'Reference change', syntax: ['ref-change'], icon: 'link', hidden: true, trigger: 'instantiate' },
  response: { label: 'On response', syntax: ['response'], icon: 'reply', hidden: true, trigger: 'resume' },
} satisfies Record<string, Capability>)
const capability = (capabilityName: string, c: Capability) => tagged(capabilityName,
  ...(c.inputs ?? []).map(([input, value]): FosPathElem => [string, ref(input, value === undefined ? null : text(value))]),
  ...(c.time ?? []).map((input): FosPathElem => [number, ref(input)]),
  // what the handler answers: a ref declared as an output, filled when it runs
  ...(c.outputs ?? []).map(([output, type]): FosPathElem => [P(type), put({ ...content(ref(output)), data: { ...content(ref(output)).data, refRole: 'output' } })]))
/** The ref a capability is assigned to: its pattern as its value, its title, syntax and icon as its own rows. */
const capabilityRef = (capabilityName: string, c: Capability, pattern: string) => {
  const own = ref(capabilityName, pattern), id = content(own).data.alias!.id
  const titled = put({ data: { alias: { id: fieldRefId(title) } }, children: [[P('target'), fill('title', c.label)], [P('alias'), unit]] })
  return put({ ...content(own), children: [...content(own).children, [title, titled], ...c.syntax.map((s): FosPathElem => [syntax, fill('syntax', s)]),
    ...(c.icon ? [[icon, fill('fontAwesomeId', c.icon)] as FosPathElem] : []), ...(c.hidden ? [[tagOf('hidden'), unit] as FosPathElem] : []),
    // a trigger starts evaluations: a new instance of its template, or (resume) the one waiting on it
    ...(c.trigger ? [[tagOf('trigger'), unit] as FosPathElem] : []), ...(c.trigger === 'resume' ? [[tagOf('resume'), unit] as FosPathElem] : [])] })
}
const patterns: Record<string, string> = {}
const capabilityGroup = node(...Object.entries(capabilities).map(([capabilityName, c]): FosPathElem => {
  const pattern = patterns[capabilityName] = capability(capabilityName, c)
  return [pattern, capabilityRef(capabilityName, c, pattern)]
}))

// rows as the kernel builds them (fields.ts): a field ref per type row, its id the field's
const refNode = (data: FosNodeContent['data'], value: string | null, rows: FosPathElem[] = []) =>
  put({ data, children: [...(value ? [[P('target'), value] as FosPathElem] : []), [P('alias'), unit], ...rows] })
const fieldRef = (field: string, value: string | null) => refNode({ alias: { id: fieldRefId(field) } }, value)
const titleRow = (id: string, words: string): FosPathElem => [title, fieldRef(title, fill('title', words))]
const plainRow = (id: string, words: string): FosPathElem => [title, refNode({ alias: { id } }, fill('title', words))]
const taskRow = (id: string, words: string): FosPathElem => [types.task!, put({ data: { alias: { id } }, children: [titleRow(id, words), [done, fieldRef(done, null)]] })]
const noteRow = (id: string, heading: string, markdown: string, data: FosNodeContent['data'] = {}): FosPathElem =>
  [types.note!, put({ data: { alias: { id }, ...data }, children: [titleRow(id, heading), [body, fieldRef(body, fill('body', markdown))]] })]
/** A requirement: `pattern` asked for, its ref a hole titled `words` (or holding the rows typed inside it). */
const ask = (id: string, pattern: string, words: string, inside: FosPathElem[] | null = null, name?: string): FosPathElem =>
  [pattern, refNode({ alias: { id }, ...(name ? { name: { content: name } } : {}) }, inside ? node(...inside) : null, [titleRow(id, words)])]
/** A string variable the template declares: a named ref holding its default. */
const variable = (id: string, name: string, value: string): FosPathElem => [string, refNode({ alias: { id }, name: { content: name } }, text(value))]
/** A handler's state row as `writeRowValue` makes it: the left its identity, its value a node value. */
const stateRow = (left: string, value: unknown): FosPathElem => {
  const built = content(constructNodeValue(store, value, left).cid)
  return [left, put({ ...built, data: { ...built.data, alias: { id: left } } })]
}
/** An evaluation's request: its execute row holding the request the run makes (`{{name}}` is bound when applied). */
const request = (values: Record<string, unknown>): FosPathElem => stateRow(patterns.execute!, { request: values })
/** A resource demand: the allocation capability with the resource it is for. */
const resource = (type: string) => node(...content(patterns.allocation!).children, [resourceType, fill('resourceType', type)])
/** A capability with its input `name` filled with `value`, as the kernel's `withInputs` refines it. */
const withInput = (pattern: string, name: string, value: string) => node(...content(pattern).children.map(([left, right]): FosPathElem =>
  content(right).data.name?.content === name ? [left, refNode({ alias: { id: hashContent({ data: { name: { content: `input:${name}` } }, children: [] }) }, name: { content: name } }, text(value))] : [left, right]))
/** A template: a row of the template type, titled, holding the rows an instance gets. */
const template = (name: string, label: string, icon: string, rows: FosPathElem[]): FosPathElem =>
  [types.template!, put({ data: { alias: { id: `library.${name}` }, name: { content: name }, presentation: { icon } }, children: [titleRow(`library.${name}`, label), ...rows] })]
const ids = (name: string) => (index: number) => `library.${name}.${index}`

const templates: FosPathElem[] = [
  noteRow('library.readme', 'Standard library', 'Templates every Fos account can use, offline: write `` [ ] `Invoice` `` in any node to start one. Edit them here to propose a change.', { name: { content: 'readme' } }),
  ((id = ids('invoice')) => template('invoice', 'Invoice', 'invoice', [plainRow(id(1), 'Billing contact: name <email>'), ask(id(2), patterns.confirmation!, 'Time entries reviewed'), ask(id(3), patterns.allocation!, 'Amount due'), taskRow(id(4), 'Send the invoice')]))(),
  ((id = ids('poll')) => template('poll', 'Group decision', 'poll', [ask(id(1), patterns.choice!, 'Which option?')]))(),
  ((id = ids('paidTask')) => template('paidTask', 'Paid task', 'paid', [ask(id(1), patterns.confirmation!, 'Work delivered'), ask(id(2), patterns.allocation!, 'Reward')]))(),
  ((id = ids('contact')) => template('contact', 'Contact form', 'contact', [plainRow(id(1), 'Message: …'), ask(id(2), patterns.confirmation!, 'Message received')]))(),
  ((id = ids('research')) => template('research', 'Research note', 'research', [plainRow(id(1), 'Question: …'), taskRow(id(2), 'Sources collected'), ask(id(3), patterns.confirmation!, 'Summary written')]))(),
  // what a relay node holds: the messages it forwards and their acknowledgements
  template('relay', 'Relay', 'relay', [[types.relayMessage!, unit], [types.relayAck!, unit]]),
  ((id = ids('implementAndVerify')) => template('implementAndVerify', 'Implement and verify', 'rocket', [
    noteRow(id(1), 'Specification', 'Describe the required outcome, constraints, and important decisions.'),
    noteRow(id(2), 'Acceptance examples', 'Describe concrete inputs and expected outcomes. Replace these instructions before delegating.'),
    ask(id(3), patterns.llm!, 'Propose a detailed implementation plan and verification steps. Identify missing decisions.', [
      ask(id(4), patterns.confirmation!, 'Specification, acceptance examples and required input references are ready'),
      [patterns.llm!, refNode({ alias: { id: id(5) } }, null)]]),
  ]))(),
  ((id = ids('generateSubtasks')) => template('generateSubtasks', 'Generate subtasks', 'window', [
    ask(id(1), patterns.llm!, 'Generate fine-grained subtasks with acceptance criteria. Return one unchecked Markdown task per line, like [ ] Implement reservation validation — reject overlapping bookings. Do not claim the tasks are completed.', [
      [patterns.llm!, refNode({ alias: { id: id(2) }, name: { content: 'model' } }, null)],
      request({ subtasks: true })]),
  ]))(),
  ((id = ids('projectCodingRequest')) => template('projectCodingRequest', 'Request project coding agent', 'code', [
    ask(id(1), withInput(patterns.tool!, 'tool', 'fos.agent'), 'Implement the branch from its notes and tasks; open a PR for review', [request({ prompt: '{{coding-instructions}}', provider: '{{coding-agent}}', worktree: true })]),
  ]))(),
  ((id = ids('projectAgentWorkflow')) => template('projectAgentWorkflow', 'Project agent workflow', 'workflow', [
    variable(id(1), 'main-branch', 'main'), variable(id(2), 'deployment-environment', 'production'),
    variable(id(3), 'verification-agent', 'claude-desktop'), variable(id(4), 'coding-agent', 'codex'),
    variable(id(5), 'repository', ''), variable(id(6), 'deployment-url', ''),
    variable(id(7), 'coding-instructions', 'Implement the requested work using the updated project notes and tasks. Read fos_read and fos_outstanding before starting and after each item. Run relevant checks, commit changes, push HEAD to the requested branch on origin, and open or reuse a GitHub PR targeting {{main-branch}} in {{repository}}. Never merge it. Record the PR URL and test results in a Fos proposal.'),
    variable(id(8), 'verification-instructions', 'Verify the deployed project at {{deployment-url}} using the Chrome connector. Check its notes and tasks against the deployed commit. Record steps, URLs, observations, and pass/fail/blocked for every check. Missing tools or access are blocked, never a pass. Do not change implementation.'),
    [types.template!, put({ data: { alias: { id: id(9) } }, children: [titleRow(id(9), 'After Fos branch merge'),
      ask(id(10), withInput(patterns.tool!, 'tool', 'fos.agent'), 'Verify the deployed project', [request({ branch: '{{main-branch}}', chrome: true, deployment: { environment: '{{deployment-environment}}' }, prompt: '{{verification-instructions}}', provider: '{{verification-agent}}', readOnly: true })]),
      stateRow(patterns['ref-change']!, { created: 0, enabled: true, peer: '{{desktop}}', watch: { branch: '{{main-branch}}', merges: true, path: '{{project}}' } })] })],
  ]))(),
]
// the fallbacks that work with no peer: the person who did it by hand records it
const manual = node(
  noteRow('library.manual.0', 'Manual handlers', 'Fallbacks that work with no peer: the person who did it by hand records it here. Edit the labels to propose better ones; add a row to offer a fallback for another kind of requirement.'),
  ask('library.manual.payment', resource('account'), 'Paid outside Fos', null, 'payment'),
  ask('library.manual.points', resource('points'), 'Settled the points by hand', null, 'points'),
  ask('library.manual.time', resource('calendar'), 'Booked the time by hand', null, 'time'),
  ask('library.manual.things', resource('inventory'), 'Set the items aside by hand', null, 'things'),
  ask('library.manual.location', resource('location'), 'Enter the location', null, 'location'),
  ask('library.manual.mail', patterns.mail!, 'Sent it myself', null, 'mail'),
  ask('library.manual.repo', patterns.repo!, 'Opened the issue by hand', null, 'repo'),
  ask('library.manual.llm', patterns.llm!, 'Answered it myself', null, 'llm'),
  ask('library.manual.search', patterns.search!, 'Searched by hand', null, 'search'),
  ask('library.manual.tool', patterns.tool!, 'Ran it by hand', null, 'tool'),
  ask('library.manual.market', patterns.market!, 'Arranged it outside the market', null, 'market'),
)
// what the library needs passed in by the device that uses it
const requires = node(ask('library.requires.deviceLocation', resource('location'), "Use this device's location", null, 'deviceLocation'))

// the library is a value of its type: it carries the library tag
const library = node(
  [tagOf('library'), unit],
  ...Object.entries(types).map(([field, value]): FosPathElem => [unit, ref(field, value)]),
  [unit, ref('capabilities', capabilityGroup)],
  [unit, ref('manual', manual)],
  [unit, ref('requires', requires)],
  ...templates,
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
