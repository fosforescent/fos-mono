import type { FosStore } from '../dag-implementation/store'
import { content, libraryBindingAt, namesInLibrary, refValueCid, type Scope } from './graph'
import { refTitle, textOf } from './fields'

/**
 * The capabilities of the namespace pinned at the use site: the refs its `capabilities` group assigns them to. Each
 * ref's value is the capability (its pattern); its own rows say how it is shown (title, syntax, icon).
 */
export function capabilityDeclarations(store: FosStore, at: Scope = []) {
  const binding = libraryBindingAt(store, at)
  const group = binding ? namesInLibrary(store, binding.library).byName.get('capabilities') : undefined
  if (!group) return []
  const syntaxField = namesInLibrary(store, binding!.library).byName.get('syntax')
  return content(store, group).children.flatMap(([cid, refCid]) => {
    const ref = store.table.get(refCid), name = ref?.data.name?.content
    if (!ref || !name || refValueCid(store, ref) !== cid) return []
    const syntax = ref.children.filter(([left]) => left === syntaxField).map(([, value]) => textOf(store, value)).filter((text): text is string => !!text)
    return [{ cid, node: content(store, cid), ref: refCid, name, label: refTitle(store, ref) ?? name, syntax: syntax.length ? syntax : [name] }]
  })
}
