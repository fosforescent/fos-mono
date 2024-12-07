import React, { useEffect, useState } from 'react'


import _, { get, has }  from 'lodash'


import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon, SendHorizonal, PlusIcon, BrainCircuit, CheckIcon, Trash2, CircleDot } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactGlobal, FosReactOptions, FosPath, AppStateLoaded } from '@/shared/types'
import { cn } from '@/frontend/lib/utils'

import { Card, CardContent, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import InputDiv from '../elements/inputDiv'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'

import { getDragAndDropHandlers } from '../drag-drop'
import { VersionControlComponent } from '../fields/versionControl'
import { FosExpression } from '@/shared/dag-implementation/expression'



export const ExpressionFields = ({
  depthToShow,
  mode,
  expression,
  data,
  setData,
  options,
  ...props
} : {
  depthToShow: number
  mode: ("read" | "write" | "execute")[]
  expression: FosExpression
  options: FosReactGlobal
  data: AppStateLoaded
  setData: (state: AppStateLoaded) => void
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
  

  return (<div className="flex gap-2">
    <div><DiscIcon /></div>
    <VersionControlComponent expression={expression} depthToShow={depthToShow} />
    {/* <ChoiceRowComponent expression={expression} depthToShow={depthToShow} /> */}


  </div>)
}




