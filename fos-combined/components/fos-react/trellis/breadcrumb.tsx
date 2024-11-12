
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";



import { AppState, FosNodesData, FosPath, FosReactOptions, FosRoute, } from "@/fos-combined/types";
import { getActions } from "@/fos-combined/lib/actions";


export const DefaultBreadcrumbComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {


  const nodeType = nodeRoute[nodeRoute.length - 1]?.[0]
  const nodeId = nodeRoute[nodeRoute.length - 1]?.[1]

  if (!nodeType || !nodeId){
    throw new Error('nodeType or nodeId is undefined')
  }


  const nodeLabel = `${nodeType}-${nodeId}`  

  // console.log('breadcrumb', nodeId)
  const {
    isOver,
    setNodeRef,
    node: dndNode
   } = useDroppable({
    id: `${nodeLabel}`,
    data: { nodeRoute: nodeRoute, breadcrumb: true }
  });

  const nodeContent =  data.data.fosData.nodes[nodeId]

  const { zoom } = getActions(options, data, setData)

  const description = getNodeDescription(nodeRoute, data.data.fosData.nodes)


  const truncatedDescription = description.length > 20 ? description.slice(0, 17) + '...' : description



  const displayString = (nodeRoute.length === 1) ? <HomeIcon height={'1rem'} width={'1rem'}/> :  truncatedDescription
  // console.log('displayString', displayString)


  const handleClick = () => {
    // console.log('handleClick', breadcrumbNode, getRoute(node).map(n => n.getId()), getRoute(node), state)
    zoom(nodeRoute)
  }


  const disabled = nodeRoute.length === data.data.fosData.route.length
  const showChevron = nodeRoute.length !== data.data.fosData.route.length

  const draggingOnThis = data.data.trellisData.draggingNode && data.data.trellisData.draggingOverNode === nodeLabel && !disabled

  // console.log('breadcrumb', draggingOnThis, breadcrumbNode.getId(), dragOverInfo, dndNode, isOver)


  return (<div className={`${draggingOnThis ? "scale-110 py-2 p-0 " : `py-2 p-0`} flex flex-row items-center`}>
    <Button key={nodeRoute.length - 1} onClick={handleClick} variant="secondary" disabled={disabled} className={`px-1`}  ref={setNodeRef}>{displayString}</Button>
    {showChevron && <ChevronRight height={'1rem'} width={'1rem'}/>}
  </div>)
}

const getNodeDescription = (nodeRoute: FosPath, nodes: FosNodesData) => {
  const nodeId = nodeRoute[nodeRoute.length - 1]?.[1]

  if (!nodeId){
    throw new Error('nodeType or nodeId is undefined')
  }

  const nodeContent =  nodes[nodeId]

  if (!nodeContent){
    throw new Error('nodeContent is undefined')
  }

  const description = nodeContent?.data.description?.content

  if (!description){
    throw new Error('description is undefined')
  }

  return description
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
