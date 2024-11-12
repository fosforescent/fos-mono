import React, { useEffect, useState } from 'react'


import { ComboboxEditable } from '../combobox/comboboxEditable'

import _  from 'lodash'
import { useWindowSize } from '../window-size'
import { suggestOption } from '../../lib/suggestOption'
import { 
  FosNodeModuleName, 
  fosNodeModules, 
  fosResourceModules, 
  FosModuleName, 
  fosModuleNames, 
  FosModule, 
  FosResourceModuleName, 
} from '../modules/fosModules'

import { ChevronDownCircleIcon, ChevronRightCircleIcon, ChevronLeftCircleIcon, DiscIcon } from 'lucide-react'

import { CaretSortIcon } from '@radix-ui/react-icons'
import { AppState, FosReactOptions } from '@/fos-combined/types'

export const RowBody = ({ 
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



  const getDescription = (node: IFosNode) => {
    const data = node.getData()
    return data.description?.content || ""
  }


  
  const getOptions = (node: IFosNode) => {
    if (node.getNodeType() === 'option'){
      return node.getChildren().map((child, index) => {
        return ({value: index.toString(), label: getDescription(child)})
      })
    }else if (node.getNodeType() === 'workflow'){
      return [{value: '0', label: getDescription(node)}]
    }else if (node.getNodeType() === 'todo'){
      return [{value: '0', label: getDescription(node)}]
    } else{
      console.log('node', node)
      throw new Error('getoptions must be used on a workflow, option, or todo node')
    }
  }


  if (!global){
    throw new Error('global not defined')
  }


  const options = getOptions(node.fosNode())


  // console.log('step', node.getNodeId(), nodeOptions)

  const selectedIndex = node.getData().option?.selectedIndex || 0
  const locked = false

  const moduleKey = node.getNodeType() as FosModuleName
  // console.log('moduleKey', moduleKey, fosNodeModules[moduleKey as FosNodeModuleName], fosResourceModules[moduleKey as FosResourceModuleName])

  // console.log('rowBody', node.getNodeType(), global?.modules, global?.modules?.find( m => m.name === moduleKey))

  const nodeModule = (fosNodeModules[moduleKey as FosNodeModuleName] || fosResourceModules[moduleKey as FosResourceModuleName]) as (FosNodeModule | FosResourceModule) | undefined
  const ModuleRowComponent = nodeModule?.RowComponent || (() => <div>no row component</div>)
  const isOption = node.getNodeType() === 'option'



  if(selectedIndex === undefined) {
    console.log('selectedOption', options)
  }


  const trellisChildren = meta.trellisNode.getChildren()
  
  const selectedChild = trellisChildren[selectedIndex]

  if (isOption && !selectedChild){
    return <></>
    console.log('no selected child', selectedIndex, trellisChildren, meta.trellisNode, node.getChildren())
    throw new Error('no selected child')
  }



  // console.log('row display', node.getNodeType(), ModuleRowComponent)
  const isCollapsed = isOption ? selectedChild?.isCollapsed() : meta.trellisNode.isCollapsed()

  const isOptionCollapsed = isOption ? meta.trellisNode.isCollapsed() : false
  const children = (isOption) 
    ?  isOptionCollapsed 
      ? (selectedChild?.getChildren() || [])
      : []
    : node.getChildren() 

  // console.log('children', children, isOptionCollapsed, isOption, node.getNodeType(),  node.getData(), selectedChild?.getChildren())

  const suggestOptions = async (node: IFosNode) => {
    global?.promptGPT && suggestOption(global.promptGPT, node)
  }

  
  const handleUndo = () => {
    global.undo && global.canUndo && global.undo()
  }

  const handleRedo = () => {
    global.redo && global.canRedo && global.redo()
  }


  const handleSuggestOption = async () => {
    suggestOptions(node.fosNode())
  }
  
  
  const handleTextEdit = (value: string, focusChar: number | null) => {
    node.setData({description: {content: value}})
    meta.trellisNode.setFocus(focusChar)
  }

  const handleChange = (value: string) => {
    node.setData({option: {selectedIndex: parseInt(value)}})
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyUpEvents(e)


    // if (e.altKey && e.ctrlKey){
    //   console.log('test', selectedIndex, node.getChildren().length );
    //   handleChange( selectedIndex ? ( (selectedIndex - 1 + (children.length)) % children.length ).toString() : "0" )
    // }

  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyDownEvents(e)
  }

  const handleAddOption = () => {
    // console.log('addOption')
    // addOption()
  }

  const handleDeleteOption = (index: number) => {
    // console.log('deleteOption', index)
    // deleteOption(index)
  }

  const handleToggleCollapse = () => {
    meta.toggleCollapse()
  }
  const toggleOptionCollapse = () => {
    meta.trellisNode.toggleCollapse()
  }


  // const handleGetFo

  const focusChar = meta.trellisNode.hasFocus()
  
  const isDragging = state.draggingNode ===  meta.trellisNode.getId()
  const draggingOver = state.draggingOverNode === meta.trellisNode.getId()

  const value = getDescription(node.fosNode())

  const isRoot = !meta.trellisNode.getParent()

  // console.log('isRoot', isRoot, meta.trellisNode.getId())


  const toggleCollapse = () => {
    if (isOption){
      selectedChild?.toggleCollapse()

    } else {
      meta.trellisNode.toggleCollapse()
    }

  }


  
  const handleZoom = () => {
    // console.log('zooming', node)
    const nodeType = node.getNodeType()
    if (nodeType === 'workflow'){
      meta.trellisNode.setZoom()
      // console.log('zooming', node)
      meta.trellisNode.refresh()
    } else if (nodeType === 'todo'){
      meta.trellisNode.setZoom()
      // console.log('zooming', node)
      meta.trellisNode.refresh()
    } else if (nodeType === 'option'){
      console.log("herea", isOptionCollapsed)
      if (!isOptionCollapsed){
        console.log("herea not collapsed")
        meta.trellisNode.setZoom()
        meta.trellisNode.refresh()
      } else {
        const nodeData = node.getData()
        const selectedIndex = nodeData.option?.selectedIndex || 0
        const nodeOptions = node.getOptions()
        const selectedChild = nodeOptions[selectedIndex]
  
        // console.log('selectedChild', selectedChild, nodeOptions, selectedIndex)
        if (!selectedChild){
          // console.log('option info', node, node.getChildren(), node.getData())
          throw new Error('selectedChild not found')
        }
        const selectedChildRoute = selectedChild.getTrellisRoute()
  
        console.log('selectedChildRoute', selectedChildRoute, state.focusRoute, selectedChildRoute)
        updateState({
          ...state,
          zoomRoute: selectedChildRoute
        })
      } 
    } else {
      throw new Error('zoom not implemented for this node type')
    }
  }

  const handleDeleteRow = () => {
    meta.trellisNode.delete()
  }

  const handleGetFocus = () => {
    updateState({
      ...state,
      focusRoute: meta.trellisNode.getRoute().map(node => node.getId())
    })
  }

  const handleSetFocus = () => {
    meta.trellisNode.setFocus(focusChar)
  }



  const rowDepth = state.rowDepth - (meta.trellisNode.getRoute().length - state.focusRoute.length)


  const nodeDescriptionExpanded = node.getData().description?.content || ""
  const nodeFocusExpanded = focusChar !== null



  return (
    <div className="flex items-center">
  

    <div className={`left-box cursor-pointer`} style={{
      width: '1rem'
      
    }} onClick={handleZoom} >
      
        {/* <MenuComponent 
          node={node} 
          /> */}
        <DiscIcon
          width={'1rem'}
          height={'1rem'}
          style={{
            opacity: children.length > 0 ? 1 : .5
          }} />
          
    </div>

    
    <div className={`right-box grow`}>
      <ModuleRowComponent node={node} options={global} meta={meta} state={state} updateState={updateState} />
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

      {rowDepth > 0 && children.length > 0
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




