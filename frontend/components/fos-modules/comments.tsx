
import { MessagesSquare, PenBox, Wand } from "lucide-react"


import { InputDiv } from "../combobox/inputDiv"

import _ from 'lodash'

import { getNodeOperations } from "@/frontend/lib/nodeOperations"
import { AppState, FosReactOptions, FosRoute } from "@/frontend/types"
import { getNodeInfo } from "@/frontend/lib/utils"

const ResourceComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {


    
  const {  locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase, nodeLabel, 
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren, 
  } = getNodeInfo(nodeRoute, data)
  
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
    toggleOptionCollapse,
    suggestSteps,
    toggleCollapse,
    zoom
   } = getNodeOperations(options, data, setData, nodeRoute)

  return (<div className={`grid grid-cols-[1fr,2rem] items-center`}>
    {    <InputDiv
          disabled={locked}
          shouldFocus={hasFocus}
          placeholder={"Enter task description"}
          className="rounded-r-none w-full cursor-text grow"
          value={nodeDescription} 
          style={{
            width: 'calc(100% - 1.25rem)',
            fontSize: '1rem',
            fontWeight: 'normal',
            height: 'auto',
            border: '1px solid rgba(23, 20, 20, .3)',
          }}
          onChange={setFocusAndDescription}
          onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
          // onKeyDown={}
          // onKeyUp={onKeyUp}
          focusChar={focusChar}
    />}

  </div>)
}




const CommentRowComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {


    
  const { locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase, nodeLabel, 
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren, 
  } = getNodeInfo(nodeRoute, data)
  
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
    toggleOptionCollapse,
    suggestSteps,
    toggleCollapse,
    zoom
   } = getNodeOperations(options, data, setData, nodeRoute)


  const canPrompt = options?.canPromptGPT && options?.promptGPT


  return (<div className="flex flex-initial grow" id={`${nodeLabel}`}>


  </div>)
}




const module = {
  icon: <MessagesSquare />,
  name: 'comment',
  HeadComponent: ResourceComponent,
  RowComponent: CommentRowComponent,
}

export default module