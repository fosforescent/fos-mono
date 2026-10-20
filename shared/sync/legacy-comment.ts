/** Compatibility only. New comments have no comment payload or native comment behavior. */
import type { FosNodeContent, FosPathElem } from '../types'
import type { FosStore } from '../dag-implementation/store'
import { constructForm } from './forms'
import { put, refNodeContent } from './graph'

/** Preserve old fields outside the new tuple as ordinary graph data. */
export function legacyCommentMetadata(store: FosStore, node: FosNodeContent, id: string, now: number): FosPathElem[] {
  const old = node.data.comment
  if (!old) return []
  const values: Record<string, string> = Object.fromEntries(Object.entries(old.votes).map(([peer, vote]) => [`vote:${peer}`, vote]))
  if (old.scope) values.scope = old.scope
  if (!Object.keys(values).length) return []
  const text = put(store, { data: { form: { primitive: 'text' } }, children: [] })
  const type = put(store, { data: { form: {} }, children: Object.keys(values).sort().map(name => [text, put(store, { data: { alias: { id: `legacy:parameter:${name}` }, parameter: { name } }, children: [] })]) })
  const alias = `${id}/legacy`
  const value = constructForm(store, type, alias, values, now)
  value.data.name = { content: 'legacy' }
  value.data.description = { content: 'Previous comment metadata' }
  return [[type, put(store, refNodeContent(store, { alias: { id: alias }, name: { content: 'legacy' } }, put(store, value)))]]
}
