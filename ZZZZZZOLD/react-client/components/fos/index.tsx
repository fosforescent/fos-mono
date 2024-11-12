import '../../global.css'
import '../../index.css'

import React, { ReactElement, useEffect, useState, forwardRef } from 'react'

import { HomeIcon } from '@radix-ui/react-icons'
import { Button } from "@/components/ui/button"
import { RootScreenHead } from './head'
import { RowBody } from './rowBody'
import {
  useDroppable,

} from '@dnd-kit/core';

import {  FosNodeContent,  FosContextData, FosPath, FosTrail,  IFosNode, FosRootNode } from "@/fos-js";

import { FosModule, fosDataModules, fosResourceModules, fosReportModules, fosNodeModules, fosModules } from './modules/fosModules'
import { defaultContext } from './initialData'
import { Trellis, TrellisNodeInterface, TrellisSerializedData } from '@/react-trellis'
import { suggestOption } from '../../lib/suggestOption'
import { suggestSteps } from '../../lib/suggestSteps'
import { suggestMagic } from '../../lib/suggestMagic'
import { FosWrapper } from './fosWrapper'
import { FosRowsComponent } from './rows'
import { getFosUtilFunctions } from './fosUtilFunctions'

import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'
import { tr } from 'date-fns/locale'
import { useTraceUpdate } from '../../../fos-combined/components/trace-update'

export type FosReactOptions = Partial<{
  canPromptGPT: boolean,
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<{
    choices: {message: { content: string, role: string}, finishReason: string}[]
  }>,
  toast: (toastOpts: {
    title: string, 
    description: string,
    duration: number
  }) => void,
  canUndo: boolean,
  undo: () => void,
  canRedo: boolean,
  redo: () => void,
  activeModule: FosModule,
  setActiveModule: (module: FosModule | undefined) => void,
  activeModuleRows: FosModule,
  setActiveModuleRows: (module: FosModule | undefined) => void,
  modules: FosModule[],
  theme: "light" | "dark" | "system",
  locked: boolean
}>

const defaultTrellisData = {
  zoomRoute: [],
  focusRoute: [],
  focusChar: 0,
  collapsedList: [],
  rowDepth: 0,
  draggingNode: null,
  draggingOverNode: null,
}

export const MainView = ({ 
  data,
  setData,
  options,
} : {
  data: {
    fosData: FosContextData | undefined,
    trellisData: TrellisSerializedData | undefined
  },
  setData: (data: {
    fosData: FosContextData,
    trellisData: TrellisSerializedData
  }) => void,
  options?: FosReactOptions
}) => {

  // console.log('rerender fosreact - DATA', data)

  const memoizedData: {
    fosData: FosContextData,
    trellisData: TrellisSerializedData
  } = useDeepCompareMemoize(data ? {
    fosData: (data.fosData && Object.keys(data.fosData).length > 0) ? data.fosData : defaultContext,
    trellisData: data.trellisData || defaultTrellisData
  } : {
    fosData: defaultContext,
    trellisData: defaultTrellisData
  })

  // console.log('memoizedData', memoizedData, data)

  const stateDataDispatch = (newData: { fosData: FosContextData, trellisData: TrellisSerializedData}) => {
    console.log('stateDataDispatch', newData)
    setData(newData)
  }


  // console.log('theme', options?.theme)

  useEffect(() => {
    // console.log('memoized data changed', data)
  }, [memoizedData])


  useEffect(() => {
    // console.log('set data changed', data)
  }, [setData])

  const [activeModule, setActiveModule] = useState<FosModule | undefined>(fosDataModules.description)

  const setActiveModuleWithLog = (module: FosModule | undefined) => {
    // console.log('setActiveModule', module)
    setActiveModule(module)
  }

  const optionsWithModule = {
    ...(options || {}),
    activeModule,
    setActiveModule: setActiveModuleWithLog,
  }

  const global: FosReactGlobal = getGlobal(optionsWithModule || { activeModule: fosDataModules.description })

  const theme = options?.theme ? options.theme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"


  const rootNode = React.useMemo(() => {

    // console.log('dataToUse', dataToUse)
    const setDataWithLog = (newData: {
      fosData: FosContextData,
      trellisData: TrellisSerializedData
    }) => {
      console.log('setData - fosreact main', newData)
      setData(newData)
    }

    // console.log('NEW FOSROOTNODE', memoizedData.fosData)

    const fosRootNode = new FosRootNode(memoizedData.fosData, async (newData) => setDataWithLog({...memoizedData, fosData: newData }))
    // console.log("fosRootNode", fosRootNode)
    const wrappedRootNode = new FosWrapper(fosRootNode)
    return wrappedRootNode
  }, [memoizedData, setData])

  React.useEffect(() => {
    if (data){
      // console.log('state2-d', data)
    }
  }, [memoizedData])

  const trellisViewState = Object.keys(memoizedData.trellisData).length > 0 ? memoizedData.trellisData :  {
    zoomRoute: [],
    focusRoute: [],
    focusChar: 0,
    collapsedList: [],
    rowDepth: 0,
    draggingNode: null,
    draggingOverNode: null,
  }
  
  // console.log('trellisViewState', trellisViewState)

  // useTraceUpdate({ memoizedData, trellisViewState, global, theme })

  return (
    <div className={`w-full fos-root ${theme}`} >
        <Trellis
          rootNode={rootNode}
          components={{
            head: RootScreenHead,
            // row: FosRowComponent,
            rows: FosRowsComponent,
            rowBody: RowBody,
          }}
          viewState={trellisViewState}
          // utilFunctions={getFosUtilFunctions()}
          global={global || {}}
          theme={theme}
        />
    </div>)
}


