import { jwtDecode } from "jwt-decode"
import { api } from "../api"
import { AppState, FosPath, FosReactOptions, FosRoute, InfoState } from "../types"
import { diff } from "@n1ru4l/json-patch-plus"
import { getNodeOperations } from "./nodeOperations"



export const getActions = (options: FosReactOptions, appData: AppState, setAppData: (state: AppState) => void) => {



    const apiObj = api(appData.apiUrl)

    const authedApi = appData.auth.jwt ? apiObj.authed(appData.auth.jwt) : undefined


    return {
        loggedIn: () => {
            return !!appData.auth.jwt
        },
        moveNodeUp: async () => {

        },
        moveNodeDown: async () => {

        },
        setDrag: async (draggingNode: string | null, draggingOverNode: string | null) => {
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
        },
        clearDraggingNode: async () => {
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
        },
        clearData: async () => {

        },
        deleteAccount: async () => {
            if (!appData.auth.jwt) {
                throw new Error('Trying to delete account without being logged in')
              }
              await api(appData.apiUrl).authed(appData.auth.jwt).deleteAccount().then(() => {
                localStorage.clear()
                window.location.href = '/'
              })
        },
        setCookieConsent: async (cookieInfo: AppState['info']['cookies']) => {

        },
        updateEmail: async (email: string) => {
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
        },
        sendMessage: async (email: string, message: string ) => {
            return await api(appData.apiUrl).public.sendMessage(email, message)
        },
        confirmEmail: async (token: string) => {
            if (authedApi){
                await authedApi.confirmEmail(token)

            } else {
                throw new Error('Must Be Logged in to Confirm Email')
            }
        },
        registerUser: async (email: string, password: string, acceptTerms: boolean) => {

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
        },
        resetPassword: async (email: string, password: string, token: string) => {        
          await api(appData.apiUrl).public.resetPassword(email, password, token)
        },
        changePassword: async (oldPassword: string, newPassword: string) => {
            if (!appData.auth.jwt) {
                throw new Error('Trying to change password without being logged in')
              }
              await api(appData.apiUrl).authed(appData.auth.jwt).changePassword(oldPassword, newPassword)
        },
        logIn: async (email: string, password: string, remember: boolean) => {
            if (remember) {
                localStorage.setItem("email", appData.auth.email)
              }
              const jwt = await api(appData.apiUrl).public.login(email, password).catch((error: Error) => {
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
          
              const authedApi = api(appData.apiUrl).authed(jwt)
          
          
              authedApi.postProfile(null)
                .then(getServerStateProfile(appData, jwt))
                .then( (response: AppState) => {
          
                  authedApi.postData<null | AppState['data']>(null)
                    .then(getServerStateData(response))
                    .then((loggedInDataState) => {
                      const difference = diff({ left: appData.info, right: loggedInDataState.info })
                      console.log('difference', difference)
                      if (Object.keys(difference).length > 0){
                        setAppData(loggedInDataState)
                      }
                    }).catch((error: Error) => {
                      console.log('error', error)
                      throw error
                    });
          
                }).catch((error: Error) => {
                  console.log('error', error)
                  throw error
                });
          
          
        },
        confirmEmailInit: async () => {

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
        },
        logOut: async () => {
            const loggedOutState = await api(appData.apiUrl).public.logout().then(() => {
                return { ...appData, auth: { ...appData.auth, jwt: undefined, loggedIn: false } }
              }).catch((error: Error) => {
                console.log('error', error)
                throw error
              });
              setAppData(loggedOutState)
            localStorage.clear()
            window.location.href = '/'
        },

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
        subscriptionSession: newProfile.subscriptionSession,
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
