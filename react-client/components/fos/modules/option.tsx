import React, { useMemo } from "react"
import { Option, Wand } from "lucide-react"

import { SelectionPath, IFosNode } from "@/fos-js"
import { suggestOption } from "../../../lib/suggestOption"
import { FosNodeModule, FosModuleProps } from "./fosModules"
import { FosReactOptions } from ".."
import { InputDiv } from "../../../components/combobox/inputDiv"
import { TrellisMeta } from "@/react-trellis"
import { ComboboxEditable } from "../../../components/combobox/comboboxEditable"
import { FosWrapper } from "../fosWrapper"
import _ from 'lodash'

import { FosTrellisNode } from "../fosUtilFunctions"
import { CaretSortIcon } from "@radix-ui/react-icons"


const OptionRowComponent = ({  options: fosOptions, meta, state, updateState }: FosModuleProps) => {

  const node = meta.trellisNode.getInterfaceNode()


  const selectedIndex = node.getData().option?.selectedIndex || 0

  
  const getDescription = (node: FosWrapper) => {
    const data = node.getData()
    return data.description?.content || ""
  }


  
  const getOptions = (node: FosWrapper) => {
    if (node.getNodeType() === 'option'){
      // console.log('node', node)
      return node.getOptions().map((child, index) => {
        return ({value: index.toString(), label: getDescription(child)})
      })
    }else if (node.getNodeType() === 'task'){
      return [{value: '0', label: getDescription(node)}]
    }else{
      console.log('node', node)
      throw new Error('getoptions must be used on a task or option node')
    }
  }

  const options = useMemo(() => {

    const theseOptions = getOptions(node)
    // console.log('theseOptions', theseOptions)
    return theseOptions
  }, [state.focusChar, ])


  
  if (selectedIndex >= options.length){
    console.log('no options', options, meta.trellisNode.getInterfaceNode(), selectedIndex, options.length)
    return (<div className="flex flex-initial grow"></div>)
  }
  



  if(selectedIndex === undefined) {
    console.log('selectedOption', options)
  }

  const suggestOptions = async (node: IFosNode) => {
    fosOptions?.promptGPT && suggestOption(fosOptions.promptGPT, node)
  }

  
  const handleUndo = () => {
    fosOptions.undo && fosOptions.canUndo && fosOptions.undo()
  }

  const handleRedo = () => {
    fosOptions.redo && fosOptions.canRedo && fosOptions.redo()
  }


  const handleSuggestOption = async () => {
    suggestOptions(node.fosNode())
  }
  
  
  const handleTextEdit = (value: string, focusChar: number | null) => {
    const currentValue = getDescription(node)
    if (!value && !currentValue){
      throw new Error('value and currentValue are both empty')
      return
    }
    meta.trellisNode.setFocus(focusChar)
    console.log('handleTextEdit', node)
    const selectedIndex = node.getData().option?.selectedIndex || 0
    const options = node.getOptions()
    const selectedNode = options[selectedIndex]
    if (!selectedNode){
      console.log('options', options, node)
      throw new Error('selectedNode not found')
    }
    selectedNode.setData({description: {content: value}})
    // node.setData({description: {content: value}})
    // console.log('handleTextEdit', value, focusChar, node)
  }

  const handleTextChangeExpanded = (value: string, focusChar: number | null) => {
    node.setData({
      description: {
        content: value,
      }
    })
    meta.trellisNode.setFocus(focusChar)
  }

  const handleChange = (value: string) => {
    node.setData({option: {selectedIndex: parseInt(value)}})
  }


  const handleSetFocus = (newFocusChar: number) => {
    throw new Error('handleSetFocus not implemented')
    meta.trellisNode.setFocus(newFocusChar)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    meta.trellisNode.keyUpEvents(e)

    // console.log('keybup', focusChar, value.length)
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

  const handleAddOption = () => {

    const newTaskNode = addOption(meta.trellisNode)

    console.log("add option")

    if (!newTaskNode){
      console.log('newTaskNode', newTaskNode)
      throw new Error('newTaskNode is null')
    }

    const newOptionRoute = newTaskNode.getRoute().map(node => node.getId())

    updateState({
      ...state,
      focusRoute: newOptionRoute.concat(newTaskNode.getId()),
    })

    return newTaskNode
  }

  const handleDeleteRow = () => {
    meta.trellisNode.delete()
  }
  
  const handleDeleteOption = () => {
    meta.trellisNode.delete()
  }


  const handleGetFocus = () => {
    meta.trellisNode.setFocus(focusChar)
  }

  const focusChar = meta.trellisNode.hasFocus()
  
  const isDragging = state.draggingNode ===  meta.trellisNode.getId()
  const draggingOver = state.draggingOverNode === meta.trellisNode.getId()

  const value = getDescription(node)

  const isRoot = !meta.trellisNode.getParent()



  const thisRoute = node.getRoute().map(node => node.getId())

  const thisShouldFocus = _.isEqual(state.focusRoute, thisRoute)

  // if (options.length < 1){
  //   console.log('options', options, node.fosNode())
  //   throw new Error('options.length < 1')
  // }
  const canPrompt = fosOptions?.canPromptGPT && fosOptions?.promptGPT

  // console.log('canPrompt', node, meta.trellisNode)

  const isCollapsed = meta.trellisNode.isCollapsed()


  const nodeDescriptionExpanded = node.getData().description?.content || ""
  const nodeFocusExpanded = focusChar !== null
  const locked = fosOptions.locked || false

  const toggleCollapse = () => {
    meta.trellisNode.toggleCollapse()
  }


  return (<div className="flex flex-initial grow">

    {isCollapsed ? <ComboboxEditable
      className='w-full bg-transparent'
      handleTextEdit={handleTextEdit}
      handleChange={handleChange}
      suggestOption={canPrompt ? handleSuggestOption : null}
      getFocus={handleGetFocus}
      hasFocus={!!thisShouldFocus}
      // shouldFocus={thisShouldFocus}
      focusChar={focusChar}
      deleteOption={handleDeleteOption}
      // deleteRow={handleDeleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      selectedIndex={selectedIndex}
      values={options}
      locked={fosOptions.locked || false }
      setFocus={handleSetFocus}
      // defaultValue={selectedNodeDescription}
      defaultValue={selectedIndex.toString()}
      addOption={handleAddOption}
      /> : 
      <InputDiv

        disabled={locked}
        shouldFocus={nodeFocusExpanded}
        placeholder={"Enter task description"}
        className="rounded-r-none w-full cursor-text grow"
        value={nodeDescriptionExpanded} 
        style={{
          width: 'calc(100% - 1.25rem)',
          fontSize: '1rem',
          fontWeight: 'normal',
          height: 'auto',
          border: '1px solid rgba(23, 20, 20, .3)',
        }}
        getFocus={handleGetFocus}
        onChange={handleTextChangeExpanded}
        onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
        // onKeyDown={}
        // onKeyUp={onKeyUp}
        focusChar={focusChar}

      />}

  </div>)
}



export const addOption = (trellisNode: FosTrellisNode): FosWrapper | null => {
  const fosOptionNode = trellisNode.getInterfaceNode()

  const currentOptionData = fosOptionNode.getData()
  const newIndex = fosOptionNode.getChildren().length - 1
  const fosTaskNode = fosOptionNode.newChild('task')

  const newChild = fosOptionNode.addOption()
  fosOptionNode.setData({
    ...currentOptionData, 
    option: {
      selectedIndex: newIndex
    }
  })

  fosOptionNode.fosNode().handleChange()


  return newChild
}


const module: FosNodeModule = {
  icon: <Option />,
  name: 'option',
  RowComponent: OptionRowComponent,
}

export default module