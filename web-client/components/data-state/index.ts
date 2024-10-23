
import { Diff } from "deep-diff";

import { FosNodeContent,  FosTrail, FosContextData, FosNodesData, FosRoute } from "@fosforescent/react-client"





import { Delta } from "@n1ru4l/json-patch-plus";

import { useToast } from "@/components/ui/use-toast";
import { defaultContext, defaultNodes } from "./initialNodes";


export type InfoProfile = {
  // profileInfo: {
  //   [key: string]: any;
  // }
  profileInfo: {
    name: string,
  }
  emailConfirmed: boolean,
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
  cookies?: {
    acceptRequiredCookies: boolean
    acceptSharingWithThirdParties: boolean
  }
}



export type AppData = FosContextData


export type AppState = {
  info: InfoState
  theme: string
  auth: AuthState
  data: DataState
}



export type AuthState = {
  username: string,
  remember: boolean,
  jwt?: string,
  password?: string,
  email: string,
}




export type DataState = {
  synced: boolean,
  stored: boolean,
  fosData: AppData,
  locked: boolean
  lastSyncTime: number
  lastStoreTime: number
  undoStack: Delta[],
  redoStack: Delta[],
  
}



export type AppContext = {
  setUserInfo: (newUserInfo: InfoState) => Promise<void>
  setAppState: (newState: AppState) => void
  userInfo?: InfoState
  setAppData: (newData: AppData) => Promise<void>
  appState: AppState
  loggedIn: boolean
  logIn: (email: string, password: string, remember: boolean) => Promise<void>
  logOut: () => Promise<void>
  resetPassword: (email: string, password: string, token: string) => Promise<void>
  registerUser: (email: string, password: string, accepted_terms: boolean) => Promise<void>
  theme: string
  setTheme: (theme: string) =>void
  confirmEmail: (token: string) => Promise<void>
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  syncAndStore: () => Promise<void>
  setCookieConsent: (cookiePrefs: { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean } | undefined) => void
  deleteAccount: () => Promise<void>
  sendMessage: (email: string, message: string) => Promise<void>
  changePassword: (password: string, newPassword: string) => Promise<void>
  updateEmail: (email: string) => Promise<void>
  confirmEmailInit: () => Promise<void>
  clearData: () => Promise<void>
  toast?: ReturnType<typeof useToast>['toast'] 

}






export const initialInfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "") : undefined,
}




export const initialAuthState = {
  username: "",
  remember: false,
  jwt: JSON.parse(localStorage.getItem("auth") || "null") || null,
  email: "",
  password: "",
  loggedIn: false,
}



export const initialDataState: DataState =  JSON.parse(localStorage.getItem("data") || "null") || {
  synced: false,
  stored: false,
  fosData: defaultContext,
  locked: false,
  lastSyncTime: 0,
  lastStoreTime: 0,
  undoStack: [],
  redoStack: []
}




export const initialAppState: AppState = {
  auth: initialAuthState,
  info: initialInfoState,
  data: initialDataState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
  // updatedTime: 0,
  // prevHashes: JSON.parse(localStorage.getItem("prevHashes") || "" ) || []
}

