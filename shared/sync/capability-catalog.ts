import type { FosStore } from '../dag-implementation/store'
import { content, libraryBindingAt, namesInLibrary, type Scope } from './graph'

/** Presentation and syntax come from the namespace pinned at the use site. */
export function capabilityDeclarations(store: FosStore, at: Scope = []) {
  const binding = libraryBindingAt(store, at)
  if (!binding) return []
  return [...namesInLibrary(store, binding.library).byName].flatMap(([field, cid]) => {
    if (!field.startsWith('capabilities.')) return []
    const node = content(store, cid), definition = node.data.capabilityDefinition
    return definition ? [{ cid, node, ...definition, name: field.slice('capabilities.'.length) }] : []
  })
}
