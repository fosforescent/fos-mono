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
import InputDiv from '../fields/inputDiv'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'
import { getExpressionInfo } from '@/shared/dag-implementation/expression'
import { getDragAndDropHandlers } from '../drag-drop'

export const NodeRow = ({ 
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

    
    <div className={`right-box grow`}>
        <div className="flex flex-initial grow" id={`${dragLabel}`}>
        <Popover open={open} onOpenChange={setOpen}>
      <div className="w-full grid grid-cols-[1fr,2rem] items-center">
        {/* <PopoverAnchor> */}
        <InputDiv
          disabled={locked}
          shouldFocus={hasFocus}
          placeholder={"Enter a task to plan"}
          className="rounded-r-none w-full cursor-text grow"
          // getFocus={getFocus}
          value={textToDisplay} 
          style={{
            fontSize: '1rem',
            fontWeight: 'normal',
            height: '100%',
            // height: 'auto',
            // ...dropStyle,
            // ...dropOnStyle,
            ...rowDraggingStyle,
          }}
          onChange={setFocusAndDescription}
          onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
          onKeyDown={keyDownEvents}
          onKeyUp={keyUpEvents}
          focusChar={focusChar}
          />
          {/* </PopoverAnchor> */}
          
            <PopoverTrigger asChild>

            <div style={{
                position: 'relative',
                opacity: 1,
                height: 'auto',
                ...rowDraggingStyle,
                ...rowDroppingStyle,
              }}
              role="combobox"
              className={`w-full flex items-center justify-center`}
              >

                <div className="py-1 w-7 border flex items-center justify-center"
                aria-expanded={open}>
                  <CaretSortIcon style={{
                    padding: '0px 0px 0px 0px',
                  }} />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                {/* <CommandInput placeholder={searchMessage} className="h-9" /> */}
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {(isOption ? getOptionInfo().nodeOptions : []).map((item, index) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={(currentValue) => {
                        handleChange(currentValue)
                        setOpen(false)
                      }}
                      
                    >
                      {item.label || <span className="opacity-50">{`New Option`}</span>}
                      <CheckIcon
                        className={cn(
                          "ml-auto h-4 w-4",
                          getOptionInfo().selectedOption.value === item.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {(isOption ? getOptionInfo().nodeOptions : []).length > 1 && (!(getOptionInfo().selectedOption.value === item.value)) && (<div>
                        <Trash2
                          className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                          color={"rgba(200, 100, 100, .7)"}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteOption(item.value)
                          }} />
                      </div>)}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <div  className={`grid grid-cols-2 place-content-stretch gap-1`}>
                    <div className="">
                      <Button
                        onClick={() => {
                          addOption()
                          setOpen(false)
                        }}
                        className="justify-center bg-gray-100/30 text-gray-900 hover:bg-gray-200 h-10 w-full"
                      >
                        <PlusIcon className="h-4" />
                      </Button>
                    </div>
                    <div className="">
                      <Button
                        onClick={() => {
                          suggestOption()
                          setOpen(false)
                        }}
                        className="bg-emerald-900 w-full">
                        <BrainCircuit className="h-4" />
                      </Button>
                    </div>
                  </div>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </div>
        </Popover>
      </div>
    </div>

    {isOption && <div 
        className="py-1 w-8 flex items-center justify-center cursor-pointer hover:bg-gray-100"
        onClick={toggleCollapse}
        >
        <CaretSortIcon style={{
          padding: '0px 0px 0px 0px',
          transform: !getOptionInfo().isOptionChildCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
        }} />
      </div>}

      {depth > 0 && hasChildren
      && (<div className={`right-box `} style={{
          width: '1.5rem',
        }}>

        <div className={`pl-0`}>
          <span 
            onClick={isOption ? toggleOptionChildCollapse : toggleCollapse}
            className={`py-3 cursor-pointer`}
            >
          {isCollapsed ? (<ChevronLeftCircleIcon size={'15px'}/>) : (<ChevronDownCircleIcon size={'15px'}/>)}
          </span>
        </div>
      </div>)}

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