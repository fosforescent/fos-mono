import React, { ReactElement, useEffect, useState } from 'react'
import { QuestionMarkCircledIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { Apple, BrainCircuit, CircleEllipsis, DollarSign, Timer, Hammer, Dices, PenBox, ScrollText, FileText, Boxes } from 'lucide-react'


import { Button } from '@/components/ui/button';


import { FosModule } from '../modules/fosModules';

import { AppState, FosReactOptions,} from '@/fos-combined/types';

export const RootScreenHead = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {


  /**
   * 
   * Validate value before showing
   * 
   * If value has native value, then apply appropriately to component
   */

  const [showAllActions, setShowAllActions] = React.useState(false)


  if (!options){
    throw new Error('options is undefined')
  }

  // console.log('children', node.getChildren().map((child) => child.getNodeType()))

  const setActiveModule = (module: FosModule | undefined) => {
    // console.log('setActiveModule', module, global)
    options?.setActiveModule && options.setActiveModule(module)
  }


  const handleAllActionsButtonClick = () => {
    if (showAllActions) {
      // if (global?.activeModule !== undefined){
      //   setActiveModule(undefined)
      // } else {
        setShowAllActions(false)  
      // }
    } else {
      setShowAllActions(true)
    }
  }


  const handleModuleClick = (module: FosModule) => {
    // console.log('handleModuleClick', module)
    setActiveModule(module)
    setShowAllActions(false)
  }



  const isRoot = nodeRoute.length === 1

  


  const activeModule = (isRoot && [undefined, "root", "workflow", "todo"].includes(options.activeModule?.name)) ? undefined : options.activeModule

  const homeModules = options?.modules?.filter((module: FosModule) => module.name === 'budget' || module.name === 'import_export') || []

  const availableModules = (isRoot ? homeModules : options?.modules) || []

  const hasModules = availableModules.length > 0

  const HeadComponent = activeModule?.HeadComponent || (() => <></>)

  // console.log('activeModule', activeModule, availableModules, global)

  return (<>
    <div>
      <div>
        <div className={`flex-row flex w-full px-1 bg-card border`}>

          {hasModules && <div className={`pr-3 flex flex-row w-auto  items-stretch`}>
            <div className={`overflow-x-hidden h-full pl-[3px]`}>
              <Button onClick={handleAllActionsButtonClick}  variant='ghost' className='self-center h-full pl-0'>
                {showAllActions 
                  ? <CircleEllipsis className='rotate-90' width={"1rem"} height={"1rem"} />  
                  : <CircleEllipsis className='' width={"1rem"} height={"1rem"}  />}
              </Button>
            </div>
            <div className={`transition-height duration-100 overflow-y-hidden ${!showAllActions ? `h-3` : `h-full`}`}>
              {showAllActions && (

                (availableModules || []).map((module: FosModule, index: number) => {
                  return <Button key={index} onClick={() => handleModuleClick(module)} variant='ghost' className={`h-full overflow-y-hidden ${activeModule?.name === module.name ? 'bg-accent-foreground/20' : 'bg-accent-foreground/50'}`}>{module.icon}</Button>
                })
              )}

            </div>
            </div>}
          <div className={`px-0 flex-grow overflow-x-hidden transition-all duration-500 ${showAllActions ? 'w-none' : ''}`}>
            <HeadComponent nodeRoute={nodeRoute} options={options} data={data} setData={setData} />
          </div>

        </div>
      </div>
    </div>
  </>)
}


