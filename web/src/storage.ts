/**
 * Persistence for the local replica.
 *
 * localStorage is available in every shell this UI runs in: the browser, and
 * the Tauri webview on desktop, iOS and Android. The adapter is an interface so
 * a file-backed implementation (e.g. the Tauri `.fos` directory) can be added
 * without touching the app.
 */

const REPLICA_KEY = 'fos.replica.v1'
const PREFS_KEY = 'fos.prefs.v1'
const SESSION_KEY = 'fos.session.v1'

export type DataOwner = { baseUrl: string; username: string; kind: 'user' | 'peer' }
export type DataSession = { id: string; owner: DataOwner | null; legacy?: boolean }
export function dataOwner(session: DataOwner): DataOwner { return { baseUrl: session.baseUrl.replace(/\/$/, ''), username: session.username, kind: session.kind } }

export interface ReplicaStorage {
  dataSession?(): DataSession
  selectAccount?(owner: DataOwner): boolean
  startOffline?(): void
  listDataSessions?(): DataSession[]
  selectDataSession?(id: string): void
  loadReplica(): unknown
  saveReplica(value: unknown): void
  loadPrefs(): unknown
  savePrefs(value: unknown): void
  /** The signed-in session (token, never a password), so the device reconnects on its own. */
  loadSession(): unknown
  saveSession(value: unknown | null): void
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`could not persist ${key}`, error)
  }
}

export function createLocalStorageAdapter(storage: Storage): ReplicaStorage {
  // Older web-mini builds persisted a password. Never read or use it to authenticate.
  try {
    storage.removeItem('web-mini.password')
    if (!readJson(storage, SESSION_KEY)) {
      const jwt = storage.getItem('web-mini.token') || storage.getItem('web-mini.jwt')
      const username = storage.getItem('web-mini.username')
      const baseUrl = storage.getItem('web-mini.api-url')
      // Bind legacy credentials to their original endpoint rather than sending them elsewhere.
      if (jwt && username && baseUrl) writeJson(storage, SESSION_KEY, { jwt, username, baseUrl, kind: 'user' })
    }
    storage.removeItem('web-mini.token')
    storage.removeItem('web-mini.jwt')
  } catch { /* restricted storage is handled by the adapter */ }
  return routedStorage((key) => readJson(storage, key), (key, value) => writeJson(storage, key, value), (key) => storage.removeItem(key))
}

/** Shared routing for browser persistence and the in-memory fallback. */
function routedStorage(read: (key: string) => unknown, write: (key: string, value: unknown) => void, remove: (key: string) => void): ReplicaStorage {
  const activeKey = 'fos.data-session.v1'
  const indexKey = 'fos.data-sessions.v1'
  const ownerKey = (owner: DataOwner) => JSON.stringify(dataOwner(owner))
  const valid = (value: unknown): value is DataSession => {
    const session = value as DataSession | null
    return !!session && typeof session.id === 'string' && (session.owner === null || (!!session.owner && typeof session.owner.username === 'string' && typeof session.owner.baseUrl === 'string'))
  }
  const index = () => { const value = read(indexKey); return Array.isArray(value) ? value.filter(valid) : [] }
  const prefix = (id: string) => `fos.data.${id}.`
  let active = read(activeKey) as DataSession | null
  const activate = (next: DataSession) => {
    active = next
    const sessions = index()
    write(indexKey, [...sessions.filter((s) => s.id !== next.id), next])
    write(activeKey, next)
  }
  if (!valid(active)) {
    const legacy = read(SESSION_KEY) as Partial<DataOwner> | null
    const owner = legacy && typeof legacy.username === 'string' && typeof legacy.baseUrl === 'string' ? dataOwner({ ...legacy, kind: legacy.kind === 'peer' ? 'peer' : 'user' } as DataOwner) : null
    // Keep the old slot in place: copying a large replica can exceed localStorage quota.
    const legacySlot = [REPLICA_KEY, PREFS_KEY, SESSION_KEY].some((key) => read(key) !== null)
    activate({ id: crypto.randomUUID(), owner, ...(legacySlot ? { legacy: true } : {}) })
  }
  const key = (name: string) => active!.legacy ? name : prefix(active!.id) + name
  return {
    dataSession: () => ({ ...active! }),
    selectAccount: (owner) => {
      owner = dataOwner(owner)
      if (active!.owner && ownerKey(active!.owner) === ownerKey(owner)) return false
      const existing = index().find((session) => session.owner && ownerKey(session.owner) === ownerKey(owner))
      activate(existing ?? { id: crypto.randomUUID(), owner })
      return true
    },
    startOffline: () => activate({ id: crypto.randomUUID(), owner: null }),
    listDataSessions: () => index(),
    selectDataSession: (id) => { const session = index().find((s) => s.id === id); if (session) activate(session) },
    loadReplica: () => read(key(REPLICA_KEY)), saveReplica: (value) => write(key(REPLICA_KEY), value),
    loadPrefs: () => read(key(PREFS_KEY)), savePrefs: (value) => write(key(PREFS_KEY), value),
    loadSession: () => read(key(SESSION_KEY)),
    saveSession: (value) => { if (value === null) remove(key(SESSION_KEY)); else write(key(SESSION_KEY), value) }
  }
}

export function createMemoryStorage(): ReplicaStorage {
  const values = new Map<string, unknown>()
  return routedStorage((key) => values.get(key) ?? null, (key, value) => { values.set(key, value) }, (key) => { values.delete(key) })
}

/** localStorage when usable (it throws in some private/webview contexts), memory otherwise. */
export function pickStorage(): ReplicaStorage {
  try {
    const probe = '__fos_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return createLocalStorageAdapter(window.localStorage)
  } catch {
    console.warn('localStorage unavailable; changes will not survive a reload')
    return createMemoryStorage()
  }
}
