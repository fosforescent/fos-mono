/**
 * TypedValueEditor - Component that combines type inference with value editing
 *
 * Flow:
 * 1. Attempt to infer type from expression data
 * 2. If type inferred → show appropriate ValueInput
 * 3. If type not inferred → show TypeSelector, then ValueInput once selected
 */

import React, { useState, useMemo, useCallback } from 'react'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { FosDataContent } from '@fosforescent/shared/types'
import { TypeSelector, SelectedType, PrimitiveTypeId, PRIMITIVE_TYPES, TypeBadge } from './TypeSelector'
import { ValueInput } from './ValueInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { X, Edit2 } from 'lucide-react'

interface TypedValueEditorProps {
  /** The expression being edited */
  expression: FosExpression
  /** Called when the value changes */
  onValueChange: (value: unknown, type: SelectedType) => void
  /** Whether type can be changed after inference */
  allowTypeOverride?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Label for the editor */
  label?: string
}

/**
 * Attempt to infer type from FosDataContent
 */
function inferTypeFromData(data: FosDataContent): { type: SelectedType | null; value: unknown } {
  // Check for budget data
  if (data.budget) {
    return {
      type: { kind: 'primitive', id: 'currency', name: 'Currency' },
      value: { amount: data.budget.total, currency: data.budget.currency || 'USD' }
    }
  }

  // Check for calendar/duration data
  if (data.duration) {
    return {
      type: { kind: 'primitive', id: 'duration', name: 'Duration' },
      value: {
        hours: Math.floor(data.duration.plannedMarginal / 60),
        minutes: data.duration.plannedMarginal % 60
      }
    }
  }

  // Check for document content
  if (data.document?.content) {
    return {
      type: { kind: 'primitive', id: 'document', name: 'Document' },
      value: data.document.content
    }
  }

  // Check for cost data
  if (data.cost) {
    return {
      type: { kind: 'primitive', id: 'currency', name: 'Currency' },
      value: { amount: data.cost.plannedMarginal, currency: 'USD' }
    }
  }

  // Check for todo data (boolean)
  if (data.todo !== undefined) {
    return {
      type: { kind: 'primitive', id: 'boolean', name: 'Yes/No' },
      value: data.todo.completed
    }
  }

  // Check for comment data
  if (data.comment?.content) {
    return {
      type: { kind: 'primitive', id: 'string', name: 'Text' },
      value: data.comment.content
    }
  }

  // Check for description
  if (data.description?.content) {
    return {
      type: { kind: 'primitive', id: 'string', name: 'Text' },
      value: data.description.content
    }
  }

  // Check for list-like resources
  if (data.resources) {
    return {
      type: { kind: 'primitive', id: 'list', name: 'List' },
      value: [...(data.resources.required || []), ...(data.resources.available || [])]
    }
  }

  // Could not infer type
  return { type: null, value: undefined }
}

/**
 * Get the data field path for a given type
 */
function getDataFieldForType(typeId: PrimitiveTypeId | string): keyof FosDataContent | null {
  switch (typeId) {
    case 'string':
      return 'description'
    case 'document':
      return 'document'
    case 'currency':
      return 'cost'
    case 'duration':
      return 'duration'
    case 'boolean':
      return 'todo'
    case 'list':
      return 'resources'
    default:
      return null
  }
}

export const TypedValueEditor: React.FC<TypedValueEditorProps> = ({
  expression,
  onValueChange,
  allowTypeOverride = true,
  className,
  disabled = false,
  label
}) => {
  // Get current data from expression
  const expressionData = useMemo(() => {
    return expression.targetNode.getContent().data
  }, [expression])

  // Try to infer type and value from data
  const inferred = useMemo(() => {
    return inferTypeFromData(expressionData)
  }, [expressionData])

  // State for manually selected type (overrides inference)
  const [manualType, setManualType] = useState<SelectedType | null>(null)
  const [isEditingType, setIsEditingType] = useState(false)

  // The active type is either manually set or inferred
  const activeType = manualType || inferred.type
  const activeValue = manualType ? undefined : inferred.value

  // Handle type selection
  const handleTypeChange = useCallback((type: SelectedType) => {
    setManualType(type)
    setIsEditingType(false)
  }, [])

  // Handle value change
  const handleValueChange = useCallback((value: unknown) => {
    if (activeType) {
      onValueChange(value, activeType)
    }
  }, [activeType, onValueChange])

  // Clear manual type override
  const handleClearOverride = useCallback(() => {
    setManualType(null)
  }, [])

  // Render based on whether we have a type
  return (
    <div className={cn("space-y-3", className)}>
      {/* Type indicator / selector */}
      <div className="flex items-center gap-2">
        {activeType && !isEditingType ? (
          <>
            <TypeBadge type={activeType} />
            {manualType && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleClearOverride}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {!manualType && inferred.type && (
              <Badge variant="outline" className="text-xs">
                inferred
              </Badge>
            )}
            {allowTypeOverride && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setIsEditingType(true)}
                disabled={disabled}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex-1">
            <TypeSelector
              value={activeType || undefined}
              onChange={handleTypeChange}
              expression={expression}
              store={expression.store}
              placeholder="Select or infer type..."
            />
          </div>
        )}
      </div>

      {/* Value input (shown once type is known) */}
      {activeType && !isEditingType && (
        <ValueInput
          type={activeType}
          value={activeValue}
          onChange={handleValueChange}
          onTypeChange={handleTypeChange}
          allowTypeSelection={false}
          disabled={disabled}
          label={label}
        />
      )}

      {/* No type and no type selection - show helper text */}
      {!activeType && !isEditingType && (
        <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md">
          Select a type above to enter a value
        </div>
      )}
    </div>
  )
}

/**
 * Compact inline version for use in tables/grids
 */
export const InlineTypedValue: React.FC<{
  expression: FosExpression
  onValueChange: (value: unknown, type: SelectedType) => void
  disabled?: boolean
  className?: string
}> = ({ expression, onValueChange, disabled, className }) => {
  const expressionData = useMemo(() => {
    return expression.targetNode.getContent().data
  }, [expression])

  const inferred = useMemo(() => {
    return inferTypeFromData(expressionData)
  }, [expressionData])

  if (!inferred.type) {
    return (
      <TypeSelector
        onChange={(type) => onValueChange(undefined, type)}
        expression={expression}
        store={expression.store}
        placeholder="Type..."
        className={cn("h-8", className)}
      />
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TypeBadge type={inferred.type} className="shrink-0" />
      <ValueInput
        type={inferred.type}
        value={inferred.value}
        onChange={(value) => onValueChange(value, inferred.type!)}
        allowTypeSelection={false}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  )
}

export default TypedValueEditor
