/**
 * Temporal Events for Fosforescent
 *
 * Handles recurring events, deposits, and anticipated balance calculations
 * for budgets and calendars.
 */

import { FosNode } from "./node"
import { FosStore } from "./store"

/**
 * Interval types for recurring events
 */
export type RecurrenceInterval = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

/**
 * Day of week for weekly recurrence
 */
export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

/**
 * Recurring deposit/income configuration
 */
export interface RecurringDeposit {
  /** Unique identifier */
  id: string
  /** Amount to deposit */
  amount: number
  /** Currency code */
  currency: string
  /** Recurrence interval */
  interval: RecurrenceInterval
  /** Start date (ISO 8601) */
  startDate: string
  /** End date (ISO 8601), optional */
  endDate?: string
  /** Description */
  description?: string
  /** For weekly: which day */
  dayOfWeek?: DayOfWeek
  /** For monthly: which day of month (1-31, or -1 for last day) */
  dayOfMonth?: number
  /** Whether this deposit is currently active */
  active: boolean
}

/**
 * Recurring expense configuration
 */
export interface RecurringExpense {
  /** Unique identifier */
  id: string
  /** Amount to spend */
  amount: number
  /** Currency code */
  currency: string
  /** Recurrence interval */
  interval: RecurrenceInterval
  /** Start date (ISO 8601) */
  startDate: string
  /** End date (ISO 8601), optional */
  endDate?: string
  /** Description */
  description?: string
  /** Budget ID this expense draws from */
  budgetId?: string
  /** For weekly: which day */
  dayOfWeek?: DayOfWeek
  /** For monthly: which day of month */
  dayOfMonth?: number
  /** Whether this expense is currently active */
  active: boolean
}

/**
 * Recurring calendar event configuration
 */
export interface RecurringCalendarEvent {
  /** Unique identifier */
  id: string
  /** Event name */
  name: string
  /** Duration in minutes */
  durationMinutes: number
  /** Recurrence interval */
  interval: RecurrenceInterval
  /** Start date of recurrence pattern (ISO 8601) */
  startDate: string
  /** End date of recurrence pattern (ISO 8601), optional */
  endDate?: string
  /** Time of day (HH:MM format) */
  timeOfDay: string
  /** For weekly: which days */
  daysOfWeek?: DayOfWeek[]
  /** Calendar ID this event belongs to */
  calendarId?: string
  /** Whether this event is currently active */
  active: boolean
}

/**
 * A scheduled occurrence of a recurring event
 */
export interface ScheduledOccurrence {
  /** The recurring event ID */
  recurringId: string
  /** Scheduled date (ISO 8601) */
  date: string
  /** Amount (for deposits/expenses) */
  amount?: number
  /** Duration (for calendar events) */
  durationMinutes?: number
  /** Whether this occurrence has been processed */
  processed: boolean
}

/**
 * Convert day of week string to number (0=Sunday)
 */
function dayOfWeekToNumber(day: DayOfWeek): number {
  const days: Record<DayOfWeek, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }
  return days[day]
}

/**
 * Get the next occurrence date after a given date
 */
export function getNextOccurrence(
  current: Date,
  interval: RecurrenceInterval,
  dayOfWeek?: DayOfWeek,
  dayOfMonth?: number
): Date {
  const next = new Date(current)

  switch (interval) {
    case 'hourly':
      next.setHours(next.getHours() + 1)
      break
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      if (dayOfWeek !== undefined) {
        const targetDay = dayOfWeekToNumber(dayOfWeek)
        const currentDay = next.getDay()
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7
        next.setDate(next.getDate() + daysUntil)
      } else {
        next.setDate(next.getDate() + 7)
      }
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (dayOfMonth !== undefined) {
        if (dayOfMonth === -1) {
          // Last day of month
          next.setMonth(next.getMonth() + 1)
          next.setDate(0)
        } else {
          next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
        }
      }
      break
    case 'quarterly':
      next.setMonth(next.getMonth() + 3)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
  }

  return next
}

/**
 * Generate all occurrences between two dates
 */
export function getOccurrencesBetween(
  deposit: RecurringDeposit | RecurringExpense,
  startDate: Date,
  endDate: Date
): ScheduledOccurrence[] {
  const occurrences: ScheduledOccurrence[] = []

  const depositStart = new Date(deposit.startDate)
  const depositEnd = deposit.endDate ? new Date(deposit.endDate) : null

  // Start from the later of deposit start or query start
  let current = depositStart > startDate ? new Date(depositStart) : new Date(startDate)

  // Find first occurrence on or after current
  while (current <= endDate) {
    // Check if within deposit's valid range
    if (depositEnd && current > depositEnd) break
    if (!deposit.active) break

    occurrences.push({
      recurringId: deposit.id,
      date: current.toISOString(),
      amount: deposit.amount,
      processed: false
    })

    current = getNextOccurrence(current, deposit.interval, deposit.dayOfWeek, deposit.dayOfMonth)
  }

  return occurrences
}

/**
 * Calculate anticipated balance at a future date
 */
