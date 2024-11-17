import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

import { Button } from "@/components/ui/button"

import { 
  ChevronDownCircleIcon,
  CornerDownLeftIcon,
  PlusCircleIcon,
  ChevronUp,
  ChevronDown,
  Option,
  ArrowBigUp,
  Plus,
  Brain,
  BrainCircuit,
  Undo2,
  Redo2,
  ArrowBigRight,
  ArrowBigLeftDash,
  ArrowBigRightDash,
  ArrowBigUpDash,
  ArrowBigDownDash,
  HandIcon,
  Trash2,
  Disc,
} from 'lucide-react'

import {
  QuestionMarkCircledIcon,
  CaretSortIcon,
  DragHandleDots2Icon,
  CursorTextIcon,
} from '@radix-ui/react-icons'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Card
} from "@/components/ui/card"

import {
  Badge 
} from "@/components/ui/badge"

export const HelpDrawer = ({
  open,
  setOpen,
  showTutorial,
  setShowTutorial,
} : {
  open: boolean
  setOpen: (open: boolean) => void
  showTutorial: boolean, 
  setShowTutorial: (show: boolean) => void
}) => {

  const handleTutorialClick = () => {
    setOpen(false)
    setShowTutorial(true)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className={`${open ? `p-7` : `absolute m-3 p-0 bottom-0 right-0`}`}><QuestionMarkCircledIcon width={24} height={24} /></DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-center" aria-description='Shortcuts'>Shortcuts</DrawerTitle>
          {/* <DrawerDescription>This action cannot be undone.</DrawerDescription> */}
        </DrawerHeader>
        <div className="flex flex-row justify-around flex-wrap">
 
          <ShortcutRow text="Add Row" shortcut={{key: "Enter"}}><PlusCircleIcon /> </ShortcutRow>
          <ShortcutRow text="Delete Row" shortcut={{key: "Backspace"}}><CursorTextIcon width={'1.5rem'} height={'1.5rem'}/></ShortcutRow>
          <ShortcutRow text="Toggle Collapse Row" shortcut={{key: "Space", ctrl: true}}><ChevronDownCircleIcon /> </ShortcutRow>
          <ShortcutRow text="Zoom to Row"><Disc size="1.5rem" /></ShortcutRow>
          <ShortcutRow text="Add Option" shortcut={{key: "Enter", alt: true}}>
            <div className="flex flex-row items-end">
              <CaretSortIcon width={'1.5rem'} height={'1.5rem'} />
              <Plus size={'.7rem'} className="-ml-3" />
            </div>
          </ShortcutRow>
          <ShortcutRow text="Delete Option"><Trash2 size="1.5rem" /></ShortcutRow>
          <ShortcutRow text="Indent Row" shortcut={{key: "right", alt: true, ctrl: true}}>
            <div className="flex flex-row items-end">
              <DragHandleDots2Icon className="inline" height={'1.5rem'} width={'1.5rem'} />
              <HandIcon size="1rem" className="-ml-3 inline" />
            </div>
          </ShortcutRow>
          <ShortcutRow text="Unindent Row" shortcut={{key: "left", alt: true, ctrl: true}}>
            <div className="flex flex-row items-end">
              <DragHandleDots2Icon className="inline" height={'1.5rem'} width={'1.5rem'} />
              <HandIcon size="1rem" className="-ml-3 inline" />
            </div>
          </ShortcutRow>
          {/* <ShortcutRow text="Move Row Up" shortcut={{key: "up", alt: true}}>
            <div className="flex flex-row items-end">
              <DragHandleDots2Icon className="inline" height={'1.5rem'} width={'1.5rem'} />
              <HandIcon size="1rem" className="-ml-3 inline" />
            </div>
          </ShortcutRow>
          <ShortcutRow text="Move Row Down" shortcut={{key: "down", alt: true}}>
            <div className="flex flex-row items-end">
              <DragHandleDots2Icon className="inline" height={'1.5rem'} width={'1.5rem'} />
              <HandIcon size="1rem" className="-ml-3 inline" />
            </div>
          </ShortcutRow> */}
          <ShortcutRow text="Undo" shortcut={{key: "z", ctrl: true }}> <Undo2 /> </ShortcutRow>
          <ShortcutRow text="Redo" shortcut={{key: "Z", ctrl: true, shift: true }}> <Redo2 /> </ShortcutRow>
        </div>
        <DrawerFooter className="flex flex-row justify-center">
          <Button className="w-20" onClick={handleTutorialClick}>Tutorial</Button>
          <DrawerClose className="inline">
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}



const ShortcutRow = ({
  children,
  text,
  shortcut
} : {
  children?: React.ReactNode,
  text: string,
  shortcut?: {
    key: string,
    ctrl?: boolean,
    shift?: boolean,
    alt?: boolean
  }
}) => {


  // return (<Card className="w-full md:w-1/2 lg:w-1/3 py-3 px-6 flex flex-row justify-between hover:opacity-50 transition-opacity cursor-pointer">
  return (<Card className="w-full md:w-1/2 lg:w-1/3 py-3 px-6 flex flex-row justify-between">
    <div> {children} </div>
    <div> {text} </div>
    <div> {shortcut ? <KeyDisplay shortcut={shortcut} /> : <span className="secondary opacity-30">None</span>} </div>
  </Card>)
}

const KeyDisplay = ({ shortcut } : { shortcut: { key: string, ctrl?: boolean, shift?: boolean, alt?: boolean } }) => {

  const keyDisplay = (<>
    {shortcut.ctrl && <><ChevronUp size={'1rem'} /> + </>}
    {shortcut.shift && <><ArrowBigUp size={'1rem'} /> + </>}
    {shortcut.alt && <><Option size={'1rem'} /> + </>}
    {{
      "enter": <CornerDownLeftIcon size={'1rem'} />,
      "right": <ArrowBigRightDash size={'1rem'} />,
      "left": <ArrowBigLeftDash size={'1rem'} />,
      "up": <ArrowBigUpDash size={'1rem'} />,
      "down": <ArrowBigDownDash size={'1rem'} />,
    }[shortcut.key] || shortcut.key}
  </>)

const titleDisplay = (shortcut.ctrl ? "Ctrl + " : "") + (shortcut.shift ? "Shift + " : "") + (shortcut.alt ? "Alt + " : "") + shortcut.key 
  return <Badge className="hover:bg-primary" title={titleDisplay}>{keyDisplay}</Badge>
}