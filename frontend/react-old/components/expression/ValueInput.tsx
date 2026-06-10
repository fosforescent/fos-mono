/**
 * ValueInput - Component that renders appropriate input UI based on type
 *
 * Given a type (inferred or selected), renders the correct input interface:
 * - Text type → text input
 * - Number type → number input
 * - Date type → date picker
 * - Currency type → currency input with symbol
 * - List type → multi-value input
 * - etc.
 */

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, X, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { SelectedType, PrimitiveTypeId, TypeSelector, PRIMITIVE_TYPES } from './TypeSelector'

/**
 * Value types that correspond to primitive types
 */
export type ValueType =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; value: Date }
  | { kind: 'time'; value: string }
  | { kind: 'duration'; value: { hours: number; minutes: number } }
  | { kind: 'currency'; value: { amount: number; currency: string } }
  | { kind: 'list'; value: unknown[] }
  | { kind: 'person'; value: { name: string; email?: string } }
  | { kind: 'document'; value: string }
  | { kind: 'unknown'; value: unknown }

interface ValueInputProps {
  /** The type of value to input (if known) */
  type?: SelectedType
  /** Current value */
  value?: unknown
  /** Called when value changes */
  onChange: (value: unknown) => void
  /** Called when type changes (if type selection is enabled) */
  onTypeChange?: (type: SelectedType) => void
  /** Whether to allow type selection if type is unknown */
  allowTypeSelection?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Label for the input */
  label?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export const ValueInput: React.FC<ValueInputProps> = ({
  type,
  value,
  onChange,
  onTypeChange,
  allowTypeSelection = true,
  placeholder,
  label,
  disabled = false,
  className
}) => {
  // If no type is provided and type selection is allowed, show type selector
  if (!type && allowTypeSelection) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label>{label}</Label>}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Select a type to enter a value:
          </p>
          <TypeSelector
            onChange={(selectedType) => {
              onTypeChange?.(selectedType)
            }}
            placeholder="Choose type..."
          />
        </div>
      </div>
    )
  }

  // If still no type, render a basic text input
  if (!type) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label>{label}</Label>}
        <Input
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter value...'}
          disabled={disabled}
        />
      </div>
    )
  }

  // Render appropriate input based on type
  const typeId = type.id as PrimitiveTypeId

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      {renderInputForType(typeId, value, onChange, placeholder, disabled)}
    </div>
  )
}

/**
 * Render the appropriate input component for a type
 */
function renderInputForType(
  typeId: PrimitiveTypeId | string,
  value: unknown,
  onChange: (value: unknown) => void,
  placeholder?: string,
  disabled?: boolean
): React.ReactNode {
  switch (typeId) {
    case 'string':
      return (
        <Input
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter text...'}
          disabled={disabled}
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          value={value !== undefined && value !== null ? Number(value) : ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder={placeholder || 'Enter number...'}
          disabled={disabled}
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
            disabled={disabled}
          />
          <span className="text-sm">{value ? 'Yes' : 'No'}</span>
        </div>
      )

    case 'date':
      return <DateInput value={value as Date} onChange={onChange} disabled={disabled} />

    case 'time':
      return (
        <Input
          type="time"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )

    case 'duration':
      return <DurationInput value={value as { hours: number; minutes: number }} onChange={onChange} disabled={disabled} />

    case 'currency':
      return <CurrencyInput value={value as { amount: number; currency: string }} onChange={onChange} disabled={disabled} />

    case 'list':
      return <ListInput value={value as unknown[]} onChange={onChange} disabled={disabled} />

    case 'person':
      return <PersonInput value={value as { name: string; email?: string }} onChange={onChange} disabled={disabled} />

    case 'document':
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter document content...'}
          disabled={disabled}
          className="min-h-[100px]"
        />
      )

    default:
      // Unknown type - fallback to text input
      return (
        <Input
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter value...'}
          disabled={disabled}
        />
      )
  }
}

/**
 * Date input with calendar picker
 */
const DateInput: React.FC<{
  value?: Date
  onChange: (value: Date | undefined) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Duration input (hours and minutes)
 */
const DurationInput: React.FC<{
  value?: { hours: number; minutes: number }
  onChange: (value: { hours: number; minutes: number }) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const hours = value?.hours || 0
  const minutes = value?.minutes || 0

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={hours}
        onChange={(e) => onChange({ hours: parseInt(e.target.value) || 0, minutes })}
        className="w-20"
        disabled={disabled}
      />
      <span className="text-sm text-muted-foreground">h</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={minutes}
        onChange={(e) => onChange({ hours, minutes: parseInt(e.target.value) || 0 })}
        className="w-20"
        disabled={disabled}
      />
      <span className="text-sm text-muted-foreground">m</span>
    </div>
  )
}

/**
 * Currency input with amount and currency selector
 */
const CurrencyInput: React.FC<{
  value?: { amount: number; currency: string }
  onChange: (value: { amount: number; currency: string }) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const amount = value?.amount || 0
  const currency = value?.currency || 'USD'

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currency}
        onValueChange={(c) => onChange({ amount, currency: c })}
        disabled={disabled}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {currencies.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0, currency })}
        className="flex-1"
        disabled={disabled}
      />
    </div>
  )
}

/**
 * List input for multiple values
 */
const ListInput: React.FC<{
  value?: unknown[]
  onChange: (value: unknown[]) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const items = value || []
  const [newItem, setNewItem] = useState('')

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()])
      setNewItem('')
    }
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <Badge key={index} variant="secondary" className="gap-1">
            {String(item)}
            {!disabled && (
              <button
                onClick={() => removeItem(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add item..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
          />
          <Button variant="outline" size="icon" onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Person/contact input
 */
const PersonInput: React.FC<{
  value?: { name: string; email?: string }
  onChange: (value: { name: string; email?: string }) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const name = value?.name || ''
  const email = value?.email || ''

  return (
    <div className="space-y-2">
      <Input
        value={name}
        onChange={(e) => onChange({ name: e.target.value, email })}
        placeholder="Name"
        disabled={disabled}
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => onChange({ name, email: e.target.value })}
        placeholder="Email (optional)"
        disabled={disabled}
      />
    </div>
  )
}

export default ValueInput
