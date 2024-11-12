

import { api, Mode } from "../../api";

import { Delta } from "@n1ru4l/json-patch-plus";

import { useToast } from "@/components/ui/use-toast";

export type InfoProfile = {
  // profileInfo: {
  //   [key: string]: any;
  // }
  name: string,
}

export type SubscriptionInfo = {
  subscriptionStatus: string,
  apiCallsAvailable: number,
  apiCallsUsed: number,
  apiCallsTotal: number,
}



export type InfoState = {
  profile?: InfoProfile
  subscription?: SubscriptionInfo
  emailConfirmed: boolean,
  subscriptionSession: boolean,
  cookies?: {
    acceptRequiredCookies: boolean
    acceptSharingWithThirdParties: boolean
  }
}


export type AppState<T> = {
  mode: Mode
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data: T | null
}



export type AuthState = {
  username: string,
  remember: boolean,
  jwt?: string,
  password?: string,
  email: string,
}






export type AppContext<T> = {
  setUserInfo: (newUserInfo: InfoState) => Promise<void>
  setAppState: (newState: AppState<T>) => void
  userInfo?: InfoState
  setData: (newData: T | undefined) => Promise<T | undefined>
  data: T | undefined,
  appState: AppState<T>
  loggedIn: boolean
  logIn: (email: string, password: string, remember: boolean) => Promise<void>
  logOut: () => Promise<void>
  resetPassword: (email: string, password: string, token: string) => Promise<void>
  registerUser: (email: string, password: string, accepted_terms: boolean) => Promise<void>
  theme: string
  setTheme: (theme: string) =>void
  confirmEmail: (token: string) => Promise<void>
  authedApi?: ReturnType<ReturnType<typeof api>["authed"]>
  setCookieConsent: (cookiePrefs: { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean } | undefined) => void
  deleteAccount: () => Promise<void>
  sendMessage: (email: string, message: string) => Promise<void>
  changePassword: (password: string, newPassword: string) => Promise<void>
  updateEmail: (email: string) => Promise<void>
  confirmEmailInit: () => Promise<void>
  clearData: () => Promise<void>
  toast?: ReturnType<typeof useToast>['toast'] 
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<{
      choices: {message: { content: string, role: string}, finishReason: string}[]
    }>,
  canPromptGPT: boolean,
}






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

export const initialDataState = null


export const initialAppState: (mode: Mode, url: string) => AppState<any> = (mode: Mode, url: string) => ({
  mode,
  apiUrl: url,
  auth: initialAuthState,
  info: initialInfoState,
  data: initialDataState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
  // updatedTime: 0,
  // prevHashes: JSON.parse(localStorage.getItem("prevHashes") || "" ) || []
})