export function anticipatedBalance(
  currentBalance: number,
  deposits: RecurringDeposit[],
  expenses: RecurringExpense[],
  atDate: Date
): number {
  const now = new Date()
  let balance = currentBalance

  // Sum all deposits between now and target date
  for (const deposit of deposits) {
    const occurrences = getOccurrencesBetween(deposit, now, atDate)
    for (const occ of occurrences) {
      balance += occ.amount || 0
    }
  }

  // Subtract all expenses between now and target date
  for (const expense of expenses) {
    const occurrences = getOccurrencesBetween(expense, now, atDate)
    for (const occ of occurrences) {
      balance -= occ.amount || 0
    }
  }

  return balance
}

/**
 * Find the date when balance reaches a target
 */
export function dateWhenBalanceReaches(
  currentBalance: number,
  targetBalance: number,
  deposits: RecurringDeposit[],
  expenses: RecurringExpense[],
  maxDaysToSearch: number = 365
): Date | null {
  const now = new Date()
  let searchDate = new Date(now)
  const endSearch = new Date(now)
  endSearch.setDate(endSearch.getDate() + maxDaysToSearch)

  while (searchDate <= endSearch) {
    const balance = anticipatedBalance(currentBalance, deposits, expenses, searchDate)
    if (balance >= targetBalance) {
      return searchDate
    }
    searchDate.setDate(searchDate.getDate() + 1)
  }

  return null
}

/**
 * Temporal event manager
 */
export class TemporalManager {
  private store: FosStore
  private deposits: Map<string, RecurringDeposit> = new Map()
  private expenses: Map<string, RecurringExpense> = new Map()
  private calendarEvents: Map<string, RecurringCalendarEvent> = new Map()

  constructor(store: FosStore) {
    this.store = store
  }

  /**
   * Add a recurring deposit
   */
  addDeposit(deposit: RecurringDeposit): void {
    this.deposits.set(deposit.id, deposit)
  }

  /**
   * Remove a recurring deposit
   */
  removeDeposit(depositId: string): void {
    this.deposits.delete(depositId)
  }

  /**
   * Get all deposits
   */
  getDeposits(): RecurringDeposit[] {
    return Array.from(this.deposits.values())
  }

  /**
   * Add a recurring expense
   */
  addExpense(expense: RecurringExpense): void {
    this.expenses.set(expense.id, expense)
  }

  /**
   * Remove a recurring expense
   */
  removeExpense(expenseId: string): void {
    this.expenses.delete(expenseId)
  }

  /**
   * Get all expenses
   */
  getExpenses(): RecurringExpense[] {
    return Array.from(this.expenses.values())
  }

  /**
   * Add a recurring calendar event
   */
  addCalendarEvent(event: RecurringCalendarEvent): void {
    this.calendarEvents.set(event.id, event)
  }

  /**
   * Remove a recurring calendar event
   */
  removeCalendarEvent(eventId: string): void {
    this.calendarEvents.delete(eventId)
  }

  /**
   * Get all calendar events
   */
  getCalendarEvents(): RecurringCalendarEvent[] {
    return Array.from(this.calendarEvents.values())
  }

  /**
   * Get anticipated balance for a budget at a future date
   */
  getAnticipatedBalance(currentBalance: number, atDate: Date): number {
    return anticipatedBalance(
      currentBalance,
      this.getDeposits(),
      this.getExpenses(),
      atDate
    )
  }

  /**
   * Get all scheduled occurrences in a date range
   */
  getScheduledOccurrences(startDate: Date, endDate: Date): {
    deposits: ScheduledOccurrence[]
    expenses: ScheduledOccurrence[]
    events: ScheduledOccurrence[]
  } {
    return {
      deposits: this.getDeposits().flatMap(d => getOccurrencesBetween(d, startDate, endDate)),
      expenses: this.getExpenses().flatMap(e => getOccurrencesBetween(e, startDate, endDate)),
      events: this.getCalendarEvents().flatMap(e => {
        const occurrences: ScheduledOccurrence[] = []
        const eventStart = new Date(e.startDate)
        const eventEnd = e.endDate ? new Date(e.endDate) : null
        let current = eventStart > startDate ? new Date(eventStart) : new Date(startDate)

        while (current <= endDate) {
          if (eventEnd && current > eventEnd) break
          if (!e.active) break

          // Check if this day matches the event's day pattern
          if (e.interval === 'weekly' && e.daysOfWeek) {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][current.getDay()] as DayOfWeek
            if (!e.daysOfWeek.includes(dayName)) {
              current.setDate(current.getDate() + 1)
              continue
            }
          }

          occurrences.push({
            recurringId: e.id,
            date: current.toISOString(),
            durationMinutes: e.durationMinutes,
            processed: false
          })

          if (e.interval === 'weekly' && e.daysOfWeek && e.daysOfWeek.length > 1) {
            current.setDate(current.getDate() + 1)
          } else {
            current = getNextOccurrence(current, e.interval)
          }
        }

        return occurrences
      })
    }
  }

  /**
   * Create a node representing a recurring deposit
   */
  depositToNode(deposit: RecurringDeposit): FosNode {
    return this.store.create({
      data: {
        recurringDeposit: deposit
      },
      children: []
    })
  }

  /**
   * Create a node representing a recurring expense
   */
  expenseToNode(expense: RecurringExpense): FosNode {
    return this.store.create({
      data: {
        recurringExpense: expense
      },
      children: []
    })
  }

  /**
   * Create a node representing a recurring calendar event
   */
  calendarEventToNode(event: RecurringCalendarEvent): FosNode {
    return this.store.create({
      data: {
        recurringCalendarEvent: event
      },
      children: []
    })
  }
}
