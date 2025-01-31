import { CheckIcon, CheckSquare, ChevronDownCircleIcon, ChevronLeftCircleIcon, PlusIcon, Trash2, Wand } from "lucide-react"

import { FosReactOptions, FosPath } from "../../../shared/types"


import _ from 'lodash'
import { AppState } from "@/shared/types"
import { FosExpression } from "@/shared/dag-implementation/expression"
import { CaretSortIcon } from "@radix-ui/react-icons"
import { Command, CommandEmpty, CommandGroup, CommandItem } from "../ui/command"
import { Button } from "../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import InputDiv from "../elements/inputDiv"
import { getNodeOperations } from "@/shared/nodeOperations"
import { getDragAndDropHandlers } from "../drag-drop"
import { useDraggable, useDroppable } from "@dnd-kit/core"

/**
 * 
 * Meta component = component to modify item (changes node) -- let's just add an autocomplete dropdown to link or copy other nodes
 * 
 * Actual compoonent = component to modify information within item (changes node content -- e.g. edit description, complete, etc.)
 * 
 * Does this distinction matter?  Let's pretend it doesn't for now.
 * 
 * 
 */





const TodoRowComponent = ({
  depthToShow,
  expression,
  ...props
} : {
  depthToShow: number
  expression: FosExpression
}) => {


  const {
    locked,
    hasFocus, focusChar, isDragging, draggingOver,
    nodeDescription, isRoot, childRoutes, isBase,
    nodeType, nodeId, disabled, depth, isCollapsed,
    isTooDeep, isOption, hasChildren, getOptionInfo
  } = expression.getExpressionInfo()

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
  } = expression.getActions()


  
  const { 
    getNodeDragInfo 
  } = getDragAndDropHandlers(options, data, setData) 
   


  const { getStyles, nodeItemIdMaybeParent, isDraggingParent, dragging, useDraggableArg, useDroppableArg } = getNodeDragInfo(nodeRoute)

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    // transition,
  } = useDraggable(useDraggableArg);


  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable(useDroppableArg);

  const {
    dragStyle, 
    dropStyle
  } = getStyles(transform)


  return (<>
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
  </>)
}


