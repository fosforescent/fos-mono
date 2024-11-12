import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { 
  getRoute,
} from '@/react-trellis/trellis/util'


export type TrellisBreadcrumbComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on' | 'breadcrumb' , node: T } | null,
  dragging: { id: string, node: T, breadcrumb: boolean } | null,
  index: number,
  global?: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultBreadcrumbComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  dragOverInfo,
  dragging,
  meta,
  state,
  updateState,
  index
} : TrellisBreadcrumbComponentProps<T, S>) => {

  const node = meta.trellisNode;

  const breadcrumbNode = getRoute(node)[index]

  if(!breadcrumbNode) {
    throw new Error('breadcrumbNode is undefined')
  }
  
  const nodeId = breadcrumbNode.getId()

  // console.log('breadcrumb', nodeId)
  const {
    isOver,
    setNodeRef,
    node: dndNode
   } = useDroppable({
    id: `${nodeId}`,
    data: { node: breadcrumbNode, breadcrumb: true }
  });


  console.log()

  if(!breadcrumbNode) {
    throw new Error('breadcrumbNode is undefined')
  }

  const truncatedDescription = breadcrumbNode.getString().length > 20 ? breadcrumbNode.getString().slice(0, 17) + '...' : breadcrumbNode.getString()


  const displayString = (index === 0) ? <HomeIcon height={'1rem'} width={'1rem'}/> :  truncatedDescription
  // console.log('displayString', displayString)


  const handleClick = () => {
    // console.log('handleClick', breadcrumbNode, getRoute(node).map(n => n.getId()), getRoute(node), state)
    updateState({ ...state, zoomRoute: getRoute(node).map(n => n.getId()).slice(0, index + 1)})
  }


  const disabled = index === state.zoomRoute.length - 1
  const showChevron = index !== state.zoomRoute.length - 1

  const draggingOnThis = dragging && dragOverInfo?.id === breadcrumbNode.getId() && !disabled

  // console.log('breadcrumb', draggingOnThis, breadcrumbNode.getId(), dragOverInfo, dndNode, isOver)


  return (<div className={`${draggingOnThis ? "scale-110 py-2 p-0 " : `py-2 p-0`} flex flex-row items-center`}>
    <Button key={index + 1} onClick={handleClick} variant="secondary" disabled={disabled} className={`px-1`}  ref={setNodeRef}>{displayString}</Button>
    {showChevron && <ChevronRight height={'1rem'} width={'1rem'}/>}
  </div>)
}



// const BreadcrumbItem = ({
//   index,
//   breadcrumbTrail,
//   item,
//   trail,
//   context,
//   dragging,
//   dragOverInfo,
//   setTrail
// } : {
//   index: number,
//   breadcrumbTrail: FosTrail,
//   item: [string, string],
//   trail: FosTrail,
//   context: FosContext,
//   dragging:  { id: string, node: FosNode } | null,
//   dragOverInfo: { id: string, position: 'above' | 'below' | 'on'} | null,
//   setTrail: (newTrail: FosTrail) => void
// }) => {


//   const node = context.getNode(breadcrumbTrail)
  
//   const nodeId = node.getNodeId()
//   const nodeType = node.getNodeType()

//   const {
//     isOver,
//     setNodeRef,
//     node: dndNode
//    } = useDroppable({
//     id: `${nodeType}-${nodeId}`,
//     data: { node }
//   });

//   // console.log('dndNode', dndNode)

//   // console.log('nodeid', `${nodeType}-${nodeId}`)
//   // console.log('breadcrumbitem', item, breadcrumbTrail, index, trail)


//   const displayNode = context.getNode(breadcrumbTrail)
//   const displayNodeData = displayNode.getOptionContent()

//   const truncatedDescription = displayNodeData.description.length > 20 ? displayNodeData.description.slice(0, 17) + '...' : displayNodeData.description

//   const displayString = (breadcrumbTrail.length === 1) ? <HomeIcon /> :  truncatedDescription
//   // console.log('displayString', displayString)


//   const handleClick = () => {
//     // console.log('handleClick', breadcrumbTrail, item, index, trail)
//     setTrail(breadcrumbTrail)
//   }

//   // console.log('isOver', isOver, dragOverInfo, dragging)



//   // const dndContext = useDndContext();
//   // console.log('dndContext1', dndContext.activeNodeRect)
//   // console.log('dndContext2', dndContext.droppableRects)

//   return (<div className={isOver ? "scale-110 py-0 px-1" : `py-2 px-1`} ref={setNodeRef}>
//     <Button key={index + 1} onClick={handleClick} variant="secondary" disabled={index === trail.length - 1}>{displayString}</Button>
//   </div>)
// }
