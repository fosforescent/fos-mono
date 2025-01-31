import { FosExpression } from "@/shared/dag-implementation/expression"
import { FosStore } from "@/shared/dag-implementation/store"
import { AppState, AppStateLoaded, FosPath, FosReactGlobal } from "@/shared/types"
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
  data: AppStateLoaded
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {

  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
      data: state
    })
  }


  console.log("TOP BUTTONS", route, data.data)


  const store = new FosStore({
    fosCtxData: data.data
  })


  const expression = new FosExpression(store, route)


  const { getNodeDragInfo } = getDragAndDropHandlers(expression, options, setFosAndTrellisData)

  const { useDraggableArg, useDroppableArg } = getNodeDragInfo(expression.route)
  
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