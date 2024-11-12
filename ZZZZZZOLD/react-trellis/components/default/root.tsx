import React, { ReactElement, useEffect, useState } from 'react'
import { QuestionMarkCircledIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { Apple, BrainCircuit, CircleEllipsis, DollarSign, Timer, Hammer, Dices, PenBox, ScrollText, FileText, Boxes } from 'lucide-react'

// import { TreeIcon } from '@radix-ui/react-icons'

import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';



import { useWindowSize } from '../window-size';
import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from '@/react-trellis/trellis/types';


export type TrellisRootComponentProps<T extends TrellisNodeInterface<T>, S> = {
  node: T,
  dragging: { id: string, node: T, breadcrumb: boolean } | null,
  disabled: boolean,
  dragOverInfo: { id: string, position: 'above' | 'below' | 'on' | 'breadcrumb', node: T } | null,
  global: S,
  meta: TrellisMeta<T, S>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}


export function DefaultRootComponent<T extends TrellisNodeInterface<T>, S>({
  node: interfaceNode,
  dragging,
  disabled,
  dragOverInfo,
  global,
  meta,
  state,
  updateState
} : TrellisRootComponentProps<T, S>) {


  const node = meta.trellisNode


  const rows = node.getChildren()

  // console.log('root - node', node, context)
  // const value = nodes[leftNode]?.value


  const rowDepth = state.rowDepth
  // console.log('rowDepth', rowDepth)
  // console.log('screen items', )
  // console.log('screen', leftNode, rightNode, trail, nodes, dragging)

  // console.log('root', state)

  const HeadComponent = node.components.head 

  const RowsComponent = node.components.rows
  
  return (<div>
    {<div className={`border-b border-t`}>
      <HeadComponent node={node.getInterfaceNode()} global={global} meta={meta} state={state} updateState={updateState}/>
        {/* <AddOption /> */}
    </div>}
    <div>
      {<RowsComponent 
        rowDepth={rowDepth} 
        dragging={dragging} 
        node={node.getInterfaceNode()} 
        dragOverInfo={dragOverInfo} 
        disabled={disabled} 
        global={global} 
        meta={meta}
        state={state}
        updateState={updateState} 
      />}
    </div>


      {/* {node.data.duration && <GanttComponent root={node} />} */}
      {/* <DataComponent node={node} trail={trail} forceUpdate={forceUpdate} /> */}
      {/* {node.data.cost && <CostComponent root={node} forceUpdate={forceUpdate} />} */}
  </div>)

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


