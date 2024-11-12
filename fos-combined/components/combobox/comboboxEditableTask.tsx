"use client"

import * as React from "react"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { StepButton, } from "@/components/ui/button-step"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  // PopoverAnchor
} from "@/components/ui/popover"

import { BrainCircuit, PlusIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

import { InputDiv } from './inputDiv'
import { add } from "date-fns"

export function ComboboxEditableTask({
  values,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  isDragging,
  draggingOver,
  draggingOn,
  handleTextEdit,
  deleteRow,
  addOption,
  variant = "default",
  hasFocus,
  focusChar,
  setFocus,
  suggestOption,
  getFocus,
  locked,
  ...props
}: {
  values: {value: string, label: string}[],
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  handleTextEdit: (value: string, focusChar: number) => void,
  isDragging: boolean,
  draggingOver?: boolean,
  draggingOn?: boolean,
  deleteRow: () => void,
  addOption: () => void,
  variant?: "default" | "text-mimic",
  hasFocus?: boolean,
  focusChar: number | null,
  setFocus: (focusChar: number) => void,
  getFocus: () => void,
  suggestOption: (() => void) | null,
  locked: boolean,
} & React.HTMLAttributes<HTMLDivElement>) {

  const [open, setOpen] = React.useState(false)


  const classes = {
    default: "w-[200px] ",
    "text-mimic": "w-full  text-left display-flex",
  }[variant]

  const buttonStyle = {
    default: {},
    "text-mimic": {
      width: '70vw',
      fontSize: '1rem',
      fontWeight: 'normal',
      paddingRight: '5px'
    }
  }[variant]



  const dropStyle = draggingOver ? {
    // backgroundColor: 'rgba(230, 220, 200, .03)',
  } : {}

  const dropOnStyle = draggingOn ? {
    backgroundColor: 'rgba(230, 220, 200, .07)',
    border: '1px solid rgba(230, 220, 200, .3)',
    // transform: 'scale(1.05)',
  } : {}

  
  // console.log('isDragging', isDragging, draggingOver, draggingOn)

  const draggingStyle = isDragging ? {
    backgroundColor: 'rgba(230, 220, 200, .03)',
    opacity: '0.5',
  } : {}

  return (
      <Popover open={open} onOpenChange={setOpen}>
    <div className="w-full grid grid-cols-[1fr,2rem] items-center">
      {/* <PopoverAnchor> */}
      <InputDiv
        disabled={locked}
        shouldFocus={hasFocus}
        placeholder={"Enter a task to plan"}
        className="rounded-r-none w-full cursor-text grow"
        // getFocus={getFocus}
        value={values[0]!.label} 
        style={{
          fontSize: '1rem',
          fontWeight: 'normal',
          height: '100%',
          // height: 'auto',
          // ...dropStyle,
          // ...dropOnStyle,
          ...draggingStyle,
        }}
        onChange={handleTextEdit}
        onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
        onKeyDown={props.onKeyDown}
        onKeyUp={props.onKeyUp}
        focusChar={focusChar}
        getFocus={getFocus}
        />
        {/* </PopoverAnchor> */}
        
        {values[0]!.label !== "" && <PopoverTrigger asChild onClick={(e) => {
          if(!suggestOption){
            e.stopPropagation()
            e.preventDefault()
            addOption()
          }
        }}>

          <div style={{
              position: 'relative',
              opacity: 1,
              height: 'auto',
              ...dropOnStyle,
              ...dropStyle,
              // width: 'calc(100% - 2rem)',
            }}
            role="combobox"
            className={`w-full flex items-center justify-center`}
  >
            <div className="py-1 border"
            aria-expanded={open}>
              <PlusIcon className={`h-4 cursor-pointer`} style={{
                padding: '0px 0px 0px 0px',
              }} />
            </div>
          </div>
        </PopoverTrigger>}
        <PopoverContent className="w-[200px] p-0 inset-x-1/2 bg-foreground">
          <Command>
            {/* <CommandInput placeholder={searchMessage} className="h-9" /> */}
            {/* <CommandEmpty>{emptyMessage}</CommandEmpty> */}
            {/* <CommandGroup>
              {values.map((item, index) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? value : currentValue)
                    handleChange(currentValue)
                    setOpen(false)
                  }}
                  
                >
                  {item.label || <span className="opacity-50">{`New Option`}</span>}
                  <CheckIcon
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {values.length > 1 && (!(value === item.value)) && (<div>
                    <Trash2
                      className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                      color={"rgba(200, 100, 100, .7)"}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteOption(index)
                      }} />
                  </div>)}
                </CommandItem>
              ))}
            </CommandGroup> */}
            <CommandGroup>
              <div  className={`grid ${suggestOption ? "grid-cols-2" : "grid-cols-1"} place-content-stretch gap-1`}>
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
                {suggestOption && <div className="">
                  <Button
                    onClick={() => {
                      suggestOption()
                      setOpen(false)
                    }}
                    className="bg-emerald-900 w-full">
                    <BrainCircuit className="h-4" />
                  </Button>
                </div>}
              </div>
            </CommandGroup>
          </Command>
        </PopoverContent>
        </div>
        </Popover>
  )
}

