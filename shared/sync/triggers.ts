import { capabilityName, sameCapabilityType, triggerDefinitionOf, isTriggerLeft } from './capabilities'
export { triggerDefinitionOf, isTriggerLeft } from './capabilities'
import { discoverHandlers } from './handlers'
import { primitiveValues } from './primitives'
import { primitiveValue } from './primitives'
import { refSubmissions } from './scoped-refs'
import { isRefNode } from './graph'
export { cronMatches } from './trigger-primitives'
/**
 * A trigger is a row of its node: its left is the trigger capability (`timer`, `ref-change`, …, a library pattern with a
 * `triggerDefinition`), its right a node holding its configuration, the peer that observes it and its state. The
 * observing peer's handler is found the way a requirement's is, by discovery in scope. A template's trigger rows are
 * declarations: inactive until the template is applied, when their placeholders are bound (`bindTemplateTriggers`).
 */
import { addTask, headCid, instantiateTemplate, view, type Replica } from './replica'
import { libAt, newId, resolveScope, valueContent, content, isBranchChoice, readChoice, refBranches, put, withBranches, type Scope } from './graph'
import { TEMPLATE_TYPE } from './library-types'
import { bindRefInputs } from './refs'
import { readGraphValue } from './node-values'
import { rowWithLeft, writeRowValue } from './row-values'
/** A presentation label; it must never select an observer implementation. */
export type TriggerKind = string
export type TriggerDefinition = NonNullable<import('../types').FosDataContent['triggerDefinition']>
export type TriggerContext = { replica: Replica; path: Scope; config: NodeTrigger; now: number; previous: TriggerState | null }
export type TriggerEvent = { id: string; reset?: boolean; state?: Partial<TriggerState> }
export type TriggerObserver = { validate?(context: TriggerContext): void; observe(context: TriggerContext): TriggerEvent | null }
export function triggerOffers(r: Replica, path: Scope) {
  return discoverHandlers(r, path).flatMap((offer) => {
    const definition = triggerDefinitionOf(r.store, offer.type)
    return definition && refSubmissions(r.store, offer.cid).some((cid) => primitiveValue(r.store, cid)) ? [{ ...offer, definition }] : []
  })
}
/** The node's trigger row: its left is a trigger capability (or one observer's offer of it). */
function triggerRow(r: Replica, path: Scope) {
  const cid = resolveScope(r.store, headCid(r), path)
  return cid ? rowWithLeft(r.store, cid, isTriggerLeft) : null
}
/** The offer a trigger row's left pins, when it is one (not the capability itself). */
const pinnedOffer = (r: Replica, left: string): string | undefined => isRefNode(r.store, content(r.store, left)) ? left : undefined
/** A trigger row's fields as stored: its configuration, its state, and the declaration it was bound from (a template's). */
type StoredTrigger = TriggerInput & { state?: TriggerState; declaration?: TriggerInput }
function storedTrigger(r: Replica, path: Scope): { left: string; value: StoredTrigger } | null {
  const row = triggerRow(r, path)
  const value = row ? readGraphValue(r.store, row.ref) as StoredTrigger | undefined : undefined
  return row && value && typeof value === 'object' ? { left: row.edge[0], value } : null
}
export function triggerObserver(r: Replica, path: Scope, t: NodeTrigger): TriggerObserver | null {
  const offers = triggerOffers(r, path).filter(
    (o) => o.enabled && o.active && o.peerId === t.peer && (t.handler ? o.cid === t.handler : !!t.observer && sameCapabilityType(r.store, o.type, t.observer))
  )
  if (offers.length !== 1) return null
  return primitiveValues(r, path, t.peer).find((value) => value.ref === offers[0]!.cid)?.implementation.trigger ?? null
}
function definitionOf(t: NodeTrigger): TriggerDefinition | undefined {
  return t.definition
}
/** What a `response` trigger waits for: the evaluation request this peer left on another peer's node. */
export type AwaitedResponse = { request: string; node: Scope; requestedAt: number }
export type TriggerInput = {
  /** Presentation only; select an observer through `handler` or `observer`. */
  kind?: TriggerKind
  peer: string
  enabled: boolean
  created: number
  due?: number
  expression?: string
  response?: AwaitedResponse
  /** `merges`: fire when a branch is merged into the watched ref, not when it is edited directly. */
  watch?: { path: Scope; branch: string; baseline: string; merges?: boolean }
  handler?: string
  /** The trigger capability its row has on the left; offers of it observe the trigger. Never persisted. */
  observer?: string
  definition?: TriggerDefinition
  [key: string]: unknown
}
export type NodeTrigger = TriggerInput & { kind: TriggerKind }
export type TriggerState = {
  occurrence: string
  status: 'running' | 'finished' | 'failed'
  error?: string
  target: Scope
  requestTime?: number
  requestIds?: string[]
}
export function nodeTrigger(r: Replica, path: Scope): NodeTrigger | null {
  const stored = storedTrigger(r, path)
  if (!stored) return null
  const { state: _state, declaration: _declaration, ...t } = stored.value
  if (typeof t.peer !== 'string' || typeof t.created !== 'number' || typeof t.enabled !== 'boolean') return null
  const handler = pinnedOffer(r, stored.left)
  const type = handler ? triggerOffers(r, path).find(o => o.cid === handler)?.type : stored.left
  return { ...t, kind: (type && capabilityName(r.store, type)) ?? capabilityName(r.store, stored.left) ?? stored.left, ...(handler ? { handler } : { observer: stored.left }), definition: triggerDefinitionOf(r.store, stored.left) }
}
export const triggerState = (r: Replica, path: Scope): TriggerState | null => storedTrigger(r, path)?.value.state ?? null
/** Record the trigger's state in its row. */
export function writeTriggerState(r: Replica, path: Scope, state: TriggerState, now: number): Replica {
  const stored = storedTrigger(r, path)
  if (!stored) throw new Error('This node has no trigger.')
  return writeRowValue(r, path, stored.left, { ...stored.value, state }, now)
}
/** Switch the trigger on or off without choosing its observer again. */
export function setTriggerEnabled(r: Replica, path: Scope, enabled: boolean, now: number): Replica {
  const stored = storedTrigger(r, path)
  if (!stored) throw new Error('This node has no trigger.')
  return writeRowValue(r, path, stored.left, { ...stored.value, enabled }, now)
}

