export function isSuperset<T>(ss: T[], tt: T[]): boolean {
  const sSet = new Set(ss)
  for (const t of tt) {
    if (!sSet.has(t)) {
      return false
    }
  }
  return true
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`)
  }
}

export function counter<K>(items: K[]): Map<K, number> {
  const counts = new Map<K, number>()
  items.forEach(it => counts.set(it, (counts.get(it) || 0) + 1))
  return counts
}

export const aggMap = (edges: [string, string][]): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  edges.forEach(([edgeType, target]) => {
    if (result.has(edgeType)) {
      result.set(edgeType, [...result.get(edgeType) as [string, string], target])
    } else {
      result.set(edgeType, [target])
    }
  })
  return result
}