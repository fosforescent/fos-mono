/**
 * Modal Type System for Fosforescent
 *
 * Implements modal types (□ and ◇) for storage routing.
 * Modal types determine where data is stored (local, home, online, peer).
 */

import { FosNode } from "./node"
import { FosStore } from "./store"

/**
 * Modality identifiers for storage routing
 */
export type Modality = 'local' | 'home' | 'online' | 'peer'

/**
 * Storage source configuration
 */
export interface FosSource {
  /** Priority for resolution (lower = higher priority) */
  priority: number
  /** Type of storage */
  type: Modality
  /** Optional store instance for this source */
  store?: FosStore
  /** Whether this source is read-only */
  readonly: boolean
  /** Connection info for remote sources */
  connectionInfo?: {
    address?: string
    peerId?: string
  }
}

/**
 * Error thrown when modal type constraints are violated
 */
export class ModalityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModalityError"
  }
}

/**
 * A boxed value that requires a specific modality to access
 * □_m A represents "A is available in modality m"
 */
export interface BoxedValue<T = unknown> {
  value: T
  modality: Modality
  nodeId: string
}

/**
 * A hole representing a value that cannot be accessed because the modality is unavailable
 */
export interface ModalHole {
  type: 'modal_hole'
  requiredModality: Modality
  requestedNodeId: string
}

/**
 * Manager for modal types and storage routing
 */
export class ModalityManager {
  /** Currently available modalities */
  private availableModalities: Set<Modality> = new Set(['local'])

  /** Storage sources ordered by priority */
  private sources: FosSource[] = []

  /** Store reference */
  private store: FosStore

  constructor(store: FosStore) {
    this.store = store
    // Initialize with local modality always available
    this.addSource({
      priority: 0,
      type: 'local',
      readonly: false
    })
  }

  /**
   * Add a storage source
   */
  addSource(source: FosSource): void {
    this.sources.push(source)
    this.sources.sort((a, b) => a.priority - b.priority)
    this.availableModalities.add(source.type)
  }

  /**
   * Remove a storage source
   */
  removeSource(type: Modality): void {
    this.sources = this.sources.filter(s => s.type !== type)
    // Check if modality is still available from another source
    const stillAvailable = this.sources.some(s => s.type === type)
    if (!stillAvailable) {
      this.availableModalities.delete(type)
    }
  }

  /**
   * Check if a modality is currently available
   */
  hasModality(modality: Modality): boolean {
    return this.availableModalities.has(modality)
  }

  /**
   * Get all available modalities
   */
  getAvailableModalities(): Modality[] {
    return Array.from(this.availableModalities)
  }

  /**
   * Box a value with a modality
   * Creates a node marked with the BOX primitive and modality
   *
   * @param value The value to box (as a node)
   * @param modality The modality to associate with the boxed value
   * @returns The boxed node
   */
  box(value: FosNode, modality: Modality): FosNode {
    const boxPrimitive = this.store.primitive.boxNode
    const modalityPrimitive = this.getModalityPrimitive(modality)

    const boxedNode = this.store.create({
      data: {
        modal: {
          type: 'box',
          modality,
          valueNodeId: value.getId()
        }
      },
      children: [
        [boxPrimitive.getId(), value.getId()],
        [modalityPrimitive.getId(), this.store.primitive.terminal.getId()]
      ]
    })

    return boxedNode
  }

  /**
   * Attempt to unbox a value
   * Returns the value if the modality is available, otherwise returns a hole
   *
   * @param boxed The boxed node
   * @returns The unboxed value or a modal hole
   */
  unbox(boxed: FosNode): FosNode | ModalHole {
    const modalData = boxed.getData().modal
    if (!modalData || modalData.type !== 'box') {
      throw new ModalityError('Node is not a boxed value')
    }

    const requiredModality = modalData.modality as Modality
    if (!this.hasModality(requiredModality)) {
      return {
        type: 'modal_hole',
        requiredModality,
        requestedNodeId: boxed.getId()
      }
    }

    // Modality available, return the value
    const valueNodeId = modalData.valueNodeId
    const valueNode = this.store.getNodeByAddress(valueNodeId)
    if (!valueNode) {
      throw new ModalityError(`Value node not found: ${valueNodeId}`)
    }

    return valueNode
  }

