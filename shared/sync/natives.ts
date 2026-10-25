/**
 * How a host registers its natives: each is a definition of one capability's implementation, published as a native
 * ref under the host's member entry in a scope, through the same declaration every handler goes through. There is no
 * other way for host code to reach evaluation.
 */
import type { Scope } from './graph'
import { libAt } from './graph'
import type { Replica } from './replica'
import type { FosStore } from '../dag-implementation/store'
import { nativeRef, publishNativeRef, restoreNativeRef, primitiveExecutors, nativeRefValues, type NativeImplementation, type PrimitiveDefinition } from './native-refs'
import type { Native } from './native'
import type { EvaluationStep, StepExecutor } from './evaluation'

export type NativeDefinition = {
  /** The host's name for it (`device:fetch`, `fos:search`); its identity on the graph is the ref this makes. */
  id: string
  label?: string
  /** The library capability it implements, by field name, or the capability node itself for a scope. */
  capability: string | ((store: FosStore, at: Scope) => string)
  native: Native
  /** Narrows which rows of the capability it runs, while the library's patterns are not refined enough to say. */
  handles?: NativeImplementation['handles']
}

/** A definition as the native-ref layer declares it. */
export function defineNative(definition: NativeDefinition): PrimitiveDefinition<unknown> {
  const capability = definition.capability
  return { id: definition.id, label: definition.label ?? definition.id, native: definition.native, ...(definition.handles ? { handles: definition.handles } : {}),
    type: typeof capability === 'function' ? capability : (store, at) => libAt(store, at).capabilities[capability]! }
}

/** Publish the host's natives in `at` (once each) and give them their local meaning. */
export function registerNatives(r: Replica, at: Scope, host: string, definitions: PrimitiveDefinition<unknown>[], now: number, label = host): Replica {
  for (const definition of definitions) r = publishNativeRef(r, at, host, nativeRef(r.store, host, definition, definition, at), now, label)
  return r
}
/** After a reload or a store swap: the published refs keep their pinned capability; only the local meaning is restored. */
export function restoreNatives(r: Replica, at: Scope, host: string, definitions: PrimitiveDefinition<unknown>[]): void {
  for (const definition of definitions) restoreNativeRef(r, at, host, definition, definition)
}
/**
 * The same registration for a host whose local meaning is a richer object than the definition (a server's handler
 * with its availability and hooks): `meaning` is what the published ref means here; it must carry the `native`.
 */
export function registerNative<Meaning>(r: Replica, at: Scope, host: string, definition: PrimitiveDefinition<unknown>, meaning: Meaning, now: number, label = host): Replica {
  return publishNativeRef(r, at, host, nativeRef(r.store, host, definition, meaning as never, at), now, label)
}
export function restoreNative<Meaning>(r: Replica, at: Scope, host: string, definition: PrimitiveDefinition<unknown>, meaning: Meaning): void {
  restoreNativeRef(r, at, host, definition, meaning as never)
}
/** The ref a host would publish for a definition, built in `store` without publishing (what it ships to its accounts' contexts). */
export function nativeOffer<Meaning>(store: FosStore, host: string, definition: PrimitiveDefinition<unknown>, meaning: Meaning, at: Scope = []): string {
  return nativeRef(store, host, definition, meaning as never, at)
}
/** The local meanings of the natives published in scope, with their hosts and refs. */
export function nativeValues<Meaning>(r: Replica, at: Scope, host?: string): Array<{ native: Meaning; host: string; ref: string }> {
  return nativeRefValues(r, at, host) as never
}
/** The natives (as their meanings) that can run a step, with their hosts. */
export function nativeExecutorsOf<Meaning>(r: Replica, step: EvaluationStep, host?: string): Array<{ native: Meaning; host: string; ref: string }> {
  return primitiveExecutors(r, step, host) as never
}

/** The executors a host offers a step: the natives its published refs resolve to, as the evaluator takes them. */
export function nativeExecutors(r: Replica, step: EvaluationStep, host?: string): StepExecutor[] {
  return primitiveExecutors(r, step, host).flatMap(value => value.native.native ? [{ native: value.native.native }] : [])
}
