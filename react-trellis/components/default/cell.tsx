import { TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types";
import { useDroppable } from "@dnd-kit/core";
import { HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";


export type TrellisCellComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on', node: TrellisNodeClass<T, S> } | null,
  dragging: { id: string, node: TrellisNodeClass<T, S> } | null,
  index: number,
  global: S,
  meta: any
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultCellComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  dragOverInfo,
  dragging,
  index,
  global,
  meta,
  state,
  updateState
} : TrellisCellComponentProps<T, S>) => {

  const node = meta.trellisNode
  
  const nodeId = node.getId()

  const {
    isOver,
    setNodeRef,
    node: dndNode
   } = useDroppable({
    id: `${nodeId}`,
    data: { node }
  });




  const truncatedDescription = node.getString().length > 20 ? node.getString().slice(0, 17) + '...' : node.getString()

  const displayString = (node.getRoute().length === 1) ? <HomeIcon /> :  truncatedDescription
  // console.log('displayString', displayString)


  const handleClick = () => {
    // console.log('handleClick', breadcrumbTrail, item, index, trail)
    node.setZoom()
  }


  return (<div className={isOver ? "scale-110 py-0 px-1" : `py-2 px-1`} ref={setNodeRef}>
    <Button key={index + 1} onClick={handleClick} variant="secondary" disabled={index === node.getRoute().length - 1}>{displayString}</Button>
  </div>)
}