  /**
   * Create a diamond (possibility) type
   * ◇_m A represents "A is possible in modality m" (can be made available)
   */
  diamond(value: FosNode, modality: Modality): FosNode {
    const diamondPrimitive = this.store.primitive.diamondNode
    const modalityPrimitive = this.getModalityPrimitive(modality)

    const diamondNode = this.store.create({
      data: {
        modal: {
          type: 'diamond',
          modality,
          valueNodeId: value.getId()
        }
      },
      children: [
        [diamondPrimitive.getId(), value.getId()],
        [modalityPrimitive.getId(), this.store.primitive.terminal.getId()]
      ]
    })

    return diamondNode
  }

  /**
   * Route storage based on modality
   * Returns the appropriate source for the given modality
   */
  routeStorage(modality: Modality): FosSource | null {
    // Find first available source with matching modality
    return this.sources.find(s => s.type === modality) || null
  }

  /**
   * Resolve a node from the best available source
   * Tries sources in priority order
   */
  async resolveNode(cid: string): Promise<FosNode | null> {
    for (const source of this.sources) {
      if (source.store) {
        const node = source.store.getNodeByAddress(cid)
        if (node) {
          return node
        }
      }
    }

    // Try local store
    const localNode = this.store.getNodeByAddress(cid)
    if (localNode) {
      return localNode
    }

    return null
  }

  /**
   * Sync a node to a specific storage source
   */
  async syncToSource(node: FosNode, source: FosSource): Promise<void> {
    if (source.readonly) {
      throw new ModalityError(`Cannot sync to read-only source: ${source.type}`)
    }

    if (source.store) {
      // Create node in target store
      source.store.create(node.getContent())
    }
  }

  /**
   * Get the primitive node for a modality
   */
  private getModalityPrimitive(modality: Modality): FosNode {
    switch (modality) {
      case 'local':
        return this.store.primitive.localModNode
      case 'home':
        return this.store.primitive.homeModNode
      case 'online':
        return this.store.primitive.onlineModNode
      case 'peer':
        return this.store.primitive.peerModNode
      default:
        throw new ModalityError(`Unknown modality: ${modality}`)
    }
  }

  /**
   * Check if a node is boxed
   */
  isBoxed(node: FosNode): boolean {
    const modalData = node.getData().modal
    return modalData?.type === 'box'
  }

  /**
   * Check if a node is a diamond
   */
  isDiamond(node: FosNode): boolean {
    const modalData = node.getData().modal
    return modalData?.type === 'diamond'
  }

  /**
   * Get the modality of a boxed or diamond node
   */
  getModality(node: FosNode): Modality | null {
    const modalData = node.getData().modal
    return modalData?.modality as Modality | null
  }
}

/**
 * Multi-source resolver for combining data from multiple storage sources
 */
export class FosSourceResolver {
  private sources: FosSource[]
  private primaryStore: FosStore

  constructor(primaryStore: FosStore) {
    this.primaryStore = primaryStore
    this.sources = [{
      priority: 0,
      type: 'local',
      store: primaryStore,
      readonly: false
    }]
  }

  /**
   * Add a source to the resolver
   */
  addSource(source: FosSource): void {
    this.sources.push(source)
    this.sources.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Remove a source from the resolver
   */
  removeSource(type: Modality): void {
    this.sources = this.sources.filter(s => s.type !== type)
  }

  /**
   * Resolve a node from any available source
   */
  async resolveNode(cid: string): Promise<FosNode | null> {
    for (const source of this.sources) {
      if (source.store) {
        const node = source.store.getNodeByAddress(cid)
        if (node) {
          return node
        }
      }
    }
    return null
  }

  /**
   * Merge all sources into the primary store
   * Handles conflicts by keeping the most recent version
   */
  async mergeAll(): Promise<FosStore> {
    // For each non-primary source
    for (const source of this.sources) {
      if (source.store && source.store !== this.primaryStore) {
        // Get all nodes from source
        // This is a simplified version - a real implementation would
        // need to handle large stores efficiently
        const sourceTable = source.store.getTable()
        for (const [cid, content] of sourceTable) {
          if (!this.primaryStore.getNodeByAddress(cid)) {
            this.primaryStore.create(content)
          }
        }
      }
    }
    return this.primaryStore
  }

  /**
   * Sync changes from primary store to a specific source
   */
  async syncToSource(source: FosSource): Promise<void> {
    if (source.readonly) {
      throw new ModalityError(`Cannot sync to read-only source: ${source.type}`)
    }

    if (!source.store) {
      throw new ModalityError(`Source ${source.type} has no store`)
    }

    const primaryTable = this.primaryStore.getTable()
    for (const [cid, content] of primaryTable) {
      if (!source.store.getNodeByAddress(cid)) {
        source.store.create(content)
      }
    }
  }

  /**
   * Get all sources
   */
  getSources(): FosSource[] {
    return [...this.sources]
  }
}
