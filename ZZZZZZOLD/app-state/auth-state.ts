import React, { useEffect } from 'react'
import { useTraceUpdate } from '../trace-update'

// import { defaultNodes, defaultPath } from '../../initialNodes'
import { AppState, InfoProfile, SubscriptionInfo } from './index'
import { api } from '../../api'
import _ from 'lodash'
import { jwtDecode } from "jwt-decode";
import { getServerStateProfile } from './info-state'

import { diff } from 'deep-object-diff'
import { useWindowSize } from '../window-size'





export const getServerStateData =  <T>(appState: AppState<T>) => 
  (newData: T | null): AppState<T> => {
  

  const newState: AppState<T> = { 
    ...appState, 
    data: newData,
  }
  return newState
}




export const useAuthState = <T>(appState: AppState<T>, setAppState: (newState: AppState<T>) => void) => {


  useEffect(() => {
    // console.log('useAuthState - appState', appState)
    if (appState.auth.jwt) {
      localStorage.setItem("auth", JSON.stringify(appState.auth.jwt))
    }
  }, [appState.auth.jwt])



  const loggedIn = !!appState.auth.jwt

  const authedApi = appState.auth.jwt ? api(appState.apiUrl).authed(appState.auth.jwt) : undefined

  const windowSize = useWindowSize()

  const rowDepth = React.useMemo(() => {
    if (windowSize.width !== undefined){
      return Math.floor( (windowSize.width - 500 )/ 100) 
      // return 1
    } else {
      return 0
    }
  }, [windowSize])



  const logIn = React.useCallback(async (email: string, password: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem("email", appState.auth.email)
    }
    const jwt = await api(appState.apiUrl).public.login(email, password).catch((error: Error) => {
      console.log('error', error)
      throw error
    });
    if (!jwt) {
      throw new Error('Login failed')
    }

    const jwtProps = jwtDecode<{ username: string, exp: number}>(jwt)

    if (jwtProps.username !== email){
      throw new Error('jwt username does not match email, login failed')
    }

    const authedApi = api(appState.apiUrl).authed(jwt)


    authedApi.postProfile(null)
      .then(getServerStateProfile(appState, jwt))
      .then( (newAppState) => {

        authedApi.postData(null)
          .then(getServerStateData(newAppState))
          .then((loggedInDataState) => {
            const difference = diff(appState.info, loggedInDataState.info)
            console.log('difference', difference)
            if (Object.keys(difference).length > 0){
              setAppState(loggedInDataState)
            }
          }).catch((error: Error) => {
            console.log('error', error)
            throw error
          });

      }).catch((error: Error) => {
        console.log('error', error)
        throw error
      });


  }, [appState.auth])

  const logOut = React.useCallback(async () => {
    const loggedOutState = await api(appState.apiUrl).public.logout().then(() => {
      return { ...appState, auth: { ...appState.auth, jwt: undefined, loggedIn: false } }
    }).catch((error: Error) => {
      console.log('error', error)
      throw error
    });
    setAppState(loggedOutState)
  }, [appState.auth])

  const registerUser = React.useCallback(async (email: string, password: string, accepted_terms: boolean) => {

    console.log('registerUser', appState.info, appState)
    if(!appState.info.cookies){
      // throw new Error('Trying to register without cookie consent')
      console.warn('Registering without cookie consent')
    }

    if (email && password) {
      const result = await api(appState.apiUrl).public.register(email, password, accepted_terms, appState.info.cookies || {
        acceptRequiredCookies: false,
        acceptSharingWithThirdParties: false,
      }).catch((error: Error) => {
        console.log('error', error)
        throw error
      });
      console.log('registerUser', result)
    }
  }, [appState.auth, appState.info])

  const resetPassword = React.useCallback(async (email: string, password: string, token: string) => {

      await api(appState.apiUrl).public.resetPassword(email, password, token)
  }, [appState.auth])


  const deleteAccount = React.useCallback(async () => {
    if (!appState.auth.jwt) {
      throw new Error('Trying to delete account without being logged in')
    }
    await api(appState.apiUrl).authed(appState.auth.jwt).deleteAccount().then(() => {
      localStorage.clear()
      window.location.href = '/'
    })
  }, [appState.auth])

  const sendMessage = React.useCallback(async (email: string, message: string): Promise<void> => {
    return await api(appState.apiUrl).public.sendMessage(email, message)
  }, [appState.auth])

  const changePassword = React.useCallback(async (oldPassword: string, newPassword: string) => {
    if (!appState.auth.jwt) {
      throw new Error('Trying to change password without being logged in')
    }
    await api(appState.apiUrl).authed(appState.auth.jwt).changePassword(oldPassword, newPassword)
  }, [appState.auth])
  


  return { loggedIn, logIn, logOut, registerUser, resetPassword, authedApi, deleteAccount, sendMessage, changePassword } as const

}
