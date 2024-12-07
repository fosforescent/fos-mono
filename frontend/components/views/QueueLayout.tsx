import React, { useEffect, useState } from 'react';
import { CheckSquare, MessageSquare, PenSquare, Send, SendHorizonal, SendHorizonalIcon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/frontend/components/ui/card';
import { Input } from '@/frontend/components/ui/input';
import { Button } from '@/frontend/components/ui/button';
import { ScrollArea } from '@/frontend/components/ui/scroll-area';
import { AppState, FosReactGlobal, FosPath, AppStateLoaded } from '@/shared/types';
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

import { FosExpression } from '@/shared/dag-implementation/expression';
import { getGroupFieldNode } from '@/shared/dag-implementation/primitive-node';
import { getGroupFromRoute } from '@/shared/utils';
import { FosStore } from '@/shared/dag-implementation/store';
import { ExpressionInput } from '../expression/ExpressionInput';
import { ExpressionCard } from '../expression/ExpressionCard';





const QueueView = () => {


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

  
  
  
  const store = new FosStore({ fosCtxData: data.data})

  const expression = new FosExpression(store, route)
  
  

  const expressionToUse = expression.isAlias() ? expression.getChildren().find((expr) => {
    console.log('searching for alias child')
    return expr.instructionNode.getId() === expression.store.primitive.targetConstructor.getId()
  }) : expression

  if (!expressionToUse) {
    throw new Error('No expression to use')
  }




  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
      data: state
    })
  }

  const setCurrentView = () => {

  }

  const setCurrentModule = () => {

  }


  const [routesToShow, setRoutesToShow] = useState<FosPath[]>([])

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




  useEffect(() => {
    const activity = data.data.trellisData.activity
    expressionToUse.getAllDescendentsForActivity(data.data.trellisData.activity)


    console.log("all Store nodes", store.table, store)


    setRoutesToShow(expressionToUse.getAllDescendentsForActivity(activity))
    
  }, [data.data.trellisData.activity])

  const focusRoute = data.data.trellisData.focusRoute


  
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
  } = getDragAndDropHandlers(expressionToUse, options, setFosAndTrellisData)

  


  useEffect(() => {
 
    var objDiv = document.getElementById("scrolldiv");
    if (!objDiv) return
    objDiv.scrollTop = objDiv?.scrollHeight;   
    // if (scrollRef.current) {
    //   scrollRef.current.scrollTo(0, 0);
    // }
  }, [route]);



  console.log('queueView', data, expressionToUse)
  console.log('queueView --- expression', data, expressionToUse)



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
        expression={expression}
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
          <ScrollArea id="scrolldiv" className="flex-1 p-0 w-full"
                   style={{height: 'calc(100vh - 20rem)'}}
                   >
            
              {routesToShow.map((routeToShow, i) => {
                return (<div className="space-y-4 w-full p-4"><ExpressionCard
                  key={i}
                  data={data}
                  setData={setData}
                  options={options}
                  expression={new FosExpression(store, routeToShow)}
                  /></div>)
              })}

            
          </ScrollArea>

              <QueueInput 
                expression={expression}
                setData={setFosAndTrellisData}
                options={options}
                data={data}
                // onAnimationEnd={handleAnimationEnd}
                />

          </div>
          
      </div>
    </DndContext>
  );
};

export default QueueView




const QueueInput = ({ 
  setData,
  options,
  data,
  expression
} : {
  setData: (state: AppStateLoaded["data"]) => void
  options: FosReactGlobal
  data: AppStateLoaded
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



  return (<ExpressionInput
    expression={expression}
    setData={setData}
    options={options}
    data={data}
  />)

}