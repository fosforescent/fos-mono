
import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types"
import InputDiv from "../inputDiv/inputDiv"

import { TrashIcon, PlayIcon, Folder, MinusCircleIcon, ChevronDownCircleIcon, ChevronRightCircleIcon, LucideCheck, XIcon, ChevronLeftCircleIcon, CircleEllipsis } from "lucide-react"
import { QuestionMarkCircledIcon, ComponentNoneIcon, Crosshair1Icon, DiscIcon, DragHandleDots2Icon, DotsVerticalIcon, PlusCircledIcon, } from "@radix-ui/react-icons"


export type TrellisRowBodyComponentProps<T extends TrellisNodeInterface<T>, S> = {
  trellisNode: TrellisNodeClass<T, S>,
  node: T,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultRowBodyComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  global,
  meta,
  state,
  updateState
} : TrellisRowBodyComponentProps<T, S>) => {


  const node = meta.trellisNode

  
  const handleChange = (value: string, focusChar: number ) => {
    // console.log('changing', value)
    if (value !== node.getString()){
      node.setString(value)
    }
    if (focusChar !== node.hasFocus()) {
      node.setFocus(focusChar)
    }
  }

  const handleFocus = () => {
    node.setFocus(focusChar)
  }

  const focusChar = node.hasFocus()

  const handleGetFocus = () => {
    return node.setFocus(focusChar)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {

    meta.trellisNode.keyDownEvents(e)
    if(node.hasFocus() === null){
      console.log('keydown with no focus')
      node.setFocus(focusChar)
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    meta.trellisNode.keyUpEvents(e)
  }

  const toggleCollapse = () => {
    node.toggleCollapse()
  }



  
  const handleZoom = () => {
    console.log('zooming', node)
    node.setZoom()
    console.log('zooming2', node)
    node.refresh()
  }

  const children = node.getChildren()

  const rowDepth = state.rowDepth - (node.getRoute().length - state.focusRoute.length)

  return (
    <div className={`flex items-center`} >
      {rowDepth > 0 && children.length > 0
      && (<div className={`right-box `} style={{
        width: '1.5rem',
      }}>

      <div className={`pl-0`}>
        <span 
          onClick={toggleCollapse}
          className={`py-3 cursor-pointer`}
          >
        {node.isCollapsed() ? (<ChevronRightCircleIcon size={'15px'}/>) : (<ChevronDownCircleIcon size={'15px'}/>)}
        </span>
      </div>
    </div>)}
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

    <div className="flex flex-initial grow">
      <InputDiv 
        value={node.getString()}
        placeholder="Note"
        onChange={handleChange}
        onFocus={handleFocus}
        focusChar={focusChar}
        getFocus={handleGetFocus}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        shouldFocus={node.hasFocus() !== null}
      />      
    </div>
  </div>)

}


// function DefaultStepView({

// }) => {

//   <div className="flex flex-initial grow">
//     <InputDiv
//       className={`w-full bg-transparent`}
//       onChange={handleTextEdit}
//       onFocus={registerRecievedFocus}
//       disabled={disabled}
//       focusChar={focusChar}
//       value={node.getString()}
//       placeholder='Enter Note'
//       getFocus={setFocusToHere}
//       style={{

//       }}
//       />

// </div>

// }


