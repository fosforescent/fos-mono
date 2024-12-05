import { AppState, FosReactOptions, FosPath } from "@/shared/types"
import { DefaultBreadcrumbComponent } from "./breadcrumb"
import { FosStore } from "@/shared/dag-implementation/store"
import { FosExpression } from "@/shared/dag-implementation/expression"



import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger

} from "../ui/dropdown-menu"
import { Globe2, Home, Users } from "lucide-react"
import { FosNode } from "@/shared/dag-implementation/node"


export const DefaultBreadcrumbsComponent = ({ 
  setData,
  options,
  expression,
} : {
  options: FosReactOptions
  expression: FosExpression
  setData: (state: AppState) => void
}) => {


  // TODO: if route is long, collapse

  // if route is long, just slice the first and last 

  const setFosAndTrellisData = (state: AppState["data"]) => {
    setData({
      ...data,
      data: state
    })
  }

  
  
  // const groups: FosExpression[] = expression.getChildrenMatchingPattern(store.primitive.groupField, store.primitive.unit)

  const isEveryoneGroup = true

  const groupDropdownIcon = nodeRoute.length === 0 
    ? <Home />
    : (isEveryoneGroup) 
      ? <Globe2 />
      : <Users />




  return (<div className='flex w-full px-2 items-center overflow-x-scroll no-scrollbar py-2'>
        <DropdownMenu >
      <DropdownMenuTrigger className={`w-200`}>{groupDropdownIcon}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          {/* {groups.map((group: FosExpression) => {

            const id = group.targetNode.getUuid()
            const name = group.targetNode.value.data.group?.name || '<No name>'

            return <DropdownMenuItem key={id}>{name}</DropdownMenuItem>

          })} */}

        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    {nodeRoute.map((item, index) => {
      

      const breadcrumbNodeRoute: FosPath = nodeRoute.slice(0, index + 1) as FosPath


      return (<div>


      <DefaultBreadcrumbComponent 
        key={index} 
        data={data}
        setData={setData}
        nodeRoute={breadcrumbNodeRoute}
        options={options}
          /></div>)
    })}
</div>)

}


