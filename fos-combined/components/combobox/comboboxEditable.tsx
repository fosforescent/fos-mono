"use client"

import * as React from "react"
import { CaretDownIcon, CheckIcon } from "@radix-ui/react-icons"

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
} from "@/components/ui/popover"

import { Input } from "@/components/ui/input"
import { BrainCircuit, PlusIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

import { InputDiv } from './inputDiv'



export function ComboboxEditable({
  values,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  defaultValue,
  selectedIndex,
  handleTextEdit,
  isDragging,
  draggingOver,
  draggingOn,
  handleChange,
  deleteOption,
  addOption,
  onKeyDown,
  onKeyUp,
  locked,
  hasFocus,
  focusChar,
  suggestOption,
  // shouldFocus,
  ...props
}: {
  values: {value: string, label: string}[],
  // getFocus: (char: number | null) => void,
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  defaultValue?: string,
  selectedIndex: number,
  handleTextEdit: (value: string, focusChar: number) => (void | Promise<void>),
  handleChange: (value: string) => (void | Promise<void>),
  isDragging: boolean,
  draggingOver?: boolean,
  draggingOn?: boolean,
  addOption: () => (void | Promise<void>),
  deleteOption: (index:number) => (void | Promise<void>),
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => (void | Promise<void>), 
  onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => (void | Promise<void>),
  hasFocus: boolean,
  focusChar: number | null,
  locked: boolean,
  suggestOption: (() => (void | Promise<void>)) | null,
  // shouldFocus: boolean,
} & React.HTMLAttributes<HTMLDivElement>) {

  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    if (selectedIndex !== undefined){
      // if (values.length < 1){
      //   console.log('values', values)

      //   throw new Error('values.length < 1');
      // }
      // console.log('selectedIndex', selectedIndex, values, defaultValue, props )
      setValue(selectedIndex.toString() || defaultValue || "0")
    }
  }, [selectedIndex])




  const onTextChange = (value: string, cursorPos: number) => {
    if (locked){
      return
    }
    handleTextEdit(value, cursorPos)
    return false
  }



  const handleDeleteOption = (index: number) => {
    if (locked){
      return
    }
    // console.log('handleDeleteOption', index)
    deleteOption(index)
  }

 

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


  // console.log('open', open, value, values, defaultValue, selectedIndex, props)

  return (
    <Popover open={open} onOpenChange={setOpen}>
    <div className="w-full grid grid-cols-[1fr,2rem]">
      {/* <PopoverAnchor> */}
        <InputDiv
          disabled={locked}
          shouldFocus={hasFocus}
          placeholder={values.length > 1 ? "New Option" : "Enter a task to plan"}
          className="rounded-r-none w-full cursor-text grow"
          value={value
            ? values.find((item) => item.value === value)?.label || ""
            : selectMessage} 
          style={{
            width: 'calc(100% - 1.25rem)',
            fontSize: '1rem',
            fontWeight: 'normal',
            height: 'auto',
            // ...dropStyle,
            // ...dropOnStyle,
            ...draggingStyle,
          }}
          onChange={onTextChange}
          onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          focusChar={focusChar}

        />
      {/* </PopoverAnchor> */}

        <PopoverTrigger asChild>

        <div style={{
            position: 'relative',
            opacity: 1,
            height: 'auto',
            ...dropOnStyle,
            ...dropStyle,
          }}
          role="combobox"
          className={`w-full flex items-center justify-center`}
          >

            <div className="py-1 w-7 border flex items-center justify-center"
            aria-expanded={open}>
              <CaretDownIcon style={{
                padding: '0px 0px 0px 0px',
              }} />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 bg-foreground">
          <Command>
            {/* <CommandInput placeholder={searchMessage} className="h-9" /> */}
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
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
            </CommandGroup>
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
                    <BrainCircuit className="h-4" onClick={suggestOption} />
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