/** Bind the trigger declarations an applied template brought along (its trigger rows), again from the declaration each
 * was first bound from. Whole placeholders preserve host values (for example a node path), rather than stringifying them. */
export function bindTemplateTriggers(r: Replica, path: Scope, bindings: Record<string, unknown>, now: number): Replica {
  let count = 0
  const walk = (at: Scope) => {
    if (at.length - path.length > 32 || ++count > 5000) throw new Error('Template trigger tree is too large.')
    const stored = storedTrigger(r, at)
    if (stored) {
      const { state: _state, declaration: kept, ...current } = stored.value
      const declaration = kept ?? current
      const handler = pinnedOffer(r, stored.left)
      const trigger = { ...(bindRefInputs(declaration, bindings) as TriggerInput), ...(handler ? { handler } : { observer: stored.left }), declaration }
      trigger.created = now
      if (trigger.watch) {
        if (!Array.isArray(trigger.watch.path) || !trigger.watch.path.length || typeof trigger.watch.branch !== 'string')
          throw new Error('Bind the trigger to a node path and branch.')
        trigger.watch.baseline = watchedRefValue(r, trigger.watch.path, trigger.watch.branch, trigger.watch.merges) ?? ''
      }
      r = setNodeTrigger(r, at, trigger, now)
    }
    for (const row of view(r, at)?.tasks ?? []) if (!row.refId) walk([...at, row.id])
  }
  walk(path)
  return r
}

/**
 * Observe a specific branch of a ref without changing the branch displayed by this device: its value, or with
 * `merges` what has been merged into it. A merge moves the merged branch's base (`mergeBranch`); a direct edit does not.
 */
export function watchedRefValue(r: Replica, path: Scope, branch: string, merges = false): string | null {
  const target = resolveScope(r.store, headCid(r), path)
  if (!target) return null
  const node = content(r.store, target),
    names = isBranchChoice(r.store, node) ? readChoice(r.store, target).options.map((o) => o.peerId) : refBranches(r.store, node)?.names
  if (names && !names.includes(branch)) return null
  // a merge into the branch records what was merged in as its base (`mergeBranch`)
  if (merges) return put(r.store, { data: {}, children: isBranchChoice(r.store, node) ? readChoice(r.store, target).options.flatMap((o) => o.base && o.peerId === branch ? [o.base] : []) : [] })
  return withBranches(r.store, { [path.at(-1)!]: branch }, () => {
    const cid = resolveScope(r.store, headCid(r), path)
    return cid ? put(r.store, valueContent(r.store, cid)) : null
  })
}

