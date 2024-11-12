import { ComboboxOptions } from "../../../components/combobox/comboboxOptions"
import { PenBox } from "lucide-react"

import { SelectionPath, IFosNode } from "../../../../fos-js"
import { suggestOption } from "../../../lib/suggestOption"
import { FosDataModule, FosModuleProps, FosNodeModule, FosNodeModuleName, fosNodeModules } from "./fosModules"
import { FosReactOptions } from ".."
import { InputDiv } from "../../../components/combobox/inputDiv"
import { TrellisMeta } from "@/react-trellis"



const ResourceComponent = ({ node, options, meta, state, updateState }: FosModuleProps) => {


  const handleTextChange = (value: string, focusChar: number | null) => {
    node.setData({
      description: {
        content: value,
      }
    })
    meta.trellisNode.setFocus(focusChar)

  }

  const handleGetFocus = () => {
    meta.trellisNode.setFocus(meta.focus.focusChar)
  }

  const nodeDescription = node.getData().description?.content || ""
  const focusChar = meta.trellisNode.hasFocus()
  const nodeFocus = focusChar !== null
  const locked = options.locked || false

  return (<div>
    {<InputDiv 
      

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



const module: FosDataModule = {
  icon: <PenBox />,
  name: 'workflow',
  HeadComponent: ResourceComponent,
}

export default module