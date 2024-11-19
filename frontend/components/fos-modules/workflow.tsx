

import { ComboboxEditableTask }  from "../combobox/comboboxEditableTask"
import _ from 'lodash'

import { getNodeOperations } from "@/frontend/lib/nodeOperations"
import { getNodeInfo } from "@/frontend/lib/utils"
import { AppState, FosReactOptions, FosRoute } from "@/frontend/types"
import { PlaySquare, Workflow } from "lucide-react"
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
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {

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
    zoom,
    runTask,
  } = getNodeOperations(options, data, setData, nodeRoute)

 
  const descriptionModule = options.modules?.find((module) => module.name === 'description')
 
  if (!descriptionModule){
    console.log('description', options.modules)
    throw new Error('description module not found')
  }

  const HeadComponent = descriptionModule.HeadComponent || (() => null)
  
  return (
    <div className={`grid grid-cols-[1fr,2rem] items-center`}>
      {/* <WorkflowRowComponent
        data={data}
        setData={setData}
        nodeRoute={nodeRoute}
        options={options}
      /> */}
      <HeadComponent
        data={data}
        setData={setData}
        nodeRoute={nodeRoute}
        options={options}
      />
      <Button onClick={runTask}>
        <PlaySquare /> Run
      </Button>
    </div>)
}




const WorkflowRowComponent = ({ 
  data,
  setData,
  options: fosOptions,
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
    nodeDescription, isRoot, childRoutes, isBase,
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren
  } = getNodeInfo(nodeRoute, data)

  const values = [{
    value: '0',
    label: nodeDescription || ''
  }]
  
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
    zoom,
    
   } = getNodeOperations(fosOptions, data, setData, nodeRoute)
 



  const thisShouldFocus = _.isEqual(data.data.trellisData.focusRoute, nodeRoute) 

  const canPrompt = fosOptions?.canPromptGPT && fosOptions?.promptGPT


  return (<div className="flex flex-initial grow" id={`${nodeType}-${nodeId}`}>
    <ComboboxEditableTask 
      className='w-full bg-transparent'
      handleTextEdit={setFocusAndDescription}
      // handleChange={handleChange}
      suggestOption={canPrompt ? suggestOption : null}
      getFocus={() => { setFocus(0) }}
      hasFocus={thisShouldFocus}
      focusChar={focusChar}
      deleteRow={deleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={keyDownEvents}
      onKeyUp={keyUpEvents}
      values={values}
      locked={locked}
      setFocus={setFocus}
      addOption={addOption}
      />

  </div>)
}






const module = {
  icon: <Workflow />,
  name: 'workflow',
  HeadComponent: ResourceComponent,
  RowComponent: WorkflowRowComponent,
}

export default module