import { ComboboxOptions } from "../../../components/combobox/comboboxOptions"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

import { SelectionPath, IFosNode } from "@/fos-js"
import { suggestOption } from "../../../lib/suggestOption"
import { FosNodeModule, FosModuleProps } from "./fosModules"
import { FosReactOptions } from ".."
import { InputDiv } from "../../../components/combobox/inputDiv"
import { TrellisMeta } from "@/react-trellis"
import { FosWrapper } from "../fosWrapper"
import { ComboboxEditableTask } from "../../../components/combobox/comboboxEditableTask"

const ResourceComponent = ({ node, options, meta }: { node: FosWrapper, options: FosReactOptions, meta: TrellisMeta<FosWrapper, FosReactOptions | undefined> }) => {


  
  const handleSuggestOption = async () => {
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestOption(options.promptGPT, node.fosNode())
      } catch (err) {
        options?.toast && options.toast({
          title: 'Error',
          description: `No suggestions could be generated: ${err}`,
          duration: 5000,
        })

      }
    } else {
      console.error('No authedApi')
      const err =  new Error('No authedApi')
      err.cause = 'unauthorized'
      throw err
    }
  }

  const thisType = node.getNodeType()

  const value = node.getData().description?.content || ""

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
  
  return (<div>
    {<InputDiv
      value={value}
      onChange={handleTextChange}
      placeholder="Task description"
      getFocus={handleGetFocus}
    />}
  </div>)
}


const RootRowComponent = ({ node, options: fosOptions, meta, state, updateState }: FosModuleProps) => {


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error. 
  </div>)
}



const module: FosNodeModule = {
  icon: <Home />,
  name: 'root',
  HeadComponent: ResourceComponent,
  RowComponent: RootRowComponent,

}

export default module