import React from 'react'

import { Button } from '@/components/ui/button';
import { TrashIcon, PlusCircledIcon, MinusIcon, PlusIcon, MagicWandIcon  } from '@radix-ui/react-icons'
import { DragOverlay } from '@dnd-kit/core';
import { useWindowSize } from "../window-size";
import { BrainCircuit, CircleEllipsis, Wand } from "lucide-react";
import {  TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData, TrellisRowsComponentProps } from '@/react-trellis';
import { FosWrapper } from './fosWrapper';
import { FosReactGlobal } from '.';
import { FosModuleProps } from './modules/fosModules';
import { ComboboxEditable } from '../combobox/comboboxEditable';
import { IFosNode } from '@/fos-js';
import { suggestOption } from '../../lib/suggestOption';
import { suggestSteps } from '../../lib/suggestSteps';

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

type DragInfo = {
  dragging: {
    id: string
    node: FosWrapper
    breadcrumb: boolean
  } | null
  dragOverInfo: {
    id: string
    node: FosWrapper
    position: 'above' | 'below' | 'on' | 'breadcrumb'
  } | null
}


export const FosRowsComponent = ({
  node: interfaceNode,
  dragOverInfo,
  dragging,
  rowDepth,
  disabled,
  global, 
  meta,
  state,
  updateState
} : TrellisRowsComponentProps<FosWrapper, FosReactGlobal | undefined>) => {
  
  const parentNode = meta.trellisNode

  // const handleAddNewRow = (index?: number) => {

  //   const newEdgeData = parentNode.getTrailEdge().getDefaultNextEdgeData()
  //   parentNode.addChild(newEdgeData)
    
  // }

  const [showMore, setShowMore] = React.useState(false)

  const rows = parentNode.getWrappedChildren()

  const isTask = ["workflow", "todo", "option"].includes(interfaceNode.getNodeType())
  const isRoot = interfaceNode.getNodeType() === "root"
  const isComment = interfaceNode.getNodeType() === "comment"
  const isDocument = interfaceNode.getNodeType() === "document"

  const items = rows.map((node, index) => {

    const nodeId = node.getId()

    return {
      id: `${nodeId}`,
      data: { node: node.getInterfaceNode(), breadcrumb: false },
      breadcrumb: false
    }
  }).filter(item => {
    if (isTask){
      return ["workflow", "todo", "option"].includes(item.data.node.getNodeType())
    } else if (isRoot){
      return ["todo", "query"].includes(item.data.node.getNodeType())
    } else if (isComment) {
      return ["comment"].includes(item.data.node.getNodeType())
    } else if (isDocument) {
      return ["document", "workflow", "option"].includes(item.data.node.getNodeType())
    }
  })

  // console.log('rows', rows)

  const windowSize = useWindowSize()
  const isSmallWindow = windowSize.width !== undefined && windowSize.width < 500


  const newMeta = meta.trellisNode.getMeta()




  const trail = parentNode.getMeta().zoom?.route || []

  const route = [...parentNode.getRoute(), parentNode]

  const nodeType = parentNode.getInterfaceNode().fosNode().getNodeType()

  // console.log('nodeType', nodeType)

  const isCollapsed = newMeta.isCollapsed() || false

  const isBase = trail.length === route.length

  return {
    "workflow": <TaskRows 
      node={interfaceNode}
      options={global || {}}
      meta={meta}
      state={state}
      updateState={updateState}
      dragging={dragging}
      dragOverInfo={dragOverInfo}
      disabled={disabled}
      rowDepth={rowDepth}
    />,
    "option": (isCollapsed && !isBase) ? <OptionRowsCombined
      node={interfaceNode}
      options={global || {}}
      meta={meta}
      state={state}
      updateState={updateState}
      // dragging={dragging}
      // dragOverInfo={dragOverInfo}
      // disabled={disabled}
      // rowDepth={rowDepth}
      /> : <OptionRowsExpanded
      node={interfaceNode}
      options={global || {}}
      meta={meta}
      state={state}
      updateState={updateState}
      dragging={dragging}
      dragOverInfo={dragOverInfo}
      disabled={disabled}
      rowDepth={rowDepth}
    />,
    "root": <TaskRows 
      node={interfaceNode}
      options={global || {}}
      meta={meta}
      state={state}
      updateState={updateState}
      dragging={dragging}
      dragOverInfo={dragOverInfo}
      disabled={disabled}
      rowDepth={rowDepth}
    />,
  }[nodeType] || <></>
}



