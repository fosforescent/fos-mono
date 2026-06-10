/**
 * UI State - UUID Identity Layer
 *
 * Provides stable identifiers for UI elements that persist across graph mutations.
 * UUIDs are ephemeral (not persisted) and live only in the UI layer.
 * The graph stays purely content-addressed.
 */

import { FosPath } from '@fosforescent/shared/types'

// Inline pathEqual to avoid circular dependency with tree-ops.ts
const pathEqual = (a: FosPath, b: FosPath): boolean => {
  if (a.length !== b.length) return false;
  return a.every((elem, i) => elem[0] === b[i][0] && elem[1] === b[i][1]);
};

// UUID → deserialized FosPath (instruction-target pairs)
const uuidToPath = new Map<string, FosPath>()

/**
 * Get or create a UUID for a given path.
 * The path is captured at render time and stays stable.
 */
export function getOrCreateUuid(path: FosPath): string {
  // Look up by path comparison
  for (const [uuid, storedPath] of uuidToPath) {
    if (pathEqual(storedPath, path)) return uuid
  }

  // Not found - create new UUID
  const uuid = crypto.randomUUID()
  uuidToPath.set(uuid, [...path])  // Store copy of path
  return uuid
}

/**
 * Look up path by UUID.
 */
export function getPathByUuid(uuid: string): FosPath | undefined {
  return uuidToPath.get(uuid)
}

/**
 * Look up UUID by path.
 */
export function getUuidByPath(path: FosPath): string | undefined {
  for (const [uuid, storedPath] of uuidToPath) {
    if (pathEqual(storedPath, path)) return uuid
  }
  return undefined
}

/**
 * Update the path for a UUID (after mutation changes the path).
 */
export function updateUuidPath(uuid: string, newPath: FosPath): void {
  if (uuidToPath.has(uuid)) {
    uuidToPath.set(uuid, [...newPath])
  }
}

/**
 * Clear all UUID mappings (e.g., on full re-render or data reload).
 */
export function clearUuidMappings(): void {
  uuidToPath.clear()
}

/**
 * Debug: Get count of tracked UUIDs
 */
export function getUuidCount(): number {
  return uuidToPath.size
}
