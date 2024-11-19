import React, { ReactElement, useEffect, useState } from 'react'

import { HomeIcon } from '@radix-ui/react-icons'
import { Button } from "@/frontend/components/ui/button"
import {
  closestCorners,
  pointerWithin,
  DndContext, 
  DragEndEvent, 
  DragOverEvent, 
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor, 
  useSensor,
  useSensors,
  ClientRect,
  useDroppable,
  useDndContext,
  Active,
  DroppableContainer,
  Collision,
  Over,

} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Coordinates
} from '@dnd-kit/utilities';

import { DroppableContainersMap } from '@dnd-kit/core/dist/store/constructors';

import { AppState, FosNodeContent,  FosReactGlobal,  FosReactOptions, FosRoute } from '../../../types'
import { getActions } from '../../../lib/actions'

import { DefaultRootComponent } from './root'
import { useProps } from '@/frontend/App';
import { getNodeOperations } from '@/frontend/lib/nodeOperations';
import { getDragAndDropHandlers } from '../../drag-drop';




// eslint-disable-next-line @typescript-eslint/ban-types
export function MainView (){


  const { 
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  } : {
    options: FosReactGlobal
    data: AppState
    nodeRoute: FosRoute
    setData: (state: AppState) => void
  } = useProps()

  


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
      onActivation: (event) => {
        // console.log('test1')
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      onActivation: (event) => {
        // console.log('test1')
      },
    }), 
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
      onActivation: (event) => {
        // console.log('test1')
      }
    })
  );
  
  const {
    customCollisionDetection,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
  } = getDragAndDropHandlers(options, data, setData)

  // console.log('zoomroute', route)

  return (
    <DndContext 
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
      <div className={`w-full trellis-root `} >
        {<DefaultRootComponent 
          data={data}
          setData={setData}
          options={options}
          nodeRoute={route}
          />}
      </div>
    </DndContext>
  )
}


export default MainView

