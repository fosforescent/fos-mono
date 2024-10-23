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

import { FosNodeContent, IFosNode,  } from "@/fos-js"

export function ComboboxOptionsMerge({
  // items,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  node,
  // defaultValue,
  // selectedIndex,
  // handleTextEdit,
  // handleChange,
  // deleteOption,
  // addOption,
  // toggleCollapse,
  variant = "default",
  ...props
}: {
  // items: FosNodeContent[],
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  node: IFosNode,
  // defaultValue?: string,
  // selectedIndex: number,
  // handleTextEdit: (value: string) => void,
  // handleChange: (value: number) => void,
  // addOption: () => void,
  // deleteOption: (index:number) => void,
  // toggleCollapse: () => void,
  variant?: "default" | "text-mimic",
} & React.HTMLAttributes<HTMLButtonElement>) {


  const nodeData = node.getData()
  const selectedIndex = nodeData.option?.selectedIndex || 0


  const [open, setOpen] = React.useState(false)
  


  const optionDescriptions: JSX.Element[] = [] // node.hasMerge() 
    // ? node.getMergeOptions().map((option, i: number) => {

    //   console.log('option', option.description)
    //   return (<>
    //     {option.description.map((segment, index) => (<span
    //       className={`${segment.added ? 'bg-emerald-950/90' : segment.removed ? 'bg-destructive-950/90' : ''}`}
    //       key={index}
    //     >
    //       {segment.value}
    //     </span>))}
    //   </>)
    // }, [])
    // : node.getNodeData().options.map((option, i: number) => {
    //   return (
    //     <span key={i}>{option.description}</span>
    //   )
    // })


  const handleChange = (value: number) => {
    throw new Error('not implemented')
    // console.log('handleChange', value)
    // const nodeData = node.getNodeData()
    // const newNodeData = {
    //   ...nodeData,
    //   selectedOption: value
    // }
    // node.setNodeData(newNodeData)
  }

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


  const currentItem = optionDescriptions[selectedIndex]

  if (!currentItem){
    console.log('no item', selectedIndex, optionDescriptions)
    throw new Error('no item')
  }

 

  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") {
      e.stopPropagation();
    }


  }

  const keyPresses = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('keypress', e.key, selectedIndex)


    if (e.key === "ArrowUp") {
      if (e.altKey){
        console.log('test', selectedIndex, optionDescriptions.length, (selectedIndex - 1 + optionDescriptions.length) % optionDescriptions.length);
        handleChange( selectedIndex ? (selectedIndex - 1 + optionDescriptions.length) % optionDescriptions.length  : 0 )
      }
    }
    if (e.key === "ArrowDown") {
      if (e.altKey){
        handleChange( selectedIndex ? (selectedIndex + 1) % optionDescriptions.length : 0 )
      }
    }

  }
  
  


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>

      <div style={{
        position: 'relative',
        zIndex: "0",
      }}>
        <StepButton
          variant="outline"
          role="combobox"
          size="lg"
          aria-expanded={open}
          className={`${classes} text-right px-2`}
          style={{
            ...buttonStyle, 
            zIndex: "0",
          }}
          {...props}
        >
          <div className="w-full justify-end items-end flex p-0">
            <CaretSortIcon className="h-4 opacity-50" style={{
              padding: '0px 0px 0px 0px'
            }} />
          </div>
        </StepButton>
        <div style={{
          zIndex: "1",
          position: 'absolute',
          top: '0px',
          left: '0px',
          width: '100%',
          height: '100%',
        }}>
        <div className="w-full px-3 py-2">
          {currentItem}
        </div>

        </div>
          </div>

      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={searchMessage} className="h-9" />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {optionDescriptions.map((item, index) => (
              <CommandItem
                key={index}
                onSelect={(currentValue) => {
                
                  handleChange(index)
                  setOpen(false)
                }}
              >
                {item}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedIndex === index ? "opacity-100" : "opacity-0"
                  )}
                />
       
              </CommandItem>
            ))}
          </CommandGroup>

        </Command>
      </PopoverContent>
    </Popover>
  )
}
