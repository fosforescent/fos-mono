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

export interface ReplicaStorage {
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
  return {
    loadReplica: () => readJson(storage, REPLICA_KEY),
    saveReplica: (value) => writeJson(storage, REPLICA_KEY, value),
    loadPrefs: () => readJson(storage, PREFS_KEY),
    savePrefs: (value) => writeJson(storage, PREFS_KEY, value),
    loadSession: () => readJson(storage, SESSION_KEY),
    saveSession: (value) => {
      if (value === null) {
        try { storage.removeItem(SESSION_KEY) } catch { /* ignore */ }
      } else {
        writeJson(storage, SESSION_KEY, value)
      }
    }
  }
}

export function createMemoryStorage(): ReplicaStorage {
  let replica: unknown = null
  let prefs: unknown = null
  let session: unknown = null
  return {
    loadReplica: () => replica,
    saveReplica: (value) => { replica = value },
    loadPrefs: () => prefs,
    savePrefs: (value) => { prefs = value },
    loadSession: () => session,
    saveSession: (value) => { session = value }
  }
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