export default MainView

const getPromptActions = (promptGPT: (systemPrompt: string, userPrompt: string, options?: {
  temperature?: number | undefined;
}) => Promise<{
  choices: {
      message: {
          role: string;
          content: string;
      };
      finishReason: string;
  }[];
}>) => {
  return {
    suggestOptions: async (node: IFosNode) => await suggestOption(promptGPT, node),
    suggestSteps: async (node: IFosNode) => await suggestSteps(promptGPT, node),
    suggestMagic: async (node: IFosNode) => await suggestSteps(promptGPT, node), 
  }
}



const getGlobal = (options: FosReactOptions): Partial<FosReactOptions> => {
  // console.log('options', options)
  const global = {
    ...( options && options?.canPromptGPT && options?.promptGPT ? {
      canPromptGPT: true,
      promptGPT: options.promptGPT,
    } : {
      canPromptGPT: false,
    }),
    ...( options && options?.canRedo ? { canRedo: true } : { canRedo: false }),
    ...( options && options?.canUndo ? { canUndo: true } : { canUndo: false }),
    ...( options && options?.canRedo ? { redo: options.redo } : {}),
    ...( options && options?.canUndo ? { undo: options.undo } : {}),
    ...( options ? { toast: options.toast } : {}),
    ...( options ? { theme: options.theme } : {}),
    ...( options ? { activeModule: options.activeModule || fosDataModules.description } : { activeModule: fosDataModules.description }),
    ...( options ? { activeModuleRows: options.activeModuleRows || fosDataModules.description } : { activeModuleRows: fosDataModules.description }),
    ...( options ? { setActiveModule: options.setActiveModule } : {}),
    ...( options ? { setActiveModuleRows: options.setActiveModuleRows } : {}),
    ...( { modules: [...(options.modules || []), ...Object.values({
      ...fosDataModules,
      ...fosResourceModules,
      ...fosReportModules,
      ...fosNodeModules,
    })] } ),
    ...( options ? { locked: options.locked } : { locked: false }),
  }

  return global
}

export type FosReactGlobal = ReturnType<typeof getGlobal>

const isEqual = (a: any, b: any) => {
  // console.log('isEqual', a == b, a === b, diff({ left: a, right: b }),  a, b)
  return !diff({ left: a, right: b })
}

// eslint-disable-next-line @typescript-eslint/ban-types
const useDeepCompareMemoize = <T extends {}>(value: T): T => {
  const ref = React.useRef<T | undefined>();
  if (!ref.current) ref.current = value
  if (!isEqual(value, ref.current)) {
    console.log('data update - A', value, ref.current)
    ref.current = value;
    console.log('data update - B', value, ref.current)
    // throw new Error('data update')
  }
  return ref.current;
};

