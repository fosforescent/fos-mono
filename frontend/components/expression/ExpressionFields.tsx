import React, { useEffect, useState, useCallback } from 'react'


import _, { get, has } from 'lodash'


import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon, SendHorizonal, PlusIcon, BrainCircuit, CheckIcon, Trash2, CircleDot, Edit2 } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactGlobal, FosReactOptions, FosPath, AppStateLoaded } from '@fosforescent/shared/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import InputDiv from '../elements/inputDiv'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'

import { getDragAndDropHandlers } from '../drag-drop'
import { VersionControlComponent } from '../fields/versionControl'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { TypedValueEditor, InlineTypedValue, SelectedType } from './index'



export const ExpressionFields = ({
  depthToShow,
  mode,
  expression,
  data,
  setData,
  options,
  showValueEditor = false,
  ...props
}: {
  depthToShow: number
  mode: ("read" | "write" | "execute")[]
  expression: FosExpression
  options: FosReactGlobal
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
  /** Whether to show the typed value editor */
  showValueEditor?: boolean
}) => {




  /**
   * If todo, show todo field with possibly summarized data
   * 
   * - checkbox 
   * - description
   * - submit button
   * 
   * - return type?
   * - input type?
   * 
   * possible sub-items to show (if depth allows):
   * - subtasks
   * - requirements (estimated time requirements, estimated resource requirements, etc., people)
   * - allocations (calendar allocations (from people), budget (from people), resources (from people))
   * - consumptions (time entries (from people), expenses (from people), resources used (from people))
   * 
   */

  // todo field data




  /**
   * long press  / right click? 
   * or other menu button? 
   * zoom is within menu? 
   * 
   * double-tap on whole row to zoom? 
   * 
   * 
   * 
   * 
   */

  const [versionControlExpanded, setVersionControlExpanded] = useState(false)
  const hasVersionControl = true

  /**
   * Actions: 
   * - turn into list
   * - turn into options
   */
  const hasList = false
  const hasOptions = false
  const hasVersions = false
  const isTodo = false


  const expressionType = expression.isTodo()
    ? 'todo'
    : expression.isComment()
      ? 'comment'
      : 'expression'
  const description = expression.getDescription()

  // State for inline value editing
  const [isEditingValue, setIsEditingValue] = useState(false)

  // Handle value changes from the typed value editor
  const handleValueChange = useCallback((value: unknown, type: SelectedType) => {
    // Update the expression data based on type
    // For now, we'll update description for string types
    // This should be expanded to handle all type mappings
    const typeId = type.id

    // Update the node's data
    const currentContent = expression.targetNode.getContent()
    let updatedData = { ...currentContent.data }

    switch (typeId) {
      case 'string':
        updatedData.description = { content: String(value || '') }
        break
      case 'document':
        updatedData.document = { content: String(value || '') }
        break
      case 'number':
        updatedData.cost = {
          ...updatedData.cost,
          plannedMarginal: Number(value) || 0,
          entries: updatedData.cost?.entries || []
        }
        break
      case 'currency':
        if (typeof value === 'object' && value && 'amount' in value) {
          updatedData.cost = {
            ...updatedData.cost,
            plannedMarginal: (value as { amount: number }).amount,
            entries: updatedData.cost?.entries || []
          }
        }
        break
      case 'duration':
        if (typeof value === 'object' && value && 'hours' in value) {
          const dur = value as { hours: number; minutes: number }
          updatedData.duration = {
            ...updatedData.duration,
            plannedMarginal: dur.hours * 60 + dur.minutes,
            entries: updatedData.duration?.entries || []
          }
        }
        break
      case 'boolean':
        updatedData.todo = {
          ...updatedData.todo,
          completed: Boolean(value),
          time: updatedData.todo?.time || Date.now()
        }
        break
      case 'list':
        if (Array.isArray(value)) {
          updatedData.resources = {
            ...updatedData.resources,
            required: value.map(String),
            available: updatedData.resources?.available || [],
            produced: updatedData.resources?.produced || []
          }
        }
        break
    }

    // Update the node with new data
    const updatedNode = expression.targetNode.setData(updatedData)

    // Export and update app state
    const updatedContext = expression.store.exportContext([])
    setData({
      ...data,
      data: updatedContext
    })

    setIsEditingValue(false)
  }, [expression, data, setData])

  const isWriteMode = mode.includes('write')

  return (
    <div
      className="flex flex-col gap-2"
      data-testid={`expression-fields-${expression.expressionId()}`}
      data-expression-type={expressionType}
    >
      <div className="flex gap-2 items-center">
        <div><DiscIcon /></div>
        <VersionControlComponent expression={expression} depthToShow={depthToShow} />
        <span
          className="text-sm text-foreground flex-1"
          data-testid="expression-description"
        >
          {description || (expressionType === 'comment' ? '(empty comment)' : '(no description)')}
        </span>
        {/* Edit button for typed value editing */}
        {isWriteMode && showValueEditor && !isEditingValue && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsEditingValue(true)}
            title="Edit typed value"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Typed value editor (expandable) */}
      {isWriteMode && showValueEditor && isEditingValue && (
        <div className="ml-6 p-3 border rounded-md bg-muted/30">
          <TypedValueEditor
            expression={expression}
            onValueChange={handleValueChange}
            allowTypeOverride={true}
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingValue(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {/* <ChoiceRowComponent expression={expression} depthToShow={depthToShow} /> */}
    </div>
  )
}




