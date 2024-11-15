import React, { useEffect, useState } from 'react'


import _, { has }  from 'lodash'
import { 
  FosNodeModuleName, 
  fosNodeModules, 
  fosResourceModules, 
  FosModuleName, 
  fosModuleNames, 
  FosModule, 
  FosResourceModuleName, 
} from '../fos-react/fosModules'

import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactOptions, FosRoute } from '@/fos-combined/types'
import { getNodeInfo } from '@/fos-combined/lib/utils'
import { getNodeOperations } from '@/fos-combined/lib/nodeOperations'

export const RowBody = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {


  const { locked, getOptionInfo,
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase,
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren
  } = getNodeInfo(nodeRoute, data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow,
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    toggleOptionCollapse,
    suggestSteps,
    toggleCollapse,
    zoom
  } = getNodeOperations(options, data, setData, nodeRoute)
  




  const moduleKey = nodeType as FosModuleName
  // console.log('moduleKey', moduleKey, fosNodeModules[moduleKey as FosNodeModuleName], fosResourceModules[moduleKey as FosResourceModuleName])

  // console.log('rowBody', node.getNodeType(), global?.modules, global?.modules?.find( m => m.name === moduleKey))

  const nodeModule = (fosNodeModules[moduleKey as FosNodeModuleName] || fosResourceModules[moduleKey as FosResourceModuleName]) as FosModule | undefined
  const ModuleRowComponent = nodeModule?.RowComponent || (() => <div>no row component</div>)






  const isOptionCollapsed = isOption ? isCollapsed : false

 


  return (
    <div className="flex items-center">
  

    <div className={`left-box cursor-pointer`} style={{
      width: '1rem'
      
    }} onClick={zoom} >
      
        {/* <MenuComponent 
          node={node} 
          /> */}
        <DiscIcon
          width={'1rem'}
          height={'1rem'}
          style={{
            opacity: hasChildren ? 1 : .5
          }} />
          
    </div>

    
    <div className={`right-box grow`}>
      <ModuleRowComponent nodeRoute={nodeRoute} options={options} data={data} setData={setData} />
    </div>

    {isOption && <div 
        className="py-1 w-8 flex items-center justify-center cursor-pointer hover:bg-gray-100"
        onClick={toggleOptionCollapse}
        >
        <CaretSortIcon style={{
          padding: '0px 0px 0px 0px',
          transform: !isOptionCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
        }} />
      </div>}

      {depth > 0 && hasChildren
      && (<div className={`right-box `} style={{
          width: '1.5rem',
        }}>

        <div className={`pl-0`}>
          <span 
            onClick={toggleCollapse}
            className={`py-3 cursor-pointer`}
            >
          {isCollapsed ? (<ChevronLeftCircleIcon size={'15px'}/>) : (<ChevronDownCircleIcon size={'15px'}/>)}
          </span>
        </div>
      </div>)}

  </div>)

}




