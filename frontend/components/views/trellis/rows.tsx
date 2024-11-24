import React from 'react'

import { Button } from '@/frontend/components/ui/button';
import { TrashIcon, PlusCircledIcon, MinusIcon, PlusIcon, MagicWandIcon  } from '@radix-ui/react-icons'
import { DragOverlay } from '@dnd-kit/core';
import { BrainCircuit, CircleEllipsis, Wand } from "lucide-react";





import { RadioGroup, RadioGroupItem } from "@/frontend/components/ui/radio-group"
import { Label } from "@/frontend/components/ui/label"
import { AppState, FosReactOptions, FosPath } from '@/shared/types';

import { getActions } from '@/frontend/lib/actions';
import { getNodeOperations } from '@/shared/nodeOperations';
import { get } from 'http';
import { DefaultRowComponent } from './row';
import { getExpressionInfo } from '@/shared/dag-implementation/expression';
import { NodeRow } from '../../node/ExpressionRow';




export const FosRowsComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props  
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {
  

  const { nodeType, nodeChildren, isCollapsed, isBase, isRoot, isTodo, isWorkflow, isOption } = getExpressionInfo(nodeRoute, data.data)
  

  const [showMore, setShowMore] = React.useState(false)




  const items = nodeChildren.map(([childType, childId], index) => {


    return {
      id: `${childType}-${childId}`,
      data: { nodeRoute: [...nodeRoute, [childType, childId]], breadcrumb: false },
      breadcrumb: false
    }
  })
  // .filter(item => {
  //   if (isTask){
  //     return ["workflow", "todo", "option"].includes(item.data.node.getNodeType())
  //   } else if (isRoot){
  //     return ["todo", "query"].includes(item.data.node.getNodeType())
  //   } else if (isComment) {
  //     return ["comment"].includes(item.data.node.getNodeType())
  //   } else if (isDocument) {
  //     return ["document", "workflow", "option"].includes(item.data.node.getNodeType())
  //   }
  // })

  // console.log('rows', rows)

  

  if (isRoot) {
    return <TaskRows 
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />
  }else if (isOption) {
    return <OptionRowsCombined
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />
  } else if (isWorkflow) {
    return <TaskRows 
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />
  } else {
    throw new Error('node type rows not implemented')
  }

}



const OptionRowsCombined = ( { 
  data,
  setData,
  options: fosOptions,
  nodeRoute,
  ...props  
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {

  

  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
       data: state
    })
  }


  const {  locked, hasFocus, focusChar, isDragging, draggingOver, nodeDescription, getOptionInfo } = getExpressionInfo(nodeRoute, data.data)

  const { selectedIndex, nodeOptions } = getOptionInfo()
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
   } = getNodeOperations(fosOptions, data.data, setFosAndTrellisData, nodeRoute)
  
  

  
  
  // console.log('isRoot', isRoot, meta.trellisNode.getId())
  const handleChange = (value: string) => {
     setSelectedOption(parseInt(value))
  }

  return (<div className="flex flex-initial grow">
    <NodeRow 
      data={data}
      setData={setData}
      options={fosOptions}
      nodeRoute={nodeRoute}
    />

  </div>)




}



const OptionRowsExpanded = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props  
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {
  
 
  
  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
       data: state
    })
  }



  const { getOptionInfo, locked, hasFocus, focusChar, isDragging, getDragItem,
    draggingOver, nodeDescription, isRoot, childRoutes, isBase, children } = getExpressionInfo(nodeRoute, data.data)
  
  const { selectedIndex, nodeOptions } = getOptionInfo()

  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    
    addRowAsChild,
   } = getNodeOperations(options, data.data, setFosAndTrellisData, nodeRoute)
  
  


  // console.log('isRoot', isRoot, meta.trellisNode.getId())
  const handleChange = (value: string) => {
    setSelectedOption(parseInt(value))
 }


   const canPrompt = options.canPromptGPT && options.promptGPT

  const rowsEmpty = childRoutes.length === 0 || (childRoutes[0] && children[0]?.getExpressionInfo().nodeDescription === "")


  return (    <div className="pl-6">
    
    {childRoutes.length > 0 && 
      (<RadioGroup value={`${selectedIndex}`} onValueChange={handleChange}>
        {childRoutes.map((childRoute , i) => {

    

          const item = getDragItem(false)

          

          return (<div key={i} className={` `}>
          {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
            <div  className="flex w-full">
              <div className="px1" style={{
                paddingTop: '0.55rem',
              }}>
                <RadioGroupItem value={`${i}`} className="flex-initial rounded-md" />
              </div>
              {(<DefaultRowComponent
                nodeRoute={childRoute}
                options={options}
                data={data}
                setData={setData}
              />)}
              {/* <DragOverlay>
                {dragging === item.id ? <DragOverlayDisplay 
                  node={node}
                /> : null}
              </DragOverlay> */}
            </div>
          </div>)
      })}
      </RadioGroup>)
      }
  <div>
    {isBase && <div className='py-1' key={`-1`}>
      <Button 
        onClick={() => addRowAsChild()}
        className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
        // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
        >
        <PlusCircledIcon height={'1rem'} width={'1rem'}/>
      </Button>
      {canPrompt && rowsEmpty && !isRoot && <Button
        onClick={suggestOption}
        className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
      >
        <BrainCircuit height={'1rem'} width={'1rem'}/>
      </Button>}
      

    </div>}

  </div>
</div>)

}



const TaskRows = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props  
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {


  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
       data: state
    })
  }


  const { getChildrenOfType, isRoot, isBase, nodeDescription, children } = getExpressionInfo(nodeRoute, data.data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    
    suggestSteps,
    addRowAsChild,
  } = getNodeOperations(options, data.data, setFosAndTrellisData, nodeRoute)




  const canPrompt = options.canPromptGPT && options.promptGPT



  const activeChildRoutes = getChildrenOfType("workflow")

  const rowsEmpty = activeChildRoutes.length === 0 || (activeChildRoutes[0] && children[0]?.getExpressionInfo().nodeDescription === "")


  // console.log('taskRows', activeChildRoutes, activeChildRoutes.length, rowsEmpty)


  


  return (
    <div>
  
        {activeChildRoutes.length > 0
          ? activeChildRoutes.map((childExpr , i) => {
  
      
            return (<div key={i} className={` `}>
            {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
              <div  className="flex w-full">
                {(<DefaultRowComponent
  
                  nodeRoute={childExpr.route}
                  options={options}
                  data={data}
                  setData={setData}
                />)}
                {/* <DragOverlay>
                  {dragging === item.id ? <DragOverlayDisplay 
                    node={node}
                  /> : null}
                </DragOverlay> */}
              </div>
            </div>)
        })
        : <div className={`p-10`}>
          No workflows found            <span><Button 
            onClick={() => addRowAsChild('workflow')}
            className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
            // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
            >
            Create one
          </Button></span>
          </div>
        }
      <div>
        {isBase && <div className='py-1' key={`-1`}>
          <Button 
            onClick={() => addRowAsChild('workflow')}
            className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
            // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
            >
            <PlusCircledIcon height={'1rem'} width={'1rem'}/>
          </Button>
          {canPrompt && rowsEmpty && !isRoot && <Button
            onClick={() => suggestSteps()}
            className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
          >
            <BrainCircuit height={'1rem'} width={'1rem'}/>
          </Button>}
          

        </div>}
   
      </div>
    </div>)

}
