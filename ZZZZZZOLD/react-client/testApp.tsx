import React from 'react'
import ReactDOM from 'react-dom/client'
import Main, { FosContextData } from '.'


import './global.css'
import './index.css'
import { promptGPT } from './promptGPT'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { TrellisSerializedData } from '../react-trellis'
import './testApp.css'

declare const ENV_TOKEN: string;

const TestApp = () => {

  const envToken = localStorage.getItem("token") || ENV_TOKEN || ""

  

  const [state, setState] = React.useState<{
    fosData: FosContextData | undefined, 
    trellisData: TrellisSerializedData | undefined 
  }>({
    fosData: undefined,
    trellisData: {
      zoomRoute: [],
      focusRoute: [],
      focusChar: 0,
      collapsedList: ["option_1"],
      rowDepth: 0,
      draggingNode: null,
      draggingOverNode: null,
    },
  })
  const [token, setToken] = React.useState<string>(envToken)

  React.useEffect(() => {
    if (token){
      localStorage.setItem('token', token)
    }
  }, [token])

  // const [activeModule, setActiveModule] = React.useState<FosModule | undefined>(fosModules.workflow)

  // const setActiveModuleWithLog = (module: FosModule | undefined) => {
  //   console.log('setActiveModule', module)
  //   setActiveModule(module)
  // }

  const updateToken = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    localStorage.setItem('token', value)
    setToken(value)
  }

  const { toast }  = useToast()

  const sendToast = (toastOpts: { title: string, description: string, duration: number } ) => {
    toast({
      title: toastOpts.title,
      description: toastOpts.description,
      duration: toastOpts.duration,
    })
  }


  const updateData = (data: { fosData: FosContextData, trellisData: TrellisSerializedData } ) => {
    // console.log("here1")
    // toast({
    //   title: "Data Updated",
    //   description: "Data has been updated",
    //   duration: 500
    // })
    setState((prevData) => {
      console.log('updateData', Object.keys(prevData?.fosData?.nodes || {}).length,  (Object.keys(data.fosData.nodes || {}).length))
      if (Object.keys(prevData?.fosData?.nodes || {}).length > (Object.keys(data.fosData.nodes || {}).length || 0)
        && Object.keys(data.fosData.nodes || {}).length <= 6
       ){
        return JSON.parse(JSON.stringify(prevData))
      }
      return JSON.parse(JSON.stringify(data))
    })
  }

  React.useEffect(() => {
    if (state){
      console.log('state1', state)
    }
  }, [state])

  return (<div style={{
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  }}>

    <div style={{
      width: "80%",
      height: "80%",
      overflowY: "auto",
      }}>
      <Main 
        data={state} 
        setData={updateData}
        
        options={{
          theme: "light",
          // activeModule,
          // setActiveModule: setActiveModuleWithLog,
          toast: sendToast,
          canPromptGPT: !!token,
          promptGPT: promptGPT,
        }}/>
    </div>
    <div className="border border-black"> 
      <input 
        type="password"
        value={token}
        placeholder='Enter OpenAI API token here'
        onChange={updateToken}
      /> 
    </div>
    <Toaster />
  </div>)
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestApp />
  </React.StrictMode>,
)


const promptGPTMock = async (
  systemPrompt: string, 
  userPrompt: string, 
  options?: { temperature?: number | undefined; } | undefined
): Promise<{ choices: { message: { content: string; role: string; }; finishReason: string; }[]; }> => {

  const optionMatch = userPrompt.match(/(.*)(\n|$)/)
  const subtaskMatch = userPrompt.match(/(.*)(\n|$)/)
  const durationMatch = userPrompt.match(/(.*)(\n|$)/)

  if (optionMatch){
    return {
      choices: [{
        message: {
          content: `Option: ${optionMatch[1]}`,
          role: 'option',
        },
        finishReason: 'complete',
      }]
    }
  }

  if (subtaskMatch){
    return {
      choices: [{
        message: {
          content: `Subtask: ${subtaskMatch[1]}`,
          role: 'subtask',
        },
        finishReason: 'complete',
      }]
    }
  }

  if (durationMatch){
    return {
      choices: [{
        message: {
          content: `Duration: ${durationMatch[1]}`,
          role: 'duration',
        },
        finishReason: 'complete',
      }]
    }
  }

  throw new Error('could not match prompt to any known type')

}
