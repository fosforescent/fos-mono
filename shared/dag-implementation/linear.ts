/**
 * Linear Type System for Fosforescent
 *
 * Implements Par-style linear types where values must be consumed exactly once.
 * Used for resources like budgets and calendars.
 */

import { FosNode } from "./node"
import { FosStore } from "./store"

/**
 * Error thrown when linear type constraints are violated
 */
export class LinearityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LinearityError"
  }
}

/**
 * Tracks linear values during evaluation to ensure each is consumed exactly once
 */
export class LinearContext {
  /** CID -> unconsumed linear value */
  private available: Map<string, FosNode> = new Map()

  /** CIDs that have been consumed */
  private consumed: Set<string> = new Set()

  /** Store reference for creating nodes */
  private store: FosStore

  constructor(store: FosStore) {
    this.store = store
  }

  /**
   * Register a new linear value
   */
  introduce(node: FosNode): void {
    const cid = node.getId()
    if (this.available.has(cid)) {
      throw new LinearityError(`Linear value ${cid} already introduced`)
    }
    this.available.set(cid, node)
  }

  /**
   * Consume a linear value (marks it as used)
   * @throws LinearityError if value already consumed or not available
   */
  use(cid: string): FosNode {
    if (this.consumed.has(cid)) {
      throw new LinearityError(`Linear value ${cid} already consumed`)
    }
    const node = this.available.get(cid)
    if (!node) {
      throw new LinearityError(`Linear value ${cid} not available`)
    }
    this.available.delete(cid)
    this.consumed.add(cid)
    return node
  }

  /**
   * Check if a linear value is available
   */
  isAvailable(cid: string): boolean {
    return this.available.has(cid)
  }

  /**
   * Check if a linear value has been consumed
   */
  isConsumed(cid: string): boolean {
    return this.consumed.has(cid)
  }

  /**
   * Split a linear value into multiple parts
   * The original value is consumed and new values are introduced
   */
  split(cid: string, parts: number): string[] {
    const node = this.use(cid)
    const nodeData = node.getData()

    // For budgets, split the amount
    if (nodeData.budget) {
      const totalAmount = nodeData.budget.total
      const amountPerPart = totalAmount / parts
      const newCids: string[] = []

      for (let i = 0; i < parts; i++) {
        const partNode = this.store.create({
          data: {
            budget: {
              total: amountPerPart,
              consumed: 0,
              currency: nodeData.budget.currency,
              parentBudgetId: cid
            }
          },
          children: [[this.store.primitive.allocationNode.getId(), node.getId()]]
        })
        this.introduce(partNode)
        newCids.push(partNode.getId())
      }

      return newCids
    }

    // For calendars, split into time slots
    if (nodeData.calendar) {
      throw new LinearityError("Calendar splitting not yet implemented")
    }

    throw new LinearityError(`Cannot split non-resource linear value ${cid}`)
  }

  /**
   * Verify all linear values have been consumed
   * @returns true if all consumed, throws if any remain
   */
  checkAllConsumed(): boolean {
    if (this.available.size > 0) {
      const remaining = Array.from(this.available.keys()).join(", ")
      throw new LinearityError(`Linear values not consumed: ${remaining}`)
    }
    return true
  }

  /**
   * Get count of available linear values
   */
  availableCount(): number {
    return this.available.size
  }

  /**
   * Get count of consumed linear values
   */
  consumedCount(): number {
    return this.consumed.size
  }
}

/**
 * Budget interface for linear monetary resources
 */
export interface Budget {
  /** Unique identifier */
  id: string
  /** Total amount available */
  total: number
  /** Amount already consumed */
  consumed: number
  /** Currency code (e.g., "USD", "EUR") */
  currency: string
  /** Child budget allocations */
  children: Budget[]
  /** Parent budget (undefined for root budgets) */
  parent?: Budget
  /** Budget name/label */
  name?: string
}

/**
 * Calendar interface for linear time resources
 */
