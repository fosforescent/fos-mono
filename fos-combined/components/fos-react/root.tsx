import { ComboboxOptions } from "../combobox/comboboxOptions"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"


import { InputDiv } from "../combobox/inputDiv"
import { ComboboxEditableTask } from "../combobox/comboboxEditableTask"
import { AppState, FosReactOptions, FosRoute } from "@/fos-combined/types"
import { getNodeInfo } from "@/fos-combined/lib/utils"
import { getNodeOperations } from "@/fos-combined/lib/nodeOperations"

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
  
  const handleSuggestOption = async () => {
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestOption()
      } catch (err) {
        options?.toast && options.toast({
          title: 'Error',
          description: `No suggestions could be generated: ${err}`,
          duration: 5000,
        })

      }
    } else {
      console.error('No authedApi')
      const err =  new Error('No authedApi')
      err.cause = 'unauthorized'
      throw err
    }
  }


  const getFocus = () => {
    setFocus(0)
  }
  
  return (<div>
    {<InputDiv
      value={nodeDescription}
      onChange={setFocusAndDescription}
      placeholder="Task description"
    />}
  </div>)
}


const RootRowComponent = ({ 
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


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error. 
  </div>)
}



const module = {
  icon: <Home />,
  name: 'root',
  HeadComponent: ResourceComponent,
  RowComponent: RootRowComponent,

}

export default module