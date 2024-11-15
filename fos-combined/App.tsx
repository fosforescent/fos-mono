
import React, { useEffect, useState } from 'react'


import { AppState, FosContextData, FosReactGlobal, FosReactOptions,} from './types'
import { useTraceUpdate } from './components/trace-update'
import { TutorialDialog } from './components/dialog/TutorialDialog'
import { HelpDrawer } from './components/dialog/HelpDrawer'
import './global.css'

import {
  CheckCircle2,
  CircleEllipsis,
  Undo2,
  Redo2,
  // MenuSquare,
  Menu,
  Send
} from 'lucide-react'
import { TrellisSerializedData } from './types'



import HamburgerMenu from './components/menu/HamburgerMenu'


import { Toaster } from "@/components/ui/toaster"
import { CookieDialog } from './components/dialog/CookieDialog'
import { PrivacyPolicyDialog } from './components/dialog/PrivacyPolicyDialog'
import { TermsDialog } from './components/dialog/TermsDialog'
import { set } from 'lodash'
import { ConfirmClearData } from './components/dialog/ConfirmClearData'
import { ConfirmDeleteUser } from './components/dialog/ConfirmDeleteUser'
import { ConfirmEmailChange } from './components/dialog/ConfirmEmailChange'
import { ErrorBoundary } from './components/error-boundary'
import { useToast } from '@/components/ui/use-toast';
import { jwtDecode } from 'jwt-decode';
import { api } from './api'
import { FosModule, fosDataModules, fosResourceModules, fosReportModules, fosNodeModules, fosModules } from './components/fos-react/fosModules'

import { defaultContext, defaultTrellisData } from './defaults'

import { MainView } from './components/trellis/main'


declare const __SYC_API_URL__: string;
const SYC_API_URL = __SYC_API_URL__

declare const __DEV_SYC_API_URL__: string;
declare const __PROD_SYC_API_URL__: string;


export const initialInfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "") : undefined,
  emailConfirmed: false,
  subscriptionSession: false,
}




export const initialAuthState = {
  username: "",
  remember: false,
  jwt: JSON.parse(localStorage.getItem("auth") || "null") || null,
  email: "",
  password: "",
  loggedIn: false,
}




export const initialDataState: AppState =  JSON.parse(localStorage.getItem("data") || "null") || {
  synced: false,
  stored: false,
  data: {
    fosData: defaultContext,
    trellisData: defaultTrellisData
  },
  locked: false,
  lastSyncTime: 0,
  lastStoreTime: 0,
  undoStack: [],
  redoStack: [],
  auth: initialAuthState,
  info: initialInfoState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
}




