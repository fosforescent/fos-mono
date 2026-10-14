/** Version observed when loading a store; advancing its database root is a compare-and-swap. */
const loadedRoots = new WeakMap<object, string>()
export function rememberLoadedRoot(store: object, root: string): void { loadedRoots.set(store, root) }
export async function saveRootVersion(store: { rootNodeId: string }, fallback: string, advance: (expected: string, next: string) => Promise<boolean>): Promise<void> {
  const expected = loadedRoots.get(store) ?? fallback, next = store.rootNodeId
  if (!await advance(expected, next)) throw new Error('The account changed on another server. Sync and review before trying again.')
  loadedRoots.set(store, next)
}
