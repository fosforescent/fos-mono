import { AppState, FosReactOptions, FosPath } from "@/shared/types"
import { DefaultBreadcrumbComponent } from "./breadcrumb"






export const DefaultBreadcrumbsComponent = ({ 
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


  return (<div className='flex w-full px-2 items-center overflow-x-scroll no-scrollbar'>
    {nodeRoute.length > 1 && nodeRoute.map((item, index) => {
      

      const breadcrumbNodeRoute: FosPath = nodeRoute.slice(0, index + 1) as FosPath

      

      return (<DefaultBreadcrumbComponent 
          key={index} 
          data={data}
          setData={setData}
          nodeRoute={breadcrumbNodeRoute}
          options={options}
           />)
    })}
</div>)

}


