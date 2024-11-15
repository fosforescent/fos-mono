import React, { useMemo } from "react"
import { Option, Wand } from "lucide-react"

import { InputDiv } from "../combobox/inputDiv"
import { ComboboxEditable } from "../combobox/comboboxEditable"
import _, { set } from 'lodash'
import { AppState, FosReactOptions, FosRoute } from "@/fos-combined/types"
import { getNodeOperations } from "@/fos-combined/lib/nodeOperations"
import { getNodeInfo } from "@/fos-combined/lib/utils"

const OptionRowComponent = ({ 
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
    hasFocus, focusChar, isDragging, draggingOver, getOptionInfo,
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


  const { selectedIndex, nodeOptions } = getOptionInfo()
   



  return (<div className="flex flex-initial grow">

    {isCollapsed ? <ComboboxEditable
      className='w-full bg-transparent'
      handleTextEdit={setFocusAndDescription}
      handleChange={(x: string) => setSelectedOption(parseInt(x))}
      suggestOption={suggestOption}
      hasFocus={hasFocus}
      // shouldFocus={thisShouldFocus}
      focusChar={focusChar}
      deleteOption={deleteOption}
      // deleteRow={handleDeleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={keyDownEvents}
      onKeyUp={keyUpEvents}
      selectedIndex={selectedIndex}
      values={nodeOptions}
      locked={locked}
      defaultValue={selectedIndex.toString()}
      addOption={addOption}
      /> : 
      <InputDiv

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
        focusChar={focusChar}
      />}

  </div>)
}





const module = {
  icon: <Option />,
  name: 'option',
  RowComponent: OptionRowComponent,
}

export default module