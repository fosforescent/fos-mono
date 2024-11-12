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
import { BrainCircuit, PlusIcon, Trash2 } from "lucide-react"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { FosDataContent, FosNodeContent, FosNodesData } from "@/fos-combined/types"


export function ComboboxOptions({
  // items,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  // defaultValue,
  // selectedIndex,
  // handleTextEdit,
  // handleChange,
  // deleteOption,
  // addOption,
  // toggleCollapse,
  nodeType,
  nodeContent,
  variant = "default",
  canSuggestOption,
  suggestOption,
  ...props
}: {
  // items: FosNodeContent[],
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  nodeType: string,
  nodeContent: FosNodeContent,
  // defaultValue?: string,
  // selectedIndex: number,
  // handleTextEdit: (value: string) => void,
  // handleChange: (value: number) => void,
  // addOption: () => void,
  // deleteOption: (index:number) => void,
  // toggleCollapse: () => void,
  variant?: "default" | "text-mimic",
  canSuggestOption: boolean, 
  suggestOption: () => void
} & React.HTMLAttributes<HTMLButtonElement>) {


  const nodeData = nodeContent.data

  if (nodeType !== "workflow") {
    throw new Error("combobox task must be used on a task node")
  }


  const selectedIndex = nodeData.option?.selectedIndex || 0


  const [open, setOpen] = React.useState(false)
  


  const items = node.getChildren().map((child, i) => {
    
    const childData = child.getData()
    
    return { 
      description: child.getData().description?.content || "",
      saveDescription: (description: string) => {
        const newChildData = {
          ...childData,
          description: {
            ...childData.description,
            content: description
          }
        }
        child.setData(newChildData)
      },
      delete: () => {
        child.delete()
      },        
      
    }
  })

  const handleChange = (value: number) => {
    // console.log('handleChange', value)
    const nodeData = node.getData()
    const newNodeData = {
      ...nodeData,
      option: {
        ...nodeData.option,
        selectedIndex: value
      }
    }
    node.setData(newNodeData)
  }

  const addOption = () => {
    node.newChild();
  }



  const currentItem = items[selectedIndex]

  if (!currentItem){
    console.log('no item', selectedIndex, items)
    throw new Error('no item')
  }

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    currentItem.saveDescription(e.target.value)
    return false
  }

  const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === " ") {
      e.stopPropagation();
    }
  }

  const keyPresses = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // console.log('keypress', e.key, selectedIndex)


    if (e.key === "ArrowUp") {
      if (e.altKey){
        // console.log('test', selectedIndex, items.length, (selectedIndex - 1 + items.length) % items.length);
        handleChange( selectedIndex ? (selectedIndex - 1 + items.length) % items.length  : 0 )
      }
    }
    if (e.key === "ArrowDown") {
      if (e.altKey){
        handleChange( selectedIndex ? (selectedIndex + 1) % items.length : 0 )
      }
    }

  }

  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // React.useEffect(() => {
  //   if(inputRef.current){
  //     inputRef.current.style.height = 'auto'
  //     inputRef.current.style.height = (inputRef.current.scrollHeight) + 'px'
  //   }

  // }, [currentItem.description])


  // const inputHeight = inputRef.current ? inputRef.current.scrollHeight : 0

  const inputHeight = 80;

  const classes = {
    default: "w-[200px] justify-between",
    "text-mimic": "w-full justify-between text-left display-flex",
  }[variant]

  const buttonStyle = {
    default: {},
    "text-mimic": {
      height: `${inputHeight}px`,
      fontSize: '1rem',
      fontWeight: 'normal',
      paddingRight: '5px'
    }
  }[variant]

 

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>

      <div style={{
        position: 'relative',
        zIndex: "0",
        height: `${inputHeight}px`,
        width: '100%'
      }}>
        <StepButton
          variant="outline"
          role="combobox"
          size="lg"
          aria-expanded={open}
          className={`${classes} text-right px-2`}
          style={{
            ...buttonStyle, 
            width: 'calc(100%)',
            height: `${inputHeight}px`,
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
        <Textarea
            ref={inputRef}
            className="rounded-r-none"
            value={currentItem
              ? currentItem.description
              : selectMessage} 
              style={{
                width: 'calc(100% - 2rem)',
                fontSize: '1.2rem',
                fontWeight: 'normal',
                // height: 'calc(100% - 3px)',
                height: `${inputHeight}px`,
                overflow: 'hidden',
                scrollbarWidth: 'none',
                scrollbarGutter: 'none',
              }}
              onChange={onTextChange}
              onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => { console.log("here") ; e.stopPropagation()}}
              onClick={(e: React.MouseEvent<HTMLTextAreaElement>) => { console.log("here") ; e.stopPropagation()}}
              onKeyDown={keyDown}
              onKeyUp={keyPresses}
              />

        </div>
          </div>

      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={searchMessage} className="h-9" />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {items.map((item, index) => (
              <CommandItem
                key={index}
                value={index.toString()}
                onSelect={(currentValue) => {
                  const parsedValue = parseInt(currentValue)
                  if (isNaN(parsedValue) || !parsedValue === undefined) {
                    throw new Error("invalid value")
                  }
                  handleChange(parsedValue)
                  setOpen(false)
                }}
              >
                {item.description}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedIndex === index ? "opacity-100" : "opacity-0"
                  )}
                />
                {items.length > 1 && (<div>
                  <Trash2
                    className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                    color={"rgba(200, 100, 100, .7)"}
                    onClick={(e) => {
                      e.stopPropagation()
                      item.delete()
                    }} />
                </div>)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup>
            <div  className="grid grid-cols-2 place-content-stretch gap-1">
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
                  disabled={!canSuggestOption}
                  className="bg-emerald-900 w-full">
                  <BrainCircuit className="h-4"  />
                </Button>
              </div>
            </div>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
