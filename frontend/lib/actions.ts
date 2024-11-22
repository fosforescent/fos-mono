import { jwtDecode } from "jwt-decode"
import { api } from "../api"
import { AppState, FosNodeId, FosPath, FosPathElem, FosReactOptions, InfoState, SubscriptionInfo, UserProfile } from "../../shared/types"
import { diff } from "@n1ru4l/json-patch-plus"
import { getNodeOperations } from "./nodeOperations"
import { debounce, set } from "lodash"


export const getActions = (options: FosReactOptions, appData: AppState, setAppData: (state: AppState) => void) => {

  if (!appData.apiUrl){
    console.log('appData', appData, options)
    throw new Error('apiUrl not found')
  }

  const apiObj = api(appData, setAppData)

  const authedApi = () => {
    if (!appData.auth.jwt) {
      if (appData.auth.loggedIn){
        // hacky fix for weird issue of jwt missing in state, probably relate to stale appData
        const jwt = JSON.parse(localStorage.getItem('auth') || 'null')
        if (jwt){
          appData.auth.jwt = jwt
        }
      }
      if(!appData.auth.jwt){
        throw new Error('no jwt, not logged in');
      }
    }
    return apiObj.authed()
  }

  const publicApi = () => {
    return apiObj.public
  }

  const putError = async (error: Error) => {
    await publicApi().putError(error, appData.auth.email)
  }


  const loggedIn = () => {
    return appData.auth.loggedIn
  }

  const clearData = async () => {

  }
  const deleteAccount = async () => {
      if (!appData.auth.jwt) {
          throw new Error('Trying to delete account without being logged in')
        }
        await authedApi().deleteAccount().then(() => {
          localStorage.clear()
          window.location.href = '/'
        })
  }
  const setCookieConsent = async (cookieInfo: AppState['info']['cookies']) => {

  }
  const updateEmail = async (email: string) => {
    if (!appData.auth.jwt) throw new Error('no jwt, not logged in', {cause: 'unauthorized'});
    authedApi().updateEmail(email).then((result) => {
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
    return await publicApi().sendMessage(email, message)
  }
  const confirmEmail = async (token: string) => {
    await authedApi().confirmEmail(token)
  }
  const registerUser = async (email: string, password: string, acceptTerms: boolean) => {

      console.log('registerUser', appData.info, appData)
      if(!appData.info.cookies){
      // throw new Error('Trying to register without cookie consent')
      console.warn('Registering without cookie consent')
      }

      if (email && password) {
      const result = await publicApi().register(email, password, acceptTerms, appData.info.cookies || {
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
    await publicApi().resetPassword(email, password, token)
  }
  const changePassword = async (oldPassword: string, newPassword: string) => {
      if (!appData.auth.jwt) {
          throw new Error('Trying to change password without being logged in')
        }
        await authedApi().changePassword(oldPassword, newPassword)
  }
  const logIn = async (email: string, password: string, remember: boolean) => {
    if (remember) {
        localStorage.setItem("email", appData.auth.email)
      }
                
      type LoginResult = { 
        access_token: string, 
        type: string,
      } & InfoState
        

      const { access_token: jwt, ...infoState } : LoginResult = await publicApi().login(email, password).catch((error: Error) => {
        console.log('error', error)
        throw error
      });
      if (!jwt) {
        console.log('no jwt', jwt, infoState)
        throw new Error('Login failed')
      }
      // const parsedJwt = JSON.parse(localStorage.getItem("auth") || "null")

      // const decodedJwt =  parsedJwt ? jwtDecode(parsedJwt)  as { username: string, exp: number } : { username: "", exp: 0 }
      // const parsedUsername = JSON.parse(localStorage.getItem("username") || "null")
      
      const jwtProps = jwtDecode<{ username: string, exp: number}>(jwt)
  
      if (jwtProps.username !== email){
        throw new Error('jwt username does not match email, login failed')
      }

      const newlyAuthedState = { ...appData, auth: { ...appData.auth, jwt, email: jwtProps.username, remember, loggedIn: true } }

      console.log('newlyAuthedState', newlyAuthedState)
  
      const newlyAuthedApi = api(newlyAuthedState, setAppData).authed()
        
      const initialFosAndTrellisData = await newlyAuthedApi.getData()
        .catch((error: Error) => {
          console.log('error', error)
          throw error
        });


        const actualTrellisData = Object.keys(initialFosAndTrellisData.trellisData).length > 0 ? initialFosAndTrellisData.trellisData : appData.data.trellisData
        const actualData = { ...initialFosAndTrellisData, trellisData: actualTrellisData }
    
        if(!jwt){
          throw new Error('no jwt')
        }

      const newAppState: AppState = {
        ...newlyAuthedState,
        info: {
          ...infoState,
        },
        data: actualData,
        loaded: true
      }

      console.log('newAppState', newAppState)
        
      setAppData(newAppState)
    
  }

  
  const confirmEmailInit = async () => {

      if (!appData.auth.jwt) {
          throw new Error("calling confirmEmailInit when not authenticated")
        }
        if(!appData.info.profile){
          throw new Error("calling confirmEmailInit when no profile, but authenticated")
        }
        const result = authedApi().confirmEmailInit()
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
      const loggedOutState = await publicApi().logOut().then(() => {
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
    if (!appData.auth.loggedIn) {
      throw new Error('Trying to load data without being logged in')
    }
    
  
        
    const initialFosAndTrellisData = await authedApi().getData()
      .catch((error: Error) => {
        console.log('error', error)
        throw error
    });

    const actualTrellisData = Object.keys(initialFosAndTrellisData.trellisData).length > 0 ? initialFosAndTrellisData.trellisData : appData.data.trellisData
    const actualData = { ...initialFosAndTrellisData, trellisData: actualTrellisData }

    const initialProfileData = await authedApi().getProfile()
      .catch((error: Error) => {
        console.log('error', error)
        throw error
      });

    // console.log('loaded Data', initialProfileData, initialFosAndTrellisData)

    const newAppState: AppState = {
      ...appData,
      info: initialProfileData,
      data: actualData,
      loaded: true
    }
      
    setAppData(newAppState)
    
  }

  const saveFosAndTrellisData = debounce(async (newData: AppState): Promise<void> => {

    const data: AppState["data"] | null | undefined = await authedApi().postData(newData.data).catch((error: Error) => {
      console.log('error', error)
      throw error
    });

    if (!data){
      throw new Error('error saving data')
    }else{
      if (!diff({left: newData.data, right: data})){
        setAppData({ ...newData, data })
        console.log('data change', diff({left: newData.data, right: data}), newData.data, data)
      } else {
        // console.log('no change in data')
      }
    }

  }, 9000, {leading: true})
  
  const saveProfileData = debounce(async (newData: AppState): Promise<void> => {
    const profile: AppState["info"] | null | undefined = await authedApi().postProfile(newData.info).catch((error: Error) => {
      console.log('error', error)
      throw error
    });

    if (!profile){
      throw new Error('error saving info data')
    }else{
      if (!diff({left: newData.info, right: profile})){
        setAppData({ ...newData, info: profile })
        console.log('profile data change', diff({left: newData.info, right: profile}), newData.info, profile)
      }else{
        // console.log('no change in profile data')
      }
    }

  }, 9000, {leading: true})


  const getDragInfo = () => {
    return appData.data.trellisData.dragInfo
  }

  const setDragInfo = async (dragInfo: AppState['data']['trellisData']['dragInfo']) => {

    setAppData({
      ...appData,
      data: {
        ...appData.data,
        trellisData: {
          ...appData.data.trellisData,
          dragInfo: {
            ...appData.data.trellisData.dragInfo,
            ...dragInfo
          }
        }
      }
    })

  }

  // const setDrag = async (draggingNode: FosPath | null, draggingOverNode: FosPath | null) => {
  //   setAppData({
  //       ...appData,
  //       data: {
  //           ...appData.data,
  //           trellisData: {
  //               ...appData.data.trellisData,
  //               draggingNode: draggingNode,
  //               draggingOverNode: draggingOverNode
  //           }
  //       }
  //   })
  // }
  // const clearDraggingNode = async () => {
  //     setAppData({
  //         ...appData,
  //         data: {
  //             ...appData.data,
  //             trellisData: {
  //                 ...appData.data.trellisData,
  //                 draggingNode: null,
  //                 draggingOverNode: null
  //             }
  //         }
  //     })
  // }

  
  return {
    loadAppData,
    putError,
    
    loggedIn,
    setDragInfo,
    getDragInfo,
    // setDrag,
    // clearDraggingNode,
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
