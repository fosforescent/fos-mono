import React, { useEffect, useState } from 'react'


import _, { get, has }  from 'lodash'


import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon, SendHorizonal, PlusIcon, BrainCircuit, CheckIcon, Trash2 } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactGlobal, FosReactOptions, FosPath } from '@/shared/types'
import { cn } from '@/frontend/lib/utils'

import { getNodeOperations } from '@/shared/nodeOperations'
import { Card, CardContent, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import InputDiv from '../elements/inputDiv'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'
import { getExpressionInfo } from '@/shared/dag-implementation/expression'
import { getDragAndDropHandlers } from '../drag-drop'

export const ExpressionRow = ({ 
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


  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
       data: state
    })
  }


  const { locked, getOptionInfo,
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, 
     disabled, depth, isCollapsed, dragLabel,
    isTooDeep, isOption, hasChildren, 
  } = getExpressionInfo(nodeRoute, data.data)
  
  const { 
    setFocus, 
    setFocusAndDescription, 
    deleteRow,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    suggestSteps,
    toggleOptionChildCollapse,
    zoom,
    setSelectedIndex,
    suggestOption, 
    addOption,
    setSelectedOption, 
    deleteOption,
    toggleCollapse
  } = getNodeOperations(options, data.data, setFosAndTrellisData, nodeRoute)
  

  // const { 
  //   selectedIndex, 
  //   nodeOptions, 
  //   isOptionChildCollapsed,
  //   selectedOption,
  //   getSelectedNodeInfo, 
  // } = getOptionInfo()

  const [open, setOpen] = React.useState(false)


  const handleChange = (value: string) => {
    setSelectedOption(parseInt(value))
  }

  const handleDeleteOption = (value: string) => {
    deleteOption()
  }

  const emptyMessage = "No options available"



  const {
    getNodeDragInfo
  } = getDragAndDropHandlers(options, data, setData)

  const {
    rowDraggingStyle,
    rowDroppingStyle,
  } = getNodeDragInfo(nodeRoute)


  const textToDisplay = isOption ? getOptionInfo().getSelectedNodeInfo().nodeDescription : nodeDescription


  return (
    <div className="flex items-center">
  

      <div className={`left-box cursor-pointer`} style={{
        width: '1rem'
        
      }} onClick={zoom} >
        
          {/* <MenuComponent 
            node={node} 
            /> */}
          <DiscIcon
            width={'1rem'}
            height={'1rem'}
            style={{
              opacity: hasChildren ? 1 : .5
            }} />
            
      </div>

    
    <div className={`right-box grow flex`}>
     
    </div>

  </div>)

}



const GroupRow = ({ 
  data,
  setData,
  options,
  nodeRoute: route,
  ...props
} : {
  options: FosReactGlobal
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {


  const { getGroupInfo } = getNodeInfo(route, data)

  const { name, userProfiles,  } = getGroupInfo()

  return (<div>
      {name}
      <div className={`flex flex-row w-full justify-around items-center`}>
          <Button><MessageSquare /></Button>
          <Button><CheckSquare /></Button>
          <Button><Inbox /></Button>
      </div>
  </div>)


}


export const NodeCard = ({ 
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  } : {
    options: FosReactGlobal
    data: AppState
    nodeRoute: FosPath
    setData: (state: AppState) => void
  }) => {
  
    const setFosAndTrellisData = (state: AppState["data"]) => {
      setData({
        ...data,
         data: state
      })
    }
    
    const { nodeDescription } = getExpressionInfo(route, data.data)
  
    const { zoom } = getNodeOperations(options, data.data, setFosAndTrellisData, route)
    // const { getCommentInfo } = getNodeInfo(route, data)
  
    return (
    <Card 
      className={`transform transition-all duration-500 ${'translate-y-0 opacity-100'}`}
      // onAnimationEnd={() => onAnimationEnd(message.id)}
    >
      <CardContent className="p-4">
        // this should be the (readonly?) card for the type of node 
        <div className="text-gray-800">{nodeDescription || "This Todo is empty"}</div>
        {/* <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div> */}
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4">
        <Button variant="default" size="sm">
          <SendHorizonal />   
        </Button>
      </CardFooter>
    </Card>
    )
  }