import React from 'react'

import { Button } from '@/components/ui/button';
import { TrashIcon, PlusCircledIcon, MinusIcon, PlusIcon, MagicWandIcon  } from '@radix-ui/react-icons'
import { DragOverlay } from '@dnd-kit/core';
import { useWindowSize } from "../../window-size";
import { BrainCircuit, CircleEllipsis, Wand } from "lucide-react";


import { ComboboxEditable } from '../../combobox/comboboxEditable';

import { suggestOption } from '../../../lib/suggestOption';
import { suggestSteps } from '../../../lib/suggestSteps';

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { AppState, FosReactOptions, FosRoute } from '@/fos-combined/types';
import { getDragItem, getNodeDescription, getNodeInfo } from '@/fos-combined/lib/utils';
import { getActions } from '@/fos-combined/lib/actions';
import { getNodeOperations } from '@/fos-combined/lib/nodeOperations';
import { get } from 'http';
import { DefaultRowComponent } from './row';




export const FosRowsComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props  
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {
  

  const { nodeType, nodeChildren, isCollapsed, isBase } = getNodeInfo(nodeRoute, data)
  

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

  

  return {
    "workflow": <TaskRows 
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />,
    "option": (isCollapsed && !isBase) ? <OptionRowsCombined
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    /> : <OptionRowsExpanded
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />,
    "root": <TaskRows 
      nodeRoute={nodeRoute}
      options={options}
      data={data}
      setData={setData}
    />,
  }[nodeType] || <></>
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
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {

  
  const { selectedIndex, nodeOptions, locked, hasFocus, focusChar, isDragging, draggingOver, nodeDescription } = getNodeInfo(nodeRoute, data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    getFocus, 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
   } = getNodeOperations(fosOptions, data, setData, nodeRoute)
  
  

  
  





  // console.log('isRoot', isRoot, meta.trellisNode.getId())


  return (<div className="flex flex-initial grow">
    <ComboboxEditable 
      className='w-full bg-transparent'
      handleTextEdit={setFocusAndDescription}
      handleChange={setSelectedOption}
      suggestOption={suggestOption}
      getFocus={getFocus}
      hasFocus={hasFocus}
      focusChar={focusChar}
      deleteOption={deleteOption}
      // deleteRow={deleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={keyDownEvents}
      onKeyUp={keyUpEvents}
      selectedIndex={selectedIndex}
      values={nodeOptions}
      locked={fosOptions.locked || false }
      setFocus={setFocus}
      // defaultValue={selectedNodeDescription}
      defaultValue={selectedIndex.toString()}
      addOption={addOption}
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
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {
  
 
  
  const { selectedIndex, nodeOptions, locked, hasFocus, focusChar, isDragging, draggingOver, nodeDescription, isRoot, childRoutes, isBase } = getNodeInfo(nodeRoute, data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    getFocus, 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    suggestOptions,
    addRow,
   } = getNodeOperations(options, data, setData, nodeRoute)
  
  




  const rowsEmpty = childRoutes.length === 0 || (childRoutes[0] && getNodeDescription(childRoutes[0], data) === "")


  return (    <div className="pl-6">
    
    {childRoutes.length > 0 && 
      (<RadioGroup value={`${selectedIndex}`} onValueChange={setSelectedOption}>
        {childRoutes.map((childRoute , i) => {

    

          const item = getDragItem(childRoute, false)

          

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
        onClick={() => addRow()}
        className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
        // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
        >
        <PlusCircledIcon height={'1rem'} width={'1rem'}/>
      </Button>
      {options.canPromptGPT && rowsEmpty && !isRoot && <Button
        onClick={suggestOptions}
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
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {

  const parentNode = meta.trellisNode

  const rows = parentNode.getWrappedChildren()

  const items = rows.map((node, index) => {

    const nodeId = node.getId()

    return {
      id: `${nodeId}`,
      data: { node: node.getInterfaceNode(), breadcrumb: false },
      breadcrumb: false
    }
  })

  // console.log('rows', rows)


  const handleSuggestSubtasks = async () => {
    options?.promptGPT && suggestSteps(options.promptGPT, interfaceNode.fosNode())
  }

  const handleAddNewRow = () => {
    console.log('clicked')
    const newChild = parentNode.getInterfaceNode().newChild("workflow")
    parentNode.refresh()
    // newChild.setFocus(0)
  }

  const trail = parentNode.getMeta().zoom?.route || []

  const route = [...parentNode.getRoute(), parentNode]

  const canPrompt = options.canPromptGPT && options.promptGPT

  // console.log("nodeType", interfaceNode.getNodeType(), options.activeModule)

  const rowsEmpty = rows.length === 0 || (rows.length === 1 && rows[0]?.getString() === "")

  const isRoot = !meta.trellisNode.getParent()

  React.useEffect(() => {
    const handler = () => {
      interfaceNode.syncPeers()
    }
    const interval = setInterval(handler, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
  
        {rows.length > 0 && 
          rows.map((childNode , i) => {
  
      
          
            const RowComponent = childNode.components.row
            

            // console.log('RowComponent', childNode.getInterfaceNode().fosNode().getNodeType(), RowComponent)
                  
            const item = items[i]
  
            if (item === undefined) {
              throw new Error('item is undefined')
            }
            
            const rowMeta = childNode.getMeta()
  
            return (<div key={i} className={` `}>
            {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
              <div  className="flex w-full">
                {(<RowComponent
  
                  node={childNode.getInterfaceNode()}
                  dragItem={item}
                  dragging={dragging}
                  dragOverInfo={dragOverInfo}
                  disabled={disabled}
                  rowDepth={rowDepth}
                  global={options}
                  meta={rowMeta}
                  state={state}
                  updateState={updateState}
                />)}
                {/* <DragOverlay>
                  {dragging === item.id ? <DragOverlayDisplay 
                    node={node}
                  /> : null}
                </DragOverlay> */}
              </div>
            </div>)
        })}
      <div>
        {(route.length - trail.length) <= 0 && <div className='py-1' key={`-1`}>
          <Button 
            onClick={() => handleAddNewRow()}
            className={`bg-secondary/30 text-white-900 hover:bg-secondary/80 px-2 shadow-none`}
            // style={{padding: !isSmallWindow ? '15px 15px 15px 15px' : '31px 3px'}}
            >
            <PlusCircledIcon height={'1rem'} width={'1rem'}/>
          </Button>
          {canPrompt && rowsEmpty && !isRoot && <Button
            onClick={handleSuggestSubtasks}
            className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
          >
            <BrainCircuit height={'1rem'} width={'1rem'}/>
          </Button>}
          

        </div>}
   
      </div>
    </div>)

}
