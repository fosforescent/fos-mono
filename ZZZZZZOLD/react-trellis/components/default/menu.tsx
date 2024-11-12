
import React, { useEffect, useState } from 'react'



import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"


import { TrashIcon, PlayIcon, Folder, MinusCircleIcon, ChevronDownCircleIcon, ChevronRightCircleIcon, LucideCheck, XIcon, ChevronLeftCircleIcon, CircleEllipsis } from "lucide-react"
import { QuestionMarkCircledIcon, ComponentNoneIcon, Crosshair1Icon, DiscIcon, DragHandleDots2Icon, DotsVerticalIcon, PlusCircledIcon, } from "@radix-ui/react-icons"


import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { CSS } from '@dnd-kit/utilities';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import _, { update } from 'lodash'
import { useWindowSize } from '../window-size'
import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from '@/react-trellis/trellis/types'



export type TrellisMenuComponentProps<T extends TrellisNodeInterface<T>, S> = {
  trellisNode: TrellisNodeClass<T, S>,
  node: T,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}


export function DefaultMenuComponent<T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  global,
  meta,
  state,
  updateState
} : TrellisMenuComponentProps<T, S>) {

  const node = meta.trellisNode

  const [menuOpen, setMenuOpen] = React.useState(false)


  const onLongPress = () => {
    setMenuOpen(true)
  }
  
  const onClick = () => {
    zoom()
    setMenuOpen(false)
  }

  const zoom = () => {
    node.setZoom()
    setMenuOpen(false)
  }

  // const deleteNode = () => {
  //   node.remove()
  //   setMenuOpen(false)
  // }

  const snipNode = () => {
    node.snip()
    setMenuOpen(false)
  }

  const deleteNode = () => {
    throw new Error('Not implemented')

  }


  // const longPressEvent = useLongPress(onLongPress, onClick, defaultOptions);

  const hasChildren = node.getChildren().length > 0

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
                    <Button variant={"destructive"} onClick={deleteNode}><TrashIcon /></Button>
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
          opacity: hasChildren ? 1 : .5
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

