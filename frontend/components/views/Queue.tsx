import React, { useEffect, useState } from 'react';
import { Send, SendHorizonal, SendHorizonalIcon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/frontend/components/ui/card';
import { Input } from '@/frontend/components/ui/input';
import { Button } from '@/frontend/components/ui/button';
import { ScrollArea } from '@/frontend/components/ui/scroll-area';
import { AppState, FosReactGlobal, FosPath } from '@/shared/types';
import { useProps } from '@/frontend/App';

import {

  DndContext, 

  KeyboardSensor,
  PointerSensor,
  TouchSensor, 
  useSensor,
  useSensors,


} from '@dnd-kit/core';
import {

  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Coordinates
} from '@dnd-kit/utilities';

import { DroppableContainersMap } from '@dnd-kit/core/dist/store/constructors';
import { getActions } from '@/frontend/lib/actions';
import { DefaultBreadcrumbsComponent } from '../breadcrumbs/breadcrumbs';
import { getDragAndDropHandlers } from '../drag-drop';

import { NodeCard } from '../node/NodeRow';
import { getExpressionInfo } from '@/shared/dag-implementation/expression';




const QueueView = () => {


  const { 
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  } : {
    options: FosReactGlobal
    data: AppState
    nodeRoute: FosPath
    setData: (state: AppState) => void
  } = useProps()




  const actions = React.useMemo(() => {
    return getActions(options, data, setData)
  }, [data, setData])



  const { 
    getNodesOfType
  } = getExpressionInfo(route, data.data)


  const routeNodes = getNodesOfType()
/**
 * Depending on what is being focused on, the input at the bottom of the queue will change
 * 
 * For instance, if the focus is on a subtask, the input will show suggested links
 * If the focus is 
 * 
 * 
 * 
 * 
 */


  const focusRoute = data.data.trellisData.focusRoute


  

  const comments = routeNodes.comments()

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
              {comments.map((commentRoute) => (
                <NodeCard
                  data={data}
                  setData={setData}
                  options={options}
                  nodeRoute={commentRoute}
                  // onAnimationEnd={handleAnimationEnd}
                />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-4">
              <QueueInput 
                data={data}
                setData={setData}
                options={options}
                nodeRoute={focusRoute}
                // onAnimationEnd={handleAnimationEnd}
                />

          </div>
        </div>
    </DndContext>
  );
};

export default QueueView




const QueueInput = ({ 
  data,
  setData,
  options,
  nodeRoute: route,
  ...props
} : {
  options: FosReactGlobal
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {






  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

  // const { text, userProfiles,  } = getCommentInfo()
  // Ultimately this component is used to create new todos, comments, and other 
  // items under the given route.  

  // we need to be able to change types and have convenient ways of entering appropriate
  // info for those types.. 

  // action will be that a node is not added until sent
  // other users recieve the node in their queue under the circumstances that
  // (1) it requires approval because it's on one of their own nodes
  // (2) it gets sorted to the top for varoius reasons (in the queue top is bottom)

  


    // const message: Message = {
    //   id: Date.now(),
    //   text: newMessage,
    //   timestamp: new Date().toLocaleTimeString(),
    // };


  };


  const [newMessage, setNewMessage] = useState('')

  // const { setDescription } = getNodeOperations(options, data, setData, route)



  return (<form onSubmit={handleSubmit} className="flex gap-2">
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
</form>)

}