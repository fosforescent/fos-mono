import React from 'react'

import { Button } from '@/components/ui/button';
import { TrashIcon, PlusCircledIcon, MinusIcon, PlusIcon, MagicWandIcon  } from '@radix-ui/react-icons'
import { DragOverlay } from '@dnd-kit/core';
import { useWindowSize } from "../window-size";
import { CircleEllipsis } from "lucide-react";
import {  TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from '../../trellis/types';
import { getMeta } from '@/react-trellis/trellis/util';


export type TrellisRowsComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on' | 'breadcrumb', node: T } | null,
  dragging: { id: string, node: T, breadcrumb: boolean } | null,
  rowDepth: number,
  disabled: boolean,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultRowsComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  dragOverInfo,
  dragging,
  rowDepth,
  disabled,
  global, 
  meta,
  state,
  updateState
} : TrellisRowsComponentProps<T, S>) => {
  
  const parentNode = meta.trellisNode

  // const handleAddNewRow = (index?: number) => {

  //   const newEdgeData = parentNode.getTrailEdge().getDefaultNextEdgeData()
  //   parentNode.addChild(newEdgeData)
    
  // }

  const [showMore, setShowMore] = React.useState(false)

  const rows = parentNode.getWrappedChildren()

  const items = rows.map((node, index) => {

    const nodeId = node.getId()

    return {
      id: `${nodeId}`,
      data: { node: node.getInterfaceNode(), breadcrumb: false },
      breadcrumb: false
    }
  })

  // console.log('rows', rows)

  const windowSize = useWindowSize()
  const isSmallWindow = windowSize.width !== undefined && windowSize.width < 500
  const ActionsComponent = parentNode.components.actions
  return (
  <div>

      {rows.length > 0 && 
        rows.map((childNode , i) => {

    
        
          const RowComponent = childNode.components.row

                
          const item = items[i]

          if (item === undefined) {
            throw new Error('item is undefined')
          }
          
          return (<div key={i} className={` `}>
          {/* <RowComponent key={index} nodes={nodes} left={leftNode} right={rightNode} dragging={dragging} blank={false} updateRow={updateNodes} /> */}
            <div  className="flex w-full">
              {(<RowComponent

                node={childNode.getInterfaceNode()}
                dragItem={item}
                dragging={dragging}
                dragOverInfo={dragOverInfo}
                disabled={disabled}
                rowDepth={rowDepth}
                global={global}
                meta={getMeta(childNode)}
                state={state}
                updateState={updateState}
              />)}
              {/* <DragOverlay>
                {dragging === item.id ? <DragOverlayDisplay 
                  node={node}
                /> : null}
              </DragOverlay> */}
            </div>
          </div>)
      })}
    <ActionsComponent meta={getMeta(parentNode)} node={interfaceNode} global={global} disabled={disabled} state={state} updateState={updateState}/>
  </div>)
}


