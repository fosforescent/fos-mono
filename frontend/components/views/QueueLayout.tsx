import React, { useEffect, useState } from 'react';
import { CheckSquare, MessageSquare, PenSquare, Send, SendHorizonal, SendHorizonalIcon } from 'lucide-react';
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

import { NodeCard } from '../node/ExpressionRow';
import { FosExpression, getExpressionInfo } from '@/shared/dag-implementation/expression';
import { getGroupFieldNode } from '@/shared/dag-implementation/primitive-node';
import { getGroupFromRoute } from '@/shared/utils';
import { FosStore } from '@/shared/dag-implementation/store';
import { NodeActiviyInput } from '../node/ExpressionInput';
import { ExpressionCard } from '../node/ExpressionCard';




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



  const actions = getActions(options, data, setData)

  
  console.log('queueview', route, data)

  const store = new FosStore(data.data)

  const expression = new FosExpression(store, route)

  const { 
    getNodesOfType, getAllTodos, getAllComments, currentActivity
  } = getExpressionInfo(route, data.data)


  const routeNodes = getNodesOfType()



  const setCurrentView = () => {

  }

  const setCurrentModule = () => {

  }

  const itemsToShow = ((activity) => {
    if (activity === "todo" ){
      getAllTodos()
    } else if (activity === "comment") {
      getAllComments()
    }
  })(currentActivity)



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

  


  useEffect(() => {
 
    var objDiv = document.getElementById("scrolldiv");
    if (!objDiv) return
    objDiv.scrollTop = objDiv?.scrollHeight;   
    // if (scrollRef.current) {
    //   scrollRef.current.scrollTo(0, 0);
    // }
  }, [route]);


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
      <div className={`w-screen  flex flex-col flex-start`}
        style={{height: 'calc(100% - 6rem)'}}
      >

        <div className="flex flex-row w-screen border-b border-t p-4 w-full"
        >
          <Button ><CheckSquare /></Button>
          <Button ><PenSquare /></Button>
          <Button ><MessageSquare /></Button>

        </div>
          <div className="p-4  w-full"
                    style={{height: 'calc(100% - 30rem)'}}

          >
          <ScrollArea id="scrolldiv" className="flex-1 p-0 w-screen "
                   style={{height: 'calc(100vh - 20rem)'}}
                   >
            <div className="space-y-4">
              {comments.map((commentRoute, i) => {
                return (<ExpressionCard
                  key={i}
                  expression={new FosExpression(store, commentRoute)}
                  />)
              })}

            </div>
          </ScrollArea>

              <QueueInput 
                expression={expression}
                // onAnimationEnd={handleAnimationEnd}
                />

          </div>
          
      </div>
    </DndContext>
  );
};

export default QueueView




const QueueInput = ({ 
  expression
} : {
  expression: FosExpression
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


  // const { setDescription } = getNodeOperations(options, data, setData, route)



  return (<NodeActiviyInput
    expression={expression}
  />)

}