export interface Calendar {
  /** Unique identifier */
  id: string
  /** Name of the calendar */
  name: string
  /** Time slots available */
  slots: TimeSlot[]
  /** Child calendar allocations */
  children: Calendar[]
  /** Parent calendar */
  parent?: Calendar
}

/**
 * Time slot in a calendar
 */
export interface TimeSlot {
  /** Slot identifier */
  id: string
  /** Start time (ISO 8601) */
  start: string
  /** End time (ISO 8601) */
  end: string
  /** Whether slot is allocated */
  allocated: boolean
  /** What the slot is allocated to */
  allocatedTo?: string
}

/**
 * Budget Manager - handles budget allocation and spending
 */
export class BudgetManager {
  private store: FosStore
  private linearContext: LinearContext

  constructor(store: FosStore, linearContext?: LinearContext) {
    this.store = store
    this.linearContext = linearContext || new LinearContext(store)
  }

  /**
   * Create a new root budget
   */
  createBudget(total: number, currency: string = "USD", name?: string): FosNode {
    const budgetNode = this.store.create({
      data: {
        budget: {
          total,
          consumed: 0,
          currency,
          name
        },
        description: { content: name || `Budget: ${total} ${currency}` }
      },
      children: [[this.store.primitive.budgetNode.getId(), this.store.primitive.terminal.getId()]]
    })

    this.linearContext.introduce(budgetNode)
    return budgetNode
  }

  /**
   * Create a sub-allocation from a parent budget
   * This consumes from the parent budget
   */
  allocate(parentCid: string, amount: number, name?: string): FosNode {
    const parentNode = this.linearContext.use(parentCid)
    const parentData = parentNode.getData().budget

    if (!parentData) {
      throw new LinearityError("Parent is not a budget")
    }

    const available = parentData.total - parentData.consumed
    if (amount > available) {
      throw new LinearityError(
        `Cannot allocate ${amount} from budget with ${available} available`
      )
    }

    // Create sub-allocation
    const allocationNode = this.store.create({
      data: {
        budget: {
          total: amount,
          consumed: 0,
          currency: parentData.currency,
          name,
          parentBudgetId: parentCid
        },
        description: { content: name || `Allocation: ${amount} ${parentData.currency}` }
      },
      children: [[this.store.primitive.allocationNode.getId(), parentNode.getId()]]
    })

    // Update parent with consumed amount
    const updatedParentNode = this.store.create({
      data: {
        budget: {
          ...parentData,
          consumed: parentData.consumed + amount
        }
      },
      children: parentNode.getEdges()
    })

    // Re-introduce parent with remaining balance
    this.linearContext.introduce(updatedParentNode)
    // Introduce new allocation
    this.linearContext.introduce(allocationNode)

    return allocationNode
  }

  /**
   * Spend from a budget (partial consumption)
   */
  spend(budgetCid: string, amount: number, description?: string): FosNode {
    const budgetNode = this.linearContext.use(budgetCid)
    const budgetData = budgetNode.getData().budget

    if (!budgetData) {
      throw new LinearityError("Node is not a budget")
    }

    const available = budgetData.total - budgetData.consumed
    if (amount > available) {
      throw new LinearityError(
        `Cannot spend ${amount} from budget with ${available} available`
      )
    }

    // Create updated budget with consumed amount
    const updatedBudget = this.store.create({
      data: {
        budget: {
          ...budgetData,
          consumed: budgetData.consumed + amount
        }
      },
      children: [
        ...budgetNode.getEdges(),
        [this.store.primitive.spentNode.getId(),
          this.store.create({
            data: {
              spent: { amount, description, timestamp: Date.now() }
            },
            children: []
          }).getId()
        ]
      ]
    })

    // Re-introduce if there's remaining balance
    if (updatedBudget.getData().budget!.consumed < updatedBudget.getData().budget!.total) {
      this.linearContext.introduce(updatedBudget)
    }

    return updatedBudget
  }

