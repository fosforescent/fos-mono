import React, { ReactElement, useEffect, useState } from 'react'
import { QuestionMarkCircledIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { Apple, BrainCircuit, CircleEllipsis, DollarSign, Timer, Hammer, Dices, PenBox, ScrollText, FileText, Boxes } from 'lucide-react'


import { Button } from '@/components/ui/button';


import { FosModule, FosDataModuleName, FosModuleProps, fosDataModules } from './modules/fosModules';
import { FosReactOptions } from '.';



import { TrellisComponents, TrellisHeadComponentProps } from "../../../react-trellis"
import { IFosNode } from '../../../fos-js';
import { FosWrapper } from './fosWrapper';

import { FosReactGlobal } from '../../components/fos';

export const RootScreenHead = ({  
  node,
  global,
  meta,
  state,
  updateState,
  ...props
}: TrellisHeadComponentProps<FosWrapper, FosReactGlobal | undefined>) => {


  /**
   * 
   * Validate value before showing
   * 
   * If value has native value, then apply appropriately to component
   */

  const [showAllActions, setShowAllActions] = React.useState(false)


  if (!global){
    throw new Error('global is undefined')
  }

  // console.log('children', node.getChildren().map((child) => child.getNodeType()))

  const setActiveModule = (module: FosModule | undefined) => {
    // console.log('setActiveModule', module, global)
    global?.setActiveModule && global.setActiveModule(module)
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



  const isRoot = node.getNodeType() === "root"

  // console.log('isRoot', isRoot, global?.activeModule)

  


  const activeModule = (isRoot && [undefined, "root", "workflow", "todo"].includes(global.activeModule?.name)) ? undefined : global.activeModule

  const homeModules = global?.modules?.filter((module: FosModule) => module.name === 'budget' || module.name === 'import_export') || []

  const availableModules = (isRoot ? homeModules : global?.modules) || []

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
            <HeadComponent node={node} options={global} meta={meta.trellisNode.getMeta()} state={state} updateState={updateState} />
          </div>

        </div>
      </div>
    </div>
  </>)
}


