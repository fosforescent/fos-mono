import { AppState, FosReactOptions, FosPath } from "@/shared/types"
import {  getMockupState } from "./mockupDefaults"


import { optionMockupContextEnd, optionMockupContextStart} from "./optionMockup"
import {  pathEqual } from "../../shared/utils"
import React from "react"
import { diff } from "@n1ru4l/json-patch-plus"
import { Button } from "../components/ui/button"
import { ExpressionRow } from "../components/expression/ExpressionRow"
import { FosExpression, getExpressionInfo } from "@/shared/dag-implementation/expression"
import { api } from "../api"
import { searchMockupContextStart } from "./searchMockup"
import { FosStore } from "@/shared/dag-implementation/store"
import { ExpressionFields } from "../components/expression/ExpressionFields"
import { DefaultBreadcrumbsComponent } from "../components/breadcrumbs/breadcrumbs"
import { TopButtons } from "../components/menu/TopButtons"
import TripleToggleSwitch from "../components/elements/tripleToggle"


export const FieldTest = () => {


  // const [data, setData] = React.useState<AppState>()


  // const startData = getMockupState(optionMockupContextStart)
  const startData = getMockupState(searchMockupContextStart)

  const endData = getMockupState(optionMockupContextEnd)

  const setDataCompare = (newData: AppState) => {

    const resultDiff = diff({left: endData, right: newData})
    if (resultDiff){
      console.log('diff', resultDiff)
      console.trace()
      throw new Error('diff found')
    }
  }




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
      nodeRoute={[]}
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

  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({ ...data, data: state })
  }



  const store = new FosStore({ fosCtxData: data.data, mutationCallback: setFosAndTrellisData })

  const expression = new FosExpression(store, nodeRoute)

  return (<div>
    <ExpressionFields
      expression={expression}
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
    nodeRoute,
    ...props
  } : {
    options: FosReactOptions
    data: AppState
    nodeRoute: FosPath
    setData: (state: AppState) => void
  }) => {


    const {  nodeDescription, getOptionInfo } = getExpressionInfo(nodeRoute, data.data)

    const { 
      nodeOptions,
      selectedIndex,
    } = getOptionInfo()
   


    return (
      <div>
        {nodeDescription}

      

      </div>
    )


}
  



export const getOptions = (nodeRoute: FosPath, state: AppState["data"]) => {


  

}

export const getOptionInfo = (nodeRoute: FosPath, appData: AppState["data"]) => {

  
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


