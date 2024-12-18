import { Button } from "@/frontend/components/ui/button"
import { useProps } from "@/frontend/App"

import { AppState, FosReactGlobal, FosPath, AppStateLoaded } from "@/shared/types"
import { CheckSquare, Inbox, MessageSquare } from "lucide-react"

import { FosExpression  } from "@/shared/dag-implementation/expression"
import { FosStore } from "@/shared/dag-implementation/store"
import { ExpressionRow } from "../expression/ExpressionRow"
import { get } from "http"



export const QueryView = () => {





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
        setData: (state: AppStateLoaded) => void
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


    const setFosAndTrellisData = (state: AppStateLoaded["data"]) => {
      setData({
        ...data,
        data: state
      })
    }
  
    
    const store = new FosStore({ fosCtxData: data.data, mutationCallback: setFosAndTrellisData})
  
    const expression = new FosExpression(store, route)
  

    const activity = data.data.trellisData.activity
    // const actions = expression.getActions(setFosAndTrellisData)

  
    console.log('queueview', route, data)
  

  
    const routeNodes = expression.getAllDescendentsForActivity(activity)
  
    const pins  = expression.getAllDescendentsForActivity("pins")


    return (<div>

        {pins.map((group, i) => {

            return <ExpressionRow key={i} data={data} setData={setData} options={options} expression={expression} />
        })}
    </div>)
}

