import { Button } from "@/frontend/components/ui/button"
import { useProps } from "@/frontend/App"

import { AppState, FosReactGlobal, FosPath } from "@/shared/types"
import { CheckSquare, Inbox, MessageSquare } from "lucide-react"
import { getExpressionActions } from "@/shared/expressionActions"
import { FosExpression, getExpressionInfo } from "@/shared/dag-implementation/expression"
import { FosStore } from "@/shared/dag-implementation/store"
import { ExpressionRow } from "../expression/ExpressionRow"
import { get } from "http"



export const BrowseView = () => {





    const { 
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
      } = useProps()
    

    
    /**
     * List of groups
     * 
     * 
     * Add new group menu
     * 
     * Search for friend menu
     *   - create group with friend
     * 
     * Invite friend to group
     *   - drag & drop user into group
     * 
     * 
     * For each group, show a "group row"
     * 
     * click into group row ? 
     * - trellis discussion view
     * 
     */

    const setFosAndTrellisData = (state: AppState["data"]) => {
        setData({
          ...data,
          data: state
        })
    }

    
    const store = new FosStore({ fosCtxData: data.data})
  
    const expression = new FosExpression(store, route)
  

    const actions = getExpressionActions(expression, setFosAndTrellisData)

  
    console.log('queueview', route, data)
  
    const { 
      getNodesOfType, getAllTodos, getAllComments, currentActivity
    } = getExpressionInfo(route, data.data)
  
  
    const routeNodes = getNodesOfType()
  
    const { pins }  = getNodesOfType()


    return (<div>

        {pins().map((group, i) => {

            return <ExpressionRow key={i} data={data} setData={setData} options={options} nodeRoute={group} />
        })}
    </div>)
}

