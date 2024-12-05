import React, { useEffect, useState } from 'react'


import { AppState, AuthState, ContextType, FosContextData, FosReactGlobal, FosReactOptions, FosPath, InfoState,} from '../shared/types'
import { useTraceUpdate } from './hooks/trace-update'
import { TutorialDialog } from './components/dialog/TutorialDialog'
import { HelpDrawer } from './components/dialog/HelpDrawer'




import HamburgerMenu from './components/menu/HamburgerMenu'


import { Toaster } from "@/frontend/components/ui/toaster"
import { CookieDialog } from './components/dialog/CookieDialog'
import { PrivacyPolicyDialog } from './components/dialog/PrivacyPolicyDialog'
import { TermsDialog } from './components/dialog/TermsDialog'
import { ConfirmClearData } from './components/dialog/ConfirmClearData'
import { ConfirmDeleteUser } from './components/dialog/ConfirmDeleteUser'
import { ConfirmEmailChange } from './components/dialog/ConfirmEmailChange'
import { ErrorBoundary } from './components/error-boundary'
import { useToast } from '@/frontend/components/ui/use-toast';
import { jwtDecode } from 'jwt-decode';
import { api } from './api'

import { defaultContext, defaultTrellisData, initialDataState } from '../shared/defaults'

import { Outlet, useOutletContext, useLoaderData, useNavigate } from 'react-router-dom'
import { getActions } from './lib/actions'
import { diff } from '@n1ru4l/json-patch-plus'

import { useLocation } from 'react-router-dom'
import { set } from 'date-fns'
import { getMockEvents, applyMockEvent } from './hooks/mock-events';



export const initialInfoState: InfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "null") : undefined,
  emailConfirmed: false,

}



const parsedJwt = JSON.parse(localStorage.getItem("auth") || "null")

const decodedJwt =  parsedJwt ? jwtDecode(parsedJwt)  as { username: string, exp: number } : { username: "", exp: 0 }
const parsedUsername = JSON.parse(localStorage.getItem("username") || "null")

export const initialAuthState: AuthState = parsedJwt ? {
  username: decodedJwt.username,
  remember: !!parsedUsername,
  jwt: parsedJwt.jwt,
  jwtDecoded: decodedJwt,
  email: decodedJwt.username,
  password: "",
  loggedIn: true,
} : {
  username: decodedJwt.username,
  remember: !!parsedUsername,
  jwt: undefined,
  email: decodedJwt.username,
  jwtDecoded: decodedJwt,
  password: "",
  loggedIn: false,
}




