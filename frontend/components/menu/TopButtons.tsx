import { FosExpression } from "@/shared/dag-implementation/expression"
import { FosStore } from "@/shared/dag-implementation/store"
import { AppState, FosPath, FosReactGlobal } from "@/shared/types"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { getDragAndDropHandlers } from "../drag-drop"


export const TopButtons = ({ 
  data,
  setData,
  options,
  nodeRoute: route,
  ...props
} : {
  options: FosReactGlobal
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {

  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
      data: state
    })
  }

  const store = new FosStore({
    fosCtxData: data.data,
    mutationCallback: setFosAndTrellisData
  })


  const expression = new FosExpression(store, route)


  const { getNodeDragInfo } = getDragAndDropHandlers(options, data, setData)
  const { 
    getStyles, 
    nodeItemIdMaybeParent, 
    isDraggingParent, 
    dragging, 
    rowDraggingStyle, 
    rowDroppingStyle,
    useDraggableArg,
    useDroppableArg
  } = getNodeDragInfo(expression.route)

  
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    // transition,
  } = useDraggable(useDraggableArg);


  const {
    setNodeRef: setDropNodeRef,
    isOver,
  } = useDroppable(useDroppableArg);



  const latestGroupFromRoute = null

  const latestBranchFromGroup = null


  return (<div>
    

  </div>)

}