/** Test helpers. */
import { primitive } from './primitives'
import { supplyValue } from './arguments'
import type { PrimitiveFunction } from './operands'
/** A primitive that answers the requirement it runs for with a value of its pattern, as `by`. */
export const answering = (by: string, receipt?: string): PrimitiveFunction => async (operands, context) => {
  const self = operands.outputs.self
  if (!self) throw new Error('This primitive fills a requirement row.')
  return { outputs: { self: supplyValue(context.store, self.pattern, by, receipt) } }
}
/** A primitive that answers nothing (an effect with no graph result). */
export const silent: PrimitiveFunction = async () => ({})
import { libraryInstanceOf, libraryRowOf, SERVER_TRANSPORT_CAPABILITIES, type NodeView, type Scope } from './graph'
import { headCid, view, type Replica } from './replica'
import { accountContextAbove, exchangeNode, nodeTreeSync } from './node-sync'
import type { NodeBranch, NodeRequest } from './node-provider'
import { primitiveRef, publishPrimitive } from './primitives'
import { deviceTriggerDefinitions, cronObserver } from './trigger-primitives'
import { libAt, libraryBindingAt, libraryInstanceEdge, commitRoot, updateAtScope, content, put, refNodeContent } from './graph'
import type { Demand } from './arguments'
import type { FosDataContent } from '../types'

/** A "-[ ] task" demand: the value is a container holding a done task. */
export const TASK_DEMAND: Demand = { capability: 'task', contains: { data: { todo: { completed: true } } as unknown as FosDataContent, children: [] } }

/** An extension must be declared in a library instance before code can address its field. */
export function declareTestCapability(r: Replica, name: string, at: Scope = [], data: import('../types').FosDataContent = {}): Replica {
  const store = r.store, binding = libraryBindingAt(store, at)!, library = content(store, binding.library)
  const group = libAt(store, at).field('capabilities'), namespace = content(store, group)
  const operation = primitive(store, 'name')
  const kind = put(store, { data: { scalar: { type: 'text', value: `capabilities.${name}` } }, children: [] })
  const type = put(store, { data: { capabilityDefinition: { name, label: name }, ...data }, children: [[operation, kind]] })
  const declaration = put(store, refNodeContent(store, { name: { content: name } }, null))
  const nextGroup = put(store, { ...namespace, children: [...namespace.children.filter(([, right]) => content(store, right).data.name?.content !== name), [type, declaration]] })
  const nextLibrary = put(store, { ...library, children: library.children.map(([left, right]) => [left, right === group ? nextGroup : right]) })
  commitRoot(store, updateAtScope(store, headCid(r), at, node => {
    const instance = libraryInstanceOf(store, put(store, node))
    return { ...node, children: [...node.children.filter(([, right]) => right !== instance?.cid), libraryInstanceEdge(store, nextLibrary)] }
  }), 0)
  return { ...r }
}

/** Services are registered explicitly; granting permission must never manufacture a handler. */
export function installTestHandler(r: Replica, peer: string, capability: string, at: Scope = []): Replica {
  const definition = { id: `test:${capability}`, label: capability, capability: (store: Replica['store'], scope: Scope) => libAt(store, scope).capabilities[capability]! }
  return publishPrimitive(r, at, peer, primitiveRef(r.store, peer, definition, {}, at), 0)
}

/** Explicit host setup for tests exercising observers; construction alone never registers them. */
export function installTestObservers(r: Replica, peers = [r.meta.peerId], publish = true): Replica {
  for (const peer of peers) for (const definition of [...deviceTriggerDefinitions, { id: 'test:cron', capability: (store: Replica['store']) => libAt(store).capabilities.cron!, trigger: cronObserver }]) {
    const ref = primitiveRef(r.store, peer, definition)
    if (publish) r = publishPrimitive(r, [], peer, ref, 0)
  }
  return r
}

/** The root view without the root's own shipped library row: what the tests' rows are compared against. */
export function userView(r: Replica): NodeView | null {
  const root = view(r, [])
  const library = [libraryRowOf(r.store, headCid(r))?.id, libraryInstanceOf(r.store, headCid(r))?.id]
  return root && { ...root, tasks: root.tasks.filter(t => !library.includes(t.id)) }
}

export type SyncOptions = {
  /** Sync as a peer invited at this scope of the server (its edits become a proposal there); default: as the owner. */
  invited?: Scope
  /** As the owner: where on the server the client's root is (default: the server's root). */
  at?: Scope
  push?: boolean
  branches?: NodeBranch[]
  now?: number
  /** Every request and answer, for checking what crossed the wire. */
  wire?: unknown[]
  /** Edit the client while its first request is in flight. */
  during?: (r: Replica) => Replica
}

/**
 * Sync `client` with `server` node by node (`nodeTreeSync` against `exchangeNode`), as a device syncs with its account:
 * the client's attachment (`localScope`, e.g. Home) with the same path on the server. The server's store is updated in
 * place. Returns the client.
 */
export function syncWith(client: Replica, server: Replica, options: SyncOptions = {}): Replica {
  const { invited, at = [], push = true, branches = [], now = 10, wire } = options
  let during = options.during
  const scope = invited ?? [], localRoot = client.meta.localScope ?? []
  const authority = { peerId: client.meta.peerId, scope, owner: !invited, proposeOnly: !!invited, capabilities: SERVER_TRANSPORT_CAPABILITIES }
  const run = nodeTreeSync(client, { peer: client.meta.serverPeerId ?? (invited ? null : server.meta.peerId), scope, remoteRoot: invited ? scope : [...at, ...localRoot], localRoot, branches, push, above: invited || at.length ? [] : accountContextAbove(client) }, () => now)
  let step = run.next()
  while (!step.done) {
    const request: NodeRequest = step.value.request
    const answer = exchangeNode(server, request, authority, now).node
    wire?.push(request, answer)
    if (during) { during(step.value.replica); during = undefined }
    step = run.next(answer)
  }
  return { ...step.value.replica, meta: { ...step.value.replica.meta, serverPeerId: step.value.peer } }
}
