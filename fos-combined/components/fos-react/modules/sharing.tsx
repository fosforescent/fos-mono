import { ComboboxOptions } from "../../../components/combobox/comboboxOptions"
import { Button } from "@/components/ui/button"
import { Globe, Users2, Lock } from "lucide-react"

import { SelectionPath, IFosNode } from "@/fos-js"
import { suggestOption } from "../../../lib/suggestOption"
import { FosDataModule, FosModuleProps, FosNodeModule, FosNodeModuleName, fosNodeModules } from "./fosModules"
import { FosReactOptions } from ".."
import { InputDiv } from "../../../components/combobox/inputDiv"
import { TrellisMeta } from "@/react-trellis"



const ResourceComponent = ({ node, options, meta, state, updateState }: FosModuleProps) => {


  
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

  const moduleKey = node.getNodeType() as FosNodeModuleName
  // console.log('moduleKey', moduleKey)

  // console.log('rowBody', node.getNodeType(), global?.modules, global?.modules?.find( m => m.name === moduleKey))

  const isShared = true

  return (<div>
    {<Button>
      {isShared ? <Lock /> : <Globe />}&nbsp;{isShared ? `Make Private` : ` Share`}
    </Button>}
  </div>)
}



const module: FosDataModule = {
  icon: <Users2 />,
  name: 'sharing',
  HeadComponent: ResourceComponent,
}

export default module