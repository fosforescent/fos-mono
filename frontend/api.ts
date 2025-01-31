import React from "react"
import { EventSourcePolyfill, Event } from 'event-source-polyfill'
import { AppState, FosContextData, FosReactOptions, FosPath, InfoState, LoginResult, SubscriptionInfo, AppStateLoaded } from "../shared/types"
// import { AppData, Profile } from "./components/app-state/index"





export type Mode = "production" | "development" | "custom"


const api = (appData: AppState , setAppData: (state: AppState) => void, options: FosReactOptions) => {

  const sycApiUrl = appData.apiUrl


  const logOut = async () => {
    localStorage.removeItem("auth")
    setAppData({
      ...appData,
      loggedIn: false,
      auth: {
        username: "",
        remember: false,
        jwt: "",
        password: "",
        email: "",
      }
    })
  }


  const handleAuthError = (err: Error) => {
    console.log("handleAuthedApiError - 401", err)
    // localStorage.removeItem("auth")
    options.toast?.({
      title: "Session Expired",
      description: "Please log in again",
      duration: 10000
     })
    logOut()
  }

  const handleAuthedApiError = (err: any) => {
    if (err.status === 401) {
      handleAuthError(err)
    }else{
      console.log("handleAuthedApiError - other", err)
      throw err
    }
  }

  const handleAuthedApiJson = (res: any) => {
    if (res.status === 401) {
      handleAuthError(new Error("401 in json"))
    }else{
      // console.log("handleAuthedApiJson - other", res)
      return res.json()
    }
  }



  const login = async (user: string, pass: string): Promise<LoginResult> => {
    const url = `${sycApiUrl}/auth/login`
    console.log("handleAuth", user, pass, url)
    const result = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: user, password: pass }),
    })
      .then((res) => {
        if (res.status !== 200) {
          console.log("handleAuth - error", res)
          throw new Error("error logging in")
        }
        return res.json()
      }).catch((err) => {
        console.log("handleLogin - err (fetch)", err)
        err.cause = "login"
        throw err
      })
      .then((res) => {
        console.log("handleAuth - success", res)
        return res
      }).catch((err) => {
        console.log("handleLogin - err", err)
        err.cause = "login"
        throw err
      })
    return result
  }


  const register = async (user: string, pass: string, acceptTerms: boolean, cookies: {
    acceptRequiredCookies: boolean,
    acceptSharingWithThirdParties: boolean
  }) => {
    const url = `${sycApiUrl}/auth/register`
    console.log("handleRegister", user, pass)
    const result = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        username: user, 
        password: pass,
        accepted_terms: acceptTerms,
        cookies: cookies
      }),
    })
      .then((res) => {
        console.log("handleRegister - res", res)
        if (res.status !== 201) {
          console.log("handleRegister - error", res)
          throw new Error("error registering")
        }
        return res.json()
      })
    return result

  }

  const resetPasswordRequest = async (email: string): Promise<void> => {
    const url = `${sycApiUrl}/auth/reset-pwd`
    console.log("handleAuth", email, url)
    const result = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: email }),
    })
      .then((res) => {
        if (res.status !== 200) {
          console.log("handleAuth - error", res)
          throw new Error("error logging in")
        }
        return res.json()
      })
      .then((res) => {
        console.log("handleAuth - success", res)
        return res.access_token
      }).catch((err) => {
        console.log("handleAuth - err", err)
      })
    return result
  }


  const resetPassword = async (user: string, password: string, token: string): Promise<void> => {
    const url = `${sycApiUrl}/auth/reset-pwd-update`
    console.log("handleAuth", user, token, url)
    const result = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: user, token: token, password: password }),
    })
      .then((res) => {
        if (res.status !== 200) {
          console.log("handleAuth - error", res)
          throw new Error("Invalid token or password too weak")
        }
        return res.json()
      })
      .then((res) => {
        console.log("handleAuth - success", res)
        return res.access_token
      }).catch((err) => {
        console.log("handleAuth - err", err)
        throw err
      })
    return result
  }


  const sendMessage = async (email: string, message: string) => {

    const url = `${sycApiUrl}/email/contact-message`
    const result = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, message }),
    })
    .then(handleAuthedApiJson)
    .then((res) => {
      if (!res) { return }
      console.log("contact message - success", res)
      return res
    }).catch(handleAuthedApiError);
    return result
  }


  const putError = async (error: Error, email: string) => {
    const url = `${sycApiUrl}/error`

    const errorInfo = {
      name: error.name,
      cause: error.cause,
      message: error.message,
      stack: error.stack,
    }

    const result = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: errorInfo, email }),
    })
    .then(handleAuthedApiJson)
    .then((res) => {
      if (!res) { return }
      console.log("putError - success", res)
      return res
    }).catch(handleAuthedApiError);
    return result
  }

  const authedApi = () => {

    const jwt = appData.auth.jwt

    if (!jwt) {
      console.log("authedApi - no jwt")
      throw new Error("no jwt")
    }


    const confirmEmail = async (token: string): Promise<void> => {
      const url = `${sycApiUrl}/auth/confirm-email`
      console.log("handleAuth", token, url)
      const result = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ token: token }),
      })
        .then((res) => {
          if (res.status !== 200) {
            console.log("handleAuth - error", res)
            throw new Error("error logging in")
          }
          return res.json()
        })
        .then((res) => {
          console.log("handleAuth - success", res)
          return res.access_token
        }).catch((err) => {
          console.log("handleAuth - err", err)
        })
      return result
    }

    const confirmEmailInit = async (): Promise<void> => {
      const url = `${sycApiUrl}/auth/confirm-email-init`
      console.log("handleAuth",url)
      const result = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: "",
      })
        .then((res) => {
          if (res.status !== 200) {
            console.log("handleAuth - error", res)
            throw new Error("error logging in")
          }
          return res.json()
        })
        .then((res) => {
          console.log("handleAuth - success", res)
          return res
        }).catch((err) => {
          console.log("handleAuth - err", err)
        })
      return result
    }


    const getProfile = async (): Promise<InfoState> => {

      const url = `${sycApiUrl}/user/profile`
      const result = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
      })
      .then(handleAuthedApiJson)
      .then((res: InfoState) => {
        if (!res) { return }
        
        // console.log("getProfile - success", res)
        
        return res
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting profile")
      }

      return result
    }


    const postProfile = async (profile: Partial<InfoState> | null): Promise<InfoState> => {
      if (!jwt) {
        console.log("postProfile - no jwt")
        throw new Error("no jwt")
      }
      const url = `${sycApiUrl}/user/profile`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ user_profile: profile}),
      })
      .then(handleAuthedApiJson)
      .then((res: InfoState ) => {
        if (!res) { return }
  

        return res
      }).catch(handleAuthedApiError)

      if(!result){
        throw new Error("error posting profile")
      }

      return result
    }

    const postData = async (data: AppStateLoaded["data"]): Promise<AppStateLoaded["data"] | null> => {
      if (!jwt) {
        console.log("postData - no jwt")
        throw new Error("no jwt")
      }

      const url = `${sycApiUrl}/user/data`
      const result: AppStateLoaded["data"] | undefined | void = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ data: data, updatedTime: Date.now() }),
      })
      .then(handleAuthedApiJson)
      .then((res: {data: AppStateLoaded["data"]}) => {
        if (!res) { return }
        // console.log("getProfile - success", res)
        return res.data
      }).catch(handleAuthedApiError)

      if(!result){
        throw new Error("error posting data")
      }

      return result || null
    }

    const getData = async (): Promise<AppStateLoaded["data"]> => {
      if (!jwt) {
        console.log("getData - no jwt")
        throw new Error("no jwt")
      }

      const url = `${sycApiUrl}/user/data`
      const result = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
      })
      .then(handleAuthedApiJson)
      .then((res: {data: AppStateLoaded["data"] }) => {
        if (!res) { return }
        // console.log("getdata - success", res)
        return res.data
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error posting data")
      }

      return result
    }

  
    const getSuggestions = async (systemPrompt: string, userPrompt: string, options: {
      temperature?: number,
    }) => {
      if (!jwt) {
        console.log("getSuggestions - no jwt")
        throw new Error("no jwt")
      }

      const url = `${sycApiUrl}/user/data/suggest`
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-1106',
          messages: [
            {
              role: "system",
              children: systemPrompt
            },
            {
              role: "user",
              children: userPrompt
            }
          ],
          max_tokens: 300,
          temperature: options?.temperature || 1.0
        })
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("getProfile - success", res)

        const result: {
          subscriptionData: SubscriptionInfo,
          suggestions: typeof res.responses 
        } = {
          subscriptionData: {
            subscriptionStatus: res.subscription_data.subscription_status,
            apiCallsAvailable: res.subscription_data.api_calls_available,
            apiCallsTotal: res.subscription_data.api_calls_total,
            apiCallsUsed: res.subscription_data.api_calls_used,
            connectedAccountCreated: res.subscription_data.connected_account_created,
            connectedAccountLinked: res.subscription_data.connected_account_linked,
            connectedAccountEnabled: res.subscription_data.connected_account_enabled,
          },
          suggestions: res.responses
        }
        return result
      }).catch(handleAuthedApiError);
      return result || null
    }


    const getPortalSession = async () => {
      if (!jwt) {
        console.log("getPortalSession - no jwt")
        throw new Error("no jwt")
      }

      const returnUrl = `${window.location.origin}`
      const result = await fetch(`${sycApiUrl}/subscription/portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ return_url: returnUrl }),
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("getPortalSession - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }

    const getCheckoutSession = async () => {
      if (!jwt) {
        console.log("getCheckoutSession - no jwt")
        throw new Error("no jwt")
      }
      const successUrl = `${window.location.origin}`
      const cancelUrl = `${window.location.origin}`
      const result = await fetch(`${sycApiUrl}/subscription/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ 
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("getCheckoutSession - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }


    const getConnectSession = async () => {
      if (!jwt) {
        console.log("getCheckoutSession - no jwt")
        throw new Error("no jwt")
      }
      const successUrl = `${window.location.origin}`
      const cancelUrl = `${window.location.origin}`
      const result = await fetch(`${sycApiUrl}/subscription/connect-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ 
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("getCheckoutSession - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }

    const changePassword = async (currentPassword: string, newPassword: string) => {
      if (!jwt) {
        console.log("updatePassword - no jwt")
        throw new Error("no jwt")
      }
      const url = `${sycApiUrl}/auth/update-password`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("updatePassword - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }
    
    const updateEmail = async (email: string): Promise<string> => {
      if (!jwt) {
        console.log("updateEmail - no jwt")
        throw new Error("no jwt")
      }
      const url = `${sycApiUrl}/auth/update-email`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ email }),
      })
      .then(handleAuthedApiJson)
      .then((res: {
        access_token: string
        type: string
      }) => {
        if (!res) { throw new Error("no response") }
        console.log("updateEmail - success", res)
        return res.access_token
      }).catch(handleAuthedApiError);
      if (!result) {
        throw new Error("error updating email")
      }
      return result
    }



    const deleteAccount = async () => {
      if (!jwt) {
        console.log("deleteAccount - no jwt")
        throw new Error("no jwt")
      }
      const url = `${sycApiUrl}/user`
      const result = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: "",
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("deleteAccount - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }

    const clearData = async () => {
      if (!jwt) {
        console.log("clearData - no jwt")
        throw new Error("no jwt")
      }
      const url = `${sycApiUrl}/user/data`
      const result = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: "",
      })
      .then(handleAuthedApiJson)
      .then((res) => {
        if (!res) { return }
        console.log("clearData - success", res)
        return res
      }).catch(handleAuthedApiError);
      return result
    }

    const getEvents = async (listener: (evt: Event) => void ) => {


      const initEventSource = () => {
        const eventSource = new EventSourcePolyfill(`${sycApiUrl}/data/events`, {
          headers: {
            "Authorization": `Bearer ${jwt}`,
          }
        });
        window.fosEventSource = eventSource
        eventSource.addEventListener('newhash', listener)
        eventSource.addEventListener('ping', (evt) => {
          console.log('handling ping', evt)
          window.fosEventSource.close()
          window.fosEventSource = initEventSource();
        })
        eventSource.onerror = (evt) => {
          console.log('handling event source error', evt)
          window.fosEventSource.close()
          window.fosEventSource = initEventSource();
        }
        eventSource.onmessage = (evt) => {
          console.log('handling event source message', evt)
        }
        window.fosEventSource = eventSource
        return window.fosEventSource
      }  


      return window.fosEventSource || initEventSource()
    }


    const postRequestFriend = async (friendEmail: "string"): Promise<FosContextData> => {

      const url = `${sycApiUrl}/group/create-by-email`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ friendEmail }),
      })
      .then(handleAuthedApiJson)
      .then((res: { fosData: FosContextData }): FosContextData => {
        if (!res){
          throw new Error("no response")
        }
        return res.fosData
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting profile")
      }

      return result
    }


    const postRequestGroup = async (groupId: string): Promise<FosContextData> => {

      const url = `${sycApiUrl}/group/request-access`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ groupId }),
      })
      .then(handleAuthedApiJson)
      .then((res: { fosData: FosContextData }): FosContextData => {
        if (!res){
          throw new Error("no response")
        }
        return res.fosData
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting profile")
      }

      return result
    }


    const postQueryUserByDisplayName = async (groupId: string): Promise<FosContextData> => {

      const url = `${sycApiUrl}/user/query-display-name`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ groupId }),
      })
      .then(handleAuthedApiJson)
      .then((res: { fosData: FosContextData }): FosContextData => {
        if (!res){
          throw new Error("no response")
        }
        return res.fosData
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting display name")
      }

      return result
    }

  
    const postGetUserProfileForGroup = async (groupId: string, userId: string): Promise<FosContextData> => {

      const url = `${sycApiUrl}/user/profile-for-group`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ groupId, userId }),
      })
      .then(handleAuthedApiJson)
      .then((res: { fosData: FosContextData }): FosContextData => {
        if (!res){
          throw new Error("no response")
        }
        return res.fosData
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting profile for group")
      }

      return result
    }
  


  
    const postSemanticSearch = async (queryString: string, options: { routesToIgnore: FosPath, routesToInclude: FosPath }): Promise<FosContextData> => {

      const url = `${sycApiUrl}/user/profile-for-group`
      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ queryString, options }),
      })
      .then(handleAuthedApiJson)
      .then((res: { fosData: FosContextData }): FosContextData => {
        if (!res){
          throw new Error("no response")
        }
        return res.fosData
      }).catch(handleAuthedApiError);

      if(!result){
        throw new Error("error getting semantic search")
      }

      return result
    }
  


    const getNodeByRoute = async (route: FosPath): Promise<FosContextData> => {
        
        const url = `${sycApiUrl}/data/node-by-route`
        const result = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwt}`,
          },
          body: JSON.stringify({ route }),
        })
        .then(handleAuthedApiJson)
        .then((res: { fosData: FosContextData }): FosContextData => {
          if (!res){
            throw new Error("no response")
          }
          return res.fosData
        }).catch(handleAuthedApiError);

        if(!result){
          throw new Error("error getting node by route")
        }

        return result

    }

    return {
      getEvents,
      getProfile,
      postProfile,
      getData,
      postData,
      getSuggestions,
      getPortalSession,
      getCheckoutSession,
      getConnectSession,
      resetPassword,
      confirmEmail,
      updateEmail,
      changePassword,
      confirmEmailInit,
      deleteAccount,
      clearData,
      postRequestFriend,
      postRequestGroup,
      postQueryUserByDisplayName,
      postGetUserProfileForGroup,

    }
  }

  return {
    public: {
      login,
      logOut,
      register,
      resetPassword,
      resetPasswordRequest,
      sendMessage,
      putError,
    },
    authed: authedApi
  }
}


export {
  api
}