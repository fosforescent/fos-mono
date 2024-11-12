import { TrellisNodeClass, TrellisTrail, TrellisNodeInterface, TrellisMeta, TrellisSerializedData } from "@/react-trellis/trellis/types"



export type TrellisBreadcrumbsComponentProps<T extends TrellisNodeInterface<T>, S> = {
  trail: TrellisTrail<T, S>,
  node: T,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on' | 'breadcrumb', node: T } | null,
  dragging: { id: string, node: T, breadcrumb: boolean } | null,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

export const DefaultBreadcrumbsComponent = <T extends TrellisNodeInterface<T>, S>({
  trail,
  node: interfaceNode,
  dragging,
  dragOverInfo,
  global,
  meta,
  state,
  updateState
} : TrellisBreadcrumbsComponentProps<T, S>) => {


  const node = meta.trellisNode


  return (<div className='flex w-full px-2 items-center overflow-x-scroll no-scrollbar'>
    {trail.length > 1 && trail.map((item, index) => {
      

      const breadcrumbNode = trail[index]
      if (!breadcrumbNode) {
        throw new Error('breadcrumbNode is undefined')
      }

      const BreadcrumbComponent = node.components.breadcrumb

      return (<BreadcrumbComponent 
          key={index} 
          node={breadcrumbNode.getInterfaceNode()}
          dragging={dragging} 
          dragOverInfo={dragOverInfo} 
          index={index} 
          global={global}
          meta={meta}
          state={state}
          updateState={updateState}
           />)
    })}
</div>)

}


