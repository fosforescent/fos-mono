/** Readers for pre-graph constructors and the native adapters not yet migrated.
 * New graph definitions have neither an instance discriminator nor domain dispatch.
 */
import type { FosDataContent, FosNodeContent, TextPresentation } from '../types'

/** Read old Markdown rows without making their domain kind a rendering primitive. */
export function legacyTextPresentation(kind: string): TextPresentation | undefined {
  return kind === 'note' ? { mediaType: 'text/markdown', interpolate: true } : undefined
}

export function legacyRowKind(node: FosNodeContent): string | undefined {
  if (node.data.form) return undefined
  if (node.data.missingTemplate) return 'reference-error'
  return node.data.behavior?.content?.match(/^builtin:(.+)$/)?.[1] ?? node.data.instanceKind?.kind
}

export function withoutLegacyInstanceKind(data: FosDataContent): FosDataContent {
  const { instanceKind: _legacy, ...rest } = data
  return rest
}

export function definitionId(node: FosNodeContent): string | undefined {
  return node.data.alias?.id ?? (legacyRowKind(node) ? `lib:type:${legacyRowKind(node)}` : undefined)
}

export function definitionRowKind(node: FosNodeContent): string | undefined {
  return node.data.form ? 'plain' : legacyRowKind(node)
}
