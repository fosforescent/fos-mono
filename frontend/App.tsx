import React, { useEffect, useState } from 'react'


import { AppState, AuthState, ContextType, FosContextData, FosReactGlobal, FosReactOptions, FosPath, InfoState, AppStateInitial, AppStateLoaded, } from '../shared/types'
import { useTraceUpdate } from './hooks/trace-update'
import { TutorialDialog } from './components/dialog/TutorialDialog'
import { HelpDrawer } from './components/dialog/HelpDrawer'




import HamburgerMenu from './components/menu/HamburgerMenu'
import { LoginDialog } from './components/dialog/LoginDialog'


import { Toaster } from "@/components/ui/toaster"
import { CookieDialog } from './components/dialog/CookieDialog'
import { PrivacyPolicyDialog } from './components/dialog/PrivacyPolicyDialog'
import { TermsDialog } from './components/dialog/TermsDialog'
import { ConfirmClearData } from './components/dialog/ConfirmClearData'
import { ConfirmDeleteUser } from './components/dialog/ConfirmDeleteUser'
import { ConfirmEmailChange } from './components/dialog/ConfirmEmailChange'
import { ErrorBoundary } from './components/error-boundary'
import { useToast } from '@/components/ui/use-toast';
import jwtDecode from 'jwt-decode';
import { api } from './api'
import { PendingApproval } from './components/admin/PendingApproval'

import { defaultTrellisData } from '../shared/defaults'

import { Outlet, useOutletContext, useLoaderData, useNavigate } from 'react-router-dom'
import { getActions } from './lib/actions'
import { diff } from '@n1ru4l/json-patch-plus'

import { useLocation } from 'react-router-dom'
import { set } from 'date-fns'
import { getMockEvents, applyMockEvent } from './hooks/mock-events';
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { publicRuntimeConfig } from './config'
import { useTauri } from './tauri/useTauri'



export const initialInfoState: InfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "null") : undefined,
  emailConfirmed: false,

}



const parsedJwt = JSON.parse(localStorage.getItem("auth") || "null")

const decodedJwt = parsedJwt ? jwtDecode(parsedJwt) as { username: string, exp: number } : { username: "", exp: 0 }
const parsedUsername = JSON.parse(localStorage.getItem("username") || "null")

export const initialAuthState: AuthState = parsedJwt ? {
  username: decodedJwt.username,
  remember: !!parsedUsername,
  jwt: parsedJwt.jwt,
  jwtDecoded: decodedJwt,
  email: decodedJwt.username,
  password: "",
} : {
  username: decodedJwt.username,
  remember: !!parsedUsername,
  jwt: undefined,
  email: decodedJwt.username,
  jwtDecoded: decodedJwt,
  password: "",
}




export const initialDataState: AppStateInitial = {

  data: null,
  auth: initialAuthState,
  info: initialInfoState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
  apiUrl: publicRuntimeConfig.apiUrl,
  loaded: false,
  loggedIn: !!parsedJwt,
}

// Load offline data from IndexedDB (called async in useEffect)
import { loadFromIndexedDB } from './lib/actions'



