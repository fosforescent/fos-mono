/** One declaration view for lexical arguments, explicit references, and advertised handlers. */
import type { FosStore } from '../dag-implementation/store'
import { fieldNode } from '../library-names'
import {
  advertisedRows, branchEdge, capabilityOfTarget, content, enclosingScopes, identityCid, importNodes,
  isBranchChoice, isGrantEdge, isLibraryInstance, isMemberEdge, isRefNode, isRowEdge, memberPeerOf,
  reachableNodes, refValueCid, rowTypeOf, selectedBranchValue, withMainBranchPolicy, put, refNodeContent, type Scope
} from './graph'
import { headCid, type Replica } from './replica'
import { refProperties } from './refs'
import { declares, refSubmissionSet } from './scoped-refs'

export type BindingAccess = {
  canRead?(store: FosStore, cid: string, path: Scope): boolean
  isPeerActive?(peerId: string): boolean
}
export type BindingLocation = { store: FosStore; cid: string; path: Scope; pattern?: string; libraryField?: true }
export type BindingSubmission = { cid: string; peerId: string; enabled: boolean; active: boolean }
type BindingAssignment = BindingLocation & { accessible: boolean; submissions: BindingSubmission[] }
export type ScopedBinding = BindingLocation & {
  id: string; name?: string; pattern: string
  scope: { store: FosStore; path: Scope }
  /** Only declarations participate in implicit argument/handler selection. Other rows remain explicit properties. */
  ambient: boolean
  submissions: BindingSubmission[]
  alternatives: boolean
  accessible: boolean
  refPath: string[]; refIds: string[]
  assignments: BindingAssignment[]
  policy: ReadonlyMap<string, string[]>
  peerId: string
  /** Present only for explicit alternative-submission rows. The left node is their shared capability declaration. */
  capability?: string
  nameVisible: boolean
}
type Context = Pick<Replica, 'store'> & { meta?: Pick<Replica['meta'], 'peerId'> }
type MemberLayer = { peer: string; cid: string; store: FosStore; scope: Scope; depth: number }
export type BindingLayer = { store: FosStore; path: Scope; bindings: ScopedBinding[]; blocked: boolean }

export function policyIdentity(store: FosStore, cid: string): string {
  const node = content(store, cid), edge = isBranchChoice(store, node) ? branchEdge(store, cid) : null
  return edge ? policyIdentity(store, identityCid(store, edge)) : cid
}

/** Policy is always read from main, even while a value branch is being previewed. */
function memberLayers(r: Context, at: Scope): MemberLayer[] {
  const result: MemberLayer[] = []
  for (const [depth, scope] of enclosingScopes(r.store, headCid(r), at).entries()) {
    for (const ref of withMainBranchPolicy(scope.store, () => refProperties(scope.store, policyIdentity(scope.store, scope.cid), 'members'))) {
      if (ref.peer) result.push({ peer: ref.peer, cid: ref.cid, store: scope.store, scope: scope.path, depth })
    }
  }
  return result
}
export function contextMemberRefs(r: Context, at: Scope): Map<string, string> {
  const result = new Map<string, string>()
  for (const member of memberLayers(r, at)) if (!result.has(member.peer)) {
    if (member.store !== r.store) importNodes(r.store, reachableNodes(member.store, [member.cid]))
    result.set(member.peer, member.cid)
  }
  return result
}

function declaration(location: BindingLocation, pattern: string, access: BindingAccess, peerId = '', ambient = true, name?: string, policy: ReadonlyMap<string, string[]> = new Map()): ScopedBinding {
  const { store, cid, path } = location, node = content(store, cid)
  const accessible = access.canRead?.(store, cid, path) ?? true
  const accepted = accessible ? (isRefNode(store, node) ? refSubmissionSet(store, cid) : { values: [cid], alternatives: false }) : { values: [], alternatives: false }
  const targets = accepted.values
  const id = node.data.alias?.id ?? path.at(-1) ?? cid, capability = capabilityOfTarget(store, pattern)
  const submissions = targets.map(value => {
    const peer = content(store, value).data.peerId?.content ?? node.data.peerId?.content ?? peerId
    const disabled = policy.get(peer) ?? []
    return { cid: value, peerId: peer, enabled: !disabled.includes(id) && !(capability && disabled.includes(capability)), active: !peer || (access.isPeerActive?.(peer) ?? true) }
  })
  return { ...location, pattern, id,
    ...(name !== undefined ? { name } : node.data.name ? { name: node.data.name.content } : {}),
    scope: { store, path: path.slice(0, -1) }, ambient, accessible,
    refPath: [name ?? node.data.name?.content ?? node.data.alias?.id ?? cid], refIds: [node.data.alias?.id ?? cid],
    assignments: [{ ...location, accessible, submissions }], submissions, alternatives: accepted.alternatives, policy, peerId, nameVisible: true }
}

