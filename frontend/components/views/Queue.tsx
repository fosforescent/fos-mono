import React, { useEffect, useState } from 'react';
import { Send, SendHorizonal, SendHorizonalIcon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/frontend/components/ui/card';
import { Input } from '@/frontend/components/ui/input';
import { Button } from '@/frontend/components/ui/button';
import { ScrollArea } from '@/frontend/components/ui/scroll-area';
import { AppState, FosReactGlobal, FosRoute } from '@/frontend/types';
import { useProps } from '@/frontend/App';
import { getAvailableTasks, getNodeInfo, getNodesOfTypeForPath, } from '@/frontend/lib/utils';
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
    nodeRoute: FosRoute
    setData: (state: AppState) => void
  } = useProps()




  const actions = React.useMemo(() => {
    return getActions(options, data, setData)
  }, [data, setData])


  const routeNodes = getNodesOfTypeForPath(data.data, route);





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





  const comments = routeNodes.comments()



  return (
    <div>
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
                <QueueCard
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
   
  );
};

export default QueueView


const QueueCard = ({ 
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
}) => {



  // const { getCommentInfo } = getNodeInfo(route, data)

  return (
  <Card 
    className={`transform transition-all duration-500 ${'translate-y-0 opacity-100'}`}
    // onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      <div className="text-gray-800">{text || "This Todo is empty"}</div>
      {/* <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div> */}
    </CardContent>
    <CardFooter className="flex items-center justify-between p-4">
      <Button variant="default" size="sm">
        <SendHorizonal />   
      </Button>
    </CardFooter>
  </Card>
  )
}