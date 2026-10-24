/** Null bounds are unbounded for every resource, independently of quantity or unit. */
export type ResourceWindow = { start: number | null; end: number | null }
export type ResourceWindowInput = { start?: number | null; end?: number | null }

/** Authoring may omit bounds; persisted values explicitly represent both ends. */
export function resourceWindow(value: ResourceWindowInput): ResourceWindow {
  const start = value.start ?? null, end = value.end ?? null
  if (start !== null && (typeof start !== 'number' || !Number.isFinite(start)) ||
    end !== null && (typeof end !== 'number' || !Number.isFinite(end)) ||
    start !== null && end !== null && start > end) throw new Error('Invalid resource time bounds.')
  return { start, end }
}

/** A restricted grant cannot supply authority outside either of its bounds. */
export function resourceWindowContains(outer: ResourceWindowInput, inner: ResourceWindowInput): boolean {
  try {
    const a = resourceWindow(outer), b = resourceWindow(inner)
    return (a.start === null || b.start !== null && b.start >= a.start) &&
      (a.end === null || b.end !== null && b.end <= a.end)
  } catch { return false }
}

/** A demand constrains only its specified endpoints. Null on a demand does not
 * require an infinitely long reservation; null on a supplied grant grants an open bound.
 */
export function resourceWindowSatisfies(supply: ResourceWindowInput, demand: ResourceWindowInput): boolean {
  try {
    const a = resourceWindow(supply), b = resourceWindow(demand)
    return resourceWindowContains(a, { start: b.start ?? a.start, end: b.end ?? a.end })
  } catch { return false }
}
