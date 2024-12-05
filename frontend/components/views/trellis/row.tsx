import React, { useEffect, useState } from 'react'



import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/frontend/components/ui/sheet"


import { TrashIcon, PlayIcon, Folder, MinusCircleIcon, ChevronDownCircleIcon, ChevronRightCircleIcon, LucideCheck, XIcon, ChevronLeftCircleIcon, CircleEllipsis } from "lucide-react"
import { QuestionMarkCircledIcon, ComponentNoneIcon, Crosshair1Icon, DiscIcon, DragHandleDots2Icon, DotsVerticalIcon, PlusCircledIcon, } from "@radix-ui/react-icons"


import { Input } from "@/frontend/components/ui/input"
import { Button } from "@/frontend/components/ui/button"

import { CSS } from '@dnd-kit/utilities';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import _, { update } from 'lodash'
import { FosReactOptions, FosPath, TrellisSerializedData } from '../../../../shared/types'

import { AppState } from '@/shared/types'

import { FosRowsComponent } from './rows'
import { ExpressionRow } from '../../expression/ExpressionRow'
import { getDragAndDropHandlers } from '../../drag-drop'
import { FosStore } from '@/shared/dag-implementation/store'
import { FosExpression } from '@/shared/dag-implementation/expression'




export const DefaultRowComponent = ({ 
  setData,
  options,
  expression,
} : {
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppState) => void
}) => {


  


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

      <ExpressionRow
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