/** Read direct properties and accepted targets, without searching a sibling or an arbitrary cached node. */
export function bindingProperties(location: BindingLocation & { policy?: ReadonlyMap<string, string[]>; peerId?: string }, access: BindingAccess = {}, peerId = location.peerId ?? ''): BindingLayer {
  const { store, path } = location, instance = store.table.get(location.cid)
  const libraryField = location.libraryField || !!instance && isLibraryInstance(store, instance)
  let cid: string | null = instance && isLibraryInstance(store, instance) && location.pattern ? location.pattern : location.cid
  const result: BindingLayer = { store, path, bindings: [], blocked: false }, seen = new Set<string>()
  while (cid) {
    if (access.canRead && !access.canRead(store, cid, path)) { result.blocked = true; break }
    if (!store.table.has(cid)) break
    if (seen.has(cid) || seen.size >= 128) throw new Error('Cyclic or excessive property indirection.')
    seen.add(cid)
    const node = content(store, cid)
    if (node.data.ref?.peer || node.data.ref?.owner) break
    const shadowed = new Set(result.bindings.map(binding => binding.id))
    for (const { edge, alternative } of node.children.flatMap(edge => isGrantEdge(store, edge)
      ? advertisedRows(store, edge[1]).map(row => ({ edge: row, alternative: !!content(store, edge[1]).data.refAlternatives }))
      : [{ edge, alternative: !!node.data.refAlternatives }])) {
      if (!store.table.has(edge[1]) || !(isRowEdge(store, edge) || isMemberEdge(store, edge) || isGrantEdge(store, edge))) continue
      const childCid = identityCid(store, edge), child = content(store, childCid)
      const name = child.data.name?.content ?? store.table.get(refValueCid(store, child) ?? childCid)?.data.name?.content ??
        (isMemberEdge(store, edge) ? memberPeerOf(store, edge) ?? undefined : undefined)
      const id = child.data.alias?.id ?? name ?? childCid
      // A ref's own properties precede the properties of its accepted target.
      if (shadowed.has(id)) continue
      const field = libraryField ? fieldNode(key => store.table.get(key), edge, store.primitive.targetPointerConstructor.getId(), store.primitive.aliasConstructor.getId()) : null
      const target = field?.node ?? childCid, pattern = rowTypeOf(store, edge) ?? edge[0]
      result.bindings.push({ ...declaration({ store, cid: target, path: [...path, id], ...(libraryField ? { libraryField: true as const } : {}) },
        pattern, access, peerId, !libraryField && isRowEdge(store, edge) && declares(store, pattern, childCid), name, location.policy),
        ...(alternative ? { capability: pattern } : {}) })
    }
    cid = isBranchChoice(store, node) ? selectedBranchValue(store, cid) : refValueCid(store, node)
  }
  return collectAssignments(result)
}

function collectAssignments(layer: BindingLayer): BindingLayer {
  for (const binding of layer.bindings) binding.assignments = layer.bindings.filter(other =>
    other.id === binding.id || !binding.capability && !other.capability && binding.ambient && other.ambient && binding.name !== undefined && other.name === binding.name)
    .map(({ store, cid, path, pattern, accessible, submissions }) => ({ store, cid, path, pattern, accessible, submissions }))
  return layer
}

/** Direct declarations and member advertisements occupy the same enclosing graph frame. */
export function bindingLayers(r: Context, at: Scope, access: BindingAccess = {}): BindingLayer[] {
  // a replica's own declarations are always reachable in it: liveness is a question about other peers
  const local = r.meta?.peerId
  if (access.isPeerActive && local) { const other = access.isPeerActive; access = { ...access, isPeerActive: peer => peer === local || other(peer) } }
  const members = memberLayers(r, at), nearestMembers = new Map<string, MemberLayer>()
  for (const member of members) if (!nearestMembers.has(member.peer)) nearestMembers.set(member.peer, member)
  const policy = new Map([...nearestMembers].map(([peer, member]) => [peer, content(member.store, member.cid).data.disabledCapabilities?.content ?? []]))
  const layers = enclosingScopes(r.store, headCid(r), at).map(scope => bindingProperties({ ...scope, policy }, access, r.meta?.peerId))
  for (const member of members) {
    const layer = layers[member.depth]!
    if (access.canRead && !access.canRead(member.store, member.cid, member.scope)) { layer.blocked = true; continue }
    for (const edge of content(member.store, member.cid).children) if (edge[0] === member.store.primitive.acceptsNode.getId()) {
      for (const [pattern, cid] of advertisedRows(member.store, edge[1])) {
        const node = content(member.store, cid), id = node.data.alias?.id
        if (!id) continue
        const name = node.data.name?.content ?? content(member.store, refValueCid(member.store, node) ?? cid).data.name?.content
        layer.bindings.push({ ...declaration({ store: member.store, cid, path: [...member.scope, id] }, pattern, access, member.peer, true, name, policy),
          ...(content(member.store, edge[1]).data.refAlternatives ? { capability: pattern } : {}) })
      }
    }
  }
  return layers.map(collectAssignments)
}

