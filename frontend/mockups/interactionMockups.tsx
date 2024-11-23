import { AppState, FosReactOptions, FosPath } from "@/shared/types"
import {  getMockupState } from "./mockupDefaults"


import { optionMockupContextEnd, optionMockupContextStart} from "./optionMockup"
import {  pathEqual } from "../../shared/utils"
import React from "react"
import { diff } from "@n1ru4l/json-patch-plus"
import { Button } from "../components/ui/button"
import { NodeRow } from "../components/node/NodeRow"
import { getExpressionInfo } from "@/shared/dag-implementation/expression"
import { api } from "../api"
import { searchMockupContextStart } from "./searchMockup"


export const FieldTest = () => {


  const [data, setData] = React.useState<AppState>()


  // const startData = getMockupState(optionMockupContextStart)
  const startData = getMockupState(searchMockupContextStart)

  const endData = getMockupState(optionMockupContextEnd)

  const setDataCompare = (newData: AppState) => {

    const resultDiff = diff({left: endData, right: newData})
    if (resultDiff){
      console.log('diff', resultDiff)
      throw new Error('diff found')
    }
  }



  // return (
  //   <SearchField 
  //     data={startData}
  //     setData={setDataCompare}
  //     options={{}}
  //     nodeRoute={[]}

  //   />
  // )


  return (
    <NodeRow 
      data={startData}
      setData={setDataCompare}
      options={{}}
      nodeRoute={[]}

    />
  )
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


  const [searchResults, setSearchResults] = React.useState<JSX.Element>()



  if (!data.auth.jwt){
    throw new Error('no auth token')
  }

  const handleSearchClick = () => {

    console.log('search click', data.data)


    const authedApi = api(data, setData).authed().postData(data.data)

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


