
import { Button } from "@/frontend/components/ui/button"
import { Globe, Users2, Lock } from "lucide-react"

import { CheckSquare, Wand } from "lucide-react"

import { FosReactOptions } from "../../types"

import { ComboboxEditableTask }  from "../combobox/comboboxEditableTask"
import _ from 'lodash'
import { AppState } from "@/frontend/types"
import { getNodeInfo } from "@/frontend/lib/utils"
import { getNodeOperations } from "@/frontend/lib/nodeOperations"



const ResourceComponent = ({ 
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


  const { selectedIndex, nodeOptions, locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase,
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
 

  // console.log('moduleKey', moduleKey)

  // console.log('rowBody', node.getNodeType(), global?.modules, global?.modules?.find( m => m.name === moduleKey))

  const isShared = true

  return (<div>
    {<Button>
      {isShared ? <Lock /> : <Globe />}&nbsp;{isShared ? `Make Private` : ` Share`}
    </Button>}
  </div>)
}



const module = {
  icon: <Users2 />,
  name: 'sharing',
  HeadComponent: ResourceComponent,
}

export default module