/** Required configuration is declared by the observer type. */
export function missingSchedule(t: NodeTrigger | null | undefined): string | null {
  if (!t) return null
  const field = definitionOf(t)?.schedule
  return field && (t[field.field] === undefined || t[field.field] === null || t[field.field] === '') ? field.label : null
}
export function setNodeTrigger(r: Replica, path: Scope, trigger: TriggerInput, now: number): Replica {
  const offers = triggerOffers(r, path).filter(
    (o) =>
      o.peerId === trigger.peer &&
      o.enabled &&
      o.active &&
      (trigger.handler ? o.cid === trigger.handler : !!trigger.observer && sameCapabilityType(r.store, o.type, trigger.observer))
  )
  if (offers.length !== 1) throw new Error('Choose one available observer ref in this scope.')
  const offer = offers[0]!,
    config = { ...trigger, kind: offer.capability ?? offer.id, definition: offer.definition }
  if (
    offer.definition.mode === 'instantiate' &&
    (!path.length || view(r, path.slice(0, -1))?.tasks.find((row) => row.id === path.at(-1))?.type !== TEMPLATE_TYPE)
  )
    throw new Error('This observer instantiates a template.')
  if (missingSchedule(config) && trigger.enabled)
    throw new Error('Set its schedule (' + missingSchedule(config) + ') before enabling the trigger.')
  const observer = primitiveValues(r, path, trigger.peer).find((v) => v.ref === offer.cid)?.implementation.trigger
  observer?.validate?.({ replica: r, path, config, now, previous: triggerState(r, path) })
  const { kind: _kind, handler: _handler, observer: _observer, definition: _definition, ...fields } = trigger
  // what it keeps across a new configuration: its state, and the declaration a template bound it from
  const prior = storedTrigger(r, path)?.value
  const kept = { ...(prior?.state ? { state: prior.state } : {}), ...(prior?.declaration && !fields.declaration ? { declaration: prior.declaration } : {}) }
  // a trigger given one observer's declaration is pinned to it (its left is the offer); otherwise any offer of the capability observes it
  return writeRowValue(r, path, trigger.handler ? offer.cid : offer.type, { ...fields, ...kept }, now, offer.peerId, isTriggerLeft)
}
export function triggerObservation(r: Replica, path: Scope, t: NodeTrigger, now: number): TriggerEvent | null {
  if (!t.enabled || missingSchedule(t)) return null
  return triggerObserver(r, path, t)?.observe({ replica: r, path, config: t, now, previous: triggerState(r, path) }) ?? null
}
export function triggerOccurrence(r: Replica, path: Scope, t: NodeTrigger, now: number): string | null {
  return triggerObservation(r, path, t, now)?.id || null
}
export function configuredTriggers(r: Replica): Array<{ path: Scope; trigger: NodeTrigger }> {
  const result: Array<{ path: Scope; trigger: NodeTrigger }> = [],
    seen = new Set<string>()
  const walk = (path: Scope) => {
    if (path.length > 64 || seen.size > 5000) return
    const trigger = nodeTrigger(r, path)
    if (trigger) result.push({ path, trigger })
    for (const row of view(r, path)?.tasks ?? []) {
      if (seen.has(row.id) || row.refId !== undefined) continue
      seen.add(row.id)
      // Only the template itself can trigger; its internal declarations are inactive until applied.
      if (row.type === TEMPLATE_TYPE) {
        const nested = nodeTrigger(r, [...path, row.id])
        if (nested) result.push({ path: [...path, row.id], trigger: nested })
      } else walk([...path, row.id])
    }
  }
  walk([])
  return result
}
export async function runNodeTriggers(driver: {
  get(): Replica
  save(r: Replica): void | Promise<void>
  now(): number
  available(peer: string, kind: TriggerKind, path: Scope): boolean
  evaluate(path: Scope): Promise<void>
}): Promise<void> {
  for (const { path, trigger } of configuredTriggers(driver.get())) {
    if (!driver.available(trigger.peer, trigger.kind, path) || view(driver.get(), path)?.choices.length) continue
    const prior = triggerState(driver.get(), path)
    if (prior?.status === 'running' || prior?.status === 'failed') continue
    let observed: TriggerEvent | null
    try {
      observed = triggerObservation(driver.get(), path, trigger, driver.now())
    } catch (error) {
      await driver.save(writeTriggerState(driver.get(), path, { occurrence: `invalid:${trigger.created}`, status: 'failed', target: path, error: error instanceof Error ? error.message : String(error) }, driver.now()))
      continue
    }
    const event = observed?.id
    if (observed?.reset && prior) {
      await driver.save(writeTriggerState(driver.get(), path, { ...prior, occurrence: '' }, driver.now()))
      continue
    }
    if (!event || prior?.occurrence === event) continue
    let r = driver.get(),
      target = path
    const row = path.length ? view(r, path.slice(0, -1))?.tasks.find((t) => t.id === path.at(-1)) : null
    if (definitionOf(trigger)?.mode === 'instantiate' && row?.type === TEMPLATE_TYPE) {
      const id = newId(),
        parent = path.slice(0, -1)
      r = addTask(r, parent, row.title, driver.now(), id)
      r = instantiateTemplate(r, parent, id, row.id, driver.now())
      target = [...parent, id]
    }
    // Claim before evaluating. Failed/interrupted runs require explicit review, not an automatic retry.
    let state: TriggerState = { ...observed?.state, occurrence: event, status: 'running', target }
    await driver.save(writeTriggerState(r, path, state, driver.now()))
    try {
      await driver.evaluate(target)
      state = { ...state, status: 'finished' }
    } catch (error) {
      state = { ...state, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
    await driver.save(writeTriggerState(driver.get(), path, state, driver.now()))
  }
}

/**
 * Peer A sent an evaluation request to peer B (`complete` answered `requested`): set up the continuation on A's node
 * automatically, so A's own evaluation runs when B's answer arrives. The trigger belongs to this device and runs
 * while its app is open, like the other device triggers.
 */
export function requestContinuation(r: Replica, at: Scope, awaited: AwaitedResponse, now: number): Replica {
  return setNodeTrigger(r, at, { observer: libAt(r.store, at).capabilities.response!, peer: r.meta.peerId, enabled: true, created: now, response: awaited }, now)
}
