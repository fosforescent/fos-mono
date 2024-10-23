import React, { useEffect } from "react"
import EventSource from "event-source-polyfill";

import { AppContext, initialAppState, initialDataState, InfoState, AppState } from "./index";

import { useInfoState } from "./info-state";
import { useAuthState } from "./auth-state";


import { useTraceUpdate } from '../trace-update'

import { useThemeEffects } from "./stateEffects"
import { Mode } from "../../api";
import { getServerStateData } from "./auth-state";


declare const __DEV_SYC_API_URL__: string;
declare const __PROD_SYC_API_URL__: string;


const initialContextValues = {
  appState: initialAppState("custom", "http://localhost:3000"),
  data: initialDataState,
  setAppState: (newState: AppState<any>) => { throw new Error("setAppState not initialized") },
  setData: async (newData: any) => { throw new Error("setAppData not initialized") },
  loggedIn: false,
  logIn: async (email: string, password: string, remember: boolean) => { throw new Error("setLoggedIn not initialized") },
  logOut: async () => { throw new Error("setLoggedIn not initialized") },
  resetPassword: async () => { throw new Error("setLoggedIn not initialized") },
  setUserInfo: async (newUserInfo: InfoState) => { throw new Error("setUserInfo not initialized") },
  registerUser: async (email: string, password: string) => { throw new Error("registerUser not initialized") },
  theme: "system",
  setTheme: async (theme: string) => { throw new Error("setTheme not initialized") },
  confirmEmail: async (token: string) => { throw new Error("confirmEmail not initialized") },
  setCookieConsent(cookiePrefs: { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean } | undefined) { throw new Error("setCookieConsent not initialized") },
  deleteAccount: async () => { throw new Error("deleteAccount not initialized") },
  updateEmail: async (email: string) => { throw new Error("updateEmail not initialized") },
  changePassword: async (oldPassword: string, newPassword: string) => { throw new Error("changePassword not initialized") },
  confirmEmailInit: async () => { throw new Error("confirmEmailInit not initialized") },
  sendMessage: async (email: string, message: string) => { throw new Error("sendMessage not initialized") },
  clearData: async () => { throw new Error("clearData not initialized") },
  promptGPT: async (systemPrompt: string, userPrompt: string, options?: {
    temperature?: number,
    max_tokens?: number,
  }) => { throw new Error("promptGPT not initialized") },
  canPromptGPT: false,
}


// eslint-disable-next-line @typescript-eslint/ban-types
const getAppStateContext = <T extends {}>(initialValues: AppContext<T>) => React.createContext<AppContext<T>>(initialValues);


const AppStateContext = getAppStateContext(initialContextValues)


// eslint-disable-next-line @typescript-eslint/ban-types
export const useAppStateValues = <T extends {}>(mode:Mode, apiUrl: string) => {



  const [appState, setAppState] = React.useState(initialAppState(mode, apiUrl));



  const { loggedIn, logIn, logOut, registerUser, resetPassword, authedApi, deleteAccount, sendMessage, changePassword } = useAuthState(appState, setAppState)


  const { setUserInfo, confirmEmail, setCookieConsent, updateEmail, confirmEmailInit, clearData } = useInfoState(appState, setAppState)

  const setData = React.useCallback(async (newDataState: T | undefined): Promise<T | undefined> => {
    if (!authedApi){
      throw new Error("setting data when not logged in")
    }
    const result = await authedApi.postData(newDataState).then(getServerStateData(appState))
    if (!result){
      throw new Error("Error saving data")
    }
    return result.data
  }, [authedApi, appState])

  const data: T | undefined = appState.data


    

  // useTraceUpdate({ appData, setAppData, loggedIn, setLoggedIn, userInfo, setUserInfo, registerUser, authInfo, setAuthInfo })



  const { theme, setTheme } = useThemeEffects(appState, setAppState);
  

  const promptGPT = async (systemPrompt: string, userPrompt: string, options?: {
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
  }

  const canPromptGPT = !!appState.auth.jwt && !!appState.info.subscription && (appState.info.subscription.apiCallsAvailable > appState.info.subscription.apiCallsUsed)


  // console.log("VIRIDIAN -- ", "loggedIn", loggedIn)
  
  const ctxValue: AppContext<T> = ({

    appState: appState,
    setAppState,
    setData,
    data,
    loggedIn,
    logIn,
    logOut,
    registerUser,
    resetPassword,
    confirmEmail,
    setUserInfo,
    setCookieConsent,
    deleteAccount, 
    clearData,
    updateEmail,
    changePassword,
    confirmEmailInit,
    sendMessage,
    authedApi,
    theme,
    setTheme,
    promptGPT,
    canPromptGPT,

  })


  return ctxValue


}


export const AppStateProvider = ({
  children,
  mode,
  customApiUrl
}: { 
  children: React.ReactNode,
  mode: Mode,
  customApiUrl?: string
}) => {




  
  const sycApiUrl = (() => {
    switch (mode) {
      case "production":
        return __PROD_SYC_API_URL__
      case "development":
        return __DEV_SYC_API_URL__
      case "custom":
        if (customApiUrl){
          return customApiUrl
        } else {
          throw new Error("custom mode requires customApiUrl")
        }
      default:
        return "http://localhost:4000"
    }  
  })()
  
  

  const values = useAppStateValues(mode, sycApiUrl)




  return (
    <AppStateContext.Provider value={values}>
      {children}
    </AppStateContext.Provider>
  )

}




export const useAppState = () => {
  const context = React.useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within a AppStateProvider')
  }

  // useTraceUpdate({ context })
  // console.log('useAppState', context)
  return context
}