import { Button } from "@/frontend/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend/components/ui/dialog"
import { Input } from "@/frontend/components/ui/input"
import { Label } from "@/frontend/components/ui/label"

import { Switch } from "@/frontend/components/ui/switch"
import { useEffect, useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/frontend/components/ui/tabs"

import {
  Card,
  CardContent,
  CardHeader
} from "@/frontend/components/ui/card"
import { BrainCircuit, ChevronDownCircle, Circle, Disc, Menu, Plus, Redo2, Undo2 } from "lucide-react"
import { CaretSortIcon, PlusCircledIcon } from "@radix-ui/react-icons"

// import {
//   images
// } from '@/assets'

import {
  images
} from "@/frontend/assets"
// import CollapsingUrl from "../../assets/tutorial/Collapsing.gif"
// import GenerateUrl from "../../assets/tutorial/Generate.gif"
// import MovingUrl from "../../assets/tutorial/Moving.gif"
// import OptionsUrl from "../../assets/tutorial/Options.gif"
// import UndoRedoUrl from "../../assets/tutorial/UndoRedo.gif"
// import MessageUrl from "../../assets/tutorial/Message.gif"
// import ZoomUrl from "../../assets/tutorial/Zoom.gif"


export function TutorialDialog({
  open,
  setOpen,
} : {
  open: boolean
  setOpen: (open: boolean) => void
}) {

  const [tab, setTab] = useState("0");


  const onTabChange = (value: string) => {
    setTab(value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full border-none h-dvh" aria-description='Fos Menu'>
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsContent value="0" >
            <Card >
              <CardHeader>
                Adding a task
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.addRowGif} alt="Gif showing adding row" />
                </div>
                <div className="py-3">
                  Either click the <PlusCircledIcon className="inline" /> button or press the return key at the end of a line.  To delete, simply delete all the text in the input and press backspace one more time.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="1">
            <Card >
              <CardHeader>
                Zooming
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.zoomGif} alt="Gif showing zooming" />
                </div>
                <div className="py-3">
                  Click the <Disc className="inline" size="1rem" /> button or press the return key at the end of a line.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="2">
            <Card>
              <CardHeader>
                Collapsing
              </CardHeader>
              <CardContent>
              <h2>Collapsing</h2>
                <div className="py-3">
                  <img src={images.collapsingGif} alt="Gif showing collapsing" />
                </div>
                <div className="py-3">
                  Click the <ChevronDownCircle className="inline" /> button to collapse the nested tasks.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="3">
            <Card>
              <CardHeader>
                Options
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.optionsGif} alt="Gif showing options" />
                </div>
                <div className="py-3">
                  Add a new option by clicking the <CaretSortIcon className="inline" /> button and then the <Plus className="inline" size="1rem"/> button at the bottom, or pressing Alt + Enter.  To delete an option, click the 
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="4">
            <Card>
              <CardHeader>
                Moving tasks
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.movingGif} alt="Gif showing moving" />
                </div>
                <div className="py-3">
                  Ctrl + Alt + Left moves a task up one level, Ctrl + Alt + right moves a task down one level.  You can also drag and drop tasks onto each other to move them.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="5">
            <Card>
              <CardHeader>
                Undo / Redo
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.undoRedoGif} alt="Gif showing undo and redo" />
                </div>
                <div className="py-3">
                  Use Ctrl + Z to undo and Ctrl + Shift + Z to redo, or click the <Undo2 className="inline" /> and <Redo2 className="inline" /> buttons.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="6">
            <Card>
              <CardHeader>
                Generating Suggestions
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.generateGif} alt="Gif showing generating suggestions" />
                </div>
                <div className="py-3">
                  Click the Advanced Menu option <Plus className="inline" /> and then the Suggest button <BrainCircuit className="inline" />.  This will generate a new task based on the current task.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="7">
            <Card>
              <CardHeader>
                Send a message
              </CardHeader>
              <CardContent>
                <div className="py-3">
                  <img src={images.messageGif} alt="Gif showing messages" />
                </div>
                <div className="py-3">
                  If you have any concerns or feedback, don&apos;t hesitate to drop a line.  Open the Hamburger Menu <Menu className="inline" /> and then go down to the Contact section and send a message.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsList className="flex w-full justify-around bg-transparent">
            <TabsTrigger value="0">0</TabsTrigger>
            <TabsTrigger value="1">1</TabsTrigger>
            <TabsTrigger value="2">2</TabsTrigger>
            <TabsTrigger value="3">3</TabsTrigger>
            <TabsTrigger value="4">4</TabsTrigger>
            <TabsTrigger value="5">5</TabsTrigger>
            <TabsTrigger value="6">6</TabsTrigger>
            <TabsTrigger value="7">7</TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}