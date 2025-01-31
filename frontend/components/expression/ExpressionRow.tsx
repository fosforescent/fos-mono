import React, { useEffect, useState } from 'react'


import _, { get, has }  from 'lodash'


import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon, SendHorizonal, PlusIcon, BrainCircuit, CheckIcon, Trash2 } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactGlobal, FosReactOptions, FosPath, AppStateLoaded } from '@/shared/types'
import { cn } from '@/frontend/lib/utils'

import { Card, CardContent, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import InputDiv from '../elements/inputDiv'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'
import { FosExpression } from '@/shared/dag-implementation/expression'
import { getDragAndDropHandlers } from '../drag-drop'
import { ExpressionFields } from './ExpressionFields'
import { FosStore } from '@/shared/dag-implementation/store'



export const ExpressionRow = ({ 
  setData,
  options,
  expression,
  data,
  ...props
} : {
  options: FosReactOptions
  data: AppStateLoaded
  expression: FosExpression
  setData: (state: AppStateLoaded) => void
}) => {


  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }



  // const { 
  //   selectedIndex, 
  //   nodeOptions, 
  //   isOptionChildCollapsed,
  //   selectedOption,
  //   getSelectedNodeInfo, 
  // } = getOptionInfo()

  const [open, setOpen] = React.useState(false)


  const handleChange = (value: string) => {
    expression.setSelectedOption(parseInt(value))
  }

  const handleDeleteOption = (value: string) => {
    expression.deleteOption()
  }

  const emptyMessage = "No options available"



  const {
    getNodeDragInfo
  } = getDragAndDropHandlers(expression, options, setFosAndTrellisData)


  const selectedChild = expression.getSelectedChild()

  const textToDisplay = expression.isOption() ? selectedChild.getDescription() : expression.getDescription()



  return (
    <div className="flex items-center">
  

      <div className={`left-box cursor-pointer`} style={{
        width: '1rem'
        
      }} onClick={expression.updateZoom} >
        
          {/* <MenuComponent 
            node={node} 
            /> */}
          <DiscIcon
            width={'1rem'}
            height={'1rem'}
            style={{
              opacity: expression.hasChildren() ? 1 : .5
            }} />
            
      </div>
      <ExpressionFields
        data={data}
        setData={setData}
        options={options}
        depthToShow={1}
        expression={expression}
        mode={["write", "execute"]}
        />
    
    <div className={`right-box grow flex`}>
     
    </div>

  </div>)

}




