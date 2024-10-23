import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types"



export type TrellisLoadingComponentProps<T extends TrellisNodeInterface<T>, S> = {
  trellisNode: TrellisNodeClass<T, S>,
  node: T,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}



export const DefaultLoadingComponent = <T extends TrellisNodeInterface<T>, S>({
  node,
  global,
  meta,
  state,
  updateState
} : TrellisLoadingComponentProps<T, S>) => {



  return (<div>Loading</div>)
}