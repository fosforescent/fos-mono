/**
 * Session Types for Fosforescent
 *
 * Implements Par-style session types for multi-party communication protocols.
 * Session types ensure that communication follows a pre-defined protocol.
 */

import { FosNode } from "./node"
import { FosStore } from "./store"

/**
 * Protocol types - defines the structure of a communication session
 */
export type Protocol =
  | SendProtocol
  | RecvProtocol
  | ChoiceProtocol
  | SelectProtocol
  | EndProtocol

/**
 * Send: output a value of type payloadType, then continue
 */
export interface SendProtocol {
  type: 'send'
  payloadType: string  // Type ID (CID) of what to send
  then: Protocol
}

/**
 * Recv: input a value of type payloadType, then continue
 */
export interface RecvProtocol {
  type: 'recv'
  payloadType: string  // Type ID (CID) of what to receive
  then: Protocol
}

/**
 * Choice: offer a choice to the other party
 */
export interface ChoiceProtocol {
  type: 'choice'
  options: Record<string, Protocol>
}

/**
 * Select: make a selection from offered choices
 */
export interface SelectProtocol {
  type: 'select'
  options: Record<string, Protocol>
}

/**
 * End: session complete
 */
export interface EndProtocol {
  type: 'end'
}

/**
 * Compute the dual of a protocol (flip send/recv, choice/select)
 * This is the protocol from the other party's perspective
 */
export function dual(protocol: Protocol): Protocol {
  switch (protocol.type) {
    case 'send':
      return {
        type: 'recv',
        payloadType: protocol.payloadType,
        then: dual(protocol.then)
      }
    case 'recv':
      return {
        type: 'send',
        payloadType: protocol.payloadType,
        then: dual(protocol.then)
      }
    case 'choice':
      const dualOptions: Record<string, Protocol> = {}
      for (const [key, value] of Object.entries(protocol.options)) {
        dualOptions[key] = dual(value)
      }
      return { type: 'select', options: dualOptions }
    case 'select':
      const dualSelectOptions: Record<string, Protocol> = {}
      for (const [key, value] of Object.entries(protocol.options)) {
        dualSelectOptions[key] = dual(value)
      }
      return { type: 'choice', options: dualSelectOptions }
    case 'end':
      return { type: 'end' }
  }
}

/**
 * Check if two protocols are duals of each other
 */
export function areDual(p1: Protocol, p2: Protocol): boolean {
  if (p1.type === 'send' && p2.type === 'recv') {
    return p1.payloadType === p2.payloadType && areDual(p1.then, p2.then)
  }
  if (p1.type === 'recv' && p2.type === 'send') {
    return p1.payloadType === p2.payloadType && areDual(p1.then, p2.then)
  }
  if (p1.type === 'choice' && p2.type === 'select') {
    const keys1 = Object.keys(p1.options).sort()
    const keys2 = Object.keys(p2.options).sort()
    if (keys1.join(',') !== keys2.join(',')) return false
    return keys1.every(k => areDual(p1.options[k], p2.options[k]))
  }
  if (p1.type === 'select' && p2.type === 'choice') {
    const keys1 = Object.keys(p1.options).sort()
    const keys2 = Object.keys(p2.options).sort()
    if (keys1.join(',') !== keys2.join(',')) return false
    return keys1.every(k => areDual(p1.options[k], p2.options[k]))
  }
  if (p1.type === 'end' && p2.type === 'end') {
    return true
  }
  return false
}

/**
 * Session type error
 */
export class SessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SessionError"
  }
}

/**
 * Message in a channel queue
 */
interface ChannelMessage {
  type: 'value' | 'choice'
  value?: unknown
  choice?: string
}

/**
 * Channel endpoint state
 */
type ChannelState = 'open' | 'closed'

/**
 * Typed channel for session communication
 * Provides type-safe communication following a protocol
 */
export class TypedChannel<P extends Protocol = Protocol> {
  private id: string
  private currentProtocol: P
  private inbox: ChannelMessage[] = []
  private outbox: ChannelMessage[] = []
  private state: ChannelState = 'open'
  private onMessageCallback?: (msg: ChannelMessage) => void

