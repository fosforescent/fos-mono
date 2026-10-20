/**
 * This server's own device root, which ships the standard library (the in-code seed). Each account's store is a device
 * root too, the server's for that account (its root type accepts Home), but ships no library of its own: it is nested
 * in this one (`nestScope`), so rows the server makes in an account resolve their row types and templates through this
 * library, unless the account's own nodes carry a nearer one (one linked in Home).
 */
import type { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { nestScope, setRootType } from '@fosforescent/shared/sync/graph'
import { createReplica, headCid, type Replica } from '@fosforescent/shared/sync/replica'
import { LIBRARY_VERSION, ensureDeviceLibrary } from '@fosforescent/shared/sync/library'
import { DEVICE_ROOT_TYPE } from '@fosforescent/shared/sync/library-types'

let deviceRoot: Replica | null = null
export function serverDeviceRoot(): Replica {
  return deviceRoot ??= ensureDeviceLibrary(createReplica('fos-server'), { address: null, version: LIBRARY_VERSION, rows: [] }, 0)
}

/** An account's store as the server holds it: a device root, nested in the server's own. */
export function asAccountStore<S extends FosStore>(store: S): S {
  const device = serverDeviceRoot()
  setRootType(store, DEVICE_ROOT_TYPE)
  nestScope(store, { store: device.store, root: headCid(device), at: [] })
  return store
}
