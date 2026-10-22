import * as library from './library.generated.json'
import type { FosNodeContent } from '../types'
export const STANDARD_CAPABILITY_PATTERNS = Object.entries(library.nodes as unknown as Record<string, FosNodeContent>)
  .flatMap(([cid, node]) => node.data.capabilityDefinition ? [{ cid, node, ...node.data.capabilityDefinition }] : [])
