import React from 'react'

import { Button } from '@/frontend/components/ui/button';
import { TrashIcon, PlusCircledIcon, MinusIcon, PlusIcon, MagicWandIcon  } from '@radix-ui/react-icons'
import { DragOverlay } from '@dnd-kit/core';
import { BrainCircuit, CircleEllipsis, Wand } from "lucide-react";





import { RadioGroup, RadioGroupItem } from "@/frontend/components/ui/radio-group"
import { Label } from "@/frontend/components/ui/label"
import { FosReactOptions, FosPath, AppStateLoaded } from '@/shared/types';

import { getActions } from '@/frontend/lib/actions';

import { get } from 'http';
import { DefaultRowComponent } from './row';
import { FosExpression } from '@/shared/dag-implementation/expression';
import { ExpressionRow } from '../../expression/ExpressionRow';
import { FosStore } from '@/shared/dag-implementation/store';
import { suggestTaskOptions } from '@/shared/suggestOption';
import { suggestTaskSteps } from '@/shared/suggestSteps';




export const FosRowsComponent = ({
  data,
  setData,
  options,
  expression,
} : {
  data: AppStateLoaded
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {
  


  
  

  const [showMore, setShowMore] = React.useState(false)


  const nodeChildren = expression.getTargetChildren()


  const items = nodeChildren.map((childExpr, index) => {

    const nodeRoute = childExpr.route
    const nodeType = childExpr.instructionNode.getId()
    const nodeId = childExpr.targetNode.getId()

    return {
      id: `${childExpr.dragLabel()}`,
      data: { nodeRoute: [...nodeRoute, [nodeType, nodeId]], breadcrumb: false },
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

  

  if (expression.isRoot()) {
    return <TaskRows 
      options={options}
      data={data}
      setData={setData}
      expression={expression}
    />
  }else if (expression.isOption()) {
    return <OptionRowsCombined
      options={options}
      data={data}
      setData={setData}
      expression={expression}
    />
  } else if (expression.isWorkflow()) {
    return <TaskRows 
      options={options}
      data={data}
      setData={setData}
      expression={expression}
    />
  } else {
    throw new Error('node type rows not implemented')
  }

}



const OptionRowsCombined = ({
  data,
  setData,
  options,
  expression,
} : {
  data: AppStateLoaded
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {

  

  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }

  


  
  
  // console.log('isRoot', isRoot, meta.trellisNode.getId())
  const handleChange = (value: string) => {
    expression.setSelectedOption(parseInt(value))
  }

  return (<div className="flex flex-initial grow">
    <ExpressionRow    
      setData={setData}
      options={options}
      data={data}
      expression={expression}
    
    />

  </div>)




}



const OptionRowsExpanded = ({
  data,
  setData,
  options,
  expression,
} : {
  data: AppStateLoaded
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {
  
 
  
  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }






  // console.log('isRoot', isRoot, meta.trellisNode.getId())
  const handleChange = (value: string) => {
    expression.setSelectedOption(parseInt(value))
  }


  const children = expression.getTargetChildren()
  
  const childRoutes = expression.childRoutes()

  const canPrompt = options.canPromptGPT && options.promptGPT

  const rowsEmpty = childRoutes.length === 0 || (childRoutes[0] && children[0]?.getDescription() === "")

  const { selectedIndex } = expression.getOptionInfo()



  return (    <div className="pl-6">
    
    {childRoutes.length > 0 && 
      (<RadioGroup value={`${selectedIndex}`} onValueChange={handleChange}>
        {childRoutes.map((childRoute , i) => {

    

          const item = expression.getDragItem(false)

          const childExpr = new FosExpression(expression.store, childRoute)

          return (<div key={i} className={` `}>
          {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
            <div  className="flex w-full">
              <div className="px1" style={{
                paddingTop: '0.55rem',
              }}>
                <RadioGroupItem value={`${i}`} className="flex-initial rounded-md" />
              </div>
              {(<DefaultRowComponent
                expression={childExpr}
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
    {expression.isBase() && <div className='py-1' key={`-1`}>
      <Button 
        onClick={() => expression.addRowAsChild()}
        className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
        // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
        >
        <PlusCircledIcon height={'1rem'} width={'1rem'}/>
      </Button>
      {canPrompt && rowsEmpty && !expression.isRoot() && <Button
        onClick={() => suggestTaskOptions(expression, options)}
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
  expression,
} : {
  data: AppStateLoaded
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {


  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }
  
  const children = expression.getTargetChildren()


  const canPrompt = options.canPromptGPT && options.promptGPT



  const activeChildRoutes = expression.childRoutes()

  const rowsEmpty = activeChildRoutes.length === 0 || (activeChildRoutes[0] && children[0]?.getDescription() === "")


  // console.log('taskRows', activeChildRoutes, activeChildRoutes.length, rowsEmpty)


  


  return (
    <div>
  
        {activeChildRoutes.length > 0
          ? activeChildRoutes.map((childRoute , i) => {
  
            const childExpr = new FosExpression(expression.store, childRoute)

            return (<div key={i} className={` `}>
            {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
              <div  className="flex w-full">
                {(<DefaultRowComponent
                  expression={childExpr}  
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
            onClick={() => expression.addRowAsChild(expression.store.primitive.workflowField)}
            className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
            // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
            >
            Create one
          </Button></span>
          </div>
        }
      <div>
        {expression.isBase() && <div className='py-1' key={`-1`}>
          <Button 
            onClick={() => expression.addRowAsChild(expression.store.primitive.workflowField)}
            className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
            // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
            >
            <PlusCircledIcon height={'1rem'} width={'1rem'}/>
          </Button>
          {canPrompt && rowsEmpty && !expression.isRoot() && <Button
            onClick={() => suggestTaskSteps(expression, options)}
            className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
          >
            <BrainCircuit height={'1rem'} width={'1rem'}/>
          </Button>}
          

        </div>}
   
      </div>
    </div>)

}
