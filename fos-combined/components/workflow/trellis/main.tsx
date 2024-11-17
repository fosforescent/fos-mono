import React, { ReactElement, useEffect, useState } from 'react'

import { HomeIcon } from '@radix-ui/react-icons'
import { Button } from "@/components/ui/button"
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
import { DefaultBreadcrumbsComponent } from '../../breadcrumbs/breadcrumbs'
import { DefaultRootComponent } from './root'
import { useProps } from '@/fos-combined/App';




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

  const actions = React.useMemo(() => {
    return getActions(options, data, setData)
  }, [data, setData])


  const theme = options?.theme ? options.theme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"


  const [activeId, setActiveId] = useState< { id: string, nodeRoute: FosRoute, breadcrumb: boolean } | null>(null);

  const [dragOverInfo, setDragOverInfo] = useState<{ id: string, position: 'above' | 'below' | 'on' | 'breadcrumb', nodeRoute: FosRoute } | null>(null);

  useEffect(() => {
    // console.log('dragging', activeId?.id, state.draggingNode, 'dragging Over', dragOverInfo?.id, state.draggingOverNode)
    // console.log('dragging', dragOverInfo?.position)

    const dragNode =  (activeId?.id || null) !== data.data.trellisData.draggingNode

    if ( 
      (activeId?.id || null) !== data.data.trellisData.draggingNode 
      ||  (dragOverInfo?.id || null) !== data.data.trellisData.draggingOverNode
    ) {
      actions.setDrag(activeId?.nodeRoute || null, dragOverInfo?.nodeRoute || null)
    }


  }, [activeId, dragOverInfo])


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
  
  const getDragOverInfo = (over: Over | null, active: Active | null): {
    id: string;
    position: 'above' | 'below' | 'on' | 'breadcrumb';
    nodeRoute: FosRoute;
  } | null => {
    if (!over) {
      return null
    }
    if (!active) {
      return null
    }
    const currentActive = active.rect.current.translated;
    if (!currentActive) {
      return null
    }

    if (over.data.current?.breadcrumb) {
      return { id: over.id.toString(), position: 'breadcrumb', nodeRoute: over.data.current?.nodeRoute }
    }

    const currentPosition = dragOverInfo?.position || "on";

    const correction = currentPosition === 'below' ? 1 : currentPosition === 'above' ? -1 : 0;
    

    const activeCenter = currentActive.top + (currentActive.height / 2) + (correction * 10);

    const overCenter = over.rect.top + (over.rect.height / 2);

    const onHalfHeight = currentActive.height / 7;

    

    const above = activeCenter < overCenter - onHalfHeight;
    const below = activeCenter > overCenter + onHalfHeight;

    // console.log('draginfo', activeCenter, overCenter, onHalfHeight, above, below, currentPosition, correction)

    // const topYPos = over.rect.top + (over.rect.height / 2 * (currentActive.left - over.rect.left) / over.rect.width);
    // const bottomYPos = over.rect.top + over.rect.height - (over.rect.height / 2 * (currentActive.left - over.rect.left) / over.rect.width);

    // Corrected conditions
    // const above = activeCenter < topYPos;
    // const below = activeCenter > bottomYPos;
    const on = !above && !below; // Simplified check for 'on'

    // console.log('situation', above, below, on, topYPos, bottomYPos);
    // console.log('active', activeCenter);
    // console.log('target', topYPos, bottomYPos);
    if (above) {
      // console.log('above', over.id);
    }
    if (below) {
      // console.log('below', over.id);
    }
    if (on) {
      // console.log('on', over.id);
    }


    const position = on ? 'on' : above ? 'above' : 'below' as "above" | "below" | "on" | 'breadcrumb'; // Adjusted ordering and removal of unnecessary null check
    const newDragOverInfo = { id: over.id.toString(), position, nodeRoute: over.data.current?.nodeRoute };

    return newDragOverInfo;
  };

  function handleDragStart(event: DragStartEvent) {
    console.log('drag start')
    const { active } = event;
    if (active && active.data.current) {
      setActiveId({ id: active.id.toString(), nodeRoute: active.data.current.node, breadcrumb: active.data.current?.breadcrumb });
    }
    // console.log('drag start', active.id, active.data, event)
  }
  
  function handleDragOver(event: DragOverEvent) {
    const { over, active } = event;
    // console.log('drag over', over, active, event, dragOverInfo)
    
    const dragInfo = getDragOverInfo(over, active);
    if (dragInfo) {
      if (dragInfo.id !== dragOverInfo?.id || dragInfo.position !== dragOverInfo?.position) {
        setDragOverInfo(dragInfo);
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    // console.log('drag end', active, over, event, dragOverInfo)
    // const dragInfo = getDragOverInfo(over, active);
    // setDragOverInfo(dragInfo);
    const dragInfo = dragOverInfo
    // console.log('dragInfo', dragOverInfo)
    if (!over || !over.data.current){
      setActiveId(null);
      setDragOverInfo(null);
      return
    }
    if(!active || !active.data.current){
      setActiveId(null);
      setDragOverInfo(null);
      return
    }
    
    if (active.id === over?.id) {
      setActiveId(null);
      setDragOverInfo(null);
      return
    }
    if(!dragOverInfo){
      throw new Error('no dragInfo, but over is not null')
    }

    const activeNode = active.data.current.node
    const overNode = over.data.current.node

    console.log('dragInfo', dragInfo)

    if (dragInfo?.position === 'on' || dragInfo?.position === 'breadcrumb') {
      activeNode.moveNodeToTopChild(overNode)
    } else if (dragInfo?.position === 'above') {
      activeNode.moveNodeToUpSibling(overNode)
    } else if (dragInfo?.position === 'below') {
      activeNode.moveNodeToDownSibling(overNode)
    }

    

    // const reorderItems = (items: (string | null)[]) => {
    //   const oldIndex = items.indexOf(active.id);
    //   const newIndex = items.indexOf(over?.id || null);
    //   console.log('reorderItems', oldIndex, newIndex, items, active.id, over?.id)
      
    //   return arrayMove(items, oldIndex, newIndex);
    // };

    // const nodesWithId = node.getOptionContent().content.map((edge: [string, string]) => {
    //   console.log('edge', edge)
    //   return edge.join('-')
    // })
    // const newNodesWithId = reorderItems(nodesWithId)

    // console.log('newNodesWithId', newNodesWithId)

    // const newContent = newNodesWithId.filter((edge: string | null) => edge !== null).map((edge: string | null) => (edge as string).split('-')) as [string, string][]

    // console.log('newContent', newContent)
    // const nodeOptionData = node.getOptionContent()
    
    // const newContext = context.updateNodeOptionData(trail, { ...nodeOptionData, content: newContent })

    // context.setNodes(newContext.data.nodes)

    
    setActiveId(null);
    setDragOverInfo(null);
    actions.clearDraggingNode()
  }
    
  const customCollisionDetection = (args: {
    active: Active;
    collisionRect: ClientRect;
    droppableContainers: DroppableContainer[];
    pointerCoordinates: Coordinates | null;
  }):Collision[] => {
    if (!args.pointerCoordinates) {
      return [];
    }

    // console.log('customCollisionDetection', args)
  
    const { x: pointerX, y: pointerY } = args.pointerCoordinates;
  
    // Find all containers that collide vertically
    const verticalCollisions = args.droppableContainers.filter((container) => {
      if (!container.rect.current) return false;
      const { top, bottom } = container.rect.current;
      return pointerY >= top && pointerY <= bottom;
    });
  
    if (verticalCollisions.length === 0) {
      return [];
    }
  
    // If there's only one vertical collision, return it
    if (verticalCollisions.length === 1) {
      return verticalCollisions[0] ? [{ id: verticalCollisions[0].id }] : [];
    }
  
    // console.log('multiple vertical collisions', verticalCollisions)
    // For multiple collisions (likely breadcrumbs), find the closest one horizontally
    const closestHorizontal = verticalCollisions.reduce((closest, current) => {
      if (!current.rect.current) return closest;
      const currentCenter = current.rect.current.left + current.rect.current.width / 2;
      const currentDistance = Math.abs(currentCenter - pointerX);
      
      if (!closest || currentDistance < closest.distance) {
        return { container: current, distance: currentDistance };
      }
      return closest;
    }, null as { container: DroppableContainer, distance: number } | null);
  
    if (closestHorizontal) {
      return [{ id: closestHorizontal.container.id }];
    }
  
    return [];
  };
  


  // console.log('zoomroute', route)

  return (
    <DndContext 
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
      <div className={`w-full trellis-root ${theme}`} >
        <div className={` bg-background/50 text-primary`}>
          <DefaultBreadcrumbsComponent 
            data={data}
            setData={setData}
            options={options}
            nodeRoute={route}
            />

          <div className="w-full">
            {<DefaultRootComponent 
              data={data}
              setData={setData}
              options={options}
              nodeRoute={route}
              />}
          </div>
        </div>
      </div>
    </DndContext>
  )
}


export default MainView

