
import React, { useEffect } from 'react';

import { defaultContext } from './trellis/initialData';
import { getMeta } from './trellis/util'

import Main from './components/trellis/index'
import {  TrellisOptions,  TrellisNodeClass, TrellisNodeInterface, TrellisInterfaceOptions, TrellisDataInterface, TrellisMeta, TrellisSerializedData } from './trellis/types';
import { DefaultTrellisGraph, DefaultTrellisNode } from './components/trellis/graph';



import _ from 'lodash'

import { InputDiv } from './components/inputDiv/inputDiv';

import { 
  TrellisComponents,
  DefaultRowComponent,
  DefaultRowsComponent,
  DefaultRootComponent,
  DefaultHeadComponent,
  DefaultRowBodyComponent,
  DefaultCellComponent,
  DefaultBreadcrumbComponent,
  DefaultBreadcrumbsComponent,
  DefaultLoadingComponent,
  DefaultMenuComponent,
  DefaultActionsComponent,
  TrellisRowComponentProps,
  TrellisRootComponentProps,
  TrellisHeadComponentProps,
  TrellisRowsComponentProps,
  TrellisRowBodyComponentProps,
  TrellisCellComponentProps,
  TrellisBreadcrumbComponentProps,
  TrellisBreadcrumbsComponentProps,
  TrellisLoadingComponentProps,
  TrellisMenuComponentProps,
  TrellisActionsComponentProps  
} from './components/default';

import { useWindowSize } from './components/window-size';
import { TrellisWrapper } from '../../../syc/react-trellis/src/trellis/wrapper';


export const Trellis = <T extends TrellisNodeInterface<T>, U>({
  components,
  data,
  rootNode: propsRootNode,
  setData,
  onMetaUpdate,
  global = undefined,
  viewState,
  theme,
  ...props
} : {
  components?: Partial<TrellisComponents<T, U | undefined>>
  data?: TrellisDataInterface // eslint-disable-line @typescript-eslint/ban-types
  setData?: (data: TrellisDataInterface) => void
  onMetaUpdate?: (options: TrellisMeta<T, U | undefined>) => void
  global?: U
  viewState?: TrellisSerializedData
  theme?: "light" | "dark" | "system"
  rootNode?: T
}) => {

  // console.log('trellis render')

  const actualComponents: TrellisComponents<T, (typeof global | undefined) > = {
    root: components?.root || DefaultRootComponent,
    head: components?.head || DefaultHeadComponent,
    rows: components?.rows || DefaultRowsComponent,
    row: components?.row || DefaultRowComponent,
    rowBody: components?.rowBody || DefaultRowBodyComponent,
    cell: components?.cell || DefaultCellComponent,
    breadcrumb: components?.breadcrumb || DefaultBreadcrumbComponent,
    breadcrumbs: components?.breadcrumbs || DefaultBreadcrumbsComponent,
    loading: components?.loading || DefaultLoadingComponent,
    menu: components?.menu || DefaultMenuComponent,
    actions: components?.actions || DefaultActionsComponent,
  }



  const windowSize = useWindowSize()

  const rowDepth = React.useMemo(() => {
    // console.log('windowSize', windowSize)
    if (windowSize.width !== undefined){
      return Math.floor( (windowSize.width - 500 )/ 100) 

    } else {
      return 0
    }
  }, [windowSize])

  // console.log('rowDepth', rowDepth, viewState)

  const [state, setState] = React.useState<TrellisSerializedData>(viewState || {
    zoomRoute: [],
    focusRoute: [],
    focusChar: null,
    collapsedList: [],
    rowDepth,
    draggingNode: null,
    draggingOverNode: null,
  })

  useEffect(() => {
    if ( rowDepth !== state.rowDepth){
      setState({
        ...state,
        rowDepth
      })
    }
  }, [rowDepth])

  // console.log('state', state)
  
  const setStateWithLog = (newViewState: TrellisSerializedData) => {
    // console.log('force update', state, newViewState)
    if (!_.isEqual(newViewState, state)) {
      // console.log('force update -- different', state, newViewState)
      setState(newViewState)
    }
  }

  if (propsRootNode) {
    // console.log('rootNode render')
    const wrappedRootNode = new TrellisWrapper<T, (typeof global | undefined)>(propsRootNode, [], [], actualComponents, state, setStateWithLog)
    wrappedRootNode.deserialize(state)

    // console.log('wrappedRootNode', wrappedRootNode)


    const meta = getMeta(wrappedRootNode)

    // console.log('meta', meta)

    return (<Main rootNode={wrappedRootNode} global={global} meta={meta} state={state} updateState={setStateWithLog} options={{
      theme: theme
    
    }} />)
    // return (<CustomTrellis rootNode={propsRootNode} options={options} />)
  } else {
    console.log('data render')
    if (!data) {
      throw new Error('no data')
    }

    const constructedGraph = new DefaultTrellisGraph(data)
    const constructedRootNode = constructedGraph.getRootNode()
    const wrappedRootNode = new TrellisWrapper<DefaultTrellisNode, typeof global>(
      constructedRootNode, 
      [], 
      [], 
      actualComponents as unknown as TrellisComponents<DefaultTrellisNode, typeof global>, 
      state, 
      setStateWithLog
    )
    wrappedRootNode.deserialize(state)

    // console.log('wrappedRootNode', wrappedRootNode)
    // eslint-disable-next-line @typescript-eslint/ban-types

    // eslint-disable-next-line @typescript-eslint/ban-types
    // const typedOptions = options as any // as TrellisOptions<T & ({ content: string }), S | ({}) >

    // eslint-disable-next-line @typescript-eslint/ban-types
    // return (<DefaultTrellis<T & ({ content: string }), S | ({})> data={typedData} options={typedOptions} />)
    

    // eslint-disable-next-line @typescript-eslint/ban-types
    return (<Main rootNode={wrappedRootNode}  meta={getMeta(wrappedRootNode)} global={global} state={state} updateState={setStateWithLog} options={{
      theme: theme
    
    }} />)
  }

}

export type TrellisComponentOptions<T extends TrellisNodeInterface<T>, S> = Partial<TrellisComponents<T, S>>

export { InputDiv}

export type {
  TrellisNodeInterface,
  TrellisComponents,
  TrellisOptions,
  TrellisDataInterface,
  TrellisMeta,
  TrellisRowBodyComponentProps,
  TrellisRootComponentProps,
  TrellisRowComponentProps,
  TrellisHeadComponentProps,
  TrellisRowsComponentProps,
  TrellisCellComponentProps,
  TrellisBreadcrumbComponentProps,
  TrellisBreadcrumbsComponentProps,
  TrellisLoadingComponentProps,
  TrellisMenuComponentProps,
  TrellisActionsComponentProps,
}

