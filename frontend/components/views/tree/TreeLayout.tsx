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

import { AppState, FosNodeContent,  FosReactGlobal,  FosReactOptions, FosPath, AppStateLoaded } from '../../../../shared/types'
import { getActions } from '../../../lib/actions'


import { useProps } from '@/frontend/App';

import { getDragAndDropHandlers } from '../../drag-drop';
import { FosExpression } from '@/shared/dag-implementation/expression';
import { FosStore } from '@/shared/dag-implementation/store';
import { DefaultBreadcrumbsComponent } from '../../breadcrumbs/breadcrumbs';
import { FosRowsComponent } from './rows';




// eslint-disable-next-line @typescript-eslint/ban-types
export function TreeView (){


  const { 
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  } : {
    options: FosReactGlobal
    data: AppStateLoaded
    nodeRoute: FosPath
    setData: (state: AppStateLoaded) => void
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
  


  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
      data: state
    })
  }

  
  const store = new FosStore({ fosCtxData: data.data, mutationCallback: setFosAndTrellisData})
  const expression = new FosExpression(store, route) 

  const {
    customCollisionDetection,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
  } = getDragAndDropHandlers(expression, options, setFosAndTrellisData)

  // console.log('zoomroute', route)



  const [showAllActions, setShowAllActions] = React.useState(false)


  return (
    <DndContext 
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
      <div className={`w-full trellis-root `} >
      <div className={` bg-background/50 text-primary`}>
      <DefaultBreadcrumbsComponent 
        data={data}
        setData={setData}
        options={options}
        expression={expression}
        />
      
      <div className="w-full">
        <div>
          <div className={`border-b border-t`}>
            {/* <div> 
              <input 
                className="w-full p-2"
                type="text" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
              />
            </div>
          </div>
          <div> */}
            <div>
              <div>
                <div className={`flex-row flex w-full px-1 bg-card border`}>

                  <div className={`px-0 flex-grow overflow-x-hidden transition-all duration-500 ${showAllActions ? 'w-none' : ''}`}>
                    {/* <RootScreenHead nodeRoute={nodeRoute} options={options} data={data} setData={setData} /> */}
                  </div>

                </div>
              </div>
            </div>
              {/* <AddOption /> */}
          </div>
          <div>
            {<FosRowsComponent 
              data={data}
              setData={setData}
              options={options}
              expression={expression}
            />}
          </div>

        {/* {node.data.duration && <GanttComponent root={node} />} */}
        {/* <DataComponent node={node} trail={trail} forceUpdate={forceUpdate} /> */}
        {/* {node.data.cost && <CostComponent root={node} forceUpdate={forceUpdate} />} */}
        </div>
      </div>
    </div>
      </div>
    </DndContext>
  )
}



