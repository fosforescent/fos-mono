import { Active, Collision, DragEndEvent, DroppableContainer, Over } from "@dnd-kit/core"
import { getNodeOperations } from "../lib/nodeOperations"
import { AppState, FosReactOptions, FosRoute } from "../types"
import { getActions } from "../lib/actions"
import { ClientRect, Coordinates, DragOverEvent, DragStartEvent } from "@dnd-kit/core/dist/types"
import { getDragItem, getNodeInfo } from "../lib/utils"



import { Transform } from "@dnd-kit/utilities"


export const getDragAndDropHandlers = (options: FosReactOptions, data: AppState, setData: (newData: AppState) => void) => {

  const actions = getActions(options, data, setData)

  const {
    dragging: draggingInfo,
    dragOverInfo: dragOverInfo,
  } = actions.getDragInfo()

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    // console.log('drag end', active, over, event, dragOverInfo)
    // const dragInfo = getDragOverInfo(over, active);
    // setDragOverInfo(dragInfo);
    const dragInfo = dragOverInfo
    // console.log('dragInfo', dragOverInfo)
    if (!over || !over.data.current){
      actions.setDragInfo({
        dragging: draggingInfo,
        dragOverInfo: null
      });
      return
    }
    if(!active || !active.data.current){
      actions.setDragInfo({
        dragging: null,
        dragOverInfo: null
      });
  
      return
    }
    
    if (active.id === over?.id) {
      actions.setDragInfo({
        dragging: null,
        dragOverInfo: null
      });
  
      return
    }
    if(!dragOverInfo){
      throw new Error('no dragInfo, but over is not null')
    }
  

    console.log('resolve Drag', dragInfo)
  

    const activeNode = active.data.current.nodeRoute
    const overNode = over.data.current.nodeRoute



    
    const resolveDrag = async (options: FosReactOptions, data: AppState, setData: (newData: AppState) => void) => {


  
      const newData = {
        ...data,
        data: {
          ...data.data,
          trellisData: {
            ...data.data.trellisData,
            dragInfo: {
              dragging: null,
              dragOverInfo: null
            }
          }
        }
      }
    
    
      const { moveAboveRoute, moveBelowRoute, moveToTopChildOfRoute } = getNodeOperations(options, newData, setData, activeNode)
    
    
      if (dragInfo?.position === 'on' || dragInfo?.position === 'breadcrumb') {
        await moveToTopChildOfRoute(overNode)
      } else if (dragInfo?.position === 'above') {
        await moveAboveRoute(overNode)
      } else if (dragInfo?.position === 'below') {
        await moveBelowRoute(overNode)
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
    
    }


  
    resolveDrag(options, data, setData)
  
  
  
  
  
  
  
  
  
  }
  

  function handleDragStart(event: DragStartEvent) {
    console.log('drag start')
    const { active } = event;
    if (active && active.data.current) {
      actions.setDragInfo({
        dragOverInfo, 
        dragging: { 
          id: active.id.toString(), 
          nodeRoute: active.data.current.node, 
          breadcrumb: active.data.current?.breadcrumb 
        }
    });
    }
    console.log('drag start', active.id, active.data, event)
  }

  function handleDragOver(event: DragOverEvent) {
    const { over, active } = event;
    console.log('drag over', over, active, event, dragOverInfo)
    
    const dragInfo = getDragOverInfo(over, active);
    if (dragInfo) {
      if (dragInfo.id !== dragOverInfo?.id || dragInfo.position !== dragOverInfo?.position) {
        actions.setDragInfo({
          dragging: draggingInfo, 
          dragOverInfo: dragInfo
        });
      }
    }
  }


  


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
}






  const getNodeDragInfo = (nodeRoute: FosRoute) => {


    const { locked, getOptionInfo,
      hasFocus, focusChar, isDragging, draggingOver, 
      nodeDescription, isRoot, childRoutes, isBase,
      nodeType, nodeId, disabled, depth, isCollapsed, 
      isTooDeep
    } = getNodeInfo(nodeRoute, data)

       
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

    

  // console.log('transformstyle', transform, CSS.Transform.toString(transform))
    // transition,)


    const dragItem = getDragItem(nodeRoute, false)


    const isDropping = dragOverInfo && dragOverInfo.id === nodeItemId
    // Saving this in case it turns out we need isOver
    // const isDropping = isOver && dragOverInfo && dragOverInfo.id === nodeItemId
  
  
    const draggingOn = isDropping && dragOverInfo?.position === 'on'
    // Saving this in case it turns out we need isOver
    // const draggingOn = !!isOver && dragOverInfo?.position === 'on'
    
    const dropOnStyle = draggingOn ? {
      backgroundColor: 'rgba(230, 220, 200, .7)',
      // transform: 'scale(1.05)',
    } : {}
  
    const draggingStyle = dragging?.id === nodeItemId ? {
      opacity: 0.5
    } : {}
  
    const isNotDragging = dragging ? (dragging.id !== nodeItemId) : true
  
  


    // console.log('isDropping', isDropping, dragOverInfo, nodeItemId, isOver, dragItem?.id, dragging?.id, isNotDragging, draggingOn, dragOverInfo?.position, draggingOn, dropOnStyle, draggingStyle, dragStyle)
    const getStyles = (transform: Transform | null) => {
      
      
      const dragStyle = ({
        transform: transform ? `translate3d( ${transform?.x}px, ${transform?.y}px, 0) scaleY(${transform?.scaleY || 1})` : undefined,
        // transition,
        // width: `calc(width * ${transform?.scaleX || 1})`,
        ...(dragging && dragging.id !== `${dragItem?.id}`) ? {opacity: 0.9} : {}
      })
    
  
    
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


      return {
        dragStyle,
        dropStyle,
      }
    }
  
    // console.log('row', isDragging, dragging, dragOverInfo, isOver, draggingOn)
    const useDraggableArg = {id: nodeItemIdMaybeParent, data: { nodeRoute: isDraggingParent ? dragging.nodeRoute : nodeRoute } }

    const useDroppableArg = {
      id: nodeItemIdMaybeParent,
      disabled: isDraggingParent || disabled,
      data: { nodeRoute }
    }


    return {
      getStyles,
      draggingStyle,
      draggingOn,
      dropOnStyle,
      isDropping,
      isNotDragging,
      isDraggingParent,
      nodeItemIdMaybeParent,
      nodeItemId,
      isDragging,
      dragging,      
      disabled,
      useDraggableArg,
      useDroppableArg

      
    }



  }










  return {
    handleDragEnd,
    handleDragStart,
    handleDragOver,
    customCollisionDetection,
    getNodeDragInfo,
  }


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
  