const OptionRowsCombined = ( {
  node,
  options: fosOptions, 
  meta,
  state,
  updateState
}: FosModuleProps) => {

  console.log('combined option', node)

  const getDescription = (node: IFosNode) => {
    const data = node.getData()
    return data.description?.content || ""
  }


  
  const getOptions = (node: IFosNode) => {
    if (node.getNodeType() === 'option'){
      return node.getChildren().map((child, index) => {
        return ({value: index.toString(), label: getDescription(child)})
      })
    }else if (node.getNodeType() === 'task'){
      return [{value: '0', label: getDescription(node)}]
    }else{
      console.log('node', node)
      throw new Error('getoptions must be used on a task or option node')
    }
  }

  const options = node.fosNode().getChildren().map((child, index) => {
    return ({value: index.toString(), label: getDescription(child)})
  })



  const selectedIndex = node.getData().option?.selectedIndex || 0
  const locked = false



  const children = node.getChildren()


  if(selectedIndex === undefined) {
    console.log('selectedOption', options)
  }

  const suggestOptions = async (node: IFosNode) => {
    fosOptions?.promptGPT && suggestOption(fosOptions.promptGPT, node)
  }

  
  const handleUndo = () => {
    fosOptions.undo && fosOptions.canUndo && fosOptions.undo()
  }

  const handleRedo = () => {
    fosOptions.redo && fosOptions.canRedo && fosOptions.redo()
  }


  const handleSuggestOption = async () => {
    suggestOptions(node.fosNode())
  }
  
  
  const handleTextEdit = (value: string, focusChar: number | null) => {
    meta.trellisNode.setFocus(focusChar)
    node.setData({description: {content: value}})
  }

  const handleChange = (value: string) => {
    node.setData({option: {selectedIndex: parseInt(value)}})
  }


  const handleSetFocus = (newFocusChar: number) => {
    meta.trellisNode.setFocus(newFocusChar)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyUpEvents(e)

    // console.log('keyup', focusChar, value.length)
    if (e.key === 'Enter' && focusChar === value.length){
      meta.trellisNode.moveFocusDown()
    }
    if (e.key === 'Backspace' && focusChar === 0){
      meta.trellisNode.moveFocusUp()
    }
    // if (e.altKey && e.ctrlKey){
    //   console.log('test', selectedIndex, node.getChildren().length );
    //   handleChange( selectedIndex ? ( (selectedIndex - 1 + (children.length)) % children.length ).toString() : "0" )
    // }

  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyDownEvents(e)
  }

  const handleAddOption = () => {
    // console.log('addOption')
    // addOption()
  }

  const handleDeleteRow = () => {
    meta.trellisNode.delete()
  }
  
  const handleDeleteOption = () => {
    meta.trellisNode.delete()
  }


  const handleGetFocus = () => {
    meta.trellisNode.setFocus(focusChar)
  }

  const focusChar = meta.trellisNode.hasFocus()
  
  const isDragging = state.draggingNode ===  meta.trellisNode.getId()
  const draggingOver = state.draggingOverNode === meta.trellisNode.getId()

  const value = getDescription(node.fosNode())

  const isRoot = !meta.trellisNode.getParent()

  // console.log('isRoot', isRoot, meta.trellisNode.getId())


  return (<div className="flex flex-initial grow">
    <ComboboxEditable 
      className='w-full bg-transparent'
      handleTextEdit={handleTextEdit}
      handleChange={handleChange}
      suggestOption={handleSuggestOption}
      getFocus={handleGetFocus}
      hasFocus={!!focusChar}
      focusChar={focusChar}
      deleteOption={handleDeleteOption}
      // deleteRow={handleDeleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      selectedIndex={selectedIndex}
      values={options}
      locked={fosOptions.locked || false }
      setFocus={handleSetFocus}
      // defaultValue={selectedNodeDescription}
      defaultValue={selectedIndex.toString()}
      addOption={handleAddOption}
      />

  </div>)




}



const OptionRowsExpanded = (  {
  node: interfaceNode,
  options, 
  meta,
  state,
  updateState,
  dragging,
  dragOverInfo,
  disabled,
  rowDepth
}: FosModuleProps & DragInfo & { disabled: boolean, rowDepth: number }) => {
  

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


  const handleSuggestOptions = async () => {
    options?.promptGPT && suggestOption(options.promptGPT, interfaceNode.fosNode())
  }

  const handleAddNewRow = () => {
    console.log('clicked')
    const newChild = parentNode.getInterfaceNode().newChild()
  }

  const trail = parentNode.getMeta().zoom?.route || []

  const route = [...parentNode.getRoute(), parentNode]

  const canPrompt = options.canPromptGPT && options.promptGPT

  // console.log("nodeType", interfaceNode.getNodeType(), options.activeModule)

  const rowsEmpty = rows.length === 0 || (rows.length === 1 && rows[0]?.getString() === "")

  const isRoot = !meta.trellisNode.getParent()


  const handleChange = (value: string) => {
    interfaceNode.setData({option: {selectedIndex: parseInt(value)}})
    meta.trellisNode.refresh()
    // console.log('handleChange', value)
  }

  const selectedIndex = interfaceNode.getData().option?.selectedIndex || 0

  return (    <div className="pl-6">
    
    {rows.length > 0 && 
      (<RadioGroup value={`${selectedIndex}`} onValueChange={handleChange}>
        {rows.map((childNode , i) => {

    
        
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
              <div className="px1" style={{
                paddingTop: '0.55rem',
              }}>
                <RadioGroupItem value={`${i}`} className="flex-initial rounded-md" />
              </div>
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
      </RadioGroup>)
      }
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
        onClick={handleSuggestOptions}
        className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
      >
        <BrainCircuit height={'1rem'} width={'1rem'}/>
      </Button>}
      

    </div>}

  </div>
</div>)

}



const TaskRows = ( {
  node: interfaceNode,
  options, 
  meta,
  state,
  updateState,
  dragging,
  dragOverInfo,
  disabled,
  rowDepth
}: FosModuleProps & DragInfo & { disabled: boolean, rowDepth: number }) => {

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