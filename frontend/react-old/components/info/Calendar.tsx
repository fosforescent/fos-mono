/**
 * Calendar - Component for viewing and managing linear time slot allocations
 *
 * Features:
 * - Visual calendar/timeline view
 * - Time slot allocation
 * - Sub-calendar creation
 * - Availability tracking
 * - Conflict detection
 */

import React, { useState, useMemo, useCallback } from 'react'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { AppStateLoaded } from '@fosforescent/shared/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  CalendarDays,
  Plus,
  Clock,
  Check,
  X,
  AlertTriangle,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO, isWithinInterval, isBefore, isAfter, addHours } from 'date-fns'

interface TimeSlot {
  id: string
  start: string  // ISO date string
  end: string    // ISO date string
  allocated: boolean
  allocatedTo?: string  // Task/expression ID
  allocatedToName?: string
}

interface CalendarData {
  id: string
  name: string
  slots: TimeSlot[]
  children: CalendarData[]
  parentId?: string
}

interface CalendarProps {
  expression: FosExpression
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
  className?: string
}

/**
 * Extract calendar data from expression children
 */
function extractCalendarsFromExpression(expression: FosExpression): CalendarData[] {
  const calendars: CalendarData[] = []

  const children = expression.getTargetChildren()

  for (const child of children) {
    const nodeData = child.targetNode.getContent().data
    if (nodeData.calendar) {
      const calendar: CalendarData = {
        id: child.targetNode.getId(),
        name: nodeData.calendar.name || nodeData.description?.content || 'Unnamed Calendar',
        slots: nodeData.calendar.slots?.map(s => ({
          id: s.id,
          start: s.start,
          end: s.end,
          allocated: s.allocated,
          allocatedTo: s.allocatedTo,
          allocatedToName: s.allocatedTo ? 'Task' : undefined // TODO: resolve actual name
        })) || [],
        children: [],
        parentId: nodeData.calendar.parentCalendarId
      }

      calendar.children = extractCalendarsFromExpression(child)
      calendars.push(calendar)
    }
  }

  return calendars
}

/**
 * Format time range
 */
function formatTimeRange(start: string, end: string): string {
  const startDate = parseISO(start)
  const endDate = parseISO(end)

  const sameDay = format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')

  if (sameDay) {
    return `${format(startDate, 'MMM d, yyyy')} ${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`
  }

  return `${format(startDate, 'MMM d, h:mm a')} - ${format(endDate, 'MMM d, h:mm a')}`
}

/**
 * Calculate slot duration in hours
 */