export default function App({
  
}: {
  
}) {

  const apiUrl = window.Fos.apiUrl
  
  
  const [showCookieConsent, setShowCookieConsent] = useState(false)

  const [showTerms, setShowTerms] = useState({open: false, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => {}})
  const [showPrivacy, setShowPrivacy] = useState({open: false, fromRegisterForm: false})

  const [showClearData, setShowClearData] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState<{ open: boolean, email: string}>({ open: false, email: ""})

 

  


  const [ appState, setAppState ] = React.useState<AppState>({...initialDataState, apiUrl})

  const jwt = appState.auth?.jwt


  const emailConfirmationToken = new URLSearchParams(window.location.search).get('confirm-email-token') || undefined
  const passwordResetToken = new URLSearchParams(window.location.search).get('reset-password-token') || undefined



  useEffect(() => {
    if (appState.auth.loggedIn && !jwt){
      if (parsedJwt){
        setAppState({...appState, auth: { ...appState.auth, jwt: parsedJwt }})
      }
      setAppState({
        ...appState,
        auth: {
          ...appState.auth,
          loggedIn: false,
          jwt: undefined,
        }
      })
  
    } else if (!appState.auth.loggedIn && jwt){
      setAppState({
        ...appState,
        auth: {
          ...appState.auth,
          loggedIn: true,
          jwt: jwt,
        }
      })
    }

    

    
  }, [jwt, parsedJwt, appState.auth.loggedIn])


  const location = useLocation();
  const navigate = useNavigate()

  

  

  
  React.useEffect(() => {
    if (!jwt) {
      return
    }
    // console.log('apiUrl', apiUrl, props.mode)
    const handler: EventListener = (e) => {
      console.log('ws message', e)
    }


    if (!window.Fos.ws) {

      window.Fos.ws = new WebSocket(`${apiUrl}/socket/${jwt}`);
      console.log('connecting to', `${apiUrl}/socket/`)
      window.Fos.ws.addEventListener('connected', () => {
        console.log('connected')
        window.Fos.ws.send('hello')
      })
      
      
      window.Fos.ws.addEventListener('message', handler)

      return () => {
        window.Fos.ws.removeEventListener('message', handler)
      }
    } else {
      window.Fos.ws = new WebSocket(`${apiUrl}/socket/${jwt}`);
    }
  }, [apiUrl, jwt])
  

  const [showTutorial, setShowTutorial] = useState(false)



  // console.log('rerender', )

  // useTraceUpdate({ apiDataState, loggedIn, theme, promptGPT, canPromptGPT, toast, data })
  const authedApi = appState.auth.jwt ? api(appState, setAppState).authed() : undefined

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



  // console.log('rerender web client main', appState.data, appState)
 
  
  const [showHelp, setShowHelp] = useState(false)





  const global: FosReactGlobal = getGlobal(options)

  const [menuOpen, setMenuOpen] = useState<boolean>(emailConfirmationToken || passwordResetToken ? true : false)

  const {  loadAppData, loggedIn } = getActions(options, appState, setAppState)

  

  
  useEffect(() => {
    if (!jwt && !appState.auth.loggedIn) {
  
      navigate('/')
      setMenuOpen(true)
    } else {
      console.log('appState', appState, jwt)
      if (!appState.loaded){
        loadAppData()
      }
    }
  }, [jwt]);





  const [currentActivity, setCurrentActivity] = useState("")
  const [currentView, setCurrentView] = useState("")

  useEffect(() => {

    if (loggedIn()){
      if (location.pathname === '/'){
        navigate('')
      } else if (location.pathname === '/inbox'){
        setCurrentActivity('inbox')
        setCurrentView("Queue")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/agora'){
        setCurrentActivity('inbox')
        setCurrentView("Queue")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/market'){
        setCurrentActivity('inbox')
        setCurrentView("Query")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/search'){
        setCurrentActivity('inbox')
        setCurrentView("Query")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/folders'){
        setCurrentActivity('inbox')
        setCurrentView("Tree")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/info'){
        setCurrentActivity('inbox')
        setCurrentView("Queue")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      } else if (location.pathname === '/settings'){
        setCurrentActivity('inbox')
        setCurrentView("Settings")
        const newState = {
          ...appState,
          data: {
            ...appState.data,
            fosData: {
              ...appState.data.fosData,
              route: []
            }
          }
        }
        setAppState({...newState, })
      }
  
    } else {

    }



  }, [location.pathname])


  useEffect(() => {
  }, [currentActivity, currentView])


  const setAppStateWithEffects = (newData: AppState) => {
    console.log('setting data from CLIENT',newData, appState)
    console.trace()
    // TODO: change setFosData to handle trellis data too
    // OR --- move trellis data into node data / fos context




    if (newData.auth.jwt){
      localStorage.setItem('auth', JSON.stringify(newData.auth.jwt))
    }


    const newActions =  getActions(options, newData, setAppState)

    setAppState(newData)

    const syncData = async () => {
      const dataDiff = diff({ left: newData.data, right: appState.data})
      const profileDiff = diff({ left: newData.info, right: appState.info})
      const authDiff = diff({ left: newData.auth, right: appState.auth})

      let updatedWithServerData: AppState = newData

      if (dataDiff && appState.loaded){
        // console.log('saving data')
        await newActions.saveFosAndTrellisData(updatedWithServerData)

      }

      if (profileDiff && appState.loaded){
        newActions.saveProfileData(updatedWithServerData)
      }

      if (authDiff){
        if (appState.auth.jwt && !newData.auth.jwt){
          console.log('auth diff', authDiff, appState.auth, newData.auth)
          throw new Error('auth diff')
        }
      }

      // console.log('setappdata', authDiff)
      // console.trace()

      if (diff({left: newData, right: updatedWithServerData})){
        setAppState(updatedWithServerData)
      }

    }
    syncData()

  }



  // useEffect(() => {
  //   // Apply mock events for testing
  //   const handler = () => {
  //     getMockEvents(appState).forEach(event => {
  //       setAppState(prevState => applyMockEvent(prevState, event));
  //     });  
  //   }

  //   setTimeout(() => {
  //     handler()
  //   }, 10000)


  //   return 
  // }, []);

 
  return (<><div className="App h-full bg-background p-0 relative" style={{ height: '100%', width: '100%', position: 'relative', textAlign: 'center', margin: '0 auto', overflowX: 'hidden', "minHeight": "100svh" }}>
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
          setData={setAppStateWithEffects}
          options={global}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          
          />
        <div className=" h-full w-full p-0 m-0" >
 
        
        <Outlet context={{
          data: appState,
          setData: setAppStateWithEffects,
          options: global,
          nodeRoute: appState.data.fosData.route,
          dialogueProps: {
            loading: false,
            setLoading: () => {},
            showCookies: showCookieConsent,
            setShowCookies: setShowCookieConsent,
            showTerms,
            setShowTerms,
            showPrivacy,
            setShowPrivacy,
            showClearData,
            setShowClearData,
            showDeleteAccount,
            setShowDeleteAccount,
            showEmailConfirm,
            setShowEmailConfirm,
          },
          tokens: {
            emailConfirmationToken,
            passwordResetToken
          }
        }} />
        
        
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
    </div></div>
    </div>
    <HelpDrawer open={showHelp} setOpen={setShowHelp} setShowTutorial={setShowTutorial} showTutorial={showTutorial}/>
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
    
    ...( options ? { locked: options.locked } : { locked: false }),
  }

  return global
}

export function useProps() {
  return useOutletContext<ContextType>();
}

export const getMaxDepth = () => {
  return ( (window.innerWidth - 500) / 100)
}
