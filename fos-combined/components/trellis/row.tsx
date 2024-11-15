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
import { useWindowSize } from '../window-size'
import { FosReactOptions, FosRoute, TrellisSerializedData } from '../../types'

import { AppState } from '@/fos-combined/types'
import { getNodeOperations } from '@/fos-combined/lib/nodeOperations'
import { getDragItem, getNodeInfo } from '@/fos-combined/lib/utils'
import { FosRowsComponent } from './rows'
import { RowBody } from './rowBody'




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
    dragging, 
    dragOverInfo,
   } = data.data.trellisData.dragInfo


  const isChildOf = (argNodeRoute: FosRoute) => {
    const matches = argNodeRoute.every((argNodeElem, index) => {
      return argNodeElem[0] === nodeRoute[index]?.[0] && argNodeElem[1] === nodeRoute[index]?.[1]
    })
    return matches
  }

  const isDraggingParent = !!(dragging && dragging.nodeRoute && isChildOf(dragging.nodeRoute))

  const nodeItemId = `${nodeType}-${nodeId}`
  const nodeItemIdMaybeParent = isDragging && isDraggingParent ? dragging.id : nodeItemId


  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    // transition,
  } = useDraggable({id: nodeItemIdMaybeParent, data: { nodeRoute: isDraggingParent ? dragging.nodeRoute : nodeRoute } });


  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable({
    id: nodeItemIdMaybeParent,
    disabled: isDraggingParent || disabled,
    data: { nodeRoute }
  });


  // console.log('transformstyle', transform, CSS.Transform.toString(transform))
    // transition,)


  const dragItem = getDragItem(nodeRoute, false)

  const dragStyle = {
    transform: transform ? `translate3d( ${transform?.x}px, ${transform?.y}px, 0) scaleY(${transform?.scaleY || 1})` : undefined,
    // transition,
    // width: `calc(width * ${transform?.scaleX || 1})`,
    ...(dragging && dragging.id !== `${dragItem?.id}`) ? {opacity: 0.9} : {}
  };
  


  const draggingOn = !!isOver && dragOverInfo?.position === 'on'

  const dropOnStyle = draggingOn ? {
    backgroundColor: 'rgba(230, 220, 200, .7)',
    // transform: 'scale(1.05)',
  } : {}

  const draggingStyle = dragging?.id === nodeItemId ? {
    opacity: 0.5
  } : {}

  const isNotDragging = dragging ? (dragging.id !== nodeItemId) : true

  const isDropping = isOver && dragOverInfo && dragOverInfo.id === nodeItemId

  // console.log('isDropping', isDropping, dragOverInfo, nodeItemId, isOver, dragItem?.id, dragging?.id, isNotDragging, draggingOn, dragOverInfo?.position, draggingOn, dropOnStyle, draggingStyle, dragStyle)


  const dropStyle = (isDropping && isNotDragging) ? {
    ...(dragOverInfo.position === 'above' ? {
      paddingTop: '8px',
      // backgroundColor: 'rgba(230, 220, 200, .1)',
      // background: 'linear-gradient(rgba(230, 220, 200, .1) 0%, rgba(230, 220, 200, .1) 30%, rgba(230, 220, 200, 0) 30%, rgba(230, 220, 200, 0) 100%)',
      transition: 'padding-top 0.1s ease, padding-bottom 0.1s ease, transform 0.1s ease',
      transform: 'translateY(8px)',
      // borderTop: '3px solid black'
    } : {}),
    ...(dragOverInfo.position === 'below' ? {
      transform: 'translateY(-8px)',
      transition: 'padding-top 0.1s ease, padding-bottom 0.1s ease, transform 0.1s ease',
      // backgroundColor: 'rgba(230, 220, 200, .1)',
      // background: 'linear-gradient(rgba(230, 220, 200, 0) 0%, rgba(230, 220, 200, 0) 70%, rgba(230, 220, 200, .1) 70%, rgba(230, 220, 200, .1) 100%)',
      paddingBottom: '8px',
      // borderBottom: '3px solid black'
    } : {}),
    ...(dragOverInfo.position === 'on'? {
      transform: 'scaleY(.9)',
      transition: 'scale 0.3s ease, padding 0.3s ease',
      backgroundColor: 'rgba(230, 220, 200, .5)',
      // background: 'linear-gradient(rgba(230, 220, 200, 0) 0%, rgba(230, 220, 200, 0) 70%, rgba(230, 220, 200, .1) 70%, rgba(230, 220, 200, .1) 100%)',
      paddingTop: 'calc(.1 * height)',
      paddingBottom: 'calc(.1 * height)',
      // borderBottom: '3px solid black'
    } : {}),
    // ...(dragOverInfo.position === 'on' ? {
    //   transform: 'scale(1.1)',
    // } : {}),
    // backgroundColor: 'rgba(255, 230, 230, 0.1)',
  } : {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  }




  // console.log('trellis row')

  return (
 
  <div className={`w-full max-w-svw border-box `} ref={setDragNodeRef} {...attributes} {...listeners}  style={{...dragStyle}} >
  <div className={`flex w-full rounded-none border-b border-collapse pl-2 ${hasFocus ? "bg-foreground/20" : ''}`} >
    <div style={{
      ...dropStyle,
      width: 'calc(100%)',
      paddingLeft: `${(depth) * 1.5}rem`,
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




