import { FosExpression } from "@fosforescent/shared/dag-implementation/expression"
import { FosStore } from "@fosforescent/shared/dag-implementation/store"
import { AppState, AppStateLoaded, FosPath, FosReactGlobal } from "@fosforescent/shared/types"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { getDragAndDropHandlers } from "../drag-drop"
import { Button } from "@/components/ui/button"


export const TopButtons = ({
  data,
  setData,
  options,
  nodeRoute: route,
  ...props
}: {
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


  const canUndo = Boolean(options?.canUndo)
  const canRedo = Boolean(options?.canRedo)

  return (
    <div
      data-testid="top-buttons"
      className="flex items-center gap-2"
      {...props}
    >
      <Button size="sm" variant="outline" disabled={!canUndo}>
        Undo
      </Button>
      <Button size="sm" variant="outline" disabled={!canRedo}>
        Redo
      </Button>
      <Button size="sm">
        New Item
      </Button>
    </div>
  )

}
