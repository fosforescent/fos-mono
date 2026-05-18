/**
 * Virtual Actor System for Fosforescent
 *
 * Actors are protocol participants that can handle communication and tasks.
 * They bridge the gap between the type system and actual execution.
 */

import { FosNode } from "./node"
import { FosStore } from "./store"
import { Protocol, TypedChannel, connect } from "./session"
import { Modality } from "./modality"

/**
 * Actor identifier
 */
export type ActorId = string

/**
 * Capability - a protocol that an actor can handle
 */
export interface Capability {
  /** Name of the capability */
  name: string
  /** The protocol this capability implements */
  protocol: Protocol
  /** Required modalities to use this capability */
  requiredModalities: Modality[]
}

/**
 * Actor interface - represents an entity that can participate in protocols
 */
export interface Actor {
  /** Unique actor identifier */
  id: ActorId
  /** Human-readable name */
  name: string
  /** Capabilities this actor provides */
  capabilities: Capability[]
  /** Endpoint URL (null for local/virtual actors) */
  endpoint: string | null
  /** Whether this actor is local (in-process) or remote */
  isLocal: boolean
  /** Modalities this actor provides */
  providedModalities: Modality[]
}

/**
 * Handler function for a protocol
 */
export type ProtocolHandler<P extends Protocol = Protocol> = (
  channel: TypedChannel<P>,
  context: ActorContext
) => Promise<void>

/**
 * Context provided to protocol handlers
 */
export interface ActorContext {
  /** The actor handling the request */
  actor: Actor
  /** The store for data access */
  store: FosStore
  /** Additional metadata */
  metadata: Record<string, unknown>
}

/**
 * Task assignment to an actor
 */
export interface TaskAssignment {
  /** Task identifier */
  taskId: string
  /** Actor assigned to the task */
  actorId: ActorId
  /** The protocol being used */
  protocol: Protocol
  /** Channel for communication */
  channelId: string
  /** Assignment timestamp */
  assignedAt: number
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

/**
 * Actor registry error
 */
export class ActorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActorError"
  }
}

/**
 * Registry for managing actors in the system
 */
export class ActorRegistry {
  /** Registered actors by ID */
  private actors: Map<ActorId, Actor> = new Map()

  /** Protocol handlers for local actors */
  private handlers: Map<string, ProtocolHandler> = new Map()

  /** Active task assignments */
  private assignments: Map<string, TaskAssignment> = new Map()

  /** Store reference */
  private store: FosStore

  constructor(store: FosStore) {
    this.store = store
  }

  /**
   * Register a new actor
   */
  registerActor(actor: Actor): void {
    if (this.actors.has(actor.id)) {
      throw new ActorError(`Actor already registered: ${actor.id}`)
    }
    this.actors.set(actor.id, actor)
  }

  /**
   * Unregister an actor
   */
  unregisterActor(actorId: ActorId): void {
    this.actors.delete(actorId)
    // Clean up any handlers
    for (const [key] of this.handlers) {
      if (key.startsWith(`${actorId}:`)) {
        this.handlers.delete(key)
      }
    }
  }

  /**
   * Get an actor by ID
   */
  getActor(actorId: ActorId): Actor | undefined {
    return this.actors.get(actorId)
  }

  /**
   * Get all registered actors
   */
  getAllActors(): Actor[] {
    return Array.from(this.actors.values())
  }

  /**
   * Find actors with a specific capability
   */
  findActorsWithCapability(capabilityName: string): Actor[] {
    return this.getAllActors().filter(actor =>
      actor.capabilities.some(cap => cap.name === capabilityName)
    )
  }

  /**
   * Find actors that provide a specific modality
   */
  findActorsWithModality(modality: Modality): Actor[] {
    return this.getAllActors().filter(actor =>
      actor.providedModalities.includes(modality)
    )
  }

  /**
   * Register a protocol handler for a local actor's capability
   */
  registerHandler(
    actorId: ActorId,
    capabilityName: string,
    handler: ProtocolHandler
  ): void {
    const actor = this.actors.get(actorId)
    if (!actor) {
      throw new ActorError(`Actor not found: ${actorId}`)
    }
    if (!actor.isLocal) {
      throw new ActorError(`Cannot register handler for remote actor: ${actorId}`)
    }

    const capability = actor.capabilities.find(c => c.name === capabilityName)
    if (!capability) {
      throw new ActorError(`Actor ${actorId} does not have capability: ${capabilityName}`)
    }

    const key = `${actorId}:${capabilityName}`
    this.handlers.set(key, handler)
  }

  /**
   * Get a handler for an actor's capability
   */
  getHandler(actorId: ActorId, capabilityName: string): ProtocolHandler | undefined {
    const key = `${actorId}:${capabilityName}`
    return this.handlers.get(key)
  }

  /**
   * Assign a task to an actor
   */
  assignTask(
    taskId: string,
    actorId: ActorId,
    capabilityName: string
  ): TaskAssignment {
    const actor = this.actors.get(actorId)
    if (!actor) {
      throw new ActorError(`Actor not found: ${actorId}`)
    }

    const capability = actor.capabilities.find(c => c.name === capabilityName)
    if (!capability) {
      throw new ActorError(`Actor ${actorId} does not have capability: ${capabilityName}`)
    }

    const assignment: TaskAssignment = {
      taskId,
      actorId,
      protocol: capability.protocol,
      channelId: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      assignedAt: Date.now(),
      status: 'pending'
    }

    this.assignments.set(taskId, assignment)
    return assignment
  }