export default function App({

}: {

  }) {

  const apiUrl = publicRuntimeConfig.apiUrl


  const [showCookieConsent, setShowCookieConsent] = useState(false)

  const [showTerms, setShowTerms] = useState({ open: false, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => { } })
  const [showPrivacy, setShowPrivacy] = useState({ open: false, fromRegisterForm: false })

  const [showClearData, setShowClearData] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState<{ open: boolean, email: string }>({ open: false, email: "" })






  const [appState, setAppState] = React.useState<AppState>({ ...initialDataState, apiUrl })

  // Desktop/Tauri integration for local storage
  const tauriHook = useTauri()

  // Track if we've auto-initialized
  const [autoInitialized, setAutoInitialized] = React.useState(false)

  // Offline-first: Auto-initialize on startup (for both web and desktop)
  useEffect(() => {
    const initializeOfflineFirst = async () => {
      // Already loaded or already attempted initialization, skip
      if (appState.loaded || autoInitialized) {
        return
      }

      // If user is logged in with JWT, let the normal login flow handle it
      if (parsedJwt && appState.loggedIn) {
        return
      }

      setAutoInitialized(true)
      console.log('Auto-initializing offline-first mode...')

      try {
        // Desktop (Tauri) mode
        if (tauriHook.isDesktop) {
          // Ensure .fos file exists
          await tauriHook.ensureFosFile()

          // Load store content from .fos file
          const content = await tauriHook.reloadStore()

          let fosData = null
          if (content && content.trim()) {
            try {
              const parsed = JSON.parse(content)
              fosData = parsed
            } catch {
              console.log('Could not parse .fos content, starting fresh')
            }
          }

          // Create a new store with the loaded data or empty
          const store = fosData?.fosData
            ? new FosStore({ fosCtxData: fosData })
            : new FosStore({})

          const exportedData = store.exportContext([])

          setAppState(prev => ({
            ...prev,
            loaded: true,
            loggedIn: true,
            data: exportedData,
            auth: {
              ...prev.auth,
              offlineMode: true,
            },
            info: {
              ...prev.info,
              offlineMode: true,
            }
          }))
        } else {
          // Web mode - use IndexedDB
          const offlineData = await loadFromIndexedDB()

          let fosData: AppStateLoaded["data"]
          if (offlineData) {
            fosData = offlineData
          } else {
            // Create fresh store
            const store = new FosStore({})
            fosData = store.exportContext([])
          }

          setAppState(prev => ({
            ...prev,
            loaded: true,
            loggedIn: true,
            data: fosData,
            auth: {
              ...prev.auth,
              jwt: undefined,
              offlineMode: true,
            },
            info: {
              ...prev.info,
              offlineMode: true,
            }
          }))
        }

        console.log('Offline-first initialization complete')
      } catch (error) {
        console.error('Error initializing offline-first mode:', error)
        // Fall back to fresh store on error
        const store = new FosStore({})
        const fosData = store.exportContext([])
        setAppState(prev => ({
          ...prev,
          loaded: true,
          loggedIn: true,
          data: fosData,
          auth: {
            ...prev.auth,
            offlineMode: true,
          },
          info: {
            ...prev.info,
            offlineMode: true,
          }
        }))
      }
    }

    initializeOfflineFirst()
  }, [tauriHook.isDesktop, autoInitialized, appState.loaded, appState.loggedIn])

  const jwt = appState.auth?.jwt


  const emailConfirmationToken = new URLSearchParams(window.location.search).get('confirm-email-token') || undefined
  const passwordResetToken = new URLSearchParams(window.location.search).get('reset-password-token') || undefined



  useEffect(() => {
    // Skip JWT enforcement in offline mode
    const isOfflineMode = appState.auth?.offlineMode || appState.info?.offlineMode
    if (isOfflineMode) {
      return
    }

    if (appState.loggedIn && !jwt) {
      if (parsedJwt) {
        setAppState({ ...appState, auth: { ...appState.auth, jwt: parsedJwt } })
      }
      setAppState({
        ...appState,
        loggedIn: false,
        auth: {
          ...appState.auth,
          jwt: undefined,
        }
      })

    } else if (!appState.loggedIn && jwt) {
      setAppState({
        ...appState,
        loggedIn: false,
        auth: {
          ...appState.auth,
          jwt: jwt,
        }
      })
    }




  }, [jwt, parsedJwt, appState.loggedIn])


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

  const rawToast = useToast()

  // First declare options with the basics
  const options = {
    toast: rawToast.toast,
  }

  // useTraceUpdate({ apiDataState, loggedIn, theme, promptGPT, canPromptGPT, toast, data })
  const authedApi = appState.auth.jwt ? api(appState, setAppState, options).authed() : undefined

  const promptGPT = React.useCallback(async (systemPrompt: string, userPrompt: string, options?: {
    temperature?: number,
    max_tokens?: number,
  }) => {
    if (!appState.auth.jwt) {
      throw new Error('Trying to prompt GPT without being logged in')
    }
    const result = await authedApi?.getSuggestions(systemPrompt, userPrompt, options || {})
    if (!result) {
      throw new Error('Error getting GPT suggestions')
    }
    return result.suggestions
  }, [authedApi])

  const canPromptGPT = !!appState.auth.jwt && !!appState.info.subscription && (appState.info.subscription.apiCallsAvailable > appState.info.subscription.apiCallsUsed)

  // Update options with the additional properties
  Object.assign(options, {
    canPromptGPT,
    promptGPT,
  })



  const [theme, setTheme] = useState("system")



  useEffect(() => {

    const root = window.document.documentElement
    if (!root) {
      throw new Error('Root element does not exist in DOM')
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

  const { loadAppData, loggedIn, setViewActivityMode } = getActions(options, appState, setAppState)




  useEffect(() => {
    // In offline mode, skip the JWT check - we're logged in locally
    const isInOfflineMode = appState.auth?.offlineMode || appState.info?.offlineMode

    if (isInOfflineMode) {
      // Offline mode - data is local, nothing to fetch
      return
    }

    if (jwt && appState.loggedIn && !appState.loaded) {
      // Online mode with valid JWT - load from backend
      console.log('Loading app data from backend...')
      loadAppData()
    }
  }, [jwt, appState.loggedIn, appState.loaded]);

  // Check user approval status when app data is loaded
  const [userApprovalChecked, setUserApprovalChecked] = useState(false)

  useEffect(() => {
    if (appState.loggedIn && appState.loaded && !userApprovalChecked) {
      setUserApprovalChecked(true)
      // Approval status is available in appState.info.approved
      if (appState.info?.approved === false) {
        // User is not approved, don't navigate away from approval page
        console.log('User not approved, showing pending approval')
      }
    }
  }, [appState.loggedIn, appState.loaded, userApprovalChecked]);





  const [currentActivity, setCurrentActivity] = useState("")
  const [currentView, setCurrentView] = useState("")

  // Handlers for PendingApproval component
  const handleLogout = () => {
    localStorage.removeItem('auth')
    localStorage.removeItem('username')
    setAppState({
      ...appState,
      loggedIn: false,
      auth: {
        ...appState.auth,
        jwt: undefined
      }
    })
    navigate('/')
    setMenuOpen(true)
  }

  const handleRefreshApprovalStatus = async () => {
    if (appState.loggedIn && appState.auth.jwt) {
      await loadAppData()
    }
  }

  useEffect(() => {

    if (loggedIn() && appState.loaded && appState.data) {
      if (location.pathname === '/' || location.pathname === '/workspace') {
        // WorkspaceView handles its own view state via ViewSwitcher
        // Don't override the view setting here
      } else if (location.pathname === '/tools') {
        setCurrentActivity('todo')
        setCurrentView("Browse")
        setViewActivityMode("Browse", "app", "default")
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/inbox') {
        setCurrentActivity('todo')
        setCurrentView("Queue")
        setViewActivityMode("Queue", "todo", "default")
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/agora') {
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/market') {
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/search') {
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/folders') {
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/info') {
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
        setAppState({ ...newState, })
      } else if (location.pathname === '/settings') {
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
        setAppState({ ...newState, })
      }

    } else {

    }



  }, [location.pathname])


  useEffect(() => {
  }, [currentActivity, currentView])


  const setAppStateWithEffects = (newData: AppState) => {
    console.log('setting data from CLIENT', newData, appState)

    // Check if in offline mode
    const isOfflineMode = newData.auth?.offlineMode || newData.info?.offlineMode

    if (newData.auth.jwt) {
      localStorage.setItem('auth', JSON.stringify(newData.auth.jwt))
    }

    const newActions = getActions(options, newData, setAppState)

    setAppState(newData)

    const syncData = async () => {
      const dataDiff = diff({ left: newData.data, right: appState.data })
      const profileDiff = diff({ left: newData.info, right: appState.info })
      const authDiff = diff({ left: newData.auth, right: appState.auth })

      console.log('setAppStateWithEffects: dataDiff detected:', !!dataDiff, 'offlineMode:', isOfflineMode)

      let updatedWithServerData: AppState = newData

      if (dataDiff && appState.loaded) {
        if (!updatedWithServerData) {
          throw new Error('App loaded, but trying to save null data')
        }

        if (isOfflineMode && tauriHook.isDesktop) {
          // In offline mode, save to local .fos directory
          console.log('setAppStateWithEffects: saving data to local .fos')
          try {
            const fosData = (updatedWithServerData as AppStateLoaded).data.fosData
            await tauriHook.saveStore(JSON.stringify(fosData))
          } catch (error) {
            console.error('Error saving to local .fos:', error)
          }
        } else if (!isOfflineMode) {
          // Online mode - sync to backend
          console.log('setAppStateWithEffects: saving data to backend')
          await newActions.saveFosAndTrellisData(updatedWithServerData as AppStateLoaded)
        }
      }

      // Only sync profile data if online
      if (profileDiff && appState.loaded && !isOfflineMode) {
        newActions.saveProfileData(updatedWithServerData)
      }

      if (authDiff) {
        if (appState.auth.jwt && !newData.auth.jwt && !isOfflineMode) {
          console.log('auth diff', authDiff, appState.auth, newData.auth)
          throw new Error('auth diff')
        }
      }

      if (diff({ left: newData, right: updatedWithServerData })) {
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


  // State for login dialog
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Check if in offline mode (not authenticated with server)
  const isOfflineMode = appState.auth?.offlineMode || appState.info?.offlineMode

  return (<><div
    className="App h-full bg-background p-0 relative"
    data-testid="main-app"
    style={{ height: '100%', width: '100%', position: 'relative', textAlign: 'center', margin: '0 auto', overflowX: 'hidden', "minHeight": "100svh" }}>
    <div style={{ textAlign: 'left', boxSizing: 'border-box' }} className='w-full'>
      {/* Always show hamburger menu when loaded */}
      {appState.loaded && (
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
          isOfflineMode={isOfflineMode}
          onShowLogin={() => setShowLoginDialog(true)}
        />
      )}
      <div
        className=" h-full w-full p-0 m-0"
        data-testid={appState.loaded ? "main-content" : undefined}
      >

        {/* Show loading state, PendingApproval if not approved, otherwise show main app */}
        {!appState.loaded ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        ) : appState.info?.approved === false && !isOfflineMode ? (
          <PendingApproval
            userEmail={appState.auth?.email}
            userName={appState.auth?.username}
            onLogout={handleLogout}
            onRefresh={handleRefreshApprovalStatus}
          />
        ) : (
          <div data-testid="authenticated-content" className="h-full">
            <Outlet context={{
              data: appState,
              setData: setAppStateWithEffects,
              options: global,
              nodeRoute: appState.data?.fosData?.route || [],
              dialogueProps: {
                loading: false,
                setLoading: () => { },
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
          </div>
        )}


        <TutorialDialog open={showTutorial} setOpen={setShowTutorial} />
      </div>
    </div>
    <div>
      <CookieDialog open={showCookieConsent} setOpen={setShowCookieConsent} data={appState} setData={setAppState} options={options} />
      <PrivacyPolicyDialog open={showPrivacy} setOpen={(isOpen: boolean) => setShowPrivacy({ open: isOpen, fromRegisterForm: false })} data={appState} setData={setAppState} options={options} />
      <TermsDialog open={showTerms.open} setOpen={(isOpen: boolean) => { setShowTerms({ ...showTerms, open: isOpen }) }} setAcceptTerms={showTerms.setAcceptTerms} data={appState} setData={setAppState} options={options} />
      <ConfirmClearData open={showClearData} setOpen={setShowClearData} data={appState} setData={setAppState} options={options} />
      <ConfirmDeleteUser open={showDeleteAccount} setOpen={setShowDeleteAccount} data={appState} setData={setAppState} options={options} />
      <ConfirmEmailChange open={showEmailConfirm.open} setOpen={(status: boolean) => { setShowEmailConfirm({ ...showEmailConfirm, open: status }) }} email={showEmailConfirm.email} data={appState} setData={setAppState} options={options} />
      <LoginDialog open={showLoginDialog} setOpen={setShowLoginDialog} data={appState} setData={setAppStateWithEffects} options={global} />
    </div>
  </div>
    <div className="w-full relative">

      <div className='flex w-full justify-end'>
        <div className={`opacity-30 hover:opacity-80 transition`}>
        </div></div>
    </div>
    <HelpDrawer open={showHelp} setOpen={setShowHelp} setShowTutorial={setShowTutorial} showTutorial={showTutorial} />
    <Toaster />
  </>)
}





export const getGlobal = (options: FosReactOptions): Partial<FosReactOptions> => {
  // console.log('options', options)
  const global = {
    ...(options && options?.canPromptGPT && options?.promptGPT ? {
      canPromptGPT: true,
      promptGPT: options.promptGPT,
    } : {
      canPromptGPT: false,
    }),
    ...(options && options?.canRedo ? { canRedo: true } : { canRedo: false }),
    ...(options && options?.canUndo ? { canUndo: true } : { canUndo: false }),
    ...(options && options?.canRedo ? { redo: options.redo } : {}),
    ...(options && options?.canUndo ? { undo: options.undo } : {}),
    ...(options ? { toast: options.toast } : {}),
    ...(options ? { theme: options.theme } : {}),

    ...(options ? { locked: options.locked } : { locked: false }),
  }

  return global
}

export function useProps() {
  return useOutletContext<ContextType>();
}

export const getMaxDepth = () => {
  return ((window.innerWidth - 500) / 100)
}

