import { ComboboxOptions } from "../combobox/comboboxOptions"
import { PenBox, PlaySquare } from "lucide-react"


import { FosReactOptions } from "../../../shared/types"
import { InputDiv } from "../elements/inputDiv"

import { AppState, FosPath } from "@/shared/types"
import _ from "lodash"
import { getNodeOperations } from "@/frontend/lib/nodeOperations"
import { getNodeInfo } from "@/frontend/lib/utils"
import { Button } from "@/frontend/components/ui/button"



const ResourceComponent = ({ 
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


    
  const { locked, 
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
  name: 'description',
  HeadComponent: ResourceComponent,
}

export default module