  /**
   * Get a task assignment
   */
  getAssignment(taskId: string): TaskAssignment | undefined {
    return this.assignments.get(taskId)
  }

  /**
   * Update task assignment status
   */
  updateAssignmentStatus(taskId: string, status: TaskAssignment['status']): void {
    const assignment = this.assignments.get(taskId)
    if (assignment) {
      assignment.status = status
    }
  }

  /**
   * Execute a task with an actor
   */
  async executeTask<P extends Protocol>(
    taskId: string,
    actorId: ActorId,
    capabilityName: string
  ): Promise<TypedChannel<P>> {
    const actor = this.actors.get(actorId)
    if (!actor) {
      throw new ActorError(`Actor not found: ${actorId}`)
    }

    const capability = actor.capabilities.find(c => c.name === capabilityName)
    if (!capability) {
      throw new ActorError(`Actor ${actorId} does not have capability: ${capabilityName}`)
    }

    // Create connected channels
    const [clientChannel, serverChannel] = connect(capability.protocol)

    if (actor.isLocal) {
      // Local execution
      const handler = this.getHandler(actorId, capabilityName)
      if (!handler) {
        throw new ActorError(`No handler registered for ${actorId}:${capabilityName}`)
      }

      const context: ActorContext = {
        actor,
        store: this.store,
        metadata: { taskId }
      }

      // Start handler in background
      handler(serverChannel as TypedChannel<P>, context).catch(err => {
        console.error(`Handler error for ${actorId}:${capabilityName}:`, err)
        this.updateAssignmentStatus(taskId, 'failed')
      })

      // Update status
      this.updateAssignmentStatus(taskId, 'in_progress')
    } else {
      // Remote execution - would need to implement RPC here
      throw new ActorError(`Remote actor execution not yet implemented`)
    }

    return clientChannel as TypedChannel<P>
  }
}

/**
 * Create a virtual actor with a simple handler
 */
export function createVirtualActor(
  name: string,
  capabilities: Capability[],
  handlers: Record<string, ProtocolHandler>
): { actor: Actor; handlers: Record<string, ProtocolHandler> } {
  const actor: Actor = {
    id: `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    capabilities,
    endpoint: null,
    isLocal: true,
    providedModalities: []
  }

  return { actor, handlers }
}

/**
 * Create a peer actor (represents a remote peer)
 */
export function createPeerActor(
  peerId: string,
  name: string,
  endpoint: string,
  capabilities: Capability[]
): Actor {
  return {
    id: `peer_${peerId}`,
    name,
    capabilities,
    endpoint,
    isLocal: false,
    providedModalities: ['peer']
  }
}

/**
 * Create a backend actor (represents the server)
 */
export function createBackendActor(
  endpoint: string,
  capabilities: Capability[]
): Actor {
  return {
    id: 'backend',
    name: 'Backend Server',
    capabilities,
    endpoint,
    isLocal: false,
    providedModalities: ['online']
  }
}

// === Common Capabilities ===

/**
 * Persist capability - store and retrieve data
 */
export const PersistCapability: Capability = {
  name: 'persist',
  protocol: {
    type: 'choice',
    options: {
      get: {
        type: 'recv',
        payloadType: 'string', // CID
        then: {
          type: 'send',
          payloadType: 'node', // FosNodeContent
          then: { type: 'end' }
        }
      },
      put: {
        type: 'recv',
        payloadType: 'node', // FosNodeContent
        then: {
          type: 'send',
          payloadType: 'string', // CID
          then: { type: 'end' }
        }
      },
      done: { type: 'end' }
    }
  },
  requiredModalities: ['online']
}

/**
 * AI Inference capability - get AI completions
 */
export const AiInferCapability: Capability = {
  name: 'ai_infer',
  protocol: {
    type: 'recv',
    payloadType: 'prompt',
    then: {
      type: 'send',
      payloadType: 'response',
      then: { type: 'end' }
    }
  },
  requiredModalities: ['online']
}

/**
 * Sync capability - synchronize data between stores
 */
export const SyncCapability: Capability = {
  name: 'sync',
  protocol: {
    type: 'choice',
    options: {
      push: {
        type: 'recv',
        payloadType: 'nodes', // Array of nodes to push
        then: {
          type: 'send',
          payloadType: 'ack',
          then: { type: 'end' }
        }
      },
      pull: {
        type: 'recv',
        payloadType: 'since', // Last sync timestamp
        then: {
          type: 'send',
          payloadType: 'nodes', // New nodes since timestamp
          then: { type: 'end' }
        }
      },
      done: { type: 'end' }
    }
  },
  requiredModalities: ['online']
}

/**
 * Serialize an actor to a node
 */
export function actorToNode(store: FosStore, actor: Actor): FosNode {
  return store.create({
    data: {
      actor: {
        id: actor.id,
        name: actor.name,
        endpoint: actor.endpoint,
        isLocal: actor.isLocal,
        capabilities: actor.capabilities.map(c => c.name),
        providedModalities: actor.providedModalities
      }
    },
    children: []
  })
}

/**
 * Deserialize an actor from a node
 * Note: This creates a minimal actor - capabilities need to be added separately
 */
export function nodeToActor(node: FosNode): Actor | null {
  const actorData = node.getData().actor
  if (!actorData) return null

  return {
    id: actorData.id,
    name: actorData.name,
    capabilities: [], // Would need to be populated from capability registry
    endpoint: actorData.endpoint,
    isLocal: actorData.isLocal,
    providedModalities: actorData.providedModalities || []
  }
}
