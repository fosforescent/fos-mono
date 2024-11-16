import { ComboboxOptions } from "../combobox/comboboxOptions"
import { PenBox } from "lucide-react"

import { suggestOption } from "../../lib/suggestOption"

import { FosReactOptions } from "../../types"
import { InputDiv } from "../combobox/inputDiv"

import { AppState, FosRoute } from "@/fos-combined/types"
import _ from "lodash"
import { getNodeOperations } from "@/fos-combined/lib/nodeOperations"
import { getNodeInfo } from "@/fos-combined/lib/utils"



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


    
  const { selectedIndex, nodeOptions, locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase, nodeLabel, 
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren
  } = getNodeInfo(nodeRoute, data)
  
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
    toggleOptionCollapse,
    suggestSteps,
    addRow,
    toggleCollapse,
    zoom
   } = getNodeOperations(options, data, setData, nodeRoute)
 


   const thisShouldFocus = _.isEqual(data.data.trellisData.focusRoute, nodeRoute) 


  return (<div>
    {<InputDiv 
      

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
      getFocus={getFocus}
      onChange={setFocusAndDescription}
      onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
      // onKeyDown={}
      // onKeyUp={onKeyUp}
      focusChar={focusChar}
    />}
  </div>)
}



const module = {
  icon: <PenBox />,
  name: 'workflow',
  HeadComponent: ResourceComponent,
}

export default module