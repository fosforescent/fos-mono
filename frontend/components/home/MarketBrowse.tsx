import { Button } from "@/frontend/components/ui/button"
import { useProps } from "@/frontend/App"
import { getNodeInfo, getNodesOfTypeForPath } from "@/frontend/lib/utils"
import { AppState, FosReactGlobal, FosPath } from "@/shared/types"
import { CheckSquare, Inbox, MessageSquare } from "lucide-react"



export const MarketBrowse = () => {



    /**
     * List of market services
     * 
     * 
     * Find relevant requests
     * 

    * Other user's requests view
     *   - create bid on request
     *     - dropdown searching trhough workflows
     *     - OR create new workflow
     * 
     * 
     * My services
     * Group services
     * All services
     * 
     * My current bid/fulfillment view
     *   - modify bid price
     *   - cancel bid
     *   - modify fulfillment
     *   - complete fulfillment
     *   - cancel fulfillment
     * 
     * Group current bid/fulfillment view
     *   - propose modifications 
     *   - view details 
     * 
     * Group completed bid/fulfillment view
     *  - propose modifications
     *  - view details
     *   - propose rating
     * 
     * My completed bid/fulfillment view
     *   - details
     *   - refund
     *   - rate buyer
     * 
     * 
     * 
     * 
     * click into group row ? 
     * - trellis discussion view
     * 
     */


    
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
    

    
    
    


    const { groups }  = getNodesOfTypeForPath(data.data, route);

    console.log('groups', groups())




    return (<div>

        {groups().map((group, i) => {

            return <MarketServiceRow key={i} data={data} setData={setData} options={options} nodeRoute={group} />
        })}
    </div>)
}


const MarketServiceRow = ({ 
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
}) => {


    const { getGroupInfo } = getNodeInfo(route, data)

    const { name, userProfiles,  } = getGroupInfo()

    return (<div>
        {name}
        <div className={`flex flex-row w-full justify-around items-center`}>
            <Button><MessageSquare /></Button>
            <Button><CheckSquare /></Button>
            <Button><Inbox /></Button>
        </div>
    </div>)

    

}