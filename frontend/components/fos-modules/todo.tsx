
import { CheckSquare, Wand } from "lucide-react"

import { FosReactOptions, FosRoute } from "../../types"

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
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {


  



  return (<div className={`grid grid-cols-[1fr,2rem] items-center`}>
    {<TodoRowComponent
      data={data}
      setData={setData}
      options={options}
      nodeRoute={nodeRoute}
    />}
    {/* {canPrompt && <Button
            onClick={handleSuggestMagic}
            className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
          >
          <Wand height={'1rem'} width={'1rem'}/>
        </Button>} */}
  </div>)
}




const TodoRowComponent = ({ 
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
 



  const thisShouldFocus = _.isEqual(data.data.trellisData.focusRoute, nodeRoute) 

  const canPrompt = options?.canPromptGPT && options?.promptGPT


  return (<div className="flex flex-initial grow" id={`${nodeType}-${nodeId}`}>
    <ComboboxEditableTask 
      className='w-full bg-transparent'
      handleTextEdit={setFocusAndDescription}
      // handleChange={handleChange}
      suggestOption={canPrompt ? suggestOption : null}
      getFocus={getFocus}
      hasFocus={thisShouldFocus}
      focusChar={focusChar}
      deleteRow={deleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={keyDownEvents}
      onKeyUp={keyUpEvents}
      values={nodeOptions}
      locked={locked}
      setFocus={setFocus}
      addOption={addOption}
      />

  </div>)
}



const module = {
  icon: <CheckSquare />,
  name: 'todo',
  HeadComponent: ResourceComponent,
  RowComponent: TodoRowComponent,
}

export default module