function getSlotDurationHours(slot: TimeSlot): number {
  const start = parseISO(slot.start)
  const end = parseISO(slot.end)
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

/**
 * TimeSlotItem - Individual time slot display
 */
const TimeSlotItem: React.FC<{
  slot: TimeSlot
  onAllocate: (slotId: string, taskName: string) => void
  onDeallocate: (slotId: string) => void
}> = ({ slot, onAllocate, onDeallocate }) => {
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [taskName, setTaskName] = useState('')

  const isPast = isBefore(parseISO(slot.end), new Date())
  const duration = getSlotDurationHours(slot)

  const handleAllocate = () => {
    if (taskName.trim()) {
      onAllocate(slot.id, taskName.trim())
      setTaskName('')
      setAllocateOpen(false)
    }
  }

  return (
    <div className={cn(
      "p-3 border rounded-lg flex items-center gap-3 transition-colors",
      slot.allocated ? "bg-blue-50 border-blue-200" : "hover:bg-muted/50",
      isPast && "opacity-60"
    )}>
      <Clock className={cn(
        "h-4 w-4",
        slot.allocated ? "text-blue-500" : "text-muted-foreground"
      )} />

      <div className="flex-1">
        <div className="font-medium text-sm">
          {formatTimeRange(slot.start, slot.end)}
        </div>
        <div className="text-xs text-muted-foreground">
          {duration.toFixed(1)} hours
        </div>
      </div>

      {slot.allocated ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <User className="h-3 w-3" />
            {slot.allocatedToName || 'Allocated'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDeallocate(slot.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPast}>
              <Plus className="h-3 w-3 mr-1" />
              Allocate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate Time Slot</DialogTitle>
              <DialogDescription>
                Assign this time slot to a task or activity
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <strong>Time:</strong> {formatTimeRange(slot.start, slot.end)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-name">Task or Activity</Label>
                <Input
                  id="task-name"
                  placeholder="What will you do during this time?"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
              <Button onClick={handleAllocate} disabled={!taskName.trim()}>
                Allocate Slot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/**
 * CalendarNode - Individual calendar in the tree
 */
const CalendarNode: React.FC<{
  calendar: CalendarData
  depth: number
  onAddSlot: (calendarId: string, start: Date, end: Date) => void
  onAllocateSlot: (calendarId: string, slotId: string, taskName: string) => void
  onDeallocateSlot: (calendarId: string, slotId: string) => void
}> = ({ calendar, depth, onAddSlot, onAllocateSlot, onDeallocateSlot }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [addSlotOpen, setAddSlotOpen] = useState(false)

  // Sort slots by start time
  const sortedSlots = useMemo(() => {
    return [...calendar.slots].sort((a, b) =>
      parseISO(a.start).getTime() - parseISO(b.start).getTime()
    )
  }, [calendar.slots])

  // Calculate stats
  const stats = useMemo(() => {
    const total = calendar.slots.length
    const allocated = calendar.slots.filter(s => s.allocated).length
    const totalHours = calendar.slots.reduce((sum, s) => sum + getSlotDurationHours(s), 0)
    const allocatedHours = calendar.slots
      .filter(s => s.allocated)
      .reduce((sum, s) => sum + getSlotDurationHours(s), 0)

    return { total, allocated, available: total - allocated, totalHours, allocatedHours }
  }, [calendar.slots])

  return (
    <Card className={cn(depth > 0 && "ml-4 mt-2")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">{calendar.name}</CardTitle>
              <CardDescription>
                {stats.available} of {stats.total} slots available ({stats.totalHours.toFixed(1)}h total)
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AddSlotDialog
              calendarId={calendar.id}
              onAddSlot={(start, end) => onAddSlot(calendar.id, start, end)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Show'} Slots
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Stats bar */}
          <div className="flex gap-4 p-2 bg-muted/30 rounded-lg text-sm">
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-green-500" />
              <span>{stats.allocated} allocated</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>{stats.available} available</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{stats.allocatedHours.toFixed(1)}h / {stats.totalHours.toFixed(1)}h used</span>
            </div>
          </div>

          {/* Time slots */}
          {sortedSlots.length > 0 ? (
            <div className="space-y-2">
              {sortedSlots.map((slot) => (
                <TimeSlotItem
                  key={slot.id}
                  slot={slot}
                  onAllocate={(slotId, taskName) => onAllocateSlot(calendar.id, slotId, taskName)}
                  onDeallocate={(slotId) => onDeallocateSlot(calendar.id, slotId)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No time slots. Add some to track availability.
            </div>
          )}

          {/* Child calendars */}
          {calendar.children.length > 0 && (
            <div className="pt-2 border-t">
              {calendar.children.map((child) => (
                <CalendarNode
                  key={child.id}
                  calendar={child}
                  depth={depth + 1}
                  onAddSlot={onAddSlot}
                  onAllocateSlot={onAllocateSlot}
                  onDeallocateSlot={onDeallocateSlot}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/**
 * Dialog for adding a new time slot
 */
const AddSlotDialog: React.FC<{
  calendarId: string
  onAddSlot: (start: Date, end: Date) => void
}> = ({ calendarId, onAddSlot }) => {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  const handleSubmit = () => {
    if (date && startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)

      const start = new Date(date)
      start.setHours(startHour, startMin, 0, 0)

      const end = new Date(date)
      end.setHours(endHour, endMin, 0, 0)

      if (start < end) {
        onAddSlot(start, end)
        setOpen(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3 w-3 mr-1" />
          Add Slot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Time Slot</DialogTitle>
          <DialogDescription>
            Create a new available time slot
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Add Slot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dialog for creating a new calendar
 */
const CreateCalendarDialog: React.FC<{
  onCreateCalendar: (name: string) => void
}> = ({ onCreateCalendar }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = () => {
    if (name.trim()) {
      onCreateCalendar(name.trim())
      setName('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Calendar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Calendar</DialogTitle>
          <DialogDescription>
            Create a new calendar to track time availability
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-name">Calendar Name</Label>
            <Input
              id="calendar-name"
              placeholder="e.g., Work Schedule, Project Time"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Main Calendar component
 */
export const Calendar: React.FC<CalendarProps> = ({
  expression,
  data,
  setData,
  className
}) => {
  // Extract calendars from expression
  const calendars = useMemo(() => {
    return extractCalendarsFromExpression(expression)
  }, [expression])

  // Calculate overall stats
  const totals = useMemo(() => {
    let totalSlots = 0
    let allocatedSlots = 0
    let totalHours = 0
    let allocatedHours = 0

    const traverse = (items: CalendarData[]) => {
      for (const item of items) {
        totalSlots += item.slots.length
        allocatedSlots += item.slots.filter(s => s.allocated).length
        totalHours += item.slots.reduce((sum, s) => sum + getSlotDurationHours(s), 0)
        allocatedHours += item.slots
          .filter(s => s.allocated)
          .reduce((sum, s) => sum + getSlotDurationHours(s), 0)
        traverse(item.children)
      }
    }

    traverse(calendars)
    return { totalSlots, allocatedSlots, totalHours, allocatedHours }
  }, [calendars])

  // Handle creating a new calendar
  const handleCreateCalendar = useCallback((name: string) => {
    expression.createCalendar(name)

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  // Handle adding a time slot
  const handleAddSlot = useCallback((calendarId: string, start: Date, end: Date) => {
    expression.addTimeSlot(calendarId, start.toISOString(), end.toISOString())

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  // Handle allocating a slot
  const handleAllocateSlot = useCallback((calendarId: string, slotId: string, taskName: string) => {
    expression.allocateTimeSlot(calendarId, slotId, taskName)

    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })
  }, [expression, data, setData])

  // Handle deallocating a slot
  const handleDeallocateSlot = useCallback((calendarId: string, slotId: string) => {
    // TODO: Add deallocate method to expression
    console.log('Deallocate slot', calendarId, slotId)
  }, [])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with totals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendars
              </CardTitle>
              <CardDescription>
                Manage time availability and allocations
              </CardDescription>
            </div>
            <CreateCalendarDialog onCreateCalendar={handleCreateCalendar} />
          </div>
        </CardHeader>
        {calendars.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{totals.totalSlots}</div>
                <div className="text-sm text-muted-foreground">Total Slots</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {totals.totalSlots - totals.allocatedSlots}
                </div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totals.allocatedSlots}</div>
                <div className="text-sm text-muted-foreground">Allocated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{totals.totalHours.toFixed(1)}h</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Calendar list */}
      {calendars.length > 0 ? (
        <div className="space-y-4">
          {calendars.map((calendar) => (
            <CalendarNode
              key={calendar.id}
              calendar={calendar}
              depth={0}
              onAddSlot={handleAddSlot}
              onAllocateSlot={handleAllocateSlot}
              onDeallocateSlot={handleDeallocateSlot}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No calendars yet</p>
            <p className="text-sm">Create a calendar to start tracking time availability</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Calendar
