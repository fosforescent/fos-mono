import '../../../global.css'
import '../../../index.css'

import React, { ReactElement, useEffect, useState, forwardRef } from 'react'




import { FosModule, fosDataModules, fosResourceModules, fosReportModules, fosNodeModules, fosModules } from './modules/fosModules'

import Trellis from './trellis/main'


import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'
import { AppState, FosContextData, FosReactGlobal } from '@/fos-combined/types'
import { FosReactOptions } from '@/fos-combined/types'

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
  data: AppState,
  setData: (data: AppState) => void,
  options?: FosReactOptions
}) => {

  // console.log('rerender fosreact - DATA', data)


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


  

  return (
    <div className={`w-full fos-root ${theme}`} >
      <Trellis
        data={data}
        setData={setData}
        options={global}
      />
    </div>)
}




export const getGlobal = (options: FosReactOptions): Partial<FosReactOptions> => {
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



export default MainView


