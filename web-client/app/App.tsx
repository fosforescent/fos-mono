
import React, { useEffect, useState } from 'react'


import { useViridian, ViridianApp, } from '@/viridian-react'
import FosReact, { FosContextData, FosNodeContent, FosTrail, FosPath, FosNodesData, FosReactOptions } from '@/react-client'
import { useTraceUpdate } from '../components/trace-update'
import { TutorialDialog } from '../components/dialog/TutorialDialog'
import { HelpDrawer } from '../components/dialog/HelpDrawer'
import { useDataState } from '../components/data-state/data-state'

import {
  CheckCircle2,
  CircleEllipsis,
  Undo2,
  Redo2,
  // MenuSquare,
  Menu,
  Send
} from 'lucide-react'
import { DataState } from '../components/data-state'

declare const __SYC_API_URL__: string;
const SYC_API_URL = __SYC_API_URL__




function AppInner({
  showTutorial,
  setShowTutorial
}: {
  showTutorial: boolean
  setShowTutorial: (show: boolean) => void
}) {




  const {
    promptGPT, canPromptGPT, toast, theme, data: apiDataState, setData: setApiDataState, loggedIn
  } = useViridian()

  const { 
    fosData, setFosData, redo, undo, canRedo, canUndo, syncAndStore, data
  } = useDataState({
    data: apiDataState,
    setData: setApiDataState,
    loggedIn
  })



  const options: FosReactOptions = {
    canPromptGPT,
    promptGPT,
    undo,
    canUndo,
    redo,
    canRedo,
    toast,
    // modules: {
    //   core: ["workflow", "duration"]
    // }
  }

  useEffect(() => {

    const root = window.document.documentElement
    if (!root) {
      throw new Error ('Root element does not exist in DOM')
    }

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)


  }, [theme])

  const setDataWithLog = (data: FosContextData) => {
    console.log('setting data from CLIENT', data)
    setFosData(data)
  }


  return (<>
    <FosReact data={fosData} setData={setDataWithLog} options={options} />
    <TutorialDialog open={showTutorial} setOpen={setShowTutorial} />
  </>)

}

function App() {


 
  const [showTutorial, setShowTutorial] = useState(false)

  return (<ViridianApp
            // mode={'production'}
            mode={'custom'}
            customApiUrl={__SYC_API_URL__ || 'http://localhost:4000'}
            appDescriptionComponent={<DescriptionComponent />} 
            topBarComponent={<TopButtons />}
            footerComponent={<Footer setShowTutorial={setShowTutorial} showTutorial={showTutorial} />}
          >
      <AppInner setShowTutorial={setShowTutorial} showTutorial={showTutorial} />
    </ViridianApp>)
}

export default App




const TopButtons = () => {

  const {
    promptGPT, canPromptGPT, toast, theme, data: apiDataState, setData: setApiDataState, loggedIn
  } = useViridian()

  const { 
    fosData, setFosData, redo, undo, canRedo, canUndo, syncAndStore, data
  } = useDataState({
    data: apiDataState,
    setData: setApiDataState,
    loggedIn
  })



  const syncData = () => {
    // sync data
    syncAndStore()
  }

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
        if (e.shiftKey) {
          console.log('redo', canRedo)
          if (canRedo){
            e.preventDefault()
            redo()
            e.stopPropagation()
          }
        } else {
          if(canUndo){
            e.preventDefault()
            undo()
            e.stopPropagation()
          }
        }
      }
      if (e.key === 's' && e.ctrlKey) {
        e.preventDefault()
        syncAndStore()
      }
      if (e.key === 'escape') {
        console.log('escape')
        // set path to home
      }
    }

    document.addEventListener('keydown', handleGlobalKey)

    return () => {
      document.removeEventListener('keydown', handleGlobalKey)
    }
  }, [canRedo, canUndo, undo, redo, syncAndStore, data])


  const handleUndoClick = () => {
    // console.log('undo')
    if(canUndo){
      undo()
    }
  }

  const handleRedoClick = () => {
    // console.log('redo')
    if(canRedo){
      redo()
    }
  }


  return (<>
    {data.stored 
    ? data.synced 
      ? <span className={`text-teal-100/30`}><CheckCircle2 /></span> 
      : <span className={`text-slate-100/30 cursor-pointer`} onClick={syncData}><CheckCircle2 /></span> 
    : <span className='text-rose-100/30 cursor-pointer' onClick={syncData}><CircleEllipsis /></span>}
  {(canUndo || canRedo) && <span className={`pl-5 ${canUndo ? "hover:text-teal-100/50 text-teal-100/30 cursor-pointer" : "text-slate-200/10"}`} onClick={handleUndoClick}>
    <Undo2 />
  </span>}
  {(canUndo || canRedo) && <span className={`px-3 ${canRedo ? "hover:text-teal-100/50 text-teal-100/30 cursor-pointer" : "text-slate-200/10"}`} onClick={handleRedoClick}>
    <Redo2 />
  </span>}
    </>)

}





const DescriptionComponent = () => {

  return (<>
    <a href='/' target='_blank' className='underline text-slate-400' >Fosforescent</a>&nbsp;
      is trying to become a visual programming language that intertwines human, computer,
      and AI instructions providing you with an interface to make your next steps clear, automate away your tedious tasks, and allow
      efficient decentralized planning and coordination
  </>)
}

const Footer = ({ setShowTutorial, showTutorial } : { setShowTutorial: (show: boolean) => void, showTutorial: boolean }) => {

  
  const [showHelp, setShowHelp] = useState(false)

  return (<div className='flex w-full justify-end'>
  <div className={`opacity-30 hover:opacity-80 transition`}>
    <HelpDrawer open={showHelp} setOpen={setShowHelp} setShowTutorial={setShowTutorial} showTutorial={showTutorial}/>
  </div></div>)
}

