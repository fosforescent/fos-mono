import React from 'react'
import { useTraceUpdate } from '../trace-update'

// import { defaultNodes, defaultPath } from '../../initialNodes'

import { InfoState, InfoProfile, SubscriptionInfo } from './index'

import { AppState } from './index'
import { api } from '../../api'

import { diff } from 'deep-object-diff'
import _ from 'lodash'
import { jwtDecode } from 'jwt-decode'
import { useWindowSize } from '../window-size'




const checkInfoFormat = (info: InfoState) => {

  if (!info.profile){
    return 
  }

  if ((info.profile as any).profile){
    throw new Error('info.profile.profile is not allowed')
  }

  if ((info?.profile as any)?.profileInfo){
    throw new Error('info.profile.profileInfo is not allowed')
  }


  if ((info as any)?.profileInfo){
    throw new Error('info.profileInfo is not allowed')
  }

}


export const getServerStateProfile = <T>(appState: AppState<T>, jwt: string) => 
  (newProfile: InfoState): AppState<T> => {
  

  const jwtProps = jwtDecode<{ username: string, exp: number}>(jwt)

    const newInfoState: InfoState = { 
      profile: newProfile.profile,
      subscription: newProfile.subscription,
      emailConfirmed: newProfile.emailConfirmed,
      subscriptionSession: newProfile.subscriptionSession,
      cookies: newProfile.cookies || appState.info.cookies
    }

  const newState: AppState<T> = { 
    ...appState, 
    auth: { 
      ...appState.auth, 
      jwt, 
      email: jwtProps.username,
      password: undefined 
    },
    info: newInfoState,

  }
  return newState
}




export const useInfoState = <T>(appState: AppState<T>, setAppState: (newState: AppState<T>) => void) => {

  const windowSize = useWindowSize()

  const rowDepth = React.useMemo(() => {
    if (windowSize.width !== undefined){
      return Math.floor( (windowSize.width - 500 )/ 100) 
      // return 1
    } else {
      return 0
    }
  }, [windowSize])


  const clearData = React.useCallback(async () => {
    if (!appState.auth.jwt){
      throw new Error('no jwt')
    }
    const newState = await api(appState.apiUrl).authed(appState.auth.jwt).clearData().then(() => {
      localStorage.removeItem("data")
      return {}
    })

    console.log('clearData', newState)

    setAppState({...appState, data: null})
  }, [appState.auth.jwt])


  React.useEffect(() => {

    // console.log('useInfoState - appState', appState)
    if (!appState.auth.jwt && !appState.info.profile) {
      return 
    }
    
    if (!appState.auth.jwt){
      return 
      throw new Error("calling getProfile when not authenticated")
    }

    if (!appState.info.profile){
      const authedApi = api(appState.apiUrl).authed(appState.auth.jwt)
      

      authedApi.postProfile(appState.info)
        .then(getServerStateProfile(appState, appState.auth.jwt))
        .then((loggedInState) => {
          const difference = diff(appState.info, loggedInState.info)
          // console.log('difference', difference)
          if (Object.keys(difference).length > 0){
            setAppState(loggedInState)
          }
      }).catch((error: Error) => {
        console.log('error', error)
        throw error
      });
    }

    const jwt = appState.auth.jwt;
    const infoProfile = appState.info;

    if (jwt && infoProfile && false){
      (async () => {

        const newInfoState : InfoState = await api(appState.apiUrl).authed(jwt).postProfile(infoProfile)


        const resultDiff = diff(appState.info, newInfoState)
        const resultDiffKeys = Object.keys(resultDiff)
        if (resultDiffKeys.length > 0) {


          updateInfoState(newInfoState)
        }
      })()
  
      
    }

    

  }, [appState.info.profile])
  
  
  // useTraceUpdate({ infoState: appState.info })
  





  const updateInfoState = React.useCallback(async (newUserInfo: InfoState) => {
    /**
     * Do api post, then update state
     */
    checkInfoFormat(newUserInfo)
    const diffResult = diff(appState.info, newUserInfo)
    if (Object.keys(diffResult).length > 0) {
      setAppState({ ...appState, info: newUserInfo })
    }
  }, [setAppState, appState.info])
  
  




  const confirmEmail = React.useCallback(async () => {
    if (!appState.auth.jwt) {
      throw new Error("calling confirmEmail when not authenticated")
    }

  //   if (!appState.info.profile?.confirmEmailToken) {
  //     throw new Error("calling confirmEmail when no confirmEmailToken")
  //   }

  //   if (appState.info.profile?.emailConfirmed) {
  //     throw new Error("calling confirmEmail when email already confirmed")
  //   }

  //   const result = api.authed(appState.auth.jwt).confirmEmail(appState.info.profile?.confirmEmailToken)
  //   setAppState({ ...appState, 
  //     info: { ...appState.info, 
  //       profile: {
  //         ...appState.info.profile,
  //         emailConfirmed: true
  //       },
  //   } })
  }, [appState.auth,  setAppState, appState.info.emailConfirmed])


  const setCookieConsent = React.useCallback(async (cookiePrefs: { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean } | undefined) => {
    localStorage.setItem('cookiePrefs', JSON.stringify(cookiePrefs))

    const newInfo = { ...appState.info, 
      cookies: cookiePrefs
    }
    
    checkInfoFormat(newInfo)

    setAppState({ ...appState, 
      info:  newInfo 
    })

  }, [])


  const updateEmail = React.useCallback(async (email: string) => {
    if (!appState.auth.jwt) {
      throw new Error("calling updateEmail when not authenticated")
    }
    if (!appState.info.profile) {
      throw new Error("calling updateEmail when no profile")
    }

    const result = await api(appState.apiUrl).authed(appState.auth.jwt).updateEmail(email)

    const newInfo = { ...appState.info, 
      profile: {
        ...appState.info.profile,
      },
    } 

    checkInfoFormat(newInfo)

    setAppState({ ...appState, 
      auth: { ...appState.auth, 
        email,
        jwt: result 
      },
      info:  newInfo })
  }, [appState.auth, appState.info.profile])

  const confirmEmailInit = React.useCallback(async () => {
    if (!appState.auth.jwt) {
      throw new Error("calling confirmEmailInit when not authenticated")
    }
    if(!appState.info.profile){
      throw new Error("calling confirmEmailInit when no profile, but authenticated")
    }
    const result = api(appState.apiUrl).authed(appState.auth.jwt).confirmEmailInit()
    const profile = appState.info.profile

    const newInfo = { 
      ...appState.info, 
      profile: {
        ...profile,
        emailConfirmed: false
      },
    }
    checkInfoFormat(newInfo)

    setAppState({ ...appState, 
      info: newInfo })
  }, [appState.auth])

  // console.log('infoState', appState.info)

  checkInfoFormat(appState.info)

  return {
    setUserInfo: updateInfoState, 
    confirmEmail,
    setCookieConsent,
    updateEmail,
    confirmEmailInit,
    clearData
  }  as const

}
