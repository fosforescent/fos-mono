/** Owner-side publication adapter. Only this boundary uses the compiler's editor source map. */
import { authorityReference, authorityReferenceParts, checkAuthorityInvocation } from './authority'
import type { AuthorityCompilation } from './authority-compilation'
import { content, isRefNode, put, refNodeContent, resolveScope, updateAtScope, withPrev, bookkeepingOf } from './graph'
import { headCid, type Replica } from './replica'
import { bindingAvailable, scopedBindingKey, type ScopedBinding } from './scope-bindings'
import { resolveRefIdentity } from './ref-paths'
import { refValueCompatible } from './scoped-refs'

/** Build a replacement root without publishing any intermediate owner or destination writes.
 * Call under the host's execution lock; the evaluator publishes this with its other commit changes.
 */
export function stageAuthorityPublications(r: Replica, compiled: AuthorityCompilation[], now: number): string {
  const before = headCid(r), writes = new Map<string, { binding: ScopedBinding; target: string }>()
  const write = (binding: ScopedBinding, target: string) => {
    if (binding.store !== r.store || !bindingAvailable(binding)) throw new Error('Execute authority publication through the owning scope, not a cached foreign ref.')
    if (!refValueCompatible(r.store, binding.pattern, target)) throw new Error('The authority result does not satisfy its destination ref.')
    for (const location of binding.assignments) {
      if (location.store !== r.store || resolveScope(r.store, before, location.path) !== location.cid || !isRefNode(r.store, content(r.store, location.cid)))
        throw new Error('An authority ref changed before commit; recompile.')
      const key = JSON.stringify(location.path)
      if (writes.has(key)) throw new Error('Combine competing updates to one authority ref in a single transaction graph.')
      writes.set(key, { binding: { ...binding, ...location }, target })
    }
  }
  for (const plan of compiled) {
    const checked = checkAuthorityInvocation(r.store, plan.cid, plan.current)
    if (!checked.writes) throw new Error(checked.problems.join('\n'))
    for (const [ref, value] of checked.writes) {
      const destination = plan.locations.find(location => location.ref === ref)?.binding
      if (!destination) throw new Error('The authority invocation has no publication mapping for a destination.')
      if (content(r.store, value).data.authorityFrame?.role !== 'reference') { write(destination, value); continue }
      const [, grant] = authorityReferenceParts(r.store, value)
      // A published handle remains an ordinary explicit owner reference. It is never a detached grant copy.
      const owner = resolveRefIdentity(r, destination.scope.path, plan.owner.id)
      if (owner.status !== 'ready' || owner.locations[0]!.store !== plan.owner.store || scopedBindingKey(owner.locations[0]!) !== scopedBindingKey(plan.owner))
        throw new Error('Pass the authority owner into the destination scope explicitly before rebinding.')
      const expression = put(r.store, { data: { ref: { id: plan.owner.id } }, children: [] })
      write(destination, authorityReference(r.store, expression, grant))
    }
  }
  const changes = [...writes.values()]
  for (const change of changes) if (changes.some(other => other !== change && other.binding.path.length < change.binding.path.length &&
    other.binding.path.every((id, index) => change.binding.path[index] === id))) throw new Error('An authority destination cannot replace another destination\'s enclosing scope.')
  let root = before
  for (const { binding, target } of changes) root = updateAtScope(r.store, root, binding.path, node =>
    withPrev(r.store, refNodeContent(r.store, { ...node.data, updated: { time: now } }, target, bookkeepingOf(r.store, node)), put(r.store, node)), 'node')
  // Old grants are retained only in history, never as selectable live alternatives.
  if (headCid(r) !== before) throw new Error('Authority changed while preparing publication; recompile.')
  return root
}