export default function App({
  
}: {
  
}) {

  
  const apiUrl = "http://localhost:4000"
  // const apiUrl = __PROD_SYC_API_URL__
  // const apiUrl = __DEV_SYC_API_URL__

  

  const [showCookieConsent, setShowCookieConsent] = useState(false)

  const [showTerms, setShowTerms] = useState({open: false, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => {}})
  const [showPrivacy, setShowPrivacy] = useState({open: false, fromRegisterForm: false})

  const [showClearData, setShowClearData] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState<{ open: boolean, email: string}>({ open: false, email: ""})

 
  const [ appState, setAppState ] = React.useState<AppState>({...initialDataState, apiUrl})


  useEffect(() => {
    if (appState.auth.jwt){
      setLogout(logOut)
    }
  }, [])


  const emailConfirmationToken = new URLSearchParams(window.location.search).get('confirm-email-token') || undefined
  const passwordResetToken = new URLSearchParams(window.location.search).get('reset-password-token') || undefined


  
  const jwt = localStorage.getItem('auth')

  const {
    username,
    exp
  } = jwt ? jwtDecode(jwt) as { username: string, exp: number } : { username: "", exp: 0 }


  
  useEffect(() => {
    // console.log('apiUrl', apiUrl, props.mode)
  }, [apiUrl])
  

  const [showTutorial, setShowTutorial] = useState(false)



  

  console.log('rerender', )

  // useTraceUpdate({ apiDataState, loggedIn, theme, promptGPT, canPromptGPT, toast, data })
  const authedApi = appState.auth.jwt ? api(apiUrl).authed(appState.auth.jwt) : undefined

  const promptGPT = React.useCallback(async (systemPrompt: string, userPrompt: string, options?: {
    temperature?: number,
    max_tokens?: number,
  }) => {
    if (!appState.auth.jwt) {
      throw new Error('Trying to prompt GPT without being logged in')
    }
    const result = await authedApi?.getSuggestions(systemPrompt, userPrompt, options || {})
    if (!result){
      throw new Error('Error getting GPT suggestions')
    }
    return result.suggestions
  }, [authedApi])

  const canPromptGPT = !!appState.auth.jwt && !!appState.info.subscription && (appState.info.subscription.apiCallsAvailable > appState.info.subscription.apiCallsUsed)


  const rawToast = useToast()

  const options = {
    canPromptGPT,
    promptGPT,

    toast: rawToast.toast,
    // }
  }


  
  const [theme, setTheme] = useState("system")



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
    // console.log('setting theme', theme, root)
  }, [theme])


  const [logOut, setLogout] = useState<() => Promise<void>>(async () => { /* console.log('logout not set') */});


  const setDataWithLog = (data: AppState) => {
    console.log('setting data from CLIENT', data)
    // TODO: change setFosData to handle trellis data too
    // OR --- move trellis data into node data / fos context

    if (data.data.fosData.route.length < 1){
      throw new Error('No route')
    }



    setAppState(data)


  }



  if (appState.data.fosData.route.length < 1){
    throw new Error('No route')
  }


  console.log('rerender web client main')
 
  
  const [showHelp, setShowHelp] = useState(false)



  useEffect(() => {
    // console.log('set data changed', data)
  }, [setAppState])

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


  


 
  return (<><div className="App h-full bg-background" style={{ height: '100%', width: '100%', position: 'relative', textAlign: 'center', margin: '0 auto', overflowX: 'hidden' }}>
      <div style={{textAlign: 'left', boxSizing: 'border-box'}} className='w-full'>
        <HamburgerMenu 
          emailConfirmationToken={emailConfirmationToken} 
          passwordResetToken={passwordResetToken}
          setShowCookieConsent={setShowCookieConsent}
          setShowTerms={setShowTerms}
          setShowPrivacy={setShowPrivacy}
          showCookieConsent={showCookieConsent}
          showTerms={showTerms}
          showPrivacy={showPrivacy}
          showClearData={showClearData}
          showDeleteAccount={showDeleteAccount}
          setShowClearData={setShowClearData}
          setShowDeleteAccount={setShowDeleteAccount}
          setShowEmailConfirm={setShowEmailConfirm}
          data={appState}
          setData={setAppState}
          options={options}
          
          />
        <div className="flex items-center justify-center h-full w-full" style={{overflowX: 'hidden' }}>
        <></>
        <MainView data={appState} setData={setDataWithLog} options={global} />

        
        <TutorialDialog open={showTutorial} setOpen={setShowTutorial} />
      </div>
      </div>
        <div>
        <CookieDialog open={showCookieConsent} setOpen={setShowCookieConsent} data={appState} setData={setAppState} options={options} />
        <PrivacyPolicyDialog open={showPrivacy} setOpen={(isOpen: boolean) => setShowPrivacy({ open: isOpen, fromRegisterForm: false } )} data={appState} setData={setAppState} options={options} />
        <TermsDialog open={showTerms.open} setOpen={(isOpen: boolean) => { setShowTerms({ ...showTerms, open: isOpen }) }} setAcceptTerms={showTerms.setAcceptTerms} data={appState} setData={setAppState} options={options} />
        <ConfirmClearData open={showClearData} setOpen={setShowClearData} data={appState} setData={setAppState} options={options} />
        <ConfirmDeleteUser open={showDeleteAccount} setOpen={setShowDeleteAccount} data={appState} setData={setAppState} options={options} />
        <ConfirmEmailChange open={showEmailConfirm.open} setOpen={(status: boolean) => { setShowEmailConfirm({...showEmailConfirm, open: status}) }} email={showEmailConfirm.email} data={appState} setData={setAppState} options={options} />
      </div>
    </div>
    <div className="w-full relative">
      
    <div className='flex w-full justify-end'>
  <div className={`opacity-30 hover:opacity-80 transition`}>
    <HelpDrawer open={showHelp} setOpen={setShowHelp} setShowTutorial={setShowTutorial} showTutorial={showTutorial}/>
  </div></div>
    </div>
    <Toaster />
    </>)
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
