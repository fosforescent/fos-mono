import { AppState, FosReactOptions, } from "@/fos-combined/types"







export const DefaultLoadingComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {



  return (<div>Loading</div>)
}