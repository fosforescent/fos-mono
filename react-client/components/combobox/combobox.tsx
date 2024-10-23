"use client"

import * as React from "react"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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



export function Combobox({
  values,
  searchMessage = "Search...",
  selectMessage = "Select...",
  emptyMessage = "No results",
  defaultValue,
  variant = "default",
  ...props
}: {
  values: {value: string, label: string}[],
  emptyMessage?: string,
  selectMessage?: string,
  searchMessage?: string,
  defaultValue?: string,
  variant?: "default" | "text-mimic",
} & React.HTMLAttributes<HTMLButtonElement>) {

  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue)

  const classes = {
    default: "w-[200px] justify-between",
    "text-mimic": "w-full justify-between text-left display-flex",
  }[variant]

  const style = {
    default: {},
    "text-mimic": {
      width: '40vw',
      fontSize: '1rem',
      fontWeight: 'normal',
    }
  }[variant]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`${classes}`}
          style={style}
          {...props}
        >
          <div>
          {value
            ? values.find((item) => item.value === value)?.label
            : selectMessage}
          </div>
          <div>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={searchMessage} className="h-9" />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {values.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue)
                  setOpen(false)
                }}
              >
                {item.label}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    value === item.value ? "opacity-100" : "opacity-0"
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