  /**
   * Finalize a budget - return unspent amount to parent or ensure all spent
   */
  finalize(budgetCid: string): void {
    const budgetNode = this.linearContext.use(budgetCid)
    const budgetData = budgetNode.getData().budget

    if (!budgetData) {
      throw new LinearityError("Node is not a budget")
    }

    const remaining = budgetData.total - budgetData.consumed
    if (remaining > 0 && budgetData.parentBudgetId) {
      // Return remaining to parent
      console.log(`Returning ${remaining} ${budgetData.currency} to parent budget`)
    }
    // Budget is now fully consumed/finalized
  }

  /**
   * Get available balance
   */
  getAvailable(budgetCid: string): number {
    // Peek without consuming
    if (!this.linearContext.isAvailable(budgetCid)) {
      return 0
    }
    const node = this.store.getNodeByAddress(budgetCid)
    if (!node) return 0
    const budgetData = node.getData().budget
    if (!budgetData) return 0
    return budgetData.total - budgetData.consumed
  }
}

/**
 * Calendar Manager - handles time slot allocation
 */
export class CalendarManager {
  private store: FosStore
  private linearContext: LinearContext

  constructor(store: FosStore, linearContext?: LinearContext) {
    this.store = store
    this.linearContext = linearContext || new LinearContext(store)
  }

  /**
   * Create a new calendar
   */
  createCalendar(name: string, slots: TimeSlot[] = []): FosNode {
    const calendarNode = this.store.create({
      data: {
        calendar: {
          name,
          slots
        },
        description: { content: name }
      },
      children: [[this.store.primitive.calendarNode.getId(), this.store.primitive.terminal.getId()]]
    })

    this.linearContext.introduce(calendarNode)
    return calendarNode
  }

  /**
   * Add a time slot to a calendar
   */
  addSlot(calendarCid: string, start: string, end: string): FosNode {
    const calendarNode = this.linearContext.use(calendarCid)
    const calendarData = calendarNode.getData().calendar

    if (!calendarData) {
      throw new LinearityError("Node is not a calendar")
    }

    const slotId = `slot_${Date.now()}`
    const newSlot: TimeSlot = {
      id: slotId,
      start,
      end,
      allocated: false
    }

    const updatedCalendar = this.store.create({
      data: {
        calendar: {
          ...calendarData,
          slots: [...(calendarData.slots || []), newSlot]
        }
      },
      children: calendarNode.getEdges()
    })

    this.linearContext.introduce(updatedCalendar)
    return updatedCalendar
  }

  /**
   * Allocate a time slot
   */
  allocateSlot(calendarCid: string, slotId: string, allocatedTo: string): FosNode {
    const calendarNode = this.linearContext.use(calendarCid)
    const calendarData = calendarNode.getData().calendar

    if (!calendarData) {
      throw new LinearityError("Node is not a calendar")
    }

    const slots = calendarData.slots || []
    const slotIndex = slots.findIndex(s => s.id === slotId)

    if (slotIndex === -1) {
      throw new LinearityError(`Time slot ${slotId} not found`)
    }

    if (slots[slotIndex].allocated) {
      throw new LinearityError(`Time slot ${slotId} already allocated`)
    }

    const updatedSlots = [...slots]
    updatedSlots[slotIndex] = {
      ...slots[slotIndex],
      allocated: true,
      allocatedTo
    }

    const updatedCalendar = this.store.create({
      data: {
        calendar: {
          ...calendarData,
          slots: updatedSlots
        }
      },
      children: calendarNode.getEdges()
    })

    this.linearContext.introduce(updatedCalendar)
    return updatedCalendar
  }

  /**
   * Get available (unallocated) time slots
   */
  getAvailableSlots(calendarCid: string): TimeSlot[] {
    const node = this.store.getNodeByAddress(calendarCid)
    if (!node) return []
    const calendarData = node.getData().calendar
    if (!calendarData) return []
    return (calendarData.slots || []).filter(s => !s.allocated)
  }
}
