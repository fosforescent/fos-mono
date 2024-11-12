
import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types"
import InputDiv from "../inputDiv/inputDiv"



export type TrellisHeadComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  global: S,
  meta: TrellisMeta<T, S>,
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultHeadComponent = <T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  meta,
  state,
  global,
  updateState
} : TrellisHeadComponentProps<T, S>) => {


  /**
   * 
   * Validate value before showing
   * 
   * If value has native value, then apply appropriately to component
   */



  // console.log('canSuggest', canSuggest, appState.info.subscription?.apiCallsAvailable, appState.info.subscription?.apiCallsUsed, appState.info.subscription, appState.info, appState)

  const handleChange = () => {
    // console.log('handleChange', value)
    // updateState({ ...state, value })
  }

  const getFocus = () => {
    // console.log('getFocus')
  }



  // console.log('activeModule', activeModule, availableModules)

  return (<>
    <div className={`flex-row flex w-full px-1 border-b border-t `}>
      {state.zoomRoute.length > 1 &&  <div className={`px-0 flex-grow overflow-x-hidden transition-all duration-500`}>
        <InputDiv
          value={interfaceNode.getString()}
          onChange={handleChange}
          disabled={false}
          placeholder={'New Row'}
          getFocus={getFocus}
         />
      </div>}
    </div>
  </>)
}


