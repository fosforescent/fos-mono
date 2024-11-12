import { AppState, FosReactOptions } from "@/fos-combined/types"
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
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {


  return (<div className='flex w-full px-2 items-center overflow-x-scroll no-scrollbar'>
    {nodeRoute.length > 1 && nodeRoute.map((item, index) => {
      

      const breadcrumbNodeRoute = nodeRoute.slice(0, index + 1)

      

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


