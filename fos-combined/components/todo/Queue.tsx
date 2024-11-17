import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppState, FosReactGlobal, FosRoute } from '@/fos-combined/types';
import { useProps } from '@/fos-combined/App';
import { getAvailableTasks, getNodeInfo, getRootNodes } from '@/fos-combined/lib/utils';
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
import { getActions } from '@/fos-combined/lib/actions';
import { DefaultBreadcrumbsComponent } from '../breadcrumbs/breadcrumbs';


interface Message {
  id: string;
  text: string;
  timestamp: string;
}

interface AnimatedMessagesState {
  messages: Message[];
  animatingMessages: string[];
}

interface MessageCardProps {
  message: Message;
  isAnimating: boolean;
  // onAnimationEnd: (messageId: string) => void;
}

const MessageCard: React.FC<MessageCardProps> = ({ 
  message, 
  isAnimating, 
  // onAnimationEnd 
}) => (
  <Card 
    className={`transform transition-all duration-500 ${
      isAnimating
        ? '-translate-y-full opacity-0'
        : 'translate-y-0 opacity-100'
    }`}
    // onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      <div className="text-gray-800">{message.text || "This Todo is empty"}</div>
      {/* <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div> */}
    </CardContent>
  </Card>
);

const TodoQueue = () => {





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


  const rootTodos = getRootNodes(data, 'todo');


  const allTodos: FosRoute[] = rootTodos.todos.flatMap((todoRoute) => getAvailableTasks(data, todoRoute));


  console.log('rootTodos', rootTodos, allTodos)

  const messages = allTodos.map((todoRoute: FosRoute) => {
    const { nodeDescription, nodeData, nodeId } = getNodeInfo(todoRoute, data);
    return {
      id: nodeId,
      text: nodeDescription,
      timestamp: new Date().toLocaleTimeString(),
    }
  })
  


  const [newMessage, setNewMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // const message: Message = {
    //   id: Date.now(),
    //   text: newMessage,
    //   timestamp: new Date().toLocaleTimeString(),
    // };


    setNewMessage('');
  };

  const handleAnimationEnd = (messageId: number): void => {
 
    
  };

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
  

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      ><div>
      <DefaultBreadcrumbsComponent 
        data={data}
        setData={setData}
        options={options}
        nodeRoute={route}
        />
        <div className="flex flex-col w-screen border-t"
          style={{ height: 'calc(100vh - 4rem)' }}
          >
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  isAnimating={false}
                  // onAnimationEnd={handleAnimationEnd}
                />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button type="submit" variant="default">
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default TodoQueue;