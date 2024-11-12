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
} from "@/components/ui/popover"

import { Input } from "@/components/ui/input"
import { PlusIcon, Trash2 } from "lucide-react"

export function ComboboxMerge({
  values,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  // defaultValue,
  selectedIndex,
  // handleTextEdit,
  isDragging,
  // draggingOver,
  // draggingOn,
  handleChange,
  // addYoungerSibling,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveFocusUp,
  moveFocusDown,
  // deleteOption,
  // deleteRow,
  // addOption,
  // handleUndo,
  // handleRedo,
  toggleCollapse,
  variant = "default",
  hasFocus,
  // focusChar,
  setFocus,
  // locked,
  added,
  removed,
  ...props
}: {
  values: JSX.Element[],
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  // defaultValue?: string,
  selectedIndex: number,
  // handleTextEdit: (value: string, focusChar: number) => void,
  handleChange: (value: string) => void,
  // addYoungerSibling: () => void,
  moveLeft: () => void,
  moveRight: () => void,
  moveFocusUp: () => void,
  moveFocusDown: () => void,
  // handleUndo: () => void,
  // handleRedo: () => void,
  isDragging: boolean,
  // draggingOver?: boolean,
  // draggingOn?: boolean,
  moveUp: () => void,
  moveDown: () => void,
  // deleteRow: () => void,
  // addOption: () => void,
  // deleteOption: (index:number) => void,
  toggleCollapse: () => void,
  variant?: "default" | "text-mimic",
  hasFocus?: boolean,
  // focusChar?: number,
  added?: boolean,
  removed?: boolean,
  setFocus: (focusChar: number) => void,
  // locked: boolean,
} & React.HTMLAttributes<HTMLButtonElement>) {






  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(selectedIndex.toString() || "0")

  React.useEffect(() => {
    if (selectedIndex !== undefined){
      if (values.length < 1){
        throw new Error('values.length < 1');
      }
      // console.log('selectedIndex', selectedIndex, values, defaultValue, props )
      setValue(selectedIndex.toString() || "0")
    }
  }, [selectedIndex])

  const classes = {
    default: "w-[200px] justify-between",
    "text-mimic": "w-full justify-between text-left display-flex",
  }[variant]

  const buttonStyle = {
    default: {},
    "text-mimic": {
      width: '50vw',
      fontSize: '1rem',
      fontWeight: 'normal',
      paddingRight: '5px'
    }
  }[variant]



  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // if (locked){
    //   e.preventDefault()
    //   e.stopPropagation()
    //   return
    // }
    // setTimeout(() => {
    //   // console.log('onFocus', e.target.selectionStart, e)
    //   setFocus(e.target.selectionStart || 0)
    // }, 10);
    console.log('onFocus', e)
  }


  React.useEffect(() => {
    // TODO handle focus
    if (hasFocus){
      // if(focusChar){
      //   if (inputRef.current && inputRef.current.setSelectionRange){
      //     if (inputRef.current.value.length < focusChar){
      //       inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
      //     } else {
      //       inputRef.current.setSelectionRange(focusChar, focusChar)
      //     }
      //     inputRef.current.focus()
      //   }
      // }else{
      //   if (inputRef.current && inputRef.current.setSelectionRange){
      //     inputRef.current.setSelectionRange(0, 0)
      //     inputRef.current.focus()
      //   }
      // }
    }

    console.log('hasFocus', hasFocus, )
  }, [hasFocus])

  // const dropStyle = draggingOver ? {
  //   // backgroundColor: 'rgba(230, 220, 200, .03)',
  // } : {}

  // const dropOnStyle = draggingOn ? {
  //   backgroundColor: 'rgba(230, 220, 200, .07)',
  //   border: '1px solid rgba(230, 220, 200, .3)',
  //   // transform: 'scale(1.05)',
  // } : {}

  const draggingStyle = isDragging ? {
    backgroundColor: 'rgba(230, 220, 200, .03)',
    opacity: '0.5',
  } : {}



  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>

      <div style={{
        position: 'relative',
        opacity: 1,
      }}>
        <StepButton
          variant="outline"
          role="combobox"
          size="lg"
          aria-expanded={open}
          className={`${classes} text-right px-2  ${added ? "ring-emerald-900" : removed ? "ring-destructive-900" : "border-white"}`}
          style={{...buttonStyle, // ...dropStyle,
            // border: '1px solid black',
          }}
          {...props}
        >
          <div className="w-full justify-end items-end flex p-0">
            <CaretSortIcon className={`h-4 ${values.length > 1 ? "text-teal-100/80" : "opacity-80 fill-white" }`} style={{
              padding: '0px 0px 0px 0px',
            }} />
          </div>
        </StepButton>
        <div style={{
          zIndex: "3",
          position: 'absolute',
          top: '0px',
          left: '0px',
          width: '100%',
          height: '100%',
          // ...dropOnStyle
        }} className="rounded-sm">
          {/* 
            Div showing diffed description for selected option
          */}
        <div className={`w-full px-3 py-2`}>
          {values[parseInt(value)] || <span className="opacity-50">{`New Option`}</span>}
        </div>

        </div>
          </div>

      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          {/* <CommandInput placeholder={searchMessage} className="h-9" /> */}
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {values.map((item, index) => (
              <CommandItem
                key={index}
                value={index.toString()}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? value : currentValue)
                  handleChange(currentValue)
                  setOpen(false)
                }}
                
              >
                {item || <span className="opacity-50">{`New Option`}</span>}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedIndex === index ? "opacity-100" : "opacity-0"
                  )}
                />

              </CommandItem>
            ))}
          </CommandGroup>
          {/* <CommandGroup>
            <CommandItem
              onSelect={() => {
                addOption()
                setOpen(false)
              }}
              className="justify-center bg-gray-100/30 text-gray-900 hover:bg-gray-200"
            >
              <PlusIcon className="h-4 w-4" />
            </CommandItem>
          </CommandGroup> */}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
