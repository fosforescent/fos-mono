/**
 * Project mode inside the desktop shell: when the app is started in (or below)
 * a directory holding fos.config.toml, it uses that config and keeps its state
 * in <dir>/.fos/ — the same files the `fos` CLI uses (device.json,
 * session.json, replicas/<branch>.json), so both show the same tasks and the
 * same git branch.
 *
 * Tauri IPC is asynchronous while the storage interface is synchronous, so the
 * files are preloaded into memory and writes are flushed in the background.
 */

import { branchFileName, parseToml, type FosProjectConfig } from '../../shared/sync/index'
import type { ReplicaStorage } from './storage'

export type ProjectInfo = { dir: string; config: FosProjectConfig; branch: string | null }

type TauriWindow = Window & { __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } } }

export function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> | null {
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke
  return invoke ? (invoke(cmd, args) as Promise<T>) : null
}

export function inTauri(): boolean {
  return !!(window as TauriWindow).__TAURI__?.core?.invoke
}

/** Open a URL in the system browser (tauri-plugin-opener, `opener:default` in capabilities). Null outside Tauri. */
export function openExternal(url: string): Promise<void> | null {
  return tauriInvoke<void>('plugin:opener|open_url', { url })
}

export async function findProject(): Promise<ProjectInfo | null> {
  const call = tauriInvoke<{ dir: string; config: string; branch: string | null } | null>('find_project')
  if (!call) return null
  try {
    const found = await call
    if (!found) return null
    return { dir: found.dir, config: parseToml(found.config) as FosProjectConfig, branch: found.branch }
  } catch (error) {
    console.warn('find_project failed', error)
    return null
  }
}

async function readFile(dir: string, name: string): Promise<unknown> {
  const call = tauriInvoke<string | null>('read_project_file', { dir, name })
  if (!call) return null
  try {
    const text = await call
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function writeFile(dir: string, name: string, value: unknown): void {
  const call = tauriInvoke<void>('write_project_file', { dir, name, content: JSON.stringify(value) })
  call?.catch((error) => console.warn(`could not write ${name}`, error))
}

export type ProjectStorage = ReplicaStorage & {
  /** Switch the replica file to another branch (preloads it). */
  useBranch(branch: string): Promise<void>
  branch(): string
}

export async function createProjectStorage(info: ProjectInfo): Promise<ProjectStorage> {
  const dir = info.dir
  let branch = info.branch ?? 'local'
  const replicaFile = () => `replicas/${branchFileName(branch)}.json`
  let replica = await readFile(dir, replicaFile())
  let session = await readFile(dir, 'session.json')
  let prefs = await readFile(dir, 'ui-prefs.json')
  const device = (await readFile(dir, 'device.json')) as { peerId?: string; name?: string } | null

  return {
    loadReplica: () => withDevice(replica, device),
    saveReplica: (value) => { replica = value; writeFile(dir, replicaFile(), value) },
    loadPrefs: () => prefs,
    savePrefs: (value) => { prefs = value; writeFile(dir, 'ui-prefs.json', value) },
    loadSession: () => session,
    saveSession: (value) => { session = value; if (value === null) writeFile(dir, 'session.json', null); else writeFile(dir, 'session.json', value) },
    async useBranch(next) {
      branch = next
      replica = await readFile(dir, replicaFile())
    },
    branch: () => branch
  }
}

/** The CLI and the app must be the same device: take the peer id from device.json when present. */
function withDevice(replica: unknown, device: { peerId?: string; name?: string } | null): unknown {
  if (!device?.peerId) return replica
  const base = (replica && typeof replica === 'object' ? replica : { meta: {}, context: null }) as { meta?: Record<string, unknown> }
  return { ...base, meta: { ...(base.meta ?? {}), peerId: device.peerId } }
}

export function saveDevice(info: ProjectInfo, device: { peerId: string; name: string }): void {
  writeFile(info.dir, 'device.json', device)
}
