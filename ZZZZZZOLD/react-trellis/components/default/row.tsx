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
import { Button } from "../../../ui/button"

import { CSS } from '@dnd-kit/utilities';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import _, { update } from 'lodash'
import { useWindowSize } from '../window-size'
import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from '../../trellis/types'

import { getMeta } from '@/react-trellis/trellis/util'

export type TrellisRowComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on' | 'breadcrumb', node: T } | null,
  dragging: { id: string, node: T, breadcrumb: boolean } | null,
  dragItem: { id: string, data: { node: T, breadcrumb: boolean } },
  rowDepth: number,
  disabled: boolean,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}


export const DefaultRowComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  dragOverInfo,
  dragging,
  dragItem,
  rowDepth,
  disabled,
  global,
  meta,
  state,
  updateState
}: TrellisRowComponentProps<T, S>) => {



  const node = meta.trellisNode

  const children = node.getChildren()


  const nodeId = node.getId()
  // const nodeItemId = `${nodeType}-${nodeId}`
  // const dragItemNodeId = `${dragItem?.data.node.getNodeType()}-${dragItem?.data.node.getNodeId()}`


  const isChildOf = (argNode: T) => {
    const trail = node.getRoute()
    const hasParent = trail.find((node) => node.getId() === argNode.getId())
    return !!hasParent
  }

  const isDraggingParent = !!(dragging && dragging.node && isChildOf(dragging.node))

  const nodeItemId = `${node.getId()}`
  const nodeItemIdMaybeParent = dragging && isDraggingParent ? dragging.id : nodeItemId


  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    // transition,
  } = useDraggable({id: nodeItemIdMaybeParent, data: { node: isDraggingParent ? dragging.node : node } });


  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable({
    id: nodeItemIdMaybeParent,
    disabled: isDraggingParent || disabled,
    data: { node }
  });


  // console.log('transformstyle', transform, CSS.Transform.toString(transform))
    // transition,)

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


  const hasFocus = node.hasFocus() !== null
  

  const setFocusToHere = () => {
    const focusChar = node.getRoot().hasFocus()
    node.setFocus(focusChar)
  }

  // const registerRecievedFocus = () => {
  //   node.registerRecievedFocus()
  // }



  const moveFocusUp = () => {
    const newContext = node.moveFocusUp()
    // if (newContext){
    //   updateNodes(newContext)
    // }
  }

  const moveFocusDown = () => {
    const newContext = node.moveFocusDown()
  }

  const toggleCollapse = () => {
    node.toggleCollapse()
  }

  // const addYoungerSibling = () => {
  //   node.addYoungerSibling()
  // }

  const moveLeft = () => {
    node.moveLeft()
  }

  const moveRight = () => {
    node.moveRight()
  }

  // const deleteRow = () => {
  //   node.remove()
  // }

  const moveUp = () => {
    node.moveUp()
  }

  const moveDown = () => {
    node.moveDown()
  }


  // const handleUndo = () => {
  //   node.undo()
  // }

  // const handleRedo = () => {
  //   node.redo()
  // }



  // const handleTextEdit = ( e: string ) => {
  //   node.updateData({...node.getData(), content: e})
  // }


  // const focusChar = node.getFocusChar()





  
  const handleZoom = () => {
    console.log('zooming', node)
    node.setZoom()
    console.log('zooming2', node)
    node.refresh()
  }


  const isDragging = dragging ? (dragging.id === `${dragItem?.id}`) : false 
  const draggingOver = !!isOver

  const RowsComponent = node.components.rows
  const RowBodyComponent = node.components.rowBody
  const MenuComponent = node.components.menu

  const maxRowDepth = state.rowDepth

  // console.log('trellis row')

  return (
 
  <div className={`w-full max-w-svw border-box `} ref={setDragNodeRef} {...attributes} {...listeners}  style={{...dragStyle}} >
  <div className={`flex w-full rounded-none border-b border-collapse pl-2 ${hasFocus ? "bg-foreground/20" : ''}`} >
    <div style={{
      ...dropStyle,
      width: 'calc(100%)',
      paddingLeft: `${(maxRowDepth - rowDepth) * 1.5}rem`,
    }}  
      ref={setDropNodeRef} 
      className={``}>

        <RowBodyComponent 
          trellisNode={node} 
          node={node.getInterfaceNode()} 
          global={global} 
          meta={getMeta(node)} 
          state={state} 
          updateState={updateState}
          />
    </div>
  </div>
  <div className={` `}>
    {!node.isCollapsed() && rowDepth > 0 && children.length > 0 && (
      <RowsComponent 
        node={node.getInterfaceNode()}
        rowDepth={rowDepth - 1} 
        dragging={dragging}
        dragOverInfo={dragOverInfo}
        disabled={disabled}
        global={global}
        meta={meta}
        state={state}
        updateState={updateState}
      />
    )}
  </div>

  </div>)

}




