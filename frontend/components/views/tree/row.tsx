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

import { AppStateLoaded } from '@/shared/types'

import { FosRowsComponent } from './rows'
import { ExpressionRow } from '../../expression/ExpressionRow'
import { getDragAndDropHandlers } from '../../drag-drop'
import { FosStore } from '@/shared/dag-implementation/store'
import { FosExpression } from '@/shared/dag-implementation/expression'




export const DefaultRowComponent = ({
  data,
  setData,
  options,
  expression,
} : {
  data: AppStateLoaded
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {


  

  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
      data: state
    })
  }

  const { 
    getNodeDragInfo 
  } = getDragAndDropHandlers(expression, options, setFosAndTrellisData) 
   


  const { getStyles, nodeItemIdMaybeParent, isDraggingParent, dragging, useDraggableArg, useDroppableArg } = getNodeDragInfo(expression.route)

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
  <div className={`flex w-full rounded-none border-b border-collapse pl-2 ${expression.hasFocus() ? "bg-foreground/20" : ''}`} >
    <div style={{
      ...dropStyle,
      width: 'calc(100%)',
      paddingLeft: `${(expression.depth() - 1) * 1.5}rem`,
    }}  
      ref={setDropNodeRef} 
      className={``}>

      <ExpressionRow
        expression={expression}
        setData={setData}
        options={options}
        data={data}
          />
    </div>
  </div>
  <div className={` `}>
    {!expression.isCollapsed() && expression.depth() > 0 && expression.childRoutes().length > 0 && (
      <FosRowsComponent 
        data={data}
        expression={expression}
        setData={setData}
        options={options}
      />
    )}
  </div>

  </div>)

}




