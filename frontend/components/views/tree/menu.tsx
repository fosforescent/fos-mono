
import React, { useEffect, useState } from 'react'



import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/frontend/components/ui/sheet"


import { TrashIcon, PlayIcon, Folder, MinusCircleIcon, ChevronDownCircleIcon, ChevronRightCircleIcon, LucideCheck, XIcon, ChevronLeftCircleIcon, CircleEllipsis } from "lucide-react"
import { QuestionMarkCircledIcon, ComponentNoneIcon, Crosshair1Icon, DiscIcon, DragHandleDots2Icon, DotsVerticalIcon, PlusCircledIcon, } from "@radix-ui/react-icons"


import { Input } from "@/frontend/components/ui/input"
import { Button } from "@/frontend/components/ui/button"

import { CSS } from '@dnd-kit/utilities';

import _, { update } from 'lodash'
import { AppState, FosReactOptions, FosPath } from '@/shared/types'

import { FosExpression } from '@/shared/dag-implementation/expression'




export function DefaultMenuComponent({
  data,
  setData,
  options,
  expression,
} : {
  data: AppState
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppState) => void
}) {


  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
       data: state
    })
  }


  
   const { selectedIndex, nodeOptions, } = expression.getOptionInfo()
  const [menuOpen, setMenuOpen] = React.useState(false)


  const onLongPress = () => {
    setMenuOpen(true)
  }
  
  const onClick = () => {
    expression.updateZoom()
    setMenuOpen(false)
  }



  // const deleteNode = () => {
  //   node.remove()
  //   setMenuOpen(false)
  // }

  const snipNode = () => {
    expression.snipNode()
    setMenuOpen(false)
  }


  return (
    <>      
      <Sheet  open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger><Button><CircleEllipsis /></Button></SheetTrigger>
          <SheetContent  side={"left"}>
            <SheetHeader>
              Actions
            </SheetHeader>
              <div>
                {/* <div className='w-60' style={{padding: '15px 0'}}>
                  <ChangeInstruction nodes={nodes} leftNode={leftNode} rightNode={rightNode} updateNodes={updateNodes} path={path} setMenuOpen={setMenuOpen}/>              
                </div> */}
                <div className='flex items-center px-3'>
                  <div className='flex w-60 justify-around'>
                    {/* <Button variant={"secondary"} className='bg-emerald-900'><QuestionMarkCircledIcon /></Button> */}
                    {/* <Button variant={"secondary"} className='bg-emerald-900'><PlayIcon /></Button> */}
                    <Button variant={"destructive"} onClick={snipNode}><ComponentNoneIcon /></Button>
                    <Button variant={"destructive"} onClick={expression.removeNode}><TrashIcon /></Button>
                  </div>
  
  
                </div>
              </div>
          </SheetContent>
        </Sheet>
        <Button
          variant={"secondary"}
          style={{ background: 'transparent', padding: '10px 10px 10px 0px'}}
          onKeyDown={(e: any) => { e.stopPropagation(); setMenuOpen(true);}}
          onClick={onClick}
          >
        <DiscIcon  style={{
          opacity: expression.hasChildren() ? 1 : .5
        }} />
        </Button>
 
    </>
  )
}





// export function MenuComponent({
//   node,
//   // allowedChildren,
//   hasChildren,
//   context,

// }: {
//   node: FosNode,
//   hasChildren: boolean
//   context: FosContext
// }) {

//   const [menuOpen, setMenuOpen] = React.useState(false)


//   const onLongPress = () => {
//     setMenuOpen(true)
//   }
  
//   const onClick = () => {
//     zoom()
//   }

//   const defaultOptions = {
//     shouldPreventDefault: true,
//     delay: 500,
//   };


//   const zoom = () => {
//     context.setTrail(node.getRoute())
//   }

//   const deleteNode = () => {
    
//     const newContext = context.deleteNode(node.getRoute())
//     newContext.updateData(newContext.data)
//     setMenuOpen(false)
//   }

//   const snipNode = () => {

  
//     const newContext = context.snipNode(node.getRoute())
//     newContext.updateData(newContext.data)
//     setMenuOpen(false)

//   }



//   // const longPressEvent = useLongPress(onLongPress, onClick, defaultOptions);

//   return (
//     <>      
//       <Sheet  open={menuOpen} onOpenChange={setMenuOpen}>
//           <SheetContent  side={"left"}>
//             <SheetHeader>
//               Actions
//             </SheetHeader>
//               <div>
//                 {/* <div className='w-60' style={{padding: '15px 0'}}>
//                   <ChangeInstruction nodes={nodes} leftNode={leftNode} rightNode={rightNode} updateNodes={updateNodes} path={path} setMenuOpen={setMenuOpen}/>              
//                 </div> */}
//                 <div className='flex items-center px-3'>
//                   <div className='flex w-60 justify-around'>
//                     {/* <Button variant={"secondary"} className='bg-emerald-900'><QuestionMarkCircledIcon /></Button> */}
//                     {/* <Button variant={"secondary"} className='bg-emerald-900'><PlayIcon /></Button> */}
//                     <Button variant={"destructive"} onClick={snipNode}><ComponentNoneIcon /></Button>
//                     <Button variant={"destructive"} onClick={deleteNode}><TrashIcon /></Button>
//                   </div>
  
  
//                 </div>
//               </div>
//           </SheetContent>
//         </Sheet>
//         <Button
//           variant={"secondary"}
//           style={{ background: 'transparent', padding: '10px 10px 10px 0px'}}
//           onKeyDown={(e: any) => { e.stopPropagation(); setMenuOpen(true);}}
//           onClick={onClick}
//           >
//         <DiscIcon  style={{
//           opacity: hasChildren ? 1 : .5
//         }} />
//         </Button>
//       {/* //   <Button
//       //     variant={"secondary"}
//       //     style={{ background: 'transparent', padding: '10px 10px 10px 0px'}}
//       //     onClick={() => setMenuOpen(true)}
//       //     >
//       //     <DotsVerticalIcon />
//       //   </Button> */}
//     </>
//   )
// }

