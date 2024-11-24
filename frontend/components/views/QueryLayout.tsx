import { Button } from "@/frontend/components/ui/button"
import { useProps } from "@/frontend/App"

import { AppState, FosReactGlobal, FosPath } from "@/shared/types"
import { CheckSquare, Inbox, MessageSquare } from "lucide-react"



export const GroupForum = () => {





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

    const { groups }  = getNodesOfTypeForPath(data.data, route);

    console.log('groups', groups())




    return (<div>

        {groups().map((group, i) => {

            return <GroupRow key={i} data={data} setData={setData} options={options} nodeRoute={group} />
        })}
    </div>)
}


const GroupRow = ({ 
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