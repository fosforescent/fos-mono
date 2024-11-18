import React, { useEffect, useState } from 'react'



import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"


import { TrashIcon, PlayIcon, Folder, MinusCircleIcon, ChevronDownCircleIcon, ChevronRightCircleIcon, LucideCheck, XIcon, ChevronLeftCircleIcon, CircleEllipsis } from "lucide-react"
import { QuestionMarkCircledIcon, ComponentNoneIcon, Crosshair1Icon, DiscIcon, DragHandleDots2Icon, DotsVerticalIcon, PlusCircledIcon, } from "@radix-ui/react-icons"


import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { CSS } from '@dnd-kit/utilities';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import _, { update } from 'lodash'
import { FosReactOptions, FosRoute, TrellisSerializedData } from '../../../types'

import { AppState } from '@/fos-combined/types'
import { getNodeOperations } from '@/fos-combined/lib/nodeOperations'
import { getDragItem, getNodeInfo } from '@/fos-combined/lib/utils'
import { FosRowsComponent } from './rows'
import { RowBody } from './rowBody'
import { getDragAndDropHandlers } from '../../drag-drop'




export const DefaultRowComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {



  const { locked, getOptionInfo,
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase,
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep
  } = getNodeInfo(nodeRoute, data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    suggestSteps,
  } = getNodeOperations(options, data, setData, nodeRoute)
  
  const { 
    getNodeDragInfo 
  } = getDragAndDropHandlers(options, data, setData) 
   


  const { getStyles, nodeItemIdMaybeParent, isDraggingParent, dragging, useDraggableArg, useDroppableArg } = getNodeDragInfo(nodeRoute)

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    // transition,
  } = useDraggable(useDraggableArg);


  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable(useDroppableArg);

  const {
    dragStyle, 
    dropStyle
  } = getStyles(transform)

  
  return (
 
  <div className={`w-full max-w-svw border-box `} ref={setDragNodeRef} {...attributes} {...listeners}  style={{...dragStyle}} >
  <div className={`flex w-full rounded-none border-b border-collapse pl-2 ${hasFocus ? "bg-foreground/20" : ''}`} >
    <div style={{
      ...dropStyle,
      width: 'calc(100%)',
      paddingLeft: `${(depth - 1) * 1.5}rem`,
    }}  
      ref={setDropNodeRef} 
      className={``}>

      <RowBody
        data={data}
        nodeRoute={nodeRoute}
        setData={setData}
        options={options}
          />
    </div>
  </div>
  <div className={` `}>
    {!isCollapsed && depth > 0 && childRoutes.length > 0 && (
      <FosRowsComponent 
        data={data}
        nodeRoute={nodeRoute}
        setData={setData}
        options={options}
      />
    )}
  </div>

  </div>)

}




