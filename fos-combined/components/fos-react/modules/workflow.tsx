import { ComboboxOptions } from "../../../components/combobox/comboboxOptions"
import { Button } from "@/components/ui/button"
import { PenBox, Wand, Workflow } from "lucide-react"

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
  
  const canPrompt = options?.canPromptGPT && options?.promptGPT

  const handleSuggestMagic = async () => {
    console.log('handleSuggestMagic', options)
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestMagic(options.promptGPT, node.fosNode())
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

  const thisRoute = node.getRoute().map(node => node.getId())



  return (<div className={`grid grid-cols-[1fr,2rem] items-center`}>
    {<WorkflowRowComponent
      node={node}
      options={options}
      meta={meta}
      state={state}
      updateState={updateState}
    />}
    {/* {canPrompt && <Button
            onClick={handleSuggestMagic}
            className={`bg-emerald-900 text-white-900 px-2 shadow-none`}
          >
          <Wand height={'1rem'} width={'1rem'}/>
        </Button>} */}
  </div>)
}




const WorkflowRowComponent = ({ node, options: fosOptions, meta, state, updateState }: FosModuleProps) => {



  const getDescription = (node: IFosNode) => {
    const data = node.getData()
    return data.description?.content || ""
  }


  const options = [{
    value: '0',
    label: getDescription(node.fosNode())
  }]

  const locked = fosOptions.locked || false 



  const children = node.getChildren()



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
    const currentValue = getDescription(node.fosNode())
    console.log('handleTextEdit', value, currentValue)

    console.log('handleTextEdit', value, focusChar)
    const currentFocusChar = state.focusChar
    if (currentValue !== value){
      node.setData({description: {content: value}})
    }
    if (focusChar !== currentFocusChar){
      meta.trellisNode.setFocus(focusChar)
    }
  }

  const handleChange = (value: string) => {
    node.setData({option: {selectedIndex: parseInt(value)}})
  }


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
    // node.
    console.log('keydown', e.key, node, meta.trellisNode.getParent())
    meta.trellisNode.getParent()?.refresh()
  }

  const handleAddOption = () => {
    console.log('click add option')

    const newTaskNode = addOption(meta.trellisNode)
    if (newTaskNode){
      updateState({
        ...state,
        focusRoute: newTaskNode.getRoute().map((node) => node.getId()).concat(newTaskNode.getId()),
        collapsedList: state.collapsedList.concat([newTaskNode.getId()])
      })
    }

    return newTaskNode
 
  }

  const handleDeleteRow = () => {
    meta.trellisNode.delete()
  }


  const handleGetFocus = () => {
    meta.trellisNode.setFocus(focusChar)
  }

  const focusChar = meta.trellisNode.hasFocus()
  
  const isDragging = state.draggingNode ===  meta.trellisNode.getId()

  // console.log('isDragging', state)

  const draggingOver = state.draggingOverNode === meta.trellisNode.getId()

  const value = getDescription(node.fosNode())

  const isRoot = !meta.trellisNode.getParent()

  // console.log('isRoot', isRoot, meta.trellisNode.getId())




  const thisRoute = node.getRoute().map(node => node.getId())

  const thisShouldFocus = _.isEqual(state.focusRoute, thisRoute) 

  const canPrompt = fosOptions?.canPromptGPT && fosOptions?.promptGPT


  return (<div className="flex flex-initial grow" id={`${node.getId()}`}>
    <ComboboxEditableTask 
      className='w-full bg-transparent'
      handleTextEdit={handleTextEdit}
      // handleChange={handleChange}
      suggestOption={canPrompt ? handleSuggestOption : null}
      getFocus={handleGetFocus}
      hasFocus={thisShouldFocus}
      focusChar={focusChar}
      deleteRow={handleDeleteRow}
      isDragging={isDragging}
      draggingOver={draggingOver}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      values={options}
      locked={locked}
      setFocus={handleSetFocus}
      addOption={handleAddOption}
      />

  </div>)
}



export const addOption = (trellisNode: FosTrellisNode): FosWrapper | null => {
  console.log('here1')
  const thisParent = trellisNode.getParent()
  const thisInterfaceNode = trellisNode.getInterfaceNode()
  
  console.log('here2')
  if (!thisParent){
    console.log('thisParent', thisParent  )
    throw new Error('No parent or no parent children')
  }

  const thisInterfaceParent = thisParent.getInterfaceNode()

  const thisInterfaceNodeChildren = thisInterfaceNode.getChildren()
  const newOption = thisInterfaceParent.newChild("option")
  const newTaskNode = newOption.newChild("workflow")
  console.log('here3')
  // const newTrellisOptionNode = thisParent.newChild(newOption);
  const newParentChildren = thisInterfaceParent.getChildren().filter((node) => node.getId() !== thisInterfaceNode.getId())
 
  console.log('here4',  newParentChildren)
  const thisNodeData = thisInterfaceNode.getData()
  console.log('here5')
  newOption.setData({
    ...thisNodeData,
    option: {
      selectedIndex: 0,
    }
  })


  console.log('newOption', newOption, thisParent.getChildren())
  newTaskNode.setChildren(thisInterfaceNodeChildren)

  console.log('here6')

  thisInterfaceParent.setChildren(newParentChildren)  
  console.log('here7', thisParent.getChildren(), newParentChildren, thisParent)

  console.log('newTrellisNode',  thisParent.getChildren())
  thisParent.refresh()
  return newOption
}


const module: FosNodeModule = {
  icon: <Workflow />,
  name: 'workflow',
  HeadComponent: ResourceComponent,
  RowComponent: WorkflowRowComponent,
}

export default module