import { AppState, FosReactOptions, FosPath } from "@/shared/types"


import {  pathEqual } from "../../shared/utils"
import React from "react"
import { diff } from "@n1ru4l/json-patch-plus"
import { Button } from "../components/ui/button"
import { ExpressionRow } from "../components/expression/ExpressionRow"
import { FosExpression } from "@/shared/dag-implementation/expression"
import { api } from "../api"

import { FosStore } from "@/shared/dag-implementation/store"
import { ExpressionFields } from "../components/expression/ExpressionFields"
import { DefaultBreadcrumbsComponent } from "../components/breadcrumbs/breadcrumbs"
import { TopButtons } from "../components/menu/TopButtons"
import TripleToggleSwitch from "../components/elements/tripleToggle"
import { initialDataState } from "../App"





const setupStore = (store: FosStore) => {


  // add nodes etc

  return store
}


const expectedFinalState = (store: FosStore) => {


  // do mutations etc.

  return store
}




export const FieldTest = () => {

  const store = new FosStore()

  setupStore(store)

  const endData = expectedFinalState(new FosStore({fosCtxData: store.exportContext([]) })).exportContext([])

  const setDataCompare = (newData: AppState) => {

    const resultDiff = diff({left: endData, right: newData.data})
    if (resultDiff){
      console.log('diff', resultDiff)
      console.trace()
      throw new Error('diff found')
    }
  }


  const startData = {
    ...initialDataState,
    data: store.exportContext([]),
  }


  const expression = new FosExpression(store, []) 

  return (<>

    <TopButtons 
      data={startData}

      setData={setDataCompare}
      options={{}}
      nodeRoute={[]}
    />
    <DefaultBreadcrumbsComponent
      data={startData}
      setData={setDataCompare}
      options={{}}
      expression={expression}
      />
    <FieldsetWrapper 
      data={startData}
      setData={setDataCompare}
      options={{}}
      nodeRoute={[]}
    />
  </>)


  // return (
  //   <SearchField 
  //     data={startData}
  //     setData={setDataCompare}
  //     options={{}}
  //     nodeRoute={[]}

  //   />
  // )


  // return (
  //   <NodeRow 
  //     data={startData}
  //     setData={setDataCompare}
  //     options={{}}
  //     nodeRoute={[]}

  //   />
  // )
}




const FieldsetWrapper = ({ 
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

  const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
    setData({ ...data, data: state })
  }



  const store = new FosStore({ fosCtxData: data.data, mutationCallback: setFosAndTrellisData })

  const expression = new FosExpression(store, nodeRoute)

  return (<div>
    <ExpressionFields
      data={data}
      mode={["read", "write"]}
      expression={expression}
      options={options}
      setData={setData}
      depthToShow={1}
    />
  </div>)

}




const SearchField = ({ 
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


  const [searchResults, setSearchResults] = React.useState<string>()



  if (!data.auth.jwt){
    throw new Error('no auth token')
  }

  const handleSearchClick = () => {

    console.log('search click', data.data)


    api(data, setData).authed().postData(data.data).then((response) => {
      console.log('search response', response)
      if(!response){
        throw new Error('no response')
      }
      const newStore = new FosStore({ fosCtxData: response })
      setSearchResults(JSON.stringify(response))
    })

  }

  return (<div>
    <Button onClick={handleSearchClick}>Search</Button>
    {JSON.stringify(searchResults)}
  </div>)




}









/**
 * 
 * If we know the type of the node by the constructor
 * (e.g. "workflow"), then we can use that to switch among components
 * 
 * 
 * otherwise, we need to 
 * 
 * 
 * 
 *  
 */


const OptionField = ({ 
    data,
    setData,
    options,
    expression,
    ...props
  } : {
    options: FosReactOptions
    data: AppState
    expression: FosExpression
    setData: (state: AppState) => void
  }) => {


    const { 
      nodeOptions,
      selectedIndex,
    } = expression.getOptionInfo()
   
    const nodeDescription = expression.getDescription()

    return (
      <div>
        {nodeDescription}

      

      </div>
    )


}
  



export const getOptions = (nodeRoute: FosPath, state: AppStateLoaded["data"]) => {


  

}

export const getOptionInfo = (nodeRoute: FosPath, appData: AppStateLoaded["data"]) => {

  
}


const AddFirstOptionTest = ({ 
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


  // const { getOptionInfo, nodeDescription } = getNodeInfo(nodeRoute, data)




  return (
    <div>
      <div>
      adf
      </div>
    </div>
  )



}