  constructor(protocol: P, id?: string) {
    this.currentProtocol = protocol
    this.id = id || `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get the channel ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get the current protocol state
   */
  getProtocol(): P {
    return this.currentProtocol
  }

  /**
   * Check if channel is closed
   */
  isClosed(): boolean {
    return this.state === 'closed'
  }

  /**
   * Send a value (only valid when protocol expects send)
   */
  send<T>(value: T): TypedChannel<P extends SendProtocol ? P['then'] : never> {
    if (this.state === 'closed') {
      throw new SessionError('Cannot send on closed channel')
    }
    if (this.currentProtocol.type !== 'send') {
      throw new SessionError(`Protocol violation: expected ${this.currentProtocol.type}, got send`)
    }

    const msg: ChannelMessage = { type: 'value', value }
    this.outbox.push(msg)
    if (this.onMessageCallback) {
      this.onMessageCallback(msg)
    }

    // Advance protocol
    const nextProtocol = (this.currentProtocol as SendProtocol).then as P extends SendProtocol ? P['then'] : never
    return new TypedChannel(nextProtocol, this.id) as TypedChannel<P extends SendProtocol ? P['then'] : never>
  }

  /**
   * Receive a value (only valid when protocol expects recv)
   */
  recv<T>(): [T, TypedChannel<P extends RecvProtocol ? P['then'] : never>] {
    if (this.state === 'closed') {
      throw new SessionError('Cannot receive on closed channel')
    }
    if (this.currentProtocol.type !== 'recv') {
      throw new SessionError(`Protocol violation: expected ${this.currentProtocol.type}, got recv`)
    }

    // In a real implementation, this would block or return a promise
    const msg = this.inbox.shift()
    if (!msg || msg.type !== 'value') {
      throw new SessionError('No message available to receive')
    }

    // Advance protocol
    const nextProtocol = (this.currentProtocol as RecvProtocol).then as P extends RecvProtocol ? P['then'] : never
    return [msg.value as T, new TypedChannel(nextProtocol, this.id) as TypedChannel<P extends RecvProtocol ? P['then'] : never>]
  }

  /**
   * Offer a choice to the other party (only valid when protocol expects choice)
   * The other party will select which branch to take
   */
  offer(): { branch: string; channel: TypedChannel } {
    if (this.state === 'closed') {
      throw new SessionError('Cannot offer on closed channel')
    }
    if (this.currentProtocol.type !== 'choice') {
      throw new SessionError(`Protocol violation: expected ${this.currentProtocol.type}, got offer`)
    }

    // Wait for selection from other party
    const msg = this.inbox.shift()
    if (!msg || msg.type !== 'choice' || !msg.choice) {
      throw new SessionError('No selection received')
    }

    const options = (this.currentProtocol as ChoiceProtocol).options
    if (!(msg.choice in options)) {
      throw new SessionError(`Invalid selection: ${msg.choice}`)
    }

    const nextProtocol = options[msg.choice]
    return {
      branch: msg.choice,
      channel: new TypedChannel(nextProtocol, this.id)
    }
  }

  /**
   * Select a branch from offered choices (only valid when protocol expects select)
   */
  select<K extends string>(
    choice: K
  ): TypedChannel<P extends SelectProtocol ? (K extends keyof P['options'] ? P['options'][K] : never) : never> {
    if (this.state === 'closed') {
      throw new SessionError('Cannot select on closed channel')
    }
    if (this.currentProtocol.type !== 'select') {
      throw new SessionError(`Protocol violation: expected ${this.currentProtocol.type}, got select`)
    }

    const options = (this.currentProtocol as SelectProtocol).options
    if (!(choice in options)) {
      throw new SessionError(`Invalid selection: ${choice}`)
    }

    const msg: ChannelMessage = { type: 'choice', choice }
    this.outbox.push(msg)
    if (this.onMessageCallback) {
      this.onMessageCallback(msg)
    }

    const nextProtocol = options[choice]
    return new TypedChannel(nextProtocol, this.id) as TypedChannel<
      P extends SelectProtocol ? (K extends keyof P['options'] ? P['options'][K] : never) : never
    >
  }

  /**
   * Close the channel (only valid when protocol is end)
   */
  close(): void {
    if (this.currentProtocol.type !== 'end') {
      throw new SessionError(`Protocol violation: cannot close before protocol is complete`)
    }
    this.state = 'closed'
  }

  /**
   * Deliver a message to this channel's inbox
   */
  deliver(msg: ChannelMessage): void {
    this.inbox.push(msg)
  }

  /**
   * Set callback for outgoing messages
   */
  onMessage(callback: (msg: ChannelMessage) => void): void {
    this.onMessageCallback = callback
  }

  /**
   * Get pending outbox messages
   */
  getOutbox(): ChannelMessage[] {
    return [...this.outbox]
  }

  /**
   * Clear outbox after messages have been transmitted
   */
  clearOutbox(): void {
    this.outbox = []
  }
}

/**
 * Create a pair of connected channels with dual protocols
 */
export function connect<P extends Protocol>(protocol: P): [TypedChannel<P>, TypedChannel<ReturnType<typeof dual>>] {
  const dualProtocol = dual(protocol) as ReturnType<typeof dual>
  const ch1 = new TypedChannel(protocol)
  const ch2 = new TypedChannel(dualProtocol)

  // Connect the channels
  ch1.onMessage((msg) => ch2.deliver(msg))
  ch2.onMessage((msg) => ch1.deliver(msg))

  return [ch1, ch2]
}

// === Common Protocol Patterns ===

/**
 * Request-Response protocol: send request, receive response
 */
export function requestResponse(requestType: string, responseType: string): Protocol {
  return {
    type: 'send',
    payloadType: requestType,
    then: {
      type: 'recv',
      payloadType: responseType,
      then: { type: 'end' }
    }
  }
}

/**
 * Stream protocol: repeatedly receive values until close
 */
export function stream(itemType: string): Protocol {
  const streamProtocol: ChoiceProtocol = {
    type: 'choice',
    options: {
      next: {
        type: 'recv',
        payloadType: itemType,
        then: null as unknown as Protocol  // Will be set below
      },
      done: { type: 'end' }
    }
  }
  // Make it recursive
  ;(streamProtocol.options.next as RecvProtocol).then = streamProtocol
  return streamProtocol
}

/**
 * State monad protocol (get/put capability)
 */
export function stateProtocol(stateType: string): Protocol {
  const proto: ChoiceProtocol = {
    type: 'choice',
    options: {
      get: {
        type: 'send',
        payloadType: stateType,
        then: null as unknown as Protocol
      },
      put: {
        type: 'recv',
        payloadType: stateType,
        then: null as unknown as Protocol
      },
      done: { type: 'end' }
    }
  }
  // Make get and put recursive back to the choice
  ;(proto.options.get as SendProtocol).then = proto
  ;(proto.options.put as RecvProtocol).then = proto
  return proto
}

/**
 * Serialize a protocol to a node structure
 */
export function protocolToNode(store: FosStore, protocol: Protocol): FosNode {
  const sendPrimitive = store.primitive.sendNode
  const recvPrimitive = store.primitive.recvNode
  const choicePrimitive = store.primitive.choiceNode
  const selectPrimitive = store.primitive.selectNode
  const endPrimitive = store.primitive.endNode

  switch (protocol.type) {
    case 'send':
      return store.create({
        data: { session: { type: 'send', payloadType: protocol.payloadType } },
        children: [
          [sendPrimitive.getId(), protocolToNode(store, protocol.then).getId()]
        ]
      })
    case 'recv':
      return store.create({
        data: { session: { type: 'recv', payloadType: protocol.payloadType } },
        children: [
          [recvPrimitive.getId(), protocolToNode(store, protocol.then).getId()]
        ]
      })
    case 'choice':
      const choiceChildren: [string, string][] = Object.entries(protocol.options).map(
        ([name, optProtocol]) => [name, protocolToNode(store, optProtocol).getId()]
      )
      return store.create({
        data: { session: { type: 'choice', options: Object.keys(protocol.options) } },
        children: [[choicePrimitive.getId(), store.primitive.terminal.getId()], ...choiceChildren]
      })
    case 'select':
      const selectChildren: [string, string][] = Object.entries(protocol.options).map(
        ([name, optProtocol]) => [name, protocolToNode(store, optProtocol).getId()]
      )
      return store.create({
        data: { session: { type: 'select', options: Object.keys(protocol.options) } },
        children: [[selectPrimitive.getId(), store.primitive.terminal.getId()], ...selectChildren]
      })
    case 'end':
      return store.create({
        data: { session: { type: 'end' } },
        children: [[endPrimitive.getId(), store.primitive.terminal.getId()]]
      })
  }
}

/**
 * Deserialize a node back to a protocol
 */
export function nodeToProtocol(store: FosStore, node: FosNode): Protocol {
  const sessionData = node.getData().session
  if (!sessionData) {
    throw new SessionError('Node does not contain session data')
  }

  switch (sessionData.type) {
    case 'send': {
      const thenEdge = node.getEdges().find(([instr]) => instr === store.primitive.sendNode.getId())
      if (!thenEdge) throw new SessionError('Invalid send protocol node')
      const thenNode = store.getNodeByAddress(thenEdge[1])
      if (!thenNode) throw new SessionError('Then node not found')
      return {
        type: 'send',
        payloadType: sessionData.payloadType,
        then: nodeToProtocol(store, thenNode)
      }
    }
    case 'recv': {
      const thenEdge = node.getEdges().find(([instr]) => instr === store.primitive.recvNode.getId())
      if (!thenEdge) throw new SessionError('Invalid recv protocol node')
      const thenNode = store.getNodeByAddress(thenEdge[1])
      if (!thenNode) throw new SessionError('Then node not found')
      return {
        type: 'recv',
        payloadType: sessionData.payloadType,
        then: nodeToProtocol(store, thenNode)
      }
    }
    case 'choice': {
      const options: Record<string, Protocol> = {}
      for (const [optName, optNodeId] of node.getEdges()) {
        if (optName === store.primitive.choiceNode.getId()) continue
        const optNode = store.getNodeByAddress(optNodeId)
        if (!optNode) throw new SessionError(`Option node not found: ${optName}`)
        options[optName] = nodeToProtocol(store, optNode)
      }
      return { type: 'choice', options }
    }
    case 'select': {
      const options: Record<string, Protocol> = {}
      for (const [optName, optNodeId] of node.getEdges()) {
        if (optName === store.primitive.selectNode.getId()) continue
        const optNode = store.getNodeByAddress(optNodeId)
        if (!optNode) throw new SessionError(`Option node not found: ${optName}`)
        options[optName] = nodeToProtocol(store, optNode)
      }
      return { type: 'select', options }
    }
    case 'end':
      return { type: 'end' }
    default:
      throw new SessionError(`Unknown session type: ${sessionData.type}`)
  }
}
