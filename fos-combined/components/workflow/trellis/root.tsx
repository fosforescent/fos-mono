
import { AppState,FosReactOptions, FosRoute } from '@/fos-combined/types';
import { FosRowsComponent } from './rows';
import { RootScreenHead } from './head';
import { DefaultBreadcrumbsComponent } from '../../breadcrumbs/breadcrumbs';
import React from 'react';



export function DefaultRootComponent({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) {


  const [query, setQuery] = React.useState('')


  return (
    <div className={` bg-background/50 text-primary`}>
      <DefaultBreadcrumbsComponent 
        data={data}
        setData={setData}
        options={options}
        nodeRoute={nodeRoute}
        />
      
      <div className="w-full">
        <div>
          {<div className={`border-b border-t`}>
            <RootScreenHead nodeRoute={nodeRoute} options={options} data={data} setData={setData} />
              {/* <AddOption /> */}
          </div>}
          <div>
            {<FosRowsComponent 
              data={data}
              setData={setData}
              options={options}
              nodeRoute={nodeRoute}
            />}
          </div>

        {/* {node.data.duration && <GanttComponent root={node} />} */}
        {/* <DataComponent node={node} trail={trail} forceUpdate={forceUpdate} /> */}
        {/* {node.data.cost && <CostComponent root={node} forceUpdate={forceUpdate} />} */}
        </div>
      </div>
    </div>
)

}




// export function RootScreenView({
//   context,
//   node,
  
//   dragging,
//   dragOverInfo,
//   // trail,
//   // updateTrail,
//   options: fosReactOptions
// }: {
//   context: FosContext,
//   node: FosNode,
//   dragOverInfo: { id: string, position: 'above' | 'below' | 'on', node: FosNode } | null,

//   dragging:  { id: string, node: FosNode } | null
//   options: FosReactOptions
//   // trail: FosTrail
//   // updateTrail: (trail: FosTrail) => void
// }) {


//   // const availableModules = (Object.keys(fosModules) as FosModuleName[]).map((module: FosModuleName) => fosModules[module as FosModuleName]).filter((module: FosModule) => {
//   //   console.log('module', module.name, module.name !== 'workflow', node.getRoute().length > 1)
//   //   return (node.getRoute().length <= 1) ?  (module.name !== 'workflow') : true 
//   // })

//   const availableModules = (Object.keys(fosModules) as FosModuleName[]).map((module: FosModuleName) => fosModules[module as FosModuleName])
//   // console.log('availableModules', availableModules)
//   // const workflowIsAvailable = availableModules.find((module: FosModule) => module.name === 'workflow')

//   const [activeModule, setActiveModule] = useState<FosModule | undefined >( node.getRoute().length > 1 ? fosModules.workflow : undefined)


//   const rows = node.getChildren()

//   // console.log('root - node', node, context)
//   // const value = nodes[leftNode]?.value



//   const windowSize = useWindowSize()

//   const rowDepth = React.useMemo(() => {
//     if (windowSize.width !== undefined){
//       return Math.floor( (windowSize.width - 500 )/ 100) 
//       // return 1
//     } else {
//       return 0
//     }
//   }, [windowSize])
//   // console.log('rowDepth', rowDepth)
//   // console.log('screen items', )
//   // console.log('screen', leftNode, rightNode, trail, nodes, dragging)


  
//   return (<div>
//     {<div style={{padding: '15px 0px'}}>
//       <RootScreenHead node={node} context={context} activeModule={activeModule} setActiveModule={setActiveModule} availableModules={availableModules} options={fosReactOptions} />
//         {/* <AddOption /> */}
//     </div>}
//     <div>
//       {node.hasMerge() 
//         ? <MergeRowsComponent rowDepth={rowDepth} context={context} dragging={dragging} parentNode={node} dragOverInfo={dragOverInfo} locked={context.locked} activeModule={activeModule} options={fosReactOptions}  />
//         : <RowsComponent rows={rows} rowDepth={rowDepth} context={context} dragging={dragging} parentNode={node} dragOverInfo={dragOverInfo} locked={context.locked} activeModule={activeModule} options={fosReactOptions} />}
//     </div>


//       {/* {node.data.duration && <GanttComponent root={node} />} */}
//       {/* <DataComponent node={node} trail={trail} forceUpdate={forceUpdate} /> */}
//       {/* {node.data.cost && <CostComponent root={node} forceUpdate={forceUpdate} />} */}
//   </div>)

// }