/** Compiler-local identity: scoped names denote one ref; unnamed declarations retain their own identity. */
export const scopedBindingKey = (binding: ScopedBinding): string => JSON.stringify([binding.scope.path, binding.capability ? binding.id : binding.name ?? binding.id])

export const bindingAvailable = (binding: ScopedBinding) => binding.accessible && binding.submissions.every(value => value.enabled && value.active) && binding.assignments.every(assignment =>
  assignment.accessible && assignment.submissions.every(value => value.enabled && value.active))

/** An empty declaration contributes a parameter, not another value, when the same ref is also assigned. */
export const bindingAssignments = (binding: ScopedBinding) => binding.assignments.filter(assignment =>
  !assignment.accessible || assignment.submissions.length > 0 || !!content(assignment.store, assignment.cid).data.ref ||
  !!content(assignment.store, assignment.cid).data.refExpression)

/** A parameter without an assignment requests fulfillment; it does not introduce a competing provided value. */
const provides = (binding: ScopedBinding) => !binding.accessible || binding.submissions.length > 0 || !!content(binding.store, binding.cid).data.ref ||
  !!content(binding.store, binding.cid).data.refExpression

/** Identity selection never rebinds by name. Empty/disabled declarations still shadow an outer identity. */
export function selectBinding(layers: BindingLayer[], name: string, identity = false, includeUnfilled = false): { status: 'ready' | 'missing' | 'ambiguous' | 'denied'; locations: ScopedBinding[] } {
  const hidden = new Set<string>()
  for (const layer of layers) {
    if (layer.blocked) return { status: 'denied', locations: [] }
    let found = layer.bindings.filter(binding => !hidden.has(binding.id) && (identity ? binding.id === name :
      (binding.name === name || binding.id === name) && (includeUnfilled || !binding.ambient || provides(binding))))
    layer.bindings.forEach(binding => hidden.add(binding.id))
    if (!found.length) continue
    if (found.some(binding => !bindingAvailable(binding) && (identity || !binding.capability))) return { status: 'denied', locations: [] }
    found = found.filter(bindingAvailable)
    if (!found.length) return { status: 'denied', locations: [] }
    const sameDeclaration = found.every(binding => scopedBindingKey(binding) === scopedBindingKey(found[0]!))
    return { status: sameDeclaration ? 'ready' : 'ambiguous', locations: sameDeclaration ? [found[0]!] : found }
  }
  return { status: 'missing', locations: [] }
}

/** Enumerate implicit candidates using the same layers as explicit reference lookup. */
export function visibleBindings(r: Context, at: Scope, access: BindingAccess = {}): ScopedBinding[] {
  const layers = bindingLayers(r, at, access), ids = new Set<string>(), names = new Set<string>(), result: ScopedBinding[] = []
  for (const layer of layers) {
    if (layer.blocked) break
    const current = layer.bindings.filter(binding => binding.ambient && !ids.has(binding.id) && (binding.capability || !binding.name || !names.has(binding.name)))
    result.push(...current.map(binding => ({ ...binding, nameVisible: !binding.name || !names.has(binding.name) })))
    for (const binding of layer.bindings) if (binding.ambient) {
      ids.add(binding.id)
      if (binding.name && provides(binding)) names.add(binding.name)
    }
  }
  return result
}

/** Accepted sub-ref relationships retain their qualified path and declaring scope. */
export function bindingTree(binding: ScopedBinding, access: BindingAccess = {}, seen = new Set<string>()): ScopedBinding[] {
  if (seen.has(binding.cid)) return []
  if (seen.size >= 128) throw new Error('Nested refs exceed 128 levels.')
  const next = new Set(seen).add(binding.cid)
  return [binding, ...binding.submissions.flatMap(value => bindingProperties({ store: binding.store, cid: value.cid, path: binding.path, policy: binding.policy }, access, value.peerId).bindings
    .filter(child => child.ambient).flatMap(child => bindingTree({ ...child,
      refPath: [...binding.refPath, ...child.refPath], refIds: [...binding.refIds, ...child.refIds],
      nameVisible: binding.nameVisible,
      submissions: child.submissions.map(submission => ({ ...submission, enabled: value.enabled && submission.enabled, active: value.active && submission.active }))
    }, access, next)))]
}

/** Materialize an explicit choice branch for consumers that enumerate alternatives. No winner is selected. */
export function submissionRef(binding: ScopedBinding, submission: BindingSubmission): string {
  return !binding.alternatives || binding.submissions.length === 1 ? binding.cid : put(binding.store, refNodeContent(binding.store, content(binding.store, binding.cid).data, submission.cid, []))
}
