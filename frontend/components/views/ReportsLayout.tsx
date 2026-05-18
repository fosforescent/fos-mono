import { useProps } from "@/App"
import { FosStore } from "@fosforescent/shared/dag-implementation/store"
import { AppStateLoaded, FosPath, FosReactGlobal } from "@fosforescent/shared/types"



export const ReportsView = () => {

  const {
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  }: {
    options: FosReactGlobal
    data: AppStateLoaded
    nodeRoute: FosPath
    setData: (state: AppStateLoaded) => void
  } = useProps()





  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({
      ...data,
      data: state
    })
  }


  const store = new FosStore({ fosCtxData: data.data, mutationCallback: setFosAndTrellisData })







  return (
    <div>
      <h1>Todo Execution View</h1>
    </div>
  )

}