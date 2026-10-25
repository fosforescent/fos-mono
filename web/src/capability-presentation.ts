import { primitive } from '../../shared/sync/primitives'
import type { FosStore } from '../../shared/dag-implementation/store'
import { fieldOf } from '../../shared/library-names'
import { valueContent } from '../../shared/sync/index'

/** Presentation is authored as ordinary named rows on the capability definition. */
export function capabilityPresentation(store: FosStore, cid: string): { icon?: string; description?: string } {
  const value = valueContent(store, cid)
  const textRow = (name: string): string | undefined => {
    const field = fieldOf(id => store.table.get(id), cid, name, primitive(store, 'target'), primitive(store, 'alias'))
    if (!field) return undefined
    const data = valueContent(store, field).data
    return (data.scalar?.type === 'text' ? String(data.scalar.value) : data.description?.content)?.trim() || undefined
  }
  return { icon: textRow('icon') ?? value.data.presentation?.icon, description: textRow('description') ?? value.data.description?.content }
}
