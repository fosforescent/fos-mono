import { STANDARD_CAPABILITY_PATTERNS, capabilityName } from './capabilities'
import { discoverHandlers } from './handlers'
import { nativeRefValues } from './native-refs'
import { primitiveValue } from './primitives'
import { refSubmissions } from './scoped-refs'
import { isRefNode } from './graph'
export { cronMatches } from './trigger-primitives'
/** Triggers are named arguments on nodes, supplied by a device or the Home server peer. */
import { readNodeValue, writeNodeValue } from './evaluation'
import { addTask, headCid, instantiateTemplate, view, type Replica } from './replica'
import { newId, resolveScope, valueContent, content, isBranchChoice, readChoice, refBranches, put, withBranches, type Scope } from './graph'
import { TEMPLATE_TYPE } from './library-types'
import { argumentRefs } from './bindings'
import { bindRefInputs } from './refs'
/** Compatibility spelling at API boundaries; declarations, not this string, determine behavior. */
export type TriggerKind = string
export type TriggerDefinition = NonNullable<import('../types').FosDataContent['triggerDefinition']>
export type TriggerContext = { replica: Replica; path: Scope; config: NodeTrigger; now: number; previous: TriggerState | null }
export type TriggerEvent = { id: string; reset?: boolean; state?: Partial<TriggerState> }
export type TriggerObserver = { validate?(context: TriggerContext): void; observe(context: TriggerContext): TriggerEvent | null }
export function triggerOffers(r: Replica, path: Scope) {
  return discoverHandlers(r, path).flatMap((offer) => {
    const definition =
      content(r.store, offer.type).data.triggerDefinition ??
      STANDARD_CAPABILITY_PATTERNS.find((p) => p.name === capabilityName(r.store, offer.type))?.node.data.triggerDefinition
    return definition && refSubmissions(r.store, offer.cid).some((cid) => primitiveValue(r.store, cid)) ? [{ ...offer, definition }] : []
  })
}
function triggerArgument(r: Replica, path: Scope) {
  const cid = resolveScope(r.store, headCid(r), path)
  return cid ? argumentRefs(r.store, cid).find((a) => a.name === TRIGGER_ARGUMENT) : undefined
}
function boundObserver(r: Replica, path: Scope): string | undefined {
  const arg = triggerArgument(r, path)
  // The left side is the observer declaration itself, just like an ordinary primitive call.
  return arg && isRefNode(r.store, content(r.store, arg.type)) ? arg.type : undefined
}
export function triggerObserver(r: Replica, path: Scope, t: NodeTrigger): TriggerObserver | null {
  const bound = boundObserver(r, path)
  const offers = triggerOffers(r, path).filter(
    (o) => o.enabled && o.active && o.peerId === t.peer && (bound ? o.cid === bound : (o.capability ?? o.id) === t.kind)
  )
  if (offers.length !== 1) return null
  return nativeRefValues<unknown>(r, path, t.peer).find((value) => value.ref === offers[0]!.cid)?.native.trigger ?? null
}
function definitionOf(t: NodeTrigger): TriggerDefinition | undefined {
  return t.definition ?? STANDARD_CAPABILITY_PATTERNS.find((p) => p.name === t.kind)?.node.data.triggerDefinition
}
/** What a `response` trigger waits for: the evaluation request this peer left on another peer's node. */
export type AwaitedResponse = { request: string; node: Scope; requestedAt: number }
export type TriggerInput = {
  /** Legacy selector; new calls supply the handler ref directly. Never persisted. */
  kind?: TriggerKind
  peer: string
  enabled: boolean
  created: number
  due?: number
  expression?: string
  response?: AwaitedResponse
  watch?: { path: Scope; branch: string; baseline: string; argument?: string }
  handler?: string
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
export const TRIGGER_ARGUMENT = 'fos:trigger'
export const TRIGGER_TEMPLATE_ARGUMENT = 'fos:trigger-template'
export const TRIGGER_STATE_ARGUMENT = 'fos:trigger-state'
export function nodeTrigger(r: Replica, path: Scope): NodeTrigger | null {
  const t = readNodeValue<NodeTrigger>(r, path, TRIGGER_ARGUMENT),
    arg = triggerArgument(r, path)
  if (!t || !arg || typeof t.peer !== 'string' || typeof t.created !== 'number' || typeof t.enabled !== 'boolean') return null
  const type = discoverHandlers(r, path).find(offer => offer.cid === arg.type)?.type ?? arg.type
  const definition =
    content(r.store, type).data.triggerDefinition ??
    STANDARD_CAPABILITY_PATTERNS.find((p) => p.name === capabilityName(r.store, type))?.node.data.triggerDefinition
  return { ...t, kind: capabilityName(r.store, type) ?? t.kind ?? type, handler: boundObserver(r, path), definition }
}
export const triggerState = (r: Replica, path: Scope) => readNodeValue<TriggerState>(r, path, TRIGGER_STATE_ARGUMENT)

/** Bind trigger declarations carried by a template's graph data. Whole placeholders
 * preserve native values (for example a node path), rather than stringifying them. */
export function bindTemplateTriggers(r: Replica, path: Scope, bindings: Record<string, unknown>, now: number): Replica {
  let count = 0
  const walk = (at: Scope) => {
    if (at.length - path.length > 32 || ++count > 5000) throw new Error('Template trigger tree is too large.')
    const declaration = readNodeValue<NodeTrigger>(r, at, TRIGGER_TEMPLATE_ARGUMENT)
    if (declaration) {
      const trigger = bindRefInputs(declaration, bindings) as NodeTrigger
      trigger.created = now
      if (trigger.watch) {
        if (!Array.isArray(trigger.watch.path) || !trigger.watch.path.length || typeof trigger.watch.branch !== 'string')
          throw new Error('Bind the trigger to a node path and branch.')
        trigger.watch.baseline = watchedRefValue(r, trigger.watch.path, trigger.watch.branch, trigger.watch.argument) ?? ''
      }
      r = setNodeTrigger(r, at, trigger, now)
    }
    for (const row of view(r, at)?.tasks ?? []) if (!row.refId) walk([...at, row.id])
  }
  walk(path)
  return r
}

/** Observe a specific branch without changing the branch displayed by this device. */
export function watchedRefValue(r: Replica, path: Scope, branch: string, argument?: string): string | null {
  const target = resolveScope(r.store, headCid(r), path)
  if (!target) return null
  const node = content(r.store, target),
    names = isBranchChoice(r.store, node) ? readChoice(r.store, target).options.map((o) => o.peerId) : refBranches(r.store, node)?.names
  if (names && !names.includes(branch)) return null
  return withBranches(r.store, { [path.at(-1)!]: branch }, () => {
    const cid = resolveScope(r.store, headCid(r), path)
    if (cid && argument) {
      const ref = argumentRefs(r.store, cid).find((a) => a.name === argument)
      return put(r.store, ref ? valueContent(r.store, ref.cid) : { data: {}, children: [] })
    }
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
      (trigger.handler ? o.cid === trigger.handler : (o.capability ?? o.id) === trigger.kind)
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
  const observer = nativeRefValues<unknown>(r, path, trigger.peer).find((v) => v.ref === offer.cid)?.native.trigger
  observer?.validate?.({ replica: r, path, config, now, previous: triggerState(r, path) })
  const { kind: _kind, handler: _handler, definition: _definition, ...fields } = trigger
  return writeNodeValue(r, path, TRIGGER_ARGUMENT, fields, now, { type: offer.cid, peer: offer.peerId })
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
      await driver.save(
        writeNodeValue(
          driver.get(),
          path,
          TRIGGER_STATE_ARGUMENT,
          {
            occurrence: `invalid:${trigger.created}`,
            status: 'failed',
            target: path,
            error: error instanceof Error ? error.message : String(error)
          },
          driver.now()
        )
      )
      continue
    }
    const event = observed?.id
    if (observed?.reset && prior) {
      await driver.save(writeNodeValue(driver.get(), path, TRIGGER_STATE_ARGUMENT, { ...prior, occurrence: '' }, driver.now()))
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
    await driver.save(writeNodeValue(r, path, TRIGGER_STATE_ARGUMENT, state, driver.now()))
    try {
      await driver.evaluate(target)
      state = { ...state, status: 'finished' }
    } catch (error) {
      state = { ...state, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
    await driver.save(writeNodeValue(driver.get(), path, TRIGGER_STATE_ARGUMENT, state, driver.now()))
  }
}

/**
 * Peer A sent an evaluation request to peer B (`complete` answered `requested`): set up the continuation on A's node
 * automatically, so A's own evaluation runs when B's answer arrives. The trigger belongs to this device and runs
 * while its app is open, like the other device triggers.
 */
export function requestContinuation(r: Replica, at: Scope, awaited: AwaitedResponse, now: number): Replica {
  return setNodeTrigger(r, at, { kind: 'response', peer: r.meta.peerId, enabled: true, created: now, response: awaited }, now)
}
