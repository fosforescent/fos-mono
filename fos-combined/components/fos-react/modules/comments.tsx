import { ComboboxOptions } from "../../combobox/comboboxOptions"
import { Button } from "@/components/ui/button"
import { MessagesSquare, PenBox, Wand } from "lucide-react"

import { SelectionPath, IFosNode } from "@/fos-js"
import { suggestOption } from "../../../lib/suggestOption"
import { FosNodeModule, FosModuleProps } from "./fosModules"
import { FosReactOptions } from ".."
import { InputDiv } from "../../../components/combobox/inputDiv"
import { TrellisMeta } from "@/react-trellis"

import { ComboboxEditableTask }  from "../../../components/combobox/comboboxEditableTask"
import { FosWrapper } from "../fosWrapper"
import _ from 'lodash'
import { suggestMagic } from "../../../lib/suggestMagic"

import { FosTrellisNode } from "../fosUtilFunctions"

const ResourceComponent = ({ node, options: fosOptions, meta, state, updateState }: FosModuleProps) => {



  const thisType = node.getNodeType()

  const value = node.getData().description?.content || ""


  const handleGetFocus = () => {
    meta.trellisNode.setFocus(meta.focus.focusChar)
  }
  
  // const canPrompt = fosOptions?.canPromptGPT && fosOptions?.promptGPT


  const thisRoute = node.getRoute().map(node => node.getId())


  
  const handleUndo = () => {
    fosOptions.undo && fosOptions.canUndo && fosOptions.undo()
  }

  const handleRedo = () => {
    fosOptions.redo && fosOptions.canRedo && fosOptions.redo()
  }

  

  const handleTextChange = (value: string, focusChar: number | null) => {
    // node.setData({
    //   comments: {
    //     draft: value,
    //   }
    // })
    meta.trellisNode.setFocus(focusChar)

  }


  const nodeDescription = node.getData().description?.content || ""
  const focusChar = meta.trellisNode.hasFocus()
  const nodeFocus = focusChar !== null
  const locked = fosOptions.locked || false

  return (<div className={`grid grid-cols-[1fr,2rem] items-center`}>
    {    <InputDiv
          disabled={locked}
          shouldFocus={nodeFocus}
          placeholder={"Enter task description"}
          className="rounded-r-none w-full cursor-text grow"
          value={nodeDescription} 
          style={{
            width: 'calc(100% - 1.25rem)',
            fontSize: '1rem',
            fontWeight: 'normal',
            height: 'auto',
            border: '1px solid rgba(23, 20, 20, .3)',
          }}
          getFocus={handleGetFocus}
          onChange={handleTextChange}
          onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
          // onKeyDown={}
          // onKeyUp={onKeyUp}
          focusChar={focusChar}
    />}

  </div>)
}




const CommentRowComponent = ({ node, options: fosOptions, meta, state, updateState }: FosModuleProps) => {



  const getDescription = (node: IFosNode) => {
    const data = node.getData()
    return data.description?.content || ""
  }


  const locked = fosOptions.locked || false 



  const children = node.getChildren()




  const handleSetFocus = (newFocusChar: number) => {
    meta.trellisNode.setFocus(newFocusChar)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyUpEvents(e)

    // console.log('keyup', focusChar, value.length)
    if (e.key === 'Enter' && focusChar === value.length){
      meta.trellisNode.moveFocusDown()
    }
    if (e.key === 'Backspace' && focusChar === 0){
      meta.trellisNode.moveFocusUp()
    }
    // if (e.altKey && e.ctrlKey){
    //   console.log('test', selectedIndex, node.getChildren().length );
    //   handleChange( selectedIndex ? ( (selectedIndex - 1 + (children.length)) % children.length ).toString() : "0" )
    // }

  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyDownEvents(e)
  }



  const focusChar = meta.trellisNode.hasFocus()
  
  const value = getDescription(node.fosNode())

  const isRoot = !meta.trellisNode.getParent()

  // console.log('isRoot', isRoot, meta.trellisNode.getId())




  const thisRoute = node.getRoute().map(node => node.getId())

  const thisShouldFocus = _.isEqual(state.focusRoute, thisRoute) 

  const canPrompt = fosOptions?.canPromptGPT && fosOptions?.promptGPT


  return (<div className="flex flex-initial grow" id={`${node.getId()}`}>


  </div>)
}




const module: FosNodeModule = {
  icon: <MessagesSquare />,
  name: 'comment',
  HeadComponent: ResourceComponent,
  RowComponent: CommentRowComponent,
}

export default module