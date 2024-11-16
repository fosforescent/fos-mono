import { jwtDecode } from "jwt-decode"
import { api } from "../api"
import { AppState, FosPath, FosReactOptions, FosRoute, InfoProfile, InfoState, SubscriptionInfo, UserProfile } from "../types"
import { diff } from "@n1ru4l/json-patch-plus"
import { getNodeOperations } from "./nodeOperations"
import { debounce } from "lodash"


export const getActions = (options: FosReactOptions, appData: AppState, setAppData: (state: AppState) => void) => {

  if (!appData.apiUrl){
    console.log('appData', appData, options)
    throw new Error('apiUrl not found')
  }

  const apiObj = api(appData.apiUrl)

  const authedApi = appData.auth.jwt ? apiObj.authed(appData.auth.jwt) : undefined


  const loggedIn = () => {
    return !!appData.auth.jwt
  }
  const setDrag = async (draggingNode: FosRoute | null, draggingOverNode: FosRoute | null) => {
      setAppData({
          ...appData,
          data: {
              ...appData.data,
              trellisData: {
                  ...appData.data.trellisData,
                  draggingNode: draggingNode,
                  draggingOverNode: draggingOverNode
              }
          }
      })
  }
  const clearDraggingNode = async () => {
      setAppData({
          ...appData,
          data: {
              ...appData.data,
              trellisData: {
                  ...appData.data.trellisData,
                  draggingNode: null,
                  draggingOverNode: null
              }
          }
      })
  }
  const clearData = async () => {

  }
  const deleteAccount = async () => {
      if (!appData.auth.jwt) {
          throw new Error('Trying to delete account without being logged in')
        }
        await api(appData.apiUrl).authed(appData.auth.jwt).deleteAccount().then(() => {
          localStorage.clear()
          window.location.href = '/'
        })
  }
  const setCookieConsent = async (cookieInfo: AppState['info']['cookies']) => {

  }
  const updateEmail = async (email: string) => {
    if (!appData.auth.jwt) throw new Error('no jwt, not logged in', {cause: 'unauthorized'});
    api(appData.apiUrl).authed(appData.auth.jwt).updateEmail(email).then((result) => {
      if (!appData.info){
        throw new Error('user info not found -- shouldn\'t have gotten here')
      }
      if (!appData.info.profile){
        throw new Error('user info profile not found -- shouldn\'t have gotten here')
      }

      const jwtProps = jwtDecode<{ username: string, exp: number}>(result)

      if (jwtProps.username !== email){
        throw new Error('jwt username does not match email, update failed')
      }

      setAppData({ 
        ...appData, 
        info: { 
          ...appData.info, 
          profile: { 
            ...appData.info.profile
          }, 
          emailConfirmed: false  
        },
        auth: {
          ...appData.auth,
          email: email,
          jwt: result
        } 
      })
    });
  }
  const sendMessage = async (email: string, message: string ) => {
      return await api(appData.apiUrl).public.sendMessage(email, message)
  }
  const confirmEmail = async (token: string) => {
      if (authedApi){
          await authedApi.confirmEmail(token)

      } else {
          throw new Error('Must Be Logged in to Confirm Email')
      }
  }
  const registerUser = async (email: string, password: string, acceptTerms: boolean) => {

      console.log('registerUser', appData.info, appData)
      if(!appData.info.cookies){
      // throw new Error('Trying to register without cookie consent')
      console.warn('Registering without cookie consent')
      }

      if (email && password) {
      const result = await api(appData.apiUrl).public.register(email, password, acceptTerms, appData.info.cookies || {
          acceptRequiredCookies: false,
          acceptSharingWithThirdParties: false,
      }).catch((error: Error) => {
          console.log('error', error)
          throw error
      });
      console.log('registerUser', result)
      }
  }
  const resetPassword = async (email: string, password: string, token: string) => {        
    await api(appData.apiUrl).public.resetPassword(email, password, token)
  }
  const changePassword = async (oldPassword: string, newPassword: string) => {
      if (!appData.auth.jwt) {
          throw new Error('Trying to change password without being logged in')
        }
        await api(appData.apiUrl).authed(appData.auth.jwt).changePassword(oldPassword, newPassword)
  }
  const logIn = async (email: string, password: string, remember: boolean) => {
    if (remember) {
        localStorage.setItem("email", appData.auth.email)
      }
                
      type LoginResult = { 
        access_token: string, 
        type: string,
      } & InfoState
        

      const { access_token: jwt, ...infoState } : LoginResult = await api(appData.apiUrl).public.login(email, password).catch((error: Error) => {
        console.log('error', error)
        throw error
      });
      if (!jwt) {
        console.log('no jwt', jwt, infoState)
        throw new Error('Login failed')
      }
  
      const jwtProps = jwtDecode<{ username: string, exp: number}>(jwt)
  
      if (jwtProps.username !== email){
        throw new Error('jwt username does not match email, login failed')
      }
  
      const authedApi = api(appData.apiUrl).authed(jwt)
  
        
      const initialFosAndTrellisData = await authedApi.getData()
        .catch((error: Error) => {
          console.log('error', error)
          throw error
        });


        const actualTrellisData = Object.keys(initialFosAndTrellisData.trellisData).length > 0 ? initialFosAndTrellisData.trellisData : appData.data.trellisData
        const actualData = { ...initialFosAndTrellisData, trellisData: actualTrellisData }
    

      const newAppState: AppState = {
        ...appData,
        auth: {
          ...appData.auth,
          jwt,
          email,
          remember,
        },
        info: {
          ...infoState,
        },
        data: actualData,
        loaded: true
      }
        
      setAppData(newAppState)
    
  }
  const confirmEmailInit = async () => {

      if (!appData.auth.jwt) {
          throw new Error("calling confirmEmailInit when not authenticated")
        }
        if(!appData.info.profile){
          throw new Error("calling confirmEmailInit when no profile, but authenticated")
        }
        const result = api(appData.apiUrl).authed(appData.auth.jwt).confirmEmailInit()
        const profile = appData.info.profile
    
        const newInfo = { 
          ...appData.info, 
          profile: {
            ...profile,
            emailConfirmed: false
          },
        }
        checkInfoFormat(newInfo)
    
        setAppData({ ...appData, 
          info: newInfo })
  }
  const logOut = async () => {
      const loggedOutState = await api(appData.apiUrl).public.logout().then(() => {
          return { ...appData, auth: { ...appData.auth, jwt: undefined, loggedIn: false }, loaded: false }
        }).catch((error: Error) => {
          console.log('error', error)
          throw error
        });
        setAppData(loggedOutState)
      localStorage.clear()
      window.location.href = '/'
  }

  const loadAppData = async () => {
    if (!appData.auth.jwt) {
      throw new Error('Trying to load data without being logged in')
    }
    const authedApi = api(appData.apiUrl).authed(appData.auth.jwt)
  
        
    const initialFosAndTrellisData = await authedApi.getData()
      .catch((error: Error) => {
        console.log('error', error)
        throw error
    });

    const actualTrellisData = Object.keys(initialFosAndTrellisData.trellisData).length > 0 ? initialFosAndTrellisData.trellisData : appData.data.trellisData
    const actualData = { ...initialFosAndTrellisData, trellisData: actualTrellisData }

    const initialProfileData = await authedApi.getProfile()
      .catch((error: Error) => {
        console.log('error', error)
        throw error
      });


    const newAppState: AppState = {
      ...appData,
      info: initialProfileData,
      data: actualData,
      loaded: true
    }
      
    setAppData(newAppState)
    
  }

  const saveFosAndTrellisData = debounce(async (newData: AppState) => {

    const data: AppState["data"] | null | undefined = await authedApi?.postData(appData.data).catch((error: Error) => {
      console.log('error', error)
      throw error
    });

    if (!data){
      throw new Error('error saving data')
    }else{
      setAppData({ ...appData, data: data })
    }
    

  }, 9000)
  
  const saveProfileData = debounce(async (newData: AppState) => {
    const profile: AppState["info"] | null | undefined = await authedApi?.postProfile(appData.info).catch((error: Error) => {
      console.log('error', error)
      throw error
    });

    if (!profile){
      throw new Error('error saving data')
    }else{
      setAppData({ ...appData, info: profile })
    }

  }, 9000)


  
  return {
    loadAppData,
    loggedIn,
    setDrag,
    clearDraggingNode,
    clearData,
    deleteAccount,
    setCookieConsent,
    updateEmail,
    sendMessage,
    confirmEmail,
    registerUser,
    resetPassword,
    changePassword,
    logIn,
    confirmEmailInit,
    logOut,
    saveFosAndTrellisData,
    saveProfileData

  }

}












export const getServerStateData = (appState: AppState) => 
  (newData: AppState['data'] | null): AppState => {

    if (!newData){
      return appState
    }

  const newState: AppState = { 
    ...appState, 
    data: newData,
  }
  return newState
}



export const getServerStateProfile = (appState: AppState, jwt: string) => (newProfile: InfoState): AppState => {
    
  
    const jwtProps = jwtDecode<{ username: string, exp: number}>(jwt)
  
      const newInfoState: InfoState = { 
        profile: newProfile.profile,
        subscription: newProfile.subscription,
        emailConfirmed: newProfile.emailConfirmed,
        cookies: newProfile.cookies || appState.info.cookies
      }
  
    const newState: AppState = { 
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
